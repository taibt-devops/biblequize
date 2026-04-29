package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.service.DuplicateDetectionService;
import com.biblequiz.modules.quiz.service.DuplicateDetectionService.DuplicateCheckResult;
import com.biblequiz.modules.quiz.service.DuplicateDetectionService.DuplicateStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminQuestionController.class)
class AdminQuestionControllerTest extends BaseControllerTest {

    @MockBean
    private QuestionRepository questionRepository;

    /**
     * AdminQuestionController autowires DuplicateDetectionService since
     * commit 3ed0b0a (3-layer dup detection). The slice test had been
     * missing this bean, which collapsed the application context and
     * cascaded into 50+ phantom errors across other controller tests
     * sharing the cached context. Mocking it here is the smallest fix.
     */
    @MockBean
    private DuplicateDetectionService duplicateDetectionService;

    private Question sampleQuestion;

    @BeforeEach
    void setUp() {
        sampleQuestion = new Question();
        sampleQuestion.setId("q-1");
        sampleQuestion.setBook("Genesis");
        sampleQuestion.setChapter(1);
        sampleQuestion.setDifficulty(Question.Difficulty.easy);
        sampleQuestion.setType(Question.Type.multiple_choice_single);
        sampleQuestion.setContent("Test question?");
        sampleQuestion.setOptions(Arrays.asList("A", "B", "C", "D"));
        sampleQuestion.setCorrectAnswer(Arrays.asList(0));
        sampleQuestion.setIsActive(true);

        // Default: dup detector finds nothing — most tests don't care.
        when(duplicateDetectionService.checkDuplicate(any()))
                .thenReturn(new DuplicateCheckResult(
                        DuplicateStatus.NO_MATCH, false, null, java.util.List.of()));
    }

    // ── GET /api/admin/questions/ping ────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void ping_asAdmin_shouldReturn200() throws Exception {
        mockMvc.perform(get("/api/admin/questions/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void ping_asUser_shouldReturn403() throws Exception {
        mockMvc.perform(get("/api/admin/questions/ping"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ping_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/admin/questions/ping"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/admin/questions ─────────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void listQuestions_shouldReturn200() throws Exception {
        when(questionRepository.findWithAdminFilters(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(sampleQuestion)));

        mockMvc.perform(get("/api/admin/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions").isArray())
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void listQuestions_withFilters_shouldReturn200() throws Exception {
        when(questionRepository.findWithAdminFilters(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/admin/questions")
                        .param("book", "Genesis")
                        .param("difficulty", "easy")
                        .param("search", "creation"))
                .andExpect(status().isOk());
    }

    // ── POST /api/admin/questions ────────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void createQuestion_shouldReturn200() throws Exception {
        when(questionRepository.save(any(Question.class))).thenReturn(sampleQuestion);

        mockMvc.perform(post("/api/admin/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"book\":\"Genesis\",\"chapter\":1,\"difficulty\":\"easy\",\"type\":\"multiple_choice_single\",\"content\":\"Test?\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":[0]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.book").value("Genesis"));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void createQuestion_asPending_shouldSetReviewStatus() throws Exception {
        when(questionRepository.save(any(Question.class))).thenAnswer(inv -> {
            Question q = inv.getArgument(0);
            return q;
        });

        mockMvc.perform(post("/api/admin/questions")
                        .param("pending", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"book\":\"Genesis\",\"content\":\"Test?\",\"difficulty\":\"easy\",\"type\":\"multiple_choice_single\",\"options\":[\"A\",\"B\"],\"correctAnswer\":[0]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewStatus").value("PENDING"))
                .andExpect(jsonPath("$.isActive").value(false));
    }

    // ── PUT /api/admin/questions/{id} ────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void updateQuestion_shouldReturn200() throws Exception {
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(sampleQuestion));
        when(questionRepository.save(any(Question.class))).thenReturn(sampleQuestion);

        mockMvc.perform(put("/api/admin/questions/q-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Updated question?\"}"))
                .andExpect(status().isOk());

        verify(questionRepository).save(any(Question.class));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void updateQuestion_notFound_shouldReturn404() throws Exception {
        when(questionRepository.findById("non-existent")).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/admin/questions/non-existent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"test\"}"))
                .andExpect(status().isNotFound());
    }

    // ── DELETE /api/admin/questions/{id} ──────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void deleteQuestion_shouldReturn204() throws Exception {
        // Controller now loads the entity to run the Bible Basics safeguard
        // before deletion — return Optional<Question>, not just existsById=true.
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(sampleQuestion));

        mockMvc.perform(delete("/api/admin/questions/q-1"))
                .andExpect(status().isNoContent());

        verify(questionRepository).deleteById("q-1");
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void deleteQuestion_notFound_shouldReturn404() throws Exception {
        when(questionRepository.findById("non-existent")).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/admin/questions/non-existent"))
                .andExpect(status().isNotFound());
    }

    // ── DELETE /api/admin/questions (bulk) ────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void bulkDelete_shouldReturn200() throws Exception {
        // Controller loads targets via findAllById to evaluate safeguard.
        // None are bible_basics → safeguard passes, deleteAllById runs.
        when(questionRepository.findAllById(anyList()))
                .thenReturn(java.util.List.of(sampleQuestion));

        mockMvc.perform(delete("/api/admin/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[\"q-1\",\"q-2\",\"q-3\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(3));

        verify(questionRepository).deleteAllById(anyList());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void bulkDelete_withEmptyIds_shouldReturn400() throws Exception {
        mockMvc.perform(delete("/api/admin/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[]}"))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/admin/questions/import ─────────────────────────────────────

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void importQuestions_json_dryRun_shouldReturn200() throws Exception {
        String jsonContent = "[{\"book\":\"Genesis\",\"type\":\"multiple_choice_single\",\"text\":\"Test?\",\"difficulty\":\"easy\",\"correctAnswer\":[0],\"options\":[\"A\",\"B\"]}]";

        MockMultipartFile file = new MockMultipartFile(
                "file", "questions.json", "application/json", jsonContent.getBytes());

        mockMvc.perform(multipart("/api/admin/questions/import")
                        .file(file)
                        .param("dryRun", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(true))
                .andExpect(jsonPath("$.willImport").value(1));
    }

    // ── Bible Basics safeguard tests (Step 5) ──────────────────────────────

    private Question bibleBasicsRow(String id, String lang) {
        Question q = new Question();
        q.setId(id);
        q.setBook("Matthew");
        q.setChapter(28);
        q.setVerseStart(19);
        q.setDifficulty(Question.Difficulty.medium);
        q.setType(Question.Type.multiple_choice_single);
        q.setContent("How does God exist?");
        q.setOptions(java.util.List.of("A", "B", "C", "D"));
        q.setCorrectAnswer(java.util.List.of(1));
        q.setLanguage(lang);
        q.setIsActive(true);
        q.setCategory("bible_basics");
        return q;
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void deleteQuestion_bibleBasics_atThreshold_shouldReturn400() throws Exception {
        // Pool currently has exactly 10 active (vi). Deleting one would
        // drop to 9 → safeguard blocks with 400.
        Question target = bibleBasicsRow("bb-1", "vi");
        when(questionRepository.findById("bb-1")).thenReturn(Optional.of(target));
        when(questionRepository.countByCategoryAndLanguageAndIsActiveTrue("bible_basics", "vi"))
                .thenReturn(10L);

        mockMvc.perform(delete("/api/admin/questions/bb-1"))
                .andExpect(status().isBadRequest());

        verify(questionRepository, never()).deleteById(anyString());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void deleteQuestion_bibleBasics_aboveThreshold_shouldReturn204() throws Exception {
        // Pool has 11 active. Deleting one drops to 10 — still meets the
        // minimum, so safeguard allows it.
        Question target = bibleBasicsRow("bb-1", "vi");
        when(questionRepository.findById("bb-1")).thenReturn(Optional.of(target));
        when(questionRepository.countByCategoryAndLanguageAndIsActiveTrue("bible_basics", "vi"))
                .thenReturn(11L);

        mockMvc.perform(delete("/api/admin/questions/bb-1"))
                .andExpect(status().isNoContent());

        verify(questionRepository).deleteById("bb-1");
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void bulkDelete_bibleBasics_belowThreshold_shouldReturn400() throws Exception {
        // Two bible_basics rows in the bulk; pool currently 10 → would drop
        // to 8 → safeguard trips before deleteAllById is reached.
        Question r1 = bibleBasicsRow("bb-1", "vi");
        Question r2 = bibleBasicsRow("bb-2", "vi");
        when(questionRepository.findAllById(anyList()))
                .thenReturn(java.util.List.of(r1, r2));
        when(questionRepository.countByCategoryAndLanguageAndIsActiveTrue("bible_basics", "vi"))
                .thenReturn(10L);

        mockMvc.perform(delete("/api/admin/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[\"bb-1\",\"bb-2\"]}"))
                .andExpect(status().isBadRequest());

        verify(questionRepository, never()).deleteAllById(anyList());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void updateQuestion_deactivateBibleBasics_belowThreshold_shouldReturn400() throws Exception {
        // Active bible_basics row being flipped to inactive (via reviewStatus
        // = REJECTED, which the controller maps to isActive=false) would drop
        // the active pool from 10 to 9 → safeguard blocks. We exercise the
        // reviewStatus path here because it's the deterministic deactivation
        // route used by the admin UI; isActive=false-only payloads are rare.
        Question target = bibleBasicsRow("bb-1", "vi");
        when(questionRepository.findById("bb-1")).thenReturn(Optional.of(target));
        when(questionRepository.countByCategoryAndLanguageAndIsActiveTrue("bible_basics", "vi"))
                .thenReturn(10L);

        mockMvc.perform(put("/api/admin/questions/bb-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewStatus\":\"REJECTED\"}"))
                .andExpect(status().isBadRequest());

        verify(questionRepository, never()).save(any());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void listQuestions_withCategoryFilter_shouldReturn200() throws Exception {
        when(questionRepository.findWithAdminFilters(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(java.util.List.of(bibleBasicsRow("bb-1", "vi"))));

        mockMvc.perform(get("/api/admin/questions").param("category", "bible_basics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions").isArray())
                .andExpect(jsonPath("$.total").value(1));

        // Verify the controller forwarded category="bible_basics" to the repo.
        verify(questionRepository).findWithAdminFilters(
                isNull(), isNull(), isNull(), isNull(), isNull(),
                eq("bible_basics"), isNull(), any());
    }

    // ── GET /api/admin/questions/coverage ──────────────────────────────────

    @Test
    @WithMockUser(username = "admin@test.com", roles = "ADMIN")
    void getCoverage_shouldReturnBookStats() throws Exception {
        when(questionRepository.findDistinctActiveBooks()).thenReturn(java.util.List.of("Genesis", "Matthew"));
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Genesis", Question.Difficulty.easy)).thenReturn(35L);
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Genesis", Question.Difficulty.medium)).thenReturn(25L);
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Genesis", Question.Difficulty.hard)).thenReturn(12L);
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Matthew", Question.Difficulty.easy)).thenReturn(10L);
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Matthew", Question.Difficulty.medium)).thenReturn(5L);
        when(questionRepository.countByBookAndDifficultyAndIsActiveTrue("Matthew", Question.Difficulty.hard)).thenReturn(2L);

        mockMvc.perform(get("/api/admin/questions/coverage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.books").isArray())
                .andExpect(jsonPath("$.books[0].book").value("Genesis"))
                .andExpect(jsonPath("$.books[0].meetsMinimum").value(true))
                .andExpect(jsonPath("$.books[1].book").value("Matthew"))
                .andExpect(jsonPath("$.books[1].meetsMinimum").value(false));
    }
}
