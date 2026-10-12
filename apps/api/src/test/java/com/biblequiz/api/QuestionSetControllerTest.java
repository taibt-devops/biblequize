package com.biblequiz.api;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.userquiz.service.QuestionSetService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** AIR-2 (13/10/2026): Bộ câu của tôi không còn AI tạo nháp / AI viết lại — các đường AI cũ đã gỡ. */
@WebMvcTest(QuestionSetController.class)
class QuestionSetControllerTest extends BaseControllerTest {

    @MockBean private QuestionSetService service;
    @MockBean private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        User testUser = new User();
        testUser.setId("user-1");
        testUser.setEmail("test@example.com");
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void aiGenerate_isGone() throws Exception {
        mockMvc.perform(post("/api/question-sets/set-1/ai-generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"countEasy\":1,\"countMedium\":0,\"countHard\":0,\"book\":\"Sáng Thế Ký\",\"chapterFrom\":1}"))
                .andExpect(status().isNotFound());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void aiRewrite_isGone() throws Exception {
        mockMvc.perform(post("/api/question-sets/set-1/questions/q-1/ai-rewrite")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hint\":\"\"}"))
                .andExpect(status().isNotFound());
        verifyNoInteractions(service);
    }
}
