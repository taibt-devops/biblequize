package com.biblequiz.api;

import com.biblequiz.modules.reading.service.ReadingProgressService;
import com.biblequiz.modules.reading.service.ReadingProgressService.Progress;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Tiến độ của tôi trong app Đọc hằng ngày (forbible-doc docs/04-kien-truc.md, Bản 2 mục 3). */
@RestController
@RequestMapping("/api/reading/me")
public class ReadingController {

    private final ReadingProgressService service;
    private final UserRepository userRepository;

    public ReadingController(ReadingProgressService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> get(Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        Map<String, Object> body = new HashMap<>();
        body.put("account", user.getId());
        body.put("name", user.getName() != null ? user.getName() : "");
        body.put("progress", service.get(user.getId()).map(ReadingController::json).orElse(null));
        return ResponseEntity.ok(body);
    }

    @PutMapping
    public ResponseEntity<?> put(@RequestBody Map<String, Object> body, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        try {
            Progress saved = service.put(user.getId(), ReadingProgressService.parse(body), Instant.now());
            Map<String, Object> out = new HashMap<>();
            out.put("progress", json(saved));
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private static Map<String, Object> json(Progress p) {
        Map<String, Object> m = new HashMap<>();
        m.put("plan", p.plan());
        m.put("next", p.next());
        m.put("lap", p.lap());
        m.put("startedAt", ReadingProgressService.iso(p.startedAt()));
        m.put("lastReadAt", ReadingProgressService.iso(p.lastReadAt()));
        m.put("updatedAt", ReadingProgressService.iso(p.updatedAt()));
        return m;
    }

    private static ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(401).body(Map.of("message", "Chưa đăng nhập"));
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
