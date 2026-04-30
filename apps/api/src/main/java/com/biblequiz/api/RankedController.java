package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.UserBookProgress;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.UserBookProgressRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.service.BookProgressionService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.biblequiz.modules.ranked.service.RankedSessionService;
import com.biblequiz.modules.ranked.service.RankedSessionService.Progress;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
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
    private com.biblequiz.modules.achievement.service.AchievementService achievementService;

    @Autowired
    private com.biblequiz.modules.ranked.service.ScoringService scoringService;

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
        p.date = LocalDate.now(ZoneOffset.UTC).toString();

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

        rankedSessionService.save(sessionId, p);
        body.put("sessionId", sessionId);
        body.put("currentBook", p.currentBook);
        body.put("bookProgress", bookProgress);

        return ResponseEntity.ok(body);
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

            // Recover lives based on time elapsed since last activity
            try {
                String email = resolveEmail(authentication);
                if (email != null) {
                    User user = email != null ? userRepository.findByEmail(email).orElse(null) : null;
                    if (user != null) {
                        UserDailyProgress udp = udpRepository.findByUserIdAndDate(user.getId(), LocalDate.now(ZoneOffset.UTC)).orElse(null);
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

            // Update book-specific progress
            p.questionsInCurrentBook += 1;
            int earned = 0;

            if (isCorrect) {
                p.correctAnswersInCurrentBook += 1;
                p.currentStreak += 1;

                com.biblequiz.modules.ranked.service.ScoringService.ScoreResult score =
                        scoringService.calculate(
                                currentQ != null ? currentQ.getDifficulty() : null,
                                clientElapsedMs, p.currentStreak);
                earned = score.earned;
                p.pointsToday += earned;

                // SPEC-v2: energy system — no streak lives bonus (regen handles recovery)
            } else {
                p.currentStreak = 0;
            }

            log.debug("Points: earned={} total={} streak={}", earned, p.pointsToday, p.currentStreak);

            // Check if should advance to next book
            boolean shouldAdvance = bookProgressionService.shouldAdvanceToNextBook(
                    p.currentBook, p.questionsInCurrentBook, p.correctAnswersInCurrentBook);

            if (shouldAdvance) {
                String nextBook = bookProgressionService.getNextBook(p.currentBook);
                if (nextBook != null) {
                    log.debug("Advancing from {} to {}", p.currentBook, nextBook);
                    p.currentBook = nextBook;
                    p.currentBookIndex = bookProgressionService.getBookProgress(nextBook).currentIndex - 1;
                    p.questionsInCurrentBook = 0;
                    p.correctAnswersInCurrentBook = 0;
                } else {
                    log.info("User completed all books! Switching to post-cycle mode.");
                    p.isPostCycle = true;
                    p.currentDifficulty = "hard"; // Switch to hard questions after completing all books
                }
            }

            // Persist to DB per user/day if authenticated
            try {
                String email = resolveEmail(authentication);
                if (email != null) {
                    User user = userRepository.findByEmail(email).orElse(null);
                    if (user != null) {
                        LocalDate today = LocalDate.now(ZoneOffset.UTC);
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

                        // Invalidate leaderboard cache after score update
                        cacheService.deletePattern(com.biblequiz.infrastructure.service.CacheService.LEADERBOARD_CACHE_PREFIX + "*");

                        // Update season ranking if active season exists
                        if (earned > 0) {
                            seasonService.addPoints(user, earned, 1);
                        }

                        // Check achievements
                        try {
                            int allTimePoints = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                                    .stream().mapToInt(u -> u.getPointsCounted() != null ? u.getPointsCounted() : 0).sum();
                            int allTimeQuestions = udpRepository.findByUserIdOrderByDateDesc(user.getId())
                                    .stream().mapToInt(u -> u.getQuestionsCounted() != null ? u.getQuestionsCounted() : 0).sum();
                            achievementService.checkAndAward(user, allTimePoints, allTimeQuestions,
                                    p.currentStreak, p.currentBookIndex);

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

                        // Per-book mastery tracking
                        if (questionId != null) {
                            UserBookProgress ubp = userBookProgressRepository
                                    .findByUserIdAndBook(user.getId(), p.currentBook)
                                    .orElse(new UserBookProgress(java.util.UUID.randomUUID().toString(), user,
                                            p.currentBook));
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

                            // Mastery check
                            if ((ubp.getAnsweredCount() != null && ubp.getAnsweredCount() >= 100) &&
                                    (ubp.getCorrectCount() != null && ubp.getCorrectCount() >= 70)) {
                                String nextBook = bookProgressionService.getNextBook(p.currentBook);
                                if (nextBook != null) {
                                    p.currentBook = nextBook;
                                    p.currentBookIndex = bookProgressionService.getBookProgress(nextBook).currentIndex
                                            - 1;
                                    p.questionsInCurrentBook = 0;
                                    p.correctAnswersInCurrentBook = 0;
                                    udp.setCurrentBook(nextBook);
                                    udp.setCurrentBookIndex(p.currentBookIndex);
                                    udpRepository.save(udp);
                                }
                            }
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
                        LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
            resp.put("streak", p.currentStreak);

            // Include book progression information
            BookProgressionService.BookProgress bookProgress = bookProgressionService.getBookProgress(p.currentBook);
            resp.put("currentBook", p.currentBook);
            resp.put("currentBookIndex", p.currentBookIndex);
            resp.put("questionsInCurrentBook", p.questionsInCurrentBook);
            resp.put("correctAnswersInCurrentBook", p.correctAnswersInCurrentBook);
            resp.put("isPostCycle", p.isPostCycle);
            resp.put("bookProgress", bookProgress);

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Exception in submitRankedAnswer: {}", e.getMessage(), e);
            Map<String, Object> errorResp = new HashMap<>();
            errorResp.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResp);
        }
    }

    @GetMapping("/me/ranked-status")
    public ResponseEntity<Map<String, Object>> getRankedStatus(Authentication authentication) {
        Progress p = new Progress();
        p.date = LocalDate.now(ZoneOffset.UTC).toString();

        try {
            String email = resolveEmail(authentication);
            if (email != null) {
                User user = userRepository.findByEmail(email).orElse(null);
                if (user != null) {
                    LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
        body.put("date", p.date != null ? p.date : LocalDate.now(ZoneOffset.UTC).toString());
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
                    LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
                    LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
        System.out.println("=== syncProgress METHOD CALLED ===");
        try {
            String email = resolveEmail(authentication);
            if (email == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
            }
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "User not found"));
            }

            LocalDate today = LocalDate.now(ZoneOffset.UTC);
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
