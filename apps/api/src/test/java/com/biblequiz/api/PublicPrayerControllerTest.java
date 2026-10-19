package com.biblequiz.api;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PublicPrayerService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasKey;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PublicPrayerController.class)
class PublicPrayerControllerTest extends BaseControllerTest {

    private static final String TOK = "AbCdEfGhIjKlMnOpQr_-12";
    private static final String V1 = "11111111-1111-4111-8111-111111111111";

    @MockBean private PublicPrayerService service;

    @Test
    void view_openLink_noStore() throws Exception {
        when(service.view(TOK)).thenReturn(new PublicPrayerService.View("Minh An", "Ba mẹ", null, "ACTIVE", 4));
        mockMvc.perform(get("/api/public/prayer/shares/" + TOK))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.ownerName").value("Minh An"))
                .andExpect(jsonPath("$.detail").isEmpty())
                .andExpect(jsonPath("$.count").value(4));
    }

    @Test
    void view_goneAndMalformed_sameNotFound() throws Exception {
        when(service.view(TOK)).thenThrow(new NoSuchElementException());
        mockMvc.perform(get("/api/public/prayer/shares/" + TOK))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không có lời nhờ này"));
        mockMvc.perform(get("/api/public/prayer/shares/khong-hop-le"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không có lời nhờ này"));
        verify(service, times(1)).view(any());
    }

    @Test
    void pray_passesCleanName_returnsCount() throws Exception {
        when(service.pray(eq(TOK), eq(V1), eq("Hạnh"), isNull(), any())).thenReturn(5L);
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\",\"name\":\"  Hạ\\u200Bnh \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(5));
    }

    @Test
    void pray_errors_mapTo400_404_409() throws Exception {
        String longName = "a".repeat(61);
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\",\"name\":\"" + longName + "\"}"))
                .andExpect(status().isBadRequest());
        verify(service, never()).pray(any(), any(), any(), any(), any());

        when(service.pray(eq(TOK), eq(V1), any(), any(), any()))
                .thenThrow(new IllegalStateException("Điều này đã được đáp lời"))
                .thenThrow(new NoSuchElementException());
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/public/prayer/shares/ngan/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\"}"))
                .andExpect(status().isNotFound());
    }

    // ---- Bản 2 (V80) ----

    @Test
    void publicView_hasV2Fields_testimonyNullWhenHidden() throws Exception {
        when(service.view(TOK)).thenReturn(new PublicPrayerService.View("Minh An", "Ba mẹ", null, "ACTIVE", 4, "FAMILY",
                List.of(new PrayerInput.Update("22222222-2222-4222-8222-222222222222", "Ba mổ xong",
                        Instant.parse("2026-10-18T01:00:00Z"))), null, null));
        mockMvc.perform(get("/api/public/prayer/shares/" + TOK))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topic").value("FAMILY"))
                .andExpect(jsonPath("$.updates[0].text").value("Ba mổ xong"))
                .andExpect(jsonPath("$.updates[0].at").value("2026-10-18T01:00:00.000Z"))
                .andExpect(jsonPath("$.updates[0].id").doesNotExist())
                .andExpect(jsonPath("$", hasKey("testimony")))
                .andExpect(jsonPath("$.testimony").isEmpty())
                .andExpect(jsonPath("$", hasKey("answeredAt")));
    }

    @Test
    void publicView_answeredSharedTestimony() throws Exception {
        when(service.view(TOK)).thenReturn(new PublicPrayerService.View("Minh An", "Ba mẹ", null, "ANSWERED", 4, null,
                List.of(), Instant.parse("2026-10-19T01:00:00Z"), "Ba khỏe rồi"));
        mockMvc.perform(get("/api/public/prayer/shares/" + TOK))
                .andExpect(jsonPath("$.status").value("ANSWERED"))
                .andExpect(jsonPath("$.answeredAt").value("2026-10-19T01:00:00.000Z"))
                .andExpect(jsonPath("$.testimony").value("Ba khỏe rồi"));
    }

    @Test
    void publicPrayed_passesMessage() throws Exception {
        when(service.pray(eq(TOK), eq(V1), isNull(), eq("Em cầu nguyện cho bác"), any())).thenReturn(3L);
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\",\"message\":\" Em\\ncầu nguyện cho bác \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3));
    }

    @Test
    void publicPrayed_messageTooLong_400() throws Exception {
        mockMvc.perform(post("/api/public/prayer/shares/" + TOK + "/prayed").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorId\":\"" + V1 + "\",\"message\":\"" + "a".repeat(301) + "\"}"))
                .andExpect(status().isBadRequest());
        verify(service, never()).pray(any(), any(), any(), any(), any());
    }
}
