package com.biblequiz.api;

import com.biblequiz.api.dto.basicquiz.BasicQuizQuestionResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizResultResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizStatusResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizSubmitRequest;
import com.biblequiz.infrastructure.exception.ResourceNotFoundException;
import com.biblequiz.modules.quiz.service.BasicQuizService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Bible Basics catechism quiz endpoints. All require authentication.
 *
 * <ul>
 *   <li>{@code GET /api/basic-quiz/status} — passed flag, cooldown, attempts</li>
 *   <li>{@code GET /api/basic-quiz/questions?language=vi|en} — 10 shuffled Qs (no answers)</li>
 *   <li>{@code POST /api/basic-quiz/submit} — score 10 answers, return pass/fail + review</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/basic-quiz")
public class BasicQuizController {

    private final BasicQuizService service;
    private final UserRepository userRepository;

    public BasicQuizController(BasicQuizService service, UserRepository userRepository) {
        this.service = service;
        this.userRepository = userRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<BasicQuizStatusResponse> getStatus(Authentication authentication) {
        User user = resolveUser(authentication);
        return ResponseEntity.ok(service.getStatus(user.getId()));
    }

    @GetMapping("/questions")
    public ResponseEntity<List<BasicQuizQuestionResponse>> getQuestions(
            @RequestParam(value = "language", defaultValue = "vi") String language) {
        return ResponseEntity.ok(service.getQuestions(language));
    }

    @PostMapping("/submit")
    public ResponseEntity<BasicQuizResultResponse> submit(
            @Valid @RequestBody BasicQuizSubmitRequest request,
            Authentication authentication) {
        User user = resolveUser(authentication);
        return ResponseEntity.ok(service.submitAttempt(user.getId(), request));
    }

    /**
     * Mirrors the auth-resolution pattern used in {@link RankedController}:
     * extract email from OAuth2 attributes (or fall back to principal name)
     * and look up the User row.
     */
    private User resolveUser(Authentication authentication) {
        if (authentication == null) {
            throw new ResourceNotFoundException("Authentication required");
        }
        String email = null;
        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User oAuth2User) {
            Object emailAttr = oAuth2User.getAttributes().get("email");
            if (emailAttr != null) email = emailAttr.toString();
        }
        if (email == null) email = authentication.getName();
        if (email == null) {
            throw new ResourceNotFoundException("Authentication required");
        }
        final String emailLookup = email;
        return userRepository.findByEmail(emailLookup)
                .orElseGet(() -> userRepository.findById(emailLookup)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found: " + emailLookup)));
    }
}
