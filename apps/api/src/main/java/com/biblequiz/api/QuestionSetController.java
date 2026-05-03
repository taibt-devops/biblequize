package com.biblequiz.api;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.userquiz.entity.QuestionSet;
import com.biblequiz.modules.userquiz.entity.QuestionSetItem;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.service.QuestionSetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * REST API for Question Sets (bộ câu hỏi tái sử dụng).
 *
 * POST   /api/question-sets                          — create
 * GET    /api/question-sets                          — my sets
 * GET    /api/question-sets/public                   — public sets (browse)
 * GET    /api/question-sets/:id                      — get set with items
 * PUT    /api/question-sets/:id                      — update name/description
 * DELETE /api/question-sets/:id                      — delete
 * PATCH  /api/question-sets/:id/visibility           — toggle PUBLIC/PRIVATE
 * POST   /api/question-sets/:id/items                — add question to set
 * DELETE /api/question-sets/:id/items/:questionId    — remove question
 * PUT    /api/question-sets/:id/items                — reorder / bulk replace
 * POST   /api/question-sets/:id/share                — share (copy) to user by email
 * POST   /api/question-sets/:id/copy                 — copy PUBLIC set to own library
 */
@RestController
@RequestMapping("/api/question-sets")
public class QuestionSetController {

    @Autowired private QuestionSetService service;
    @Autowired private UserRepository userRepository;

    // ── Create ────────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);
            String name = required(body, "name");
            String desc = body.get("description") instanceof String s ? s : null;
            QuestionSet set = service.create(user, name, desc);
            return ResponseEntity.ok(Map.of("success", true, "set", toDTO(set, false)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> listMine(Principal principal) {
        try {
            User user = getUser(principal);
            List<QuestionSet> sets = service.listByUser(user.getId());
            return ResponseEntity.ok(Map.of("success", true,
                    "sets", sets.stream().map(s -> toDTO(s, false)).toList(),
                    "locked", sets.stream()
                            .filter(s -> service.isLocked(s.getId()))
                            .map(QuestionSet::getId).toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    @GetMapping("/public")
    public ResponseEntity<?> listPublic() {
        try {
            List<QuestionSet> sets = service.listPublic();
            return ResponseEntity.ok(Map.of("success", true,
                    "sets", sets.stream().map(s -> toDTO(s, false)).toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── Get single ────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id, Principal principal) {
        try {
            QuestionSet set = service.getById(id);
            // Allow: owner always, public sets for everyone
            if (set.getVisibility() == QuestionSet.Visibility.PRIVATE && principal != null) {
                User user = getUser(principal);
                if (!set.getUser().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body(Map.of("success", false, "message", "Không có quyền xem"));
                }
            }
            List<QuestionSetItem> items = service.getItems(id);
            boolean locked = service.isLocked(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "set", toDTO(set, false),
                    "items", items.stream().map(this::itemToDTO).toList(),
                    "locked", locked));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id,
                                     @RequestBody Map<String, Object> body,
                                     Principal principal) {
        try {
            User user = getUser(principal);
            String name = required(body, "name");
            String desc = body.get("description") instanceof String s ? s : null;
            QuestionSet set = service.update(id, user.getId(), name, desc);
            return ResponseEntity.ok(Map.of("success", true, "set", toDTO(set, false)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    @PatchMapping("/{id}/visibility")
    public ResponseEntity<?> setVisibility(@PathVariable String id,
                                            @RequestBody Map<String, Object> body,
                                            Principal principal) {
        try {
            User user = getUser(principal);
            String visStr = required(body, "visibility");
            QuestionSet.Visibility vis = QuestionSet.Visibility.valueOf(visStr.toUpperCase());
            QuestionSet set = service.setVisibility(id, user.getId(), vis);
            return ResponseEntity.ok(Map.of("success", true, "set", toDTO(set, false)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            service.delete(id, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── Item management ───────────────────────────────────────────────────────

    @PostMapping("/{id}/items")
    public ResponseEntity<?> addItem(@PathVariable String id,
                                      @RequestBody Map<String, Object> body,
                                      Principal principal) {
        try {
            User user = getUser(principal);
            String questionId = required(body, "questionId");
            QuestionSetItem item = service.addQuestion(id, questionId, user.getId());
            return ResponseEntity.ok(Map.of("success", true, "item", itemToDTO(item)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    @DeleteMapping("/{id}/items/{questionId}")
    public ResponseEntity<?> removeItem(@PathVariable String id,
                                         @PathVariable String questionId,
                                         Principal principal) {
        try {
            User user = getUser(principal);
            service.removeQuestion(id, questionId, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    /** Bulk replace / reorder: PUT body = { questionIds: [...ordered ids] } */
    @PutMapping("/{id}/items")
    public ResponseEntity<?> replaceItems(@PathVariable String id,
                                           @RequestBody Map<String, Object> body,
                                           Principal principal) {
        try {
            User user = getUser(principal);
            @SuppressWarnings("unchecked")
            List<String> questionIds = (List<String>) body.get("questionIds");
            if (questionIds == null) return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Thiếu questionIds"));
            service.replaceItems(id, questionIds, user.getId());
            List<QuestionSetItem> items = service.getItems(id);
            return ResponseEntity.ok(Map.of("success", true,
                    "items", items.stream().map(this::itemToDTO).toList()));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── Share / Copy ──────────────────────────────────────────────────────────

    @PostMapping("/{id}/share")
    public ResponseEntity<?> share(@PathVariable String id,
                                    @RequestBody Map<String, Object> body,
                                    Principal principal) {
        try {
            User user = getUser(principal);
            String targetEmail = required(body, "email");
            QuestionSet copy = service.share(id, user.getId(), targetEmail);
            return ResponseEntity.ok(Map.of("success", true, "copied", toDTO(copy, false)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    @PostMapping("/{id}/copy")
    public ResponseEntity<?> copyPublic(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            QuestionSet copy = service.copyPublic(id, user);
            return ResponseEntity.ok(Map.of("success", true, "set", toDTO(copy, false)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(err(e));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(err(e));
        }
    }

    // ── DTO helpers ───────────────────────────────────────────────────────────

    private Map<String, Object> toDTO(QuestionSet s, boolean withOwner) {
        var dto = new java.util.HashMap<String, Object>();
        dto.put("id",            s.getId());
        dto.put("name",          s.getName());
        dto.put("description",   s.getDescription() != null ? s.getDescription() : "");
        dto.put("visibility",    s.getVisibility().name());
        dto.put("questionCount", s.getQuestionCount());
        dto.put("createdAt",     s.getCreatedAt() != null ? s.getCreatedAt().toString() : "");
        dto.put("updatedAt",     s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : "");
        if (withOwner && s.getUser() != null) {
            dto.put("ownerName", s.getUser().getName());
        }
        return dto;
    }

    private Map<String, Object> itemToDTO(QuestionSetItem item) {
        UserQuestion q = item.getUserQuestion();
        return Map.of(
                "id",            item.getId(),
                "orderIndex",    item.getOrderIndex(),
                "questionId",    q.getId(),
                "content",       q.getContent(),
                "options",       q.getOptions(),
                "correctAnswer", q.getCorrectAnswer(),
                "difficulty",    q.getDifficulty().name(),
                "source",        q.getSource().name(),
                "book",          q.getBook() != null ? q.getBook() : "",
                "explanation",   q.getExplanation() != null ? q.getExplanation() : ""
        );
    }

    private String required(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (!(v instanceof String s) || s.isBlank()) {
            throw new IllegalArgumentException("Thiếu trường bắt buộc: " + key);
        }
        return s;
    }

    private Map<String, Object> err(Exception e) {
        return Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Lỗi hệ thống");
    }

    private User getUser(Principal principal) {
        if (principal == null) throw new RuntimeException("Chưa đăng nhập");
        if (principal instanceof Authentication auth
                && auth.getPrincipal() instanceof OAuth2User oauth2User) {
            String email = oauth2User.getAttribute("email");
            if (email != null) return userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
        }
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
    }
}
