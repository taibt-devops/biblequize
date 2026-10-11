package com.biblequiz.api;

import com.biblequiz.modules.bible.service.BiblePassageService;
import com.biblequiz.modules.bible.service.BiblePassageService.ChapterText;
import com.biblequiz.modules.bible.service.BiblePassageService.RangeText;
import com.biblequiz.modules.bible.service.BiblePassageService.VerseText;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BibleStatusController.class)
class BibleStatusControllerTest extends BaseControllerTest {

    @MockBean private BiblePassageService passageService;

    @Test
    void status_isPublicAndReportsAvailability() throws Exception {
        when(passageService.isTextAvailable()).thenReturn(false);

        mockMvc.perform(get("/api/public/bible/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("RVV11"))
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void status_trueOnceTextIsImported() throws Exception {
        when(passageService.isTextAvailable()).thenReturn(true);

        mockMvc.perform(get("/api/public/bible/status"))
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void range_isPublic_returnsChapters_andCachesForADay() throws Exception {
        when(passageService.getRange("Esther", 5, 1, 6, 2)).thenReturn(new RangeText("RVV11", "Esther", List.of(
                new ChapterText(5, List.of(new VerseText(1, null, "a"))),
                new ChapterText(6, List.of(new VerseText(1, 2, "b"))))));

        mockMvc.perform(get("/api/public/bible/range").param("book", "Esther").param("from", "5:1").param("to", "6:2"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=86400, public"))
                .andExpect(jsonPath("$.book").value("Esther"))
                .andExpect(jsonPath("$.chapters[0].chapter").value(5))
                .andExpect(jsonPath("$.chapters[1].verses[0].verseEnd").value(2))
                .andExpect(jsonPath("$.chapters[1].verses[0].text").value("b"));
    }

    @Test
    void range_badRef_is400() throws Exception {
        mockMvc.perform(get("/api/public/bible/range").param("book", "Esther").param("from", "5").param("to", "6:2"))
                .andExpect(status().isBadRequest());
        when(passageService.getRange(anyString(), anyInt(), anyInt(), anyInt(), anyInt()))
                .thenThrow(new IllegalArgumentException("Đoạn quá dài"));
        mockMvc.perform(get("/api/public/bible/range").param("book", "Esther").param("from", "1:1").param("to", "9:1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Đoạn quá dài"));
    }

    @Test
    void range_noText_is404() throws Exception {
        when(passageService.getRange("Esther", 5, 1, 5, 2)).thenReturn(new RangeText("RVV11", "Esther", List.of()));
        mockMvc.perform(get("/api/public/bible/range").param("book", "Esther").param("from", "5:1").param("to", "5:2"))
                .andExpect(status().isNotFound());
    }
}
