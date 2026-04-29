package com.biblequiz.modules.quiz.exception;

import com.biblequiz.infrastructure.exception.BusinessLogicException;

/**
 * Thrown when a user tries to retake the Bible Basics catechism quiz
 * before the 60-second cooldown after a failed attempt expires. Carries
 * the remaining seconds so the FE can render a precise countdown without
 * having to round-trip a separate /status call.
 *
 * <p>Mapped by GlobalExceptionHandler to a 400 with a body shaped like:
 * <pre>{@code
 * {
 *   "status": 400,
 *   "error": "Bible Basics Cooldown",
 *   "message": "Cooldown active. Try again in 42 seconds.",
 *   "secondsRemaining": 42,
 *   "path": "/api/basic-quiz/submit"
 * }
 * }</pre>
 */
public class BasicQuizCooldownException extends BusinessLogicException {

    private final int secondsRemaining;

    public BasicQuizCooldownException(int secondsRemaining) {
        super("Bible Basics quiz cooldown active. Try again in " + secondsRemaining + " seconds.");
        this.secondsRemaining = secondsRemaining;
    }

    public int getSecondsRemaining() {
        return secondsRemaining;
    }
}
