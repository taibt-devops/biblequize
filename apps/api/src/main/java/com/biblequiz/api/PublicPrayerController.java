package com.biblequiz.api;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PublicPrayerService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Trang người nhận link nhờ cầu thay (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 4). Không cần đăng nhập.
 * Token sai dạng, link lạ, đã thu lại hay điều đã xóa đều trả cùng một 404.
 */
@RestController
@RequestMapping("/api/public/prayer/shares")
public class PublicPrayerController {

    private static final String GONE = "Không có lời nhờ này";

    private final PublicPrayerService service;

    public PublicPrayerController(PublicPrayerService service) {
        this.service = service;
    }

    @GetMapping("/{token}")
    public ResponseEntity<?> view(@PathVariable String token) {
        if (!PrayerInput.isToken(token)) return gone();
        try {
            PublicPrayerService.View v = service.view(token);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("ownerName", v.ownerName());
            body.put("title", v.title());
            body.put("detail", v.detail());
            body.put("status", v.status());
            body.put("count", v.count());
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
        } catch (NoSuchElementException e) {
            return gone();
        }
    }

    @PostMapping("/{token}/prayed")
    public ResponseEntity<?> prayed(@PathVariable String token, @RequestBody(required = false) Map<String, Object> body) {
        if (!PrayerInput.isToken(token)) return gone();
        try {
            Object visitor = body == null ? null : body.get("visitorId");
            String name = PrayerInput.cleanVisitorName(body == null ? null : body.get("name"));
            long count = service.pray(token, visitor instanceof String s ? s : null, name, Instant.now());
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("count", count));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(Map.of("message", e.getMessage()));
        } catch (NoSuchElementException e) {
            return gone();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).cacheControl(CacheControl.noStore()).body(Map.of("message", e.getMessage()));
        }
    }

    private static ResponseEntity<?> gone() {
        return ResponseEntity.status(404).cacheControl(CacheControl.noStore()).body(Map.of("message", GONE));
    }
}
