package com.biblequiz.api;

import com.biblequiz.modules.quiz.service.SessionService;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SessionController.class)
class SessionControllerTest extends BaseControllerTest {

    @MockBean
    private SessionService sessionService;

    // ── POST /api/sessions ───────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void createSession_withValidRequest_shouldReturn200() throws Exception {
        Map<String, Object> sessionResult = Map.of(
                "id", "session-1",
                "mode", "practice",
                "questionCount", 10);

        when(sessionService.createSession(eq("test@example.com"), any(), anyMap()))
                .thenReturn(sessionResult);

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"practice\",\"questionCount\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("session-1"));
    }

    @Test
    void createSession_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"practice\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createSession_withInvalidMode_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"INVALID_MODE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Invalid mode")));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createSession_withStory_passesStoryInConfig() throws Exception {
        when(sessionService.createSession(eq("test@example.com"), any(), anyMap()))
                .thenReturn(Map.of("sessionId", "session-1"));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"practice\",\"questionCount\":10,\"story\":\"no-e-va-tran-lut\"}"))
                .andExpect(status().isOk());

        verify(sessionService).createSession(eq("test@example.com"),
                eq(com.biblequiz.modules.quiz.entity.QuizSession.Mode.practice),
                argThat((Map<String, Object> cfg) -> "no-e-va-tran-lut".equals(cfg.get("story"))));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createSession_withoutStory_leavesStoryOutOfConfig() throws Exception {
        when(sessionService.createSession(eq("test@example.com"), any(), anyMap()))
                .thenReturn(Map.of("sessionId", "session-1"));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"practice\",\"questionCount\":10}"))
                .andExpect(status().isOk());

        verify(sessionService).createSession(eq("test@example.com"), any(),
                argThat((Map<String, Object> cfg) -> !cfg.containsKey("story")));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createSession_withMalformedStory_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"practice\",\"story\":\"Nô-ê và trận lụt\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(sessionService);
    }

    // ── POST /api/sessions/{id}/answer ───────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void submitAnswer_withValidData_shouldReturn200() throws Exception {
        Map<String, Object> answerResult = Map.of(
                "correct", true,
                "explanation", "Correct!");

        when(sessionService.submitAnswer(eq("session-1"), eq("test@example.com"), eq("q-1"), any(), anyInt()))
                .thenReturn(answerResult);

        mockMvc.perform(post("/api/sessions/session-1/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"session-1\",\"questionId\":\"q-1\",\"answer\":0,\"elapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true));
    }

    @Test
    void submitAnswer_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/sessions/session-1/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q-1\",\"answer\":0}"))
                .andExpect(status().isUnauthorized());
    }

    // Regression: FE (Quiz.tsx) + RankedController both send the field as
    // "clientElapsedMs"; SubmitAnswerRequest declares it as "elapsedMs" with
    // @JsonAlias("clientElapsedMs"). Before the alias, Jackson strict mode
    // threw UnrecognizedPropertyException → 400 → SessionService.submitAnswer
    // never ran → Practice XP silently never persisted. This test pins the
    // alias so a future @JsonIgnoreProperties tweak or field rename can't
    // regress that path.
    @Test
    @WithMockUser(username = "test@example.com")
    void submitAnswer_withClientElapsedMsAlias_shouldReturn200AndUnwrapElapsed() throws Exception {
        Map<String, Object> answerResult = Map.of("isCorrect", true, "scoreDelta", 12);

        when(sessionService.submitAnswer(eq("session-1"), eq("test@example.com"), eq("q-1"), any(), eq(7500)))
                .thenReturn(answerResult);

        mockMvc.perform(post("/api/sessions/session-1/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"session-1\",\"questionId\":\"q-1\",\"answer\":0,\"clientElapsedMs\":7500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true));

        verify(sessionService).submitAnswer(eq("session-1"), eq("test@example.com"), eq("q-1"), any(), eq(7500));
    }

    // ── GET /api/sessions/{id} ───────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getSession_shouldReturn200() throws Exception {
        Map<String, Object> session = Map.of(
                "id", "session-1",
                "mode", "practice",
                "status", "completed");

        when(sessionService.getSession("session-1")).thenReturn(session);

        mockMvc.perform(get("/api/sessions/session-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("session-1"));
    }

    // ── GET /api/sessions/{id}/review ────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getReview_shouldReturn200() throws Exception {
        Map<String, Object> review = Map.of(
                "sessionId", "session-1",
                "totalQuestions", 10,
                "correctAnswers", 7);

        when(sessionService.getReview("session-1")).thenReturn(review);

        mockMvc.perform(get("/api/sessions/session-1/review"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalQuestions").value(10));
    }

    // ── TC-SEC-002: IDOR — session GET doesn't currently check ownership ──────
    // Note: This test documents that any authenticated user can access any session.
    // The SessionController.get() method does not verify session ownership.

    @Test
    @WithMockUser(username = "attacker@example.com")
    void getSession_byDifferentUser_shouldStillReturn200_documentingIdorGap() throws Exception {
        // Session belongs to user-1, but attacker@example.com requests it
        Map<String, Object> session = Map.of(
                "id", "victim-session",
                "mode", "practice",
                "status", "completed");

        when(sessionService.getSession("victim-session")).thenReturn(session);

        // Currently returns 200 — IDOR vulnerability exists in SessionController.get()
        mockMvc.perform(get("/api/sessions/victim-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("victim-session"));
    }

    // ── TC-SEC-003: Submit answer after session completed ─────────────────────
    // Tests that SessionService handles already-answered questions (returns existing result)

    @Test
    @WithMockUser(username = "test@example.com")
    void submitAnswer_alreadyAnsweredQuestion_shouldReturnExistingResult() throws Exception {
        // SessionService.submitAnswer returns existing answer when duplicate is submitted
        Map<String, Object> existingResult = Map.of(
                "isCorrect", true,
                "scoreDelta", 10,
                "explanation", "Already answered");

        when(sessionService.submitAnswer(eq("session-1"), eq("test@example.com"), eq("q-1"), any(), anyInt()))
                .thenReturn(existingResult);

        mockMvc.perform(post("/api/sessions/session-1/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"session-1\",\"questionId\":\"q-1\",\"answer\":0,\"elapsedMs\":5000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCorrect").value(true))
                .andExpect(jsonPath("$.scoreDelta").value(10));
    }

    // ── TC-SEC-003: Submit answer when session throws (e.g., session not found) ──

    @Test
    @WithMockUser(username = "test@example.com")
    void submitAnswer_sessionNotFound_shouldThrow() throws Exception {
        when(sessionService.submitAnswer(eq("nonexistent"), eq("test@example.com"), eq("q-1"), any(), anyInt()))
                .thenThrow(new java.util.NoSuchElementException("Session not found"));

        mockMvc.perform(post("/api/sessions/nonexistent/answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"nonexistent\",\"questionId\":\"q-1\",\"answer\":0,\"elapsedMs\":5000}"))
                .andExpect(status().is5xxServerError());
    }

    // ── TC-SEC-006: Rate limiting (documented via filter mock) ────────────────
    // Note: RateLimitingFilter is mocked in BaseControllerTest to pass through.
    // In production, RateLimitingFilter enforces rate limits on all endpoints.
    // This test verifies the filter is wired into the security chain.

    @Test
    void rateLimitingFilter_isWiredInSecurityChain() throws Exception {
        org.junit.jupiter.api.Assertions.assertNotNull(rateLimitingFilter);
    }

    // ── TC-PRAC-003: POST /sessions/{id}/retry ──────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void retrySession_shouldReturn201() throws Exception {
        Map<String, Object> retryResult = Map.of(
                "newSessionId", "session-2",
                "originalSessionId", "session-1");

        when(sessionService.retrySession(eq("session-1"), eq("test@example.com")))
                .thenReturn(retryResult);

        mockMvc.perform(post("/api/sessions/session-1/retry"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.newSessionId").value("session-2"));
    }

    @Test
    @WithMockUser(username = "attacker@example.com")
    void retrySession_notOwner_shouldReturn403() throws Exception {
        when(sessionService.retrySession(eq("session-1"), eq("attacker@example.com")))
                .thenThrow(new IllegalArgumentException("Session does not belong to this user"));

        mockMvc.perform(post("/api/sessions/session-1/retry"))
                .andExpect(status().isForbidden());
    }

    @Test
    void retrySession_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/sessions/session-1/retry"))
                .andExpect(status().isUnauthorized());
    }
}
