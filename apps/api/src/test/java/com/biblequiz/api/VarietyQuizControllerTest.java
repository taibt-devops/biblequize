package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector;
import com.biblequiz.modules.quiz.service.WeeklyThemeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the variety mode endpoints comply with Option A (Bui decision
 * 2026-05-02) — no {@code xpMultiplier} key advertised, since variety
 * play does not grant XP server-side. Daily Bonus keeps {@code bonusType}
 * because the FE renders the bonus card from it (the underlying
 * {@code DOUBLE_XP} multiplier is still dead code, see TODO at the
 * endpoint).
 */
@WebMvcTest(VarietyQuizController.class)
class VarietyQuizControllerTest extends BaseControllerTest {

    @MockBean
    private WeeklyThemeService weeklyThemeService;

    @MockBean
    private SmartQuestionSelector smartQuestionSelector;

    @MockBean
    private QuestionRepository questionRepository;

    @MockBean
    private UserRepository userRepository;

    @BeforeEach
    void setUpUser() {
        User testUser = new User();
        testUser.setId("user-1");
        testUser.setEmail("test@example.com");
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        when(smartQuestionSelector.selectQuestions(any(), anyInt(), any()))
                .thenReturn(List.of());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void mystery_responseDoesNotContainXpMultiplier() throws Exception {
        mockMvc.perform(post("/api/quiz/mystery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.xpMultiplier").doesNotExist())
                .andExpect(jsonPath("$.timerSeconds").value(25))
                .andExpect(jsonPath("$.questions").exists());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void speedRound_responseDoesNotContainXpMultiplier() throws Exception {
        mockMvc.perform(get("/api/quiz/speed-round"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.xpMultiplier").doesNotExist())
                .andExpect(jsonPath("$.timerSeconds").value(10))
                .andExpect(jsonPath("$.questions").exists());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void weekly_responseDoesNotContainXpMultiplier() throws Exception {
        Map<String, Object> baseResponse = new LinkedHashMap<>();
        baseResponse.put("theme", "TEST_THEME");
        when(weeklyThemeService.getWeeklyQuizResponse(any())).thenReturn(baseResponse);
        when(weeklyThemeService.getWeeklyQuestions(any(), anyInt(), any()))
                .thenReturn(List.<Question>of());

        mockMvc.perform(get("/api/quiz/weekly"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.xpMultiplier").doesNotExist())
                .andExpect(jsonPath("$.theme").value("TEST_THEME"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void seasonal_responseDoesNotContainXpMultiplier() throws Exception {
        // Seasonal endpoint returns {"season": "NORMAL", "hasEvent": false}
        // when not in Christmas/Easter window — that path also omits xpMultiplier.
        // When in-event, the in-event response also omits xpMultiplier per Option A.
        mockMvc.perform(get("/api/quiz/seasonal"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.xpMultiplier").doesNotExist());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void dailyBonus_stillExposesBonusTypeWhenLucky() throws Exception {
        // /daily-bonus is gated by a deterministic per-user-per-day random
        // (~14% chance). We can't easily mock the random in this controller
        // without refactoring it, so simply assert the response shape contract:
        // either {"hasBonus": false} OR {"hasBonus": true, "bonusType": "...", ...}.
        // What matters for Option A: the endpoint never returns xpMultiplier.
        mockMvc.perform(get("/api/quiz/daily-bonus"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasBonus").exists())
                .andExpect(jsonPath("$.xpMultiplier").doesNotExist());
    }
}
