package com.biblequiz.modules.user.service;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/**
 * SPEC-v2 Streak System.
 *
 * Streak rules:
 * - Play at least 1 ranked question/day to maintain streak
 * - Miss 1 day → streak resets (unless streak freeze used)
 * - Streak freeze: 1 per week, auto-used when streak would break
 *
 * Streak bonuses:
 * - 3 days: +10% points
 * - 7 days: +15% points + badge "Chuyên cần"
 * - 30 days: badge "Trung tín"
 * - 100 days: badge "Kiên nhẫn như Gióp"
 */
@Service
public class StreakService {

    private static final Logger log = LoggerFactory.getLogger(StreakService.class);

    @Autowired
    private UserRepository userRepository;

    /**
     * Called when user completes a Daily Challenge or a ranked answer.
     * Same-day calls are idempotent (early return when lastPlayedAt is today).
     */
    public void recordActivity(User user) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDateTime lastPlayed = user.getLastPlayedAt();

        if (lastPlayed != null) {
            LocalDate lastPlayedDate = lastPlayed.toLocalDate();

            if (lastPlayedDate.equals(today)) {
                // Already played today, no streak change
                return;
            }

            long daysSinceLastPlay = ChronoUnit.DAYS.between(lastPlayedDate, today);

            if (daysSinceLastPlay == 1) {
                // Consecutive day — increment streak
                user.setCurrentStreak(user.getCurrentStreak() + 1);
            } else if (daysSinceLastPlay == 2 && !user.getStreakFreezeUsedThisWeek()) {
                // Missed 1 day, use streak freeze
                user.setStreakFreezeUsedThisWeek(true);
                user.setCurrentStreak(user.getCurrentStreak() + 1);
                log.info("Streak freeze auto-used for user {}", user.getEmail());
            } else {
                // Streak broken
                user.setCurrentStreak(1);
            }
        } else {
            // First time playing
            user.setCurrentStreak(1);
        }

        // Update longest streak
        if (user.getCurrentStreak() > user.getLongestStreak()) {
            user.setLongestStreak(user.getCurrentStreak());
        }

        user.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);
    }

    /**
     * Returns the streak-based score multiplier (100 = x1.0, 110 = x1.1, etc).
     */
    public int getStreakBonusPercent(int streakDays) {
        if (streakDays >= 7) return 115;  // +15%
        if (streakDays >= 3) return 110;  // +10%
        return 100;                        // no bonus
    }

    /**
     * Reset weekly streak freeze (should be called by scheduler every Monday).
     */
    public void resetWeeklyStreakFreeze(User user) {
        user.setStreakFreezeUsedThisWeek(false);
        userRepository.save(user);
    }
}
