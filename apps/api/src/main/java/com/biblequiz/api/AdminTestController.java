package com.biblequiz.api;

import com.biblequiz.api.dto.SeedPointsRequest;
import com.biblequiz.api.dto.SetMissionStateRequest;
import com.biblequiz.api.dto.SetStateRequest;
import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.feedback.entity.Feedback;
import com.biblequiz.modules.feedback.repository.FeedbackRepository;
import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.entity.UserQuestionHistory;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter;
import com.biblequiz.modules.ranked.model.RankTier;
import com.biblequiz.modules.tournament.entity.Tournament;
import com.biblequiz.modules.tournament.entity.TournamentParticipant;
import com.biblequiz.modules.tournament.repository.TournamentParticipantRepository;
import com.biblequiz.modules.tournament.repository.TournamentRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
// Profile list includes "docker" so e2e tests targeting the docker-compose
// stack (PLAYWRIGHT_BASE_URL=http://localhost:3000) can seed fixtures via
// this controller. Docker is still a dev environment — production runs
// under SPRING_PROFILES_ACTIVE=prod which is explicitly excluded.
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Test fixture controller — dev/staging only.
 *
 * <p>⚠️ This controller is NEVER active in production ({@code @Profile({"dev","staging"})}).
 * It exposes state-manipulation endpoints for E2E test setup/teardown.
 * All actions are logged with prefix {@code [TEST_PANEL]} at WARN level.
 */
@RestController
@RequestMapping("/api/admin/test")
@PreAuthorize("hasRole('ADMIN')")
@Profile({"dev", "staging", "docker"})
public class AdminTestController {

    private static final Logger log = LoggerFactory.getLogger(AdminTestController.class);

    private final UserRepository userRepository;
    private final UserQuestionHistoryRepository historyRepository;
    private final QuestionRepository questionRepository;
    private final UserDailyProgressRepository dailyProgressRepository;
    private final DailyMissionRepository dailyMissionRepository;
    private final SmartQuestionSelector smartQuestionSelector;
    private final ChurchGroupRepository churchGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final TournamentRepository tournamentRepository;
    private final TournamentParticipantRepository tournamentParticipantRepository;
    private final FeedbackRepository feedbackRepository;
    private final DailyChallengeService dailyChallengeService;

    public AdminTestController(UserRepository userRepository,
                                UserQuestionHistoryRepository historyRepository,
                                QuestionRepository questionRepository,
                                UserDailyProgressRepository dailyProgressRepository,
                                DailyMissionRepository dailyMissionRepository,
                                SmartQuestionSelector smartQuestionSelector,
                                ChurchGroupRepository churchGroupRepository,
                                GroupMemberRepository groupMemberRepository,
                                TournamentRepository tournamentRepository,
                                TournamentParticipantRepository tournamentParticipantRepository,
                                FeedbackRepository feedbackRepository,
                                DailyChallengeService dailyChallengeService) {
        this.userRepository = userRepository;
        this.historyRepository = historyRepository;
        this.questionRepository = questionRepository;
        this.dailyProgressRepository = dailyProgressRepository;
        this.dailyMissionRepository = dailyMissionRepository;
        this.smartQuestionSelector = smartQuestionSelector;
        this.churchGroupRepository = churchGroupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.tournamentRepository = tournamentRepository;
        this.tournamentParticipantRepository = tournamentParticipantRepository;
        this.feedbackRepository = feedbackRepository;
        this.dailyChallengeService = dailyChallengeService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Existing endpoints
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/users/{userId}/set-tier")
    @Transactional
    public ResponseEntity<?> setTier(@PathVariable String userId, @RequestParam int tierLevel) {
        if (tierLevel < 1 || tierLevel > 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tier must be 1-6"));
        }

        User user = userRepository.findById(userId).orElseThrow();
        RankTier[] tiers = RankTier.values();
        int targetPoints = tiers[tierLevel - 1].getRequiredPoints();

        // Calculate current points
        int currentPoints = dailyProgressRepository.findByUserIdOrderByDateDesc(userId)
                .stream().mapToInt(p -> p.getPointsCounted() != null ? p.getPointsCounted() : 0).sum();

        // Adjust via a single daily progress entry
        int diff = targetPoints - currentPoints;
        if (diff != 0) {
            UserDailyProgress adjustment = dailyProgressRepository
                    .findByUserIdAndDate(userId, LocalDate.now())
                    .orElseGet(() -> {
                        UserDailyProgress p = new UserDailyProgress();
                        p.setId(UUID.randomUUID().toString());
                        p.setUser(user);
                        p.setDate(LocalDate.now());
                        p.setPointsCounted(0);
                        p.setLivesRemaining(100);
                        return p;
                    });
            adjustment.setPointsCounted(
                    (adjustment.getPointsCounted() != null ? adjustment.getPointsCounted() : 0) + diff);
            dailyProgressRepository.save(adjustment);
        }

        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "newTier", tierLevel,
                "newPoints", targetPoints,
                "tierName", tiers[tierLevel - 1].getDisplayName()
        ));
    }

    @PostMapping("/users/{userId}/reset-history")
    @Transactional
    public ResponseEntity<?> resetHistory(@PathVariable String userId) {
        long deleted = historyRepository.deleteAllByUserId(userId);
        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "deletedRecords", deleted
        ));
    }

    @PostMapping("/users/{userId}/mock-history")
    @Transactional
    public ResponseEntity<?> mockHistory(@PathVariable String userId,
                                          @RequestParam(defaultValue = "50") int percentSeen,
                                          @RequestParam(defaultValue = "10") int percentWrong) {
        User user = userRepository.findById(userId).orElseThrow();

        // Clear existing history first
        historyRepository.deleteAllByUserId(userId);

        List<Question> allQuestions = questionRepository.findAllActiveByLanguage("vi");
        int seenCount = (int) (allQuestions.size() * percentSeen / 100.0);
        int wrongCount = (int) (seenCount * percentWrong / 100.0);

        Collections.shuffle(allQuestions);
        List<UserQuestionHistory> batch = new ArrayList<>();
        for (int i = 0; i < Math.min(seenCount, allQuestions.size()); i++) {
            Question q = allQuestions.get(i);
            boolean isWrong = i < wrongCount;
            UserQuestionHistory h = new UserQuestionHistory(UUID.randomUUID().toString(), user, q);
            h.setTimesSeen(1);
            h.setTimesCorrect(isWrong ? 0 : 1);
            h.setTimesWrong(isWrong ? 1 : 0);
            h.setLastSeenAt(LocalDateTime.now().minusDays(i % 30));
            if (isWrong) {
                h.setLastWrongAt(LocalDateTime.now().minusDays(2));
                h.setNextReviewAt(LocalDateTime.now().minusDays(1)); // Past due
            }
            batch.add(h);
        }
        historyRepository.saveAll(batch);

        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "totalQuestions", allQuestions.size(),
                "mockedSeen", batch.size(),
                "mockedWrong", wrongCount
        ));
    }

    @PostMapping("/users/{userId}/refill-energy")
    @Transactional
    public ResponseEntity<?> refillEnergy(@PathVariable String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        UserDailyProgress progress = dailyProgressRepository
                .findByUserIdAndDate(userId, LocalDate.now())
                .orElseGet(() -> {
                    UserDailyProgress p = new UserDailyProgress();
                    p.setId(UUID.randomUUID().toString());
                    p.setUser(user);
                    p.setDate(LocalDate.now());
                    p.setPointsCounted(0);
                    return p;
                });
        progress.setLivesRemaining(100);
        dailyProgressRepository.save(progress);
        return ResponseEntity.ok(Map.of("energy", 100));
    }

    @PostMapping("/users/{userId}/set-streak")
    @Transactional
    public ResponseEntity<?> setStreak(@PathVariable String userId, @RequestParam int days) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setCurrentStreak(days);
        user.setLongestStreak(Math.max(user.getLongestStreak(), days));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("streak", days));
    }

    @GetMapping("/users/{userId}/preview-questions")
    public ResponseEntity<?> previewQuestions(@PathVariable String userId,
                                               @RequestParam(defaultValue = "10") int count,
                                               @RequestParam(required = false) String book,
                                               @RequestParam(defaultValue = "vi") String language) {
        QuestionFilter filter = new QuestionFilter(book, null, language);
        List<Question> questions = smartQuestionSelector.selectQuestions(userId, count, filter);

        Set<String> seenIds = new HashSet<>(historyRepository.findQuestionIdsByUserId(userId));

        Map<String, Long> poolBreakdown = new HashMap<>();
        for (Question q : questions) {
            String pool;
            if (!seenIds.contains(q.getId())) {
                pool = "NEW";
            } else {
                pool = historyRepository.findByUserIdAndQuestionId(userId, q.getId())
                        .map(h -> h.getTimesWrong() > h.getTimesCorrect() ? "REVIEW" : "OLD")
                        .orElse("UNKNOWN");
            }
            poolBreakdown.merge(pool, 1L, Long::sum);
        }

        Map<String, Long> diffBreakdown = questions.stream()
                .collect(Collectors.groupingBy(
                        q -> q.getDifficulty() != null ? q.getDifficulty().name() : "unknown",
                        Collectors.counting()));

        return ResponseEntity.ok(Map.of(
                "totalSelected", questions.size(),
                "poolBreakdown", poolBreakdown,
                "difficultyBreakdown", diffBreakdown,
                "questions", questions.stream().map(q -> Map.of(
                        "id", q.getId(),
                        "content", q.getContent() != null
                                ? q.getContent().substring(0, Math.min(80, q.getContent().length())) : "",
                        "book", q.getBook() != null ? q.getBook() : "",
                        "difficulty", q.getDifficulty() != null ? q.getDifficulty().name() : "",
                        "previouslySeen", seenIds.contains(q.getId())
                )).toList()
        ));
    }

    @PostMapping("/users/{userId}/full-reset")
    @Transactional
    public ResponseEntity<?> fullReset(@PathVariable String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setCurrentStreak(0);
        user.setLongestStreak(0);
        userRepository.save(user);

        historyRepository.deleteAllByUserId(userId);

        // Reset daily progress points
        List<UserDailyProgress> progress = dailyProgressRepository.findByUserIdOrderByDateDesc(userId);
        for (UserDailyProgress p : progress) {
            p.setPointsCounted(0);
            p.setLivesRemaining(100);
        }
        if (!progress.isEmpty()) dailyProgressRepository.saveAll(progress);

        return ResponseEntity.ok(Map.of("message", "User reset complete"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // New endpoints — generic state override (GAP-1 through GAP-4, GAP-6)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Partial-update scalar state fields on a user or their today's DailyProgress.
     *
     * <p>Only non-null fields in the request body are applied. Unknown fields are
     * rejected with 400 by GlobalExceptionHandler (UnrecognizedPropertyException).
     *
     * <p>Audit: {@code [TEST_PANEL] test.set_state}
     */
    @PostMapping("/users/{userId}/set-state")
    @Transactional
    public ResponseEntity<?> setState(@PathVariable String userId,
                                       @Valid @RequestBody SetStateRequest req) {
        User user = userRepository.findById(userId).orElseThrow();

        // ── Fields on UserDailyProgress (today) ──────────────────────────────
        boolean needsProgress = req.getLivesRemaining() != null || req.getQuestionsCounted() != null;
        if (needsProgress) {
            UserDailyProgress progress = dailyProgressRepository
                    .findByUserIdAndDate(userId, LocalDate.now(ZoneOffset.UTC))
                    .orElseGet(() -> {
                        UserDailyProgress p = new UserDailyProgress();
                        p.setId(UUID.randomUUID().toString());
                        p.setUser(user);
                        p.setDate(LocalDate.now(ZoneOffset.UTC));
                        p.setPointsCounted(0);
                        p.setLivesRemaining(100);
                        p.setQuestionsCounted(0);
                        return p;
                    });
            if (req.getLivesRemaining() != null) progress.setLivesRemaining(req.getLivesRemaining());
            if (req.getQuestionsCounted() != null) progress.setQuestionsCounted(req.getQuestionsCounted());
            dailyProgressRepository.save(progress);
        }

        // ── Fields on User ────────────────────────────────────────────────────
        boolean userDirty = false;
        if (req.getDaysAtTier6() != null) {
            user.setDaysAtTier6(req.getDaysAtTier6());
            userDirty = true;
        }
        if (req.getLastPlayedAt() != null) {
            user.setLastPlayedAt(req.getLastPlayedAt().atStartOfDay());
            userDirty = true;
        }
        if (req.getXpSurgeHoursFromNow() != null) {
            if (req.getXpSurgeHoursFromNow() == 0) {
                user.setXpSurgeUntil(null);
            } else {
                user.setXpSurgeUntil(LocalDateTime.now().plusHours(req.getXpSurgeHoursFromNow()));
            }
            userDirty = true;
        }
        if (userDirty) userRepository.save(user);

        // ── Audit ─────────────────────────────────────────────────────────────
        Map<String, Object> applied = new LinkedHashMap<>();
        if (req.getLivesRemaining() != null)      applied.put("livesRemaining", req.getLivesRemaining());
        if (req.getQuestionsCounted() != null)     applied.put("questionsCounted", req.getQuestionsCounted());
        if (req.getDaysAtTier6() != null)          applied.put("daysAtTier6", req.getDaysAtTier6());
        if (req.getLastPlayedAt() != null)         applied.put("lastPlayedAt", req.getLastPlayedAt().toString());
        if (req.getXpSurgeHoursFromNow() != null)  applied.put("xpSurgeHoursFromNow", req.getXpSurgeHoursFromNow());
        log.warn("[TEST_PANEL] test.set_state user={} fields={}", userId, applied);

        return ResponseEntity.ok(Map.of("userId", userId, "applied", applied));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // New endpoint — seed exact totalPoints (Phase 4a blocker fix)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Seed a user to an exact {@code totalPoints} value by wiping all their
     * {@link UserDailyProgress} rows and inserting a single fresh row today.
     *
     * <p>Needed because {@code UserTierService.getTotalPoints()} returns
     * {@code SUM(UserDailyProgress.pointsCounted)} — there is no direct
     * {@code User.totalPoints} column. Tests that need a user at e.g. 4999
     * points (sát ngưỡng tier 4) must therefore replace progress history.
     *
     * <p>The new row also resets {@code livesRemaining=100} and
     * {@code questionsCounted=0} to pair with a clean state (a typical test
     * wants both "exact points" and "ready to play").
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_points}
     */
    @PostMapping("/users/{userId}/seed-points")
    @Transactional
    public ResponseEntity<?> seedPoints(@PathVariable String userId,
                                         @Valid @RequestBody SeedPointsRequest req) {
        User user = userRepository.findById(userId).orElseThrow();

        // Wipe all existing daily progress rows for this user
        List<UserDailyProgress> existing = dailyProgressRepository.findByUserIdOrderByDateDesc(userId);
        int wipedCount = existing.size();
        if (!existing.isEmpty()) {
            dailyProgressRepository.deleteAll(existing);
            // Flush so the INSERT below doesn't conflict with cached entities
            dailyProgressRepository.flush();
        }

        // Create single fresh row today with the target points
        UserDailyProgress fresh = new UserDailyProgress();
        fresh.setId(UUID.randomUUID().toString());
        fresh.setUser(user);
        fresh.setDate(LocalDate.now(ZoneOffset.UTC));
        fresh.setPointsCounted(req.getTotalPoints());
        fresh.setLivesRemaining(100);
        fresh.setQuestionsCounted(0);
        dailyProgressRepository.save(fresh);

        RankTier tier = RankTier.fromPoints(req.getTotalPoints());

        log.warn("[TEST_PANEL] test.seed_points user={} totalPoints={} wipedRows={} newTier={}",
                userId, req.getTotalPoints(), wipedCount, tier.name());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("userId", userId);
        response.put("totalPoints", req.getTotalPoints());
        response.put("tierLevel", tier.ordinal() + 1);
        response.put("tierName", tier.getDisplayName());
        response.put("wipedRows", wipedCount);
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // New endpoints — mission state override (GAP-5)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Override DailyMission state for one or more missions on a given date.
     *
     * <p>Looks up missions by (userId, date, missionType). If a missionType is not
     * found for that date, a 404 is returned. Null fields within each MissionUpdate
     * are treated as no-ops.
     *
     * <p>Audit: {@code [TEST_PANEL] test.set_mission_state}
     */
    @PostMapping("/users/{userId}/set-mission-state")
    @Transactional
    public ResponseEntity<?> setMissionState(@PathVariable String userId,
                                              @Valid @RequestBody SetMissionStateRequest req) {
        LocalDate targetDate = req.getDate() != null
                ? req.getDate()
                : LocalDate.now(ZoneOffset.UTC);

        List<DailyMission> existing = dailyMissionRepository
                .findByUserIdAndDateOrderByMissionSlot(userId, targetDate);

        if (existing.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "No daily missions found for user " + userId + " on " + targetDate));
        }

        Map<String, List<DailyMission>> byType = new HashMap<>();
        for (DailyMission m : existing) {
            byType.computeIfAbsent(m.getMissionType(), k -> new ArrayList<>()).add(m);
        }

        List<String> notFound = new ArrayList<>();
        int updatedCount = 0;

        for (SetMissionStateRequest.MissionUpdate upd : req.getMissions()) {
            List<DailyMission> targets = byType.get(upd.getMissionType());
            if (targets == null || targets.isEmpty()) {
                notFound.add(upd.getMissionType());
                continue;
            }
            for (DailyMission m : targets) {
                if (upd.getProgress() != null)      m.setProgress(upd.getProgress());
                if (upd.getCompleted() != null)     m.setCompleted(upd.getCompleted());
                if (upd.getBonusClaimed() != null)  m.setBonusClaimed(upd.getBonusClaimed());
            }
            dailyMissionRepository.saveAll(targets);
            updatedCount += targets.size();
        }

        if (!notFound.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "Mission types not found for date " + targetDate + ": " + notFound));
        }

        log.warn("[TEST_PANEL] test.set_mission_state user={} date={} missionCount={}",
                userId, targetDate, updatedCount);

        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "date", targetDate.toString(),
                "updatedMissions", updatedCount
        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // New endpoints — seed data for e2e tests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Mark today's daily challenge as completed for a user (by email).
     *
     * <p>Delegates to {@link DailyChallengeService#markCompleted} which records
     * the completion in the Redis cache. Subsequent calls to
     * {@code GET /api/daily-challenge} will return {@code alreadyCompleted: true}
     * for this user.
     *
     * <p>Audit: {@code [TEST_PANEL] test.daily_complete}
     */
    @PostMapping("/daily-complete")
    public ResponseEntity<?> dailyComplete(@RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        Integer score = body.get("score") != null ? ((Number) body.get("score")).intValue() : 5;

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "email required"));
        }
        if (score < 0 || score > 5) {
            return ResponseEntity.badRequest().body(Map.of("error", "score must be 0-5"));
        }

        User user = userRepository.findByEmail(email)
                .orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found: " + email));
        }

        dailyChallengeService.markCompleted(user.getId(), score, score);

        log.warn("[TEST_PANEL] test.daily_complete user={} score={}", user.getId(), score);

        return ResponseEntity.ok(Map.of(
                "userId", user.getId(),
                "email", email,
                "score", score,
                "completed", true,
                "date", LocalDate.now(ZoneOffset.UTC).toString()
        ));
    }

    /**
     * Create a test group with the given owner as LEADER and add the specified users as MEMBERs.
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_group}
     */
    @PostMapping("/seed-group")
    @Transactional
    public ResponseEntity<?> seedGroup(@RequestBody Map<String, Object> body) {
        String ownerEmail = (String) body.get("ownerEmail");
        String groupName = (String) body.getOrDefault("groupName", "E2E Test Group");
        @SuppressWarnings("unchecked")
        List<String> memberEmails = (List<String>) body.getOrDefault("memberEmails", List.of());

        if (ownerEmail == null || ownerEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "ownerEmail required"));
        }

        User owner = userRepository.findByEmail(ownerEmail).orElse(null);
        if (owner == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Owner not found: " + ownerEmail));
        }

        // Create group. Explicit timestamps bypass a Hibernate quirk where the
        // second save() below would merge a detached entity and overwrite
        // created_at with null (NOT NULL constraint violation). @CreationTimestamp
        // on the entity fires only on the managed copy, not the caller's reference.
        LocalDateTime now = LocalDateTime.now();
        ChurchGroup group = new ChurchGroup();
        group.setId(UUID.randomUUID().toString());
        group.setName(groupName);
        group.setGroupCode(generateTestGroupCode());
        group.setDescription("Seeded by e2e test helper");
        group.setLeader(owner);
        group.setMemberCount(1);
        group.setCreatedAt(now);
        group.setUpdatedAt(now);
        group = churchGroupRepository.save(group);

        // Add leader as member
        GroupMember leaderMember = new GroupMember();
        leaderMember.setId(UUID.randomUUID().toString());
        leaderMember.setGroup(group);
        leaderMember.setUser(owner);
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        groupMemberRepository.save(leaderMember);

        // Add additional members
        List<String> addedMembers = new ArrayList<>();
        List<String> missingMembers = new ArrayList<>();
        int memberCount = 1;
        for (String memberEmail : memberEmails) {
            User member = userRepository.findByEmail(memberEmail).orElse(null);
            if (member == null) {
                missingMembers.add(memberEmail);
                continue;
            }
            if (member.getId().equals(owner.getId())) {
                continue; // Skip owner (already added as leader)
            }
            GroupMember gm = new GroupMember();
            gm.setId(UUID.randomUUID().toString());
            gm.setGroup(group);
            gm.setUser(member);
            gm.setRole(GroupMember.GroupRole.MEMBER);
            groupMemberRepository.save(gm);
            addedMembers.add(memberEmail);
            memberCount++;
        }
        group.setMemberCount(memberCount);
        group = churchGroupRepository.save(group);

        log.warn("[TEST_PANEL] test.seed_group groupId={} owner={} members={} missing={}",
                group.getId(), ownerEmail, addedMembers, missingMembers);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("groupId", group.getId());
        response.put("groupName", groupName);
        response.put("groupCode", group.getGroupCode());
        response.put("ownerEmail", ownerEmail);
        response.put("addedMembers", addedMembers);
        response.put("missingMembers", missingMembers);
        response.put("memberCount", memberCount);
        return ResponseEntity.ok(response);
    }

    /**
     * Create a tournament in LOBBY state with specified users as participants.
     * First participant email becomes the creator.
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_tournament}
     */
    @PostMapping("/seed-tournament")
    @Transactional
    public ResponseEntity<?> seedTournament(@RequestBody Map<String, Object> body) {
        String tournamentName = (String) body.getOrDefault("tournamentName", "E2E Test Tournament");
        @SuppressWarnings("unchecked")
        List<String> participantEmails = (List<String>) body.getOrDefault("participantEmails", List.of());

        if (participantEmails.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "participantEmails required (>=1)"));
        }

        // First email is creator
        User creator = userRepository.findByEmail(participantEmails.get(0)).orElse(null);
        if (creator == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Creator not found: " + participantEmails.get(0)));
        }

        Tournament tournament = new Tournament();
        tournament.setId(UUID.randomUUID().toString());
        tournament.setName(tournamentName);
        tournament.setCreator(creator);
        tournament.setBracketSize(8);
        tournament.setStatus(Tournament.Status.LOBBY);
        tournament.setCurrentRound(0);
        tournamentRepository.save(tournament);

        List<String> addedParticipants = new ArrayList<>();
        List<String> missingParticipants = new ArrayList<>();
        for (String email : participantEmails) {
            User u = userRepository.findByEmail(email).orElse(null);
            if (u == null) {
                missingParticipants.add(email);
                continue;
            }
            TournamentParticipant tp = new TournamentParticipant();
            tp.setId(UUID.randomUUID().toString());
            tp.setTournament(tournament);
            tp.setUser(u);
            tp.setEliminated(false);
            tournamentParticipantRepository.save(tp);
            addedParticipants.add(email);
        }

        log.warn("[TEST_PANEL] test.seed_tournament tournamentId={} creator={} participants={} missing={}",
                tournament.getId(), creator.getEmail(), addedParticipants, missingParticipants);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tournamentId", tournament.getId());
        response.put("tournamentName", tournamentName);
        response.put("status", tournament.getStatus().name());
        response.put("creatorEmail", creator.getEmail());
        response.put("addedParticipants", addedParticipants);
        response.put("missingParticipants", missingParticipants);
        return ResponseEntity.ok(response);
    }

    /**
     * Flip N existing questions to PENDING review status so the admin review
     * queue has seed data.
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_review_queue}
     */
    @PostMapping("/seed-review-queue")
    @Transactional
    public ResponseEntity<?> seedReviewQueue(@RequestBody Map<String, Object> body) {
        int count = body.get("count") != null ? ((Number) body.get("count")).intValue() : 5;
        if (count < 1 || count > 100) {
            return ResponseEntity.badRequest().body(Map.of("error", "count must be 1-100"));
        }

        // Grab N active questions to flip to PENDING
        List<Question> pool = questionRepository.findByIsActiveTrue(PageRequest.of(0, count)).getContent();
        if (pool.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "No active questions in database to seed"));
        }

        int flipped = 0;
        List<String> ids = new ArrayList<>();
        for (Question q : pool) {
            q.setReviewStatus(Question.ReviewStatus.PENDING);
            ids.add(q.getId());
            flipped++;
            if (flipped >= count) break;
        }
        questionRepository.saveAll(pool.subList(0, flipped));

        log.warn("[TEST_PANEL] test.seed_review_queue count={} flipped={}", count, flipped);

        return ResponseEntity.ok(Map.of(
                "requested", count,
                "flipped", flipped,
                "questionIds", ids
        ));
    }

    /**
     * Create N feedback entries from a given user (all pending, type=general).
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_feedback}
     */
    @PostMapping("/seed-feedback")
    @Transactional
    public ResponseEntity<?> seedFeedback(@RequestBody Map<String, Object> body) {
        String userEmail = (String) body.get("userEmail");
        int count = body.get("count") != null ? ((Number) body.get("count")).intValue() : 3;

        if (userEmail == null || userEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "userEmail required"));
        }
        if (count < 1 || count > 50) {
            return ResponseEntity.badRequest().body(Map.of("error", "count must be 1-50"));
        }

        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found: " + userEmail));
        }

        List<String> createdIds = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Feedback f = new Feedback(
                    UUID.randomUUID().toString(),
                    user,
                    Feedback.Type.general,
                    "E2E test feedback #" + (i + 1) + " from " + userEmail
            );
            f.setStatus(Feedback.Status.pending);
            feedbackRepository.save(f);
            createdIds.add(f.getId());
        }

        log.warn("[TEST_PANEL] test.seed_feedback user={} count={}", user.getId(), count);

        return ResponseEntity.ok(Map.of(
                "userId", user.getId(),
                "email", userEmail,
                "created", createdIds.size(),
                "feedbackIds", createdIds
        ));
    }

    /**
     * Seed ranked progress for today — sets questionsCounted and pointsToday
     * on the user's UserDailyProgress for today, so the Ranked page shows
     * meaningful data.
     *
     * <p>Audit: {@code [TEST_PANEL] test.seed_ranked_progress}
     */
    @PostMapping("/seed-ranked-progress")
    @Transactional
    public ResponseEntity<?> seedRankedProgress(@RequestBody Map<String, Object> body) {
        String email = (String) body.get("email");
        Integer questionsAnswered = body.get("questionsAnswered") != null
                ? ((Number) body.get("questionsAnswered")).intValue() : 20;
        Integer correctAnswers = body.get("correctAnswers") != null
                ? ((Number) body.get("correctAnswers")).intValue() : 15;

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "email required"));
        }
        if (correctAnswers > questionsAnswered) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "correctAnswers cannot exceed questionsAnswered"));
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found: " + email));
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        final User userRef = user;
        UserDailyProgress progress = dailyProgressRepository
                .findByUserIdAndDate(user.getId(), today)
                .orElseGet(() -> {
                    UserDailyProgress p = new UserDailyProgress();
                    p.setId(UUID.randomUUID().toString());
                    p.setUser(userRef);
                    p.setDate(today);
                    p.setLivesRemaining(100);
                    p.setPointsCounted(0);
                    p.setQuestionsCounted(0);
                    return p;
                });

        // Points: 10 per correct answer (simple formula for seed data)
        int pointsToday = correctAnswers * 10;
        progress.setQuestionsCounted(questionsAnswered);
        progress.setPointsCounted(pointsToday);
        dailyProgressRepository.save(progress);

        log.warn("[TEST_PANEL] test.seed_ranked_progress user={} questions={} correct={} points={}",
                user.getId(), questionsAnswered, correctAnswers, pointsToday);

        return ResponseEntity.ok(Map.of(
                "userId", user.getId(),
                "email", email,
                "date", today.toString(),
                "questionsAnswered", questionsAnswered,
                "correctAnswers", correctAnswers,
                "pointsToday", pointsToday
        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static final String GROUP_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final java.security.SecureRandom GROUP_CODE_RNG = new java.security.SecureRandom();

    private String generateTestGroupCode() {
        // 6-char alphanumeric, retry on collision (up to 10 attempts)
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(GROUP_CODE_CHARS.charAt(GROUP_CODE_RNG.nextInt(GROUP_CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (churchGroupRepository.findByGroupCode(code).isEmpty()) {
                return code;
            }
        }
        // Fallback: use UUID-derived code (extremely unlikely to collide)
        return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }
}
