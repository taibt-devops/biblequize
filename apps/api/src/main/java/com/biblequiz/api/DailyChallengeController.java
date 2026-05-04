package com.biblequiz.api;

import com.biblequiz.api.dto.CompleteDailyChallengeRequest;
import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.quiz.entity.Question;

import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * SPEC-v2: Daily Challenge — 5 fixed questions per day.
 * Guests can play (no auth required for GET).
 */
@RestController
@RequestMapping("/api/daily-challenge")
public class DailyChallengeController {

    private static final Logger log = LoggerFactory.getLogger(DailyChallengeController.class);

    @Autowired
    private DailyChallengeService dailyChallengeService;

    /**
     * GET /api/daily-challenge — get today's 5 questions.
     * Public endpoint (guests allowed).
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getDailyChallenge(
            Authentication authentication,
            @RequestParam(defaultValue = "vi") String language) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<Question> questions = dailyChallengeService.getTodayQuestions(language);

        boolean alreadyCompleted = false;
        if (authentication != null) {
            String userId = authentication.getName();
            alreadyCompleted = dailyChallengeService.hasCompletedToday(userId);
        }

        // Strip correct answers from response (client shouldn't see them)
        List<Map<String, Object>> sanitized = questions.stream().map(q -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("book", q.getBook());
            m.put("chapter", q.getChapter());
            m.put("difficulty", q.getDifficulty());
            m.put("type", q.getType());
            m.put("content", q.getContent());
            m.put("options", q.getOptions());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("date", today.toString());
        response.put("questions", sanitized);
        response.put("alreadyCompleted", alreadyCompleted);
        response.put("totalQuestions", dailyChallengeService.getDailyQuestionCount());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/daily-challenge/start — start a daily challenge session.
     * Returns session ID for tracking answers.
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startChallenge(Authentication authentication) {
        String sessionId = "daily-" + LocalDate.now(ZoneOffset.UTC) + "-" + System.currentTimeMillis();

        Map<String, Object> response = Map.of(
                "sessionId", sessionId,
                "date", LocalDate.now(ZoneOffset.UTC).toString(),
                "totalQuestions", dailyChallengeService.getDailyQuestionCount());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/daily-challenge/answer — check a single answer without a real QuizSession.
     * Returns isCorrect, correctAnswer indices, and explanation.
     * Public (guests can play), no auth required.
     */
    @PostMapping("/answer")
    public ResponseEntity<Map<String, Object>> checkAnswer(
            @RequestBody Map<String, Object> body) {
        String questionId = (String) body.get("questionId");
        Integer selectedAnswer = (Integer) body.get("answer");
        if (questionId == null || selectedAnswer == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "questionId and answer are required"));
        }
        try {
            return ResponseEntity.ok(dailyChallengeService.checkAnswer(questionId, selectedAnswer));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/daily-challenge/complete — mark today's daily challenge as completed.
     *
     * <p>Called by the client after finishing all 5 questions. Records completion
     * in the Redis cache so subsequent {@code GET /api/daily-challenge} calls return
     * {@code alreadyCompleted: true}, and so {@code GET /result} returns the score.
     *
     * <p>Auth required — guests can play but cannot persist results.
     * Idempotent: calling twice on the same day returns the existing completion
     * without overwriting.
     */
    @PostMapping("/complete")
    public ResponseEntity<Map<String, Object>> complete(
            Authentication authentication,
            @Valid @RequestBody CompleteDailyChallengeRequest req) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Login required to complete daily challenge"));
        }

        String userId = authentication.getName();

        // Idempotency: if already completed today, return existing state without overwrite
        if (dailyChallengeService.hasCompletedToday(userId)) {
            log.info("Daily challenge already completed today for user {}, skipping markCompleted", userId);
            return ResponseEntity.ok(Map.of(
                    "completed", true,
                    "alreadyCompleted", true,
                    "date", LocalDate.now(ZoneOffset.UTC).toString()));
        }

        dailyChallengeService.markCompleted(userId, req.getScore(), req.getCorrectCount());

        log.info("Daily challenge completed by user {} with score={} correct={}/5",
                userId, req.getScore(), req.getCorrectCount());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("completed", true);
        response.put("alreadyCompleted", false);
        response.put("date", LocalDate.now(ZoneOffset.UTC).toString());
        response.put("score", req.getScore());
        response.put("correct", req.getCorrectCount());
        response.put("total", dailyChallengeService.getDailyQuestionCount());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/daily-challenge/result — get results after completion.
     *
     * <p>Now returns the full payload the FeaturedDailyChallenge
     * "completed" banner needs (score, correctCount, totalQuestions,
     * xpEarned, nextResetAt). Falls back to {@code completed=false} for
     * users who haven't finished today.
     */
    @GetMapping("/result")
    public ResponseEntity<Map<String, Object>> getResult(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Login required to view results"));
        }

        String userId = authentication.getName();
        return ResponseEntity.ok(dailyChallengeService.getResultData(userId));
    }
}
