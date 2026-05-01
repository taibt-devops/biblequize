package com.biblequiz.api;

import com.biblequiz.api.dto.PromoteAdminRequest;
import com.biblequiz.api.dto.UserResponse;
import com.biblequiz.infrastructure.audit.AuditEventStatus;
import com.biblequiz.infrastructure.audit.AuditService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.user.service.AccountDeletionService;
import com.biblequiz.modules.quiz.service.BookMasteryService;
import com.biblequiz.modules.ranked.service.TierProgressService;
import com.biblequiz.modules.ranked.service.UserTierService;
import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.user.service.ComebackService;
import com.biblequiz.modules.user.service.CosmeticService;
import com.biblequiz.modules.ranked.service.PrestigeService;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import com.biblequiz.modules.quiz.entity.QuizSession;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping({"/me", "/api/me"})
@CrossOrigin(origins = "*")
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private AuditService auditService;

    @Autowired
    private QuizSessionRepository quizSessionRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private UserQuestionHistoryRepository userQuestionHistoryRepository;

    @Autowired
    private AccountDeletionService accountDeletionService;

    @Autowired
    private BookMasteryService bookMasteryService;

    @Autowired
    private TierProgressService tierProgressService;

    @Autowired
    private UserTierService userTierService;

    @Autowired
    private DailyMissionService dailyMissionService;

    @Autowired
    private ComebackService comebackService;

    @Autowired
    private CosmeticService cosmeticService;

    @Autowired
    private PrestigeService prestigeService;

    @GetMapping
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
        
        if (authentication == null || !authentication.isAuthenticated()) {
            logger.warn("Unauthenticated request to /api/me");
            return ResponseEntity.status(401).build();
        }
        
        String userEmail = null;
        if (authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            userEmail = userDetails.getUsername();
            logger.info("GET /api/me called by JWT user: {}", userEmail);
        } else if (authentication.getPrincipal() instanceof OAuth2User) {
            OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
            userEmail = oauth2User.getAttribute("email");
            logger.info("GET /api/me called by OAuth2 user: {}", userEmail);
        } else {
            logger.warn("Unknown authentication principal type: {}", authentication.getPrincipal().getClass().getName());
            return ResponseEntity.status(401).build();
        }

        Optional<User> userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isEmpty()) {
            logger.warn("User not found in database: {}", userEmail);
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        logger.info("User profile retrieved: {} ({})", user.getName(), user.getRole());
        return ResponseEntity.ok(new UserResponse(user));
    }

    @PatchMapping
    public ResponseEntity<Map<String, Object>> updateCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> updates) {
        
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of(
                "code", "UNAUTHORIZED",
                "message", "User not authenticated"
            ));
        }

        Optional<User> userOpt = userRepository.findByEmail(userDetails.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        // Update allowed fields
        if (updates.containsKey("name")) {
            user.setName(updates.get("name"));
        }
        if (updates.containsKey("avatarUrl")) {
            user.setAvatarUrl(updates.get("avatarUrl"));
        }

        user = userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("avatarUrl", user.getAvatarUrl());
        response.put("role", user.getRole());
        response.put("updatedAt", user.getUpdatedAt());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/promote-admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> promoteToAdmin(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PromoteAdminRequest request,
            HttpServletRequest httpRequest) {

        logger.info("Admin promotion request by {} for user: {}", userDetails.getUsername(), request.getEmail());
        
        try {
            Optional<User> targetUserOpt = userRepository.findByEmail(request.getEmail());
            if (targetUserOpt.isEmpty()) {
                logger.warn("User not found for promotion: {}", request.getEmail());
                auditService.logAdminAction(
                    "PROMOTE_ADMIN_FAILED", 
                    "USER", 
                    "User not found: " + request.getEmail(),
                    httpRequest, 
                    AuditEventStatus.FAILURE
                );
                return ResponseEntity.notFound().build();
            }

            User targetUser = targetUserOpt.get();
            if ("ADMIN".equals(targetUser.getRole())) {
                logger.info("User {} is already admin", request.getEmail());
                auditService.logAdminAction(
                    "PROMOTE_ADMIN_ALREADY_ADMIN", 
                    "USER", 
                    "User already admin: " + request.getEmail(),
                    httpRequest, 
                    AuditEventStatus.SUCCESS
                );
                return ResponseEntity.ok(Map.of(
                    "code", "SUCCESS",
                    "message", "User is already admin",
                    "user", new UserResponse(targetUser)
                ));
            }
            
            String oldRole = targetUser.getRole();
            targetUser.setRole("ADMIN");
            userRepository.save(targetUser);
            
            auditService.logAdminAction(
                "PROMOTE_ADMIN_SUCCESS", 
                "USER", 
                String.format("Promoted user %s from %s to ADMIN", request.getEmail(), oldRole),
                httpRequest, 
                AuditEventStatus.SUCCESS
            );
            
            logger.info("User {} promoted to admin by {}", request.getEmail(), userDetails.getUsername());

            return ResponseEntity.ok(Map.of(
                "code", "SUCCESS",
                "message", "User promoted to admin successfully",
                "user", new UserResponse(targetUser)
            ));
            
        } catch (Exception e) {
            logger.error("Error promoting user to admin: {}", e.getMessage(), e);
            auditService.logAdminAction(
                "PROMOTE_ADMIN_ERROR", 
                "USER", 
                "Error promoting user: " + e.getMessage(),
                httpRequest, 
                AuditEventStatus.FAILURE
            );
            return ResponseEntity.status(500).body(Map.of(
                "code", "ERROR",
                "message", "Internal server error"
            ));
        }
    }

    @PostMapping("/bootstrap-admin")
    public ResponseEntity<Map<String, Object>> bootstrapAdmin(
            @RequestBody Map<String, String> request) {
        
        String email = request.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "BAD_REQUEST",
                "message", "Email is required"
            ));
        }

        // Check if any admin already exists
        List<User> existingAdmins = userRepository.findAll().stream()
            .filter(user -> "ADMIN".equals(user.getRole()))
            .toList();
        
        if (!existingAdmins.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of(
                "code", "CONFLICT",
                "message", "Admin users already exist. Use /promote-admin endpoint instead."
            ));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                "code", "NOT_FOUND",
                "message", "User not found with email: " + email
            ));
        }

        User user = userOpt.get();
        user.setRole("ADMIN");
        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "code", "SUCCESS",
            "message", "First admin user created successfully",
            "user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole()
            )
        ));
    }

    /**
     * GET /api/me/history — Session history (newest first, paginated).
     *
     * <p>{@code mode} optionally narrows to a single QuizSession.Mode
     * (e.g. {@code ranked} for the Ranked dashboard's recent-matches
     * row). Unknown values fall through to the unfiltered query so a
     * malformed param never 4xxs — the caller just sees the full list.
     */
    @GetMapping("/history")
    public ResponseEntity<?> getHistory(Authentication authentication,
                                        @RequestParam(defaultValue = "20") int limit,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(required = false) String mode) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        QuizSession.Mode modeFilter = null;
        if (mode != null && !mode.isBlank()) {
            try {
                modeFilter = QuizSession.Mode.valueOf(mode.trim().toLowerCase());
            } catch (IllegalArgumentException ignore) {
                // Unknown mode → fall through to unfiltered listing.
            }
        }
        Page<QuizSession> sessions = modeFilter != null
                ? quizSessionRepository.findByOwnerIdAndModeOrderByCreatedAtDesc(
                        user.getId(), modeFilter, PageRequest.of(page, limit))
                : quizSessionRepository.findByOwnerIdOrderByCreatedAtDesc(
                        user.getId(), PageRequest.of(page, limit));

        List<Map<String, Object>> items = sessions.getContent().stream().map(s -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", s.getId());
            item.put("mode", s.getMode().name());
            item.put("status", s.getStatus().name());
            item.put("score", s.getScore());
            item.put("totalQuestions", s.getTotalQuestions());
            item.put("correctAnswers", s.getCorrectAnswers());
            item.put("createdAt", s.getCreatedAt());
            return item;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "items", items,
                "totalPages", sessions.getTotalPages(),
                "totalItems", sessions.getTotalElements(),
                "currentPage", page,
                "hasMore", sessions.hasNext()
        ));
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(Authentication authentication,
                                            @RequestBody Map<String, String> body) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String confirmPhrase = body.get("confirmPhrase");
        if (!"XÓA TÀI KHOẢN".equals(confirmPhrase) && !"DELETE ACCOUNT".equals(confirmPhrase)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Nhập 'XÓA TÀI KHOẢN' để xác nhận"));
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        accountDeletionService.deleteUserAccount(userOpt.get().getId());
        return ResponseEntity.ok(Map.of("message", "Tài khoản đã được xóa"));
    }

    @GetMapping("/journey")
    public ResponseEntity<?> getJourney(Authentication authentication,
                                         @RequestParam(defaultValue = "vi") String language) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        return ResponseEntity.ok(bookMasteryService.getJourney(userOpt.get().getId(), language));
    }

    @GetMapping("/question-coverage")
    public ResponseEntity<?> getQuestionCoverage(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        long totalQuestions = questionRepository.countByFilters(null, null, null, null);
        long seenQuestions = userQuestionHistoryRepository.countByUserId(user.getId());
        long masteredQuestions = userQuestionHistoryRepository.countMasteredByUserId(user.getId());
        long needReview = userQuestionHistoryRepository
                .findNeedReviewQuestionIds(user.getId(), java.time.LocalDateTime.now()).size();

        double coveragePercent = totalQuestions > 0
                ? Math.round((double) seenQuestions / totalQuestions * 10000.0) / 100.0
                : 0;

        List<Object[]> bookCounts = userQuestionHistoryRepository.countSeenByBook(user.getId());
        List<Map<String, Object>> byBook = bookCounts.stream().map(row -> {
            String book = (String) row[0];
            long seen = ((Number) row[1]).longValue();
            long bookTotal = questionRepository.countByFilters(book, null, null, null);
            double pct = bookTotal > 0 ? Math.round((double) seen / bookTotal * 10000.0) / 100.0 : 0;
            return Map.<String, Object>of(
                    "book", book, "total", bookTotal, "seen", seen, "percent", pct);
        }).toList();

        return ResponseEntity.ok(Map.of(
                "totalQuestions", totalQuestions,
                "seenQuestions", seenQuestions,
                "coveragePercent", coveragePercent,
                "byBook", byBook,
                "needReview", needReview,
                "masteredQuestions", masteredQuestions
        ));
    }

    @GetMapping("/tier-progress")
    public ResponseEntity<?> getTierProgress(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        long totalPoints = userTierService.getTotalPoints(userOpt.get().getId());
        TierProgressService.StarInfo info = tierProgressService.getStarInfo(totalPoints);

        Map<String, Object> response = new HashMap<>();
        response.put("tierLevel", info.tierLevel());
        response.put("tierName", info.tierName());
        response.put("totalPoints", info.totalPoints());
        response.put("nextTierPoints", info.nextTierPoints());
        response.put("tierProgressPercent", info.tierProgressPercent());
        response.put("starIndex", info.starIndex());
        response.put("starXp", info.starXp());
        response.put("nextStarXp", info.nextStarXp());
        response.put("starProgressPercent", info.starProgressPercent());
        response.put("milestone", info.milestone());

        // XP surge info — Milestone Burst (Task TP-5).
        // TODO: Re-enable when Milestone Burst is wired into RankedController. The
        // multiplier path lives in ScoringService.calculateWithTier(xpSurgeActive),
        // but RankedController.submitRankedAnswer currently calls scoringService.calculate(...)
        // (no tier/surge variant), so xpSurgeUntil never affects awarded points. Until
        // that wiring lands, advertise surgeActive=false / surgeMultiplier=1.0 to avoid
        // misleading users with a non-functional 1.5x badge in the FE.
        // See User.xpSurgeUntil + AUDIT_VARIETY_MODES_LEADERBOARD.md ambiguous #3.
        response.put("surgeActive", false);
        response.put("surgeUntil", null);
        response.put("surgeMultiplier", 1.0);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/daily-missions")
    public ResponseEntity<?> getDailyMissions(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        return ResponseEntity.ok(dailyMissionService.getMissionsResponse(userOpt.get().getId()));
    }

    @GetMapping("/comeback-status")
    public ResponseEntity<?> getComebackStatus(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        ComebackService.ComebackStatus status = comebackService.getStatus(userOpt.get().getId());
        Map<String, Object> response = new HashMap<>();
        response.put("daysSinceLastPlay", status.daysSinceLastPlay());
        response.put("rewardTier", status.rewardTier());
        response.put("claimed", status.claimed());
        response.put("reward", status.reward());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/comeback-claim")
    public ResponseEntity<?> claimComeback(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        return ResponseEntity.ok(comebackService.claim(userOpt.get().getId()));
    }

    @GetMapping("/cosmetics")
    public ResponseEntity<?> getCosmetics(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        int tierLevel = userTierService.getTierLevel(userOpt.get().getId());
        return ResponseEntity.ok(cosmeticService.getResponse(userOpt.get().getId(), tierLevel));
    }

    @PatchMapping("/cosmetics")
    public ResponseEntity<?> updateCosmetics(Authentication authentication,
                                              @RequestBody Map<String, String> body) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            cosmeticService.updateActive(
                    userOpt.get().getId(),
                    body.get("activeFrame"),
                    body.get("activeTheme")
            );
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/prestige-status")
    public ResponseEntity<?> getPrestigeStatus(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        PrestigeService.PrestigeStatus status = prestigeService.getStatus(userOpt.get().getId());
        Map<String, Object> response = new HashMap<>();
        response.put("canPrestige", status.canPrestige());
        response.put("prestigeLevel", status.prestigeLevel());
        response.put("daysAtTier6", status.daysAtTier6());
        response.put("daysRequired", status.daysRequired());
        response.put("nextPrestigeName", status.nextPrestigeName());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/prestige")
    public ResponseEntity<?> executePrestige(Authentication authentication,
                                              @RequestBody(required = false) Map<String, Object> body) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        // Require confirmation
        if (body == null || !Boolean.TRUE.equals(body.get("confirm"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Phải xác nhận confirm: true"));
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        Map<String, Object> result = prestigeService.executePrestige(userOpt.get().getId());
        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/weaknesses")
    public ResponseEntity<?> getWeaknesses(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String email = null;
        if (authentication.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (authentication.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }

        Optional<User> userOpt = email != null ? userRepository.findByEmail(email) : Optional.empty();
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        String userId = userOpt.get().getId();
        List<Object[]> bookStats = userQuestionHistoryRepository.getAccuracyByBook(userId);

        // Build accuracy list: only books with >= 5 answers
        List<Map<String, Object>> bookAccuracies = new java.util.ArrayList<>();
        for (Object[] row : bookStats) {
            String book = (String) row[0];
            long seen = ((Number) row[1]).longValue();
            long correct = ((Number) row[2]).longValue();
            long wrong = ((Number) row[3]).longValue();
            long total = correct + wrong;
            if (total < 5) continue;
            double accuracy = total > 0 ? Math.round((double) correct / total * 1000.0) / 10.0 : 0;
            bookAccuracies.add(Map.of(
                "book", book,
                "totalAnswered", total,
                "correct", correct,
                "wrong", wrong,
                "accuracy", accuracy
            ));
        }

        // Sort by accuracy ascending for weak books
        bookAccuracies.sort((a, b) -> Double.compare(
            ((Number) a.get("accuracy")).doubleValue(),
            ((Number) b.get("accuracy")).doubleValue()
        ));

        List<Map<String, Object>> weakBooks = bookAccuracies.stream().limit(3).toList();
        List<Map<String, Object>> strongBooks = bookAccuracies.stream()
            .sorted((a, b) -> Double.compare(
                ((Number) b.get("accuracy")).doubleValue(),
                ((Number) a.get("accuracy")).doubleValue()
            ))
            .limit(3).toList();

        String suggestedPractice = weakBooks.isEmpty() ? null : (String) weakBooks.get(0).get("book");

        Map<String, Object> response = new HashMap<>();
        response.put("weakBooks", weakBooks);
        response.put("strongBooks", strongBooks);
        response.put("suggestedPractice", suggestedPractice);
        return ResponseEntity.ok(response);
    }
}
