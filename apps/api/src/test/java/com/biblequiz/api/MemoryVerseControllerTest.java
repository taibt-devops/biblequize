package com.biblequiz.api;

import com.biblequiz.modules.memorize.service.MemoryVerseException;
import com.biblequiz.modules.memorize.service.MemoryVerseException.Kind;
import com.biblequiz.modules.memorize.service.MemoryVerseService;
import com.biblequiz.modules.memorize.service.MemoryVerseService.Item;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MemoryVerseController.class)
class MemoryVerseControllerTest extends BaseControllerTest {

    private static final String EMAIL = "test@example.com";

    @MockBean private MemoryVerseService service;
    @MockBean private UserRepository userRepository;

    private User user;
    private final Item item = new Item("v-1", "John", 3, 16, 16, "fixture", 0,
            LocalDateTime.of(2026, 9, 15, 8, 0), true);

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId("user-1");
        user.setEmail(EMAIL);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void list_returnsItemsAndDueCount() throws Exception {
        when(service.list(eq("user-1"), any())).thenReturn(List.of(item));
        when(service.dueCount(eq("user-1"), any())).thenReturn(1L);

        mockMvc.perform(get("/api/me/memory-verses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("v-1"))
                .andExpect(jsonPath("$.items[0].verseStart").value(16))
                .andExpect(jsonPath("$.items[0].due").value(true))
                .andExpect(jsonPath("$.dueCount").value(1));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void dueAndDueCount_areUserScoped() throws Exception {
        when(service.due(eq("user-1"), any())).thenReturn(List.of(item));
        when(service.dueCount(eq("user-1"), any())).thenReturn(3L);

        mockMvc.perform(get("/api/me/memory-verses/due")).andExpect(jsonPath("$.items[0].text").value("fixture"));
        mockMvc.perform(get("/api/me/memory-verses/due-count")).andExpect(jsonPath("$.dueCount").value(3));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void add_returns201() throws Exception {
        when(service.add(eq(user), eq("John"), eq(3), eq(16), eq(16), any())).thenReturn(item);

        mockMvc.perform(post("/api/me/memory-verses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"book\":\"John\",\"chapter\":3,\"verseStart\":16,\"verseEnd\":16}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("v-1"));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void add_mapsBusinessErrors() throws Exception {
        String body = "{\"book\":\"John\",\"chapter\":3,\"verseStart\":16,\"verseEnd\":16}";
        when(service.add(any(), any(), anyInt(), anyInt(), anyInt(), any()))
                .thenThrow(new MemoryVerseException(Kind.DUPLICATE, "Đoạn này đã có trong danh sách"))
                .thenThrow(new MemoryVerseException(Kind.INVALID, "Tối đa 5 câu liền nhau"));

        mockMvc.perform(post("/api/me/memory-verses").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
        mockMvc.perform(post("/api/me/memory-verses").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Tối đa 5 câu liền nhau"));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void add_missingFields_returns400WithoutCallingService() throws Exception {
        mockMvc.perform(post("/api/me/memory-verses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"book\":\"John\",\"chapter\":\"3\"}"))
                .andExpect(status().isBadRequest());
        verify(service, never()).add(any(), any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void delete_returns204_or404WhenNotOwned() throws Exception {
        mockMvc.perform(delete("/api/me/memory-verses/v-1")).andExpect(status().isNoContent());

        doThrow(new MemoryVerseException(Kind.NOT_FOUND, "Không tìm thấy")).when(service).delete("user-1", "v-2");
        mockMvc.perform(delete("/api/me/memory-verses/v-2")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void review_passesResultToService() throws Exception {
        when(service.review(eq("user-1"), eq("v-1"), eq(true), any())).thenReturn(item);

        mockMvc.perform(post("/api/me/memory-verses/v-1/review").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"exerciseType\":\"cloze\",\"passed\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.masteryLevel").value(0));

        mockMvc.perform(post("/api/me/memory-verses/v-1/review").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"exerciseType\":\"cloze\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unauthenticated_isRejected() throws Exception {
        mockMvc.perform(get("/api/me/memory-verses")).andExpect(status().is4xxClientError());
        verifyNoInteractions(service);
    }
}
