package com.biblequiz.api;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.modules.achievement.service.AchievementService;
import com.biblequiz.modules.notification.service.NotificationService;
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
    private NotificationService notificationService;

    // A1: required for context load (controller @Autowires it). Without
    // these mocks Spring fails to bootstrap and ALL tests in this class
    // error out with ApplicationContext failure (pre-existing on main).
    @MockBean
    private com.biblequiz.modules.ranked.service.GameModeUnlockConfig gameModeUnlockConfig;

    // A1: aggregates today's ranked accuracy.
    @MockBean
    private com.biblequiz.modules.quiz.repository.AnswerRepository answerRepository;

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
        when(scoringService.calculate(any(), anyInt(), anyInt())).thenReturn(scoreResult);

        when(bookProgressionService.shouldAdvanceToNextBook(anyString(), anyInt(), anyInt())).thenReturn(false);

        mockMvc.perform(post("/api/ranked/sessions/ranked-123/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("ranked-123"))
                .andExpect(jsonPath("$.livesRemaining").isNumber())
                .andExpect(jsonPath("$.currentBook").isNotEmpty());
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
        when(scoringService.calculate(any(), anyInt(), anyInt())).thenReturn(scoreResult);
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
        when(scoringService.calculate(any(), anyInt(), anyInt())).thenReturn(scoreResult);
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

    // ── TC-RANK-010: Book progression — auto advance ──────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_shouldAdvanceBookWhenCriteriaMet() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 49;
        progress.pointsToday = 500;
        progress.currentBook = "Genesis";
        progress.questionsInCurrentBook = 49;
        progress.correctAnswersInCurrentBook = 30;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-adv");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-adv")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);
        when(scoringService.calculate(any(), anyInt(), anyInt()))
                .thenReturn(new ScoringService.ScoreResult(10, 8, 2, 100, false));

        // After this answer: 50 questions, 31 correct → should advance
        when(bookProgressionService.shouldAdvanceToNextBook("Genesis", 50, 31)).thenReturn(true);
        when(bookProgressionService.getNextBook("Genesis")).thenReturn("Exodus");
        BookProgressionService.BookProgress exodusProgress = new BookProgressionService.BookProgress(
                2, 66, "Exodus", "Leviticus", false, 3.0);
        when(bookProgressionService.getBookProgress("Exodus")).thenReturn(exodusProgress);

        mockMvc.perform(post("/api/ranked/sessions/ranked-adv/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-adv\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBook").value("Exodus"));
    }

    // ── TC-RANK-011: Post-cycle after Revelation ──────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitRankedAnswer_afterRevelation_shouldEnterPostCycleMode() throws Exception {
        RankedSessionService.Progress progress = new RankedSessionService.Progress();
        progress.livesRemaining = 100;
        progress.questionsCounted = 49;
        progress.pointsToday = 500;
        progress.currentBook = "Revelation";
        progress.questionsInCurrentBook = 49;
        progress.correctAnswersInCurrentBook = 30;

        when(rankedSessionService.getOrCreate(anyString())).thenReturn(progress);

        com.biblequiz.modules.quiz.entity.Question question = new com.biblequiz.modules.quiz.entity.Question();
        question.setId("q-rev");
        question.setType(com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single);
        question.setCorrectAnswer(List.of(0));
        when(questionRepository.findById("q-rev")).thenReturn(Optional.of(question));
        when(scoringService.validateMultipleChoiceSingle(any(), any())).thenReturn(true);
        when(scoringService.calculate(any(), anyInt(), anyInt()))
                .thenReturn(new ScoringService.ScoreResult(10, 8, 2, 100, false));

        // At Revelation, shouldAdvance returns true but getNextBook returns null
        when(bookProgressionService.shouldAdvanceToNextBook("Revelation", 50, 31)).thenReturn(true);
        when(bookProgressionService.getNextBook("Revelation")).thenReturn(null);

        mockMvc.perform(post("/api/ranked/sessions/ranked-rev/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-rev\",\"answer\":0,\"clientElapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPostCycle").value(true));
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
}
