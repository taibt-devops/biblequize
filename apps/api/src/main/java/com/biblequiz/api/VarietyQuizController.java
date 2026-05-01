package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector.QuestionFilter;
import com.biblequiz.modules.quiz.service.WeeklyThemeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Variety modes (Mystery / Speed Round / Weekly Themed / Seasonal) per Bui
 * decision 2026-05-02: "for fun, no XP, no leaderboard". These endpoints
 * return question lists only — no QuizSession is created, no scoring path
 * runs server-side, no points are written anywhere. The previous
 * {@code xpMultiplier} keys (1.5x / 2.0x / 1.5x) were removed since no
 * scoring code consumed them; advertising a non-functional multiplier
 * misled FE devs into thinking variety play granted XP when it does not.
 *
 * <p>Daily Bonus ({@code /daily-bonus}) keeps {@code bonusType}/value
 * because FE displays the bonus card UI from those fields. The multipliers
 * referenced by {@code DOUBLE_XP} are still dead code server-side — see
 * the TODO at that endpoint.
 *
 * <p>If you want to wire scoring for a variety mode in future:
 * <ol>
 *   <li>Decide leaderboard contamination policy (consult Bui).</li>
 *   <li>Create a {@link com.biblequiz.modules.quiz.entity.QuizSession}
 *       with the appropriate mode.</li>
 *   <li>Route through a dedicated scoring path — NOT
 *       {@link com.biblequiz.modules.quiz.service.SessionService#creditNonRankedProgress}
 *       (it has an allow-list that rejects variety modes).</li>
 *   <li>Update FE to display XP feedback after the round.</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/quiz")
public class VarietyQuizController {

    private final WeeklyThemeService weeklyThemeService;
    private final SmartQuestionSelector smartQuestionSelector;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public VarietyQuizController(WeeklyThemeService weeklyThemeService,
                                  SmartQuestionSelector smartQuestionSelector,
                                  QuestionRepository questionRepository,
                                  UserRepository userRepository) {
        this.weeklyThemeService = weeklyThemeService;
        this.smartQuestionSelector = smartQuestionSelector;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    private String getUserId(Authentication auth) {
        if (auth == null) return null;
        String email = null;
        if (auth.getPrincipal() instanceof UserDetails ud) email = ud.getUsername();
        else if (auth.getPrincipal() instanceof OAuth2User o) email = o.getAttribute("email");
        if (email == null) return null;
        return userRepository.findByEmail(email).map(User::getId).orElse(null);
    }

    // ── Weekly Themed Quiz ──

    @GetMapping("/weekly")
    public ResponseEntity<?> getWeeklyQuiz(Authentication auth,
            @RequestParam(defaultValue = "vi") String language) {
        String userId = getUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        Map<String, Object> response = weeklyThemeService.getWeeklyQuizResponse(language);
        List<Question> questions = weeklyThemeService.getWeeklyQuestions(userId, 10, language);
        response.put("questions", questions);
        response.put("questionCount", questions.size());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/weekly/theme")
    public ResponseEntity<?> getWeeklyTheme(@RequestParam(defaultValue = "vi") String language) {
        return ResponseEntity.ok(weeklyThemeService.getWeeklyQuizResponse(language));
    }

    // ── Mystery Mode ──

    @PostMapping("/mystery")
    public ResponseEntity<?> startMysteryQuiz(Authentication auth,
            @RequestParam(defaultValue = "vi") String language) {
        String userId = getUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        // Random from ALL books, ALL difficulties
        List<Question> questions = smartQuestionSelector.selectQuestions(
                userId, 10, new QuestionFilter(null, null, language));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questions", questions);
        response.put("questionCount", questions.size());
        response.put("timerSeconds", 25);
        return ResponseEntity.ok(response);
    }

    // ── Speed Round ──

    @GetMapping("/speed-round")
    public ResponseEntity<?> getSpeedRound(Authentication auth,
            @RequestParam(defaultValue = "vi") String language) {
        String userId = getUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        // 10 EASY questions, 10 seconds each, 2x XP
        List<Question> questions = smartQuestionSelector.selectQuestions(
                userId, 10, new QuestionFilter(null, "easy", language));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("available", true);
        response.put("questions", questions);
        response.put("questionCount", questions.size());
        response.put("timerSeconds", 10);
        return ResponseEntity.ok(response);
    }

    // ── Daily Bonus ──

    @GetMapping("/daily-bonus")
    public ResponseEntity<?> getDailyBonus(Authentication auth) {
        String userId = getUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        // Deterministic random per user per day (~14% chance)
        long seed = userId.hashCode() * 1000L + LocalDate.now().toEpochDay();
        Random random = new Random(seed);
        boolean isLucky = random.nextInt(7) == 0;

        if (!isLucky) {
            return ResponseEntity.ok(Map.of("hasBonus", false));
        }

        String[] bonusTypes = {"DOUBLE_XP", "EXTRA_ENERGY", "FREE_FREEZE", "BONUS_STREAK"};
        String type = bonusTypes[random.nextInt(bonusTypes.length)];

        Map<String, Object> bonus = new LinkedHashMap<>();
        bonus.put("hasBonus", true);
        bonus.put("bonusType", type);
        switch (type) {
            case "DOUBLE_XP" -> {
                bonus.put("message", "2x XP hôm nay!");
                bonus.put("value", 2.0);
            }
            case "EXTRA_ENERGY" -> {
                bonus.put("message", "Thêm 50 energy!");
                bonus.put("value", 50);
            }
            case "FREE_FREEZE" -> {
                bonus.put("message", "Streak Freeze miễn phí!");
                bonus.put("value", 1);
            }
            case "BONUS_STREAK" -> {
                bonus.put("message", "Streak +1 ngày!");
                bonus.put("value", 1);
            }
        }
        return ResponseEntity.ok(bonus);
    }

    // ── Seasonal Content ──

    @GetMapping("/seasonal")
    public ResponseEntity<?> getSeasonalContent(@RequestParam(defaultValue = "vi") String language) {
        int month = LocalDate.now().getMonthValue();
        int day = LocalDate.now().getDayOfMonth();

        String season;
        if (month == 12 && day >= 1 && day <= 25) season = "CHRISTMAS";
        else if (month == 3 || (month == 4 && day <= 20)) season = "EASTER";
        else season = "NORMAL";

        if ("NORMAL".equals(season)) {
            return ResponseEntity.ok(Map.of("season", "NORMAL", "hasEvent", false));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("season", season);
        response.put("hasEvent", true);

        if ("CHRISTMAS".equals(season)) {
            response.put("title", "Mùa Giáng Sinh");
            response.put("description", "Câu hỏi về sự giáng sinh của Chúa Giê-su");
            response.put("books", List.of("Matthew", "Luke", "Isaiah"));
        } else {
            response.put("title", "Mùa Phục Sinh");
            response.put("description", "Câu hỏi về sự phục sinh");
            response.put("books", List.of("Matthew", "Mark", "Luke", "John"));
        }
        return ResponseEntity.ok(response);
    }
}
