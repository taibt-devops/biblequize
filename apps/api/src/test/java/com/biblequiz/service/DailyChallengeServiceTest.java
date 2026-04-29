package com.biblequiz.service;

import com.biblequiz.infrastructure.service.CacheService;
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
import java.util.List;
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

    // ── Daily XP: markCompleted credits exactly +50 XP on fresh UDP ──────────

    @Order(5)
    @Test
    void markCompleted_shouldCreditPlus50XpToUserDailyProgress() {
        String userId = "user-xp-1";
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userDailyProgressRepository.findByUserIdAndDate(eq(userId), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        dailyChallengeService.markCompleted(userId, 80, 4);

        ArgumentCaptor<UserDailyProgress> saved = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(userDailyProgressRepository).save(saved.capture());
        assertEquals(50, saved.getValue().getPointsCounted(),
                "Fresh daily completion must credit exactly +50 XP");
    }

    // ── Daily XP: existing UDP gets +50 on top of prior points ───────────────

    @Order(6)
    @Test
    void markCompleted_shouldAdd50XpToExistingDailyProgress() {
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

        assertEquals(170, existing.getPointsCounted(), "Daily +50 XP stacks on top of existing XP");
        // questionsCounted / livesRemaining unchanged — Daily only touches XP.
        assertEquals(8, existing.getQuestionsCounted());
        assertEquals(95, existing.getLivesRemaining());
        verify(userDailyProgressRepository).save(existing);
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
}
