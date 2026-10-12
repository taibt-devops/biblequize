package com.biblequiz.modules.daily.service;

import com.biblequiz.modules.daily.entity.DailyCompletion;
import com.biblequiz.modules.daily.repository.DailyCompletionRepository;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.user.service.StreakService;
import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.infrastructure.time.GameClock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

/**
 * SPEC-v2 Daily Challenge: 5 fixed questions per day, same for all users.
 * Uses date as seed for deterministic question selection.
 * Guests can play (no auth required).
 */
@Service
public class DailyChallengeService {

    private static final Logger log = LoggerFactory.getLogger(DailyChallengeService.class);

    private static final int DAILY_QUESTION_COUNT = 5;
    // Daily Challenge XP by correct-count (DECISIONS.md 2026-06-16, supersedes the
    // flat +50 from 2026-04-20). Index = number correct (0..5). The curve
    // accelerates at 4 (+40) and 5 (+50) to reward perfect runs; there is NO
    // min-correct gate — XP is credited from the first correct answer. Kept local
    // (not app.yml) because it's a design invariant, not a tunable.
    private static final int[] DAILY_XP_BY_CORRECT = {0, 20, 40, 60, 100, 150};
    private static final String CACHE_KEY_PREFIX = "daily_challenge:";

    /**
     * XP earned for a daily completion given the number of correct answers.
     * Clamps {@code correctCount} into [0, {@value #DAILY_QUESTION_COUNT}] and
     * looks up {@link #DAILY_XP_BY_CORRECT}. This is the single source of truth
     * for daily reward — both the credited XP and the unified displayed score.
     */
    public int dailyXp(int correctCount) {
        int c = Math.max(0, Math.min(DAILY_QUESTION_COUNT, correctCount));
        return DAILY_XP_BY_CORRECT[c];
    }

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private CacheService cacheService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserDailyProgressRepository userDailyProgressRepository;

    @Autowired
    private StreakService streakService;

    @Autowired
    private DailyMissionService dailyMissionService;

    @Autowired
    private DailyCompletionRepository dailyCompletionRepository;

    /**
     * Get today's 5 challenge questions. Same questions for all users on the same day.
     */
    @SuppressWarnings("unchecked")
    public List<Question> getDailyQuestions(LocalDate date, String language) {
        if (date == null) {
            date = GameClock.today();
        }
        String lang = (language != null && !language.isBlank()) ? language : "vi";

        String cacheKey = CACHE_KEY_PREFIX + lang + ":" + date.toString();
        Optional<List> cached = cacheService.get(cacheKey, List.class);
        if (cached.isPresent()) {
            return cached.get();
        }

        // Use date-based seed + language for deterministic selection per language
        long seed = date.toEpochDay() * 31 + lang.hashCode();
        Random random = new Random(seed);

        long totalActive = questionRepository.countByLanguageAndIsActiveTrue(lang);
        if (totalActive == 0) {
            return List.of();
        }

        // Select DAILY_QUESTION_COUNT unique random questions
        Set<Integer> selectedIndices = new HashSet<>();
        int maxAttempts = DAILY_QUESTION_COUNT * 3;
        int attempts = 0;

        while (selectedIndices.size() < DAILY_QUESTION_COUNT && selectedIndices.size() < totalActive && attempts < maxAttempts) {
            selectedIndices.add(random.nextInt((int) totalActive));
            attempts++;
        }

        List<Question> questions = new ArrayList<>();
        for (int index : selectedIndices) {
            var page = questionRepository.findByLanguageAndIsActiveTrue(lang, PageRequest.of(index, 1));
            if (page.hasContent()) {
                questions.add(page.getContent().get(0));
            }
        }

        // Cache for 24 hours
        cacheService.put(cacheKey, questions, java.time.Duration.ofHours(24));

        return questions;
    }

    /**
     * Backward-compatible overload — defaults to "vi".
     */
    public List<Question> getDailyQuestions(LocalDate date) {
        return getDailyQuestions(date, "vi");
    }

    /**
     * Get today's daily questions (convenience method).
     */
    public List<Question> getTodayQuestions(String language) {
        return getDailyQuestions(GameClock.today(), language);
    }

    public List<Question> getTodayQuestions() {
        return getTodayQuestions("vi");
    }

    /**
     * Check if a user has completed today's challenge.
     */
    public boolean hasCompletedToday(String userId) {
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + GameClock.today();
        return cacheService.exists(key);
    }

    /**
     * Read the cached completion record for today and shape it into the
     * response payload the FeaturedDailyChallenge "completed" banner
     * needs. Returns {@code completed=false} when the user hasn't
     * finished today.
     *
     * <p>The cache value written by {@link #markCompleted} carries
     * {@code score / correct / total / completedAt}; this method
     * augments those with {@code xpEarned} and {@code nextResetAt} (UTC
     * midnight tomorrow ISO-8601 string for the countdown). Since the
     * 2026-06-16 rework, {@code score} and {@code xpEarned} are the same
     * number — the unified daily reward looked up from {@code correctCount}.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getResultData(String userId) {
        String dateStr = GameClock.today().toString();
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + dateStr;
        Optional<Map> cached = cacheService.get(key, Map.class);
        if (cached.isEmpty()) {
            return Map.of("completed", false);
        }
        Map<String, Object> payload = cached.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("completed", true);
        response.put("date", dateStr);
        Object correctRaw = payload.getOrDefault("correct", 0);
        int correctCount = correctRaw instanceof Number n ? n.intValue() : 0;
        // Recompute XP from correctCount (single source of truth) rather than
        // trusting the cached value — survives Redis JSON-roundtrip type drift
        // and any stale entry written before the scoring rework. score == xpEarned
        // (unified to one displayed number per DECISIONS.md 2026-06-16).
        int xp = dailyXp(correctCount);
        response.put("score", xp);
        response.put("correctCount", correctCount);
        response.put("totalQuestions", payload.getOrDefault("total", DAILY_QUESTION_COUNT));
        response.put("xpEarned", xp);
        response.put("completedAt", payload.get("completedAt"));
        // ISO-8601 instant — FE parses with new Date(...) for the countdown.
        // F-api-13: the reset moment is VN midnight (GameClock flips the day
        // there) — stamping the naive midnight as a UTC instant pushed the
        // countdown 7h late (07:00 VN).
        response.put("nextResetAt", GameClock.today()
                .plusDays(1).atStartOfDay(GameClock.GAME_ZONE).toInstant().toString());
        return response;
    }

    /**
     * Mark user as having completed today's challenge and credit +50 XP into
     * their {@link UserDailyProgress} row for the day.
     *
     * <p>Idempotency: the caller (DailyChallengeController.complete) already
     * guards with {@link #hasCompletedToday} before invoking this method, so
     * markCompleted runs at most once per user per day — the XP is credited
     * exactly once in sync with that guarantee.
     *
     * <p>See DECISIONS.md 2026-06-16 (supersedes 2026-04-20) for the scoring
     * curve: XP is looked up from {@code correctCount} via {@link #dailyXp}
     * (0/20/40/60/100/150). The client-supplied {@code score} is ignored —
     * XP/score are recomputed server-side from {@code correctCount} (bounded
     * [0,5] by the request DTO) so a tampered client cannot inflate the reward.
     */
    @Transactional
    public void markCompleted(String userId, int score, int correctCount) {
        String dateStr = GameClock.today().toString();
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + dateStr;
        // Server-side reward — ignore client `score`, derive from correctCount.
        int xp = dailyXp(correctCount);
        boolean xpEarned = xp > 0;
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("score", xp); // unified: score == XP earned
        result.put("correct", correctCount);
        result.put("total", DAILY_QUESTION_COUNT);
        result.put("completedAt", System.currentTimeMillis());
        result.put("xpEarned", xpEarned);
        cacheService.put(key, result, java.time.Duration.ofHours(48));

        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmail(userId))
                .orElse(null);
        if (user == null) {
            log.warn("Daily completion: user not found for id/email={}, skipping XP + streak", userId);
            return;
        }

        // Persist long-term completion record (Redis cache only keeps 48h —
        // not enough for 30-day heatmap or yesterday recap). Idempotent via
        // unique (user_id, date) constraint: re-completing the same day is a
        // no-op at the DB level.
        //
        // F-api-15: the DB row doubles as the XP idempotency guard. The
        // controller's hasCompletedToday check is Redis-only (48h key) — if
        // Redis is flushed mid-day, markCompleted runs again; without this
        // guard the +50 XP would be credited twice.
        boolean alreadyPersistedToday = false;
        try {
            LocalDate today = GameClock.today();
            if (dailyCompletionRepository.findByUserIdAndCompletionDate(user.getId(), today).isPresent()) {
                alreadyPersistedToday = true;
            } else {
                DailyCompletion completion = new DailyCompletion(
                        UUID.randomUUID().toString(), user, today,
                        xp, correctCount, DAILY_QUESTION_COUNT,
                        null, LocalDateTime.now(ZoneOffset.UTC));
                dailyCompletionRepository.save(completion);
            }
        } catch (RuntimeException ex) {
            log.warn("Daily completion: persist failed for user {} ({}). " +
                    "Cache + XP path unaffected; history row missing for today.",
                    user.getId(), ex.getMessage());
        }

        if (xpEarned && alreadyPersistedToday) {
            log.info("Daily completion: user={} already has today's completion row — XP not re-credited", userId);
        } else if (xpEarned) {
            creditCompletionXp(user, xp);
        } else {
            log.info("Daily completion: user={} scored {}/{} correct — 0 correct, no XP credited",
                    userId, correctCount, DAILY_QUESTION_COUNT);
        }

        // Daily completion extends streak (idempotent: StreakService skips
        // when lastPlayedAt is today). See DECISIONS.md "Daily extends streak".
        try {
            streakService.recordActivity(user);
        } catch (RuntimeException ex) {
            log.warn("Daily completion: streak update failed for user {} ({}). " +
                    "Cache + XP already credited; streak skipped.", user.getId(), ex.getMessage());
        }

        // Mark "complete_daily_challenge" mission as done.
        try {
            dailyMissionService.trackProgress(user.getId(), "complete_daily_challenge", 1);
            dailyMissionService.onEvent(user.getId(), "play_any_mode");
        } catch (RuntimeException ex) {
            log.warn("Daily completion: mission tracking failed for user {} ({}). " +
                    "Cache + XP already credited; mission skipped.", user.getId(), ex.getMessage());
        }
    }

    /**
     * Adds {@code xp} (from {@link #dailyXp}) to the user's
     * {@link UserDailyProgress} row. Matches the shape of
     * {@code SessionService#creditNonRankedProgress} — same UDP lookup,
     * same "create fresh if absent with 100 energy" initializer — so the
     * two XP paths (Ranked sync-progress, Daily completion) feed one
     * canonical per-day points ledger.
     */
    private void creditCompletionXp(User user, int xp) {
        LocalDate today = GameClock.today();
        UserDailyProgress udp = userDailyProgressRepository
                .findByUserIdAndDate(user.getId(), today)
                .orElseGet(() -> {
                    UserDailyProgress fresh = new UserDailyProgress(
                            UUID.randomUUID().toString(), user, today);
                    fresh.setLivesRemaining(100);
                    fresh.setPointsCounted(0);
                    fresh.setQuestionsCounted(0);
                    return fresh;
                });
        int before = Optional.ofNullable(udp.getPointsCounted()).orElse(0);
        udp.setPointsCounted(before + xp);
        userDailyProgressRepository.save(udp);

        // LBW-4: Daily Challenge XP changes the user's daily / weekly /
        // season / all-time totals; drop the cached slices so the FE
        // doesn't show a stale rank for the next 60s.
        cacheService.invalidateLeaderboards();

        log.info("Daily completion XP: user={} +{} XP (pointsCounted {}→{})",
                user.getId(), xp, before, before + xp);
    }

    public int getDailyQuestionCount() {
        return DAILY_QUESTION_COUNT;
    }

    /**
     * Resolve the user identifier (which may be email when authenticated via
     * OAuth) into the canonical UUID used as user_id in DB rows.
     */
    private Optional<String> resolveUserId(String userIdOrEmail) {
        return userRepository.findById(userIdOrEmail)
                .or(() -> userRepository.findByEmail(userIdOrEmail))
                .map(User::getId);
    }

    /**
     * Per-day completion history for the heatmap (default 30 days). Includes
     * "missing" days as {@code completed:false} so the frontend can render
     * a stable 30-cell grid without gaps.
     */
    public List<Map<String, Object>> getHistory(String userIdOrEmail, int days) {
        int safeDays = Math.max(1, Math.min(90, days));
        LocalDate today = GameClock.today();
        LocalDate start = today.minusDays(safeDays - 1L);

        Optional<String> uid = resolveUserId(userIdOrEmail);
        Map<LocalDate, DailyCompletion> byDate = uid.map(id ->
                dailyCompletionRepository.findByUserIdAndDateRange(id, start, today))
                .orElseGet(List::of)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        DailyCompletion::getCompletionDate, dc -> dc, (a, b) -> a));

        List<Map<String, Object>> result = new ArrayList<>(safeDays);
        for (int i = 0; i < safeDays; i++) {
            LocalDate d = start.plusDays(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", d.toString());
            DailyCompletion dc = byDate.get(d);
            if (dc != null) {
                entry.put("completed", true);
                entry.put("correctCount", dc.getCorrectCount());
                entry.put("totalQuestions", dc.getTotalQuestions());
            } else {
                entry.put("completed", false);
                entry.put("correctCount", 0);
                entry.put("totalQuestions", DAILY_QUESTION_COUNT);
            }
            result.add(entry);
        }
        return result;
    }

    /**
     * Yesterday recap shown in the State A hero card. Returns
     * {@code completed:false} when the user did not finish yesterday — the
     * frontend hides the recap block in that case (per design spec).
     */
    public Map<String, Object> getYesterdaySummary(String userIdOrEmail) {
        LocalDate yesterday = GameClock.today().minusDays(1);
        Optional<String> uid = resolveUserId(userIdOrEmail);
        if (uid.isEmpty()) {
            return Map.of("completed", false);
        }
        Optional<DailyCompletion> opt = dailyCompletionRepository
                .findByUserIdAndCompletionDate(uid.get(), yesterday);
        if (opt.isEmpty()) {
            return Map.of("completed", false);
        }
        DailyCompletion dc = opt.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("completed", true);
        response.put("date", yesterday.toString());
        response.put("correctCount", dc.getCorrectCount());
        response.put("totalQuestions", dc.getTotalQuestions());
        response.put("score", dc.getScore());
        response.put("timeSeconds", dc.getTimeSeconds());
        return response;
    }

    /**
     * Check a single answer for a daily challenge question.
     * Returns isCorrect, correctAnswer indices, and explanation.
     * Used by the dedicated /api/daily-challenge/answer endpoint so the
     * frontend does not need a real QuizSession (daily sessions are
     * client-side tracking IDs only).
     *
     * <p>When {@code userIdOrEmail} is non-null, also wires the answer into
     * the daily-mission tracker (answer_correct + answer_combo). Guest
     * answers (userIdOrEmail=null) skip tracking. Mission failures are
     * swallowed so they never break the answer-check response.
     */
    public Map<String, Object> checkAnswer(String questionId, int selectedAnswer, String userIdOrEmail) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
        // Chỉ chấm câu của Thử thách ngày (hôm nay, hoặc hôm qua cho người làm dở qua nửa đêm) — không
        // thành chỗ tra đáp án cho câu đang chạy ở Phòng chơi (QUESTION_START mang id câu).
        if (!inDailySet(questionId, question.getLanguage())) {
            throw new IllegalArgumentException("Câu này không thuộc Thử thách hôm nay");
        }
        List<Integer> correctAnswer = question.getCorrectAnswer();
        boolean isCorrect = correctAnswer != null && correctAnswer.contains(selectedAnswer);

        if (userIdOrEmail != null) {
            resolveUserId(userIdOrEmail).ifPresent(uid -> {
                try {
                    // PCV-7: Thử thách ngày không đo thời gian → câu khó nhanh không tính ở đây.
                    dailyMissionService.onAnswer(uid, new DailyMissionService.AnswerEvent(
                            isCorrect, question.getDifficulty(), question.getBook(), 0));
                } catch (RuntimeException ex) {
                    log.warn("Daily mission tracking failed for user {} ({}). Answer flow unaffected.",
                            uid, ex.getMessage());
                }
            });
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isCorrect", isCorrect);
        result.put("correctAnswer", correctAnswer != null ? correctAnswer : List.of());
        result.put("explanation", question.getExplanation());
        return result;
    }

    private boolean inDailySet(String questionId, String language) {
        String lang = language != null && !language.isBlank() ? language : "vi";
        LocalDate today = GameClock.today();
        return containsId(getDailyQuestions(today, lang), questionId)
                || containsId(getDailyQuestions(today.minusDays(1), lang), questionId);
    }

    /** Bộ câu lấy từ cache có thể về dạng Map (Jackson) thay vì Question. */
    private static boolean containsId(List<?> questions, String questionId) {
        for (Object o : questions) {
            Object id = o instanceof Question q ? q.getId() : o instanceof Map<?, ?> m ? m.get("id") : null;
            if (questionId.equals(id)) return true;
        }
        return false;
    }
}
