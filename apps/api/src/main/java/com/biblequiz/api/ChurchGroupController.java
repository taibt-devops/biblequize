package com.biblequiz.api;

import com.biblequiz.modules.adminai.AIGenerationService;
import com.biblequiz.modules.adminai.provider.AIGenerationContext;
import com.biblequiz.modules.adminai.provider.AIGenerationResult;
import com.biblequiz.modules.adminai.provider.AIProviderException;
import com.biblequiz.modules.adminai.provider.AIProviderRouter;
import com.biblequiz.modules.adminai.quota.AIQuotaService;
import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.entity.GroupQuizSet;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.group.service.ChurchGroupService;
import com.biblequiz.modules.group.service.GroupQuizSetMasteryService;
import com.biblequiz.modules.group.service.GroupStreakService;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/groups")
public class ChurchGroupController {

    @Autowired
    private ChurchGroupService churchGroupService;

    @Autowired
    private GroupStreakService groupStreakService;

    @Autowired
    private com.biblequiz.modules.group.service.GroupCollectiveGrowthService collectiveGrowthService;

    @Autowired
    private ChurchGroupRepository churchGroupRepository;

    @Autowired
    private GroupQuizSetRepository groupQuizSetRepository;

    @Autowired
    private GroupQuizSetMasteryService masteryService;

    @Autowired
    private com.biblequiz.modules.group.repository.GroupQuizSetMasteryRepository masteryRepository;

    @Autowired
    private com.biblequiz.modules.quiz.service.SessionService sessionService;

    @Autowired
    private com.biblequiz.modules.quiz.repository.QuizSessionRepository quizSessionRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private AIGenerationService aiGenerationService;

    @Autowired
    private AIProviderRouter aiProviderRouter;

    @Autowired
    private AIQuotaService aiQuotaService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomPlayerRepository roomPlayerRepository;

    /**
     * POST /api/groups - Tao nhom moi
     */
    @PostMapping
    public ResponseEntity<?> createGroup(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            String description = (String) body.get("description");
            // Default true (public) — discovery-first; user can opt out at create time.
            boolean isPublic = body.get("isPublic") == null ? true : Boolean.TRUE.equals(body.get("isPublic"));

            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ten nhom khong duoc de trong"));
            }

            Map<String, Object> result = churchGroupService.createGroup(name, description, isPublic, user);
            return ResponseEntity.ok(Map.of("success", true, "group", result));
        } catch (RuntimeException e) {
            // 422 + structured code so FE can show targeted "manage existing
            // groups first" CTA per SPEC §4.2.
            if ("MAX_GROUPS_OWNED".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "code", "MAX_GROUPS_OWNED",
                        "message", "Bạn đã tạo tối đa 2 nhóm. Hãy giải tán hoặc chuyển quyền 1 nhóm trước khi tạo nhóm mới."));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/me — current user's primary group (or hasGroup=false).
     * Powers the Home mode-card live hint per HM-P1-1.
     */
    @GetMapping("/me")
    public ResponseEntity<?> getMyGroup(Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(churchGroupService.getMyGroup(user.getId()));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("hasGroup", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/mine — full list of groups the user belongs to with
     * weekly summary (memberCount, avgScore, accuracy, lastActivityAt, myRank).
     * Powers the multi-group /groups index page.
     */
    @GetMapping("/mine")
    public ResponseEntity<?> listMyGroups(Principal principal) {
        try {
            User user = getUser(principal);
            List<Map<String, Object>> groups = churchGroupService.listMyGroupsWithSummary(user.getId());
            return ResponseEntity.ok(Map.of("success", true, "groups", groups));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/public — discovery widget on the empty-state Groups page.
     * Returns up to {@code limit} public groups; {@code featured=true} sorts by
     * memberCount, otherwise by createdAt. No auth required.
     */
    @GetMapping("/public")
    public ResponseEntity<?> listPublicGroups(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "false") boolean featured) {
        try {
            List<Map<String, Object>> groups = churchGroupService.listPublicGroups(limit, featured);
            return ResponseEntity.ok(Map.of("success", true, "groups", groups));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id} - Lay thong tin nhom (with viewer's myRole when authenticated)
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getGroupDetails(@PathVariable String id, Principal principal) {
        try {
            String viewerId = null;
            if (principal != null) {
                try { viewerId = getUser(principal).getId(); } catch (Exception ignored) {}
            }
            Map<String, Object> result = churchGroupService.getGroupDetails(id, viewerId);
            return ResponseEntity.ok(Map.of("success", true, "group", result));
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/join - Tham gia nhom theo ma
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@RequestBody Map<String, String> body, Principal principal) {
        try {
            User user = getUser(principal);
            String code = body.get("code");
            if (code == null || code.isBlank()) {
                code = body.get("groupCode");
            }
            if (code == null || code.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Thieu ma nhom"));
            }

            Map<String, Object> result = churchGroupService.joinGroup(code.trim().toUpperCase(), user);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (RuntimeException e) {
            if ("MAX_GROUPS_JOINED".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "code", "MAX_GROUPS_JOINED",
                        "message", "Bạn đã tham gia tối đa 5 nhóm. Hãy rời nhóm cũ trước khi tham gia nhóm mới."));
            }
            if ("KICK_COOLDOWN_ACTIVE".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "code", "KICK_COOLDOWN_ACTIVE",
                        "message", "Bạn đã bị kick khỏi nhóm này gần đây. Hãy thử lại sau 7 ngày."));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/groups/{id}/leave - Roi nhom
     */
    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            Map<String, Object> result = churchGroupService.leaveGroup(id, user);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (RuntimeException e) {
            if ("LEADER_CANNOT_LEAVE".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of("success", false, "message", "LEADER_CANNOT_LEAVE"));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/members — paginated, searchable, filterable members.
     * Supports search (name contains), sort (score | tier | activity | joined),
     * order (asc | desc), filter (leader | mod | member | inactive),
     * limit + cursor (string offset). Auth required (members + visitors).
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<?> listMembers(@PathVariable String id,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(defaultValue = "score") String sort,
                                         @RequestParam(defaultValue = "desc") String order,
                                         @RequestParam(required = false) String filter,
                                         @RequestParam(defaultValue = "20") int limit,
                                         @RequestParam(required = false) String cursor) {
        try {
            Map<String, Object> result = churchGroupService.listMembers(id, search, sort, order, filter, limit, cursor);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * PATCH /api/groups/{id}/members/{userId}/role — promote/demote member.
     * Body: {"role": "MEMBER" | "MOD"}. Only LEADER may call. LEADER role
     * cannot be assigned via this endpoint (transfer-leader is separate).
     */
    @PatchMapping("/{id}/members/{userId}/role")
    public ResponseEntity<?> changeMemberRole(@PathVariable String id,
                                              @PathVariable String userId,
                                              @RequestBody Map<String, String> body,
                                              Principal principal) {
        try {
            User user = getUser(principal);
            String role = body.get("role");
            Map<String, Object> result = churchGroupService.changeMemberRole(id, user.getId(), userId, role);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/leaderboard - Bang xep hang nhom
     */
    /**
     * BL-16 (Q-A sunset): the group leaderboard was retired in v1.4 (GD-1) and
     * replaced by Collective Growth (§18). The old impl summed ALL
     * UserDailyProgress (solo/ranked/daily drift) — never group-play-only. With
     * no remaining callers, the endpoint now returns 410 Gone.
     */
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<?> getLeaderboard(@PathVariable String id,
                                            @RequestParam(defaultValue = "weekly") String period) {
        return ResponseEntity.status(410).body(Map.of(
                "success", false,
                "code", "LEADERBOARD_DEPRECATED",
                "message", "Bang xep hang nhom da ngung. Hay dung Collective Growth (cung-nhau-thuoc-Loi)."));
    }

    /**
     * GET /api/groups/{id}/analytics - Thong ke nhom (chi leader/mod)
     */
    @GetMapping("/{id}/analytics")
    public ResponseEntity<?> getAnalytics(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            Map<String, Object> analytics = churchGroupService.getAnalytics(id, user.getId());
            return ResponseEntity.ok(Map.of("success", true, "analytics", analytics));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/streak - Group streak (Option A: >=1 active member/day).
     * Public to all members (no role gate) so member view can show it in sidebar.
     */
    @GetMapping("/{id}/streak")
    public ResponseEntity<?> getGroupStreak(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            // Verify membership (returns 403 via exception path below if not a member)
            groupMemberRepository.findByGroupIdAndUserId(id, user.getId())
                    .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));
            Map<String, Object> streak = groupStreakService.getGroupStreak(id);
            return ResponseEntity.ok(Map.of("success", true, "streak", streak));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/collective-growth — BL-23 "Cùng nhau thuộc Lời".
     * Chỉ số tập thể không-ranking (Q-A SAFE). Member-visible: mọi thành viên đều thấy (D5).
     */
    @GetMapping("/{id}/collective-growth")
    public ResponseEntity<?> getCollectiveGrowth(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            // Verify membership (non-member -> 400 via catch, giống getGroupStreak)
            groupMemberRepository.findByGroupIdAndUserId(id, user.getId())
                    .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));
            Map<String, Object> growth = collectiveGrowthService.getCollectiveGrowth(id);
            return ResponseEntity.ok(Map.of("success", true, "growth", growth));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets - Tao quiz set cho nhom
     */
    @PostMapping("/{id}/quiz-sets")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> createQuizSet(@PathVariable String id,
                                           @RequestBody Map<String, Object> body,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            List<String> questionIds = (List<String>) body.get("questionIds");

            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ten quiz set khong duoc de trong"));
            }
            if (questionIds == null) questionIds = new ArrayList<>();

            Map<String, Object> result = churchGroupService.createQuizSet(id, user.getId(), name, questionIds, body);
            return ResponseEntity.ok(Map.of("success", true, "quizSet", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * PATCH /api/groups/{id}/quiz-sets/{setId} - Sprint 5: cap nhat metadata + name + questions.
     */
    @PatchMapping("/{id}/quiz-sets/{setId}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> updateQuizSet(@PathVariable("id") String id,
                                           @PathVariable("setId") String setId,
                                           @RequestBody Map<String, Object> body,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            List<String> questionIds = body.get("questionIds") instanceof List<?> l ? (List<String>) l : null;
            Map<String, Object> result = churchGroupService.updateQuizSet(id, setId, user.getId(), name, questionIds, body);
            return ResponseEntity.ok(Map.of("success", true, "quizSet", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/quiz-sets - Danh sach quiz set cua nhom.
     * Sprint 5: hỗ trợ filter status/folder/search + sort + paging.
     * Visibility (Q-5 trigger): MEMBER chỉ thấy PUBLISHED + ARCHIVED;
     * LEADER/MOD và creator thêm thấy DRAFT của họ.
     */
    @GetMapping("/{id}/quiz-sets")
    public ResponseEntity<?> listQuizSets(@PathVariable String id,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String folder,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(required = false, defaultValue = "recent") String sort,
                                          @RequestParam(required = false, defaultValue = "0") int page,
                                          @RequestParam(required = false, defaultValue = "50") int size,
                                          Principal principal) {
        try {
            User user = getUser(principal);
            org.springframework.data.domain.Sort sortOrder;
            switch (sort) {
                case "popular" -> sortOrder = org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "playCount");
                case "name" -> sortOrder = org.springframework.data.domain.Sort.by("name");
                case "rating" -> sortOrder = org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "averageRating");
                default -> sortOrder = org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "publishedAt");
            }
            org.springframework.data.domain.Pageable pageable =
                    org.springframework.data.domain.PageRequest.of(page, Math.min(size, 100), sortOrder);

            GroupQuizSet.PublishStatus filterStatus = null;
            if (status != null && !status.isBlank()) {
                try { filterStatus = GroupQuizSet.PublishStatus.valueOf(status.toUpperCase()); }
                catch (IllegalArgumentException ignore) {}
            }
            String folderId = (folder == null || folder.isBlank() || "null".equals(folder)) ? null : folder;
            String searchQ = (search == null || search.isBlank()) ? null : search.trim();

            org.springframework.data.domain.Page<GroupQuizSet> result =
                    groupQuizSetRepository.findFiltered(id, filterStatus, folderId, searchQ, pageable);

            // Visibility filter: ẩn DRAFT của user khác trừ khi requester là LEADER/MOD.
            boolean isLeaderOrMod = isLeaderOrMod(id, user.getId());
            List<Map<String, Object>> items = result.getContent().stream()
                    .filter(qs -> {
                        if (qs.getPublishStatus() == GroupQuizSet.PublishStatus.SOFT_DELETED) return false;
                        if (qs.getPublishStatus() != GroupQuizSet.PublishStatus.DRAFT) return true;
                        // DRAFT: chỉ creator hoặc leader/mod
                        return isLeaderOrMod || qs.getCreatedBy().getId().equals(user.getId());
                    })
                    .map(com.biblequiz.modules.group.service.ChurchGroupService::quizSetToMap)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "quizSets", items,
                    "page", page,
                    "totalElements", result.getTotalElements(),
                    "totalPages", result.getTotalPages()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ── Sprint 5 Q-5: Quiz set workflow endpoints ──

    @PatchMapping("/{id}/quiz-sets/{setId}/publish")
    public ResponseEntity<?> publishQuizSet(@PathVariable("id") String id,
                                             @PathVariable("setId") String setId,
                                             Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "quizSet", churchGroupService.publishQuizSet(id, setId, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/quiz-sets/{setId}/archive")
    public ResponseEntity<?> archiveQuizSet(@PathVariable("id") String id,
                                             @PathVariable("setId") String setId,
                                             Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "quizSet", churchGroupService.archiveQuizSet(id, setId, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/quiz-sets/{setId}/unarchive")
    public ResponseEntity<?> unarchiveQuizSet(@PathVariable("id") String id,
                                               @PathVariable("setId") String setId,
                                               Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "quizSet", churchGroupService.unarchiveQuizSet(id, setId, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/quiz-sets/{setId}/clone")
    public ResponseEntity<?> cloneQuizSet(@PathVariable("id") String id,
                                           @PathVariable("setId") String setId,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "quizSet", churchGroupService.cloneQuizSet(id, setId, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/quiz-sets/{setId}")
    public ResponseEntity<?> deleteQuizSet(@PathVariable("id") String id,
                                            @PathVariable("setId") String setId,
                                            Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "quizSet", churchGroupService.softDeleteQuizSet(id, setId, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/{setId}/solo-practice — BL-S5-1.
     * Tạo QuizSession (mode=practice) từ group quiz set, set groupQuizSetId
     * để completeSession invoke MasteryService. Returns sessionId + questions.
     * Q-A SAFE — KHÔNG vào group leaderboard.
     */
    @PostMapping("/{id}/quiz-sets/{setId}/solo-practice")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> startSoloPractice(@PathVariable("id") String groupId,
                                                @PathVariable("setId") String setId,
                                                Principal principal) {
        try {
            User user = getUser(principal);
            // Membership check (member trở lên có quyền tự ôn)
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));

            GroupQuizSet gqs = groupQuizSetRepository.findById(setId)
                    .orElseThrow(() -> new RuntimeException("Quiz set khong ton tai"));
            if (!gqs.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403).body(Map.of("success", false,
                        "message", "Quiz set khong thuoc nhom nay"));
            }
            // Cho phép cả PUBLISHED và ARCHIVED tự ôn (DRAFT chỉ creator).
            if (gqs.getPublishStatus() == GroupQuizSet.PublishStatus.SOFT_DELETED
                    || (gqs.getPublishStatus() == GroupQuizSet.PublishStatus.DRAFT
                        && !gqs.getCreatedBy().getId().equals(user.getId()))) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Khong the on tap bo cau hoi nay"));
            }
            List<String> qids = (List<String>) gqs.getQuestionIds();
            if (qids == null || qids.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Bo cau hoi rong"));
            }

            // Delegate sang SessionService để tạo session với mode=practice + groupQuizSetId.
            Map<String, Object> config = new java.util.HashMap<>();
            config.put("groupQuizSetId", setId);
            config.put("customQuestionIds", qids);
            config.put("questionCount", qids.size());
            config.put("language", gqs.getLanguage() != null ? gqs.getLanguage().toLowerCase() : "vi");
            Map<String, Object> result = sessionService.createSession(user.getId(),
                    com.biblequiz.modules.quiz.entity.QuizSession.Mode.practice, config);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/quiz-sets/{setId}/my-mastery — Sprint 5 (Q-A SAFE).
     * Personal mastery progress của requester với quiz set này.
     */
    @GetMapping("/{id}/quiz-sets/{setId}/my-mastery")
    public ResponseEntity<?> getMyMastery(@PathVariable("id") String groupId,
                                           @PathVariable("setId") String setId,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            // Verify membership
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));
            return ResponseEntity.ok(Map.of("success", true,
                    "mastery", masteryService.getMastery(setId, user.getId())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{groupId}/quiz-sets/{setId}/my-attempts
     * Solo replay history (last 10 completed) + mastery summary cho FE my-attempts panel.
     * Q-A SAFE — đọc từ quiz_sessions (V53 group_quiz_set_id link) + group_quiz_set_mastery.
     * Allow cho mọi status (kể cả ARCHIVED) vì user có thể đã chơi trước khi bị archive.
     */
    @GetMapping("/{groupId}/quiz-sets/{setId}/my-attempts")
    public ResponseEntity<?> getMyAttempts(@PathVariable("groupId") String groupId,
                                            @PathVariable("setId") String setId,
                                            Principal principal) {
        try {
            User user = getUser(principal);
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));

            GroupQuizSet gqs = groupQuizSetRepository.findById(setId)
                    .orElseThrow(() -> new RuntimeException("Quiz set khong ton tai"));
            if (!gqs.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403).body(Map.of("success", false,
                        "message", "Quiz set khong thuoc nhom nay"));
            }

            var page = org.springframework.data.domain.PageRequest.of(0, 10);
            var sessions = quizSessionRepository.findCompletedByGroupQuizSetIdAndOwnerId(
                    setId, user.getId(), page);

            List<Map<String, Object>> attempts = sessions.stream().map(qs -> {
                Map<String, Object> m = new LinkedHashMap<>();
                int total = qs.getTotalQuestions() == null ? 0 : qs.getTotalQuestions();
                int correct = qs.getCorrectAnswers() == null ? 0 : qs.getCorrectAnswers();
                double accuracy = total > 0 ? Math.round((correct * 10000.0 / total)) / 100.0 : 0.0;
                m.put("sessionId", qs.getId());
                m.put("score", qs.getScore() == null ? 0 : qs.getScore());
                m.put("correctAnswers", correct);
                m.put("totalQuestions", total);
                m.put("accuracy", accuracy);
                m.put("completedAt", qs.getEndedAt());
                return m;
            }).collect(Collectors.toList());

            Map<String, Object> mastery = masteryService.getMastery(setId, user.getId());
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("totalAttempts", mastery.get("totalAttempts"));
            summary.put("bestScore", mastery.get("bestScore"));
            summary.put("bestAccuracy", mastery.get("bestAccuracy"));
            summary.put("learnedQuestionsCount", mastery.get("questionsLearned"));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", true);
            body.put("attempts", attempts);
            body.put("masterySummary", summary);
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{groupId}/quiz-sets/{setId}/leaderboard
     * Per-set leaderboard aggregated từ group_quiz_set_mastery.
     * Q-A SAFE — KHÔNG ảnh hưởng group leaderboard chính.
     * Sort: bestScore DESC, bestAccuracy DESC, lastPracticedAt ASC (earlier wins ties).
     */
    @GetMapping("/{groupId}/quiz-sets/{setId}/leaderboard")
    public ResponseEntity<?> getQuizSetLeaderboard(@PathVariable("groupId") String groupId,
                                                    @PathVariable("setId") String setId,
                                                    @RequestParam(value = "limit", defaultValue = "20") int limit,
                                                    Principal principal) {
        try {
            User user = getUser(principal);
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));

            GroupQuizSet gqs = groupQuizSetRepository.findById(setId)
                    .orElseThrow(() -> new RuntimeException("Quiz set khong ton tai"));
            if (!gqs.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403).body(Map.of("success", false,
                        "message", "Quiz set khong thuoc nhom nay"));
            }

            int safeLimit = Math.min(Math.max(limit, 1), 100);
            var page = org.springframework.data.domain.PageRequest.of(0, safeLimit);
            var rows = masteryRepository.findLeaderboardByQuizSetId(setId, page);

            List<String> userIds = rows.stream().map(r -> r.getUserId()).distinct().collect(Collectors.toList());
            Map<String, User> userMap = userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

            List<Map<String, Object>> entries = new java.util.ArrayList<>();
            int rank = 0;
            Integer myRank = null;
            for (var m : rows) {
                rank++;
                User u = userMap.get(m.getUserId());
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank);
                entry.put("userId", m.getUserId());
                entry.put("displayName", u != null ? u.getName() : null);
                entry.put("avatarUrl", u != null ? u.getAvatarUrl() : null);
                entry.put("bestScore", m.getBestScore());
                entry.put("bestAccuracy", m.getBestAccuracy());
                entry.put("totalAttempts", m.getTotalAttempts());
                entry.put("lastPlayedAt", m.getLastPracticedAt());
                entries.add(entry);
                if (m.getUserId().equals(user.getId())) {
                    myRank = rank;
                }
            }

            long totalParticipants = masteryRepository.countByQuizSetId(setId);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", true);
            body.put("entries", entries);
            body.put("myRank", myRank);
            body.put("totalParticipants", totalParticipants);
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/my-masteries — Sprint 5.
     * Tất cả mastery của requester trong group này (cho personal achievements page).
     */
    @GetMapping("/{id}/my-masteries")
    public ResponseEntity<?> getMyMasteries(@PathVariable("id") String groupId, Principal principal) {
        try {
            User user = getUser(principal);
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));
            return ResponseEntity.ok(Map.of("success", true,
                    "masteries", masteryService.getUserMasteriesInGroup(user.getId(), groupId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ── Sprint 5: Folder CRUD endpoints ──

    @GetMapping("/{id}/quiz-set-folders")
    public ResponseEntity<?> listFolders(@PathVariable("id") String id, Principal principal) {
        try {
            User user = getUser(principal);
            return ResponseEntity.ok(Map.of("success", true,
                    "folders", churchGroupService.listFolders(id, user.getId())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/quiz-set-folders")
    public ResponseEntity<?> createFolder(@PathVariable("id") String id,
                                           @RequestBody Map<String, Object> body,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            String color = (String) body.get("color");
            Integer order = body.get("displayOrder") instanceof Number n ? n.intValue() : null;
            return ResponseEntity.ok(Map.of("success", true,
                    "folder", churchGroupService.createFolder(id, user.getId(), name, color, order)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/quiz-set-folders/{folderId}")
    public ResponseEntity<?> updateFolder(@PathVariable("id") String id,
                                           @PathVariable("folderId") String folderId,
                                           @RequestBody Map<String, Object> body,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            String color = (String) body.get("color");
            Integer order = body.get("displayOrder") instanceof Number n ? n.intValue() : null;
            return ResponseEntity.ok(Map.of("success", true,
                    "folder", churchGroupService.updateFolder(id, folderId, user.getId(), name, color, order)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/quiz-set-folders/{folderId}")
    public ResponseEntity<?> deleteFolder(@PathVariable("id") String id,
                                           @PathVariable("folderId") String folderId,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            churchGroupService.deleteFolder(id, folderId, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** Sprint 5: per-mode question count validation. Returns error message or null if OK. */
    private String validateModeForQuestions(Room.RoomMode mode, int total) {
        switch (mode) {
            case BATTLE_ROYALE:
                if (total < 4) return "Battle Royale can toi thieu 4 cau hoi (hien co " + total + ")";
                break;
            case SUDDEN_DEATH:
                if (total < 10) return "Sudden Death can toi thieu 10 cau hoi (hien co " + total + ")";
                break;
            case TEAM_VS_TEAM:
                if (total < 6 || total % 2 != 0)
                    return "Team vs Team can so cau chan >= 6 (hien co " + total + ")";
                break;
            case SPEED_RACE:
            case GROUP_LIVE_SEQUENTIAL:
            default:
                break;
        }
        return null;
    }

    private boolean isLeaderOrMod(String groupId, String userId) {
        return groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .map(m -> m.getRole() == com.biblequiz.modules.group.entity.GroupMember.GroupRole.LEADER
                       || m.getRole() == com.biblequiz.modules.group.entity.GroupMember.GroupRole.MOD)
                .orElse(false);
    }

    /**
     * PATCH /api/groups/{id} - Cap nhat thong tin nhom (chi leader)
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> updateGroup(@PathVariable String id,
                                         @RequestBody Map<String, Object> body,
                                         Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            String description = (String) body.get("description");
            Boolean isPublic = body.get("isPublic") instanceof Boolean b ? b : null;
            Integer maxMembers = body.get("maxMembers") instanceof Number n ? n.intValue() : null;

            Map<String, Object> result = churchGroupService.updateGroup(id, user.getId(), name, description, isPublic, maxMembers);
            return ResponseEntity.ok(Map.of("success", true, "group", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/groups/{id} - Xoa nhom (soft delete, chi leader)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            Map<String, Object> result = churchGroupService.deleteGroup(id, user.getId());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/groups/{id}/members/{userId} - Kick thanh vien (chi leader/mod)
     * Body (optional): {"reason": "..."} — recorded in group_kick_log so the
     * 7-day re-join cooldown (SPEC v1.1 §12.2) can be enforced and reviewed.
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> kickMember(@PathVariable String id,
                                        @PathVariable String userId,
                                        @RequestBody(required = false) Map<String, String> body,
                                        Principal principal) {
        try {
            User user = getUser(principal);
            String reason = body == null ? null : body.get("reason");
            Map<String, Object> result = churchGroupService.kickMember(id, user.getId(), userId, reason);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/report (SPEC v1.1 §13.9)
     * Body: {"reason": "SPAM"|"INAPPROPRIATE"|"HARASSMENT"|"OTHER", "note": "..."}
     * Auth required (any user, even non-members can report). One open
     * report per user per group at a time.
     */
    @PostMapping("/{id}/report")
    public ResponseEntity<?> reportGroup(@PathVariable String id,
                                         @RequestBody Map<String, String> body,
                                         Principal principal) {
        try {
            User user = getUser(principal);
            String reason = body == null ? null : body.get("reason");
            String note = body == null ? null : body.get("note");
            Map<String, Object> result = churchGroupService.reportGroup(id, user, reason, note);
            return ResponseEntity.status(201).body(Map.of("success", true, "report", result));
        } catch (RuntimeException e) {
            if ("INVALID_REASON".equals(e.getMessage())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "code", "INVALID_REASON",
                        "message", "Lý do báo cáo không hợp lệ. Chọn: SPAM, INAPPROPRIATE, HARASSMENT, OTHER."));
            }
            if ("ALREADY_REPORTED".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "code", "ALREADY_REPORTED",
                        "message", "Bạn đã có một báo cáo đang chờ duyệt cho nhóm này."));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/announcements - Tao thong bao (chi leader/mod)
     */
    @PostMapping("/{id}/announcements")
    public ResponseEntity<?> createAnnouncement(@PathVariable String id,
                                                @RequestBody Map<String, String> body,
                                                Principal principal) {
        try {
            User user = getUser(principal);
            String content = body.get("content");
            Map<String, Object> result = churchGroupService.createAnnouncement(id, user.getId(), content);
            return ResponseEntity.status(201).body(Map.of("success", true, "announcement", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/announcements - Danh sach thong bao
     */
    @GetMapping("/{id}/announcements")
    public ResponseEntity<?> getAnnouncements(@PathVariable String id,
                                              @RequestParam(defaultValue = "20") int limit,
                                              @RequestParam(defaultValue = "0") int offset) {
        try {
            Map<String, Object> result = churchGroupService.getAnnouncements(id, limit, offset);
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/ai-quota
     * Snapshot of shared global AI quota (D5) — used + limit + remaining.
     * Powers the "Hôm nay: X/Y" badge in the create-quiz-set modal.
     * Leader/mod only (mirrors /ai-generate authorization).
     */
    @GetMapping("/{id}/ai-quota")
    public ResponseEntity<?> getAiQuota(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(id, user.getId());
            AIQuotaService.Usage usage = aiQuotaService.snapshot();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "used", usage.used(),
                    "limit", usage.limit(),
                    "remaining", usage.remaining()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/ai-generate
     * Generate draft questions via AI for a group quiz set.
     * Requires LEADER or MOD membership. Questions are NOT saved to DB.
     */
    @PostMapping("/{id}/ai-generate")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> aiGenerateQuestions(@PathVariable String id,
                                                  @RequestBody Map<String, Object> body,
                                                  Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(id, user.getId());

            String book = (String) body.getOrDefault("book", "John");
            int chapter = body.get("chapter") instanceof Number n ? n.intValue() : 1;
            int chapterEnd = body.get("chapterEnd") instanceof Number n ? Math.max(chapter, n.intValue()) : chapter;
            int verseStart = body.get("verseStart") instanceof Number n ? n.intValue() : 1;
            int verseEnd = body.get("verseEnd") instanceof Number n ? n.intValue() : 50;
            String topic = (String) body.getOrDefault("topic", "");
            int count = body.get("count") instanceof Number n ? Math.min(Math.max(n.intValue(), 1), 15) : 5;
            String difficulty = (String) body.getOrDefault("difficulty", "MEDIUM");
            String language = (String) body.getOrDefault("language", "vi");

            // Shared global quota (D5): admin + group leaders combined.
            if (!aiQuotaService.tryAcquire(count)) {
                AIQuotaService.Usage usage = aiQuotaService.snapshot();
                return ResponseEntity.status(429).body(Map.of(
                        "success", false,
                        "error", "QUOTA_EXCEEDED",
                        "message", "Đã đạt giới hạn AI hôm nay. Vui lòng thử lại ngày mai.",
                        "used", usage.used(),
                        "limit", usage.limit(),
                        "remaining", usage.remaining()
                ));
            }

            // Group leader always uses default provider (D3) — no model selector visible.
            // Topic is a hard constraint here (not free-form admin notes): wrap it so the
            // prompt builder renders it as a mandatory directive.
            String customPrompt = topic.isBlank() ? null :
                    "Tất cả " + count + " câu hỏi PHẢI tập trung vào chủ đề bài học: \"" + topic.trim() + "\". " +
                    "Chỉ chọn các sự kiện / nhân vật / lời dạy trong phạm vi Kinh Thánh đã cho mà liên quan trực tiếp đến chủ đề này. " +
                    "KHÔNG tạo câu hỏi lạc đề (ngay cả khi đoạn Kinh Thánh có nội dung khác).";
            AIGenerationContext ctx = AIGenerationContext.range(
                    book, chapter, chapterEnd, verseStart, verseEnd,
                    difficulty, "MULTIPLE_CHOICE", language,
                    count, null, customPrompt);
            AIGenerationResult result = aiProviderRouter.generate(ctx, null /* auto */);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "questions", result.questions(),
                    "provider", result.providerUsed()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (AIProviderException e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/custom
     * Save leader-authored questions and create a quiz set in one transaction.
     * Each question is saved with source='group-custom', isActive=false.
     */
    @PostMapping("/{id}/quiz-sets/custom")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> createCustomQuizSet(@PathVariable String id,
                                                  @RequestBody Map<String, Object> body,
                                                  Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(id, user.getId());

            String name = (String) body.get("name");
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ten quiz set khong duoc de trong"));
            }

            List<Map<String, Object>> rawQuestions = (List<Map<String, Object>>) body.get("questions");
            if (rawQuestions == null || rawQuestions.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Danh sach cau hoi khong duoc de trong"));
            }

            List<String> savedIds = new ArrayList<>();
            for (Map<String, Object> raw : rawQuestions) {
                Question q = new Question();
                q.setId(UUID.randomUUID().toString());
                q.setContent((String) raw.getOrDefault("content", ""));
                q.setBook((String) raw.getOrDefault("book", "custom"));
                q.setChapter(raw.get("chapter") instanceof Number n ? n.intValue() : null);
                q.setVerseStart(raw.get("verseStart") instanceof Number n ? n.intValue() : null);
                q.setVerseEnd(raw.get("verseEnd") instanceof Number n ? n.intValue() : null);

                String diffStr = (String) raw.getOrDefault("difficulty", "medium");
                try { q.setDifficulty(Question.Difficulty.valueOf(diffStr.toLowerCase())); }
                catch (Exception ex) { q.setDifficulty(Question.Difficulty.medium); }

                q.setType(Question.Type.multiple_choice_single);
                q.setLanguage((String) raw.getOrDefault("language", "vi"));
                List<String> options = (List<String>) raw.getOrDefault("options", List.of());
                q.setOptions(options);

                // Validate correctAnswer is a valid index into options.
                // Reject early so a malformed payload (e.g. {correctAnswer: 99} for
                // a 4-option question) doesn't blow up at quiz-grading time.
                int optionCount = options.size();
                Object ca = raw.get("correctAnswer");
                List<Integer> correctIndexes;
                if (ca instanceof List<?> list) {
                    correctIndexes = list.stream()
                            .map(v -> v instanceof Number n ? n.intValue() : -1)
                            .collect(Collectors.toList());
                } else if (ca instanceof Number n) {
                    correctIndexes = List.of(n.intValue());
                } else {
                    correctIndexes = List.of(0);
                }
                for (int idx : correctIndexes) {
                    if (idx < 0 || idx >= optionCount) {
                        return ResponseEntity.badRequest().body(Map.of(
                                "success", false,
                                "message", "correctAnswer index " + idx + " is out of range (options count = " + optionCount + ")"));
                    }
                }
                q.setCorrectAnswer(correctIndexes);

                q.setExplanation((String) raw.get("explanation"));
                q.setSource("group-custom");
                q.setIsActive(false);
                q.setReviewStatus(Question.ReviewStatus.ACTIVE);

                questionRepository.save(q);
                savedIds.add(q.getId());
            }

            ChurchGroup group = churchGroupRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

            GroupQuizSet qs = new GroupQuizSet();
            qs.setId(UUID.randomUUID().toString());
            qs.setGroup(group);
            qs.setName(name);
            qs.setQuestionIds(savedIds);
            qs.setCreatedBy(user);
            // Auto-derive difficulty from the actual question mix so the list card can
            // render a meaningful DỄ/TB/KHÓ breakdown instead of 0/0/0 (BL-S5-3 rule).
            qs.setDifficulty(churchGroupService.computeDifficulty(qs));
            groupQuizSetRepository.save(qs);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", qs.getId());
            result.put("name", qs.getName());
            result.put("questionCount", savedIds.size());
            result.put("createdAt", qs.getCreatedAt());
            return ResponseEntity.ok(Map.of("success", true, "quizSet", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{groupId}/quiz-sets/{setId}/play
     * Creates a room pre-loaded with the group quiz set's questions.
     * Any group member can initiate. Returns room id + code to navigate to lobby.
     */
    @PostMapping("/{groupId}/quiz-sets/{setId}/play")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> playQuizSet(@PathVariable String groupId,
                                          @PathVariable String setId,
                                          Principal principal) {
        try {
            User user = getUser(principal);
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));

            GroupQuizSet gqs = groupQuizSetRepository.findById(setId)
                    .orElseThrow(() -> new RuntimeException("Khong tim thay quiz set"));
            if (!gqs.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Quiz set khong thuoc nhom nay"));
            }

            List<String> questionIds = (List<String>) gqs.getQuestionIds();
            if (questionIds == null || questionIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Quiz set chua co cau hoi nao"));
            }

            // Per spec v1.1 §7.5: each click creates a new room — no dedup.
            // Co-play group rooms always run in Quản trò (host-organizer) mode
            // per Bui decision 2026-05-12: nhất quán với UX multiplayer, leader
            // điều phối thay vì vừa host vừa thi đấu. Lobby min = 2 non-host
            // players, đẩy "host solo" về flow Tự ôn riêng.
            Room room = roomService.createRoom(
                    gqs.getName(), user,
                    8, questionIds.size(), 15,
                    Room.RoomMode.SPEED_RACE, false,
                    Room.RoomDifficulty.MIXED, "ALL",
                    Room.QuestionSource.CUSTOM, null,
                    Boolean.FALSE);  // hostPlaysGame = false → Quản trò
            room.setCustomQuestionIds(questionIds);
            room.setGroupQuizSetId(setId);
            // V55: mark as co-play so the group's "Đang diễn ra" surface picks it up.
            // Members can join via the group page without needing the room code.
            room.setCoPlay(true);
            roomRepository.save(room);

            Map<String, Object> roomInfo = new LinkedHashMap<>();
            roomInfo.put("id", room.getId());
            roomInfo.put("roomCode", room.getRoomCode());
            roomInfo.put("roomName", room.getRoomName());
            return ResponseEntity.ok(Map.of("success", true, "room", roomInfo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/live-rooms
     * Feature A — Tạo phòng live multiplayer "Chơi cùng nhau" với mode
     * GROUP_LIVE_SEQUENTIAL. Authorize LEADER/MOD. Body: {quizSetId, timePerQuestion?}.
     * Returns roomId + roomCode để FE navigate sang RoomLobby.
     *
     * Per spec v1.1 §13.5 + Phụ lục B: renamed from /live-quiz.
     */
    @PostMapping("/{id}/live-rooms")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> createLiveQuiz(@PathVariable("id") String groupId,
                                            @RequestBody Map<String, Object> body,
                                            Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());

            String quizSetId = (String) body.get("quizSetId");
            if (quizSetId == null || quizSetId.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "Thieu quizSetId"));
            }
            int timePerQuestion = body.get("timePerQuestion") instanceof Number n
                    ? Math.min(Math.max(n.intValue(), 10), 120) : 30;

            GroupQuizSet gqs = groupQuizSetRepository.findById(quizSetId)
                    .orElseThrow(() -> new RuntimeException("Khong tim thay quiz set"));
            if (!gqs.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403)
                        .body(Map.of("success", false, "message", "Quiz set khong thuoc nhom nay"));
            }

            List<String> questionIds = (List<String>) gqs.getQuestionIds();
            if (questionIds == null || questionIds.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "Quiz set chua co cau hoi nao"));
            }

            // Sprint 5: chỉ cho phép tạo room từ quiz set PUBLISHED.
            if (gqs.getPublishStatus() == GroupQuizSet.PublishStatus.DRAFT
                    || gqs.getPublishStatus() == GroupQuizSet.PublishStatus.ARCHIVED
                    || gqs.getPublishStatus() == GroupQuizSet.PublishStatus.SOFT_DELETED) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message",
                                "Bo cau hoi chua duoc xuat ban (status=" + gqs.getPublishStatus() + ")"));
            }

            // Sprint 5: resolve mode — req.mode > quizSet.suggestedMode > GROUP_LIVE_SEQUENTIAL
            Room.RoomMode mode = Room.RoomMode.GROUP_LIVE_SEQUENTIAL;
            String reqMode = body.get("mode") instanceof String s ? s : null;
            if (reqMode != null && !reqMode.isBlank()) {
                try { mode = Room.RoomMode.valueOf(reqMode); }
                catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("success", false,
                            "message", "Mode khong hop le: " + reqMode));
                }
            } else if (gqs.getSuggestedMode() != null && !gqs.getSuggestedMode().isBlank()) {
                try { mode = Room.RoomMode.valueOf(gqs.getSuggestedMode()); }
                catch (IllegalArgumentException ignore) {}
            }

            // Sprint 5: per-mode constraint validation
            int total = questionIds.size();
            String modeError = validateModeForQuestions(mode, total);
            if (modeError != null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", modeError));
            }

            // Per spec v1.1 §8.7: a group can have multiple live rooms in
            // parallel (e.g., 2 cell groups practising at once). Each click
            // by a leader/mod creates a new room — no dedup.
            Room room = roomService.createRoom(
                    gqs.getName(), user,
                    20, total, timePerQuestion,
                    mode, false,
                    Room.RoomDifficulty.MIXED, "ALL",
                    Room.QuestionSource.CUSTOM, null);
            room.setCustomQuestionIds(questionIds);
            room.setGroupQuizSetId(quizSetId);
            roomRepository.save(room);

            Map<String, Object> roomInfo = new LinkedHashMap<>();
            roomInfo.put("id", room.getId());
            roomInfo.put("roomCode", room.getRoomCode());
            roomInfo.put("roomName", room.getRoomName());
            roomInfo.put("mode", room.getMode().name());
            return ResponseEntity.ok(Map.of("success", true, "room", roomInfo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/live-rooms
     * Trả về list phòng live đang LOBBY/IN_PROGRESS thuộc group — để mọi member
     * thấy "Đang diễn ra" trong tab Bộ câu hỏi và join chung phòng.
     *
     * Per spec v1.1 §13.5: renamed from /active-rooms để align với POST endpoint.
     */
    @GetMapping("/{id}/live-rooms")
    public ResponseEntity<?> listActiveRooms(@PathVariable("id") String groupId, Principal principal) {
        try {
            User user = getUser(principal);
            // Chỉ thành viên nhóm mới xem được
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));

            List<Room> rooms = roomRepository.findActiveRoomsForGroup(groupId);
            // Map quizSetId → name để FE hiển thị
            Map<String, String> qsNames = new HashMap<>();
            for (GroupQuizSet qs : groupQuizSetRepository.findByGroupId(groupId)) {
                qsNames.put(qs.getId(), qs.getName());
            }
            List<Map<String, Object>> list = rooms.stream().map(r -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", r.getId());
                m.put("roomCode", r.getRoomCode());
                m.put("roomName", r.getRoomName());
                m.put("mode", r.getMode().name());
                m.put("status", r.getStatus().name());
                m.put("currentPlayers", r.getCurrentPlayers());
                m.put("maxPlayers", r.getMaxPlayers());
                m.put("quizSetId", r.getGroupQuizSetId());
                m.put("quizSetName", qsNames.get(r.getGroupQuizSetId()));
                m.put("isCoPlay", r.isCoPlay());
                m.put("createdAt", r.getCreatedAt());
                return m;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(Map.of("success", true, "rooms", list));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════════
    // BL-AD-8 — Quiz Set Editor page endpoints (Phase B)
    // ════════════════════════════════════════════════════════════════

    /**
     * GET /api/groups/{id}/quiz-sets/{setId}/full
     * Returns quiz set metadata + ordered questions inline, in one round trip.
     * Used by QuizSetEditor on initial load. Permission: any group member
     * (DRAFT visible to creator + leader/mod only).
     */
    @GetMapping("/{id}/quiz-sets/{setId}/full")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> getQuizSetFull(@PathVariable("id") String groupId,
                                             @PathVariable("setId") String setId,
                                             Principal principal) {
        try {
            User user = getUser(principal);
            groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));
            GroupQuizSet set = groupQuizSetRepository.findById(setId)
                    .orElseThrow(() -> new RuntimeException("Quiz set khong ton tai"));
            if (!set.getGroup().getId().equals(groupId)) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Quiz set khong thuoc nhom"));
            }
            // DRAFT visibility: creator OR leader/mod
            if (set.getPublishStatus() == GroupQuizSet.PublishStatus.DRAFT
                    && !set.getCreatedBy().getId().equals(user.getId())
                    && !isLeaderOrMod(groupId, user.getId())) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Khong co quyen xem ban nhap nay"));
            }
            List<String> qids = (List<String>) set.getQuestionIds();
            if (qids == null) qids = new ArrayList<>();
            // Preserve order from questionIds[] — repository.findAllById returns unordered
            Map<String, Question> byId = questionRepository.findAllById(qids).stream()
                    .collect(Collectors.toMap(Question::getId, q -> q));
            List<Map<String, Object>> questions = new ArrayList<>();
            for (String qid : qids) {
                Question q = byId.get(qid);
                if (q != null) questions.add(questionToMap(q));
            }
            Map<String, Object> result = new LinkedHashMap<>(com.biblequiz.modules.group.service.ChurchGroupService.quizSetToMap(set));
            result.put("questions", questions);
            return ResponseEntity.ok(Map.of("success", true, "quizSet", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/{setId}/questions
     * Creates a single question (source=group-custom) and appends id to set.questionIds[].
     * Request body: same shape as a single entry in /quiz-sets/custom body.questions[].
     */
    @PostMapping("/{id}/quiz-sets/{setId}/questions")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> addQuestionToSet(@PathVariable("id") String groupId,
                                               @PathVariable("setId") String setId,
                                               @RequestBody Map<String, Object> raw,
                                               Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);

            Question q = buildQuestionFromMap(raw, "group-custom");
            questionRepository.save(q);

            List<String> ids = mutableQuestionIds(set);
            ids.add(q.getId());
            set.setQuestionIds(ids);
            set.setTotalQuestions(ids.size());
            groupQuizSetRepository.save(set);

            return ResponseEntity.ok(Map.of("success", true, "question", questionToMap(q),
                    "totalQuestions", ids.size()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * PATCH /api/groups/{id}/quiz-sets/{setId}/questions/{qid}
     * Partial update of a single question (debounced auto-save target).
     * Only fields present in body are mutated.
     */
    @PatchMapping("/{id}/quiz-sets/{setId}/questions/{qid}")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> updateQuestionInSet(@PathVariable("id") String groupId,
                                                  @PathVariable("setId") String setId,
                                                  @PathVariable("qid") String qid,
                                                  @RequestBody Map<String, Object> raw,
                                                  Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);
            List<String> ids = mutableQuestionIds(set);
            if (!ids.contains(qid)) {
                return ResponseEntity.status(404).body(Map.of("success", false, "message", "Cau hoi khong thuoc bo nay"));
            }
            Question q = questionRepository.findById(qid)
                    .orElseThrow(() -> new RuntimeException("Cau hoi khong ton tai"));
            mergeQuestionFields(q, raw);
            questionRepository.save(q);
            return ResponseEntity.ok(Map.of("success", true, "question", questionToMap(q)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/groups/{id}/quiz-sets/{setId}/questions/{qid}
     * Removes a question from the set (and deletes the Question row when source ∈ {ai-group, group-custom}).
     */
    @DeleteMapping("/{id}/quiz-sets/{setId}/questions/{qid}")
    @Transactional
    public ResponseEntity<?> deleteQuestionFromSet(@PathVariable("id") String groupId,
                                                    @PathVariable("setId") String setId,
                                                    @PathVariable("qid") String qid,
                                                    Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);
            List<String> ids = mutableQuestionIds(set);
            boolean removed = ids.remove(qid);
            if (!removed) {
                return ResponseEntity.status(404).body(Map.of("success", false, "message", "Cau hoi khong thuoc bo nay"));
            }
            set.setQuestionIds(ids);
            set.setTotalQuestions(ids.size());
            groupQuizSetRepository.save(set);
            // Hard-delete only for group-owned questions (don't touch admin-curated pool).
            questionRepository.findById(qid).ifPresent(q -> {
                String src = q.getSource();
                if ("group-custom".equals(src) || "ai-group".equals(src)) {
                    questionRepository.delete(q);
                }
            });
            return ResponseEntity.ok(Map.of("success", true, "totalQuestions", ids.size()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/{setId}/questions/reorder
     * Body: { "questionIds": ["uuid1", "uuid2", ...] }
     * Must contain exactly the same id set as current — no add/remove.
     */
    @PostMapping("/{id}/quiz-sets/{setId}/questions/reorder")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> reorderQuestionsInSet(@PathVariable("id") String groupId,
                                                    @PathVariable("setId") String setId,
                                                    @RequestBody Map<String, Object> body,
                                                    Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);
            List<String> newOrder = body.get("questionIds") instanceof List<?> l
                    ? l.stream().filter(Objects::nonNull).map(Object::toString).collect(Collectors.toList())
                    : null;
            if (newOrder == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "questionIds bat buoc"));
            }
            List<String> current = mutableQuestionIds(set);
            if (newOrder.size() != current.size() || !new HashSet<>(newOrder).equals(new HashSet<>(current))) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Danh sach id moi phai khop hoan toan voi danh sach hien tai"));
            }
            set.setQuestionIds(newOrder);
            groupQuizSetRepository.save(set);
            return ResponseEntity.ok(Map.of("success", true, "questionIds", newOrder));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/{setId}/ai-generate
     * Set-scoped AI generation: calls provider router, persists every draft
     * (source=ai-group), and auto-appends ids to the set.
     * Body: { countEasy, countMedium, countHard, book, chapterFrom, chapterTo,
     *         verseFrom?, verseTo?, topic? }
     */
    @PostMapping("/{id}/quiz-sets/{setId}/ai-generate")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> aiGenerateForSet(@PathVariable("id") String groupId,
                                               @PathVariable("setId") String setId,
                                               @RequestBody Map<String, Object> body,
                                               Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);

            int cE = intVal(body.get("countEasy"), 0);
            int cM = intVal(body.get("countMedium"), 0);
            int cH = intVal(body.get("countHard"), 0);
            int total = cE + cM + cH;
            if (total <= 0 || total > 15) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Tong so cau phai trong khoang 1-15"));
            }
            if (!aiQuotaService.tryAcquire(total)) {
                AIQuotaService.Usage u = aiQuotaService.snapshot();
                return ResponseEntity.status(429).body(Map.of("success", false,
                        "error", "QUOTA_EXCEEDED",
                        "message", "Da dat gioi han AI hom nay",
                        "used", u.used(), "limit", u.limit(), "remaining", u.remaining()));
            }

            String book = (String) body.getOrDefault("book", "John");
            int chapter = intVal(body.get("chapterFrom"), 1);
            int verseStart = intVal(body.get("verseFrom"), 1);
            int verseEnd = intVal(body.get("verseTo"), 50);
            String topic = (String) body.getOrDefault("topic", "");
            String language = (String) body.getOrDefault("language", "vi");

            String customPrompt = topic.isBlank() ? null :
                    "Tat ca cau hoi PHAI tap trung vao chu de: \"" + topic.trim() + "\".";

            List<Map<String, Object>> allDrafts = new ArrayList<>();
            String providerUsed = null;
            for (Object[] tier : new Object[][]{{"easy", cE}, {"medium", cM}, {"hard", cH}}) {
                int count = (int) tier[1];
                if (count <= 0) continue;
                AIGenerationContext ctx = AIGenerationContext.of(
                        book, chapter, verseStart, verseEnd,
                        ((String) tier[0]).toUpperCase(), "MULTIPLE_CHOICE", language,
                        count, null, customPrompt);
                AIGenerationResult res = aiProviderRouter.generate(ctx, null);
                providerUsed = res.providerUsed();
                for (Map<String, Object> draft : res.questions()) {
                    Map<String, Object> withDifficulty = new LinkedHashMap<>(draft);
                    withDifficulty.putIfAbsent("difficulty", (String) tier[0]);
                    withDifficulty.putIfAbsent("book", book);
                    withDifficulty.putIfAbsent("chapter", chapter);
                    withDifficulty.putIfAbsent("verseStart", verseStart);
                    withDifficulty.putIfAbsent("verseEnd", verseEnd);
                    withDifficulty.putIfAbsent("language", language);
                    allDrafts.add(withDifficulty);
                }
            }

            // AEU-2: annotate MCQ drafts with distractor-quality flags (parity with
            // admin). `_quality`/`distractors` are transient — carried onto the
            // response dto below, not persisted on the Question entity.
            aiGenerationService.annotateQuality(allDrafts);

            List<String> ids = mutableQuestionIds(set);
            List<Map<String, Object>> savedDtos = new ArrayList<>();
            for (Map<String, Object> draft : allDrafts) {
                Question q = buildQuestionFromMap(draft, "ai-group");
                questionRepository.save(q);
                ids.add(q.getId());
                Map<String, Object> dto = new LinkedHashMap<>(questionToMap(q));
                if (draft.get("distractors") != null) dto.put("distractors", draft.get("distractors"));
                if (draft.get("_quality") != null)    dto.put("_quality", draft.get("_quality"));
                savedDtos.add(dto);
            }
            set.setQuestionIds(ids);
            set.setTotalQuestions(ids.size());
            groupQuizSetRepository.save(set);

            AIQuotaService.Usage usage = aiQuotaService.snapshot();
            return ResponseEntity.ok(Map.of("success", true,
                    "questions", savedDtos,
                    "totalQuestions", ids.size(),
                    "provider", providerUsed != null ? providerUsed : "auto",
                    "used", usage.used(),
                    "limit", usage.limit(),
                    "remaining", usage.remaining()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (AIProviderException e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/groups/{id}/quiz-sets/{setId}/questions/{qid}/ai-rewrite
     * Returns 1 fresh draft WITHOUT saving — caller decides accept/discard.
     * Body: { hint?: string }
     */
    @PostMapping("/{id}/quiz-sets/{setId}/questions/{qid}/ai-rewrite")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> aiRewriteQuestion(@PathVariable("id") String groupId,
                                                @PathVariable("setId") String setId,
                                                @PathVariable("qid") String qid,
                                                @RequestBody(required = false) Map<String, Object> body,
                                                Principal principal) {
        try {
            User user = getUser(principal);
            requireLeaderOrMod(groupId, user.getId());
            GroupQuizSet set = loadSetForGroup(groupId, setId);
            List<String> ids = mutableQuestionIds(set);
            if (!ids.contains(qid)) {
                return ResponseEntity.status(404).body(Map.of("success", false, "message", "Cau hoi khong thuoc bo nay"));
            }
            Question existing = questionRepository.findById(qid)
                    .orElseThrow(() -> new RuntimeException("Cau hoi khong ton tai"));

            if (!aiQuotaService.tryAcquire(1)) {
                AIQuotaService.Usage u = aiQuotaService.snapshot();
                return ResponseEntity.status(429).body(Map.of("success", false,
                        "error", "QUOTA_EXCEEDED",
                        "message", "Da dat gioi han AI hom nay",
                        "used", u.used(), "limit", u.limit(), "remaining", u.remaining()));
            }

            String hint = body != null && body.get("hint") instanceof String s ? s.trim() : "";
            String customPrompt = "Viet lai cau hoi nay theo huong khac. Cau goc: \"" + existing.getContent() + "\"."
                    + (hint.isEmpty() ? "" : " Goi y: " + hint);

            AIGenerationContext ctx = AIGenerationContext.of(
                    existing.getBook() != null ? existing.getBook() : "John",
                    existing.getChapter() != null ? existing.getChapter() : 1,
                    existing.getVerseStart() != null ? existing.getVerseStart() : 1,
                    existing.getVerseEnd() != null ? existing.getVerseEnd() : 50,
                    existing.getDifficulty() != null ? existing.getDifficulty().name().toUpperCase() : "MEDIUM",
                    "MULTIPLE_CHOICE",
                    existing.getLanguage() != null ? existing.getLanguage() : "vi",
                    1, null, customPrompt);
            AIGenerationResult res = aiProviderRouter.generate(ctx, null);
            Map<String, Object> draft = res.questions().isEmpty() ? Map.of() : res.questions().get(0);

            AIQuotaService.Usage usage = aiQuotaService.snapshot();
            return ResponseEntity.ok(Map.of("success", true,
                    "draft", draft,
                    "provider", res.providerUsed(),
                    "used", usage.used(),
                    "limit", usage.limit(),
                    "remaining", usage.remaining()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (AIProviderException e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ── BL-AD-8 helpers ──

    private GroupQuizSet loadSetForGroup(String groupId, String setId) {
        GroupQuizSet set = groupQuizSetRepository.findById(setId)
                .orElseThrow(() -> new RuntimeException("Quiz set khong ton tai"));
        if (!set.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("Quiz set khong thuoc nhom nay");
        }
        return set;
    }

    @SuppressWarnings("unchecked")
    private List<String> mutableQuestionIds(GroupQuizSet set) {
        List<?> raw = set.getQuestionIds();
        if (raw == null) return new ArrayList<>();
        return raw.stream().filter(Objects::nonNull).map(Object::toString).collect(Collectors.toList());
    }

    private int intVal(Object o, int dflt) {
        return o instanceof Number n ? n.intValue() : dflt;
    }

    @SuppressWarnings("unchecked")
    private Question buildQuestionFromMap(Map<String, Object> raw, String source) {
        Question q = new Question();
        q.setId(UUID.randomUUID().toString());
        q.setContent((String) raw.getOrDefault("content", ""));
        q.setBook((String) raw.getOrDefault("book", "custom"));
        if (raw.get("chapter") instanceof Number n) q.setChapter(n.intValue());
        if (raw.get("verseStart") instanceof Number n) q.setVerseStart(n.intValue());
        if (raw.get("verseEnd") instanceof Number n) q.setVerseEnd(n.intValue());

        String diffStr = (String) raw.getOrDefault("difficulty", "medium");
        try { q.setDifficulty(Question.Difficulty.valueOf(diffStr.toLowerCase())); }
        catch (Exception ex) { q.setDifficulty(Question.Difficulty.medium); }

        q.setType(Question.Type.multiple_choice_single);
        q.setLanguage((String) raw.getOrDefault("language", "vi"));

        List<String> options = raw.get("options") instanceof List<?> l
                ? l.stream().map(o -> o == null ? "" : o.toString()).collect(Collectors.toList())
                : new ArrayList<>();
        // Always 4-option for editor MCQ; pad if AI returned <4 to avoid bad state.
        while (options.size() < 4) options.add("");
        q.setOptions(options);

        Object ca = raw.get("correctAnswer");
        List<Integer> indexes;
        if (ca instanceof List<?> list) {
            indexes = list.stream().map(v -> v instanceof Number n ? n.intValue() : -1).collect(Collectors.toList());
        } else if (ca instanceof Number n) {
            indexes = new ArrayList<>(List.of(n.intValue()));
        } else {
            indexes = new ArrayList<>(List.of(0));
        }
        // Clamp out-of-range so draft never blocks save (validator will warn in UI).
        indexes = indexes.stream().map(i -> (i < 0 || i >= options.size()) ? 0 : i).collect(Collectors.toList());
        q.setCorrectAnswer(indexes);

        q.setExplanation((String) raw.get("explanation"));
        q.setSource(source);
        // Group-owned questions stay out of the shared Ranked/Practice pool, as
        // /quiz-sets/custom has done since 840d8aea: group play loads them by id
        // (customQuestionIds), which ignores isActive. They are unreviewed and
        // keep the editor's Vietnamese book names.
        q.setIsActive(false);
        q.setReviewStatus(Question.ReviewStatus.ACTIVE);
        return q;
    }

    @SuppressWarnings("unchecked")
    private void mergeQuestionFields(Question q, Map<String, Object> raw) {
        if (raw.containsKey("content")) q.setContent((String) raw.get("content"));
        if (raw.containsKey("book")) q.setBook((String) raw.get("book"));
        if (raw.containsKey("chapter") && raw.get("chapter") instanceof Number n) q.setChapter(n.intValue());
        if (raw.containsKey("verseStart") && raw.get("verseStart") instanceof Number n) q.setVerseStart(n.intValue());
        if (raw.containsKey("verseEnd") && raw.get("verseEnd") instanceof Number n) q.setVerseEnd(n.intValue());
        if (raw.containsKey("difficulty")) {
            String d = (String) raw.get("difficulty");
            if (d != null) {
                try { q.setDifficulty(Question.Difficulty.valueOf(d.toLowerCase())); } catch (Exception ignore) {}
            }
        }
        if (raw.containsKey("explanation")) q.setExplanation((String) raw.get("explanation"));
        if (raw.containsKey("language")) q.setLanguage((String) raw.get("language"));
        if (raw.containsKey("options") && raw.get("options") instanceof List<?> l) {
            List<String> opts = l.stream().map(o -> o == null ? "" : o.toString()).collect(Collectors.toList());
            while (opts.size() < 4) opts.add("");
            q.setOptions(opts);
        }
        if (raw.containsKey("correctAnswer")) {
            Object ca = raw.get("correctAnswer");
            List<Integer> indexes;
            if (ca instanceof List<?> list) {
                indexes = list.stream().map(v -> v instanceof Number n ? n.intValue() : -1).collect(Collectors.toList());
            } else if (ca instanceof Number n) {
                indexes = new ArrayList<>(List.of(n.intValue()));
            } else {
                indexes = new ArrayList<>(List.of(0));
            }
            int sz = q.getOptions() != null ? q.getOptions().size() : 4;
            int clampSize = sz;
            indexes = indexes.stream().map(i -> (i < 0 || i >= clampSize) ? 0 : i).collect(Collectors.toList());
            q.setCorrectAnswer(indexes);
        }
    }

    private Map<String, Object> questionToMap(Question q) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", q.getId());
        m.put("book", q.getBook());
        m.put("chapter", q.getChapter());
        m.put("verseStart", q.getVerseStart());
        m.put("verseEnd", q.getVerseEnd());
        m.put("difficulty", q.getDifficulty() != null ? q.getDifficulty().name() : null);
        m.put("type", q.getType() != null ? q.getType().name() : null);
        m.put("content", q.getContent());
        m.put("options", q.getOptions());
        m.put("correctAnswer", q.getCorrectAnswer());
        m.put("explanation", q.getExplanation());
        m.put("source", q.getSource());
        m.put("language", q.getLanguage());
        return m;
    }

    private void requireLeaderOrMod(String groupId, String userId) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Ban khong phai thanh vien cua nhom nay"));
        if (member.getRole() != GroupMember.GroupRole.LEADER && member.getRole() != GroupMember.GroupRole.MOD) {
            throw new IllegalArgumentException("Chi leader hoac mod moi co the thuc hien thao tac nay");
        }
    }

    private User getUser(Principal principal) {
        if (principal == null) throw new RuntimeException("Chua dang nhap");
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof OAuth2User oauth2User) {
            String email = oauth2User.getAttribute("email");
            if (email != null) {
                return userRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("Nguoi dung khong ton tai"));
            }
        }
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Nguoi dung khong ton tai"));
    }
}
