package com.biblequiz.api;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.modules.achievement.service.AchievementService;
import com.biblequiz.modules.notification.service.NotificationService;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserBookProgress;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserBookProgressRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.service.BookProgressionService;
import com.biblequiz.modules.ranked.service.RankedSessionService;
import com.biblequiz.modules.ranked.service.ScoringService;
import com.biblequiz.modules.season.service.SeasonService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.not;

@WebMvcTest(RankedController.class)
class RankedControllerTest extends BaseControllerTest {

    @MockBean
    private RankedSessionService rankedSessionService;

    @MockBean
    private UserDailyProgressRepository udpRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private BookProgressionService bookProgressionService;

    @MockBean
    private UserBookProgressRepository userBookProgressRepository;

    @MockBean
    private QuestionRepository questionRepository;

    @MockBean
    private CacheService cacheService;

    @MockBean
    private SeasonService seasonService;

    @MockBean
    private AchievementService achievementService;

    @MockBean
    private ScoringService scoringService;

    @MockBean
    private com.biblequiz.modules.ranked.service.UserTierService userTierService;

    @MockBean
    private NotificationService notificationService;

    // A1: required for context load (controller @Autowires it). Without
    // these mocks Spring fails to bootstrap and ALL tests in this class
    // error out with ApplicationContext failure (pre-existing on main).
    @MockBean
    private com.biblequiz.modules.ranked.service.GameModeUnlockConfig gameModeUnlockConfig;

    // A1: aggregates today's ranked accuracy.
    @MockBean
    private com.biblequiz.modules.quiz.repository.AnswerRepository answerRepository;

    // A3: source for "Nth-highest seasonRanking.totalPoints".
    @MockBean
    private com.biblequiz.modules.season.repository.SeasonRankingRepository seasonRankingRepository;

    // Pre-existing on branch (added 2026-05-20 BL-20/21) — not mocked, so test slice
    // failed to bootstrap. Adding here to unblock RankedControllerTest after BL-20+
    // wired SmartQuestionSelector + UserQuestionHistoryRepository into the controller.
    @MockBean
    private com.biblequiz.modules.quiz.service.SmartQuestionSelector smartQuestionSelector;

    @MockBean
    private com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository userQuestionHistoryRepository;

    // Liturgical Coverage sprint commits 6+6b+7: new dependencies on RankedController.
    @MockBean
    private com.biblequiz.modules.season.service.LiturgicalSeasonService liturgicalSeasonService;

    @MockBean
    private com.biblequiz.infrastructure.feature.FeatureFlagService featureFlagService;

    @MockBean
    private com.biblequiz.modules.coverage.service.LiturgicalCoverageService liturgicalCoverageService;

    @MockBean
    private com.biblequiz.modules.coverage.service.CoverageAnalytics coverageAnalytics;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test User");
        testUser.setEmail("test@example.com");
        testUser.setRole("USER");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        BookProgressionService.BookProgress bookProgress = new BookProgressionService.BookProgress(
                1, 66, "Genesis", "Exodus", false, 1.5);
        when(bookProgressionService.getBookProgress(anyString())).thenReturn(bookProgress);
    }

    // ── POST /api/ranked/sessions ────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void startRankedSession_shouldReturn200WithSessionId() throws Exception {
        mockMvc.perform(post("/api/ranked/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.currentBook").value("Genesis"))
                .andExpect(jsonPath("$.bookProgress").isNotEmpty());

        verify(rankedSessionService).save(anyString(), any());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void startRankedSession_withExistingProgress_shouldSyncFromDb() throws Exception {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setLivesRemaining(80); // energy system: 100 max
        udp.setQuestionsCounted(10);
        udp.setPointsCounted(150);
        udp.setCurrentBook("Exodus");

        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.of(udp));

        mockMvc.perform(post("/api/ranked/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isNotEmpty());
    }

    // ── POST /api/ranked/sessions/{id}/answer ────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_withCorrectAnswer_shouldReturn200() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 5;
        progress.pointsToday = 50;
        progress.currentBook = "Genesis";

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-1");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(question));

        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);

        ScoringService.ScoreResult scoreResult = new ScoringService.ScoreResult(10, 8, 2, 100, false);
        when(scoringService.calculateRanked(any(), anyInt(), anyInt(), anyInt(), anyBoolean(), anyInt(), anyBoolean(), anyBoolean(), anyBoolean())).thenReturn(scoreResult);

        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        mockMvc.perform(post("/api/ranked/sessions/ranked-123/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("ranked-123"))
                .andExpect(jsonPath("$.livesRemaining").isNumber())
                .andExpect(jsonPath("$.currentBook").isNotEmpty());
    }

    // ── SCD-3: client cannot inflate XP — server always recomputes ─────────
    //
    // The /answer endpoint never reads `score`/`earned`/`correctCount` from
    // the payload. Pin this contract by sending an enormous fake score and
    // asserting response.earned matches the (mocked) server computation.

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_clientFakeScoreInPayload_isIgnored() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 5;
        progress.pointsToday = 50;
        progress.currentBook = "Genesis";
        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-1");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);

        // Server computes earned=10; client claims 99999 → server's value must win.
        ScoringService.ScoreResult scoreResult = new ScoringService.ScoreResult(10, 8, 2, 100, false);
        when(scoringService.calculateRanked(any(), anyInt(), anyInt(), anyInt(), anyBoolean(), anyInt(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(scoreResult);
        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        mockMvc.perform(post("/api/ranked/sessions/ranked-cheat/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0,\"clientElapsedMs\":5000,"
                                + "\"score\":99999,\"earned\":99999,\"correctCount\":42}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.earned").value(10))
                .andExpect(jsonPath("$.earned").value(not(99999)))
                .andExpect(jsonPath("$.pointsToday").value(60)); // 50 + 10, not 50 + 99999
    }

    // ── SCD-6: cross-user sessionId is rejected with 403 ───────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_sessionOwnedByOtherUser_returns403() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.userId = "user-other"; // session stamped to a different user
        progress.livesRemaining = 100;
        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-victim/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("SESSION_OWNERSHIP"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_legacySessionWithNullUserId_isAllowed() throws Exception {
        // Sessions created before the userId field existed have userId=null.
        // The check must not reject them (back-compat) — assert it falls
        // through to the normal blocked/answer path instead of 403.
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.userId = null;
        progress.livesRemaining = 0; // forces the blocked branch → 200 with blocked=true
        progress.questionsCounted = 100;
        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-legacy/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(true));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_whenBlocked_shouldReturnBlockedResponse() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 0;
        progress.questionsCounted = 100;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-123/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(true));
    }

    // ── GET /api/me/ranked-status ────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_shouldReturn200WithStatus() throws Exception {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setLivesRemaining(85); // energy
        udp.setQuestionsCounted(15);
        udp.setPointsCounted(200);
        udp.setCurrentBook("Genesis");
        udp.setCurrentBookIndex(0);
        udp.setCurrentDifficulty(UserDailyProgress.Difficulty.all);
        udp.setIsPostCycle(false);

        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.of(udp));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livesRemaining").value(85))
                .andExpect(jsonPath("$.questionsCounted").value(15))
                .andExpect(jsonPath("$.pointsToday").value(200))
                .andExpect(jsonPath("$.currentBook").value("Genesis"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_withNoProgress_shouldReturnDefaults() throws Exception {
        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livesRemaining").value(100))
                .andExpect(jsonPath("$.questionsCounted").value(0))
                .andExpect(jsonPath("$.currentBook").value("Genesis"));
    }

    // ── A1: dailyAccuracy / dailyCorrectCount / dailyTotalAnswered ──────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_withRankedAnswersToday_returnsAccuracy() throws Exception {
        // 8 correct out of 10 ranked answers → accuracy = 0.8
        when(answerRepository.countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(10L);
        when(answerRepository.countCorrectRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(8L);

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyAccuracy").value(0.8))
                .andExpect(jsonPath("$.dailyCorrectCount").value(8))
                .andExpect(jsonPath("$.dailyTotalAnswered").value(10));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_withNoAnswersToday_returnsNullAccuracy() throws Exception {
        when(answerRepository.countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(0L);

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                // Keys are present in JSON with explicit null (HashMap.put
                // with null is preserved by default Jackson config).
                .andExpect(jsonPath("$.dailyAccuracy").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.dailyCorrectCount").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.dailyTotalAnswered").value(org.hamcrest.Matchers.nullValue()));

        // Verify only the count query was issued; correct-count is skipped
        // when total = 0 (saves a needless DB roundtrip).
        verify(answerRepository).countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class));
        verify(answerRepository, never()).countCorrectRankedAnswersByUserBetween(
                anyString(), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_withYesterdayOnlyAnswers_returnsNullAccuracy() throws Exception {
        // Repository contract: query filters by today's window. Service
        // honors that contract and returns null fields when total = 0.
        // Mocks return 0 to simulate "yesterday's answers don't appear in
        // today's window".
        when(answerRepository.countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(0L);

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyAccuracy").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_perfectAccuracy_returnsOne() throws Exception {
        // 5/5 → accuracy = 1.0
        when(answerRepository.countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(5L);
        when(answerRepository.countCorrectRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(5L);

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyAccuracy").value(1.0))
                .andExpect(jsonPath("$.dailyCorrectCount").value(5))
                .andExpect(jsonPath("$.dailyTotalAnswered").value(5));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_zeroCorrect_returnsZeroAccuracy() throws Exception {
        // 0/3 → accuracy = 0.0 (NOT null — user did try, just got everything wrong)
        when(answerRepository.countRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(3L);
        when(answerRepository.countCorrectRankedAnswersByUserBetween(
                eq("user-1"), any(java.time.LocalDateTime.class), any(java.time.LocalDateTime.class)))
                .thenReturn(0L);

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyAccuracy").value(0.0))
                .andExpect(jsonPath("$.dailyCorrectCount").value(0))
                .andExpect(jsonPath("$.dailyTotalAnswered").value(3));
    }

    // ── A2: dailyDelta (today.points - yesterday.points) ───────────────────

    private UserDailyProgress udpWithPoints(int points) {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setPointsCounted(points);
        return udp;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_todayMoreThanYesterday_returnsPositiveDelta() throws Exception {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.of(udpWithPoints(50)));
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.of(udpWithPoints(30)));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(20));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_todayLessThanYesterday_returnsNegativeDelta() throws Exception {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.of(udpWithPoints(30)));
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.of(udpWithPoints(50)));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(-20));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_todayZeroYesterdayFifty_returnsLargeNegativeDelta() throws Exception {
        // User played hard yesterday, hasn't picked up the streak today
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.of(udpWithPoints(0)));
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.of(udpWithPoints(50)));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(-50));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_samePointsBothDays_returnsZeroDelta() throws Exception {
        // Boundary: 0 is a real value, NOT null. The FE hides "↑ +0" in
        // A4 — that's a render-time concern, not a server one.
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.of(udpWithPoints(50)));
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.of(udpWithPoints(50)));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(0));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_noProgressToday_returnsNullDelta() throws Exception {
        // Returning user — yesterday has data, today doesn't yet (haven't
        // played yet this morning). Delta is null until today's row exists.
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.empty());
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.of(udpWithPoints(50)));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_noProgressYesterday_returnsNullDelta() throws Exception {
        // Brand-new user — first day playing. No yesterday baseline →
        // delta meaningless, render null. Same for users who skipped a day.
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);
        when(udpRepository.findByUserIdAndDate("user-1", today)).thenReturn(Optional.of(udpWithPoints(30)));
        when(udpRepository.findByUserIdAndDate("user-1", yesterday)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyDelta").value(org.hamcrest.Matchers.nullValue()));
    }

    // ── A3: pointsToTop50 / pointsToTop10 ───────────────────────────────────

    private com.biblequiz.modules.season.entity.Season activeSeason() {
        com.biblequiz.modules.season.entity.Season s = new com.biblequiz.modules.season.entity.Season();
        s.setId("season-1");
        return s;
    }

    private com.biblequiz.modules.season.entity.SeasonRanking userRanking(int totalPoints) {
        com.biblequiz.modules.season.entity.SeasonRanking sr =
                new com.biblequiz.modules.season.entity.SeasonRanking();
        sr.setTotalPoints(totalPoints);
        return sr;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userBelowTop50_returnsPointsToTop50() throws Exception {
        // userPoints = 40, top50 threshold = 100 → need 100 - 40 + 1 = 61 to overtake
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.of(100));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.of(500));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(61))
                .andExpect(jsonPath("$.pointsToTop10").value(461));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userAlreadyInTop50_returnsNullPointsToTop50() throws Exception {
        // userPoints = 200, top50 threshold = 100, top10 threshold = 500
        // → user has cleared top 50 (null) but still chasing top 10 (need 301).
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(200)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.of(100));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.of(500));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pointsToTop10").value(301));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userInTop10_bothFieldsNull() throws Exception {
        // userPoints = 1000, beyond both thresholds → both fields null.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(1000)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.of(100));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.of(500));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pointsToTop10").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userTiedWithTop50_returnsNullPointsToTop50() throws Exception {
        // Quyết định: tie counts as "already in" → null. userPoints == top50.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(100)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.of(100));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.of(500));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pointsToTop10").value(401));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_leaderboardHasFewerThan50_returnsNullPointsToTop50() throws Exception {
        // Only 30 users in season ranking → no rank-50 exists → null.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.empty());
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.of(500));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pointsToTop10").value(461));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_noActiveSeason_bothFieldsNull() throws Exception {
        when(seasonService.getActiveSeason()).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pointsToTop10").value(org.hamcrest.Matchers.nullValue()));

        // No DB query attempted when there's no season scope to ask about.
        verify(seasonRankingRepository, never()).findScoreAtRankOffset(anyString(), anyInt());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_cacheHit_skipsDbQuery() throws Exception {
        // Cache returns the threshold directly → DB query NOT issued.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(cacheService.get(contains("top-50"), eq(Integer.class))).thenReturn(Optional.of(100));
        when(cacheService.get(contains("top-10"), eq(Integer.class))).thenReturn(Optional.of(500));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(61))
                .andExpect(jsonPath("$.pointsToTop10").value(461));

        verify(seasonRankingRepository, never()).findScoreAtRankOffset(anyString(), anyInt());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_cacheMiss_writesPositiveResultButNotNull() throws Exception {
        // top50 hit → caches 100. top10 miss (< 10 users) → does NOT cache
        // null so the next eligible 10th user is picked up immediately.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 49)).thenReturn(Optional.of(100));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 9)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop50").value(61))
                .andExpect(jsonPath("$.pointsToTop10").value(org.hamcrest.Matchers.nullValue()));

        verify(cacheService).put(contains("top-50"), eq(100), any(java.time.Duration.class));
        verify(cacheService, never()).put(contains("top-10"), any(), any(java.time.Duration.class));
    }

    // ── R10: pointsToTop100 / season placement / weekHighestCombo ─────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userBelowTop100_returnsPointsToTop100() throws Exception {
        // userPoints = 20, top100 threshold = 50 → need 31 to pass.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(20)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 99)).thenReturn(Optional.of(50));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop100").value(31));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userAboveTop100_returnsNullPointsToTop100() throws Exception {
        // User comfortably inside top 100 → field reads null so the
        // sidebar widget hides the "Đến top 100" milestone.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(500)));
        when(seasonRankingRepository.findScoreAtRankOffset("season-1", 99)).thenReturn(Optional.of(50));
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsToTop100").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_returnsSeasonRankAndTotalPlayers() throws Exception {
        // 12 users have more points than this user → rank = 13.
        // 200 total rows in season → 200 players in the season.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(seasonRankingRepository.countUsersAheadInSeason("season-1", 40)).thenReturn(12L);
        when(seasonRankingRepository.countBySeasonId("season-1")).thenReturn(200L);
        when(cacheService.get(anyString(), eq(Integer.class))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonRank").value(13))
                .andExpect(jsonPath("$.seasonTotalPlayers").value(200))
                .andExpect(jsonPath("$.seasonPoints").value(40))
                // R10 deferred per option C — always null until snapshot infra ships.
                .andExpect(jsonPath("$.seasonRankDelta").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_userWithoutSeasonRanking_returnsNullSeasonFields() throws Exception {
        // Active season exists but user has no SeasonRanking row → don't
        // claim a rank for them (would be misleading "#1 of 0").
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonRank").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.seasonTotalPlayers").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.seasonPoints").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_weekHighestCombo_pickedFromAnswerStream() throws Exception {
        // Stream: T T T F T T → longest run = 3.
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(answerRepository.findRankedAnswerCorrectnessSince(eq("user-1"), any(java.time.LocalDateTime.class)))
                .thenReturn(java.util.List.of(true, true, true, false, true, true));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekHighestCombo").value(3));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_weekHighestCombo_emptyWindowReturnsNull() throws Exception {
        // No ranked answers in the past 7 days → null (FE hides widget).
        when(seasonService.getActiveSeason()).thenReturn(Optional.of(activeSeason()));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(userRanking(40)));
        when(answerRepository.findRankedAnswerCorrectnessSince(eq("user-1"), any(java.time.LocalDateTime.class)))
                .thenReturn(java.util.Collections.emptyList());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekHighestCombo").value(org.hamcrest.Matchers.nullValue()));
    }

    // ── POST /api/ranked/sync-progress ───────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void syncProgress_shouldReturn200() throws Exception {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setQuestionsCounted(10);
        udp.setPointsCounted(100);
        udp.setLivesRemaining(27);

        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.of(udp));

        mockMvc.perform(post("/api/ranked/sync-progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.questionsCounted").value(10));
    }

    // ── GET /api/me/tier ─────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyTier_shouldReturn200WithTierInfo() throws Exception {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setPointsCounted(500);

        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of(udp));

        mockMvc.perform(get("/api/me/tier"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPoints").value(500))
                .andExpect(jsonPath("$.tier").isNotEmpty())
                .andExpect(jsonPath("$.tierName").isNotEmpty());
    }

    @Test
    void getMyTier_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/me/tier"))
                .andExpect(status().isUnauthorized());
    }

    // ── TC-TIER-002: Auto tier-up when points sufficient ──────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_shouldCheckAchievementsAfterScoring() throws Exception {
        // User has 4980 points across prior days, answering correctly should trigger achievement check
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 0;
        progress.pointsToday = 0;
        progress.currentBook = "Genesis";

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-tier");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-tier")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);

        ScoringService.ScoreResult scoreResult = new ScoringService.ScoreResult(24, 12, 0, 100, false);
        when(scoringService.calculateRanked(any(), anyInt(), anyInt(), anyInt(), anyBoolean(), anyInt(), anyBoolean(), anyBoolean(), anyBoolean())).thenReturn(scoreResult);
        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        // Mock DB persistence: user with existing points
        UserDailyProgress existingUdp = new UserDailyProgress();
        existingUdp.setPointsCounted(4980);
        existingUdp.setQuestionsCounted(5);
        existingUdp.setLivesRemaining(100);
        existingUdp.setCurrentBook("Genesis");
        existingUdp.setAskedQuestionIds(new java.util.ArrayList<>());

        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.of(existingUdp));
        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of(existingUdp));

        when(userBookProgressRepository.findByUserIdAndBook(anyString(), anyString()))
                .thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ranked/sessions/ranked-tier/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-tier\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk());

        // Verify achievements were checked after answer submission
        verify(achievementService).checkAndAward(eq(testUser), anyInt(), anyInt(), anyInt(), anyInt());
    }

    // ── TC-RANK-008: Idempotency — duplicate questionId tracked in askedQuestionIds ──

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_duplicateQuestionId_shouldNotAddTwice() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 5;
        progress.pointsToday = 50;
        progress.currentBook = "Genesis";

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-dup");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(1));
        when(questionRepository.findById("q-dup")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);

        ScoringService.ScoreResult scoreResult = new ScoringService.ScoreResult(10, 8, 2, 100, false);
        when(scoringService.calculateRanked(any(), anyInt(), anyInt(), anyInt(), anyBoolean(), anyInt(), anyBoolean(), anyBoolean(), anyBoolean())).thenReturn(scoreResult);
        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        // Set up UDP with q-dup already in askedQuestionIds
        java.util.List<String> alreadyAsked = new java.util.ArrayList<>();
        alreadyAsked.add("q-dup");
        UserDailyProgress udp = new UserDailyProgress();
        udp.setQuestionsCounted(5);
        udp.setPointsCounted(50);
        udp.setLivesRemaining(100);
        udp.setCurrentBook("Genesis");
        udp.setAskedQuestionIds(alreadyAsked);

        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.of(udp));
        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of(udp));
        when(userBookProgressRepository.findByUserIdAndBook(anyString(), anyString()))
                .thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ranked/sessions/ranked-dup/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-dup\",\"answer\":1,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk());

        // Verify the askedQuestionIds still has only one entry for q-dup (no duplicate)
        verify(udpRepository, atLeastOnce()).save(argThat(savedUdp -> {
            java.util.List<String> ids = savedUdp.getAskedQuestionIds();
            return ids != null && ids.stream().filter("q-dup"::equals).count() == 1;
        }));
    }

    // ── TC-RANK-009: Daily reset midnight UTC ─────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_afterMidnight_shouldResetDailyStatsButKeepBook() throws Exception {
        // Yesterday's progress: energy=20, questions=80, book=Exodus
        UserDailyProgress yesterdayUdp = new UserDailyProgress();
        yesterdayUdp.setLivesRemaining(20);
        yesterdayUdp.setQuestionsCounted(80);
        yesterdayUdp.setPointsCounted(900);
        yesterdayUdp.setCurrentBook("Exodus");
        yesterdayUdp.setCurrentBookIndex(1);
        yesterdayUdp.setCurrentDifficulty(UserDailyProgress.Difficulty.all);
        yesterdayUdp.setIsPostCycle(false);
        yesterdayUdp.setDate(LocalDate.now(ZoneOffset.UTC).minusDays(1));

        // No record for today
        when(udpRepository.findByUserIdAndDate(eq("user-1"), eq(LocalDate.now(ZoneOffset.UTC))))
                .thenReturn(Optional.empty());
        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of(yesterdayUdp));

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livesRemaining").value(100))     // Reset to max
                .andExpect(jsonPath("$.questionsCounted").value(0))     // Reset to 0
                .andExpect(jsonPath("$.pointsToday").value(0))         // Reset to 0
                .andExpect(jsonPath("$.currentBook").value("Exodus")); // Book carried over

        // Should create a new daily record
        verify(udpRepository).save(argThat(udp ->
                udp.getLivesRemaining() == 100
                        && udp.getQuestionsCounted() == 0
                        && "Exodus".equals(udp.getCurrentBook())));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getRankedStatus_newUser_shouldReturnDefaults() throws Exception {
        when(udpRepository.findByUserIdAndDate(eq("user-1"), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        when(udpRepository.findByUserIdOrderByDateDesc("user-1")).thenReturn(List.of());

        mockMvc.perform(get("/api/me/ranked-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livesRemaining").value(100))
                .andExpect(jsonPath("$.questionsCounted").value(0))
                .andExpect(jsonPath("$.currentBook").value("Genesis"));
    }

    // ── 2026-10-08: books are collected in any order; no journey advance ────

    /** A correct ranked answer to Genesis question {@code qId}, with the user's
     *  Genesis progress at {@code answeredBefore} distinct answers (150 in the book). */
    private UserBookProgress primeGenesisAnswer(String qId, int answeredBefore) {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 20;
        progress.pointsToday = 200;
        progress.currentBook = "Genesis";
        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId(qId);
        question.setBook("Genesis");
        question.setLanguage("vi");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById(qId)).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);
        when(scoringService.calculateRanked(any(), anyInt(), anyInt(), anyInt(), anyBoolean(), anyInt(), anyBoolean(), anyBoolean(), anyBoolean()))
                .thenReturn(new ScoringService.ScoreResult(10, 8, 2, 100, false));

        UserBookProgress ubp = new UserBookProgress("ubp-g", testUser, "Genesis");
        ubp.setAnsweredCount(answeredBefore);
        ubp.setCorrectCount(answeredBefore);
        ubp.setUniqueQuestionIds(new java.util.ArrayList<>());
        when(userBookProgressRepository.findByUserIdAndBook("user-1", "Genesis"))
                .thenReturn(Optional.of(ubp));
        when(userBookProgressRepository.findAllByUserId("user-1")).thenReturn(List.of(ubp));
        List<Object[]> totals = new java.util.ArrayList<>();
        totals.add(new Object[]{"Genesis", 150L});
        when(questionRepository.countActiveByBook("vi")).thenReturn(totals);
        return ubp;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_reachingSampleTarget_countsBookForScholar_withoutAdvancing() throws Exception {
        // Genesis has 150 questions → target = clamp(round(150×0.25),12,40) = 38.
        // UBP at 37 distinct; this new question makes 38 == target → sampled.
        UserBookProgress ubp = primeGenesisAnswer("q-g20", 37);

        mockMvc.perform(post("/api/ranked/sessions/ranked-j1/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-g20\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBook").value("Genesis")); // no sequential advance

        org.junit.jupiter.api.Assertions.assertEquals(38, ubp.getAnsweredCount());
        verify(achievementService).checkAndAward(any(), anyInt(), anyInt(), anyInt(), eq(1));
        verify(bookProgressionService, never()).getNextBook(anyString());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_belowSampleTarget_bookNotYetCounted() throws Exception {
        primeGenesisAnswer("q-g6", 5);

        mockMvc.perform(post("/api/ranked/sessions/ranked-j2/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-g6\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBook").value("Genesis"));

        verify(achievementService).checkAndAward(any(), anyInt(), anyInt(), anyInt(), eq(0)); // 6/38
    }

    // ── Proportional sample-target formula (25%, clamp 12..40) ────────────────

    @Test
    void rankedBookSampleTarget_proportionalWithFloorAndCap() {
        // ~25% of the book, clamped to [12, 40], never exceeding the book size.
        org.junit.jupiter.api.Assertions.assertEquals(40, RankedController.rankedBookSampleTarget(181)); // Psalms → cap
        org.junit.jupiter.api.Assertions.assertEquals(38, RankedController.rankedBookSampleTarget(150)); // Genesis → 37.5→38
        org.junit.jupiter.api.Assertions.assertEquals(12, RankedController.rankedBookSampleTarget(49));  // mid → 12.25→12 (floor)
        org.junit.jupiter.api.Assertions.assertEquals(12, RankedController.rankedBookSampleTarget(20));  // small → floor 12
        org.junit.jupiter.api.Assertions.assertEquals(10, RankedController.rankedBookSampleTarget(10));  // tiny → see all 10
        org.junit.jupiter.api.Assertions.assertEquals(5,  RankedController.rankedBookSampleTarget(5));   // garbled/tiny → all 5
        org.junit.jupiter.api.Assertions.assertEquals(12, RankedController.rankedBookSampleTarget(0));   // unknown count → floor
    }

    // ── TC-RANK-005: Energy deduction on wrong answer ─────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_wrongAnswer_shouldDeductEnergy() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 5;
        progress.pointsToday = 50;
        progress.currentBook = "Genesis";
        progress.currentStreak = 3;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-wrong");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-wrong")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(false);
        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        mockMvc.perform(post("/api/ranked/sessions/ranked-wrong/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-wrong\",\"answer\":1,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.livesRemaining").value(95))    // 100 - 5
                .andExpect(jsonPath("$.streak").value(0));            // Streak reset

        // Verify progress was saved with reduced energy
        verify(rankedSessionService).save(eq("ranked-wrong"), argThat(p ->
                p.livesRemaining == 95 && p.currentStreak == 0));
    }

    // ── TC-RANK-006: Energy 0 → blocked ───────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_zeroEnergy_shouldReturnBlocked() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 0;
        progress.questionsCounted = 20;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-blocked/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(true))
                .andExpect(jsonPath("$.livesRemaining").value(0));
    }

    // ── RGT-2: /questions/select serializes plain DTOs, never raw JPA entity
    // fields ───────────────────────────────────────────────────────────────
    //
    // Regression for commit 3260e6e (RKP-2 fix). The endpoint maps Question
    // entities to plain Map DTOs via questionToMap(), so Hibernate proxies
    // left in the persistence context can't crash Jackson. If anyone reverts
    // to returning the raw `picked` list, entity-only fields (isActive,
    // reviewStatus, category, …) leak into the JSON — assert they don't,
    // plus a defensive substring check for the failure signature.

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRankedQuestions_returnsPlainDtoShape_notRawEntity() throws Exception {
        Question q = new Question();
        q.setId("q-rgt");
        q.setBook("Genesis");
        q.setChapter(1);
        q.setVerseStart(1);
        q.setVerseEnd(2);
        q.setDifficulty(Question.Difficulty.easy);
        q.setType(Question.Type.multiple_choice_single);
        q.setContent("In the beginning?");
        q.setOptions(java.util.List.of("A", "B", "C", "D"));
        q.setCorrectAnswer(java.util.List.of(0));
        q.setExplanation("Gen 1:1");
        // Entity-only fields — would leak if the controller returned the raw entity.
        q.setIsActive(true);
        q.setReviewStatus(Question.ReviewStatus.ACTIVE);
        q.setCategory("bible_basics");
        q.setApprovalsCount(2);

        when(smartQuestionSelector.selectQuestions(eq("user-1"), anyInt(), any()))
                .thenReturn(java.util.List.of(q));

        String body = mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].id").value("q-rgt"))
                .andExpect(jsonPath("$.questions[0].book").value("Genesis"))
                .andExpect(jsonPath("$.questions[0].chapter").value(1))
                .andExpect(jsonPath("$.questions[0].difficulty").value("easy"))
                .andExpect(jsonPath("$.questions[0].type").value("multiple_choice_single"))
                .andExpect(jsonPath("$.questions[0].options[0]").value("A"))
                .andExpect(jsonPath("$.questions[0].correctAnswer[0]").value(0))
                // Entity-only fields must NOT be serialized — guards against
                // a future revert to `resp.put("questions", picked)`.
                .andExpect(jsonPath("$.questions[0].isActive").doesNotExist())
                .andExpect(jsonPath("$.questions[0].reviewStatus").doesNotExist())
                .andExpect(jsonPath("$.questions[0].category").doesNotExist())
                .andExpect(jsonPath("$.questions[0].approvalsCount").doesNotExist())
                .andExpect(jsonPath("$.questions[0].hibernateLazyInitializer").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        // Defensive: the failure signature must never appear in the body.
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("hibernateLazyInitializer"));
    }

    // ── 2026-10-08: whole-Bible select by familiarity ring + RWP-2 exclude ───

    private static Question selectable(String id, String book) {
        Question q = new Question();
        q.setId(id);
        q.setBook(book);
        q.setType(Question.Type.multiple_choice_single);
        q.setCorrectAnswer(java.util.List.of(0));
        return q;
    }

    private org.mockito.ArgumentCaptor<com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter>
            stubSelector(int tier, java.util.List<Question> candidates) {
        when(featureFlagService.isLiturgicalCoverageEnabled(anyString())).thenReturn(false);
        when(userTierService.getTierLevel("user-1")).thenReturn(tier);
        org.mockito.ArgumentCaptor<com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter> filterCap =
                org.mockito.ArgumentCaptor.forClass(
                        com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter.class);
        when(smartQuestionSelector.selectQuestions(eq("user-1"), anyInt(), filterCap.capture()))
                .thenReturn(candidates);
        return filterCap;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRankedQuestions_tier1_drawsFamiliarBooksFirst_ignoresBook_andExcludesRecentlySeen() throws Exception {
        // RWP-2: recently-seen ids come from history and must be excluded.
        when(userQuestionHistoryRepository.findRecentSeenQuestionIds(eq("user-1"), any()))
                .thenReturn(java.util.List.of("q-recent"));
        var filterCap = stubSelector(1, java.util.List.of(
                selectable("q-keep", "Genesis"), selectable("q-recent", "Genesis")));

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        // `book` from an older client must be ignored.
                        .content("{\"limit\":10,\"excludeIds\":[],\"book\":\"Leviticus\",\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].id").value("q-keep"))
                .andExpect(jsonPath("$.questions[1]").doesNotExist()); // q-recent excluded (RWP-2)

        // Ring 1 is too short to fill 10, so the draw widens ring by ring.
        var filters = filterCap.getAllValues();
        org.junit.jupiter.api.Assertions.assertEquals(3, filters.size());
        org.junit.jupiter.api.Assertions.assertEquals(
                com.biblequiz.modules.ranked.service.RankedBookPool.FAMILIAR, filters.get(0).books());
        org.junit.jupiter.api.Assertions.assertEquals(
                com.biblequiz.modules.ranked.service.RankedBookPool.booksForRing(2), filters.get(1).books());
        org.junit.jupiter.api.Assertions.assertTrue(filters.get(2).books().isEmpty());
        org.junit.jupiter.api.Assertions.assertTrue(
                filters.stream().noneMatch(f -> f.books().contains("Leviticus") && f.books().size() == 1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRankedQuestions_tier5_drawsTheWholeBible() throws Exception {
        var filterCap = stubSelector(5, java.util.List.of(selectable("q-lev", "Leviticus")));

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions[0].id").value("q-lev"));

        org.junit.jupiter.api.Assertions.assertEquals(1, filterCap.getAllValues().size());
        org.junit.jupiter.api.Assertions.assertTrue(filterCap.getValue().books().isEmpty());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRankedQuestions_takesAtMostThreeQuestionsPerBook() throws Exception {
        java.util.List<Question> candidates = new java.util.ArrayList<>();
        for (int i = 0; i < 6; i++) candidates.add(selectable("g" + i, "Genesis"));
        for (int i = 0; i < 6; i++) candidates.add(selectable("x" + i, "Exodus"));
        for (int i = 0; i < 2; i++) candidates.add(selectable("m" + i, "Matthew"));
        stubSelector(6, candidates);

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions", org.hamcrest.Matchers.hasSize(8)))
                .andExpect(jsonPath("$.questions[?(@.book == 'Genesis')]", org.hamcrest.Matchers.hasSize(3)))
                .andExpect(jsonPath("$.questions[?(@.book == 'Exodus')]", org.hamcrest.Matchers.hasSize(3)))
                .andExpect(jsonPath("$.questions[?(@.book == 'Matthew')]", org.hamcrest.Matchers.hasSize(2)));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRankedQuestions_fullRing_doesNotWiden() throws Exception {
        java.util.List<Question> candidates = new java.util.ArrayList<>();
        for (String book : java.util.List.of("Genesis", "John", "Psalms", "Acts")) {
            for (int i = 0; i < 3; i++) candidates.add(selectable(book + i, book));
        }
        var filterCap = stubSelector(2, candidates);

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions", org.hamcrest.Matchers.hasSize(10)));

        org.junit.jupiter.api.Assertions.assertEquals(1, filterCap.getAllValues().size());
        org.junit.jupiter.api.Assertions.assertEquals(
                com.biblequiz.modules.ranked.service.RankedBookPool.FAMILIAR, filterCap.getValue().books());
    }

    // ── LCT-1..3: Liturgical Coverage pool-exhaustion fallback chain ────────
    //
    // SPEC §7.11 — when the current-week book pool runs dry, /questions/select
    // applies a 3-step fallback:
    //   1. drop same-day exclusion (allow repeats today)
    //   2. drop difficulty filter (mix the tier distribution)
    //   3. set poolExhausted=true → FE shows "Unlock next week" CTA

    private void primeCoverageFlow() {
        com.biblequiz.modules.season.entity.Season season = new com.biblequiz.modules.season.entity.Season();
        season.setId("season-pentecost-2026");
        when(featureFlagService.isLiturgicalCoverageEnabled(anyString())).thenReturn(true);
        when(liturgicalSeasonService.getCurrentSeason()).thenReturn(Optional.of(season));
        when(liturgicalSeasonService.getCurrentSeason(any(java.time.LocalDate.class))).thenReturn(Optional.of(season));
        when(userTierService.getTierLevel(anyString())).thenReturn(3);
        com.biblequiz.modules.coverage.entity.UserSeasonCoverage cov =
                new com.biblequiz.modules.coverage.entity.UserSeasonCoverage();
        when(liturgicalCoverageService.getOrCreateCoverage(anyString(), anyString(), anyInt())).thenReturn(cov);
        when(liturgicalCoverageService.getActivePool(any(), anyString())).thenReturn(List.of("Genesis", "Matthew"));
    }

    private List<com.biblequiz.modules.quiz.entity.Question> buildQuestions(int n) {
        List<com.biblequiz.modules.quiz.entity.Question> out = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) {
            com.biblequiz.modules.quiz.entity.Question q = new com.biblequiz.modules.quiz.entity.Question();
            q.setId("q-" + i);
            q.setBook("Genesis");
            q.setChapter(1);
            q.setDifficulty(com.biblequiz.modules.quiz.entity.Question.Difficulty.easy);
            q.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
            q.setContent("?");
            q.setOptions(List.of("A", "B", "C", "D"));
            q.setCorrectAnswer(List.of(0));
            out.add(q);
        }
        return out;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRanked_fallbackBranch1_dropsSameDayExclusion() throws Exception {
        primeCoverageFlow();
        // First call (with excludeIds) returns 3 → < limit 10, triggers branch 1.
        // Second call (no excludeIds) returns 10 → satisfies request, branches 2/3 skipped.
        when(smartQuestionSelector.selectQuestions(anyString(), anyInt(), any()))
                .thenReturn(buildQuestions(3))
                .thenReturn(buildQuestions(10));

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[\"q-a\"],\"difficulty\":\"easy\",\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(10))
                .andExpect(jsonPath("$.poolExhausted").doesNotExist());
        verify(coverageAnalytics).poolExhaustionFallback(eq("user-1"), eq(1), anyInt(), anyInt(), anyString());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRanked_fallbackBranch2_dropsDifficultyFilter() throws Exception {
        primeCoverageFlow();
        // Branch 1 still yields too few (3); branch 2 (no difficulty) returns 10.
        when(smartQuestionSelector.selectQuestions(anyString(), anyInt(), any()))
                .thenReturn(buildQuestions(3))
                .thenReturn(buildQuestions(3))
                .thenReturn(buildQuestions(10));

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"difficulty\":\"easy\",\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(10))
                .andExpect(jsonPath("$.poolExhausted").doesNotExist());
        verify(coverageAnalytics).poolExhaustionFallback(eq("user-1"), eq(1), anyInt(), anyInt(), anyString());
        verify(coverageAnalytics).poolExhaustionFallback(eq("user-1"), eq(2), anyInt(), anyInt(), anyString());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void selectRanked_fallbackBranch3_setsPoolExhaustedTrue() throws Exception {
        primeCoverageFlow();
        // All three selector calls return empty → poolExhausted path.
        when(smartQuestionSelector.selectQuestions(anyString(), anyInt(), any()))
                .thenReturn(List.of());

        mockMvc.perform(post("/api/ranked/questions/select")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"limit\":10,\"excludeIds\":[],\"difficulty\":\"easy\",\"language\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(0))
                .andExpect(jsonPath("$.poolExhausted").value(true))
                .andExpect(jsonPath("$.suggestedAction").value("UNLOCK_NEXT_WEEK"));
        verify(coverageAnalytics).poolExhaustionFallback(eq("user-1"), eq(3), anyInt(), anyInt(), anyString());
    }

    // ── SCD-4: /sync-progress ignores FE-claimed score / questions ──────────
    //
    // The endpoint takes no @RequestBody — it just returns the user's stored
    // UserDailyProgress. Pin that contract by posting a tampered body and
    // asserting response numbers come from the DB, not the payload.

    @Test
    @WithMockUser(username = "test@example.com")
    void syncProgress_ignoresClientPayload_returnsDbStoredValues() throws Exception {
        UserDailyProgress udp = new UserDailyProgress();
        udp.setQuestionsCounted(7);
        udp.setPointsCounted(85);
        udp.setLivesRemaining(40);
        when(udpRepository.findByUserIdAndDate(eq("user-1"), any())).thenReturn(Optional.of(udp));

        mockMvc.perform(post("/api/ranked/sync-progress")
                        .contentType(MediaType.APPLICATION_JSON)
                        // Wildly inflated values — must be ignored.
                        .content("{\"questionsCounted\":9999,\"pointsToday\":999999,\"livesRemaining\":9999}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questionsCounted").value(7))
                .andExpect(jsonPath("$.pointsToday").value(85))
                .andExpect(jsonPath("$.livesRemaining").value(40));
    }

    // ── TC-RANK-007: Cap 100 questions/day → blocked ──────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_dailyCapReached_shouldReturnBlocked() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 50;
        progress.questionsCounted = 100;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-cap/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocked").value(true))
                .andExpect(jsonPath("$.questionsCounted").value(100));
    }

    // ── BL-26 B (LD1): POST /ranked/sessions/{id}/match-complete ──────────────
    // Accuracy bonus from SERVER counters (matchCorrect/matchTotal), % of
    // matchEarned: ≥90% → +15%, 75–89% → +8%, else 0. Idempotent.

    private RankedSessionService.Progress matchProgress(int total, int correct, int earned) {
        RankedSessionService.Progress p = new RankedSessionService.Progress();
        p.userId = "user-1";
        p.matchTotal = total;
        p.matchCorrect = correct;
        p.matchEarned = earned;
        p.pointsToday = earned;
        return p;
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void completeRankedMatch_accuracy90_awards15Percent() throws Exception {
        when(rankedSessionService.get("s-hi")).thenReturn(matchProgress(10, 10, 200));
        when(udpRepository.findByUserIdAndDate(anyString(), any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ranked/sessions/s-hi/match-complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bonusPercent").value(15))
                .andExpect(jsonPath("$.bonusPoints").value(30))   // round(200 × 0.15)
                .andExpect(jsonPath("$.awarded").value(true))
                .andExpect(jsonPath("$.pointsToday").value(230));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void completeRankedMatch_accuracy80_awards8Percent() throws Exception {
        when(rankedSessionService.get("s-mid")).thenReturn(matchProgress(10, 8, 200));
        when(udpRepository.findByUserIdAndDate(anyString(), any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/ranked/sessions/s-mid/match-complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bonusPercent").value(8))
                .andExpect(jsonPath("$.bonusPoints").value(16))   // round(200 × 0.08)
                .andExpect(jsonPath("$.awarded").value(true))
                .andExpect(jsonPath("$.pointsToday").value(216));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void completeRankedMatch_accuracyBelow75_noBonus() throws Exception {
        when(rankedSessionService.get("s-lo")).thenReturn(matchProgress(10, 7, 200));

        mockMvc.perform(post("/api/ranked/sessions/s-lo/match-complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bonusPercent").value(0))
                .andExpect(jsonPath("$.bonusPoints").value(0))
                .andExpect(jsonPath("$.awarded").value(false))
                .andExpect(jsonPath("$.pointsToday").value(200)); // unchanged
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void completeRankedMatch_idempotent_secondCallAwardsZero() throws Exception {
        RankedSessionService.Progress p = matchProgress(10, 10, 200);
        p.matchBonusAwarded = true; // already credited on a prior call
        when(rankedSessionService.get("s-dup")).thenReturn(p);

        mockMvc.perform(post("/api/ranked/sessions/s-dup/match-complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bonusPoints").value(0))
                .andExpect(jsonPath("$.awarded").value(false))
                .andExpect(jsonPath("$.pointsToday").value(200)); // not double-credited
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void completeRankedMatch_unknownSession_returnsZero() throws Exception {
        // rankedSessionService.get(...) unstubbed → null → graceful 0.
        mockMvc.perform(post("/api/ranked/sessions/s-missing/match-complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bonusPoints").value(0))
                .andExpect(jsonPath("$.awarded").value(false));
    }
}
