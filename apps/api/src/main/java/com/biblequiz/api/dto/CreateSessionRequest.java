package com.biblequiz.api.dto;

import com.biblequiz.modules.quiz.entity.Book;
import com.biblequiz.modules.quiz.entity.Question;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class CreateSessionRequest {

    @NotNull(message = "Mode is required")
    private String mode;

    @Min(value = 1, message = "Question count must be at least 1")
    @Max(value = 50, message = "Question count cannot exceed 50")
    private Integer questionCount = 10;

    @Size(max = 100, message = "Book name cannot exceed 100 characters")
    private String book;

    @Pattern(regexp = "^(easy|medium|hard|all)$", message = "Difficulty must be easy, medium, hard, or all")
    private String difficulty = "all";

    @Min(value = 5, message = "Time per question must be at least 5 seconds")
    @Max(value = 300, message = "Time per question cannot exceed 300 seconds")
    private Integer timePerQuestion = 30;

    @Min(value = 1, message = "chapterFrom must be >= 1")
    private Integer chapterFrom;

    @Min(value = 1, message = "chapterTo must be >= 1")
    private Integer chapterTo;

    @Min(value = 1, message = "verseFrom must be >= 1")
    private Integer verseFrom;

    @Min(value = 1, message = "verseTo must be >= 1")
    private Integer verseTo;

    private List<String> excludeQuestionIds;

    private Boolean shuffleQuestions = true;

    private Boolean showExplanation = true;

    @Pattern(regexp = "^(vi|en)$", message = "Language must be vi or en")
    private String language = "vi";

    // Practice "Theo câu chuyện": play every question of this story (an id from
    // /api/public/stories). Overrides book, difficulty and the chapter/verse range.
    @Size(max = 64, message = "Story id cannot exceed 64 characters")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Invalid story id")
    private String story;
}
