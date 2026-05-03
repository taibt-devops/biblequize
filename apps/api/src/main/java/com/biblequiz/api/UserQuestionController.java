package com.biblequiz.api;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.userquiz.entity.RoomQuestionSelection;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.service.QuizGeneratorPort;
import com.biblequiz.modules.userquiz.service.UserQuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user-questions")
public class UserQuestionController {

    @Autowired private UserQuestionService service;
    @Autowired private UserRepository userRepository;

    /** GET /api/user-questions — danh sách câu hỏi cá nhân */
    @GetMapping
    public ResponseEntity<?> list(Principal principal) {
        try {
            User user = getUser(principal);
            List<UserQuestion> questions = service.listByUser(user.getId());
            return ResponseEntity.ok(Map.of("success", true, "questions", questions.stream()
                    .map(this::toDTO).toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** POST /api/user-questions/generate — AI tạo câu hỏi + lưu vào ngân hàng */
    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);

            String book         = body.get("book") instanceof String s ? s : null;
            Integer chapterStart = body.get("chapterStart") instanceof Number n ? n.intValue() : null;
            Integer chapterEnd   = body.get("chapterEnd")   instanceof Number n ? n.intValue() : chapterStart;
            Integer verseStart   = body.get("verseStart")   instanceof Number n ? n.intValue() : null;
            Integer verseEnd     = body.get("verseEnd")     instanceof Number n ? n.intValue() : verseStart;
            String theme        = body.get("theme") instanceof String s ? s : null;
            String difficulty   = body.get("difficulty") instanceof String s ? s : "MEDIUM";
            String language     = body.get("language") instanceof String s ? s : "vi";
            int count           = body.get("count") instanceof Number n ? Math.min(n.intValue(), 10) : 5;

            QuizGeneratorPort.QuizGenerationParams params = new QuizGeneratorPort.QuizGenerationParams(
                    book, chapterStart, chapterEnd, verseStart, verseEnd,
                    theme, difficulty, language, count);

            List<UserQuestion> saved = service.generateAndSave(user, params);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "generated", saved.size(),
                    "questions", saved.stream().map(this::toDTO).toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** POST /api/user-questions — thêm câu hỏi thủ công */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);

            @SuppressWarnings("unchecked")
            List<String> options = (List<String>) body.get("options");
            int correctAnswer    = body.get("correctAnswer") instanceof Number n ? n.intValue() : 0;
            String diffStr       = body.get("difficulty") instanceof String s ? s : "MIXED";
            UserQuestion.Difficulty diff;
            try { diff = UserQuestion.Difficulty.valueOf(diffStr.toUpperCase()); }
            catch (Exception e) { diff = UserQuestion.Difficulty.MIXED; }

            UserQuestionService.ManualQuestionRequest req = new UserQuestionService.ManualQuestionRequest(
                    (String) body.get("content"),
                    options,
                    correctAnswer,
                    diff,
                    body.get("explanation") instanceof String s ? s : null,
                    body.get("book") instanceof String s ? s : null,
                    body.get("chapter") instanceof Number n ? n.intValue() : null,
                    body.get("theme") instanceof String s ? s : null,
                    body.get("language") instanceof String s ? s : "vi"
            );

            UserQuestion saved = service.saveManual(user, req);
            return ResponseEntity.ok(Map.of("success", true, "question", toDTO(saved)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** PUT /api/user-questions/{id} — edit a question (content, options, correctAnswer, etc.) */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id,
                                     @RequestBody Map<String, Object> body,
                                     Principal principal) {
        try {
            User user = getUser(principal);
            @SuppressWarnings("unchecked")
            List<String> options = (List<String>) body.get("options");
            int correctAnswer    = body.get("correctAnswer") instanceof Number n ? n.intValue() : 0;
            String diffStr       = body.get("difficulty") instanceof String s ? s : "MIXED";
            UserQuestion.Difficulty diff;
            try { diff = UserQuestion.Difficulty.valueOf(diffStr.toUpperCase()); }
            catch (Exception e) { diff = UserQuestion.Difficulty.MIXED; }

            UserQuestionService.ManualQuestionRequest req = new UserQuestionService.ManualQuestionRequest(
                    (String) body.get("content"),
                    options,
                    correctAnswer,
                    diff,
                    body.get("explanation") instanceof String s ? s : null,
                    body.get("book") instanceof String s ? s : null,
                    body.get("chapter") instanceof Number n ? n.intValue() : null,
                    body.get("theme") instanceof String s ? s : null,
                    body.get("language") instanceof String s ? s : "vi"
            );

            UserQuestion saved = service.updateQuestion(id, user.getId(), req);
            return ResponseEntity.ok(Map.of("success", true, "question", toDTO(saved)));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** DELETE /api/user-questions/{id} */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            service.delete(id, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** POST /api/user-questions/assign-to-room — gán danh sách câu hỏi vào phòng */
    @PostMapping("/assign-to-room")
    public ResponseEntity<?> assignToRoom(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);
            String roomId = (String) body.get("roomId");
            @SuppressWarnings("unchecked")
            List<String> questionIds = (List<String>) body.get("questionIds");

            if (roomId == null || questionIds == null || questionIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false, "message", "Thiếu roomId hoặc questionIds"));
            }

            service.assignToRoom(roomId, questionIds, user.getId());

            List<RoomQuestionSelection> selections = service.getRoomSelections(roomId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "assigned", selections.size(),
                    "questions", selections.stream()
                            .map(s -> toDTO(s.getUserQuestion())).toList()));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** GET /api/user-questions/room/{roomId} — câu hỏi đã gán cho phòng */
    @GetMapping("/room/{roomId}")
    public ResponseEntity<?> getRoomQuestions(@PathVariable String roomId) {
        try {
            List<RoomQuestionSelection> selections = service.getRoomSelections(roomId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "questions", selections.stream().map(s -> toDTO(s.getUserQuestion())).toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** DELETE /api/user-questions/room/{roomId}/{questionId} — xoá khỏi danh sách phòng */
    @DeleteMapping("/room/{roomId}/{questionId}")
    public ResponseEntity<?> removeFromRoom(@PathVariable String roomId,
                                             @PathVariable String questionId,
                                             Principal principal) {
        try {
            User user = getUser(principal);
            service.removeFromRoom(roomId, questionId, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> toDTO(UserQuestion q) {
        return Map.of(
                "id",            q.getId(),
                "content",       q.getContent(),
                "options",       q.getOptions(),
                "correctAnswer", q.getCorrectAnswer(),
                "difficulty",    q.getDifficulty().name(),
                "source",        q.getSource().name(),
                "book",          q.getBook() != null ? q.getBook() : "",
                "chapter",       q.getChapterStart() != null ? q.getChapterStart() : 0,
                "explanation",   q.getExplanation() != null ? q.getExplanation() : "",
                "theme",         q.getTheme() != null ? q.getTheme() : ""
        );
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
