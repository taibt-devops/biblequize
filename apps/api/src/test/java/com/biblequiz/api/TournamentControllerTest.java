package com.biblequiz.api;

import com.biblequiz.modules.tournament.entity.Tournament;
import com.biblequiz.modules.tournament.service.TournamentMatchService;
import com.biblequiz.modules.tournament.service.TournamentService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TournamentController.class)
class TournamentControllerTest extends BaseControllerTest {

    @MockBean
    private TournamentService tournamentService;

    @MockBean
    private TournamentMatchService tournamentMatchService;

    @MockBean
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test");
        testUser.setEmail("test@example.com");
        testUser.setRole("USER");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
    }

    // ── POST /api/tournaments ────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void createTournament_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("tournamentId", "tourn-1");
        serviceResult.put("name", "My Tournament");
        serviceResult.put("bracketSize", 8);
        serviceResult.put("status", "LOBBY");

        when(tournamentService.createTournament(anyString(), any(User.class), anyInt()))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/tournaments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Tournament\",\"bracketSize\":8}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tournamentId").value("tourn-1"))
                .andExpect(jsonPath("$.name").value("My Tournament"));
    }

    // ── POST /api/tournaments/{id}/join ──────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void joinTournament_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("tournamentId", "tourn-1");
        serviceResult.put("userId", "user-1");
        serviceResult.put("participantCount", 2L);

        when(tournamentService.joinTournament(eq("tourn-1"), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/tournaments/tourn-1/join")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tournamentId").value("tourn-1"));
    }

    // ── POST /api/tournaments/{id}/start ─────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void startTournament_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("tournamentId", "tourn-1");
        serviceResult.put("status", "IN_PROGRESS");
        serviceResult.put("currentRound", 1);

        when(tournamentService.startTournament(eq("tourn-1"), eq("user-1")))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/tournaments/tourn-1/start")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tournamentId").value("tourn-1"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    // ── GET /api/tournaments/{id}/bracket ────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getBracket_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("tournamentId", "tourn-1");
        serviceResult.put("name", "My Tournament");
        serviceResult.put("status", "IN_PROGRESS");
        serviceResult.put("currentRound", 1);

        when(tournamentService.getBracket("tourn-1")).thenReturn(serviceResult);

        mockMvc.perform(get("/api/tournaments/tourn-1/bracket"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tournamentId").value("tourn-1"));
    }

    // ── GET /api/tournaments/upcoming (HM-P1-1 Home live hint) ───────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getUpcoming_emptyLobby_returnsCountZero() throws Exception {
        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("count", 0);
        empty.put("next", null);
        when(tournamentService.getUpcomingTournaments()).thenReturn(empty);

        mockMvc.perform(get("/api/tournaments/upcoming"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.next").doesNotExist());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getUpcoming_withLobbyTournaments_returnsCountAndNext() throws Exception {
        Map<String, Object> nextInfo = new LinkedHashMap<>();
        nextInfo.put("id", "tourn-7");
        nextInfo.put("name", "Spring Cup");
        nextInfo.put("bracketSize", 8);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("count", 3);
        result.put("next", nextInfo);
        when(tournamentService.getUpcomingTournaments()).thenReturn(result);

        mockMvc.perform(get("/api/tournaments/upcoming"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.next.id").value("tourn-7"))
                .andExpect(jsonPath("$.next.name").value("Spring Cup"))
                .andExpect(jsonPath("$.next.bracketSize").value(8));
    }

    // ── POST /api/tournaments/{id}/matches/{matchId}/forfeit ─────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void forfeitMatch_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("matchId", "match-1");
        serviceResult.put("winnerId", "user-2");
        serviceResult.put("forfeitedBy", "user-1");

        when(tournamentService.forfeitMatch(eq("tourn-1"), eq("match-1"), eq("user-1")))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/tournaments/tourn-1/matches/match-1/forfeit")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchId").value("match-1"))
                .andExpect(jsonPath("$.winnerId").value("user-2"));
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    @Test
    void createTournament_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/tournaments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Tournament\",\"bracketSize\":8}"))
                .andExpect(status().isUnauthorized());
    }
}
