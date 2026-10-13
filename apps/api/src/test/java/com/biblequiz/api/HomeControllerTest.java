package com.biblequiz.api;

import com.biblequiz.modules.home.service.HomeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HomeController.class)
class HomeControllerTest extends BaseControllerTest {

    private static final String EMAIL = "test@example.com";

    @MockBean private HomeService service;
    @MockBean private UserRepository userRepository;
    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId("user-1");
        user.setEmail(EMAIL);
        user.setName("Minh An");
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/home/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(username = EMAIL)
    void me_returnsBadgesContinueAndJournal() throws Exception {
        Map<String, HomeService.Badge> badges = new LinkedHashMap<>();
        badges.put("doc", new HomeService.Badge("done", null));
        badges.put("hoc-thuoc", new HomeService.Badge("count", 3));
        when(service.home(eq(user), any())).thenReturn(new HomeService.Home(
                new HomeService.UserView("Minh An", "MA"), badges,
                new HomeService.Continue("manna", "suggest", "Ghé lò bánh Manna", "Còn thời gian thì ghé lò bánh nhé!", null),
                true, false, new HomeService.Journal(7, 2, null)));

        mockMvc.perform(get("/api/home/me"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.user.displayName").value("Minh An"))
                .andExpect(jsonPath("$.user.initials").value("MA"))
                .andExpect(jsonPath("$.badges.doc.kind").value("done"))
                .andExpect(jsonPath("$.badges.doc.value").doesNotExist())
                .andExpect(jsonPath("$.badges['hoc-thuoc'].kind").value("count"))
                .andExpect(jsonPath("$.badges['hoc-thuoc'].value").value(3))
                .andExpect(jsonPath("$.continue.app").value("manna"))
                .andExpect(jsonPath("$.continue.reason").value("suggest"))
                .andExpect(jsonPath("$.continue.label").value("Ghé lò bánh Manna"))
                .andExpect(jsonPath("$.continue.url").isEmpty())
                .andExpect(jsonPath("$.allDone").value(true))
                .andExpect(jsonPath("$.isNew").value(false))
                .andExpect(jsonPath("$.journal.verses").value(7))
                .andExpect(jsonPath("$.journal.badges").value(2))
                .andExpect(jsonPath("$.journal.recentBadge").isEmpty());
    }
}
