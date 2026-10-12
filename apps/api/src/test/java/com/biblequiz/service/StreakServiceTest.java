package com.biblequiz.service;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.user.service.StreakService;
import com.biblequiz.infrastructure.time.GameClock;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class StreakServiceTest {

    /**
     * "Đã dùng băng giá tuần này" chỉ còn hiệu lực khi lần chơi trước cùng tuần (giờ VN) với hôm nay.
     * Thứ Hai/thứ Ba thì "hôm kia" thuộc tuần trước nên băng giá được làm mới (F-api-8) — các test
     * giả định băng giá đã dùng sẽ bỏ qua những ngày đó thay vì đỏ theo thứ trong tuần.
     */
    private static void assumeTwoDaysAgoIsSameWeek() {
        LocalDate twoDaysAgo = LocalDateTime.now(ZoneOffset.UTC).minusDays(2).toLocalDate();
        Assumptions.assumeTrue(GameClock.weekStart(twoDaysAgo).equals(GameClock.weekStart(GameClock.today())),
                "hôm kia thuộc tuần trước — băng giá đã được làm mới");
    }

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private StreakService streakService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test");
        testUser.setEmail("test@example.com");
        testUser.setCurrentStreak(0);
        testUser.setLongestStreak(0);
        testUser.setStreakFreezeUsedThisWeek(false);
        testUser.setLastPlayedAt(null);

        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void recordActivity_firstEver_shouldStartStreakAt1() {
        streakService.recordActivity(testUser);

        assertEquals(1, testUser.getCurrentStreak());
        assertEquals(1, testUser.getLongestStreak());
        assertNotNull(testUser.getLastPlayedAt());
    }

    @Test
    void recordActivity_consecutiveDay_shouldIncrementStreak() {
        testUser.setCurrentStreak(5);
        testUser.setLongestStreak(5);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));

        streakService.recordActivity(testUser);

        assertEquals(6, testUser.getCurrentStreak());
        assertEquals(6, testUser.getLongestStreak());
    }

    @Test
    void recordActivity_sameDay_shouldNotChangeStreak() {
        testUser.setCurrentStreak(3);
        // Use today's UTC date at noon to guarantee same day regardless of timezone
        LocalDate todayUtc = LocalDate.now(ZoneOffset.UTC);
        testUser.setLastPlayedAt(todayUtc.atTime(12, 0));

        streakService.recordActivity(testUser);

        assertEquals(3, testUser.getCurrentStreak());
        verify(userRepository, never()).save(any()); // No save on same day
    }

    @Test
    void recordActivity_missedOneDay_withFreeze_shouldMaintainStreak() {
        testUser.setCurrentStreak(10);
        testUser.setLongestStreak(10);
        testUser.setStreakFreezeUsedThisWeek(false);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));

        streakService.recordActivity(testUser);

        assertEquals(11, testUser.getCurrentStreak());
        assertTrue(testUser.getStreakFreezeUsedThisWeek());
    }

    @Test
    void recordActivity_missedOneDay_freezeAlreadyUsed_shouldResetStreak() {
        assumeTwoDaysAgoIsSameWeek();
        testUser.setCurrentStreak(10);
        testUser.setLongestStreak(10);
        testUser.setStreakFreezeUsedThisWeek(true);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));

        streakService.recordActivity(testUser);

        assertEquals(1, testUser.getCurrentStreak());
        assertEquals(10, testUser.getLongestStreak()); // Longest preserved
    }

    @Test
    void recordActivity_inLaterWeek_shouldLazilyResetStreakFreeze() {
        // F-api-8: the weekly freeze reset had no scheduled caller, so a used
        // freeze never came back ("1 per lifetime"). recordActivity now resets
        // it when the activity lands in a later ISO week than the last play.
        // 8 days back is always a previous ISO week.
        testUser.setStreakFreezeUsedThisWeek(true);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(8));

        streakService.recordActivity(testUser);

        assertFalse(testUser.getStreakFreezeUsedThisWeek(),
                "freeze should be reset once a new week begins");
    }

    @Test
    void recordActivity_missedMultipleDays_shouldResetStreak() {
        testUser.setCurrentStreak(15);
        testUser.setLongestStreak(15);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(5));

        streakService.recordActivity(testUser);

        assertEquals(1, testUser.getCurrentStreak());
        assertEquals(15, testUser.getLongestStreak());
    }

    @Test
    void recordActivity_shouldUpdateLongestStreak() {
        testUser.setCurrentStreak(9);
        testUser.setLongestStreak(7);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));

        streakService.recordActivity(testUser);

        assertEquals(10, testUser.getCurrentStreak());
        assertEquals(10, testUser.getLongestStreak()); // Updated
    }

    // ── getStreakBonusPercent ─────────────────────────────────────────────────

    @Test
    void getStreakBonusPercent_streak0_shouldReturn100() {
        assertEquals(100, streakService.getStreakBonusPercent(0));
    }

    @Test
    void getStreakBonusPercent_streak3_shouldReturn110() {
        assertEquals(110, streakService.getStreakBonusPercent(3));
    }

    @Test
    void getStreakBonusPercent_streak7_shouldReturn115() {
        assertEquals(115, streakService.getStreakBonusPercent(7));
    }

    @Test
    void getStreakBonusPercent_streak30_shouldReturn115() {
        assertEquals(115, streakService.getStreakBonusPercent(30));
    }

    // ── TC-STREAK-001: Multi-day streak simulation ───────────────────────────

    @Order(10)
    @Test
    void TC_STREAK_001_multiDaySimulation_day1Play_day2Play_day3Skip_day4Play() {
        // Day 1: first play → streak 1
        testUser.setLastPlayedAt(null);
        testUser.setCurrentStreak(0);
        streakService.recordActivity(testUser);
        assertEquals(1, testUser.getCurrentStreak());

        // Day 2: consecutive → streak 2
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        testUser.setCurrentStreak(1);
        testUser.setLongestStreak(1);
        streakService.recordActivity(testUser);
        assertEquals(2, testUser.getCurrentStreak());
        assertEquals(2, testUser.getLongestStreak());

        // Day 3: skip (no play) — simulated by advancing 2 days with freeze already used
        // Day 4: play after 2-day gap (freeze used) → streak resets to 1
        assumeTwoDaysAgoIsSameWeek();
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));
        testUser.setCurrentStreak(2);
        testUser.setLongestStreak(2);
        testUser.setStreakFreezeUsedThisWeek(true); // freeze already used
        streakService.recordActivity(testUser);
        assertEquals(1, testUser.getCurrentStreak());
        assertEquals(2, testUser.getLongestStreak()); // Longest preserved
    }

    // ── TC-STREAK-003: 2-day gap with freeze available → streak preserved ────

    @Order(11)
    @Test
    void TC_STREAK_003_streakFreeze_2dayGapWithFreezeAvailable_shouldPreserveStreak() {
        testUser.setCurrentStreak(5);
        testUser.setLongestStreak(5);
        testUser.setStreakFreezeUsedThisWeek(false);
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));

        streakService.recordActivity(testUser);

        assertEquals(6, testUser.getCurrentStreak()); // Streak preserved + incremented
        assertTrue(testUser.getStreakFreezeUsedThisWeek()); // Freeze consumed
    }

    // ── TC-STREAK-004: Freeze not available → streak resets ──────────────────

    @Order(12)
    @Test
    void TC_STREAK_004_streakFreeze_notAvailable_shouldResetStreak() {
        assumeTwoDaysAgoIsSameWeek();
        testUser.setCurrentStreak(5);
        testUser.setLongestStreak(5);
        testUser.setStreakFreezeUsedThisWeek(true); // Already used this week
        testUser.setLastPlayedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(2));

        streakService.recordActivity(testUser);

        assertEquals(1, testUser.getCurrentStreak()); // Reset
        assertEquals(5, testUser.getLongestStreak()); // Longest preserved
    }
}
