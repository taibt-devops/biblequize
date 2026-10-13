package com.biblequiz.api;

import com.biblequiz.modules.quiz.repository.QuizSessionRepository;
import com.biblequiz.modules.share.service.ShareCardService;
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

@WebMvcTest(ShareCardController.class)
@org.springframework.test.context.TestPropertySource(properties = "app.frontend-url=https://quiz.forbible.org/")
class ShareCardControllerTest extends BaseControllerTest {

    @MockBean
    private ShareCardService shareCardService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private QuizSessionRepository quizSessionRepository;

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

    // ── /api/share/og/* theo tên miền của Bible Quiz (APP_FRONTEND_URL) ─────────

    @Test
    @WithMockUser
    void ogDaily_person_isRedirectedToQuizSite() throws Exception {
        mockMvc.perform(get("/api/share/og/daily").header("User-Agent", "Mozilla/5.0"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://quiz.forbible.org/daily"));
    }

    @Test
    @WithMockUser
    void ogSession_bot_writesQuizSiteInMeta() throws Exception {
        when(quizSessionRepository.findById("s-1")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/share/og/session/s-1").header("User-Agent", "facebookexternalhit/1.1"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("https://quiz.forbible.org/share/session/s-1")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("https://quiz.forbible.org/og-image.png")))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("https://forbible.org/"))));
    }

    // ── GET /api/share/session/{sessionId} ───────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getSessionCard_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("id", "card-1");
        serviceResult.put("type", "SESSION");
        serviceResult.put("referenceId", "session-1");
        serviceResult.put("imageUrl", "/api/share/images/session/session-1");
        serviceResult.put("viewCount", 0);

        when(shareCardService.getOrCreateSessionCard(eq("session-1"), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(get("/api/share/session/session-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("card-1"))
                .andExpect(jsonPath("$.type").value("SESSION"))
                .andExpect(jsonPath("$.referenceId").value("session-1"));
    }

    // ── GET /api/share/tier-up/{tierId} ──────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getTierUpCard_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("id", "card-tier");
        serviceResult.put("type", "TIER_UP");
        serviceResult.put("referenceId", "tier-gold");
        serviceResult.put("imageUrl", "/api/share/images/tier-up/tier-gold");
        serviceResult.put("viewCount", 0);

        when(shareCardService.getOrCreateTierUpCard(eq("tier-gold"), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(get("/api/share/tier-up/tier-gold"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("card-tier"))
                .andExpect(jsonPath("$.type").value("TIER_UP"));
    }

    // ── POST /api/share/{id}/view ───────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void trackView_shouldReturn204() throws Exception {
        doNothing().when(shareCardService).incrementViewCount("card-1");

        mockMvc.perform(post("/api/share/card-1/view")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(shareCardService).incrementViewCount("card-1");
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    @Test
    void getSessionCard_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/share/session/session-1"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/share/render/session/{id} — public HTML render ───────────

    @Test
    @WithMockUser(username = "test@example.com")
    void renderSessionCard_shouldReturn200WithHtml() throws Exception {
        when(shareCardService.renderSessionHtml(anyString(), anyInt(), anyInt(), anyInt(), anyString()))
                .thenReturn("<html><body>Share Card</body></html>");

        mockMvc.perform(get("/api/share/render/session/session-1"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/html"));
    }
}
