package com.biblequiz.api;

import com.biblequiz.modules.home.service.HomeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Trang chủ Làng nhỏ ở forbible.org: tên, huy hiệu việc hôm nay, nút Đi tiếp, sổ tay (forbible-home docs/07 mục 3). */
@RestController
@RequestMapping("/api/home")
public class HomeController {

    private final HomeService service;
    private final UserRepository userRepository;

    public HomeController(HomeService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Principal principal) {
        User user = getUser(principal);
        if (user == null) return ResponseEntity.status(401).body(Map.of("message", "Chưa đăng nhập"));
        HomeService.Home h = service.home(user, Instant.now());

        Map<String, Object> badges = new LinkedHashMap<>();
        h.badges().forEach((app, b) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", b.kind());
            if (b.value() != null) m.put("value", b.value());
            badges.put(app, m);
        });
        Map<String, Object> next = new LinkedHashMap<>();
        next.put("app", h.next().app());
        next.put("reason", h.next().reason());
        next.put("label", h.next().label());
        next.put("line", h.next().line());
        next.put("url", h.next().url());
        Map<String, Object> journal = new LinkedHashMap<>();
        journal.put("verses", h.journal().verses());
        journal.put("badges", h.journal().badges());
        journal.put("recentBadge", h.journal().recentBadge());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("user", Map.of("displayName", h.user().displayName(), "initials", h.user().initials()));
        body.put("badges", badges);
        body.put("continue", next);
        body.put("allDone", h.allDone());
        body.put("isNew", h.isNew());
        body.put("journal", journal);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
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
