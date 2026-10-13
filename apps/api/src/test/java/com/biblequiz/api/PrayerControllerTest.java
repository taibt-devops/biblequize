package com.biblequiz.api;

import com.biblequiz.modules.prayer.entity.PrayerPrayed;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PrayerController.class)
class PrayerControllerTest extends BaseControllerTest {

    private static final String EMAIL = "test@example.com";
    private static final String A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    private static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    private static final String TOK = "AbCdEfGhIjKlMnOpQr_-12";

    @MockBean private PrayerService service;
    @MockBean private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId("user-1");
        user.setEmail(EMAIL);
        user.setName("Minh An");
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }

    @Test
    void allRequireLogin() throws Exception {
        mockMvc.perform(get("/api/prayer/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/prayer/me/items").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[]}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/prayer/me/items/" + A + "/share")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(username = EMAIL)
    void me_returnsAccountItemsPrayedAndShares() throws Exception {
        Item it = new Item(A, "Ba mẹ", null, "ACTIVE", null, T0, null, T0, null);
        when(service.me(eq("user-1"), any())).thenReturn(new PrayerService.Me(List.of(it),
                List.of(new PrayerPrayed("11111111-1111-4111-8111-111111111111", A, "user-1", T0, T0)),
                List.of(new PrayerService.ShareView(TOK, A, T0, "https://doc.forbible.org/cn/" + TOK, 2, T0))));

        mockMvc.perform(get("/api/prayer/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account").value("user-1"))
                .andExpect(jsonPath("$.name").value("Minh An"))
                .andExpect(jsonPath("$.items[0].title").value("Ba mẹ"))
                .andExpect(jsonPath("$.items[0].detail").isEmpty())
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-01T00:00:00.000Z"))
                .andExpect(jsonPath("$.prayed[0].itemId").value(A))
                .andExpect(jsonPath("$.shares[0].count").value(2))
                .andExpect(jsonPath("$.shares[0].url").value("https://doc.forbible.org/cn/" + TOK));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void putItems_parsesAndReturnsMerged_invalidIs400() throws Exception {
        when(service.putItems(eq("user-1"), any(), any())).thenAnswer(i -> i.getArgument(1));
        mockMvc.perform(put("/api/prayer/me/items").contentType(MediaType.APPLICATION_JSON).content("""
                        {"items":[{"id":"%s","title":" Ba mẹ ","status":"ACTIVE",
                          "createdAt":"2026-10-01T00:00:00.000Z","updatedAt":"2026-10-01T00:00:00.000Z"}]}""".formatted(A)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Ba mẹ"));

        mockMvc.perform(put("/api/prayer/me/items").contentType(MediaType.APPLICATION_JSON).content("""
                        {"items":[{"id":"%s","title":"   ","status":"ACTIVE",
                          "createdAt":"2026-10-01T00:00:00.000Z","updatedAt":"2026-10-01T00:00:00.000Z"}]}""".formatted(A)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
        verify(service, times(1)).putItems(any(), any(), any());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void prayed_returnsSavedCount() throws Exception {
        when(service.addPrayed(eq("user-1"), any(), any())).thenReturn(1);
        mockMvc.perform(post("/api/prayer/me/prayed").contentType(MediaType.APPLICATION_JSON).content("""
                        {"entries":[{"id":"11111111-1111-4111-8111-111111111111","itemId":"%s",
                          "prayedAt":"2026-10-13T01:00:00.000Z"}]}""".formatted(A)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(1));
    }

    @Test
    @WithMockUser(username = EMAIL)
    void share_okConflictAndNotFound() throws Exception {
        when(service.share(eq("user-1"), eq(A), any()))
                .thenReturn(new PrayerService.ShareView(TOK, A, T0, "https://doc.forbible.org/cn/" + TOK, 0, null))
                .thenThrow(new IllegalStateException("Tối đa 100 link đang mở"))
                .thenThrow(new NoSuchElementException("Không có điều này"));
        mockMvc.perform(post("/api/prayer/me/items/" + A + "/share"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value(TOK));
        mockMvc.perform(post("/api/prayer/me/items/" + A + "/share"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Tối đa 100 link đang mở"));
        mockMvc.perform(post("/api/prayer/me/items/" + A + "/share")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void revoke_204_or_404() throws Exception {
        mockMvc.perform(delete("/api/prayer/me/shares/" + TOK)).andExpect(status().isNoContent());
        doThrow(new NoSuchElementException()).when(service).revoke(eq("user-1"), eq("ZyXwVuTsRqPoNmLkJiHg_-"), any());
        mockMvc.perform(delete("/api/prayer/me/shares/ZyXwVuTsRqPoNmLkJiHg_-")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = EMAIL)
    void intercessions_json() throws Exception {
        when(service.intercessions("user-1", A)).thenReturn(new PrayerService.Intercessions(1,
                List.of(new PrayerService.Person(null, 3, T0))));
        mockMvc.perform(get("/api/prayer/me/items/" + A + "/intercessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.people[0].name").isEmpty())
                .andExpect(jsonPath("$.people[0].count").value(3))
                .andExpect(jsonPath("$.people[0].lastPrayedAt").value("2026-10-01T00:00:00.000Z"));
    }
}
