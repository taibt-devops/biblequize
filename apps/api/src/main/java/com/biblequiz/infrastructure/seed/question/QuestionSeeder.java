package com.biblequiz.infrastructure.seed.question;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Seeds quiz questions from JSON files bundled in the classpath.
 *
 * <h3>Source of truth</h3>
 *
 * <p>{@code src/main/resources/seed/questions/*_quiz.json} is the canonical
 * location for curated quiz content. Each file holds a JSON array of
 * {@link SeedQuestion} entries (see that class for the schema).
 *
 * <h3>Idempotence</h3>
 *
 * <p>Each seed question is assigned a <b>deterministic UUID</b> derived
 * from
 * {@code (book, chapter, verseStart, verseEnd, language, normalized-content)}.
 * On every startup the seeder computes the same ID for the same input;
 * {@link QuestionRepository#existsById} then skips questions already
 * present. This means:
 * <ul>
 *   <li>First startup with an empty DB → all N questions inserted.</li>
 *   <li>Subsequent startups → 0 insert, all skipped (fast).</li>
 *   <li>Adding a new question to a JSON file → only the new one inserted.</li>
 *   <li>Editing an existing question's content → generates a NEW UUID and
 *       inserts as a new row; the old one remains. Treat content edits
 *       as "add new version" rather than "replace in place".</li>
 * </ul>
 *
 * <h3>Coexistence with legacy {@code R__*_questions.sql} Flyway seeds</h3>
 *
 * <p>Legacy Flyway repeatable scripts insert questions with their own
 * UUIDs. Those rows are <b>not</b> detected by this seeder's dedup (which
 * uses a different UUID namespace). Duplicate content across both
 * sources will produce visible duplicates in quizzes. Long-term plan:
 * migrate all content to JSON and delete the SQL files (tracked in TODO
 * under task SE-5).
 *
 * <h3>Configuration</h3>
 *
 * <ul>
 *   <li>{@code app.seeding.questions.enabled} (default {@code true}) —
 *       flip to {@code false} in {@code application-prod.yml} once the
 *       DB has been seeded and further boot-time work is undesirable.</li>
 *   <li>{@code app.seeding.questions.pattern} (default
 *       {@code classpath*:seed/questions/*_quiz.json}) — resource pattern
 *       for discovering seed files.</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(
        name = "app.seeding.questions.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class QuestionSeeder {

    private static final Logger log = LoggerFactory.getLogger(QuestionSeeder.class);

    /** Namespace prefix for deterministic UUID computation; bump to invalidate all seed IDs. */
    private static final String ID_NAMESPACE = "biblequiz-seed-v1";

    /** Source tag set on rows produced by this seeder; used to scope sync-mode cleanup. */
    static final String SEED_SOURCE = "seed:json";

    /**
     * Matches both VI ({@code xxx_quiz.json}) and EN ({@code xxx_quiz_en.json})
     * seed files. The deterministic ID already includes {@code language} in
     * its hash, so VI + EN versions of the same question coexist as distinct
     * DB rows without collision.
     */
    private static final String DEFAULT_PATTERN = "classpath*:seed/questions/*_quiz*.json";

    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;
    private final ResourcePatternResolver resourceResolver;

    @Value("${app.seeding.questions.pattern:" + DEFAULT_PATTERN + "}")
    private String pattern;

    /**
     * When true (default), hard-deletes seed rows whose deterministic IDs no
     * longer appear in the JSON files. Scoped to {@code source='seed:json'}
     * so admin/AI-generated rows are preserved. CASCADE on FK references
     * (V44) propagates the delete to user_question_history, answers, etc.
     *
     * <p>Set to {@code false} in tests or environments where the seed JSON
     * is intentionally a subset of the DB.
     */
    @Value("${app.seeding.questions.sync-stale:true}")
    private boolean syncStale;

    @Autowired
    public QuestionSeeder(QuestionRepository questionRepository,
                          ObjectMapper objectMapper) {
        this.questionRepository = questionRepository;
        this.objectMapper = objectMapper;
        this.resourceResolver = new PathMatchingResourcePatternResolver();
    }

    /**
     * Hook: runs after Spring Boot is fully ready so DB + Flyway migrations
     * have already completed. Non-blocking with respect to request
     * serving (the event fires after the embedded web server is up).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        try {
            SeedStats stats = seedAll();
            log.info("QuestionSeeder complete — {}", stats);
        } catch (Exception e) {
            // Never fail startup because of seed issues — just log loudly.
            log.error("QuestionSeeder failed — continuing without seeding", e);
        }
    }

    /**
     * Main entry point. Public for testability (unit tests can invoke
     * directly without triggering the event).
     */
    @Transactional
    public SeedStats seedAll() throws IOException {
        SeedStats stats = new SeedStats();
        Resource[] files = resourceResolver.getResources(pattern);

        if (files.length == 0) {
            log.warn("QuestionSeeder: no seed files matched pattern '{}'", pattern);
            return stats;
        }

        // Tracks the canonical set of seed-source IDs per (book|language) so
        // sync-mode can compute the complement (== "stale rows") and delete
        // them after all files are processed.
        Map<String, Set<String>> seenIdsByGroup = new HashMap<>();

        // Preload every existing content_hash so we can skip inserts that would
        // violate uq_questions_content_hash (V68). The id-based dedup misses
        // punctuation-variants (id keeps punctuation, content_hash strips it),
        // and a single violation would abort the whole seeding transaction.
        Set<String> knownContentHashes = new HashSet<>(questionRepository.findAllContentHashes());

        for (Resource file : files) {
            seedFile(file, stats, seenIdsByGroup, knownContentHashes);
        }

        if (syncStale) {
            deleteStaleSeedRows(seenIdsByGroup, stats);
        }
        return stats;
    }

    private void seedFile(Resource file, SeedStats stats,
                          Map<String, Set<String>> seenIdsByGroup,
                          Set<String> knownContentHashes) {
        String filename = file.getFilename() != null ? file.getFilename() : "<unknown>";
        List<SeedQuestion> questions = parseFile(file, filename);
        if (questions == null) return; // parse error — already logged

        int fileInserted = 0, fileUpdated = 0, fileSkipped = 0, fileInvalid = 0, fileDupHash = 0;
        for (SeedQuestion sq : questions) {
            stats.total++;
            if (!isValid(sq, filename)) {
                fileInvalid++;
                stats.invalid++;
                continue;
            }
            String id = computeDeterministicId(sq);
            // Record the ID under its (book|language) group BEFORE deciding to
            // insert or skip — otherwise an existing row that the JSON still
            // covers would be flagged as stale and deleted.
            String lang = sq.language != null ? sq.language : "vi";
            seenIdsByGroup
                    .computeIfAbsent(groupKey(sq.book, lang), k -> new HashSet<>())
                    .add(id);

            Question fresh = toEntity(sq, id);
            Question existing = questionRepository.findById(id).orElse(null);
            if (existing == null) {
                // Skip inserts whose logical-identity hash already exists — a
                // punctuation-variant of an existing question. Inserting would
                // violate uq_questions_content_hash and abort the transaction.
                String contentHash = computeContentHash(sq);
                if (!knownContentHashes.add(contentHash)) {
                    fileDupHash++;
                    stats.skipped++;
                    continue;
                }
                questionRepository.save(fresh);
                fileInserted++;
                stats.inserted++;
            } else if (needsUpdate(existing, fresh)) {
                // Mutate existing entity in place so JPA dirty-tracks the change
                // and Hibernate can issue an UPDATE rather than a merge that
                // detaches/reattaches CASCADE-linked rows.
                existing.setBook(fresh.getBook());
                existing.setChapter(fresh.getChapter());
                existing.setVerseStart(fresh.getVerseStart());
                existing.setVerseEnd(fresh.getVerseEnd());
                existing.setDifficulty(fresh.getDifficulty());
                existing.setType(fresh.getType());
                existing.setContent(fresh.getContent());
                existing.setOptions(fresh.getOptions());
                existing.setCorrectAnswer(fresh.getCorrectAnswer());
                existing.setExplanation(fresh.getExplanation());
                existing.setCorrectAnswerText(fresh.getCorrectAnswerText());
                existing.setLanguage(fresh.getLanguage());
                existing.setTags(fresh.getTags());
                existing.setCategory(fresh.getCategory());
                existing.setStory(fresh.getStory());
                questionRepository.save(existing);
                fileUpdated++;
                stats.updated++;
            } else {
                fileSkipped++;
                stats.skipped++;
            }
        }
        log.info("  {} → inserted={}, updated={}, skipped={}, dupHash={}, invalid={}",
                filename, fileInserted, fileUpdated, fileSkipped, fileDupHash, fileInvalid);
    }

    /** Punctuation stripped by the SQL content_hash generated column (V68). */
    private static final char[] HASH_STRIP =
            {'?', '!', '.', ',', ';', ':', '"', '\'', '(', ')', '[', ']', '{', '}'};

    /**
     * Recompute the DB's {@code content_hash} generated column (V68) in Java so
     * the seeder can pre-check for collisions before issuing an INSERT.
     * Must match the SQL exactly:
     * {@code SHA2(book|chapter|verse_start|verse_end|language|normalized, 256)}
     * where normalized = lowercase, strip 14 punctuation chars, collapse
     * whitespace, trim. Mirrors {@code toEntity}: content is trimmed and
     * language defaults to {@code "vi"}.
     */
    static String computeContentHash(SeedQuestion sq) {
        String norm = sq.content == null ? "" : sq.content.toLowerCase(Locale.ROOT);
        for (char c : HASH_STRIP) {
            norm = norm.replace(String.valueOf(c), "");
        }
        norm = norm.replaceAll("\\s+", " ").trim();
        String lang = sq.language != null ? sq.language : "vi";
        String key = safe(sq.book) + "|"
                + (sq.chapter == null ? "" : sq.chapter) + "|"
                + (sq.verseStart == null ? "" : sq.verseStart) + "|"
                + (sq.verseEnd == null ? "" : sq.verseEnd) + "|"
                + lang + "|"
                + norm;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /**
     * Returns true if any seedable field differs between {@code existing}
     * (DB row) and {@code fresh} (parsed from JSON). Only fields the seeder
     * owns are compared — admin-managed fields (review status, approvals,
     * isActive, source) are left untouched.
     */
    private static boolean needsUpdate(Question existing, Question fresh) {
        return !java.util.Objects.equals(existing.getOptions(), fresh.getOptions())
                || !java.util.Objects.equals(existing.getCorrectAnswer(), fresh.getCorrectAnswer())
                || !java.util.Objects.equals(existing.getExplanation(), fresh.getExplanation())
                || !java.util.Objects.equals(existing.getCorrectAnswerText(), fresh.getCorrectAnswerText())
                || !java.util.Objects.equals(existing.getDifficulty(), fresh.getDifficulty())
                || !java.util.Objects.equals(existing.getType(), fresh.getType())
                || !java.util.Objects.equals(existing.getVerseEnd(), fresh.getVerseEnd())
                || !java.util.Objects.equals(existing.getTags(), fresh.getTags())
                || !java.util.Objects.equals(existing.getCategory(), fresh.getCategory())
                || !java.util.Objects.equals(existing.getStory(), fresh.getStory());
    }

    /**
     * Hard-deletes rows where {@code source='seed:json'} and {@code (book,
     * language)} matches a seeded group but the row's ID is not in the new
     * canonical set. CASCADE FKs propagate the delete to dependent tables
     * (answers, bookmarks, user_question_history, etc.) — see V44.
     *
     * <p>If a (book, language) group has zero IDs in the JSON (file was
     * deleted or emptied), this method does NOT delete that group, because
     * we can't distinguish "intentionally empty" from "file missing on this
     * classpath scan". Drop the file from the codebase and run a manual
     * cleanup if a full purge is needed.
     */
    private void deleteStaleSeedRows(Map<String, Set<String>> seenIdsByGroup, SeedStats stats) {
        for (Map.Entry<String, Set<String>> e : seenIdsByGroup.entrySet()) {
            String[] parts = e.getKey().split("\\|", 2);
            if (parts.length != 2) continue;
            String book = parts[0];
            String lang = parts[1];
            Set<String> keep = e.getValue();
            if (keep.isEmpty()) continue;
            int deleted = questionRepository.deleteStaleBySourceBookLanguage(
                    SEED_SOURCE, book, lang, keep);
            if (deleted > 0) {
                stats.staleDeleted += deleted;
                log.info("  sync-mode: ({}, {}) — deleted {} stale seed row(s)",
                        book, lang, deleted);
            }
        }
        if (stats.staleDeleted > 0) {
            log.info("QuestionSeeder sync-mode: total {} stale seed rows hard-deleted",
                    stats.staleDeleted);
        }
    }

    /** Group key used to bucket IDs for sync-mode cleanup. */
    static String groupKey(String book, String language) {
        return safe(book) + "|" + safe(language);
    }

    private List<SeedQuestion> parseFile(Resource file, String filename) {
        try (InputStream in = file.getInputStream()) {
            CollectionType type = objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, SeedQuestion.class);
            return objectMapper.readValue(in, type);
        } catch (IOException e) {
            log.error("QuestionSeeder: failed to parse '{}' — skipping", filename, e);
            return null;
        }
    }

    private boolean isValid(SeedQuestion sq, String filename) {
        if (sq == null) return false;
        if (isBlank(sq.book) || isBlank(sq.content) || isBlank(sq.type) || isBlank(sq.difficulty)) {
            log.warn("QuestionSeeder: [{}] skipping question with missing required field (book/content/type/difficulty)", filename);
            return false;
        }
        if (sq.chapter == null || sq.verseStart == null) {
            log.warn("QuestionSeeder: [{}] skipping '{}' — missing chapter/verseStart", filename, trimForLog(sq.content));
            return false;
        }
        if (sq.correctAnswer == null || sq.correctAnswer.isEmpty()) {
            log.warn("QuestionSeeder: [{}] skipping '{}' — missing correctAnswer", filename, trimForLog(sq.content));
            return false;
        }
        return true;
    }

    /** Compute a UUID that depends only on the logical identity of the question. */
    static String computeDeterministicId(SeedQuestion sq) {
        String key = ID_NAMESPACE + "|"
                + safe(sq.book) + "|"
                + sq.chapter + "|"
                + sq.verseStart + "|"
                + (sq.verseEnd == null ? "" : sq.verseEnd) + "|"
                + safe(sq.language) + "|"
                + normalize(sq.content);
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
    }

    /** Map a {@link SeedQuestion} into a persistent {@link Question} entity. */
    static Question toEntity(SeedQuestion sq, String id) {
        Question q = new Question();
        q.setId(id);
        q.setBook(sq.book);
        q.setChapter(sq.chapter);
        q.setVerseStart(sq.verseStart);
        q.setVerseEnd(sq.verseEnd);
        q.setDifficulty(Question.Difficulty.valueOf(sq.difficulty.toLowerCase(Locale.ROOT)));
        q.setType(Question.Type.valueOf(sq.type.toLowerCase(Locale.ROOT)));
        q.setContent(sq.content.trim());
        q.setOptions(resolveOptions(sq));
        q.setCorrectAnswer(new ArrayList<>(sq.correctAnswer));
        q.setExplanation(sq.explanation);
        q.setCorrectAnswerText(sq.correctAnswerText);
        q.setLanguage(sq.language != null ? sq.language : "vi");
        q.setIsActive(true);
        q.setReviewStatus(Question.ReviewStatus.ACTIVE);
        q.setApprovalsCount(0);
        // Tags are stored as a JSON array string in the DB column.
        q.setTags(serializeTags(sq.tags));
        // Tag the row so an admin can later tell which rows came from the seed
        // vs manual admin import vs AI generation.
        q.setSource(sq.source != null ? sq.source : SEED_SOURCE);
        q.setCategory(sq.category);
        q.setStory(sq.story);
        return q;
    }

    /**
     * Serialize tags to the JSON-string shape expected by the DB column.
     * Returns {@code null} when no tags are present so the DB row stores
     * SQL NULL (smaller + easier to filter than {@code "[]"}).
     */
    static String serializeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return null;
        // Hand-roll a minimal JSON array to avoid a static ObjectMapper
        // dependency in a static helper. Inputs come from curated JSON
        // seed files so control characters / quotes are rare but escape
        // the two characters that break JSON just to be safe.
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < tags.size(); i++) {
            if (i > 0) sb.append(',');
            String tag = tags.get(i);
            sb.append('"');
            if (tag != null) {
                for (int j = 0; j < tag.length(); j++) {
                    char c = tag.charAt(j);
                    if (c == '"' || c == '\\') sb.append('\\');
                    sb.append(c);
                }
            }
            sb.append('"');
        }
        sb.append(']');
        return sb.toString();
    }

    /**
     * True/false questions in the JSON often omit {@code options}; backfill
     * a canonical [true, false] pair so downstream code (FE renderer,
     * answer validation) has a uniform shape.
     */
    private static List<String> resolveOptions(SeedQuestion sq) {
        if (sq.options != null && !sq.options.isEmpty()) {
            return new ArrayList<>(sq.options);
        }
        if ("true_false".equalsIgnoreCase(sq.type)) {
            // Keep in the question's language so FE can render without i18n lookup.
            return "en".equalsIgnoreCase(sq.language)
                    ? List.of("True", "False")
                    : List.of("Đúng", "Sai");
        }
        return new ArrayList<>();
    }

    // ── Helpers ──────────────────────────────────────────────────

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private static String safe(String s) { return s == null ? "" : s; }
    private static String normalize(String s) {
        if (s == null) return "";
        return s.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
    private static String trimForLog(String s) {
        if (s == null) return "";
        return s.length() > 60 ? s.substring(0, 60) + "…" : s;
    }

    /** Aggregated result of a seeding run. */
    public static class SeedStats {
        public int total;
        public int inserted;
        public int updated;
        public int skipped;
        public int invalid;
        public int staleDeleted;

        @Override public String toString() {
            return String.format("total=%d, inserted=%d, updated=%d, skipped=%d (already present), invalid=%d, staleDeleted=%d",
                    total, inserted, updated, skipped, invalid, staleDeleted);
        }
    }
}
