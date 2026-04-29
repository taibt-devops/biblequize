package com.biblequiz.api.dto.basicquiz;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Submission body for POST /api/basic-quiz/submit. Carries one answer per
 * question (10 entries). Server re-resolves each question by id and scores
 * server-side — client-supplied {@code isCorrect} is ignored.
 */
@Data
public class BasicQuizSubmitRequest {

    /** "vi" or "en". Used to assert the submitted set matches the language seed. */
    private String language = "vi";

    @NotNull(message = "answers required")
    @NotEmpty(message = "answers cannot be empty")
    @Size(min = 10, max = 10, message = "exactly 10 answers required")
    private List<Answer> answers;

    @Data
    public static class Answer {
        @NotNull(message = "questionId required")
        private String questionId;

        /**
         * Indices of the options the user selected. For
         * multiple_choice_single this is a single-element list (e.g. [2]).
         * Empty list ⇒ user skipped (counts as wrong).
         */
        private List<Integer> selectedOptions;
    }
}
