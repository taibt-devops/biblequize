package com.biblequiz.modules.ranked.service;

import com.biblequiz.modules.quiz.entity.Question;
import org.springframework.stereotype.Service;

/**
 * SPEC-v2 scoring engine.
 *
 * Base points: Easy 8, Medium 12, Hard 18
 * Speed bonus (quadratic): floor(basePoints * 0.5 * speedRatio²)
 *   where speedRatio = (timeLimitMs - elapsedMs) / timeLimitMs
 * Combo multiplier: 5-streak → x1.2, 10-streak → x1.5
 * Daily first-question bonus: x2
 */
@Service
public class ScoringService {

    private static final int TIME_LIMIT_MS = 30_000;
    private final TierRewardsConfig tierRewardsConfig;

    public ScoringService(TierRewardsConfig tierRewardsConfig) {
        this.tierRewardsConfig = tierRewardsConfig;
    }

    public static class ScoreResult {
        public final int earned;
        public final int baseScore;
        public final int speedBonus;
        public final int comboMultiplierPercent; // 100 = x1.0, 120 = x1.2, 150 = x1.5
        public final boolean isDailyFirst;

        public ScoreResult(int earned, int baseScore, int speedBonus, int comboMultiplierPercent, boolean isDailyFirst) {
            this.earned = earned;
            this.baseScore = baseScore;
            this.speedBonus = speedBonus;
            this.comboMultiplierPercent = comboMultiplierPercent;
            this.isDailyFirst = isDailyFirst;
        }
    }

    /**
     * Calculates score for a correct answer per SPEC-v2.
     *
     * @param difficulty       question difficulty (null defaults to easy)
     * @param clientElapsedMs  time the user spent answering in milliseconds
     * @param currentStreak    streak of consecutive correct answers in this session
     * @param isDailyFirst     true if this is the user's first ranked answer today
     */
    public ScoreResult calculate(Question.Difficulty difficulty, int clientElapsedMs,
                                  int currentStreak, boolean isDailyFirst) {
        int baseScore = getBaseScore(difficulty);

        // Quadratic speed bonus: floor(basePoints * 0.5 * speedRatio²)
        double speedRatio = Math.max(0.0, (double) (TIME_LIMIT_MS - clientElapsedMs) / TIME_LIMIT_MS);
        int speedBonus = (int) Math.floor(baseScore * 0.5 * speedRatio * speedRatio);

        int subtotal = baseScore + speedBonus;

        // Combo multiplier
        int comboPercent = 100;
        if (currentStreak >= 10) {
            comboPercent = 150;
        } else if (currentStreak >= 5) {
            comboPercent = 120;
        }
        subtotal = subtotal * comboPercent / 100;

        // Daily first-question bonus
        if (isDailyFirst) {
            subtotal = subtotal * 2;
        }

        return new ScoreResult(subtotal, baseScore, speedBonus, comboPercent, isDailyFirst);
    }

    /**
     * Backwards-compatible overload (no daily-first flag).
     */
    public ScoreResult calculate(Question.Difficulty difficulty, int clientElapsedMs, int currentStreak) {
        return calculate(difficulty, clientElapsedMs, currentStreak, false);
    }

    /**
     * Calculate with tier XP multiplier applied.
     */
    public ScoreResult calculateWithTier(Question.Difficulty difficulty, int clientElapsedMs,
                                          int currentStreak, boolean isDailyFirst, int tierLevel) {
        return calculateWithTier(difficulty, clientElapsedMs, currentStreak, isDailyFirst, tierLevel, false);
    }

    /**
     * Calculate with tier XP multiplier + optional XP surge (1.5x from milestone burst).
     *
     * <p>TODO: Wire {@code xpSurgeActive} parameter — currently always false from all
     * callers. {@code RankedController.submitRankedAnswer} calls
     * {@link #calculate(Question.Difficulty, int, int, boolean)} (no tier/surge variant),
     * so this overload is dead code. To wire: caller should pass
     * {@code xpSurgeActive = user.getXpSurgeUntil() != null && user.getXpSurgeUntil().isAfter(LocalDateTime.now())}.
     * See {@link com.biblequiz.modules.user.entity.User#xpSurgeUntil} TODO for context.
     * Audit 2026-05-01 confirmed no production caller invokes this overload.
     */
    public ScoreResult calculateWithTier(Question.Difficulty difficulty, int clientElapsedMs,
                                          int currentStreak, boolean isDailyFirst, int tierLevel,
                                          boolean xpSurgeActive) {
        ScoreResult base = calculate(difficulty, clientElapsedMs, currentStreak, isDailyFirst);
        double multiplier = tierRewardsConfig.getRewards(tierLevel).xpMultiplier();
        if (xpSurgeActive) {
            multiplier *= 1.5;
        }
        int boosted = (int) Math.round(base.earned * multiplier);
        return new ScoreResult(boosted, base.baseScore, base.speedBonus,
                base.comboMultiplierPercent, base.isDailyFirst);
    }

    private int getBaseScore(Question.Difficulty difficulty) {
        if (difficulty == null) return 8;
        return switch (difficulty) {
            case easy -> 8;
            case medium -> 12;
            case hard -> 18;
        };
    }

    /**
     * Server-side answer validation for multiple choice single.
     */
    public boolean validateMultipleChoiceSingle(Question question, Object answerObj) {
        if (question == null || question.getCorrectAnswer() == null || question.getCorrectAnswer().isEmpty()) {
            return false;
        }
        int clientAnswer = -1;
        try {
            clientAnswer = Integer.parseInt(answerObj.toString());
        } catch (Exception ignore) {}
        return clientAnswer == question.getCorrectAnswer().get(0);
    }

    /**
     * Server-side answer validation for fill in blank.
     */
    public boolean validateFillInBlank(Question question, Object answerObj) {
        if (question == null) return false;
        String expected = question.getCorrectAnswerText();
        String provided = answerObj != null ? answerObj.toString().trim().toLowerCase() : "";
        return expected != null && provided.equals(expected.trim().toLowerCase());
    }
}
