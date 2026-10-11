package com.biblequiz.api;

import com.biblequiz.modules.reading.service.ReadingProgressService;
import com.biblequiz.modules.reading.service.ReadingProgressService.Progress;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ReadingController.class)
class ReadingControllerTest extends BaseControllerTest {

    private static final String EMAIL = "test@example.com";
    private static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");

    @MockBean private ReadingProgressService service;
    @MockBean private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId("user-1");
        user.setEmail(EMAIL);
        user.setName("Tài");
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    @Test
    void me_requiresLogin() throws Exception {
        mockMvc.perform(get("/api/reading/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/reading/me").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void get_noProgressYet_returnsNull() throws Exception {
        when(service.get("user-1")).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/reading/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account").value("user-1"))
                .andExpect(jsonPath("$.name").value("Tài"))
                .andExpect(jsonPath("$.progress").isEmpty());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void get_returnsProgressWithBrowserStyleTimes() throws Exception {
        when(service.get("user-1")).thenReturn(Optional.of(new Progress("1-nam", 12, 0, T0, null, T0)));
        mockMvc.perform(get("/api/reading/me"))
                .andExpect(jsonPath("$.progress.plan").value("1-nam"))
                .andExpect(jsonPath("$.progress.next").value(12))
                .andExpect(jsonPath("$.progress.startedAt").value("2026-10-01T00:00:00.000Z"))
                .andExpect(jsonPath("$.progress.lastReadAt").isEmpty());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void put_savesForTheCallerOnly() throws Exception {
        when(service.put(eq("user-1"), any(), any())).thenAnswer(i -> i.getArgument(1));
        mockMvc.perform(put("/api/reading/me").contentType(MediaType.APPLICATION_JSON).content("""
                        {"plan":"2-nam","next":5,"lap":1,"startedAt":"2026-10-01T00:00:00.000Z",
                         "lastReadAt":"2026-10-10T22:00:00.123Z","updatedAt":"2026-10-10T22:00:00.123Z"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress.next").value(5))
                .andExpect(jsonPath("$.progress.lap").value(1))
                .andExpect(jsonPath("$.progress.lastReadAt").value("2026-10-10T22:00:00.123Z"));
        verify(service).put(eq("user-1"), any(), any());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void put_invalid_is400() throws Exception {
        when(service.put(eq("user-1"), any(), any())).thenThrow(new IllegalArgumentException("Phần ngoài phạm vi: 999"));
        mockMvc.perform(put("/api/reading/me").contentType(MediaType.APPLICATION_JSON).content("""
                        {"plan":"1-nam","next":999,"startedAt":"2026-10-01T00:00:00.000Z","updatedAt":"2026-10-01T00:00:00.000Z"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Phần ngoài phạm vi: 999"));
        mockMvc.perform(put("/api/reading/me").contentType(MediaType.APPLICATION_JSON).content("{\"plan\":\"1-nam\"}"))
                .andExpect(status().isBadRequest());
    }
}
