package com.biblequiz.modules.memorize.service;

import com.biblequiz.modules.memorize.entity.UserMemoryVerse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class MemoryScheduleTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 15, 20, 0);

    private static UserMemoryVerse atLevel(int level) {
        UserMemoryVerse v = new UserMemoryVerse("id", null, "BTTHD2011", "John", 3, 16, 16, NOW.minusDays(3));
        v.setMasteryLevel(level);
        return v;
    }

    @ParameterizedTest(name = "pass at L{0} → L{1}, +{2}d")
    @CsvSource({"0,1,1", "1,2,2", "2,3,4", "3,4,7", "4,5,14", "5,5,30"})
    void pass_advancesLevelAndSchedulesBySpecTable(int level, int expectedLevel, int days) {
        UserMemoryVerse v = atLevel(level);
        MemorySchedule.applyReview(v, true, NOW);
        assertEquals(expectedLevel, v.getMasteryLevel());
        assertEquals(NOW.plusDays(days), v.getNextReviewAt());
        assertEquals(0, v.getLapseCount());
    }

    @ParameterizedTest(name = "fail at L{0} → L{1}")
    @CsvSource({"5,4", "3,2", "2,1"})
    void fail_dropsOneLevelAndRetriesTomorrow(int level, int expectedLevel) {
        UserMemoryVerse v = atLevel(level);
        MemorySchedule.applyReview(v, false, NOW);
        assertEquals(expectedLevel, v.getMasteryLevel());
        assertEquals(NOW.plusDays(1), v.getNextReviewAt());
        assertEquals(1, v.getLapseCount());
    }

    @ParameterizedTest(name = "fail at L{0} → L0, +10min")
    @CsvSource({"0", "1"})
    void fail_reachingLevelZero_relearnsInTenMinutes(int level) {
        UserMemoryVerse v = atLevel(level);
        MemorySchedule.applyReview(v, false, NOW);
        assertEquals(0, v.getMasteryLevel());
        assertEquals(NOW.plusMinutes(10), v.getNextReviewAt());
    }

    @Test
    void everyReview_countsAndStampsLastReviewed() {
        UserMemoryVerse v = atLevel(2);
        MemorySchedule.applyReview(v, true, NOW);
        MemorySchedule.applyReview(v, false, NOW.plusDays(4));
        assertEquals(2, v.getReviewCount());
        assertEquals(NOW.plusDays(4), v.getLastReviewedAt());
    }

    @Test
    void outOfRangeStoredLevel_isClampedBeforeApplying() {
        UserMemoryVerse v = atLevel(9);
        MemorySchedule.applyReview(v, true, NOW);
        assertEquals(5, v.getMasteryLevel());
        assertEquals(NOW.plusDays(30), v.getNextReviewAt());
    }
}
