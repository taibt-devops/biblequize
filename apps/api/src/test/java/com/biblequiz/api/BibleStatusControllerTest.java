package com.biblequiz.api;

import com.biblequiz.modules.bible.service.BiblePassageService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;

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
                .andExpect(jsonPath("$.version").value("BTT1926"))
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void status_trueOnceTextIsImported() throws Exception {
        when(passageService.isTextAvailable()).thenReturn(true);

        mockMvc.perform(get("/api/public/bible/status"))
                .andExpect(jsonPath("$.available").value(true));
    }
}
