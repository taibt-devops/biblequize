package com.biblequiz.api;

import com.biblequiz.modules.bible.service.BiblePassageService;
import com.biblequiz.modules.bible.service.BiblePassageService.Passage;
import com.biblequiz.modules.bible.service.BiblePassageService.VerseText;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BibleController.class)
class BibleControllerTest extends BaseControllerTest {

    @MockBean private BiblePassageService passageService;

    @Test
    @WithMockUser(username = "test@example.com")
    void passage_returns200WithVerses() throws Exception {
        when(passageService.getPassage("John", 3, 16, 17)).thenReturn(Optional.of(
                new Passage("BTT1926", "John", 3, List.of(new VerseText(16, "fixture"), new VerseText(17, "fixture 2")))));

        mockMvc.perform(get("/api/bible/passage").param("book", "John").param("chapter", "3")
                        .param("from", "16").param("to", "17"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("BTT1926"))
                .andExpect(jsonPath("$.verses[0].verse").value(16))
                .andExpect(jsonPath("$.verses[1].text").value("fixture 2"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void passage_notImported_returns404() throws Exception {
        when(passageService.getPassage("John", 3, 16, 16)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/bible/passage").param("book", "John").param("chapter", "3")
                        .param("from", "16").param("to", "16"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void passage_invalidReference_returns400() throws Exception {
        when(passageService.getPassage("Tobit", 1, 1, 1)).thenThrow(new IllegalArgumentException("Sách không hợp lệ"));

        mockMvc.perform(get("/api/bible/passage").param("book", "Tobit").param("chapter", "1")
                        .param("from", "1").param("to", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Sách không hợp lệ"));
    }

    @Test
    void passage_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(get("/api/bible/passage").param("book", "John").param("chapter", "3")
                        .param("from", "16").param("to", "16"))
                .andExpect(status().is4xxClientError());
    }
}
