package com.biblequiz.api;

import com.biblequiz.modules.group.entity.GroupQuizSet;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.group.service.ChurchGroupService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
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
    private GroupQuizSetRepository groupQuizSetRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * POST /api/groups - Tao nhom moi
     */
    @PostMapping
    public ResponseEntity<?> createGroup(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);
            String name = (String) body.get("name");
            String description = (String) body.get("description");

            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Ten nhom khong duoc de trong"));
            }

            Map<String, Object> result = churchGroupService.createGroup(name, description, user);
            return ResponseEntity.ok(Map.of("success", true, "group", result));
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
     * GET /api/groups/{id} - Lay thong tin nhom
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getGroupDetails(@PathVariable String id) {
        try {
            Map<String, Object> result = churchGroupService.getGroupDetails(id);
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
     * GET /api/groups/{id}/leaderboard - Bang xep hang nhom
     */
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<?> getLeaderboard(@PathVariable String id,
                                            @RequestParam(defaultValue = "weekly") String period) {
        try {
            List<Map<String, Object>> leaderboard = churchGroupService.getLeaderboard(id, period);
            return ResponseEntity.ok(Map.of("success", true, "leaderboard", leaderboard));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
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
            if (questionIds == null || questionIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Danh sach cau hoi khong duoc de trong"));
            }

            Map<String, Object> result = churchGroupService.createQuizSet(id, user.getId(), name, questionIds);
            return ResponseEntity.ok(Map.of("success", true, "quizSet", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/groups/{id}/quiz-sets - Danh sach quiz set cua nhom
     */
    @GetMapping("/{id}/quiz-sets")
    public ResponseEntity<?> listQuizSets(@PathVariable String id) {
        try {
            List<GroupQuizSet> quizSets = groupQuizSetRepository.findByGroupId(id);
            List<Map<String, Object>> list = quizSets.stream().map(qs -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", qs.getId());
                map.put("name", qs.getName());
                map.put("questionIds", qs.getQuestionIds());
                map.put("createdBy", qs.getCreatedBy().getId());
                map.put("createdAt", qs.getCreatedAt());
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(Map.of("success", true, "quizSets", list));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
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
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> kickMember(@PathVariable String id,
                                        @PathVariable String userId,
                                        Principal principal) {
        try {
            User user = getUser(principal);
            Map<String, Object> result = churchGroupService.kickMember(id, user.getId(), userId);
            return ResponseEntity.ok(result);
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
