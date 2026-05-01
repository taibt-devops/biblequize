package com.biblequiz.api;

import com.biblequiz.modules.tournament.entity.Tournament;
import com.biblequiz.modules.tournament.service.TournamentMatchService;
import com.biblequiz.modules.tournament.service.TournamentService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/tournaments")
public class TournamentController {

    @Autowired
    private TournamentService tournamentService;

    @Autowired
    private TournamentMatchService tournamentMatchService;

    @Autowired
    private UserRepository userRepository;

    private User getUser(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        String email = null;
        try {
            Object principal = authentication.getPrincipal();
            if (principal instanceof OAuth2User oAuth2User) {
                Object emailAttr = oAuth2User.getAttributes().get("email");
                if (emailAttr != null) {
                    email = emailAttr.toString();
                }
            }
        } catch (Exception ignore) {
        }
        if (email == null) {
            email = authentication.getName();
        }
        return email != null ? userRepository.findByEmail(email).orElse(null) : null;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createTournament(
            @RequestBody Map<String, Object> body,
            Authentication authentication) {

        User user = getUser(authentication);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        String name = body.get("name") != null ? body.get("name").toString() : "Tournament";
        int bracketSize = 8;
        try {
            if (body.get("bracketSize") != null) {
                bracketSize = Integer.parseInt(body.get("bracketSize").toString());
            }
        } catch (NumberFormatException ignore) {
        }

        Map<String, Object> result = tournamentService.createTournament(name, user, bracketSize);
        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/tournaments/upcoming — count + first lobby tournament
     * for the Home mode-card live hint (HM-P1-1). Public read, no
     * auth required so unauthenticated visitors can see "Có giải đấu
     * đang mở" before signing up.
     */
    @GetMapping("/upcoming")
    public ResponseEntity<Map<String, Object>> getUpcoming() {
        return ResponseEntity.ok(tournamentService.getUpcomingTournaments());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTournament(
            @PathVariable("id") String id,
            Authentication authentication) {

        Optional<Tournament> optTournament = tournamentService.findById(id);
        if (optTournament.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Tournament not found"));
        }

        Tournament tournament = optTournament.get();
        Map<String, Object> result = new HashMap<>();
        result.put("tournamentId", tournament.getId());
        result.put("name", tournament.getName());
        result.put("bracketSize", tournament.getBracketSize());
        result.put("status", tournament.getStatus().name());
        result.put("currentRound", tournament.getCurrentRound());
        result.put("totalRounds", tournament.getTotalRounds());
        result.put("creatorId", tournament.getCreator().getId());
        result.put("createdAt", tournament.getCreatedAt());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<Map<String, Object>> joinTournament(
            @PathVariable("id") String id,
            Authentication authentication) {

        User user = getUser(authentication);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Map<String, Object> result = tournamentService.joinTournament(id, user);
        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Map<String, Object>> startTournament(
            @PathVariable("id") String id,
            Authentication authentication) {

        User user = getUser(authentication);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Map<String, Object> result = tournamentService.startTournament(id, user.getId());
        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/bracket")
    public ResponseEntity<Map<String, Object>> getBracket(
            @PathVariable("id") String id,
            Authentication authentication) {

        Map<String, Object> result = tournamentService.getBracket(id);
        if (result.containsKey("error")) {
            return ResponseEntity.status(404).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/matches/{matchId}/forfeit")
    public ResponseEntity<Map<String, Object>> forfeitMatch(
            @PathVariable("id") String tournamentId,
            @PathVariable("matchId") String matchId,
            Authentication authentication) {

        User user = getUser(authentication);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Map<String, Object> result = tournamentService.forfeitMatch(tournamentId, matchId, user.getId());
        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }
}
