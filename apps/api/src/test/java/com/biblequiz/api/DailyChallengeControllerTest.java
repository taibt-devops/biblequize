package com.biblequiz.api;

import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.quiz.entity.Question;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.Arrays;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DailyChallengeController.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DailyChallengeControllerTest extends BaseControllerTest {

    @MockBean
    private DailyChallengeService dailyChallengeService;

    private List<Question> sampleQuestions;

    @BeforeEach
    void setUp() {
        Question q1 = new Question();
        q1.setId("q-1");
        q1.setBook("Genesis");
        q1.setContent("Question 1?");
        q1.setOptions(Arrays.asList("A", "B", "C", "D"));
        q1.setCorrectAnswer(Arrays.asList(0));
        q1.setDifficulty(Question.Difficulty.easy);
        q1.setType(Question.Type.multiple_choice_single);

        Question q2 = new Question();
        q2.setId("q-2");
        q2.setBook("Exodus");
        q2.setContent("Question 2?");
        q2.setOptions(Arrays.asList("A", "B", "C", "D"));
        q2.setCorrectAnswer(Arrays.asList(1));
        q2.setDifficulty(Question.Difficulty.medium);
        q2.setType(Question.Type.multiple_choice_single);

        sampleQuestions = List.of(q1, q2);
    }

    // ── GET /api/daily-challenge ─────────────────────────────────────────────

    @Test
    @Order(1)
    void getDailyChallenge_public_shouldReturn200() throws Exception {
        when(dailyChallengeService.getTodayQuestions(any())).thenReturn(sampleQuestions);
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(get("/api/daily-challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").isNotEmpty())
                .andExpect(jsonPath("$.questions", hasSize(2)))
                .andExpect(jsonPath("$.questions[0].content").value("Question 1?"))
                .andExpect(jsonPath("$.questions[0].correctAnswer").doesNotExist()) // stripped
                .andExpect(jsonPath("$.totalQuestions").value(5))
                .andExpect(jsonPath("$.alreadyCompleted").value(false));
    }

    @Test
    @Order(2)
    @WithMockUser(username = "test@example.com")
    void getDailyChallenge_authenticated_shouldCheckCompletion() throws Exception {
        when(dailyChallengeService.getTodayQuestions(any())).thenReturn(sampleQuestions);
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);
        when(dailyChallengeService.hasCompletedToday("test@example.com")).thenReturn(true);

        mockMvc.perform(get("/api/daily-challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alreadyCompleted").value(true));
    }

    @Test
    @Order(3)
    void getDailyChallenge_noQuestions_shouldReturnEmptyList() throws Exception {
        when(dailyChallengeService.getTodayQuestions(any())).thenReturn(List.of());
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(get("/api/daily-challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions", hasSize(0)));
    }

    // ── POST /api/daily-challenge/start ──────────────────────────────────────

    @Test
    @Order(4)
    @WithMockUser(username = "test@example.com")
    void startChallenge_shouldReturnSessionId() throws Exception {
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(post("/api/daily-challenge/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.totalQuestions").value(5));
    }

    // ── GET /api/daily-challenge/result ───────────────────────────────────────

    @Test
    @Order(5)
    @WithMockUser(username = "test@example.com")
    void getResult_completed_shouldReturnEnrichedPayload() throws Exception {
        // Controller now delegates to DailyChallengeService.getResultData
        // which augments the cached score with xpEarned + nextResetAt so
        // FeaturedDailyChallenge can render the celebratory banner.
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("completed", true);
        payload.put("date", "2026-04-29");
        payload.put("score", 80);
        payload.put("correctCount", 4);
        payload.put("totalQuestions", 5);
        payload.put("xpEarned", 50);
        payload.put("nextResetAt", "2026-04-30T00:00:00Z");
        when(dailyChallengeService.getResultData("test@example.com")).thenReturn(payload);

        mockMvc.perform(get("/api/daily-challenge/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.correctCount").value(4))
                .andExpect(jsonPath("$.totalQuestions").value(5))
                .andExpect(jsonPath("$.xpEarned").value(50))
                .andExpect(jsonPath("$.nextResetAt").value("2026-04-30T00:00:00Z"));
    }

    @Test
    @Order(6)
    @WithMockUser(username = "test@example.com")
    void getResult_notCompleted_shouldReturnFalse() throws Exception {
        when(dailyChallengeService.getResultData("test@example.com"))
                .thenReturn(java.util.Map.of("completed", false));

        mockMvc.perform(get("/api/daily-challenge/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false));
    }

    @Test
    @Order(7)
    void getResult_unauthenticated_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/daily-challenge/result"))
                .andExpect(status().isUnauthorized());
    }

    // ── TC-DAILY-002: GET /api/daily-challenge without auth (guest access) ───

    @Test
    @Order(8)
    void TC_DAILY_002_getDailyChallenge_guestAccess_shouldReturn200WithQuestions() throws Exception {
        when(dailyChallengeService.getTodayQuestions(any())).thenReturn(sampleQuestions);
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(get("/api/daily-challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions", hasSize(2)))
                .andExpect(jsonPath("$.questions[0].id").value("q-1"))
                .andExpect(jsonPath("$.questions[1].id").value("q-2"))
                .andExpect(jsonPath("$.alreadyCompleted").value(false))
                .andExpect(jsonPath("$.totalQuestions").value(5));
    }

    // ── TC-DAILY-004: POST /api/daily-challenge/start ────────────────────────

    @Test
    @Order(9)
    @WithMockUser(username = "test@example.com")
    void TC_DAILY_004_startChallenge_shouldReturnSessionWithDatePrefix() throws Exception {
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(post("/api/daily-challenge/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.date").isNotEmpty())
                .andExpect(jsonPath("$.totalQuestions").value(5));
    }

    // ── POST /api/daily-challenge/complete ───────────────────────────────────

    @Test
    @Order(10)
    @WithMockUser(username = "test@example.com")
    void complete_firstTime_shouldCallMarkCompleted() throws Exception {
        when(dailyChallengeService.hasCompletedToday("test@example.com")).thenReturn(false);
        when(dailyChallengeService.getDailyQuestionCount()).thenReturn(5);

        mockMvc.perform(post("/api/daily-challenge/complete")
                        .contentType("application/json")
                        .content("{\"score\": 85, \"correctCount\": 4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.alreadyCompleted").value(false))
                .andExpect(jsonPath("$.score").value(85))
                .andExpect(jsonPath("$.correct").value(4))
                .andExpect(jsonPath("$.total").value(5));

        verify(dailyChallengeService).markCompleted(eq("test@example.com"), eq(85), eq(4));
    }

    @Test
    @Order(11)
    @WithMockUser(username = "test@example.com")
    void complete_idempotent_secondCallSkipsMarkCompleted() throws Exception {
        when(dailyChallengeService.hasCompletedToday("test@example.com")).thenReturn(true);

        mockMvc.perform(post("/api/daily-challenge/complete")
                        .contentType("application/json")
                        .content("{\"score\": 50, \"correctCount\": 3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true))
                .andExpect(jsonPath("$.alreadyCompleted").value(true));

        verify(dailyChallengeService, never()).markCompleted(anyString(), anyInt(), anyInt());
    }

    @Test
    @Order(12)
    void complete_unauthenticated_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/daily-challenge/complete")
                        .contentType("application/json")
                        .content("{\"score\": 50, \"correctCount\": 3}"))
                .andExpect(status().isUnauthorized());

        verify(dailyChallengeService, never()).markCompleted(anyString(), anyInt(), anyInt());
    }

    @Test
    @Order(13)
    @WithMockUser(username = "test@example.com")
    void complete_correctCountAbove5_shouldReturn400() throws Exception {
        // correctCount max = 5 (matches DAILY_QUESTION_COUNT)
        mockMvc.perform(post("/api/daily-challenge/complete")
                        .contentType("application/json")
                        .content("{\"score\": 100, \"correctCount\": 10}"))
                .andExpect(status().isBadRequest());

        verify(dailyChallengeService, never()).markCompleted(anyString(), anyInt(), anyInt());
    }

    @Test
    @Order(14)
    @WithMockUser(username = "test@example.com")
    void complete_missingScore_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/daily-challenge/complete")
                        .contentType("application/json")
                        .content("{\"correctCount\": 5}"))
                .andExpect(status().isBadRequest());

        verify(dailyChallengeService, never()).markCompleted(anyString(), anyInt(), anyInt());
    }
}
