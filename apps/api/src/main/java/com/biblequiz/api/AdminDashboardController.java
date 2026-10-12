package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.tournament.repository.TournamentRepository;
// AuditEventRepository removed — will add when audit entity is standardized

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@RestController
@RequestMapping("/api/admin/dashboard")
@PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_MOD')")
public class AdminDashboardController {

    @Autowired private UserRepository userRepository;
    @Autowired private QuestionRepository questionRepository;
    @Autowired(required = false) private QuizSessionRepository sessionRepository;
    @Autowired(required = false) private TournamentRepository tournamentRepository;
    // Audit event repository removed for now

    @GetMapping
    public ResponseEntity<?> getDashboard() {
        Map<String, Object> data = new LinkedHashMap<>();

        // KPIs
        long totalUsers = userRepository.count();
        long totalQuestions = questionRepository.countByIsActiveTrue();
        long pendingReview = questionRepository.countByReviewStatus(Question.ReviewStatus.PENDING);

        // Active sessions today
        long activeSessions = 0;
        try {
            if (sessionRepository != null) {
                activeSessions = sessionRepository.countByCreatedAtAfter(
                    LocalDate.now().atStartOfDay());
            }
        } catch (Exception ignored) {}

        // Active users in last 7 days
        long activeUsers = 0;
        try {
            activeUsers = userRepository.countByLastPlayedAtAfter(
                LocalDateTime.now().minusDays(7));
        } catch (Exception ignored) {}

        data.put("kpis", Map.of(
            "totalUsers", totalUsers,
            "totalQuestions", totalQuestions,
            "pendingReview", pendingReview,
            "activeSessions", activeSessions,
            "activeUsers", activeUsers
        ));

        // Question queue — only real, backed metric (pendingReview).
        // aiGenerated/communitySubmissions placeholders removed 2026-06-16 (DECISIONS:
        // admin panel trimmed to core). actionItems + recentActivity panels removed too.
        data.put("questionQueue", Map.of(
            "pendingReview", pendingReview
        ));

        // Coverage summary
        try {
            List<String> books = questionRepository.findDistinctActiveBooks();
            long booksWithMin = books.stream().filter(book -> {
                long easy = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.easy);
                long medium = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.medium);
                long hard = questionRepository.countByBookAndDifficultyAndIsActiveTrue(book, Question.Difficulty.hard);
                return easy >= 30 && medium >= 20 && hard >= 10;
            }).count();
            data.put("coverage", Map.of("booksWithMinPool", booksWithMin, "totalBooks", 66));
        } catch (Exception e) {
            data.put("coverage", Map.of("booksWithMinPool", 0, "totalBooks", 66));
        }

        return ResponseEntity.ok(data);
    }
}
