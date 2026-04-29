package com.biblequiz.api.dto.basicquiz;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Snapshot of the user's Bible Basics catechism quiz state.
 * Drives the 4-state HomePage card (first-time / retry / cooldown / passed).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BasicQuizStatusResponse {

    /** Whether the user has already passed (≥8/10). Permanent unlock once true. */
    private boolean passed;

    /** When the user first passed (null until passed). */
    private LocalDateTime passedAt;

    /** Total number of attempts (regardless of pass/fail). */
    private int attemptCount;

    /**
     * Seconds until the user can retry. 0 when the user is not in cooldown
     * (either has never attempted, or 60s+ has elapsed since the last fail,
     * or has already passed).
     */
    private int cooldownRemainingSeconds;

    /** Always 10 (constant). Sent so FE doesn't hardcode. */
    private int totalQuestions;

    /** Always 8 (constant). Sent so FE can render "X/Y to pass". */
    private int threshold;
}
