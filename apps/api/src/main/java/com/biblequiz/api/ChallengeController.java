package com.biblequiz.api;

import com.biblequiz.modules.room.entity.Challenge;
import com.biblequiz.modules.room.service.ChallengeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/challenges")
public class ChallengeController {

    private final ChallengeService challengeService;
    private final UserRepository userRepository;

    public ChallengeController(ChallengeService challengeService, UserRepository userRepository) {
        this.challengeService = challengeService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<?> createChallenge(@RequestBody Map<String, String> body, Authentication auth) {
        User me = resolveUser(auth);
        String challengedId = body.get("challengedUserId");
        if (challengedId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "challengedUserId is required"));
        }
        try {
            Challenge challenge = challengeService.createChallenge(me.getId(), challengedId);
            return ResponseEntity.ok(Map.of(
                    "challengeId", challenge.getId(),
                    "status", challenge.getStatus().name(),
                    "expiresAt", challenge.getExpiresAt().toString(),
                    "secondsLeft", challenge.secondsLeft()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable String id, Authentication auth) {
        User me = resolveUser(auth);
        try {
            Map<String, String> result = challengeService.acceptChallenge(id, me.getId());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<?> decline(@PathVariable String id, Authentication auth) {
        User me = resolveUser(auth);
        try {
            challengeService.declineChallenge(id, me.getId());
            return ResponseEntity.ok(Map.of("status", "DECLINED"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** PCV-23: trạng thái lời thách (người thách hỏi mỗi 3 giây trong lúc chờ). */
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id, Authentication auth) {
        User me = resolveUser(auth);
        try {
            return ResponseEntity.ok(challengeService.getChallenge(id, me.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    /** PCV-23: người thách hủy khi chưa được nhận. */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable String id, Authentication auth) {
        User me = resolveUser(auth);
        try {
            challengeService.cancelChallenge(id, me.getId());
            return ResponseEntity.ok(Map.of("status", "CANCELLED"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pending")
    public ResponseEntity<?> getPending(Authentication auth) {
        User me = resolveUser(auth);
        List<Challenge> pending = challengeService.getPendingChallenges(me.getId());
        List<Map<String, Object>> result = pending.stream().map(c -> Map.<String, Object>of(
                "challengeId", c.getId(),
                "challengerName", c.getChallenger().getName(),
                "challengerId", c.getChallenger().getId(),
                "expiresAt", c.getExpiresAt().toString(),
                "secondsLeft", c.secondsLeft()
        )).toList();
        return ResponseEntity.ok(result);
    }

    private User resolveUser(Authentication auth) {
        String email = null;
        if (auth.getPrincipal() instanceof UserDetails ud) {
            email = ud.getUsername();
        } else if (auth.getPrincipal() instanceof OAuth2User oauth2) {
            email = oauth2.getAttribute("email");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
