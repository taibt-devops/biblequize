package com.biblequiz.modules.userquiz.service;

import java.util.List;

/**
 * Provider-agnostic interface for AI question generation.
 * Swap the implementation bean to switch LLM providers (Gemini → Claude → OpenAI, etc.)
 */
public interface QuizGeneratorPort {

    /**
     * Generate multiple-choice questions from the given parameters.
     * Returns a list of generated questions; never null (may be empty on failure).
     */
    List<GeneratedQuestionDTO> generate(QuizGenerationParams params) throws Exception;

    /** Human-readable provider name for logging / UI display. */
    String providerName();

    // ── Nested param / result types ───────────────────────────────────────────

    record QuizGenerationParams(
        String book,          // null = random
        Integer chapterStart, // null = whole book
        Integer chapterEnd,
        Integer verseStart,
        Integer verseEnd,
        String theme,         // optional freetext topic hint
        String difficulty,    // easy | medium | hard | mixed
        String language,      // vi | en
        int count             // 1-20
    ) {}

    record GeneratedQuestionDTO(
        String content,
        List<String> options,
        int correctAnswer,
        String difficulty,
        String explanation,
        String book,
        Integer chapter,
        Integer verseStart,
        Integer verseEnd
    ) {}
}
