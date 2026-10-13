package com.biblequiz.api;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

/** Sổ cầu nguyện của tôi (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 3). */
@RestController
@RequestMapping("/api/prayer/me")
public class PrayerController {

    private final PrayerService service;
    private final UserRepository userRepository;

    public PrayerController(PrayerService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> me(Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        PrayerService.Me me = service.me(user.getId(), Instant.now());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("account", user.getId());
        body.put("name", user.getName() != null ? user.getName() : "");
        body.put("items", me.items().stream().map(PrayerController::itemJson).toList());
        body.put("prayed", me.prayed().stream().map(p -> Map.of("id", p.getId(), "itemId", p.getItemId(),
                "prayedAt", PrayerInput.iso(p.prayedAtInstant()))).toList());
        body.put("shares", me.shares().stream().map(PrayerController::shareJson).toList());
        return ResponseEntity.ok(body);
    }

    @PutMapping("/items")
    public ResponseEntity<?> putItems(@RequestBody Map<String, Object> body, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        return run(() -> {
            List<Item> out = service.putItems(user.getId(), PrayerInput.items(body), Instant.now());
            return ResponseEntity.ok(Map.of("items", out.stream().map(PrayerController::itemJson).toList()));
        });
    }

    @PostMapping("/prayed")
    public ResponseEntity<?> prayed(@RequestBody Map<String, Object> body, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        return run(() -> ResponseEntity.ok(Map.of("saved",
                service.addPrayed(user.getId(), PrayerInput.prayed(body), Instant.now()))));
    }

    @PostMapping("/items/{id}/share")
    public ResponseEntity<?> share(@PathVariable String id, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        return run(() -> {
            PrayerService.ShareView v = service.share(user.getId(), id, Instant.now());
            return ResponseEntity.ok(Map.of("token", v.token(), "url", v.url()));
        });
    }

    @DeleteMapping("/shares/{token}")
    public ResponseEntity<?> revoke(@PathVariable String token, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        return run(() -> {
            service.revoke(user.getId(), token, Instant.now());
            return ResponseEntity.noContent().build();
        });
    }

    @GetMapping("/items/{id}/intercessions")
    public ResponseEntity<?> intercessions(@PathVariable String id, Principal principal) {
        User user = getUser(principal);
        if (user == null) return unauthorized();
        return run(() -> {
            PrayerService.Intercessions r = service.intercessions(user.getId(), id);
            List<Map<String, Object>> people = r.people().stream().map(p -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", p.name());
                m.put("count", p.count());
                m.put("lastPrayedAt", PrayerInput.iso(p.lastPrayedAt()));
                return m;
            }).toList();
            return ResponseEntity.ok(Map.of("total", r.total(), "people", people));
        });
    }

    static Map<String, Object> itemJson(Item i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.id());
        m.put("title", i.title());
        m.put("detail", i.detail());
        m.put("status", i.status());
        m.put("testimony", i.testimony());
        m.put("createdAt", PrayerInput.iso(i.createdAt()));
        m.put("answeredAt", PrayerInput.iso(i.answeredAt()));
        m.put("updatedAt", PrayerInput.iso(i.updatedAt()));
        m.put("deletedAt", PrayerInput.iso(i.deletedAt()));
        return m;
    }

    private static Map<String, Object> shareJson(PrayerService.ShareView s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("token", s.token());
        m.put("itemId", s.itemId());
        m.put("createdAt", PrayerInput.iso(s.createdAt()));
        m.put("url", s.url());
        m.put("count", s.count());
        m.put("lastPrayedAt", PrayerInput.iso(s.lastPrayedAt()));
        return m;
    }

    /** 400 đầu vào sai, 404 không có (hoặc không phải của mình), 409 trái trạng thái. */
    private static ResponseEntity<?> run(Supplier<ResponseEntity<?>> action) {
        try {
            return action.get();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("message", "Không tìm thấy"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
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
