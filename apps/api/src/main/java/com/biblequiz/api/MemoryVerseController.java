package com.biblequiz.api;

import com.biblequiz.modules.memorize.service.MemoryVerseException;
import com.biblequiz.modules.memorize.service.MemoryVerseService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.function.Function;

/** Danh sách Học Thuộc của tôi (SPEC_USER §5.1.1, §27.20). */
@RestController
@RequestMapping("/api/me/memory-verses")
public class MemoryVerseController {

    private final MemoryVerseService service;
    private final UserRepository userRepository;

    public MemoryVerseController(MemoryVerseService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> list(Principal principal) {
        return handle(principal, user -> {
            LocalDateTime now = LocalDateTime.now();
            return ResponseEntity.ok(Map.of("items", service.list(user.getId(), now),
                    "dueCount", service.dueCount(user.getId(), now)));
        });
    }

    @GetMapping("/due")
    public ResponseEntity<?> due(Principal principal) {
        return handle(principal, user -> ResponseEntity.ok(Map.of("items", service.due(user.getId(), LocalDateTime.now()))));
    }

    @GetMapping("/due-count")
    public ResponseEntity<?> dueCount(Principal principal) {
        return handle(principal, user -> ResponseEntity.ok(Map.of("dueCount", service.dueCount(user.getId(), LocalDateTime.now()))));
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody Map<String, Object> body, Principal principal) {
        return handle(principal, user -> {
            if (!(body.get("book") instanceof String book) || !(body.get("chapter") instanceof Number chapter)
                    || !(body.get("verseStart") instanceof Number start) || !(body.get("verseEnd") instanceof Number end)) {
                throw new MemoryVerseException(MemoryVerseException.Kind.INVALID, "Thiếu book/chapter/verseStart/verseEnd");
            }
            return ResponseEntity.status(201).body(service.add(user, book, chapter.intValue(),
                    start.intValue(), end.intValue(), LocalDateTime.now()));
        });
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, Principal principal) {
        return handle(principal, user -> {
            service.delete(user.getId(), id);
            return ResponseEntity.noContent().build();
        });
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<?> review(@PathVariable String id, @RequestBody Map<String, Object> body, Principal principal) {
        return handle(principal, user -> {
            if (!(body.get("passed") instanceof Boolean passed)) {
                throw new MemoryVerseException(MemoryVerseException.Kind.INVALID, "Thiếu passed");
            }
            return ResponseEntity.ok(service.review(user.getId(), id, passed, LocalDateTime.now()));
        });
    }

    private ResponseEntity<?> handle(Principal principal, Function<User, ResponseEntity<?>> action) {
        User user = getUser(principal);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Chưa đăng nhập"));
        }
        try {
            return action.apply(user);
        } catch (MemoryVerseException e) {
            int status = switch (e.getKind()) {
                case INVALID -> 400;
                case DUPLICATE -> 409;
                case NOT_FOUND -> 404;
            };
            return ResponseEntity.status(status).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    private User getUser(Principal principal) {
        if (principal == null) return null;
        String email = principal.getName();
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof OAuth2User oauth2User
                && oauth2User.getAttribute("email") != null) {
            email = oauth2User.getAttribute("email");
        }
        return userRepository.findByEmail(email).orElse(null);
    }
}
