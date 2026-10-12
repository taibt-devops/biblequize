package com.biblequiz.api;

import com.biblequiz.modules.room.service.ChallengeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PCV-23 — trạng thái và hủy lời thách. */
@WebMvcTest(ChallengeController.class)
class ChallengeControllerTest extends BaseControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private ChallengeService challengeService;
    @MockBean private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        User me = new User();
        me.setId("minh");
        me.setEmail("test@example.com");
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(me));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void status_forAParticipant() throws Exception {
        when(challengeService.getChallenge("ch-1", "minh")).thenReturn(Map.of("challengeId", "ch-1", "status", "ACCEPTED", "roomId", "room-9"));

        mockMvc.perform(get("/api/challenges/ch-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.roomId").value("room-9"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void status_forAStranger_is404() throws Exception {
        when(challengeService.getChallenge("ch-1", "minh")).thenThrow(new IllegalArgumentException("Challenge not found"));

        mockMvc.perform(get("/api/challenges/ch-1")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createAndPending_carrySecondsLeft() throws Exception {
        User lan = new User();
        lan.setId("lan");
        lan.setName("Lan");
        User me = userRepository.findByEmail("test@example.com").orElseThrow();
        me.setName("Minh");
        com.biblequiz.modules.room.entity.Challenge c =
                new com.biblequiz.modules.room.entity.Challenge("ch-1", me, lan, java.time.LocalDateTime.now().plusMinutes(5));
        when(challengeService.createChallenge("minh", "lan")).thenReturn(c);
        when(challengeService.getPendingChallenges("minh")).thenReturn(java.util.List.of(
                new com.biblequiz.modules.room.entity.Challenge("ch-2", lan, me, java.time.LocalDateTime.now().plusMinutes(3))));

        mockMvc.perform(post("/api/challenges").with(csrf())
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"challengedUserId\":\"lan\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secondsLeft").value(org.hamcrest.Matchers.greaterThan(290)));
        mockMvc.perform(get("/api/challenges/pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].challengerName").value("Lan"))
                .andExpect(jsonPath("$[0].secondsLeft").value(org.hamcrest.Matchers.greaterThan(170)));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void cancel_byTheChallenger() throws Exception {
        mockMvc.perform(post("/api/challenges/ch-1/cancel").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        verify(challengeService).cancelChallenge("ch-1", "minh");
    }
}
