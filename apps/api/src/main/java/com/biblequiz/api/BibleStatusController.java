package com.biblequiz.api;

import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.service.BiblePassageService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * API công khai về toàn văn (dưới {@code /api/public/**}, đã permitAll):
 * {@code /status} cho cổng Học Thuộc (SPEC_USER §5.1.1, §27.20), và {@code /range} trả chữ RVV11 theo
 * đoạn cho app Đọc hằng ngày (doc.forbible.org). Chủ dự án cho dùng công khai toàn văn RVV11 (DECISIONS 09/10/2026).
 */
@RestController
@RequestMapping("/api/public/bible")
public class BibleStatusController {

    private final BiblePassageService passageService;

    public BibleStatusController(BiblePassageService passageService) {
        this.passageService = passageService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of("version", BibleVerse.ACTIVE_VERSION, "available", passageService.isTextAvailable()));
    }

    @GetMapping("/range")
    public ResponseEntity<?> range(@RequestParam String book, @RequestParam String from, @RequestParam String to) {
        int[] a = parseRef(from);
        int[] b = parseRef(to);
        if (a == null || b == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "from/to phải có dạng chương:câu"));
        }
        try {
            BiblePassageService.RangeText range = passageService.getRange(book, a[0], a[1], b[0], b[1]);
            if (range.chapters().isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("message", "Chưa có chữ cho đoạn này"));
            }
            return ResponseEntity.ok().cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic()).body(range);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** "5:12" → {5, 12}; sai dạng → null. */
    static int[] parseRef(String ref) {
        String[] parts = ref.split(":");
        if (parts.length != 2) return null;
        try {
            return new int[]{Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim())};
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
