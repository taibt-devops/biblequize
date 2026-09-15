package com.biblequiz.modules.memorize.service;

import com.biblequiz.modules.memorize.entity.UserMemoryVerse;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Lịch ôn giãn cách của Học Thuộc (SPEC_USER §5.1.1) — hàm thuần, không I/O.
 *
 * <p>Đạt ở level L → ôn lại sau {@link #PASS_INTERVAL_DAYS}[L] ngày rồi lên L+1 (tối đa 5).
 * Chưa đạt → xuống 1 level (tối thiểu 0); về 0 thì ôn lại sau 10 phút để còn kịp
 * luyện trong buổi, ngược lại sau 1 ngày.
 */
public final class MemorySchedule {

    static final int[] PASS_INTERVAL_DAYS = {1, 2, 4, 7, 14, 30};
    static final Duration RELEARN_DELAY = Duration.ofMinutes(10);
    static final Duration LAPSE_DELAY = Duration.ofDays(1);

    private MemorySchedule() {}

    public static void applyReview(UserMemoryVerse verse, boolean passed, LocalDateTime now) {
        int level = clamp(verse.getMasteryLevel());
        if (passed) {
            verse.setNextReviewAt(now.plusDays(PASS_INTERVAL_DAYS[level]));
            verse.setMasteryLevel(Math.min(level + 1, UserMemoryVerse.MAX_LEVEL));
        } else {
            int newLevel = Math.max(level - 1, 0);
            verse.setMasteryLevel(newLevel);
            verse.setNextReviewAt(now.plus(newLevel == 0 ? RELEARN_DELAY : LAPSE_DELAY));
            verse.setLapseCount(verse.getLapseCount() + 1);
        }
        verse.setReviewCount(verse.getReviewCount() + 1);
        verse.setLastReviewedAt(now);
    }

    private static int clamp(int level) {
        return Math.max(0, Math.min(level, UserMemoryVerse.MAX_LEVEL));
    }
}
