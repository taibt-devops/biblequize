package com.biblequiz.api;

import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** AIR-4 (13/10/2026): bỏ sinh câu bằng AI — tổng quan quản trị không còn KPI "AI hôm nay". */
@WebMvcTest(AdminDashboardController.class)
class AdminDashboardControllerTest extends BaseControllerTest {

    @MockBean private UserRepository userRepository;
    @MockBean private QuestionRepository questionRepository;

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void kpis_haveNoAiQuota() throws Exception {
        when(userRepository.count()).thenReturn(12L);
        when(questionRepository.countByIsActiveTrue()).thenReturn(340L);
        when(questionRepository.findDistinctActiveBooks()).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis.totalUsers").value(12))
                .andExpect(jsonPath("$.kpis.aiQuotaUsed").doesNotExist())
                .andExpect(jsonPath("$.kpis.aiQuotaLimit").doesNotExist());
    }
}
