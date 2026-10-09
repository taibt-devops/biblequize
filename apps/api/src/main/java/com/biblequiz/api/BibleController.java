package com.biblequiz.api;

import com.biblequiz.modules.bible.service.BiblePassageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Toàn văn Kinh Thánh cho mode Học Thuộc (SPEC_USER §5.1.1, §27.20). Yêu cầu đăng nhập. */
@RestController
@RequestMapping("/api/bible")
public class BibleController {

    private final BiblePassageService passageService;

    public BibleController(BiblePassageService passageService) {
        this.passageService = passageService;
    }

    @GetMapping("/passage")
    public ResponseEntity<?> passage(@RequestParam String book, @RequestParam int chapter,
                                     @RequestParam int from, @RequestParam int to) {
        try {
            return passageService.getPassage(book, chapter, from, to)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(404)
                            .body(Map.of("success", false, "message", "Chưa có nội dung cho đoạn này")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /** Câu (và khối gộp "17-18") có chữ trong chương, theo cách đánh số của bản dịch — bộ chọn câu Học Thuộc. */
    @GetMapping("/verses")
    public ResponseEntity<?> verses(@RequestParam String book, @RequestParam int chapter) {
        try {
            return ResponseEntity.ok(passageService.chapterVerses(book, chapter));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
