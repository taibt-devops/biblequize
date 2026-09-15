package com.biblequiz.api;

import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.service.BiblePassageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public availability check for Memorize mode (SPEC_USER §5.1.1, §27.20). Lives under
 * {@code /api/public/**} (already permitAll) so guests on /practice can hide or show the
 * entry card too. Exposes only a boolean — never verse text.
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
        return ResponseEntity.ok(Map.of("version", BibleVerse.BTTHD_2011, "available", passageService.isTextAvailable()));
    }
}
