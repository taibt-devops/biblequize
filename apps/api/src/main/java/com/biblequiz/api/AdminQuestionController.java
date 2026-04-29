package com.biblequiz.api;

import com.biblequiz.infrastructure.exception.BusinessLogicException;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.service.BasicQuizService;
import com.biblequiz.modules.quiz.service.DuplicateDetectionService;
import com.biblequiz.modules.quiz.service.DuplicateDetectionService.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/questions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminQuestionController {

    private static final Logger log = LoggerFactory.getLogger(AdminQuestionController.class);

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DuplicateDetectionService duplicateDetectionService;

    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        log.info("[ADMIN] Questions ping OK");
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String book,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String reviewStatus,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String category) {

        Question.Difficulty diff = null;
        if (difficulty != null && !difficulty.isBlank()) {
            try { diff = Question.Difficulty.valueOf(difficulty); } catch (Exception ignored) {}
        }
        Question.Type qType = null;
        if (type != null && !type.isBlank()) {
            try { qType = Question.Type.valueOf(type.replace("-", "_")); } catch (Exception ignored) {}
        }
        Question.ReviewStatus rs = null;
        if (reviewStatus != null && !reviewStatus.isBlank()) {
            try { rs = Question.ReviewStatus.valueOf(reviewStatus); } catch (Exception ignored) {}
        }
        String searchParam = (search != null && !search.isBlank())
                ? "%" + search.toLowerCase() + "%" : null;
        String bookParam = (book != null && !book.isBlank()) ? book : null;
        String langParam = (language != null && !language.isBlank()) ? language : null;
        String categoryParam = (category != null && !category.isBlank()) ? category : null;

        var pageable = org.springframework.data.domain.PageRequest.of(
                page, Math.min(size, 200),
                org.springframework.data.domain.Sort.by("createdAt").descending());

        var result = questionRepository.findWithAdminFilters(
                bookParam, diff, qType, langParam, rs, categoryParam, searchParam, pageable);

        return ResponseEntity.ok(Map.of(
                "questions", result.getContent(),
                "total", result.getTotalElements(),
                "page", page,
                "size", size,
                "totalPages", result.getTotalPages()
        ));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Question q,
            @RequestParam(value = "pending", defaultValue = "false") boolean pending,
            @RequestParam(value = "forceCreate", defaultValue = "false") boolean forceCreate) {

        // Check duplicate BEFORE save
        DuplicateCheckResult dupResult = duplicateDetectionService.checkDuplicate(
                new DuplicateCheckRequest(
                        q.getContent(), q.getCorrectAnswerText(), q.getBook(),
                        q.getChapter(), q.getVerseStart(), q.getLanguage()
                )
        );

        if (dupResult.blocked()) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "DUPLICATE",
                    "message", dupResult.message(),
                    "existingQuestion", dupResult.matches().isEmpty() ? Map.of() : dupResult.matches().get(0)
            ));
        }

        if (!dupResult.matches().isEmpty() && !forceCreate) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "POSSIBLE_DUPLICATE",
                    "message", dupResult.message(),
                    "similarQuestions", dupResult.matches(),
                    "hint", "Gửi lại với forceCreate=true nếu muốn tạo"
            ));
        }

        q.setId(UUID.randomUUID().toString());
        if (pending) {
            q.setIsActive(false);
            q.setReviewStatus(Question.ReviewStatus.PENDING);
            q.setApprovalsCount(0);
        } else {
            q.setReviewStatus(Question.ReviewStatus.ACTIVE);
            q.setApprovalsCount(2);
        }
        return ResponseEntity.ok(questionRepository.save(q));
    }

    @PostMapping("/check-duplicate")
    public ResponseEntity<?> checkDuplicate(@RequestBody Map<String, Object> body) {
        DuplicateCheckResult result = duplicateDetectionService.checkDuplicate(
                new DuplicateCheckRequest(
                        (String) body.get("content"),
                        (String) body.get("correctAnswerText"),
                        (String) body.get("book"),
                        body.get("chapter") != null ? ((Number) body.get("chapter")).intValue() : null,
                        body.get("verseStart") != null ? ((Number) body.get("verseStart")).intValue() : null,
                        (String) body.get("language")
                )
        );
        return ResponseEntity.ok(result);
    }

    @PutMapping(path = "/{id}")
    public ResponseEntity<?> update(@PathVariable("id") String id, @RequestBody Question body) {
        try {
            log.info("[ADMIN] Update question id={} payload received", id);
            Optional<Question> opt = questionRepository.findById(id);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();
            Question q = opt.get();
            // Snapshot pre-update active flag so we can detect an
            // active → inactive transition on a Bible Basics row and trip
            // the safeguard before .save() commits.
            boolean wasActive = Boolean.TRUE.equals(q.getIsActive());
            if (body.getBook() != null) q.setBook(body.getBook());
            if (body.getChapter() != null) q.setChapter(body.getChapter());
            if (body.getVerseStart() != null) q.setVerseStart(body.getVerseStart());
            if (body.getVerseEnd() != null) q.setVerseEnd(body.getVerseEnd());
            if (body.getDifficulty() != null) q.setDifficulty(body.getDifficulty());
            if (body.getType() != null) q.setType(body.getType());
            if (body.getContent() != null) q.setContent(body.getContent());
            if (body.getOptions() != null) q.setOptions(body.getOptions());
            if (body.getCorrectAnswer() != null) q.setCorrectAnswer(body.getCorrectAnswer());
            if (body.getExplanation() != null) q.setExplanation(body.getExplanation());
            if (body.getTags() != null) q.setTags(body.getTags());
            if (body.getLanguage() != null) q.setLanguage(body.getLanguage());
            if (body.getIsActive() != null) q.setIsActive(body.getIsActive());
            if (body.getCorrectAnswerText() != null) q.setCorrectAnswerText(body.getCorrectAnswerText());
            if (body.getReviewStatus() != null) {
                q.setReviewStatus(body.getReviewStatus());
                if (body.getReviewStatus() == Question.ReviewStatus.ACTIVE) {
                    q.setIsActive(true);
                    if (q.getApprovalsCount() < 2) q.setApprovalsCount(2);
                } else {
                    q.setIsActive(false);
                }
            }
            if (wasActive && !Boolean.TRUE.equals(q.getIsActive())) {
                // Build a synthetic Question carrying just (category, language, isActive=true)
                // so the shared safeguard can attribute the deactivation correctly.
                Question removed = new Question();
                removed.setCategory(q.getCategory());
                removed.setLanguage(q.getLanguage());
                removed.setIsActive(true);
                assertBibleBasicsSafeguard(List.of(removed));
            }
            Question saved = questionRepository.save(q);
            log.info("[ADMIN] Update question id={} success", id);
            return ResponseEntity.ok(saved);
        } catch (BusinessLogicException ex) {
            // Let GlobalExceptionHandler map this to 400 (e.g. Bible Basics
            // safeguard) instead of swallowing it into a 500 here.
            throw ex;
        } catch (Exception ex) {
            log.error("[ADMIN] Update question id={} failed: {}", id, ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "UPDATE_FAILED",
                    "message", ex.getMessage()
            ));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        Optional<Question> opt = questionRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        assertBibleBasicsSafeguard(List.of(opt.get()));
        questionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Map<String, Object>> bulkDelete(@RequestBody Map<String, List<String>> payload) {
        List<String> ids = payload.get("ids");
        if (ids == null || ids.isEmpty()) return ResponseEntity.badRequest().build();
        List<Question> targets = questionRepository.findAllById(ids);
        assertBibleBasicsSafeguard(targets);
        questionRepository.deleteAllById(ids);
        return ResponseEntity.ok(Map.of("deleted", ids.size()));
    }

    /**
     * Block any operation that would drop the active Bible Basics catechism
     * pool below {@link BasicQuizService#TOTAL_QUESTIONS} for any language.
     * The /api/basic-quiz/questions endpoint requires exactly 10 active rows
     * per language to function — falling short would 5xx every quiz attempt
     * and silently break Ranked unlock for all new users.
     *
     * @param removals questions being deleted OR transitioning from
     *                 active → inactive. Non-bible_basics or already-inactive
     *                 entries are no-ops here.
     */
    private void assertBibleBasicsSafeguard(List<Question> removals) {
        Map<String, Long> activeRemovedByLang = removals.stream()
                .filter(Objects::nonNull)
                .filter(q -> BasicQuizService.CATEGORY.equals(q.getCategory()))
                .filter(q -> Boolean.TRUE.equals(q.getIsActive()))
                .collect(Collectors.groupingBy(Question::getLanguage, Collectors.counting()));

        if (activeRemovedByLang.isEmpty()) return;

        for (var entry : activeRemovedByLang.entrySet()) {
            String lang = entry.getKey();
            long active = questionRepository.countByCategoryAndLanguageAndIsActiveTrue(
                    BasicQuizService.CATEGORY, lang);
            long remaining = active - entry.getValue();
            if (remaining < BasicQuizService.TOTAL_QUESTIONS) {
                throw new BusinessLogicException(
                        "Cannot drop active Bible Basics pool below "
                                + BasicQuizService.TOTAL_QUESTIONS
                                + " for language '" + lang + "' (would leave " + remaining + ").");
            }
        }
    }

    // ── Import ───────────────────────────────────────────────────────────────

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> importQuestions(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "dryRun", defaultValue = "false") boolean dryRun,
            @RequestParam(value = "skipDuplicates", defaultValue = "false") boolean skipDuplicates) {
        try {
            String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
            String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

            List<Question> toSave = new ArrayList<>();
            List<Map<String, Object>> errors = new ArrayList<>();

            if (filename.endsWith(".json") || contentType.contains("json")) {
                parseJson(file, toSave, errors);
            } else if (filename.endsWith(".csv") || contentType.contains("csv") || contentType.contains("text/plain")) {
                parseCsv(file, toSave, errors);
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported file type. Use .json or .csv"));
            }

            // ── Post-parse validation (IMP-1 through IMP-6) ──
            List<Map<String, Object>> warnings = new ArrayList<>();
            Set<String> seenContents = new HashSet<>();
            int duplicateCount = 0;
            Iterator<Question> it = toSave.iterator();
            int idx = 0;
            while (it.hasNext()) {
                Question q = it.next();
                idx++;
                String label = "record " + idx;

                // IMP-1: Explanation warning (chỉ cảnh báo, vẫn active)
                if (q.getExplanation() == null || q.getExplanation().isBlank()) {
                    warnings.add(Map.of("index", idx, "warning", label + ": thiếu explanation"));
                }

                // IMP-2: Options validation per type
                Question.Type qType = q.getType();
                if (qType == Question.Type.multiple_choice_single || qType == Question.Type.multiple_choice_multi) {
                    if (q.getOptions() == null || q.getOptions().size() < 2) {
                        errors.add(Map.of("index", idx, "error", label + ": MCQ requires options (min 2)"));
                        it.remove(); continue;
                    }
                    if (q.getCorrectAnswer() != null) {
                        for (int ans : q.getCorrectAnswer()) {
                            if (ans < 0 || ans >= q.getOptions().size()) {
                                errors.add(Map.of("index", idx, "error", label + ": correctAnswer " + ans + " out of range (0-" + (q.getOptions().size() - 1) + ")"));
                                it.remove(); break;
                            }
                        }
                    }
                }
                if (qType == Question.Type.true_false) {
                    if (q.getOptions() == null || q.getOptions().isEmpty()) {
                        q.setOptions(List.of("Đúng", "Sai"));
                    }
                    if (q.getCorrectAnswer() != null && !q.getCorrectAnswer().isEmpty()) {
                        int ans = q.getCorrectAnswer().get(0);
                        if (ans != 0 && ans != 1) {
                            errors.add(Map.of("index", idx, "error", label + ": true_false correctAnswer must be 0 or 1"));
                            it.remove(); continue;
                        }
                    }
                }

                // IMP-3: Language default
                if (q.getLanguage() == null || q.getLanguage().isBlank()) q.setLanguage("vi");

                // IMP-4: Vietnamese book name normalization
                q.setBook(normalizeBookName(q.getBook()));

                // IMP-5: Duplicate detection (3-layer)
                String contentKey = q.getContent() != null ? q.getContent().trim().toLowerCase() : "";
                if (seenContents.contains(contentKey)) {
                    warnings.add(Map.of("index", idx, "warning", label + ": trùng lặp với record khác trong file"));
                    duplicateCount++;
                    if (skipDuplicates) { it.remove(); continue; }
                } else {
                    DuplicateCheckResult dupResult = duplicateDetectionService.checkDuplicate(
                            new DuplicateCheckRequest(q.getContent(), q.getCorrectAnswerText(),
                                    q.getBook(), q.getChapter(), q.getVerseStart(), q.getLanguage()));
                    if (dupResult.status() == DuplicateStatus.EXACT_MATCH) {
                        warnings.add(Map.of("index", idx, "warning", label + ": trùng hệt câu trong DB (BLOCKED)"));
                        duplicateCount++;
                        it.remove(); continue;
                    } else if (dupResult.status() != DuplicateStatus.NO_MATCH) {
                        warnings.add(Map.of("index", idx, "warning", label + ": " + dupResult.message()));
                        duplicateCount++;
                        if (skipDuplicates) { it.remove(); continue; }
                    }
                }
                seenContents.add(contentKey);
            }

            Map<String, Object> response = new LinkedHashMap<>();
            if (dryRun) {
                log.info("[ADMIN] Import dry-run: willImport={}, errors={}, warnings={}", toSave.size(), errors.size(), warnings.size());
                response.put("dryRun", true);
                response.put("willImport", toSave.size());
                response.put("errors", errors);
                response.put("warnings", warnings);
                response.put("duplicates", duplicateCount);
                return ResponseEntity.ok(response);
            }

            // Imported questions go to PENDING review queue
            for (Question q : toSave) {
                q.setIsActive(false);
                q.setReviewStatus(Question.ReviewStatus.PENDING);
                q.setApprovalsCount(0);
            }

            // Save in batches of 100
            int saved = 0;
            for (int i = 0; i < toSave.size(); i += 100) {
                List<Question> batch = toSave.subList(i, Math.min(i + 100, toSave.size()));
                questionRepository.saveAll(batch);
                saved += batch.size();
            }
            log.info("[ADMIN] Import done: saved={}, errors={}, warnings={}", saved, errors.size(), warnings.size());
            response.put("imported", saved);
            response.put("errors", errors);
            response.put("warnings", warnings);
            response.put("duplicates", duplicateCount);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[ADMIN] Import failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Import helpers ───────────────────────────────────────────────────────

    private void parseJson(MultipartFile file, List<Question> out, List<Map<String, Object>> errors) throws Exception {
        List<Map<String, Object>> records = objectMapper.readValue(
                file.getInputStream(), new TypeReference<>() {
                });
        for (int i = 0; i < records.size(); i++) {
            try {
                out.add(buildFromJsonRecord(records.get(i), i + 1));
            } catch (Exception e) {
                errors.add(Map.of("index", i + 1, "error", e.getMessage()));
            }
        }
    }

    private void parseCsv(MultipartFile file, List<Question> out, List<Map<String, Object>> errors) throws Exception {
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));

        List<String> headers = null;
        int lineNumber = 0;

        String line;
        while ((line = reader.readLine()) != null) {
            lineNumber++;
            if (line.isBlank() || line.startsWith("#")) continue;

            List<String> fields = parseCsvLine(line);
            if (headers == null) {
                headers = fields.stream().map(String::trim).collect(Collectors.toList());
                continue;
            }

            Map<String, String> record = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                record.put(headers.get(i), i < fields.size() ? fields.get(i) : "");
            }
            try {
                out.add(buildFromCsvRecord(record, lineNumber));
            } catch (Exception e) {
                errors.add(Map.of("line", lineNumber, "error", e.getMessage()));
            }
        }
    }

    private List<String> parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuote) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        sb.append('"');
                        i++;
                    } else {
                        inQuote = false;
                    }
                } else {
                    sb.append(c);
                }
            } else {
                if (c == '"') {
                    inQuote = true;
                } else if (c == ',') {
                    fields.add(sb.toString().trim());
                    sb.setLength(0);
                } else {
                    sb.append(c);
                }
            }
        }
        fields.add(sb.toString().trim());
        return fields;
    }

    private Question buildFromCsvRecord(Map<String, String> r, int line) throws Exception {
        String book = req(r, "book", "line " + line);
        String typeStr = req(r, "type", "line " + line);
        String text = req(r, "text", "line " + line);
        String correctAnswerStr = req(r, "correctAnswer", "line " + line);
        String difficultyStr = req(r, "difficulty", "line " + line);

        Question q = new Question();
        q.setId(UUID.randomUUID().toString());
        q.setBook(book);
        q.setType(normalizeType(typeStr));
        q.setContent(text);
        q.setDifficulty(Question.Difficulty.valueOf(difficultyStr.toLowerCase()));
        q.setIsActive(false);
        q.setReviewStatus(Question.ReviewStatus.PENDING);
        q.setApprovalsCount(0);

        // Options: optionA–D (skip blanks)
        List<String> options = new ArrayList<>();
        for (String key : List.of("optionA", "optionB", "optionC", "optionD")) {
            String v = r.getOrDefault(key, "").trim();
            if (!v.isEmpty()) options.add(v);
        }
        if (!options.isEmpty()) q.setOptions(options);

        // correctAnswer: "0" or "0,1"
        List<Integer> ca = Arrays.stream(correctAnswerStr.split(","))
                .map(s -> Integer.parseInt(s.trim()))
                .collect(Collectors.toList());
        q.setCorrectAnswer(ca);

        String chap = r.getOrDefault("chapter", "").trim();
        if (!chap.isEmpty()) q.setChapter(Integer.parseInt(chap));

        q.setExplanation(r.getOrDefault("explanation", "").trim());
        return q;
    }

    private Question buildFromJsonRecord(Map<String, Object> r, int index) throws Exception {
        String book = reqJson(r, "book", "record " + index);
        String typeStr = reqJson(r, "type", "record " + index);
        String difficultyStr = reqJson(r, "difficulty", "record " + index);

        // Accept "text" or "content" as question text
        String text = str(r, "text");
        if (text == null || text.isBlank()) text = str(r, "content");
        if (text == null || text.isBlank())
            throw new Exception("record " + index + ": 'text' or 'content' is required");

        Object caObj = r.get("correctAnswer");
        if (caObj == null) throw new Exception("record " + index + ": 'correctAnswer' is required");

        List<Integer> ca;
        if (caObj instanceof List<?> list) {
            ca = list.stream().map(x -> ((Number) x).intValue()).collect(Collectors.toList());
        } else if (caObj instanceof Number n) {
            ca = List.of(n.intValue());
        } else {
            throw new Exception("record " + index + ": 'correctAnswer' must be array or number");
        }

        Question q = new Question();
        q.setId(UUID.randomUUID().toString());
        q.setBook(book);
        q.setType(normalizeType(typeStr));
        q.setContent(text);
        q.setDifficulty(Question.Difficulty.valueOf(difficultyStr.toLowerCase()));
        q.setCorrectAnswer(ca);
        q.setIsActive(false);
        q.setReviewStatus(Question.ReviewStatus.PENDING);
        q.setApprovalsCount(0);

        Object optionsObj = r.get("options");
        if (optionsObj instanceof List<?> list) {
            q.setOptions(list.stream().map(Object::toString).collect(Collectors.toList()));
        }

        if (r.get("chapter") instanceof Number n) q.setChapter(n.intValue());
        if (r.get("verseStart") instanceof Number n) q.setVerseStart(n.intValue());
        if (r.get("verseEnd") instanceof Number n) q.setVerseEnd(n.intValue());

        String explanation = str(r, "explanation");
        if (explanation != null) q.setExplanation(explanation);

        return q;
    }

    private String req(Map<String, String> r, String key, String ctx) throws Exception {
        String v = r.getOrDefault(key, "").trim();
        if (v.isEmpty()) throw new Exception(ctx + ": '" + key + "' is required");
        return v;
    }

    private String reqJson(Map<String, Object> r, String key, String ctx) throws Exception {
        Object v = r.get(key);
        if (v == null || v.toString().isBlank()) throw new Exception(ctx + ": '" + key + "' is required");
        return v.toString().trim();
    }

    private String str(Map<String, Object> r, String key) {
        Object v = r.get(key);
        return v != null ? v.toString().trim() : null;
    }

    /**
     * GET /api/admin/questions/coverage — Pool size per book per difficulty
     */
    @GetMapping("/coverage")
    public ResponseEntity<?> getCoverage() {
        List<String> books = questionRepository.findDistinctActiveBooks();

        List<Map<String, Object>> bookStats = books.stream().map(book -> {
            long easy = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.easy);
            long medium = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.medium);
            long hard = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.hard);
            boolean meetsMinimum = easy >= 30 && medium >= 20 && hard >= 10;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("book", book);
            entry.put("easy", easy);
            entry.put("medium", medium);
            entry.put("hard", hard);
            entry.put("total", easy + medium + hard);
            entry.put("meetsMinimum", meetsMinimum);
            entry.put("isActiveInRanked", meetsMinimum);
            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("books", bookStats));
    }

    private Question.Type normalizeType(String raw) {
        return switch (raw.toLowerCase().replace("-", "_")) {
            case "multiple_choice", "multiple_choice_single" -> Question.Type.multiple_choice_single;
            case "multiple_choice_multi" -> Question.Type.multiple_choice_multi;
            case "true_false" -> Question.Type.true_false;
            case "fill_in_blank" -> Question.Type.fill_in_blank;
            default -> throw new IllegalArgumentException("Unknown type: " + raw);
        };
    }

    // ── IMP-4: Vietnamese book name normalization ────────────────────────────
    private static final Map<String, String> VI_BOOK_MAP = new HashMap<>();
    static {
        VI_BOOK_MAP.put("sáng thế ký", "Genesis"); VI_BOOK_MAP.put("sáng thế", "Genesis");
        VI_BOOK_MAP.put("xuất ê-díp-tô ký", "Exodus"); VI_BOOK_MAP.put("xuất hành", "Exodus");
        VI_BOOK_MAP.put("lê-vi ký", "Leviticus"); VI_BOOK_MAP.put("dân số ký", "Numbers");
        VI_BOOK_MAP.put("phục truyền luật lệ ký", "Deuteronomy"); VI_BOOK_MAP.put("phục truyền", "Deuteronomy");
        VI_BOOK_MAP.put("giô-suê", "Joshua"); VI_BOOK_MAP.put("các quan xét", "Judges");
        VI_BOOK_MAP.put("ru-tơ", "Ruth");
        VI_BOOK_MAP.put("1 sa-mu-ên", "1 Samuel"); VI_BOOK_MAP.put("2 sa-mu-ên", "2 Samuel");
        VI_BOOK_MAP.put("1 các vua", "1 Kings"); VI_BOOK_MAP.put("2 các vua", "2 Kings");
        VI_BOOK_MAP.put("1 sử ký", "1 Chronicles"); VI_BOOK_MAP.put("2 sử ký", "2 Chronicles");
        VI_BOOK_MAP.put("e-xơ-ra", "Ezra"); VI_BOOK_MAP.put("nê-hê-mi", "Nehemiah");
        VI_BOOK_MAP.put("ê-xơ-tê", "Esther"); VI_BOOK_MAP.put("gióp", "Job");
        VI_BOOK_MAP.put("thi thiên", "Psalms"); VI_BOOK_MAP.put("châm ngôn", "Proverbs");
        VI_BOOK_MAP.put("truyền đạo", "Ecclesiastes"); VI_BOOK_MAP.put("nhã ca", "Song of Solomon");
        VI_BOOK_MAP.put("ê-sai", "Isaiah"); VI_BOOK_MAP.put("giê-rê-mi", "Jeremiah");
        VI_BOOK_MAP.put("ca thương", "Lamentations"); VI_BOOK_MAP.put("ê-xê-chi-ên", "Ezekiel");
        VI_BOOK_MAP.put("đa-ni-ên", "Daniel"); VI_BOOK_MAP.put("ô-sê", "Hosea");
        VI_BOOK_MAP.put("giô-ên", "Joel"); VI_BOOK_MAP.put("a-mốt", "Amos");
        VI_BOOK_MAP.put("áp-đia", "Obadiah"); VI_BOOK_MAP.put("giô-na", "Jonah");
        VI_BOOK_MAP.put("mi-chê", "Micah"); VI_BOOK_MAP.put("na-hum", "Nahum");
        VI_BOOK_MAP.put("ha-ba-cúc", "Habakkuk"); VI_BOOK_MAP.put("sô-phô-ni", "Zephaniah");
        VI_BOOK_MAP.put("a-ghê", "Haggai"); VI_BOOK_MAP.put("xa-cha-ri", "Zechariah");
        VI_BOOK_MAP.put("ma-la-chi", "Malachi");
        VI_BOOK_MAP.put("ma-thi-ơ", "Matthew"); VI_BOOK_MAP.put("mác", "Mark");
        VI_BOOK_MAP.put("lu-ca", "Luke"); VI_BOOK_MAP.put("giăng", "John");
        VI_BOOK_MAP.put("công vụ", "Acts"); VI_BOOK_MAP.put("công vụ các sứ đồ", "Acts");
        VI_BOOK_MAP.put("rô-ma", "Romans");
        VI_BOOK_MAP.put("1 cô-rinh-tô", "1 Corinthians"); VI_BOOK_MAP.put("2 cô-rinh-tô", "2 Corinthians");
        VI_BOOK_MAP.put("ga-la-ti", "Galatians"); VI_BOOK_MAP.put("ê-phê-sô", "Ephesians");
        VI_BOOK_MAP.put("phi-líp", "Philippians"); VI_BOOK_MAP.put("cô-lô-se", "Colossians");
        VI_BOOK_MAP.put("1 tê-sa-lô-ni-ca", "1 Thessalonians"); VI_BOOK_MAP.put("2 tê-sa-lô-ni-ca", "2 Thessalonians");
        VI_BOOK_MAP.put("1 ti-mô-thê", "1 Timothy"); VI_BOOK_MAP.put("2 ti-mô-thê", "2 Timothy");
        VI_BOOK_MAP.put("tít", "Titus"); VI_BOOK_MAP.put("phi-lê-môn", "Philemon");
        VI_BOOK_MAP.put("hê-bơ-rơ", "Hebrews"); VI_BOOK_MAP.put("gia-cơ", "James");
        VI_BOOK_MAP.put("1 phi-e-rơ", "1 Peter"); VI_BOOK_MAP.put("2 phi-e-rơ", "2 Peter");
        VI_BOOK_MAP.put("1 giăng", "1 John"); VI_BOOK_MAP.put("2 giăng", "2 John");
        VI_BOOK_MAP.put("3 giăng", "3 John"); VI_BOOK_MAP.put("giu-đe", "Jude");
        VI_BOOK_MAP.put("khải huyền", "Revelation"); VI_BOOK_MAP.put("khải thị", "Revelation");
    }

    private String normalizeBookName(String book) {
        if (book == null) return null;
        String lower = book.trim().toLowerCase();
        return VI_BOOK_MAP.getOrDefault(lower, book.trim());
    }
}
