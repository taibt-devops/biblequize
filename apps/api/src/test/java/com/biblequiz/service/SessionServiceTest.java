package com.biblequiz.service;

import com.biblequiz.modules.quiz.entity.QuizSession;
import com.biblequiz.modules.quiz.entity.QuizSessionQuestion;
import com.biblequiz.modules.quiz.entity.Answer;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.quiz.repository.QuizSessionQuestionRepository;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.AnswerRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.PageImpl;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

        @Mock
        private QuizSessionRepository quizSessionRepository;
        @Mock
        private QuizSessionQuestionRepository quizSessionQuestionRepository;
        @Mock
        private QuestionRepository questionRepository;
        @Mock
        private AnswerRepository answerRepository;
        @Mock
        private UserRepository userRepository;
        @Mock
        private UserDailyProgressRepository userDailyProgressRepository;
        @Mock
        private ObjectMapper objectMapper;
        @Mock
        private com.biblequiz.modules.quiz.service.QuestionService questionService;
        @Mock
        private com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository userQuestionHistoryRepository;
        @Mock
        private com.biblequiz.modules.quiz.service.SmartQuestionSelector smartQuestionSelector;
        @Mock
        private com.biblequiz.modules.ranked.service.UserTierService userTierService;

        @InjectMocks
        private com.biblequiz.modules.quiz.service.SessionService sessionService;

        private User sampleUser;
        private Question sampleQuestion;
        private QuizSession sampleSession;
        private Answer sampleAnswer;

        @BeforeEach
        void setUp() {
                sampleUser = new User();
                sampleUser.setId("user1");
                sampleUser.setName("Test User");
                sampleUser.setEmail("test@example.com");

                sampleQuestion = new Question();
                sampleQuestion.setId("q1");
                sampleQuestion.setBook("Genesis");
                sampleQuestion.setChapter(1);
                sampleQuestion.setDifficulty(Question.Difficulty.easy);
                sampleQuestion.setType(Question.Type.multiple_choice_single);
                sampleQuestion.setContent("What is the first book of the Bible?");
                sampleQuestion.setOptions(Arrays.asList("Genesis", "Exodus", "Leviticus", "Numbers"));
                sampleQuestion.setCorrectAnswer(Arrays.asList(0));
                sampleQuestion.setIsActive(true);

                sampleSession = new QuizSession();
                sampleSession.setId("session1");
                sampleSession.setMode(QuizSession.Mode.practice);
                sampleSession.setOwner(sampleUser);
                sampleSession.setStatus(QuizSession.Status.in_progress);
                sampleSession.setScore(0);
                sampleSession.setTotalQuestions(1);
                sampleSession.setCorrectAnswers(0);

                sampleAnswer = new Answer();
                sampleAnswer.setId("answer1");
                sampleAnswer.setSession(sampleSession);
                sampleAnswer.setQuestion(sampleQuestion);
                sampleAnswer.setUser(sampleUser);
                sampleAnswer.setAnswer("0");
                sampleAnswer.setIsCorrect(true);
                sampleAnswer.setElapsedMs(5000);
                sampleAnswer.setScoreEarned(10);
        }

        @Test
        void createSession_WithValidData_ShouldCreateSession() throws Exception {
                // Given
                String ownerId = "user1";
                QuizSession.Mode mode = QuizSession.Mode.practice;
                Map<String, Object> config = new HashMap<>();
                config.put("questionCount", 1);
                config.put("book", "Genesis");
                config.put("difficulty", "easy");

                when(userRepository.findById(ownerId)).thenReturn(Optional.of(sampleUser));
                when(objectMapper.writeValueAsString(config)).thenReturn("{}");
                // Practice mode routes to SmartQuestionSelector (not QuestionService.getRandomQuestions),
                // see SessionService.createSession useSmartSelection branch.
                when(smartQuestionSelector.selectQuestions(eq(ownerId), eq(1), any()))
                                .thenReturn(Arrays.asList(sampleQuestion));
                when(quizSessionRepository.save(any(QuizSession.class))).thenReturn(sampleSession);

                // When
                Map<String, Object> result = sessionService.createSession(ownerId, mode, config);

                // Then
                assertNotNull(result);
                assertNotNull(result.get("sessionId"));
                assertNotNull(result.get("questions"));

                verify(userRepository).findById(ownerId);
                verify(quizSessionRepository, times(2)).save(any(QuizSession.class));
                verify(quizSessionQuestionRepository).saveAll(anyList());
        }

        @Test
        void createSession_WithNonExistentUser_ShouldCreateNewUser() throws Exception {
                // Given
                String ownerId = "nonexistent@example.com";
                QuizSession.Mode mode = QuizSession.Mode.practice;
                Map<String, Object> config = new HashMap<>();
                config.put("questionCount", 1);

                when(userRepository.findById(ownerId)).thenReturn(Optional.empty());
                when(userRepository.findByEmail(ownerId)).thenReturn(Optional.empty());
                when(userRepository.save(any(User.class))).thenReturn(sampleUser);
                lenient().when(objectMapper.writeValueAsString(config)).thenReturn("{}");
                when(smartQuestionSelector.selectQuestions(anyString(), eq(1), any()))
                                .thenReturn(Arrays.asList(sampleQuestion));
                when(quizSessionRepository.save(any(QuizSession.class))).thenReturn(sampleSession);

                // When
                Map<String, Object> result = sessionService.createSession(ownerId, mode, config);

                // Then
                assertNotNull(result);
                verify(userRepository).findById(ownerId);
                verify(userRepository).findByEmail(ownerId);
                verify(userRepository).save(any(User.class));
        }

        @Test
        void submitAnswer_WithValidData_ShouldCreateAnswer() {
                // Given
                String sessionId = "session1";
                String userId = "user1";
                String questionId = "q1";
                Object answerPayload = 0;
                int clientElapsedMs = 5000;

                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById(userId)).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById(questionId)).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId(sessionId, questionId, userId))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId(sessionId, questionId))
                                .thenReturn(new QuizSessionQuestion());

                // When
                Map<String, Object> result = sessionService.submitAnswer(sessionId, userId, questionId, answerPayload,
                                clientElapsedMs);

                // Then
                assertNotNull(result);
                assertTrue((Boolean) result.get("isCorrect"));
                // Server-side scoring: easy, 5s elapsed → base 10 + timeBonus(12) + perfectBonus(0) = 22 * 1.0 = 22
                // Actual value depends on computeScore formula
                assertTrue(((Number) result.get("scoreDelta")).intValue() > 0);

                verify(quizSessionRepository).findById(sessionId);
                verify(userRepository).findById(userId);
                verify(questionRepository).findById(questionId);
                verify(answerRepository).save(any(Answer.class));
                verify(quizSessionRepository).save(any(QuizSession.class));
        }

        @Test
        void submitAnswer_WithExistingAnswer_ShouldReturnExistingResult() {
                // Given
                String sessionId = "session1";
                String userId = "user1";
                String questionId = "q1";
                Object answerPayload = 0;
                int clientElapsedMs = 5000;

                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById(userId)).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById(questionId)).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId(sessionId, questionId, userId))
                                .thenReturn(Optional.of(sampleAnswer));

                // When
                Map<String, Object> result = sessionService.submitAnswer(sessionId, userId, questionId, answerPayload,
                                clientElapsedMs);

                // Then
                assertNotNull(result);
                assertTrue((Boolean) result.get("isCorrect"));
                assertEquals(10, result.get("scoreDelta")); // Existing answer score

                verify(answerRepository, never()).save(any(Answer.class));
        }

        @Test
        void getSession_WithValidSessionId_ShouldReturnSessionData() {
                // Given
                String sessionId = "session1";
                QuizSessionQuestion qsq = new QuizSessionQuestion();
                qsq.setQuestion(sampleQuestion);
                qsq.setOrderIndex(0);
                qsq.setTimeLimitSec(30);

                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(quizSessionQuestionRepository.findBySessionIdOrderByOrderIndex(sessionId))
                                .thenReturn(Arrays.asList(qsq));

                // When
                Map<String, Object> result = sessionService.getSession(sessionId);

                // Then
                assertNotNull(result);
                assertEquals("session1", result.get("id"));
                assertEquals("practice", result.get("mode"));
                assertEquals("in_progress", result.get("status"));
                assertEquals(0, result.get("score"));
                assertEquals(1, result.get("totalQuestions"));
                assertEquals(0, result.get("correctAnswers"));
                assertNotNull(result.get("questions"));
        }

        @Test
        void getReview_WithValidSessionId_ShouldReturnReviewData() {
                // Given
                String sessionId = "session1";
                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(answerRepository.findBySessionIdOrderByCreatedAt(sessionId))
                                .thenReturn(Arrays.asList(sampleAnswer));

                // When
                Map<String, Object> result = sessionService.getReview(sessionId);

                // Then
                assertNotNull(result);
                assertNotNull(result.get("items"));
                assertNotNull(result.get("stats"));

                @SuppressWarnings("unchecked")
                Map<String, Object> stats = (Map<String, Object>) result.get("stats");
                assertEquals(1, stats.get("totalQuestions"));
                assertEquals(1, stats.get("correctAnswers"));
                assertEquals(10, stats.get("totalScore"));
        }

        @Test
        void submitAnswer_WithTrueFalseQuestion_ShouldValidateCorrectly() {
                // Given
                Question trueFalseQuestion = new Question();
                trueFalseQuestion.setId("tf1");
                trueFalseQuestion.setType(Question.Type.true_false);
                trueFalseQuestion.setDifficulty(Question.Difficulty.easy);
                trueFalseQuestion.setCorrectAnswer(Arrays.asList(1)); // true

                String sessionId = "session1";
                String userId = "user1";
                String questionId = "tf1";
                Object answerPayload = true;
                int clientElapsedMs = 3000;

                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById(userId)).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById(questionId)).thenReturn(Optional.of(trueFalseQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId(sessionId, questionId, userId))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId(sessionId, questionId))
                                .thenReturn(new QuizSessionQuestion());

                // When
                Map<String, Object> result = sessionService.submitAnswer(sessionId, userId, questionId, answerPayload,
                                clientElapsedMs);

                // Then
                assertNotNull(result);
                assertTrue((Boolean) result.get("isCorrect"));
        }

        @Test
        void submitAnswer_WithMultipleChoiceMulti_ShouldValidateCorrectly() {
                // Given
                Question multiChoiceQuestion = new Question();
                multiChoiceQuestion.setId("mc1");
                multiChoiceQuestion.setType(Question.Type.multiple_choice_multi);
                multiChoiceQuestion.setDifficulty(Question.Difficulty.easy);
                multiChoiceQuestion.setCorrectAnswer(Arrays.asList(0, 2)); // first and third options

                String sessionId = "session1";
                String userId = "user1";
                String questionId = "mc1";
                Object answerPayload = Arrays.asList(0, 2);
                int clientElapsedMs = 4000;

                when(quizSessionRepository.findById(sessionId)).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById(userId)).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById(questionId)).thenReturn(Optional.of(multiChoiceQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId(sessionId, questionId, userId))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId(sessionId, questionId))
                                .thenReturn(new QuizSessionQuestion());

                // When
                Map<String, Object> result = sessionService.submitAnswer(sessionId, userId, questionId, answerPayload,
                                clientElapsedMs);

                // Then
                assertNotNull(result);
                assertTrue((Boolean) result.get("isCorrect"));
        }

        // ── FIX-002: Abandoned session tests ──

        @Test
        void processAbandonedSessions_marksStaleRankedAsAbandoned() {
                QuizSession stale = new QuizSession("s1", QuizSession.Mode.ranked, sampleUser, "{}");
                stale.setStatus(QuizSession.Status.in_progress);
                stale.setTotalQuestions(10);
                when(quizSessionRepository.findAbandonedRankedSessions(any(LocalDateTime.class)))
                        .thenReturn(List.of(stale));
                when(quizSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
                when(answerRepository.countBySessionId("s1")).thenReturn(7L);
                // 10 total - 7 answered = 3 unanswered → 15 energy deducted
                UserDailyProgress udp = new UserDailyProgress();
                udp.setLivesRemaining(80);
                when(userDailyProgressRepository.findByUserIdAndDate(anyString(), any()))
                        .thenReturn(Optional.of(udp));
                when(userDailyProgressRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

                int count = sessionService.processAbandonedSessions();

                assertEquals(1, count);
                assertEquals(QuizSession.Status.abandoned, stale.getStatus());
                assertNotNull(stale.getAbandonedAt());
                assertEquals(65, udp.getLivesRemaining()); // 80 - 15
        }

        @Test
        void processAbandonedSessions_practiceMode_noEnergyDeduction() {
                QuizSession stale = new QuizSession("s2", QuizSession.Mode.practice, sampleUser, "{}");
                stale.setStatus(QuizSession.Status.in_progress);
                stale.setTotalQuestions(10);
                when(quizSessionRepository.findAbandonedRankedSessions(any(LocalDateTime.class)))
                        .thenReturn(List.of(stale));
                when(quizSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

                int count = sessionService.processAbandonedSessions();

                assertEquals(1, count);
                assertEquals(QuizSession.Status.abandoned, stale.getStatus());
                verify(userDailyProgressRepository, never()).findByUserIdAndDate(anyString(), any());
        }

        @Test
        void submitAnswer_practiceMode_tier1_doesNotGrantPointsCounted() {
                // Option A (V2 fix 2026-05-02): Practice mode NEVER grants ranked
                // leaderboard points, regardless of tier. Previously Tier-1 users
                // received scoreDelta into pointsCounted as an onboarding path —
                // that contaminated the daily/weekly/all-time leaderboards. Now
                // Tier-1 Practice still ticks questionsCounted (for stats + daily
                // missions) but pointsCounted stays at 0.
                // See AUDIT_VARIETY_MODES_LEADERBOARD.md V2.
                when(quizSessionRepository.findById("session1")).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("session1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("session1", "q1"))
                                .thenReturn(new QuizSessionQuestion());
                when(userDailyProgressRepository.findByUserIdAndDate(eq("user1"), any()))
                                .thenReturn(Optional.empty());

                sessionService.submitAnswer("session1", "user1", "q1", 0, 5000);

                verify(userDailyProgressRepository).findByUserIdAndDate("user1", java.time.LocalDate.now(java.time.ZoneOffset.UTC));
                verify(userDailyProgressRepository).save(argThat(udp ->
                        udp.getQuestionsCounted() != null && udp.getQuestionsCounted() == 1
                                && udp.getPointsCounted() != null && udp.getPointsCounted() == 0));
        }

        @Test
        void submitAnswer_practiceMode_tier2_doesNotGrantPointsCounted() {
                // Option A (V2 fix 2026-05-02): same as Tier-1 — Practice never
                // grants pointsCounted. Tier-2 was already excluded under the old
                // cap logic; this test is now redundant with the Tier-1 test but
                // kept as a regression guard in case someone reintroduces a tier-
                // dependent grant path.
                when(quizSessionRepository.findById("session1")).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("session1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("session1", "q1"))
                                .thenReturn(new QuizSessionQuestion());
                when(userDailyProgressRepository.findByUserIdAndDate(eq("user1"), any()))
                                .thenReturn(Optional.empty());

                sessionService.submitAnswer("session1", "user1", "q1", 0, 5000);

                verify(userDailyProgressRepository).save(argThat(udp ->
                        udp.getQuestionsCounted() != null && udp.getQuestionsCounted() == 1
                                && udp.getPointsCounted() != null && udp.getPointsCounted() == 0));
        }

        @Test
        void submitAnswer_singleMode_doesNotGrantPointsCounted() {
                // Option A (V2.5 fix 2026-05-02): Single mode (custom solo quiz,
                // not yet wired in production FE) also must not contaminate the
                // ranked leaderboard ledger. questionsCounted ticks; pointsCounted
                // stays 0.
                QuizSession singleSession = new QuizSession();
                singleSession.setId("ss1");
                singleSession.setMode(QuizSession.Mode.single);
                singleSession.setOwner(sampleUser);
                singleSession.setStatus(QuizSession.Status.in_progress);
                singleSession.setScore(0);
                singleSession.setTotalQuestions(1);
                singleSession.setCorrectAnswers(0);

                when(quizSessionRepository.findById("ss1")).thenReturn(Optional.of(singleSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("ss1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("ss1", "q1"))
                                .thenReturn(new QuizSessionQuestion());
                when(userDailyProgressRepository.findByUserIdAndDate(eq("user1"), any()))
                                .thenReturn(Optional.empty());

                sessionService.submitAnswer("ss1", "user1", "q1", 0, 5000);

                verify(userDailyProgressRepository).save(argThat(udp ->
                        udp.getQuestionsCounted() != null && udp.getQuestionsCounted() == 1
                                && udp.getPointsCounted() != null && udp.getPointsCounted() == 0));
        }

        @Test
        void submitAnswer_varietyMode_shortCircuitsBeforeUdpWrite() {
                // Hardening (Bui decision 2026-05-02): if a future FE accidentally
                // creates a QuizSession with mode=mystery_mode/speed_round/weekly_quiz,
                // creditNonRankedProgress must reject early — no UDP write — so the
                // ranked leaderboard cannot be contaminated. Allow-list only permits
                // practice + single.
                QuizSession mysterySession = new QuizSession();
                mysterySession.setId("ms1");
                mysterySession.setMode(QuizSession.Mode.mystery_mode);
                mysterySession.setOwner(sampleUser);
                mysterySession.setStatus(QuizSession.Status.in_progress);
                mysterySession.setScore(0);
                mysterySession.setTotalQuestions(1);
                mysterySession.setCorrectAnswers(0);

                when(quizSessionRepository.findById("ms1")).thenReturn(Optional.of(mysterySession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("ms1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("ms1", "q1"))
                                .thenReturn(new QuizSessionQuestion());

                sessionService.submitAnswer("ms1", "user1", "q1", 0, 5000);

                // Allow-list rejects mystery_mode → no UDP lookup, no UDP save.
                verify(userDailyProgressRepository, never()).findByUserIdAndDate(anyString(), any());
                verify(userDailyProgressRepository, never()).save(any());
        }

        @Test
        void submitAnswer_practiceMode_wrongAnswer_doesNotGrantPointsCounted() {
                // Wrong answers always grant 0 points (any mode). Verify
                // questionsCounted still increments so daily-mission progress
                // counts the attempt.
                when(quizSessionRepository.findById("session1")).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("session1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("session1", "q1"))
                                .thenReturn(new QuizSessionQuestion());
                when(userDailyProgressRepository.findByUserIdAndDate(eq("user1"), any()))
                                .thenReturn(Optional.empty());

                // sampleQuestion correct answer is index 0; submit index 1 = wrong
                sessionService.submitAnswer("session1", "user1", "q1", 1, 5000);

                verify(userDailyProgressRepository).save(argThat(udp ->
                        udp.getQuestionsCounted() != null && udp.getQuestionsCounted() == 1
                                && udp.getPointsCounted() != null && udp.getPointsCounted() == 0));
        }

        @Test
        void submitAnswer_rankedMode_doesNotWriteUserDailyProgressFromSubmitAnswer() {
                // Ranked has its own sync-progress path (RankedController.syncProgress
                // writes UserDailyProgress.pointsCounted). submitAnswer must NOT
                // touch UDP for ranked either — avoids double-crediting.
                QuizSession rankedSession = new QuizSession();
                rankedSession.setId("rs1");
                rankedSession.setMode(QuizSession.Mode.ranked);
                rankedSession.setOwner(sampleUser);
                rankedSession.setStatus(QuizSession.Status.in_progress);
                rankedSession.setScore(0);
                rankedSession.setTotalQuestions(1);
                rankedSession.setCorrectAnswers(0);

                when(quizSessionRepository.findById("rs1")).thenReturn(Optional.of(rankedSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("rs1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("rs1", "q1"))
                                .thenReturn(new QuizSessionQuestion());

                sessionService.submitAnswer("rs1", "user1", "q1", 0, 5000);

                verify(userDailyProgressRepository, never()).findByUserIdAndDate(anyString(), any());
                verify(userDailyProgressRepository, never()).save(any());
        }

        @Test
        void submitAnswer_practiceMode_incrementsEarlyUnlockCounters() {
                // Practice correct answer must increment practice_correct_count
                // and practice_total_count on users (the early-unlock accuracy
                // path: ≥80% over 10+ answers bypasses the 1,000 XP gate).
                sampleUser.setPracticeCorrectCount(0);
                sampleUser.setPracticeTotalCount(0);
                sampleUser.setEarlyRankedUnlock(false);

                when(quizSessionRepository.findById("session1")).thenReturn(Optional.of(sampleSession));
                when(userRepository.findById("user1")).thenReturn(Optional.of(sampleUser));
                when(questionRepository.findById("q1")).thenReturn(Optional.of(sampleQuestion));
                when(answerRepository.findBySessionIdAndQuestionIdAndUserId("session1", "q1", "user1"))
                                .thenReturn(Optional.empty());
                when(answerRepository.save(any(Answer.class))).thenReturn(sampleAnswer);
                when(quizSessionQuestionRepository.findBySessionIdAndQuestionId("session1", "q1"))
                                .thenReturn(new QuizSessionQuestion());
                // Still tier-1 (no XP from Ranked yet)
                when(userTierService.getTotalPoints("user1")).thenReturn(0);
                when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

                sessionService.submitAnswer("session1", "user1", "q1", 0, 5000);

                assertEquals(1, sampleUser.getPracticeTotalCount());
                assertEquals(1, sampleUser.getPracticeCorrectCount());
                verify(userRepository).save(sampleUser);
        }

        @Test
        void submitAnswer_onAbandonedSession_throwsException() {
                QuizSession abandoned = new QuizSession("s3", QuizSession.Mode.ranked, sampleUser, "{}");
                abandoned.setStatus(QuizSession.Status.abandoned);
                when(quizSessionRepository.findById("s3")).thenReturn(Optional.of(abandoned));

                assertThrows(IllegalStateException.class, () ->
                        sessionService.submitAnswer("s3", "user-1", "q1", 0, 5000));
        }

        @Test
        void processAbandonedSessions_noStale_returnsZero() {
                when(quizSessionRepository.findAbandonedRankedSessions(any(LocalDateTime.class)))
                        .thenReturn(List.of());

                assertEquals(0, sessionService.processAbandonedSessions());
        }

        @Test
        void processAbandonedSessions_allQuestionsAnswered_noDeduction() {
                QuizSession stale = new QuizSession("s4", QuizSession.Mode.ranked, sampleUser, "{}");
                stale.setStatus(QuizSession.Status.in_progress);
                stale.setTotalQuestions(10);
                when(quizSessionRepository.findAbandonedRankedSessions(any(LocalDateTime.class)))
                        .thenReturn(List.of(stale));
                when(quizSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
                when(answerRepository.countBySessionId("s4")).thenReturn(10L); // all answered

                sessionService.processAbandonedSessions();

                // 0 unanswered → no energy deduction call
                verify(userDailyProgressRepository, never()).findByUserIdAndDate(anyString(), any());
        }
}
