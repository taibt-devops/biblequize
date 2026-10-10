package com.biblequiz.api;

import com.biblequiz.modules.quiz.service.QuestionService;
import com.biblequiz.modules.quiz.service.StoryCatalog;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Practice "Theo câu chuyện" lists stories for guests too, so these tests run
 * without @WithMockUser.
 */
@WebMvcTest(PublicStoryController.class)
class PublicStoryControllerTest extends BaseControllerTest {

    @MockBean
    private StoryCatalog storyCatalog;

    @MockBean
    private QuestionService questionService;

    private static final List<StoryCatalog.Story> TWO_STORIES = List.of(
            new StoryCatalog.Story("sang-tao", 1, "Sáng tạo", "Sáng Thế Ký 1–2", "OT", "Creation", "Genesis 1–2"),
            new StoryCatalog.Story("no-e-va-tran-lut", 4, "Nô-ê và trận lụt", "Sáng Thế Ký 6–9", "OT"));

    @Test
    void stories_withoutAuth_listCatalogWithQuestionCounts() throws Exception {
        when(storyCatalog.all()).thenReturn(TWO_STORIES);
        when(questionService.countQuestionsByStory("vi")).thenReturn(Map.of("sang-tao", 10L, "no-e-va-tran-lut", 9L));

        mockMvc.perform(get("/api/public/stories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value("sang-tao"))
                .andExpect(jsonPath("$[0].title").value("Sáng tạo"))
                .andExpect(jsonPath("$[0].ref").value("Sáng Thế Ký 1–2"))
                .andExpect(jsonPath("$[0].testament").value("OT"))
                .andExpect(jsonPath("$[0].questionCount").value(10))
                .andExpect(jsonPath("$[1].id").value("no-e-va-tran-lut"))
                .andExpect(jsonPath("$[1].order").value(4))
                .andExpect(jsonPath("$[1].questionCount").value(9));
    }

    @Test
    void stories_keepStoriesWithoutQuestionsInThatLanguage_atZero() throws Exception {
        when(storyCatalog.all()).thenReturn(TWO_STORIES);
        when(questionService.countQuestionsByStory("en")).thenReturn(Map.of());

        mockMvc.perform(get("/api/public/stories").param("language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].questionCount").value(0))
                .andExpect(jsonPath("$[1].questionCount").value(0));
        verify(questionService).countQuestionsByStory("en");
    }

    @Test
    void stories_inEnglish_useEnglishTitles_andFallBackToVietnamese() throws Exception {
        when(storyCatalog.all()).thenReturn(TWO_STORIES);
        when(questionService.countQuestionsByStory("en")).thenReturn(Map.of("sang-tao", 8L));

        mockMvc.perform(get("/api/public/stories").param("language", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Creation"))
                .andExpect(jsonPath("$[0].ref").value("Genesis 1–2"))
                .andExpect(jsonPath("$[0].questionCount").value(8))
                .andExpect(jsonPath("$[1].title").value("Nô-ê và trận lụt"))
                .andExpect(jsonPath("$[1].ref").value("Sáng Thế Ký 6–9"));
    }
}
