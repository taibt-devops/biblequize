package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.QuizSession;
import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.ranked.model.RankTier;
import com.biblequiz.modules.share.service.ShareCardService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;

@RestController
@RequestMapping("/api/share")
public class ShareCardController {

    /** Tên miền của Bible Quiz (prod: APP_FRONTEND_URL). Chuyển từ forbible.org sang quiz.forbible.org ngày 13/10/2026. */
    @Value("${app.frontend-url:https://quiz.forbible.org}")
    private String frontendUrl;

    private String site() {
        String u = frontendUrl == null || frontendUrl.isBlank() ? "https://quiz.forbible.org" : frontendUrl.trim();
        return u.endsWith("/") ? u.substring(0, u.length() - 1) : u;
    }

    @Autowired
    private ShareCardService shareCardService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QuizSessionRepository quizSessionRepository;

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<?> getSessionCard(@PathVariable String sessionId, Principal principal) {
        User user = getUser(principal);
        Map<String, Object> card = shareCardService.getOrCreateSessionCard(sessionId, user);
        return ResponseEntity.ok(card);
    }

    @GetMapping("/tier-up/{tierId}")
    public ResponseEntity<?> getTierUpCard(@PathVariable String tierId, Principal principal) {
        User user = getUser(principal);
        Map<String, Object> card = shareCardService.getOrCreateTierUpCard(tierId, user);
        return ResponseEntity.ok(card);
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> incrementViewCount(@PathVariable String id) {
        shareCardService.incrementViewCount(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Social bot OG meta endpoint.
     * Bots (Facebook, Zalo, Twitter, Google) get HTML with OG tags.
     * Regular users get redirected to the SPA.
     */
    @GetMapping(value = "/og/session/{sessionId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> ogSessionCard(
            @PathVariable String sessionId,
            @RequestHeader(value = "User-Agent", defaultValue = "") String userAgent) {

        if (!isSocialBot(userAgent)) {
            return ResponseEntity.status(302)
                    .header("Location", site() + "/share/session/" + sessionId)
                    .build();
        }

        QuizSession session = quizSessionRepository.findById(sessionId).orElse(null);
        String title = "BibleQuiz — Ket qua Quiz";
        String description = "Thu thach kien thuc Kinh Thanh cung BibleQuiz!";

        if (session != null) {
            int correct = session.getCorrectAnswers() != null ? session.getCorrectAnswers() : 0;
            int total = session.getTotalQuestions() != null ? session.getTotalQuestions() : 0;
            String name = session.getOwner() != null ? session.getOwner().getName() : "Player";
            title = "BibleQuiz — " + name + ": " + correct + "/" + total + " cau dung!";
            int pct = total > 0 ? (correct * 100 / total) : 0;
            description = name + " da tra loi dung " + correct + "/" + total + " cau (" + pct + "%). Ban co lam tot hon khong?";
        }

        String ogHtml = buildOgHtml(title, description, site() + "/og-image.png",
                site() + "/share/session/" + sessionId);
        return ResponseEntity.ok(ogHtml);
    }

    @GetMapping(value = "/og/tier-up/{tierKey}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> ogTierUpCard(
            @PathVariable String tierKey,
            @RequestHeader(value = "User-Agent", defaultValue = "") String userAgent) {

        if (!isSocialBot(userAgent)) {
            return ResponseEntity.status(302)
                    .header("Location", site() + "/share/tier-up/" + tierKey)
                    .build();
        }

        RankTier tier = null;
        for (RankTier t : RankTier.values()) {
            if (t.getKey().equals(tierKey)) {
                tier = t;
                break;
            }
        }
        String tierName = tier != null ? tier.getDisplayName() : tierKey;
        String title = "BibleQuiz — Dat cap " + tierName + "!";
        String description = "Dat thanh tich " + tierName + " tren BibleQuiz. Hoc Kinh Thanh moi ngay!";

        String ogHtml = buildOgHtml(title, description, site() + "/og-image.png",
                site() + "/share/tier-up/" + tierKey);
        return ResponseEntity.ok(ogHtml);
    }

    @GetMapping(value = "/og/daily", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> ogDailyChallenge(
            @RequestHeader(value = "User-Agent", defaultValue = "") String userAgent) {

        if (!isSocialBot(userAgent)) {
            return ResponseEntity.status(302)
                    .header("Location", site() + "/daily")
                    .build();
        }

        String date = LocalDate.now(ZoneOffset.UTC).toString();
        String ogHtml = buildOgHtml(
                "BibleQuiz — Thu thach ngay " + date,
                "5 cau hoi Kinh Thanh moi ngay. Ban co the tra loi dung het khong?",
                site() + "/og-image.png",
                site() + "/daily");
        return ResponseEntity.ok(ogHtml);
    }

    private boolean isSocialBot(String userAgent) {
        if (userAgent == null) return false;
        String ua = userAgent.toLowerCase();
        return ua.contains("facebookexternalhit") || ua.contains("twitterbot")
                || ua.contains("linkedinbot") || ua.contains("googlebot")
                || ua.contains("zalo") || ua.contains("telegrambot")
                || ua.contains("whatsapp") || ua.contains("slackbot");
    }

    private String buildOgHtml(String title, String description, String imageUrl, String url) {
        return "<!DOCTYPE html><html lang=\"vi\"><head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta property=\"og:type\" content=\"website\">"
                + "<meta property=\"og:title\" content=\"" + escapeHtml(title) + "\">"
                + "<meta property=\"og:description\" content=\"" + escapeHtml(description) + "\">"
                + "<meta property=\"og:image\" content=\"" + imageUrl + "\">"
                + "<meta property=\"og:url\" content=\"" + url + "\">"
                + "<meta property=\"og:site_name\" content=\"BibleQuiz\">"
                + "<meta property=\"og:locale\" content=\"vi_VN\">"
                + "<meta name=\"twitter:card\" content=\"summary_large_image\">"
                + "<meta name=\"twitter:title\" content=\"" + escapeHtml(title) + "\">"
                + "<meta name=\"twitter:description\" content=\"" + escapeHtml(description) + "\">"
                + "<meta name=\"twitter:image\" content=\"" + imageUrl + "\">"
                + "<title>" + escapeHtml(title) + "</title>"
                + "</head><body><p>" + escapeHtml(description) + "</p></body></html>";
    }

    private String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    /**
     * Render session share card as self-contained HTML.
     * Frontend uses html-to-image to convert this to PNG client-side.
     */
    @GetMapping(value = "/render/session/{sessionId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderSessionCard(@PathVariable String sessionId) {
        QuizSession session = quizSessionRepository.findById(sessionId).orElse(null);

        String userName = "Player";
        int score = 0;
        int correctAnswers = 0;
        int totalQuestions = 0;

        if (session != null) {
            if (session.getOwner() != null) {
                userName = session.getOwner().getName();
            }
            score = session.getScore() != null ? session.getScore() : 0;
            correctAnswers = session.getCorrectAnswers() != null ? session.getCorrectAnswers() : 0;
            totalQuestions = session.getTotalQuestions() != null ? session.getTotalQuestions() : 0;
        }

        String date = LocalDate.now(ZoneOffset.UTC).toString();
        String html = shareCardService.renderSessionHtml(userName, score, correctAnswers, totalQuestions, date);
        return ResponseEntity.ok(html);
    }

    /**
     * Render tier-up share card as self-contained HTML.
     */
    @GetMapping(value = "/render/tier-up/{tierKey}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderTierUpCard(@PathVariable String tierKey, Principal principal) {
        User user = getUser(principal);
        RankTier tier = null;
        for (RankTier t : RankTier.values()) {
            if (t.getKey().equals(tierKey)) {
                tier = t;
                break;
            }
        }

        String tierName = tier != null ? tier.getDisplayName() : tierKey;
        String html = shareCardService.renderTierUpHtml(user.getName(), tierName, tierKey);
        return ResponseEntity.ok(html);
    }

    private User getUser(Principal principal) {
        if (principal == null) throw new RuntimeException("Chưa đăng nhập");
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof OAuth2User oauth2User) {
            String email = oauth2User.getAttribute("email");
            if (email != null) {
                return userRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
            }
        }
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
    }
}
