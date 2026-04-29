package com.biblequiz.modules.daily.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.user.service.StreakService;
import com.biblequiz.infrastructure.service.CacheService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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
    // See DECISIONS.md 2026-04-20 "Daily Challenge as secondary XP path".
    // Kept local (not app.yml) because it's a design invariant, not a tunable.
    private static final int DAILY_COMPLETION_XP = 50;
    private static final String CACHE_KEY_PREFIX = "daily_challenge:";

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

    /**
     * Get today's 5 challenge questions. Same questions for all users on the same day.
     */
    @SuppressWarnings("unchecked")
    public List<Question> getDailyQuestions(LocalDate date, String language) {
        if (date == null) {
            date = LocalDate.now(ZoneOffset.UTC);
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
        return getDailyQuestions(LocalDate.now(ZoneOffset.UTC), language);
    }

    public List<Question> getTodayQuestions() {
        return getTodayQuestions("vi");
    }

    /**
     * Check if a user has completed today's challenge.
     */
    public boolean hasCompletedToday(String userId) {
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + LocalDate.now(ZoneOffset.UTC);
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
     * augments those with the constants the FE would otherwise have to
     * hardcode: {@code xpEarned} (the +50 XP that was credited) and
     * {@code nextResetAt} (UTC midnight tomorrow ISO-8601 string for the
     * countdown).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getResultData(String userId) {
        String dateStr = LocalDate.now(ZoneOffset.UTC).toString();
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + dateStr;
        Optional<Map> cached = cacheService.get(key, Map.class);
        if (cached.isEmpty()) {
            return Map.of("completed", false);
        }
        Map<String, Object> payload = cached.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("completed", true);
        response.put("date", dateStr);
        response.put("score", payload.getOrDefault("score", 0));
        response.put("correctCount", payload.getOrDefault("correct", 0));
        response.put("totalQuestions", payload.getOrDefault("total", DAILY_QUESTION_COUNT));
        response.put("xpEarned", DAILY_COMPLETION_XP);
        response.put("completedAt", payload.get("completedAt"));
        // ISO-8601 instant — FE parses with new Date(...) for the countdown.
        response.put("nextResetAt", LocalDate.now(ZoneOffset.UTC)
                .plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).toString());
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
     * <p>See DECISIONS.md 2026-04-20 "Daily Challenge as secondary XP path"
     * for why +50 XP: 20 consecutive Dailies = 1,000 XP = Tier-2 unlock,
     * giving users who can't hit the 80%/10-answer early-unlock a
     * retention-driven progression loop.
     */
    @Transactional
    public void markCompleted(String userId, int score, int correctCount) {
        String dateStr = LocalDate.now(ZoneOffset.UTC).toString();
        String key = CACHE_KEY_PREFIX + "completed:" + userId + ":" + dateStr;
        Map<String, Object> result = Map.of(
                "score", score,
                "correct", correctCount,
                "total", DAILY_QUESTION_COUNT,
                "completedAt", System.currentTimeMillis());
        cacheService.put(key, result, java.time.Duration.ofHours(48));

        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByEmail(userId))
                .orElse(null);
        if (user == null) {
            log.warn("Daily completion: user not found for id/email={}, skipping XP + streak", userId);
            return;
        }

        creditCompletionXp(user);

        // Daily completion extends streak (idempotent: StreakService skips
        // when lastPlayedAt is today). See DECISIONS.md "Daily extends streak".
        try {
            streakService.recordActivity(user);
        } catch (RuntimeException ex) {
            log.warn("Daily completion: streak update failed for user {} ({}). " +
                    "Cache + XP already credited; streak skipped.", user.getId(), ex.getMessage());
        }
    }

    /**
     * Adds {@value #DAILY_COMPLETION_XP} XP to the user's
     * {@link UserDailyProgress} row. Matches the shape of
     * {@code SessionService#creditNonRankedProgress} — same UDP lookup,
     * same "create fresh if absent with 100 energy" initializer — so the
     * two XP paths (Ranked sync-progress, Daily completion) feed one
     * canonical per-day points ledger.
     */
    private void creditCompletionXp(User user) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
        udp.setPointsCounted(before + DAILY_COMPLETION_XP);
        userDailyProgressRepository.save(udp);

        log.info("Daily completion XP: user={} +{} XP (pointsCounted {}→{})",
                user.getId(), DAILY_COMPLETION_XP, before, before + DAILY_COMPLETION_XP);
    }

    public int getDailyQuestionCount() {
        return DAILY_QUESTION_COUNT;
    }
}
