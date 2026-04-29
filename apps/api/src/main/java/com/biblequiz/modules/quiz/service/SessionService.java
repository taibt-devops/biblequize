package com.biblequiz.modules.quiz.service;

import com.biblequiz.modules.quiz.entity.Answer;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.QuizSession;
import com.biblequiz.modules.quiz.entity.QuizSessionQuestion;
import com.biblequiz.modules.quiz.repository.AnswerRepository;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.QuizSessionQuestionRepository;
import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.data.domain.PageRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.biblequiz.modules.quiz.entity.UserQuestionHistory;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import com.biblequiz.infrastructure.exception.BusinessLogicException;
import com.biblequiz.modules.ranked.service.UserTierService;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SessionService {

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);

    private final QuizSessionRepository quizSessionRepository;
    private final QuizSessionQuestionRepository quizSessionQuestionRepository;
    private final QuestionRepository questionRepository;
    private final AnswerRepository answerRepository;
    private final UserRepository userRepository;
    private final UserDailyProgressRepository userDailyProgressRepository;
    private final ObjectMapper objectMapper;
    private final QuestionService questionService;
    private final UserQuestionHistoryRepository userQuestionHistoryRepository;
    private final SmartQuestionSelector smartQuestionSelector;
    // totalPoints is derived (sum of UserDailyProgress.pointsCounted), not a
    // field on User — we reuse UserTierService as the single source of truth
    // for that computation to avoid drift between Ranked gating and tier UI.
    private final UserTierService userTierService;

    public SessionService(QuizSessionRepository quizSessionRepository,
            QuizSessionQuestionRepository quizSessionQuestionRepository,
            QuestionRepository questionRepository,
            AnswerRepository answerRepository,
            UserRepository userRepository,
            UserDailyProgressRepository userDailyProgressRepository,
            ObjectMapper objectMapper,
            QuestionService questionService,
            UserQuestionHistoryRepository userQuestionHistoryRepository,
            SmartQuestionSelector smartQuestionSelector,
            UserTierService userTierService) {
        this.quizSessionRepository = quizSessionRepository;
        this.quizSessionQuestionRepository = quizSessionQuestionRepository;
        this.questionRepository = questionRepository;
        this.answerRepository = answerRepository;
        this.userRepository = userRepository;
        this.userDailyProgressRepository = userDailyProgressRepository;
        this.objectMapper = objectMapper;
        this.questionService = questionService;
        this.userQuestionHistoryRepository = userQuestionHistoryRepository;
        this.smartQuestionSelector = smartQuestionSelector;
        this.userTierService = userTierService;
    }

    @Transactional
    public Map<String, Object> createSession(String ownerId, QuizSession.Mode mode, Map<String, Object> config) {
        User owner = userRepository.findById(ownerId)
                .orElseGet(() -> userRepository.findByEmail(ownerId)
                        .orElseGet(() -> createUserFromPrincipal(ownerId)));

        // Ranked gate: passing the Bible Basics catechism (≥8/10) is the
        // single source of truth for unlocking Ranked. Replaces the legacy
        // XP / practice-accuracy gate (DECISIONS.md 2026-04-29).
        // The earlyRankedUnlock + practiceCorrect/Total fields remain in
        // the schema for one release; V32 will drop them.
        if (mode == QuizSession.Mode.ranked) {
            if (!Boolean.TRUE.equals(owner.getBasicQuizPassed())) {
                throw new BusinessLogicException(
                        "Ranked mode is locked. Pass the Bible Basics catechism quiz (≥8/10) to unlock.");
            }
        }

        String sessionId = UUID.randomUUID().toString();
        String configJson;
        try {
            configJson = objectMapper.writeValueAsString(config);
        } catch (Exception e) {
            configJson = "{}";
        }
        QuizSession session = new QuizSession(sessionId, mode, owner, configJson);
        session.setStatus(QuizSession.Status.in_progress);
        quizSessionRepository.save(session);

        int questionCount = ((Number) config.getOrDefault("questionCount", 10)).intValue();
        String book = (String) config.getOrDefault("book", null);
        String difficultyStr = (String) config.getOrDefault("difficulty", null);
        String language = (String) config.getOrDefault("language", "vi");

        List<Question> questions;
        boolean useSmartSelection = (mode == QuizSession.Mode.practice || mode == QuizSession.Mode.ranked);
        if (useSmartSelection) {
            // Smart selection: prioritize unseen + review questions for practice/ranked
            var filter = new SmartQuestionSelector.QuestionFilter(book, difficultyStr, language);
            questions = smartQuestionSelector.selectQuestions(owner.getId(), questionCount, filter);
        } else {
            // Random selection: daily/multiplayer need same questions for all users
            @SuppressWarnings("unchecked")
            List<String> excludeIds = (List<String>) config.getOrDefault("excludeQuestionIds", null);
            questions = questionService.getRandomQuestions(book, difficultyStr, language, questionCount, excludeIds);
        }

        // Tier-based timer: higher tier → shorter timer
        int timerSec = useSmartSelection
                ? smartQuestionSelector.getTimerSeconds(owner.getId())
                : 30;

        List<QuizSessionQuestion> qsqList = new ArrayList<>();
        int order = 0;
        for (Question q : questions) {
            qsqList.add(new QuizSessionQuestion(UUID.randomUUID().toString(), session, q, order++, timerSec));
        }
        quizSessionQuestionRepository.saveAll(qsqList);

        session.setTotalQuestions(questions.size());
        quizSessionRepository.save(session);

        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", session.getId());
        result.put("questions", mapToQuestionDTOs(questions));
        return result;
    }

    @Transactional
    public Map<String, Object> retrySession(String sessionId, String userId) {
        QuizSession original = quizSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NoSuchElementException("Session not found"));

        if (!original.getOwner().getId().equals(userId)
                && !original.getOwner().getEmail().equals(userId)) {
            throw new IllegalArgumentException("Session does not belong to this user");
        }

        // Parse original config and create new session with same settings
        Map<String, Object> config;
        try {
            config = original.getConfig() != null
                    ? objectMapper.readValue(original.getConfig(), new com.fasterxml.jackson.core.type.TypeReference<>() {})
                    : new HashMap<>();
        } catch (Exception e) {
            config = new HashMap<>();
        }

        Map<String, Object> newSession = createSession(userId, original.getMode(), config);

        Map<String, Object> result = new HashMap<>();
        result.put("newSessionId", newSession.get("sessionId"));
        result.put("originalSessionId", sessionId);
        return result;
    }

    @Transactional
    public Map<String, Object> submitAnswer(String sessionId, String userId, String questionId, Object answerPayload,
            int clientElapsedMs) {
        QuizSession session = quizSessionRepository.findById(sessionId).orElseThrow();

        // FIX-002: Reject answers on abandoned sessions
        if (session.getStatus() == QuizSession.Status.abandoned) {
            throw new IllegalStateException("Session has been abandoned");
        }

        // Principal.getName() returns the JWT subject, which is the user's
        // email for both OAuth (Google) and password (mobile) logins — not
        // the UUID primary key. createSession already accounts for this;
        // submitAnswer didn't, so every authenticated Practice submission
        // 500'd with "No value present" once the DTO alias fix unblocked
        // the body-parse step. Same two-step lookup keeps both entry points
        // symmetric.
        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmail(userId))
                .orElseThrow();

        // FIX-002: Update last activity for abandonment detection
        session.setLastActivityAt(LocalDateTime.now());

        Question question = questionRepository.findById(questionId).orElseThrow();

        Optional<Answer> existing = answerRepository.findBySessionIdAndQuestionIdAndUserId(sessionId, questionId,
                userId);
        if (existing.isPresent()) {
            return toAnswerResult(existing.get(), question);
        }

        boolean isCorrect = validateAnswer(question, answerPayload);

        // FIX #6/#7: Server is the sole source of truth for scoring.
        // Elapsed time is capped to avoid inflated speed bonuses from spoofed clients.
        int safedElapsedMs = Math.min(Math.max(clientElapsedMs, 0), 35_000);
        int scoreDelta = isCorrect ? computeScore(question, safedElapsedMs) : 0;

        String answerJson;
        try {
            answerJson = objectMapper.writeValueAsString(answerPayload);
        } catch (Exception e) {
            answerJson = "null";
        }
        Answer answer = new Answer(
                UUID.randomUUID().toString(),
                session,
                question,
                user,
                answerJson,
                isCorrect,
                safedElapsedMs, // store validated elapsed time
                scoreDelta);
        answerRepository.save(answer);

        if (isCorrect) {
            session.setScore(Optional.ofNullable(session.getScore()).orElse(0) + scoreDelta);
            session.setCorrectAnswers(Optional.ofNullable(session.getCorrectAnswers()).orElse(0) + 1);
        }
        quizSessionRepository.save(session);

        QuizSessionQuestion qsq = quizSessionQuestionRepository.findBySessionIdAndQuestionId(sessionId, questionId);
        if (qsq != null) {
            qsq.setAnsweredAt(LocalDateTime.now());
            qsq.setIsCorrect(isCorrect);
            qsq.setScoreEarned(scoreDelta);
            quizSessionQuestionRepository.save(qsq);
        }

        recordQuestionHistory(user, question, isCorrect);
        updateEarlyRankedUnlockProgress(user, session.getMode(), isCorrect);
        creditNonRankedProgress(user, session.getMode(), isCorrect, scoreDelta);

        return toAnswerResult(answer, question);
    }

    /**
     * Credit XP + question count toward {@link com.biblequiz.modules.quiz.entity.UserDailyProgress}
     * for non-Ranked game modes (Practice, single, daily, weekly, mystery,
     * speed). Ranked has its own sync path via
     * {@code /api/ranked/sync-progress} in {@code RankedController}, so
     * it's excluded here to avoid double-crediting.
     *
     * <p>Why this exists: {@code UserTierService.getTotalPoints(userId)}
     * sums {@code UserDailyProgress.pointsCounted} across all rows. Without
     * this write, every Practice correct answer produced {@code scoreDelta}
     * that only landed on {@code QuizSession.score} (session-local) — never
     * contributing to the all-time XP total that drives tier progression.
     *
     * <h3>Practice XP cap</h3>
     * <p>Practice mode is the onboarding path. Once the user hits
     * {@code totalPoints >= 1,000} (Tier-2), Practice stops granting XP —
     * Ranked becomes the progression driver. This mirrors
     * {@link #updateEarlyRankedUnlockProgress} which already short-circuits
     * at the same threshold. Other non-Ranked modes (daily, weekly, mystery,
     * speed) are bonus content and continue granting XP at every tier.
     *
     * <p>Even when XP is capped, {@code questionsCounted} still ticks so
     * Practice keeps contributing to streak / daily missions / achievements.
     * Wrong answers always add 0 XP but still increment the question count.
     */
    private void creditNonRankedProgress(User user, QuizSession.Mode mode, boolean isCorrect, int scoreDelta) {
        if (mode == QuizSession.Mode.ranked) return;

        boolean grantXp = true;
        if (mode == QuizSession.Mode.practice) {
            int totalPoints = userTierService.getTotalPoints(user.getId());
            if (totalPoints >= 1_000) {
                grantXp = false;
            }
        }

        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneOffset.UTC);
        com.biblequiz.modules.quiz.entity.UserDailyProgress udp = userDailyProgressRepository
                .findByUserIdAndDate(user.getId(), today)
                .orElseGet(() -> {
                    var fresh = new com.biblequiz.modules.quiz.entity.UserDailyProgress(
                            UUID.randomUUID().toString(), user, today);
                    fresh.setLivesRemaining(100);
                    fresh.setQuestionsCounted(0);
                    fresh.setPointsCounted(0);
                    return fresh;
                });
        int addPoints = (isCorrect && grantXp) ? Math.max(0, scoreDelta) : 0;
        int beforePoints = Optional.ofNullable(udp.getPointsCounted()).orElse(0);
        int beforeQuestions = Optional.ofNullable(udp.getQuestionsCounted()).orElse(0);
        udp.setPointsCounted(beforePoints + addPoints);
        udp.setQuestionsCounted(beforeQuestions + 1);
        userDailyProgressRepository.save(udp);

        log.info("creditNonRankedProgress user={} mode={} isCorrect={} scoreDelta={} grantXp={} "
                + "pointsCounted={}→{} questionsCounted={}→{}",
                user.getId(), mode, isCorrect, scoreDelta, grantXp,
                beforePoints, beforePoints + addPoints,
                beforeQuestions, beforeQuestions + 1);
    }

    /**
     * Track a user's Practice-mode accuracy so Tier-1 players who
     * demonstrate ≥80% correctness over ≥10 questions can bypass the
     * 1,000 XP Ranked gate. The flag is permanent once set.
     *
     * <p>Short-circuits for:
     * <ul>
     *   <li>Non-practice sessions (counters only reflect Practice).</li>
     *   <li>Users already above Tier 1 (they already have Ranked access).</li>
     *   <li>Users who already earned the unlock.</li>
     * </ul>
     */
    private void updateEarlyRankedUnlockProgress(User user, QuizSession.Mode mode, boolean isCorrect) {
        if (mode != QuizSession.Mode.practice) return;
        if (Boolean.TRUE.equals(user.getEarlyRankedUnlock())) return;
        int totalPoints = userTierService.getTotalPoints(user.getId());
        if (totalPoints >= 1_000) return; // already Tier-2+ via XP path

        int newTotal = Optional.ofNullable(user.getPracticeTotalCount()).orElse(0) + 1;
        int newCorrect = Optional.ofNullable(user.getPracticeCorrectCount()).orElse(0)
                + (isCorrect ? 1 : 0);
        user.setPracticeTotalCount(newTotal);
        user.setPracticeCorrectCount(newCorrect);

        if (EarlyRankedUnlockPolicy.shouldUnlock(newCorrect, newTotal)) {
            user.setEarlyRankedUnlock(true);
            // Record the exact moment only on the FIRST flip so the FE
            // celebration modal fires once. The outer guard already
            // short-circuits when the flag was previously set, so this
            // runs at most once per user.
            if (user.getEarlyRankedUnlockedAt() == null) {
                user.setEarlyRankedUnlockedAt(LocalDateTime.now());
            }
        }
        userRepository.save(user);
        log.info("updateEarlyRankedUnlockProgress user={} isCorrect={} counters={}/{} (correct/total) "
                + "earlyRankedUnlock={}",
                user.getId(), isCorrect, newCorrect, newTotal, user.getEarlyRankedUnlock());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSession(String sessionId) {
        QuizSession session = quizSessionRepository.findById(sessionId).orElseThrow();
        List<QuizSessionQuestion> items = quizSessionQuestionRepository.findBySessionIdOrderByOrderIndex(sessionId);
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", session.getId());
        dto.put("mode", session.getMode().name());
        dto.put("status", session.getStatus().name());
        dto.put("score", session.getScore());
        dto.put("totalQuestions", session.getTotalQuestions());
        dto.put("correctAnswers", session.getCorrectAnswers());
        dto.put("questions", items.stream().map(i -> Map.of(
                "id", i.getQuestion().getId(),
                "order", i.getOrderIndex(),
                "timeLimitSec", i.getTimeLimitSec())).toList());
        return dto;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getReview(String sessionId) {
        QuizSession session = quizSessionRepository.findById(sessionId).orElseThrow();
        List<Answer> answers = answerRepository.findBySessionIdOrderByCreatedAt(sessionId);

        List<Map<String, Object>> review = new ArrayList<>();
        int totalQuestions = answers.size();
        int correctAnswers = 0;
        int totalScore = 0;
        long totalTime = 0L;
        List<Integer> timePerQuestion = new ArrayList<>();

        Map<String, Object> easy = new HashMap<>(Map.of("correct", 0, "total", 0, "score", 0));
        Map<String, Object> medium = new HashMap<>(Map.of("correct", 0, "total", 0, "score", 0));
        Map<String, Object> hard = new HashMap<>(Map.of("correct", 0, "total", 0, "score", 0));

        for (Answer a : answers) {
            Question q = a.getQuestion();
            Map<String, Object> item = new HashMap<>();
            item.put("questionId", q.getId());
            item.put("book", q.getBook());
            item.put("chapter", q.getChapter());
            item.put("difficulty", q.getDifficulty() != null ? q.getDifficulty().name() : null);
            item.put("content", q.getContent());
            item.put("options", q.getOptions());
            item.put("correctAnswer", q.getCorrectAnswer());
            item.put("explanation", q.getExplanation());
            item.put("answer", a.getAnswer());
            item.put("isCorrect", a.getIsCorrect());
            item.put("elapsedMs", a.getElapsedMs());
            item.put("scoreEarned", a.getScoreEarned());
            review.add(item);

            if (Boolean.TRUE.equals(a.getIsCorrect()))
                correctAnswers++;
            totalScore += Optional.ofNullable(a.getScoreEarned()).orElse(0);
            int elapsed = Optional.ofNullable(a.getElapsedMs()).orElse(0);
            totalTime += elapsed;
            timePerQuestion.add(elapsed);

            String diff = q.getDifficulty() != null ? q.getDifficulty().name() : "easy";
            Map<String, Object> bucket;
            if ("medium".equals(diff)) {
                bucket = medium;
            } else if ("hard".equals(diff)) {
                bucket = hard;
            } else {
                bucket = easy;
            }
            bucket.put("total", ((Integer) bucket.get("total")) + 1);
            if (Boolean.TRUE.equals(a.getIsCorrect())) {
                bucket.put("correct", ((Integer) bucket.get("correct")) + 1);
                bucket.put("score",
                        ((Integer) bucket.get("score")) + Optional.ofNullable(a.getScoreEarned()).orElse(0));
            }
        }

        double accuracy = totalQuestions > 0 ? (correctAnswers * 100.0 / totalQuestions) : 0.0;
        double averageTime = totalQuestions > 0 ? (totalTime / (double) totalQuestions) : 0.0;

        Map<String, Object> difficultyBreakdown = new HashMap<>();
        difficultyBreakdown.put("easy", easy);
        difficultyBreakdown.put("medium", medium);
        difficultyBreakdown.put("hard", hard);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalScore", totalScore);
        stats.put("correctAnswers", correctAnswers);
        stats.put("totalQuestions", totalQuestions);
        stats.put("accuracy", accuracy);
        stats.put("averageTime", averageTime);
        stats.put("totalTime", totalTime);
        stats.put("difficultyBreakdown", difficultyBreakdown);
        stats.put("timePerQuestion", timePerQuestion);
        stats.put("sessionScore", session.getScore());
        stats.put("sessionCorrectAnswers", session.getCorrectAnswers());

        Map<String, Object> response = new HashMap<>();
        response.put("items", review);
        response.put("stats", stats);
        return response;
    }

    private List<Map<String, Object>> mapToQuestionDTOs(List<Question> questions) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Question q : questions) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", q.getId());
            dto.put("book", q.getBook());
            dto.put("chapter", q.getChapter());
            dto.put("difficulty", q.getDifficulty() != null ? q.getDifficulty().name() : null);
            dto.put("content", q.getContent());
            dto.put("options", q.getOptions());
            dto.put("type", q.getType().name());
            dto.put("timeLimitSec", 30);
            dto.put("correctAnswer", q.getCorrectAnswer());
            dto.put("explanation", q.getExplanation());
            list.add(dto);
        }
        return list;
    }

    private User createUserFromPrincipal(String principalName) {
        // FIX #14: derive provider from principalName heuristic; default to "local"
        // (not hardcoded "google") when we cannot determine the actual provider.
        String email = principalName;
        String name = principalName;
        if (principalName != null && principalName.contains("@")) {
            name = principalName.substring(0, principalName.indexOf('@'));
        }
        // Best-effort: if you need real provider tracking, pass it as a parameter.
        String provider = "local";
        User user = new User(UUID.randomUUID().toString(), name, email, provider);
        return userRepository.save(user);
    }

    private void recordQuestionHistory(User user, Question question, boolean isCorrect) {
        UserQuestionHistory history = userQuestionHistoryRepository
                .findByUserIdAndQuestionId(user.getId(), question.getId())
                .orElseGet(() -> {
                    UserQuestionHistory h = new UserQuestionHistory(
                            UUID.randomUUID().toString(), user, question);
                    h.setTimesSeen(0);
                    h.setTimesCorrect(0);
                    h.setTimesWrong(0);
                    return h;
                });

        history.setTimesSeen(history.getTimesSeen() + 1);
        history.setLastSeenAt(LocalDateTime.now());

        if (isCorrect) {
            history.setTimesCorrect(history.getTimesCorrect() + 1);
            history.setLastCorrectAt(LocalDateTime.now());
            // SRS: correct → review later (3, 6, 9... max 30 days)
            int days = Math.min(30, history.getTimesCorrect() * 3);
            history.setNextReviewAt(LocalDateTime.now().plusDays(days));
        } else {
            history.setTimesWrong(history.getTimesWrong() + 1);
            history.setLastWrongAt(LocalDateTime.now());
            // SRS: wrong → review soon (1 day)
            history.setNextReviewAt(LocalDateTime.now().plusDays(1));
        }

        userQuestionHistoryRepository.save(history);
    }

    private int computeScore(Question question, int elapsedMs) {
        // FIX #6: Mirror the frontend scoring logic so DB score == displayed score.
        int base = switch (question.getDifficulty()) {
            case medium -> 20;
            case hard -> 30;
            default -> 10; // easy
        };
        int timeLeftMs = Math.max(0, 30_000 - elapsedMs);
        int timeLeftSec = timeLeftMs / 1000;
        int timeBonus = timeLeftSec / 2; // up to 15 pts
        int perfectBonus = timeLeftSec >= 25 ? 5 : 0; // answered in < 5 s
        double multiplier = switch (question.getDifficulty()) {
            case hard -> 1.5;
            case medium -> 1.2;
            default -> 1.0;
        };
        return (int) Math.floor((base + timeBonus + perfectBonus) * multiplier);
    }

    @Deprecated(forRemoval = true)
    private int computeSpeedBonus(int elapsedMs, int timeLimitSec) {
        int remaining = Math.max(0, timeLimitSec * 1000 - elapsedMs);
        return (int) Math.floor(remaining / 500.0);
    }

    @SuppressWarnings("unchecked")
    private boolean validateAnswer(Question question, Object answerPayload) {
        Question.Type type = question.getType();
        if (type == Question.Type.true_false) {
            if (answerPayload instanceof Boolean) {
                boolean b = (Boolean) answerPayload;
                List<Integer> correct = question.getCorrectAnswer();
                return (b ? 1 : 0) == (correct != null && !correct.isEmpty() ? correct.get(0) : 0);
            }
            return false;
        }
        if (type == Question.Type.multiple_choice_single) {
            int chosen = answerPayload instanceof Number ? ((Number) answerPayload).intValue() : -1;
            List<Integer> correct = question.getCorrectAnswer();
            return correct != null && correct.size() == 1 && chosen == correct.get(0);
        }
        if (type == Question.Type.multiple_choice_multi) {
            if (!(answerPayload instanceof List<?>))
                return false;
            List<?> raw = (List<?>) answerPayload;
            List<Integer> chosen = new ArrayList<>();
            for (Object o : raw) {
                if (o instanceof Number)
                    chosen.add(((Number) o).intValue());
            }
            List<Integer> correct = new ArrayList<>(
                    Optional.ofNullable(question.getCorrectAnswer()).orElse(Collections.emptyList()));
            Collections.sort(chosen);
            Collections.sort(correct);
            return chosen.equals(correct);
        }
        if (type == Question.Type.fill_in_blank) {
            // FIX #4: fill_in_blank must compare against the actual answer, not the
            // explanation field. Store the expected text answer in correctAnswerText on
            // the Question entity, or fall back to the first correctAnswer index cast to
            // a text representation. (explanation is for showing after the quiz only.)
            String expectedText = question.getCorrectAnswerText(); // preferred
            if (expectedText == null || expectedText.isBlank()) {
                // Fallback: join correctAnswer indices as a comma-separated string
                List<Integer> ca = question.getCorrectAnswer();
                expectedText = ca != null ? ca.stream().map(String::valueOf)
                        .reduce((a, b) -> a + "," + b).orElse("") : "";
            }
            String ans = String.valueOf(answerPayload).trim().toLowerCase();
            return ans.equals(expectedText.trim().toLowerCase());
        }
        return false;
    }

    /**
     * FIX-002: Mark stale ranked sessions as abandoned.
     * Called by scheduler every minute. Sessions with no activity for 2+ minutes are abandoned.
     * Unanswered questions deduct 5 energy each.
     */
    private static final int ENERGY_COST_PER_WRONG = 5;

    /**
     * FIX-002: Mark stale ranked sessions as abandoned and deduct energy.
     * Sessions with no activity for 2+ minutes: unanswered questions → -5 energy each.
     */
    @Transactional
    public int processAbandonedSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(2);
        List<QuizSession> staleSessions = quizSessionRepository.findAbandonedRankedSessions(cutoff);
        int count = 0;
        for (QuizSession session : staleSessions) {
            session.setStatus(QuizSession.Status.abandoned);
            session.setAbandonedAt(LocalDateTime.now());
            session.setEndedAt(LocalDateTime.now());
            quizSessionRepository.save(session);

            // Deduct energy for unanswered questions (ranked mode only)
            if (session.getMode() == QuizSession.Mode.ranked) {
                int totalQ = session.getTotalQuestions() != null ? session.getTotalQuestions() : 0;
                long answeredQ = answerRepository.countBySessionId(session.getId());
                int unanswered = (int) Math.max(0, totalQ - answeredQ);
                if (unanswered > 0) {
                    int energyPenalty = unanswered * ENERGY_COST_PER_WRONG;
                    deductEnergy(session.getOwner().getId(), energyPenalty);
                }
            }
            count++;
        }
        return count;
    }

    private void deductEnergy(String userId, int amount) {
        var today = java.time.LocalDate.now(java.time.ZoneOffset.UTC);
        userDailyProgressRepository.findByUserIdAndDate(userId, today).ifPresent(udp -> {
            int current = udp.getLivesRemaining() != null ? udp.getLivesRemaining() : 100;
            udp.setLivesRemaining(Math.max(0, current - amount));
            userDailyProgressRepository.save(udp);
        });
    }

    /**
     * Update last activity timestamp for a session (called on each answer submit).
     */
    public void touchSession(String sessionId) {
        quizSessionRepository.findById(sessionId).ifPresent(session -> {
            session.setLastActivityAt(LocalDateTime.now());
            quizSessionRepository.save(session);
        });
    }

    private Map<String, Object> toAnswerResult(Answer answer, Question q) {
        Map<String, Object> res = new HashMap<>();
        res.put("isCorrect", answer.getIsCorrect());
        res.put("correctAnswer", q.getCorrectAnswer());
        res.put("scoreDelta", answer.getScoreEarned());
        res.put("explanation", q.getExplanation());
        return res;
    }

}
