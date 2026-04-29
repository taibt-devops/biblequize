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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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

        for (Resource file : files) {
            seedFile(file, stats);
        }
        return stats;
    }

    private void seedFile(Resource file, SeedStats stats) {
        String filename = file.getFilename() != null ? file.getFilename() : "<unknown>";
        List<SeedQuestion> questions = parseFile(file, filename);
        if (questions == null) return; // parse error — already logged

        int fileInserted = 0, fileSkipped = 0, fileInvalid = 0;
        for (SeedQuestion sq : questions) {
            stats.total++;
            if (!isValid(sq, filename)) {
                fileInvalid++;
                stats.invalid++;
                continue;
            }
            String id = computeDeterministicId(sq);
            if (questionRepository.existsById(id)) {
                fileSkipped++;
                stats.skipped++;
                continue;
            }
            questionRepository.save(toEntity(sq, id));
            fileInserted++;
            stats.inserted++;
        }
        log.info("  {} → inserted={}, skipped={}, invalid={}",
                filename, fileInserted, fileSkipped, fileInvalid);
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
        q.setSource(sq.source != null ? sq.source : "seed:json");
        q.setCategory(sq.category);
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
        public int skipped;
        public int invalid;

        @Override public String toString() {
            return String.format("total=%d, inserted=%d, skipped=%d (already present), invalid=%d",
                    total, inserted, skipped, invalid);
        }
    }
}
