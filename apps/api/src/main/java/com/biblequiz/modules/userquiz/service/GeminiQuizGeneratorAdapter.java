package com.biblequiz.modules.userquiz.service;

import com.biblequiz.modules.adminai.AIGenerationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Gemini-backed implementation of QuizGeneratorPort.
 * Delegates to the existing AIGenerationService to avoid duplicating HTTP / prompt logic.
 *
 * To add a new provider (e.g. Claude):
 *   1. Create ClaudeQuizGeneratorAdapter implements QuizGeneratorPort
 *   2. Set app.quiz-generator.provider=claude in application.yml
 *   3. The @ConditionalOnProperty on each adapter picks the right bean automatically.
 */
@Service
@ConditionalOnProperty(name = "app.quiz-generator.provider", havingValue = "gemini", matchIfMissing = true)
public class GeminiQuizGeneratorAdapter implements QuizGeneratorPort {

    private static final Logger log = LoggerFactory.getLogger(GeminiQuizGeneratorAdapter.class);

    @Autowired
    private AIGenerationService aiGenerationService;

    @Override
    public String providerName() {
        return "Gemini (" + aiGenerationService.getModel() + ")";
    }

    @Override
    public List<GeneratedQuestionDTO> generate(QuizGenerationParams p) throws Exception {
        if (!aiGenerationService.isConfigured()) {
            throw new IllegalStateException("Gemini API key chưa được cấu hình (gemini.api-key)");
        }

        String book       = p.book()         != null ? p.book()         : "random";
        int chapterStart  = p.chapterStart()  != null ? p.chapterStart() : 1;
        int chapterEnd    = p.chapterEnd()    != null ? p.chapterEnd()   : chapterStart;
        int verseStart    = p.verseStart()    != null ? p.verseStart()   : 1;
        int verseEnd      = p.verseEnd()      != null ? p.verseEnd()     : verseStart;
        String difficulty = normalizeDifficulty(p.difficulty());
        String language   = p.language()      != null ? p.language()     : "vi";
        int count         = Math.max(1, Math.min(p.count(), 20));

        // Pass theme as a custom prompt prefix if provided
        String customPrompt = (p.theme() != null && !p.theme().isBlank())
                ? "Hướng câu hỏi vào chủ đề: " + p.theme().trim()
                : null;

        log.info("[QuizGenerator][Gemini] book={} ch={}-{} v={}-{} difficulty={} count={} theme={}",
                book, chapterStart, chapterEnd, verseStart, verseEnd, difficulty, count, p.theme());

        List<Map<String, Object>> raw = aiGenerationService.generate(
                book, chapterStart, verseStart, verseEnd,
                difficulty, "multiple_choice_single", language,
                count, null, customPrompt);

        return mapToDTO(raw, book, chapterStart);
    }

    @SuppressWarnings("unchecked")
    private List<GeneratedQuestionDTO> mapToDTO(List<Map<String, Object>> raw,
                                                 String book, int chapter) {
        List<GeneratedQuestionDTO> result = new ArrayList<>();
        for (Map<String, Object> q : raw) {
            try {
                String content      = (String) q.get("content");
                List<String> opts   = (List<String>) q.get("options");
                int correct         = ((Number) q.getOrDefault("correctAnswer", 0)).intValue();
                String diff         = (String) q.getOrDefault("difficulty", "medium");
                String explanation  = (String) q.getOrDefault("explanation", "");
                String qBook        = (String) q.getOrDefault("book", book);
                int qChapter        = ((Number) q.getOrDefault("chapter", chapter)).intValue();
                Integer vStart      = q.get("verseStart") instanceof Number n ? n.intValue() : null;
                Integer vEnd        = q.get("verseEnd")   instanceof Number n ? n.intValue() : null;

                if (content != null && opts != null && opts.size() == 4) {
                    result.add(new GeneratedQuestionDTO(
                            content, opts, correct, diff, explanation, qBook, qChapter, vStart, vEnd));
                }
            } catch (Exception e) {
                log.warn("[QuizGenerator] Skipping malformed question: {}", e.getMessage());
            }
        }
        return result;
    }

    private String normalizeDifficulty(String d) {
        if (d == null) return "medium";
        return switch (d.toUpperCase()) {
            case "EASY"   -> "easy";
            case "HARD"   -> "hard";
            case "MEDIUM" -> "medium";
            default       -> "medium";
        };
    }
}
