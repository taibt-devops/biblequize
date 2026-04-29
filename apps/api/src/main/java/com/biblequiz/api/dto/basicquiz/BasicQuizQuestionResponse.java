package com.biblequiz.api.dto.basicquiz;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One catechism question as exposed to the FE quiz player. Excludes the
 * correct answer + explanation; those are returned by /submit (and only
 * for fail review).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BasicQuizQuestionResponse {

    private String id;

    /** Question stem text. */
    private String content;

    /** 4 options (multiple_choice_single). */
    private List<String> options;
}
