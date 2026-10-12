package com.biblequiz.service;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.modules.daily.entity.DailyCompletion;
import com.biblequiz.modules.daily.repository.DailyCompletionRepository;
import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.user.service.StreakService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DailyChallengeServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CacheService cacheService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserDailyProgressRepository userDailyProgressRepository;

    @Mock
    private StreakService streakService;

    @Mock
    private DailyCompletionRepository dailyCompletionRepository;

    @InjectMocks
    private DailyChallengeService dailyChallengeService;

    private Question makeQuestion(String id) {
        Question q = new Question();
        q.setId(id);
        q.setContent("Question " + id);
        return q;
    }

    @BeforeEach
    void setUp() {
        // Default: no cache hit
        lenient().when(cacheService.get(anyString(), eq(List.class))).thenReturn(Optional.empty());
        lenient().when(cacheService.exists(anyString())).thenReturn(false);
        // Default: no prior daily completion row — markCompleted will insert.
        lenient().when(dailyCompletionRepository.findByUserIdAndCompletionDate(anyString(), any(LocalDate.class)))
                .thenReturn(Optional.empty());
    }

    // ── Review PCV-2: endpoint chấm chỉ nhận câu của Thử thách ngày ──────────
    // (không thành chỗ tra đáp án cho câu đang chạy ở Phòng chơi — QUESTION_START mang id câu)

    private void dailyPool() {
        when(questionRepository.countByLanguageAndIsActiveTrue("vi")).thenReturn(20L);
        when(questionRepository.findByLanguageAndIsActiveTrue(eq("vi"), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(List.of(makeQuestion("q-" + ((Pageable) inv.getArgument(1)).getPageNumber()))));
    }

    @Test
    void checkAnswer_questionOutsideTheDailySet_isRefused() {
        dailyPool();
        Question roomQuestion = makeQuestion("room-q");
        roomQuestion.setLanguage("vi");
        roomQuestion.setCorrectAnswer(List.of(2));
        when(questionRepository.findById("room-q")).thenReturn(Optional.of(roomQuestion));

        assertThrows(IllegalArgumentException.class, () -> dailyChallengeService.checkAnswer("room-q", 1, null));
    }

    @Test
    void checkAnswer_questionFromTodaysSet_isChecked() {
        dailyPool();
        String todayId = dailyChallengeService.getTodayQuestions("vi").get(0).getId();
        Question q = makeQuestion(todayId);
        q.setLanguage("vi");
        q.setCorrectAnswer(List.of(1));
        when(questionRepository.findById(todayId)).thenReturn(Optional.of(q));

        assertEquals(true, dailyChallengeService.checkAnswer(todayId, 1, null).get("isCorrect"));
    }

    // ── TC-DAILY-001: getTodayQuestions returns 5 questions ──────────────────

    @Order(1)
    @Test
    void TC_DAILY_001_getDailyQuestions_shouldReturn5Questions() {
        // 20 active questions available
        when(questionRepository.countByLanguageAndIsActiveTrue("vi")).thenReturn(20L);
        when(questionRepository.findByLanguageAndIsActiveTrue(eq("vi"), any(Pageable.class)))
                .thenAnswer(inv -> {
                    int pageNumber = ((Pageable) inv.getArgument(1)).getPageNumber();
                    Question q = makeQuestion("q-" + pageNumber);
                    return new PageImpl<>(List.of(q));
                });

        LocalDate date = LocalDate.of(2025, 1, 15);
        List<Question> questions = dailyChallengeService.getDailyQuestions(date);

        assertEquals(5, questions.size());
    }

    // ── TC-DAILY-004: hasCompletedToday returns true after markCompleted ─────

    @Order(2)
    @Test
    void TC_DAILY_004_hasCompletedToday_shouldReturnTrueAfterMarkCompleted() {
        String userId = "user-123";
        User user = new User();
        user.setId(userId);

        // Before marking: not completed
        when(cacheService.exists(anyString())).thenReturn(false);
        assertFalse(dailyChallengeService.hasCompletedToday(userId));

        // markCompleted now also credits XP — stub the lookup path.
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        // Mark completed
        dailyChallengeService.markCompleted(userId, 100, 4);
        verify(cacheService).put(argThat(key -> key.contains("completed:" + userId)), any(), any());

        // After marking: simulate cache returning true
        when(cacheService.exists(argThat(key -> key.contains("completed:" + userId)))).thenReturn(true);
        assertTrue(dailyChallengeService.hasCompletedToday(userId));
    }

    // ── Daily XP: 4/5 correct credits 100 XP on fresh UDP (server-computed) ──

    @Order(5)
    @Test
    void markCompleted_shouldCreditXpByCorrectCountOnFreshUdp() {
        String userId = "user-xp-1";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        // Client sends a bogus score (9999) — server must IGNORE it and credit
        // the curve value for 4 correct (= 100), proving server-side recompute.
        dailyChallengeService.markCompleted(userId, 9999, 4);

        ArgumentCaptor<UserDailyProgress> saved = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(userDailyProgressRepository).save(saved.capture());
        assertEquals(100, saved.getValue().getPointsCounted(),
                "4/5 correct must credit 100 XP regardless of client-supplied score");
    }

    // ── Daily XP: 5/5 perfect stacks 150 XP on top of prior points ───────────

    @Order(6)
    @Test
    void markCompleted_shouldStackPerfectXpOnExistingDailyProgress() {
        String userId = "user-xp-2";
        User user = new User();
        user.setId(userId);

        UserDailyProgress existing = new UserDailyProgress();
        existing.setId("udp-existing");
        existing.setPointsCounted(120); // user already earned 120 XP today (e.g., Ranked)
        existing.setQuestionsCounted(8);
        existing.setLivesRemaining(95);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.of(existing));

        dailyChallengeService.markCompleted(userId, 100, 5);

        assertEquals(270, existing.getPointsCounted(), "Perfect 5/5 (+150 XP) stacks on top of existing XP");
        // questionsCounted / livesRemaining unchanged — Daily only touches XP.
        assertEquals(8, existing.getQuestionsCounted());
        assertEquals(95, existing.getLivesRemaining());
        verify(userDailyProgressRepository).save(existing);
    }

    // ── Daily XP curve: dailyXp lookup matches DECISIONS.md 2026-06-16 ───────

    @Order(16)
    @Test
    void dailyXp_shouldFollowCurve_0_20_40_60_100_150() {
        assertEquals(0, dailyChallengeService.dailyXp(0));
        assertEquals(20, dailyChallengeService.dailyXp(1));
        assertEquals(40, dailyChallengeService.dailyXp(2));
        assertEquals(60, dailyChallengeService.dailyXp(3));
        assertEquals(100, dailyChallengeService.dailyXp(4));
        assertEquals(150, dailyChallengeService.dailyXp(5));
        // Out-of-range clamps (defensive — DTO already bounds [0,5]).
        assertEquals(0, dailyChallengeService.dailyXp(-3));
        assertEquals(150, dailyChallengeService.dailyXp(99));
    }

    // ── Daily XP: 0 correct credits no XP (no UDP write) ─────────────────────

    @Order(17)
    @Test
    void markCompleted_shouldNotCreditXpWhenZeroCorrect() {
        String userId = "user-xp-zero";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        dailyChallengeService.markCompleted(userId, 0, 0);

        // 0 correct → xp 0 → creditCompletionXp never runs, so no UDP save.
        verify(userDailyProgressRepository, never()).save(any());
        // Completion is still recorded (cache + history) and streak still ticks.
        verify(cacheService).put(anyString(), any(), any());
        verify(streakService).recordActivity(user);
    }

    // ── Daily XP: unknown user falls through without throwing ────────────────

    @Order(7)
    @Test
    void markCompleted_shouldNotCrashWhenUserMissing() {
        String userId = "user-missing";
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(userId)).thenReturn(Optional.empty());

        // Cache write still happens; UDP write + streak update are skipped.
        dailyChallengeService.markCompleted(userId, 0, 0);

        verify(cacheService).put(anyString(), any(), any());
        verify(userDailyProgressRepository, never()).save(any());
        verify(streakService, never()).recordActivity(any());
    }

    // ── Daily streak: markCompleted calls StreakService.recordActivity ───────

    @Order(8)
    @Test
    void markCompleted_shouldCallRecordActivityOnce() {
        String userId = "user-streak-1";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        dailyChallengeService.markCompleted(userId, 100, 5);

        verify(streakService, times(1)).recordActivity(user);
    }

    // ── Daily streak: graceful degradation if recordActivity throws ──────────

    @Order(9)
    @Test
    void markCompleted_shouldStillCreditXpIfStreakUpdateFails() {
        String userId = "user-streak-fail";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        doThrow(new RuntimeException("simulated streak failure"))
                .when(streakService).recordActivity(user);

        // Must not propagate — cache + XP already done.
        dailyChallengeService.markCompleted(userId, 100, 5);

        verify(cacheService).put(anyString(), any(), any());
        verify(userDailyProgressRepository).save(any(UserDailyProgress.class));
        verify(streakService).recordActivity(user);
    }

    // ── Daily streak: lookup by email also triggers recordActivity ───────────

    @Order(10)
    @Test
    void markCompleted_shouldResolveUserByEmailWhenIdLookupMisses() {
        String email = "alice@example.com";
        User user = new User();
        user.setId("user-uuid-alice");
        user.setEmail(email);

        when(userRepository.findById(email)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq("user-uuid-alice"), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        dailyChallengeService.markCompleted(email, 100, 5);

        verify(streakService, times(1)).recordActivity(user);
        verify(userDailyProgressRepository).save(any(UserDailyProgress.class));
    }

    // ── TC-DAILY-005: Different dates produce different question selections ──

    @Order(3)
    @Test
    void TC_DAILY_005_getDailyQuestions_differentDates_shouldProduceDifferentResults() {
        when(questionRepository.countByLanguageAndIsActiveTrue("vi")).thenReturn(100L);
        when(questionRepository.findByLanguageAndIsActiveTrue(eq("vi"), any(Pageable.class)))
                .thenAnswer(inv -> {
                    int pageNumber = ((Pageable) inv.getArgument(1)).getPageNumber();
                    Question q = makeQuestion("q-" + pageNumber);
                    return new PageImpl<>(List.of(q));
                });

        LocalDate date1 = LocalDate.of(2025, 6, 1);
        LocalDate date2 = LocalDate.of(2025, 6, 2);

        List<Question> questions1 = dailyChallengeService.getDailyQuestions(date1);
        List<Question> questions2 = dailyChallengeService.getDailyQuestions(date2);

        // Both return 5 questions
        assertEquals(5, questions1.size());
        assertEquals(5, questions2.size());

        // Extract IDs and verify they differ (date-based seed produces different indices)
        List<String> ids1 = questions1.stream().map(Question::getId).toList();
        List<String> ids2 = questions2.stream().map(Question::getId).toList();
        assertNotEquals(ids1, ids2, "Different dates should produce different question selections");
    }

    // ── getDailyQuestionCount returns 5 ──────────────────────────────────────

    @Order(4)
    @Test
    void getDailyQuestionCount_shouldReturn5() {
        assertEquals(5, dailyChallengeService.getDailyQuestionCount());
    }

    // ── DC-3: persist completion to daily_completions on markCompleted ───────

    @Order(11)
    @Test
    void markCompleted_shouldPersistDailyCompletionRow() {
        String userId = "user-persist-1";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        dailyChallengeService.markCompleted(userId, 100, 5);

        ArgumentCaptor<DailyCompletion> saved = ArgumentCaptor.forClass(DailyCompletion.class);
        verify(dailyCompletionRepository).save(saved.capture());
        assertEquals(userId, saved.getValue().getUser().getId());
        assertEquals(5, saved.getValue().getCorrectCount());
        // score is unified to XP earned (5/5 = 150), not the client-sent value.
        assertEquals(150, saved.getValue().getScore());
    }

    // ── DC-3: idempotent — second call same day skips insert ────────────────

    @Order(12)
    @Test
    void markCompleted_shouldSkipInsertWhenAlreadyPersistedToday() {
        String userId = "user-persist-idempotent";
        User user = new User();
        user.setId(userId);

        DailyCompletion existing = new DailyCompletion(
                "dc-1", user, com.biblequiz.infrastructure.time.GameClock.today(),
                80, 4, 5, null, LocalDateTime.now(ZoneOffset.UTC));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(dailyCompletionRepository.findByUserIdAndCompletionDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.of(existing));

        dailyChallengeService.markCompleted(userId, 100, 5);

        verify(dailyCompletionRepository, never()).save(any(DailyCompletion.class));
        // F-api-15: the existing row also blocks XP re-credit — the Redis
        // hasCompletedToday guard alone is lost on a cache flush, and without
        // this DB-backed check the +50 XP would be credited twice.
        verify(userDailyProgressRepository, never()).save(any());
    }

    // ── DC-3: getHistory returns N entries — missing days as completed:false ─

    @Order(13)
    @Test
    void getHistory_shouldReturn30EntriesIncludingMissingDays() {
        String userId = "user-hist-1";
        User user = new User();
        user.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // Only 2 of the last 30 days have completions.
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyCompletion dc1 = new DailyCompletion("dc-1", user, today.minusDays(5),
                80, 4, 5, null, LocalDateTime.now(ZoneOffset.UTC));
        DailyCompletion dc2 = new DailyCompletion("dc-2", user, today.minusDays(2),
                100, 5, 5, null, LocalDateTime.now(ZoneOffset.UTC));

        when(dailyCompletionRepository.findByUserIdAndDateRange(eq(userId),
                any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(dc1, dc2));

        List<Map<String, Object>> history = dailyChallengeService.getHistory(userId, 30);

        assertEquals(30, history.size());
        long completedCount = history.stream().filter(e -> Boolean.TRUE.equals(e.get("completed"))).count();
        assertEquals(2, completedCount);
        // Last entry is today (which has no completion in this test) — completed=false.
        assertEquals(false, history.get(29).get("completed"));
        assertEquals(today.toString(), history.get(29).get("date"));
    }

    // ── DC-3: getYesterdaySummary returns completed:false when no row ────────

    @Order(14)
    @Test
    void getYesterdaySummary_shouldReturnCompletedFalseWhenNoRow() {
        String userId = "user-yesterday-empty";
        User user = new User();
        user.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(dailyCompletionRepository.findByUserIdAndCompletionDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        Map<String, Object> result = dailyChallengeService.getYesterdaySummary(userId);

        assertEquals(false, result.get("completed"));
    }

    // ── DC-3: getYesterdaySummary returns full summary when completed ───────

    @Order(15)
    @Test
    void getYesterdaySummary_shouldReturnFullSummaryWhenCompleted() {
        String userId = "user-yesterday-done";
        User user = new User();
        user.setId(userId);
        LocalDate yesterday = com.biblequiz.infrastructure.time.GameClock.today().minusDays(1);
        DailyCompletion dc = new DailyCompletion(
                "dc-y", user, yesterday, 88, 4, 5, 204, LocalDateTime.now(ZoneOffset.UTC));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(dailyCompletionRepository.findByUserIdAndCompletionDate(eq(userId), eq(yesterday)))
                .thenReturn(Optional.of(dc));

        Map<String, Object> result = dailyChallengeService.getYesterdaySummary(userId);

        assertEquals(true, result.get("completed"));
        assertEquals(4, result.get("correctCount"));
        assertEquals(5, result.get("totalQuestions"));
        assertEquals(88, result.get("score"));
        assertEquals(204, result.get("timeSeconds"));
    }
}
