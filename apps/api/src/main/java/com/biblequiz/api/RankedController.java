package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserBookProgress;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.entity.UserQuestionHistory;
import com.biblequiz.modules.quiz.repository.UserBookProgressRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import com.biblequiz.modules.quiz.service.BookProgressionService;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.biblequiz.modules.ranked.service.RankedBookPool;
import com.biblequiz.modules.ranked.service.RankedSessionService;
import com.biblequiz.modules.ranked.service.RankedSessionService.Progress;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.biblequiz.infrastructure.time.GameClock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class RankedController {

    private static final Logger log = LoggerFactory.getLogger(RankedController.class);

    @Autowired
    private RankedSessionService rankedSessionService;

    @Autowired
    private UserDailyProgressRepository udpRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookProgressionService bookProgressionService;

    @Autowired
    private com.biblequiz.modules.ranked.service.GameModeUnlockConfig gameModeUnlockConfig;

    @Autowired
    private UserBookProgressRepository userBookProgressRepository;

    @Autowired
    private com.biblequiz.modules.quiz.repository.QuestionRepository questionRepository;

    @Autowired
    private com.biblequiz.modules.quiz.repository.AnswerRepository answerRepository;

    @Autowired
    private com.biblequiz.infrastructure.service.CacheService cacheService;

    @Autowired
    private com.biblequiz.modules.season.service.SeasonService seasonService;

    @Autowired
    private com.biblequiz.modules.group.repository.GroupMemberRepository groupMemberRepository;

    @Autowired
    private com.biblequiz.modules.season.repository.SeasonRankingRepository seasonRankingRepository;

    @Autowired
    private com.biblequiz.modules.achievement.service.AchievementService achievementService;

    @Autowired
    private com.biblequiz.modules.ranked.service.ScoringService scoringService;

    @Autowired
    private com.biblequiz.modules.ranked.service.UserTierService userTierService;

    @Autowired
    private SmartQuestionSelector smartQuestionSelector;

    @Autowired
    private UserQuestionHistoryRepository userQuestionHistoryRepository;

    @Autowired
    private com.biblequiz.modules.season.service.LiturgicalSeasonService liturgicalSeasonService;

    @Autowired
    private com.biblequiz.infrastructure.feature.FeatureFlagService featureFlagService;

    @Autowired
    private com.biblequiz.modules.coverage.service.LiturgicalCoverageService liturgicalCoverageService;

    @Autowired
    private com.biblequiz.modules.coverage.service.CoverageAnalytics coverageAnalytics;

    /** Optional — kept off the required graph so @WebMvcTest slices don't need to mock it.
     *  Mission tracking is best-effort and must never break the ranked answer response. */
    @Autowired(required = false)
    private com.biblequiz.modules.quiz.service.DailyMissionService dailyMissionService;

    @Autowired
    private com.biblequiz.modules.notification.service.NotificationService notificationService;

    private String resolveEmail(Authentication authentication) {
        if (authentication == null)
            return null;
        try {
            Object principal = authentication.getPrincipal();
            if (principal instanceof OAuth2User oAuth2User) {
                Object emailAttr = oAuth2User.getAttributes().get("email");
                if (emailAttr != null)
                    return emailAttr.toString();
            }
        } catch (Exception ignore) {
        }
        return authentication.getName();
    }

    // SPEC-v2: Energy system (100/day, -5 per wrong, regen 20/hr)
    private static final int MAX_ENERGY = 100;
    private static final int ENERGY_REGEN_PER_HOUR = 20;
    private static final int ENERGY_COST_WRONG = 5;
    private static final int DAILY_QUESTION_CAP = 100;
    // BL-26 A1: Ranked uses a flat 90s/question timer (policy 2026-05-20). The
    // speed bonus window must match it, not the legacy 30s ScoringService const.
    private static final int RANKED_TIMER_MS = 90_000;
    // RWP-2: how many recently-seen questions to exclude from the whole-pool draw
    // (cross-day repeat avoidance). 80 << pool size (~3.3k) so never starves.
    private static final int RANKED_RECENT_EXCLUDE = 80;
    // A book counts as "sampled" (journey collection + scholar achievement) once
    // the user has answered ~25% of its DISTINCT questions — proportional so
    // rich/central books (Psalms, the Gospels) take longer than short epistles.
    // Clamped to [12, 40] so no book is a glance or a slog, and never more than
    // the book actually has. See rankedBookSampleTarget().
    private static final double RANKED_BOOK_SAMPLE_RATIO = 0.25;
    private static final int RANKED_BOOK_SAMPLE_FLOOR = 12;
    private static final int RANKED_BOOK_SAMPLE_CAP = 40;

    /** # of DISTINCT answers in a book before it counts as sampled.
     *  {@code clamp(round(bookTotal × 0.25), 12, 40)}, never exceeding bookTotal. */
    static int rankedBookSampleTarget(long bookTotal) {
        if (bookTotal <= 0) return RANKED_BOOK_SAMPLE_FLOOR;
        int proportional = (int) Math.round(bookTotal * RANKED_BOOK_SAMPLE_RATIO);
        int clamped = Math.max(RANKED_BOOK_SAMPLE_FLOOR, Math.min(RANKED_BOOK_SAMPLE_CAP, proportional));
        return (int) Math.min(clamped, bookTotal);
    }

    /** Books the user has sampled in Ranked, in any order (scholar achievement). */
    private int countBooksSampled(String userId, String language) {
        List<UserBookProgress> rows = userBookProgressRepository.findAllByUserId(userId);
        if (rows == null || rows.isEmpty()) return 0;
        Map<String, Long> totals = new HashMap<>();
        for (Object[] row : questionRepository.countActiveByBook(language)) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] instanceof Number n)
                totals.put(row[0].toString(), n.longValue());
        }
        int sampled = 0;
        for (UserBookProgress ubp : rows) {
            Long total = totals.get(ubp.getBook());
            Integer answered = ubp.getAnsweredCount();
            if (total != null && answered != null && answered >= rankedBookSampleTarget(total))
                sampled++;
        }
        return sampled;
    }

    /**
     * Read the season-leaderboard score at rank N with a 60s Redis cache.
     * The threshold is shared across all callers so caching once per
     * (season, rank) saves a DB roundtrip per /api/me/ranked-status hit
     * after the first one inside the cache window.
     *
     * <p>Returns null when the leaderboard has fewer than {@code rank}
     * users with a SeasonRanking row. Negative results are NOT cached so
     * the call can pick up a freshly-eligible Nth user immediately.
     */
    private Integer getCachedSeasonScoreAtRank(String seasonId, int rank) {
        String cacheKey = com.biblequiz.infrastructure.service.CacheService.LEADERBOARD_CACHE_PREFIX
                + "thresholds:top-" + rank + ":season-" + seasonId;
        java.util.Optional<Integer> cached = cacheService.get(cacheKey, Integer.class);
        if (cached.isPresent()) return cached.get();
        Integer dbValue = seasonRankingRepository
                .findScoreAtRankOffset(seasonId, rank - 1)
                .orElse(null);
        if (dbValue != null) {
            cacheService.put(cacheKey, dbValue, java.time.Duration.ofSeconds(60));
        }
        return dbValue;
    }

    /**
     * Recovers energy based on elapsed time since lastUpdatedAt.
     * SPEC-v2: +20 energy per hour, capped at MAX_ENERGY (100).
     */
    private int recoverEnergy(int currentEnergy, LocalDateTime lastUpdatedAt) {
        if (lastUpdatedAt == null || currentEnergy >= MAX_ENERGY) {
            return currentEnergy;
        }
        long minutesElapsed = java.time.Duration.between(lastUpdatedAt, LocalDateTime.now(ZoneOffset.UTC)).toMinutes();
        int recovered = (int) (minutesElapsed * ENERGY_REGEN_PER_HOUR / 60);
        if (recovered > 0) {
            return Math.min(MAX_ENERGY, currentEnergy + recovered);
        }
        return currentEnergy;
    }

    @PostMapping("/ranked/sessions")
    public ResponseEntity<Map<String, Object>> startRankedSession(Authentication authentication) {
        Map<String, Object> body = new HashMap<>();
        String sessionId = "ranked-" + System.currentTimeMillis();

        Progress p = new Progress();
        p.date = GameClock.today().toString();

        // Sync with database progress if user is authenticated
        if (authentication != null) {
            String username = resolveEmail(authentication);
            User user = username != null ? userRepository.findByEmail(username).orElse(null) : null;
            if (user != null) {
                UserDailyProgress udp = udpRepository.findByUserIdAndDate(user.getId(), LocalDate.parse(p.date))
                        .orElse(null);
                if (udp != null) {
                    p.livesRemaining = udp.getLivesRemaining() != null
                            ? Math.max(0, Math.min(MAX_ENERGY, udp.getLivesRemaining()))
                            : MAX_ENERGY;
                    p.questionsCounted = udp.getQuestionsCounted() != null ? Math.min(udp.getQuestionsCounted(), DAILY_QUESTION_CAP)
                            : 0;
                    p.pointsToday = udp.getPointsCounted() != null ? udp.getPointsCounted() : 0;
                    p.currentBook = udp.getCurrentBook() != null ? udp.getCurrentBook() : "Genesis";
                }
            }
        }

        // Initialize book progression tracking
        BookProgressionService.BookProgress bookProgress = bookProgressionService.getBookProgress(p.currentBook);
        p.currentBookIndex = bookProgress.currentIndex - 1; // Convert to 0-based index

        // Stamp ownership so /answer can reject cross-user posts (SCD-6).
        if (authentication != null) {
            String email = resolveEmail(authentication);
            User owner = email != null ? userRepository.findByEmail(email).orElse(null) : null;
            if (owner != null) p.userId = owner.getId();
        }
        rankedSessionService.save(sessionId, p);
        body.put("sessionId", sessionId);
        body.put("currentBook", p.currentBook);
        body.put("bookProgress", bookProgress);

        return ResponseEntity.ok(body);
    }

    /**
     * Tier-aware question select for Ranked (BL-20 / RANK-CATCHUP-1, 2026-05-20).
     *
     * Replaces the previous FE pattern in Ranked.tsx that issued 3 manual
     * /api/questions calls (filtered → book-only → any-book) — that flow
     * skipped {@link SmartQuestionSelector} entirely so the SPEC §3.2
     * tier-based difficulty distribution (70/25/5 for T1 down to 5/35/60
     * for T6) was never applied to Ranked.
     *
     * <p>Body: {@code { limit:10, excludeIds:[], difficulty?, language? }}. A
     * {@code book} field from older clients is ignored (2026-10-08: no more
     * sequential journey book). Resolves the caller's tier from
     * {@code userTierService}; the tier opens the book rings of
     * {@link RankedBookPool} (familiar books first, the whole Bible from tier 5),
     * and {@code smartQuestionSelector.selectQuestions(userId, ..)} applies the
     * tier Easy/Medium/Hard mix + history-aware ordering (unseen → review →
     * long-ago → recent) inside the ring. At most {@link RankedBookPool#MAX_PER_BOOK}
     * questions per book; a short ring widens to the next one. Post-filters by
     * {@code excludeIds} (today's already-asked set in
     * UserDailyProgress.askedQuestionIds) plus the recently-seen ids.
     *
     * <p>Guest fallback: when there's no authenticated user, falls back to
     * the legacy uniform random pool via {@code QuestionRepository} so
     * landing-page demos still work.
     */
    @PostMapping("/ranked/questions/select")
    public ResponseEntity<Map<String, Object>> selectRankedQuestions(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication) {
        Map<String, Object> req = body != null ? body : new HashMap<>();
        int limit = req.get("limit") instanceof Number n ? n.intValue() : 10;
        if (limit <= 0 || limit > 50) limit = 10;
        String difficulty = stringOrNull(req.get("difficulty"));
        String language = stringOrNull(req.get("language"));
        if (language == null || language.isBlank()) language = "vi";

        Set<String> excludeSet = new HashSet<>();
        Object excludeRaw = req.get("excludeIds");
        if (excludeRaw instanceof List<?> rawList) {
            for (Object o : rawList) {
                if (o != null) excludeSet.add(o.toString());
            }
        }

        String userId = null;
        if (authentication != null) {
            String email = resolveEmail(authentication);
            if (email != null) {
                User user = userRepository.findByEmail(email).orElse(null);
                if (user != null) userId = user.getId();
            }
        }

        // §7 Liturgical Coverage path: override book filter with week's active pool.
        // Gated by feature flag → same rollout audience as ×1.5 bonus + coverage UI.
        List<String> coverageBooks = null;
        if (userId != null && featureFlagService.isLiturgicalCoverageEnabled(userId)) {
            coverageBooks = resolveCoverageWeekBooks(userId, language);
        }

        // RWP-2 (2026-06-24): cross-day repeat avoidance. The legacy excludeSet
        // only carried today's asked ids (UTC), so across days the whole-pool
        // draw could re-serve a question seen a day or two ago. Augment with the
        // user's most-recently-seen ids from UserQuestionHistory. Only on the
        // whole-pool (non-coverage) path — coverage manages its own pool.
        if (coverageBooks == null && userId != null) {
            try {
                excludeSet.addAll(userQuestionHistoryRepository.findRecentSeenQuestionIds(
                        userId, org.springframework.data.domain.PageRequest.of(0, RANKED_RECENT_EXCLUDE)));
            } catch (Exception e) {
                log.warn("recent-seen exclude lookup failed (non-fatal): {}", e.getMessage());
            }
        }

        List<Question> picked;
        boolean poolExhausted = false;

        if (coverageBooks != null && userId != null) {
            // §7 Liturgical Coverage path — the week's active book pool.
            QuestionFilter filter = new QuestionFilter(coverageBooks,
                    (difficulty != null && !difficulty.isBlank() && !"all".equalsIgnoreCase(difficulty)) ? difficulty : null,
                    language);
            int overfetch = limit + excludeSet.size() + 5;
            picked = pickFromSelector(userId, overfetch, limit, filter, excludeSet);
            int week = currentWeekFor(userId);
            int tier = userTierService.getTierLevel(userId);
            if (picked.size() < limit) {
                // Fallback 1: drop same-day exclusion (allow repeats within day)
                coverageAnalytics.poolExhaustionFallback(userId, 1, week, tier, language);
                picked = pickFromSelector(userId, overfetch, limit, filter, java.util.Set.of());
            }
            if (picked.size() < limit && filter.difficulty() != null) {
                // Fallback 2: drop difficulty filter (mix tier distribution)
                coverageAnalytics.poolExhaustionFallback(userId, 2, week, tier, language);
                QuestionFilter noDiff = new QuestionFilter(coverageBooks, null, language);
                picked = pickFromSelector(userId, overfetch, limit, noDiff, java.util.Set.of());
            }
            if (picked.isEmpty()) {
                // Fallback 3: pool exhausted — signal client to unlock next week
                coverageAnalytics.poolExhaustionFallback(userId, 3, week, tier, language);
                poolExhausted = true;
            }
        } else if (userId != null) {
            // 2026-10-08: whole-Bible draw by familiarity ring (RankedBookPool)
            // instead of the sequential journey book. The tier opens the ring
            // (T1-2 familiar books, T3-4 + known books, T5-6 whole Bible); the
            // selector applies the tier Easy/Medium/Hard mix and history pools
            // inside it; at most MAX_PER_BOOK questions per book keep a match
            // varied. A ring too small to fill `limit` widens to the next one.
            String diffFilter = (difficulty != null && !difficulty.isBlank()
                    && !"all".equalsIgnoreCase(difficulty)) ? difficulty : null;
            int ring = RankedBookPool.ringForTier(userTierService.getTierLevel(userId));
            java.util.LinkedHashMap<String, Question> merged = new java.util.LinkedHashMap<>();
            Map<String, Integer> perBook = new HashMap<>();
            for (int r = ring; r <= RankedBookPool.WHOLE_BIBLE && merged.size() < limit; r++) {
                Set<String> exclude = new HashSet<>(excludeSet);
                exclude.addAll(merged.keySet());
                int wanted = limit - merged.size();
                QuestionFilter filter = new QuestionFilter(RankedBookPool.booksForRing(r), diffFilter, language);
                // Overfetch 4× so the per-book cap still leaves enough candidates.
                List<Question> candidates = smartQuestionSelector.selectQuestions(
                        userId, wanted * 4 + exclude.size() + 5, filter);
                for (Question q : RankedBookPool.varied(candidates, exclude, perBook, wanted,
                        RankedBookPool.MAX_PER_BOOK)) {
                    merged.putIfAbsent(q.getId(), q);
                }
            }
            picked = new java.util.ArrayList<>(merged.values());
        } else {
            // Guest path — uniform random, no history awareness. /ranked
            // is auth-gated by AppLayout but keep this branch defensive
            // so a stray unauthenticated call doesn't 500.
            List<Question> pool = new java.util.ArrayList<>(questionRepository.findAllActiveByLanguage(language));
            pool.removeIf(q -> q == null || q.getId() == null || excludeSet.contains(q.getId()));
            java.util.Collections.shuffle(pool);
            picked = pool.size() > limit ? pool.subList(0, limit) : pool;
        }

        // Map to plain objects — never serialize raw JPA entities. The selector
        // may hand back uninitialized Hibernate proxies (left in the persistence
        // context by UserQuestionHistory lookups) which Jackson cannot serialize
        // ("No serializer found for ... ByteBuddyInterceptor").
        List<Map<String, Object>> questionDtos = new java.util.ArrayList<>(picked.size());
        for (Question q : picked) {
            if (q != null) questionDtos.add(questionToMap(q));
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("questions", questionDtos);
        if (poolExhausted) {
            resp.put("poolExhausted", true);
            resp.put("suggestedAction", "UNLOCK_NEXT_WEEK");
        }
        return ResponseEntity.ok(resp);
    }

    /**
     * Resolve the user's current-week book pool for Liturgical Coverage path.
     * Returns null on any failure (caller falls back to legacy filter).
     */
    private List<String> resolveCoverageWeekBooks(String userId, String language) {
        try {
            var seasonOpt = liturgicalSeasonService.getCurrentSeason();
            if (seasonOpt.isEmpty()) return null;
            String seasonId = seasonOpt.get().getId();
            int tier = userTierService.getTierLevel(userId);
            var coverage = liturgicalCoverageService.getOrCreateCoverage(userId, seasonId, tier);
            List<String> active = liturgicalCoverageService.getActivePool(coverage, seasonId);
            return active == null || active.isEmpty() ? null : active;
        } catch (Exception e) {
            log.warn("Failed to resolve coverage week books for user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    private int currentWeekFor(String userId) {
        try {
            var seasonOpt = liturgicalSeasonService.getCurrentSeason();
            if (seasonOpt.isEmpty()) return 0;
            return liturgicalCoverageService
                    .getOrCreateCoverage(userId, seasonOpt.get().getId(),
                            userTierService.getTierLevel(userId))
                    .getCurrentWeek();
        } catch (Exception e) {
            return 0;
        }
    }

    private List<Question> pickFromSelector(String userId, int overfetch, int limit,
                                             QuestionFilter filter, Set<String> excludeSet) {
        List<Question> candidates = smartQuestionSelector.selectQuestions(userId, overfetch, filter);
        List<Question> picked = new java.util.ArrayList<>();
        for (Question q : candidates) {
            if (q == null || q.getId() == null) continue;
            if (excludeSet.contains(q.getId())) continue;
            picked.add(q);
            if (picked.size() >= limit) break;
        }
        return picked;
    }

    /** Serialize a Question entity (possibly a Hibernate proxy) to a plain map. */
    private static Map<String, Object> questionToMap(Question q) {
        Question e = (Question) org.hibernate.Hibernate.unproxy(q);
        Map<String, Object> m = new HashMap<>();
        m.put("id", e.getId());
        m.put("book", e.getBook());
        m.put("chapter", e.getChapter());
        m.put("verseStart", e.getVerseStart());
        m.put("verseEnd", e.getVerseEnd());
        m.put("difficulty", e.getDifficulty() != null ? e.getDifficulty().name() : null);
        m.put("type", e.getType() != null ? e.getType().name() : null);
        m.put("content", e.getContent());
        m.put("options", e.getOptions());
        m.put("correctAnswer", e.getCorrectAnswer());
        m.put("explanation", e.getExplanation());
        m.put("correctAnswerText", e.getCorrectAnswerText());
        return m;
    }

    private static String stringOrNull(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    @RequestMapping(value = "/ranked/sessions/{id}/answer", method = RequestMethod.POST)
    public ResponseEntity<Map<String, Object>> submitRankedAnswer(
            @PathVariable("id") String sessionId,
            @RequestBody Map<String, Object> payload,
            Authentication authentication) {
        try {
            log.debug("submitRankedAnswer called with sessionId: {}", sessionId);

            // Enforce daily caps and compute scoring — server-side validation only
            String questionId = payload.get("questionId") != null ? payload.get("questionId").toString() : null;
            com.biblequiz.modules.quiz.entity.Question currentQ = questionId != null
                    ? questionRepository.findById(questionId).orElse(null) : null;

            boolean isCorrect = false;
            if (currentQ != null && payload.containsKey("answer")) {
                Object answerObj = payload.get("answer");
                if (currentQ.getType() == com.biblequiz.modules.quiz.entity.Question.Type.multiple_choice_single) {
                    isCorrect = scoringService.validateMultipleChoiceSingle(currentQ, answerObj);
                } else if (currentQ.getType() == com.biblequiz.modules.quiz.entity.Question.Type.fill_in_blank) {
                    isCorrect = scoringService.validateFillInBlank(currentQ, answerObj);
                }
            }
            int clientElapsedMs = 0;
            try {
                clientElapsedMs = payload.get("clientElapsedMs") instanceof Number
                        ? ((Number) payload.get("clientElapsedMs")).intValue()
                        : 0;
            } catch (Exception ignore) {
            }
            Progress p = rankedSessionService.getOrCreate(sessionId);

            // SCD-6 — cross-user ownership check. Legacy sessions with null
            // userId (created before the field existed) bypass for back-compat.
            if (p.userId != null && authentication != null) {
                String authEmail = resolveEmail(authentication);
                User authUser = authEmail != null ? userRepository.findByEmail(authEmail).orElse(null) : null;
                if (authUser == null || !p.userId.equals(authUser.getId())) {
                    return ResponseEntity.status(403).body(Map.of(
                            "error", "SESSION_OWNERSHIP",
                            "message", "Session belongs to a different user"));
                }
            }

            // Recover lives based on time elapsed since last activity
            try {
                String email = resolveEmail(authentication);
                if (email != null) {
                    User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
                    if (user != null) {
                        UserDailyProgress udp = udpRepository.findByUserIdAndDate(user.getId(), GameClock.today()).orElse(null);
                        if (udp != null && udp.getLastUpdatedAt() != null) {
                            p.livesRemaining = recoverEnergy(p.livesRemaining, udp.getLastUpdatedAt());
                        }
                    }
                }
            } catch (Exception ignore) {
            }

            if (p.questionsCounted >= DAILY_QUESTION_CAP || p.livesRemaining <= 0) {
                Map<String, Object> resp = new HashMap<>();
                resp.put("sessionId", sessionId);
                resp.put("livesRemaining", p.livesRemaining);
                resp.put("questionsCounted", p.questionsCounted);
                resp.put("pointsToday", p.pointsToday);
                resp.put("blocked", true);
                return ResponseEntity.ok(resp);
            }
            if (!isCorrect) {
                p.livesRemaining = Math.max(0, p.livesRemaining - ENERGY_COST_WRONG);
                p.currentStreak = 0;
            }
            p.questionsCounted = Math.min(DAILY_QUESTION_CAP, p.questionsCounted + 1);
            // BL-26 B: count this answer toward the per-match accuracy bonus.
            p.matchTotal += 1;

            // Update book-specific progress
            p.questionsInCurrentBook += 1;
            int earned = 0;

            if (isCorrect) {
                p.correctAnswersInCurrentBook += 1;
                p.currentStreak += 1;

                // BL-3 (wired 2026-05-13): per SPEC_USER §4.6 the canonical formula is
                //   final = base × tier.xpMultiplier × (surge ? 1.5 : 1)
                // Tier 1 → 1.0×, tier 2 → 1.1×, …, tier 6 → 2.0× (TierRewardsConfig).
                // Surge activates when admin sets User.xpSurgeUntil > now (V24 migration,
                // SPEC_ADMIN §622 xpSurgeHoursFromNow). Unauthenticated callers fall back
                // to tier 1 without surge — same effective scoring as before.
                int tierLevel = 1;
                boolean xpSurgeActive = false;
                String resolvedUserId = null;
                try {
                    String email = resolveEmail(authentication);
                    User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
                    if (user != null) {
                        resolvedUserId = user.getId();
                        tierLevel = userTierService.getTierLevel(user.getId());
                        xpSurgeActive = user.getXpSurgeUntil() != null
                                && user.getXpSurgeUntil().isAfter(LocalDateTime.now());
                    }
                } catch (Exception ignore) {
                }

                // §7.10.3 ×1.5 liturgical season focus bonus, gated by feature flag.
                // Same rollout audience as Liturgical Coverage so behavior stays consistent.
                boolean isInSeasonBook = false;
                if (currentQ != null && currentQ.getBook() != null
                        && featureFlagService.isLiturgicalCoverageEnabled(resolvedUserId)) {
                    isInSeasonBook = liturgicalSeasonService
                            .isInSeasonFocus(GameClock.today(), currentQ.getBook());
                }

                // BL-26 (LOCKED 2026-06-22): new additive Ranked formula.
                //  - dailyFirst (A2/P2): first scoring answer today → ×2. pointsToday
                //    is still the pre-answer accumulation here (added below), so == 0
                //    means no points earned yet today.
                //  - comeback (D3): previous answer this session was wrong → +0.2.
                //  - speed bonus over the real 90s Ranked timer (A1/P1).
                boolean dailyFirst = p.pointsToday == 0;
                boolean comebackActive = p.lastAnswerWrong;
                com.biblequiz.modules.ranked.service.ScoringService.ScoreResult score =
                        scoringService.calculateRanked(
                                currentQ != null ? currentQ.getDifficulty() : null,
                                clientElapsedMs, RANKED_TIMER_MS, p.currentStreak, dailyFirst,
                                tierLevel, xpSurgeActive, isInSeasonBook, comebackActive);
                earned = score.earned;
                p.pointsToday += earned;
                // BL-26 B: accumulate match correctness + base earned for the
                // end-of-match accuracy bonus (% of matchEarned).
                p.matchCorrect += 1;
                p.matchEarned += earned;

                // SPEC-v2: energy system — no streak lives bonus (regen handles recovery)
            } else {
                p.currentStreak = 0;
            }
            // BL-26 D3: record this answer's correctness for the next question's
            // comeback check (runs on both correct and wrong paths).
            p.lastAnswerWrong = !isCorrect;

            log.debug("Points: earned={} total={} streak={}", earned, p.pointsToday, p.currentStreak);

            // §7.1.4 Liturgical Coverage tick (gated by feature flag).
            // Increments UserSeasonCoverage; the per-book collection below is
            // written either way.
            com.biblequiz.modules.coverage.service.LiturgicalCoverageService.WeekCompletionResult
                    weekResult = null;
            try {
                String email = resolveEmail(authentication);
                User userForCoverage = email != null ? userRepository.findByEmail(email).orElse(null) : null;
                if (userForCoverage != null
                        && featureFlagService.isLiturgicalCoverageEnabled(userForCoverage.getId())
                        && currentQ != null && currentQ.getBook() != null) {
                    var seasonOpt = liturgicalSeasonService.getCurrentSeason();
                    if (seasonOpt.isPresent()) {
                        int tier = userTierService.getTierLevel(userForCoverage.getId());
                        // Ensure record exists before tick (lazy-create)
                        liturgicalCoverageService.getOrCreateCoverage(
                                userForCoverage.getId(), seasonOpt.get().getId(), tier);
                        weekResult = liturgicalCoverageService.tickBookCoverage(
                                userForCoverage.getId(), seasonOpt.get().getId(),
                                currentQ.getBook(), tier);
                    }
                }
            } catch (Exception coverageErr) {
                log.warn("Coverage tick failed (non-fatal): {}", coverageErr.getMessage());
            }

            // 2026-10-08: currentBook no longer drives question selection and no
            // longer advances; it stays in the progress/status payloads only for
            // older clients. Books are collected per answered question below.

            // Persist to DB per user/day if authenticated
            try {
                String email = resolveEmail(authentication);
                if (email != null) {
                    User user = userRepository.findByEmail(email).orElse(null);
                    if (user != null) {
                        // Wire daily-mission tracker: this endpoint bypasses
                        // SessionService.submitAnswer so the DM-TRACK-2 hook
                        // doesn't cover Ranked. Try/catch keeps tracking
                        // failures from breaking the ranked answer response.
                        if (dailyMissionService != null) {
                            try {
                                if (isCorrect) {
                                    dailyMissionService.trackProgress(user.getId(), "answer_correct", 1);
                                }
                                dailyMissionService.trackComboProgress(user.getId(), "answer_combo", isCorrect);
                            } catch (RuntimeException missionErr) {
                                log.warn("Daily mission tracking failed for user {} ({}). Ranked flow unaffected.",
                                        user.getId(), missionErr.getMessage());
                            }
                        }

                        LocalDate today = GameClock.today();
                        UserDailyProgress udp = udpRepository.findByUserIdAndDate(user.getId(), today)
                                .orElse(new UserDailyProgress(UUID.randomUUID().toString(), user, today));

                        // Initialize with daily defaults if new record
                        if (udp.getLivesRemaining() == null) {
                            udp.setLivesRemaining(MAX_ENERGY);
                        }
                        // Sync session progress with database
                        udp.setLivesRemaining(p.livesRemaining);
                        udp.setQuestionsCounted(p.questionsCounted);
                        // Update points based on computed earned score
                        udp.setPointsCounted(p.pointsToday);

                        // Append asked question id
                        if (questionId != null) {
                            java.util.List<String> asked = udp.getAskedQuestionIds();
                            if (asked == null)
                                asked = new java.util.ArrayList<>();
                            if (!asked.contains(questionId)) {
                                asked.add(questionId);
                                udp.setAskedQuestionIds(asked);
                            }
                        }

                        // Update book progression
                        udp.setCurrentBook(p.currentBook);
                        udp.setCurrentBookIndex(p.currentBookIndex);
                        udp.setIsPostCycle(p.isPostCycle);
                        try {
                            udp.setCurrentDifficulty(
                                    UserDailyProgress.Difficulty.valueOf(p.currentDifficulty.toLowerCase()));
                        } catch (Exception ex) {
                            udp.setCurrentDifficulty(UserDailyProgress.Difficulty.all);
                        }

                        udpRepository.save(udp);

                        // BL-21 (RANK-CATCHUP-3, 2026-05-20): mirror the Practice flow
                        // by writing UserQuestionHistory on every ranked answer. Without
                        // this, Profile stats `countByUserId` / `countMasteredByUserId`
                        // miss every ranked attempt and cross-day repeat avoidance has
                        // no data to work with. Best-effort — wrap in its own try/catch
                        // so a UQH failure (FK race, etc.) doesn't break the answer
                        // response. Mirrors SessionService.recordQuestionHistory:735-763.
                        if (questionId != null) {
                            try {
                                recordRankedQuestionHistory(user, questionId, isCorrect);
                            } catch (RuntimeException uqhErr) {
                                log.warn("UQH write failed for user={} q={} ({}). Ranked submit unaffected.",
                                        user.getId(), questionId, uqhErr.getMessage());
                            }
                        }

                        // Bump GroupMember.lastActiveAt for the inactive-filter on
                        // /api/groups/{id}/members. Best-effort — never fail the
                        // ranked answer submit if group bookkeeping errors.
                        try {
                            groupMemberRepository.touchLastActiveByUserId(user.getId(),
                                    java.time.LocalDateTime.now(ZoneOffset.UTC));
                        } catch (Exception groupTouchErr) {
                            // log only; do not surface
                        }

                        // Invalidate leaderboard cache after score update
                        cacheService.invalidateLeaderboards();

                        // LBF-13 (2026-06-18): season_rankings double-write stopped.
                        // Ranked points already land in user_daily_progress above
                        // (line ~638); the competitive-season surfaces that read
                        // season_rankings (leaderboard "Mùa" tab, Ranked SeasonCard)
                        // are hidden (LBF-9/12), so the parallel ledger was pure
                        // duplicate accounting + an extra DB write per answer. The
                        // table/entity/endpoint stay dormant for easy re-enable.
                        // NOTE: leaderboard "Mùa" tab reads window-sum UDP, NOT this
                        // table — so hiding it loses no board data.

                        // Per-book stats (journey collection + Profile). RWP-3: key
                        // by the ANSWERED question's actual book. Since 2026-10-08
                        // Ranked has no sequential journey book to advance: books are
                        // collected in any order (see RankedBookPool). Runs before the
                        // achievement check so this answer counts toward "scholar".
                        String answerLang = (currentQ != null && currentQ.getLanguage() != null)
                                ? currentQ.getLanguage() : "vi";
                        if (questionId != null) {
                            String answeredBook = (currentQ != null && currentQ.getBook() != null)
                                    ? currentQ.getBook() : p.currentBook;
                            try {
                                UserBookProgress ubp = userBookProgressRepository
                                        .findByUserIdAndBook(user.getId(), answeredBook)
                                        .orElse(new UserBookProgress(java.util.UUID.randomUUID().toString(), user,
                                                answeredBook));
                                java.util.List<String> uniques = ubp.getUniqueQuestionIds();
                                if (uniques == null)
                                    uniques = new java.util.ArrayList<>();
                                boolean isNew = false;
                                if (!uniques.contains(questionId)) {
                                    uniques.add(questionId);
                                    isNew = true;
                                }
                                ubp.setUniqueQuestionIds(uniques);
                                if (isNew)
                                    ubp.setAnsweredCount((ubp.getAnsweredCount() == null ? 0 : ubp.getAnsweredCount()) + 1);
                                if (isCorrect)
                                    ubp.setCorrectCount((ubp.getCorrectCount() == null ? 0 : ubp.getCorrectCount()) + 1);
                                userBookProgressRepository.save(ubp);
                            } catch (RuntimeException ubpErr) {
                                log.warn("Book progress write failed for user={} book={} ({}). Ranked submit unaffected.",
                                        user.getId(), answeredBook, ubpErr.getMessage());
                            }
                        }

                        // Check achievements
                        try {
                            int allTimePoints = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                                    .stream().mapToInt(u -> u.getPointsCounted() != null ? u.getPointsCounted() : 0).sum();
                            int allTimeQuestions = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                                    .stream().mapToInt(u -> u.getQuestionsCounted() != null ? u.getQuestionsCounted() : 0).sum();
                            achievementService.checkAndAward(user, allTimePoints, allTimeQuestions,
                                    p.currentStreak, countBooksSampled(user.getId(), answerLang));

                            // Check tier-up notification
                            try {
                                int previousPoints = allTimePoints - earned;
                                com.biblequiz.modules.ranked.model.RankTier previousTier =
                                        com.biblequiz.modules.ranked.model.RankTier.fromPoints(previousPoints);
                                com.biblequiz.modules.ranked.model.RankTier currentTier =
                                        com.biblequiz.modules.ranked.model.RankTier.fromPoints(allTimePoints);
                                if (currentTier != previousTier) {
                                    notificationService.createTierUpNotification(user,
                                            currentTier.getDisplayName(), currentTier.getKey());
                                }
                            } catch (Exception tierEx) {
                                log.debug("Tier notification check failed: {}", tierEx.getMessage());
                            }
                        } catch (Exception ex) {
                            log.debug("Achievement check failed: {}", ex.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Error saving ranked progress to database: {}", e.getMessage(), e);
            }

            // Update pointsToday from database if user is authenticated
            try {
                String email2 = resolveEmail(authentication);
                if (email2 != null) {
                    User user = userRepository.findByEmail(email2).orElse(null);
                    if (user != null) {
                        LocalDate today = GameClock.today();
                        UserDailyProgress udp = udpRepository.findByUserIdAndDate(user.getId(), today).orElse(null);
                        if (udp != null) {
                            p.pointsToday = udp.getPointsCounted();
                        }
                    }
                }
            } catch (Exception ignore) {
            }

            rankedSessionService.save(sessionId, p);

            Map<String, Object> resp = new HashMap<>();
            resp.put("sessionId", sessionId);
            resp.put("livesRemaining", p.livesRemaining);
            resp.put("questionsCounted", p.questionsCounted);
            resp.put("pointsToday", p.pointsToday);
            // Per-question XP awarded — surfaced so FE can show the same value
            // it credits to the leaderboard. Without this, Quiz.tsx falls back
            // to its own local formula (different base values, no tier/surge)
            // and the user sees a per-question score ~4× higher than the
            // actual leaderboard delta (bug report 2026-05-20).
            resp.put("earned", earned);
            resp.put("streak", p.currentStreak);

            // Include book progression information
            BookProgressionService.BookProgress bookProgress = bookProgressionService.getBookProgress(p.currentBook);
            resp.put("currentBook", p.currentBook);
            resp.put("currentBookIndex", p.currentBookIndex);
            resp.put("questionsInCurrentBook", p.questionsInCurrentBook);
            resp.put("correctAnswersInCurrentBook", p.correctAnswersInCurrentBook);
            resp.put("isPostCycle", p.isPostCycle);
            resp.put("bookProgress", bookProgress);

            // §7.1.5 — surface Liturgical week completion to FE WeekCompleteModal.
            boolean weekCompleted = weekResult != null && weekResult.justCompleted();
            resp.put("weekCompleted", weekCompleted);
            if (weekCompleted) {
                resp.put("completedWeek", weekResult.completedWeek());
                resp.put("nextWeekBooks", weekResult.nextWeekBooks());
            }

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Exception in submitRankedAnswer: {}", e.getMessage(), e);
            Map<String, Object> errorResp = new HashMap<>();
            errorResp.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResp);
        }
    }

    /**
     * BL-26 B (LD1 2026-06-22) — award the end-of-match accuracy bonus.
     *
     * <p>Called by the FE when a Ranked match (the 10-question batch tied to
     * this {@code sessionId}) ends. Bonus = a % of {@code matchEarned} (sum of
     * this match's per-question points) by accuracy computed from SERVER-side
     * counters ({@code matchCorrect}/{@code matchTotal}) — the client cannot
     * inflate it. Thresholds (LD1): acc ≥90% → +15%, 75–89% → +8%, else 0
     * (never negative). Idempotent via {@code matchBonusAwarded}: a second call
     * returns {@code bonusPoints:0}.</p>
     */
    @PostMapping("/ranked/sessions/{id}/match-complete")
    public ResponseEntity<Map<String, Object>> completeRankedMatch(
            @PathVariable("id") String sessionId, Authentication authentication) {
        Progress p = rankedSessionService.get(sessionId);
        if (p == null) {
            Map<String, Object> none = new HashMap<>();
            none.put("bonusPoints", 0);
            none.put("awarded", false);
            return ResponseEntity.ok(none);
        }
        // Ownership check (mirror submit) — legacy null-userId sessions bypass.
        if (p.userId != null && authentication != null) {
            String authEmail = resolveEmail(authentication);
            User authUser = authEmail != null ? userRepository.findByEmail(authEmail).orElse(null) : null;
            if (authUser == null || !p.userId.equals(authUser.getId())) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "SESSION_OWNERSHIP",
                        "message", "Session belongs to a different user"));
            }
        }

        double accuracy = p.matchTotal > 0 ? (double) p.matchCorrect / p.matchTotal : 0.0;
        int bonusPercent = 0;
        if (p.matchTotal > 0) {
            if (accuracy >= 0.90) bonusPercent = 15;
            else if (accuracy >= 0.75) bonusPercent = 8;
        }
        int bonusPoints = (int) Math.round(p.matchEarned * bonusPercent / 100.0);

        boolean firstTime = !p.matchBonusAwarded;
        boolean awarded = false;
        if (firstTime) {
            p.matchBonusAwarded = true; // mark processed even when bonus is 0
            if (bonusPoints > 0) {
                p.pointsToday += bonusPoints;
                awarded = true;
                // Persist to today's UDP so the bonus lands in tier + leaderboard.
                try {
                    String email = resolveEmail(authentication);
                    User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
                    if (user != null) {
                        UserDailyProgress udp = udpRepository
                                .findByUserIdAndDate(user.getId(), GameClock.today()).orElse(null);
                        if (udp != null) {
                            udp.setPointsCounted(p.pointsToday);
                            udpRepository.save(udp);
                            cacheService.invalidateLeaderboards();
                        }
                    }
                } catch (Exception e) {
                    log.warn("match-complete bonus persist failed: {}", e.getMessage());
                }
            }
        }
        rankedSessionService.save(sessionId, p);

        Map<String, Object> resp = new HashMap<>();
        resp.put("bonusPoints", firstTime ? bonusPoints : 0);
        resp.put("bonusPercent", bonusPercent);
        resp.put("accuracy", accuracy);
        resp.put("correct", p.matchCorrect);
        resp.put("total", p.matchTotal);
        resp.put("pointsToday", p.pointsToday);
        resp.put("awarded", awarded);
        return ResponseEntity.ok(resp);
    }

    /**
     * BL-21 (RANK-CATCHUP-3, 2026-05-20) — upsert UserQuestionHistory after
     * a ranked answer so Profile stats + spaced-repetition reviewer (which
     * already read this table for Practice) include Ranked attempts.
     *
     * <p>Mirrors {@code SessionService.recordQuestionHistory:735-763} — same
     * SRS schedule (correct → review in min(30, timesCorrect×3) days;
     * wrong → review in 1 day). Question entity is loaded by ID to satisfy
     * the FK + populate the new row; if it's been hard-deleted between
     * answer submission and this write the upsert is silently skipped.
     */
    private void recordRankedQuestionHistory(User user, String questionId, boolean isCorrect) {
        java.util.Optional<UserQuestionHistory> existing =
                userQuestionHistoryRepository.findByUserIdAndQuestionId(user.getId(), questionId);

        UserQuestionHistory history;
        if (existing.isPresent()) {
            history = existing.get();
        } else {
            Question question = questionRepository.findById(questionId).orElse(null);
            if (question == null) {
                log.warn("UQH skip — question {} not found for user {}", questionId, user.getId());
                return;
            }
            history = new UserQuestionHistory(UUID.randomUUID().toString(), user, question);
            history.setTimesSeen(0);
            history.setTimesCorrect(0);
            history.setTimesWrong(0);
        }

        history.setTimesSeen(history.getTimesSeen() + 1);
        LocalDateTime now = LocalDateTime.now();
        history.setLastSeenAt(now);

        if (isCorrect) {
            history.setTimesCorrect(history.getTimesCorrect() + 1);
            history.setLastCorrectAt(now);
            int days = Math.min(30, history.getTimesCorrect() * 3);
            history.setNextReviewAt(now.plusDays(days));
        } else {
            history.setTimesWrong(history.getTimesWrong() + 1);
            history.setLastWrongAt(now);
            history.setNextReviewAt(now.plusDays(1));
        }

        userQuestionHistoryRepository.save(history);
    }

    @GetMapping("/me/ranked-status")
    public ResponseEntity<Map<String, Object>> getRankedStatus(Authentication authentication) {
        Progress p = new Progress();
        p.date = GameClock.today().toString();

        try {
            String email = resolveEmail(authentication);
            if (email != null) {
                User user = userRepository.findByEmail(email).orElse(null);
                if (user != null) {
                    LocalDate today = GameClock.today();
                    java.util.Optional<UserDailyProgress> opt = udpRepository.findByUserIdAndDate(user.getId(), today);
                    if (opt.isPresent()) {
                        UserDailyProgress udp = opt.get();
                        int rawLives = udp.getLivesRemaining() != null ? udp.getLivesRemaining() : MAX_ENERGY;
                        p.livesRemaining = recoverEnergy(rawLives, udp.getLastUpdatedAt());
                        p.questionsCounted = udp.getQuestionsCounted() != null ? udp.getQuestionsCounted() : 0;
                        p.pointsToday = udp.getPointsCounted() != null ? udp.getPointsCounted() : 0;
                        p.currentBook = udp.getCurrentBook() != null ? udp.getCurrentBook() : "Genesis";
                        p.currentDifficulty = udp.getCurrentDifficulty() != null ? udp.getCurrentDifficulty().name()
                                : "all";
                        p.isPostCycle = udp.getIsPostCycle() != null ? udp.getIsPostCycle() : false;
                        p.currentBookIndex = udp.getCurrentBookIndex() != null ? udp.getCurrentBookIndex() : 0;
                        p.date = today.toString();
                    } else {
                        // Check if there's a record from yesterday or earlier
                        java.util.List<UserDailyProgress> recentRecords = udpRepository
                                .findByUserIdOrderByDateDesc(user.getId());
                        if (!recentRecords.isEmpty()) {
                            UserDailyProgress lastRecord = recentRecords.get(0);
                            LocalDate lastDate = lastRecord.getDate();

                            // If last record is from a different day, carry over book progression but reset daily stats
                            if (!lastDate.equals(today)) {
                                String carryBook = lastRecord.getCurrentBook() != null ? lastRecord.getCurrentBook() : "Genesis";
                                Integer carryBookIndex = lastRecord.getCurrentBookIndex() != null ? lastRecord.getCurrentBookIndex() : 0;
                                boolean carryPostCycle = lastRecord.getIsPostCycle() != null && lastRecord.getIsPostCycle();
                                UserDailyProgress.Difficulty carryDifficulty = lastRecord.getCurrentDifficulty() != null
                                        ? lastRecord.getCurrentDifficulty() : UserDailyProgress.Difficulty.all;

                                UserDailyProgress newUdp = new UserDailyProgress(UUID.randomUUID().toString(), user,
                                        today);
                                newUdp.setLivesRemaining(MAX_ENERGY);
                                newUdp.setQuestionsCounted(0);
                                newUdp.setPointsCounted(0);
                                newUdp.setCurrentBook(carryBook);
                                newUdp.setCurrentBookIndex(carryBookIndex);
                                newUdp.setCurrentDifficulty(carryDifficulty);
                                newUdp.setIsPostCycle(carryPostCycle);
                                newUdp.setAskedQuestionIds(new java.util.ArrayList<>());
                                udpRepository.save(newUdp);

                                p.livesRemaining = MAX_ENERGY;
                                p.questionsCounted = 0;
                                p.pointsToday = 0;
                                p.currentBook = carryBook;
                                p.currentBookIndex = carryBookIndex;
                                p.currentDifficulty = carryDifficulty.name();
                                p.isPostCycle = carryPostCycle;
                                p.date = today.toString();
                            } else {
                                // Same day, use existing record
                                p.livesRemaining = lastRecord.getLivesRemaining() != null
                                        ? lastRecord.getLivesRemaining()
                                        : MAX_ENERGY;
                                p.questionsCounted = lastRecord.getQuestionsCounted() != null
                                        ? lastRecord.getQuestionsCounted()
                                        : 0;
                                p.pointsToday = lastRecord.getPointsCounted() != null ? lastRecord.getPointsCounted()
                                        : 0;
                                p.currentBook = lastRecord.getCurrentBook() != null ? lastRecord.getCurrentBook()
                                        : "Genesis";
                                p.currentDifficulty = lastRecord.getCurrentDifficulty() != null
                                        ? lastRecord.getCurrentDifficulty().name()
                                        : "all";
                                p.isPostCycle = lastRecord.getIsPostCycle() != null ? lastRecord.getIsPostCycle()
                                        : false;
                                p.currentBookIndex = lastRecord.getCurrentBookIndex() != null
                                        ? lastRecord.getCurrentBookIndex()
                                        : 0;
                                p.date = today.toString();
                            }
                        } else {
                            // No previous records, create new one
                            UserDailyProgress newUdp = new UserDailyProgress(UUID.randomUUID().toString(), user, today);
                            newUdp.setLivesRemaining(MAX_ENERGY);
                            newUdp.setQuestionsCounted(0);
                            newUdp.setPointsCounted(0);
                            newUdp.setCurrentBook("Genesis");
                            newUdp.setCurrentBookIndex(0);
                            newUdp.setCurrentDifficulty(UserDailyProgress.Difficulty.all);
                            newUdp.setIsPostCycle(false);
                            newUdp.setAskedQuestionIds(new java.util.ArrayList<>());
                            udpRepository.save(newUdp);

                            p.livesRemaining = MAX_ENERGY;
                            p.questionsCounted = 0;
                            p.pointsToday = 0;
                            p.currentBook = "Genesis";
                            p.currentDifficulty = "all";
                            p.isPostCycle = false;
                            p.date = today.toString();
                        }
                    }
                }
            }
        } catch (Exception ignore) {
        }
        Map<String, Object> body = new HashMap<>();
        body.put("date", p.date != null ? p.date : GameClock.today().toString());
        body.put("livesRemaining", p.livesRemaining);
        body.put("questionsCounted", p.questionsCounted);
        body.put("pointsToday", p.pointsToday);
        body.put("cap", p.cap);
        body.put("dailyLives", p.dailyLives);
        // Get book progression information
        BookProgressionService.BookProgress bookProgress = bookProgressionService.getBookProgress(p.currentBook);

        body.put("currentBook", p.currentBook);
        body.put("currentBookIndex", p.currentBookIndex);
        body.put("isPostCycle", p.isPostCycle);
        body.put("currentDifficulty", p.currentDifficulty);
        body.put("nextBook", bookProgress.nextBook);
        body.put("bookProgress", bookProgress);
        // Attach asked ids summary
        try {
            String email = resolveEmail(authentication);
            if (email != null) {
                User user = userRepository.findByEmail(email).orElse(null);
                if (user != null) {
                    LocalDate today = GameClock.today();
                    java.util.Optional<UserDailyProgress> opt = udpRepository.findByUserIdAndDate(user.getId(), today);
                    if (opt.isPresent()) {
                        java.util.List<String> asked = opt.get().getAskedQuestionIds();
                        body.put("askedQuestionIdsToday", asked != null ? asked : java.util.Collections.emptyList());
                        body.put("askedQuestionCountToday", asked != null ? asked.size() : 0);
                    } else {
                        body.put("askedQuestionIdsToday", java.util.Collections.emptyList());
                        body.put("askedQuestionCountToday", 0);
                    }
                }
            }
        } catch (Exception ignore) {
        }
        // A1: today's RANKED accuracy. Skipped for unauthenticated requests
        // (returns null fields). Pulled live every call — no @Cacheable so
        // the user sees their accuracy update right after answering.
        body.put("dailyAccuracy", null);
        body.put("dailyCorrectCount", null);
        body.put("dailyTotalAnswered", null);
        try {
            String accuracyEmail = resolveEmail(authentication);
            if (accuracyEmail != null) {
                User accuracyUser = userRepository.findByEmail(accuracyEmail).orElse(null);
                if (accuracyUser != null) {
                    LocalDate today = GameClock.today();
                    LocalDateTime todayStart = today.atStartOfDay();
                    LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();
                    long total = answerRepository.countRankedAnswersByUserBetween(
                            accuracyUser.getId(), todayStart, tomorrowStart);
                    if (total > 0) {
                        long correct = answerRepository.countCorrectRankedAnswersByUserBetween(
                                accuracyUser.getId(), todayStart, tomorrowStart);
                        body.put("dailyAccuracy", (double) correct / (double) total);
                        body.put("dailyCorrectCount", correct);
                        body.put("dailyTotalAnswered", total);
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("dailyAccuracy aggregation failed: {}", ex.getMessage());
        }

        // A2: today's points minus yesterday's. Null when either day has
        // no UserDailyProgress row (new user, or skipped a day). Zero is
        // a valid value (same points both days) — FE hides the "↑ +0"
        // cosmetic line in A4, server doesn't shortcut it.
        body.put("dailyDelta", null);
        try {
            String deltaEmail = resolveEmail(authentication);
            if (deltaEmail != null) {
                User deltaUser = userRepository.findByEmail(deltaEmail).orElse(null);
                if (deltaUser != null) {
                    LocalDate today = GameClock.today();
                    LocalDate yesterday = today.minusDays(1);
                    java.util.Optional<UserDailyProgress> todayUdp =
                            udpRepository.findByUserIdAndDate(deltaUser.getId(), today);
                    java.util.Optional<UserDailyProgress> yesterdayUdp =
                            udpRepository.findByUserIdAndDate(deltaUser.getId(), yesterday);
                    if (todayUdp.isPresent() && yesterdayUdp.isPresent()) {
                        int todayPoints = todayUdp.get().getPointsCounted() != null
                                ? todayUdp.get().getPointsCounted() : 0;
                        int yesterdayPoints = yesterdayUdp.get().getPointsCounted() != null
                                ? yesterdayUdp.get().getPointsCounted() : 0;
                        body.put("dailyDelta", todayPoints - yesterdayPoints);
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("dailyDelta computation failed: {}", ex.getMessage());
        }

        // A3: points needed to enter Top 50 / Top 10 of the active season.
        // Both null when (a) no active season, (b) leaderboard < N users,
        // or (c) the user is already at or above the Nth-highest score
        // (tie counts as "already in top" → null per quyết định).
        //
        // Queries are 60s-cached via existing Redis CacheService — the
        // threshold only changes when someone in the top N gains points,
        // so a stale read by < 60s is acceptable for an MVP. Skipped for
        // unauthenticated requests.
        // R10 additions — season placement + week-highest combo. All
        // null when (a) unauthenticated, (b) no active season,
        // (c) user has no SeasonRanking row, or (d) no ranked answers
        // in the past 7 days. seasonRankDelta is intentionally null
        // until v1.1 (DECISIONS — option C: defer snapshot infra).
        body.put("pointsToTop50", null);
        body.put("pointsToTop10", null);
        body.put("pointsToTop100", null);
        body.put("seasonRank", null);
        body.put("seasonTotalPlayers", null);
        body.put("seasonPoints", null);
        body.put("seasonRankDelta", null);
        body.put("weekHighestCombo", null);
        try {
            String topEmail = resolveEmail(authentication);
            if (topEmail != null) {
                User topUser = userRepository.findByEmail(topEmail).orElse(null);
                if (topUser != null) {
                    java.util.Optional<com.biblequiz.modules.season.entity.Season> activeSeason =
                            seasonService.getActiveSeason();
                    if (activeSeason.isPresent()) {
                        String seasonId = activeSeason.get().getId();
                        java.util.Optional<com.biblequiz.modules.season.entity.SeasonRanking> srOpt =
                                seasonRankingRepository.findBySeasonIdAndUserId(seasonId, topUser.getId());
                        int userPoints = srOpt
                                .map(sr -> sr.getTotalPoints() != null ? sr.getTotalPoints() : 0)
                                .orElse(0);
                        Integer top50 = getCachedSeasonScoreAtRank(seasonId, 50);
                        if (top50 != null && userPoints < top50) {
                            body.put("pointsToTop50", top50 - userPoints + 1);
                        }
                        Integer top10 = getCachedSeasonScoreAtRank(seasonId, 10);
                        if (top10 != null && userPoints < top10) {
                            body.put("pointsToTop10", top10 - userPoints + 1);
                        }
                        Integer top100 = getCachedSeasonScoreAtRank(seasonId, 100);
                        if (top100 != null && userPoints < top100) {
                            body.put("pointsToTop100", top100 - userPoints + 1);
                        }
                        // Season placement (rank, total players, points). Only
                        // fill when the user has a SeasonRanking row — a brand
                        // new account with 0 ranked answers shouldn't claim
                        // a rank.
                        if (srOpt.isPresent()) {
                            int rank = (int) seasonRankingRepository
                                    .countUsersAheadInSeason(seasonId, userPoints) + 1;
                            long totalPlayers = seasonRankingRepository.countBySeasonId(seasonId);
                            body.put("seasonRank", rank);
                            body.put("seasonTotalPlayers", totalPlayers);
                            body.put("seasonPoints", userPoints);
                        }
                    }
                    // Week-highest combo — longest consecutive-correct run
                    // across the user's ranked answers in the trailing 7
                    // days. Uses a projection-only query to avoid loading
                    // full Answer entities. Returns null when there are no
                    // ranked answers in the window so the FE can hide the
                    // sidebar widget instead of showing "0".
                    LocalDateTime weekStart = LocalDateTime.now(ZoneOffset.UTC).minusDays(7);
                    java.util.List<Boolean> answers = answerRepository
                            .findRankedAnswerCorrectnessSince(topUser.getId(), weekStart);
                    if (!answers.isEmpty()) {
                        int best = 0;
                        int run = 0;
                        for (Boolean correct : answers) {
                            if (Boolean.TRUE.equals(correct)) {
                                run += 1;
                                if (run > best) best = run;
                            } else {
                                run = 0;
                            }
                        }
                        body.put("weekHighestCombo", best);
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("season placement / weekly combo computation failed: {}", ex.getMessage());
        }

        // Set reset time - configurable for testing vs production
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime resetTime;

        // Check if we're in test mode (you can change this to false for production)
        boolean isTestMode = false; // Set to true for 2-minute reset, false for 24-hour reset

        if (isTestMode) {
            resetTime = now.plusMinutes(2); // 2 minutes for testing
        } else {
            resetTime = now.plusHours(24); // 24 hours for production
        }

        body.put("resetAt", resetTime.atZone(ZoneOffset.UTC).toInstant().toString());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/ranked/sync-progress")
    public ResponseEntity<Map<String, Object>> syncProgress(Authentication authentication) {
        log.debug("syncProgress called");
        try {
            String email = resolveEmail(authentication);
            if (email == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
            }
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "User not found"));
            }

            LocalDate today = GameClock.today();
            java.util.Optional<UserDailyProgress> udpOpt = udpRepository.findByUserIdAndDate(user.getId(), today);
            if (udpOpt.isPresent()) {
                UserDailyProgress udp = udpOpt.get();
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "questionsCounted", udp.getQuestionsCounted() != null ? udp.getQuestionsCounted() : 0,
                        "pointsToday", udp.getPointsCounted() != null ? udp.getPointsCounted() : 0,
                        "livesRemaining", udp.getLivesRemaining() != null ? udp.getLivesRemaining() : 30));
            } else {
                return ResponseEntity.ok(Map.of("success", true, "message", "No progress today"));
            }
        } catch (Exception e) {
            log.error("Error syncing progress: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to sync progress"));
        }
    }

    @GetMapping("/me/tier")
    public ResponseEntity<Map<String, Object>> getMyTier(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        String email = resolveEmail(authentication);
        User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        int totalPoints = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                .stream()
                .mapToInt(udp -> udp.getPointsCounted() != null ? udp.getPointsCounted() : 0)
                .sum();

        com.biblequiz.modules.ranked.model.RankTier currentTier =
                com.biblequiz.modules.ranked.model.RankTier.fromPoints(totalPoints);
        com.biblequiz.modules.ranked.model.RankTier nextTier = currentTier.next();

        Map<String, Object> result = new HashMap<>();
        result.put("totalPoints", totalPoints);
        result.put("tier", currentTier.getKey());
        result.put("tierName", currentTier.getDisplayName());
        result.put("tierMinPoints", currentTier.getRequiredPoints());
        if (nextTier != null) {
            result.put("nextTier", nextTier.getKey());
            result.put("nextTierName", nextTier.getDisplayName());
            result.put("nextTierMinPoints", nextTier.getRequiredPoints());
            result.put("pointsToNextTier", nextTier.getRequiredPoints() - totalPoints);
            int range = nextTier.getRequiredPoints() - currentTier.getRequiredPoints();
            int progress = totalPoints - currentTier.getRequiredPoints();
            result.put("progressPercent", range > 0 ? Math.min(100, (int) ((progress * 100L) / range)) : 100);
        } else {
            result.put("nextTier", null);
            result.put("progressPercent", 100);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me/game-modes")
    public ResponseEntity<?> getGameModes(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        String email = resolveEmail(authentication);
        User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        int totalPoints = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                .stream()
                .mapToInt(udp -> udp.getPointsCounted() != null ? udp.getPointsCounted() : 0)
                .sum();
        int tierLevel = com.biblequiz.modules.ranked.model.RankTier.fromPoints(totalPoints).ordinal() + 1;

        return ResponseEntity.ok(gameModeUnlockConfig.getModesForTier(tierLevel));
    }
}
