package com.biblequiz.infrastructure.seed.question;

import com.biblequiz.modules.quiz.entity.Question;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure-logic tests for the static helpers inside {@link QuestionSeeder}.
 *
 * <p>End-to-end seeding (reading JSON files + saving through the
 * repository) is better exercised via an integration/@SpringBootTest —
 * not included here to keep this suite fast and dependency-free.
 */
class QuestionSeederTest {

    private SeedQuestion build() {
        SeedQuestion q = new SeedQuestion();
        q.book = "Genesis";
        q.chapter = 1;
        q.verseStart = 1;
        q.verseEnd = null;
        q.difficulty = "easy";
        q.type = "multiple_choice_single";
        q.content = "Ai đã dựng nên trời và đất?";
        q.options = List.of("Môi-se", "Đức Chúa Trời", "Áp-ra-ham", "Đa-vít");
        q.correctAnswer = List.of(1);
        q.explanation = "Sáng thế ký 1:1.";
        q.language = "vi";
        return q;
    }

    // ── Deterministic ID ──────────────────────────────────────────

    @Test
    void computeDeterministicId_isStableAcrossCalls() {
        SeedQuestion q = build();
        String id1 = QuestionSeeder.computeDeterministicId(q);
        String id2 = QuestionSeeder.computeDeterministicId(q);
        assertEquals(id1, id2);
    }

    @Test
    void computeDeterministicId_isStableAcrossEqualButDistinctInstances() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        String id2 = QuestionSeeder.computeDeterministicId(build());
        assertEquals(id1, id2);
    }

    @Test
    void computeDeterministicId_ignoresLeadingTrailingWhitespaceInContent() {
        SeedQuestion a = build();
        SeedQuestion b = build();
        b.content = "  " + a.content + "  ";
        assertEquals(QuestionSeeder.computeDeterministicId(a), QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_ignoresCaseInContent() {
        SeedQuestion a = build();
        SeedQuestion b = build();
        b.content = a.content.toUpperCase();
        assertEquals(QuestionSeeder.computeDeterministicId(a), QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_changesWhenBookChanges() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        SeedQuestion b = build();
        b.book = "Exodus";
        String id2 = QuestionSeeder.computeDeterministicId(b);
        assertNotEquals(id1, id2);
    }

    @Test
    void computeDeterministicId_changesWhenChapterChanges() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        SeedQuestion b = build();
        b.chapter = 2;
        assertNotEquals(id1, QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_changesWhenVerseStartChanges() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        SeedQuestion b = build();
        b.verseStart = 27;
        assertNotEquals(id1, QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_changesWhenLanguageChanges() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        SeedQuestion b = build();
        b.language = "en";
        assertNotEquals(id1, QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_changesWhenContentChangesMeaningfully() {
        String id1 = QuestionSeeder.computeDeterministicId(build());
        SeedQuestion b = build();
        b.content = "Ai tạo nên loài người?";
        assertNotEquals(id1, QuestionSeeder.computeDeterministicId(b));
    }

    @Test
    void computeDeterministicId_returnsValidUuidFormat() {
        String id = QuestionSeeder.computeDeterministicId(build());
        // UUID.nameUUIDFromBytes produces 36-char canonical form with 4 dashes
        assertEquals(36, id.length());
        assertEquals(4, id.chars().filter(c -> c == '-').count());
    }

    // ── Entity mapping ───────────────────────────────────────────

    @Test
    void toEntity_copiesAllRequiredFields() {
        SeedQuestion q = build();
        Question e = QuestionSeeder.toEntity(q, "id-1");
        assertEquals("id-1", e.getId());
        assertEquals("Genesis", e.getBook());
        assertEquals(1, e.getChapter());
        assertEquals(1, e.getVerseStart());
        assertEquals(Question.Difficulty.easy, e.getDifficulty());
        assertEquals(Question.Type.multiple_choice_single, e.getType());
        assertEquals("Ai đã dựng nên trời và đất?", e.getContent());
        assertEquals(4, e.getOptions().size());
        assertEquals(List.of(1), e.getCorrectAnswer());
        assertEquals("vi", e.getLanguage());
        assertTrue(e.getIsActive());
        assertEquals(Question.ReviewStatus.ACTIVE, e.getReviewStatus());
        assertNull(e.getStory());
    }

    @Test
    void toEntity_copiesStory() {
        SeedQuestion q = build();
        q.story = "sang-tao";
        assertEquals("sang-tao", QuestionSeeder.toEntity(q, "id-1").getStory());
    }

    @Test
    void computeDeterministicId_ignoresStory() {
        // Tagging an existing question with a story must update it in place, not re-insert it.
        SeedQuestion tagged = build();
        tagged.story = "sang-tao";
        assertEquals(QuestionSeeder.computeDeterministicId(build()), QuestionSeeder.computeDeterministicId(tagged));
    }

    @Test
    void toEntity_defaultsLanguageToVietnameseWhenMissing() {
        SeedQuestion q = build();
        q.language = null;
        Question e = QuestionSeeder.toEntity(q, "id-2");
        assertEquals("vi", e.getLanguage());
    }

    @Test
    void toEntity_trimsContentWhitespace() {
        SeedQuestion q = build();
        q.content = "  Câu hỏi  ";
        Question e = QuestionSeeder.toEntity(q, "id-3");
        assertEquals("Câu hỏi", e.getContent());
    }

    @Test
    void toEntity_backfillsTrueFalseOptionsInVietnamese() {
        SeedQuestion q = build();
        q.type = "true_false";
        q.options = null;
        q.language = "vi";
        Question e = QuestionSeeder.toEntity(q, "id-tf-vi");
        assertEquals(List.of("Đúng", "Sai"), e.getOptions());
    }

    @Test
    void toEntity_backfillsTrueFalseOptionsInEnglish() {
        SeedQuestion q = build();
        q.type = "true_false";
        q.options = null;
        q.language = "en";
        Question e = QuestionSeeder.toEntity(q, "id-tf-en");
        assertEquals(List.of("True", "False"), e.getOptions());
    }

    @Test
    void toEntity_respectsExplicitOptionsEvenForTrueFalse() {
        SeedQuestion q = build();
        q.type = "true_false";
        q.options = List.of("Có", "Không");
        Question e = QuestionSeeder.toEntity(q, "id-tf-custom");
        assertEquals(List.of("Có", "Không"), e.getOptions());
    }

    @Test
    void toEntity_tagsSourceWhenMissing() {
        SeedQuestion q = build();
        q.source = null;
        Question e = QuestionSeeder.toEntity(q, "id-src");
        assertEquals("seed:json", e.getSource());
    }

    @Test
    void toEntity_respectsExplicitSource() {
        SeedQuestion q = build();
        q.source = "curated-v2";
        Question e = QuestionSeeder.toEntity(q, "id-src2");
        assertEquals("curated-v2", e.getSource());
    }

    @Test
    void toEntity_marksActiveAndApproved() {
        Question e = QuestionSeeder.toEntity(build(), "id-status");
        assertTrue(e.getIsActive());
        assertEquals(Question.ReviewStatus.ACTIVE, e.getReviewStatus());
        assertEquals(0, e.getApprovalsCount());
    }

    @Test
    void toEntity_parsesDifficultyEnumCaseInsensitively() {
        SeedQuestion q = build();
        q.difficulty = "MEDIUM";
        Question e = QuestionSeeder.toEntity(q, "id-diff");
        assertEquals(Question.Difficulty.medium, e.getDifficulty());
    }

    // ── Tags serialization ───────────────────────────────────────

    @Test
    void serializeTags_returnsNullForNullInput() {
        assertNull(QuestionSeeder.serializeTags(null));
    }

    @Test
    void serializeTags_returnsNullForEmptyList() {
        assertNull(QuestionSeeder.serializeTags(List.of()));
    }

    @Test
    void serializeTags_buildsValidJsonArray() {
        String json = QuestionSeeder.serializeTags(List.of("Cựu Ước", "Sáng Thế Ký", "Sáng tạo"));
        assertEquals("[\"Cựu Ước\",\"Sáng Thế Ký\",\"Sáng tạo\"]", json);
    }

    @Test
    void serializeTags_escapesEmbeddedQuotes() {
        String json = QuestionSeeder.serializeTags(List.of("A \"B\" C"));
        assertEquals("[\"A \\\"B\\\" C\"]", json);
    }

    @Test
    void serializeTags_escapesBackslashes() {
        String json = QuestionSeeder.serializeTags(List.of("path\\to"));
        assertEquals("[\"path\\\\to\"]", json);
    }

    @Test
    void toEntity_persistsTagsAsJsonString() {
        SeedQuestion q = build();
        q.tags = List.of("Cựu Ước", "Sáng tạo");
        Question e = QuestionSeeder.toEntity(q, "id-tags");
        assertEquals("[\"Cựu Ước\",\"Sáng tạo\"]", e.getTags());
    }

    @Test
    void toEntity_persistsNullTagsWhenMissingInSeed() {
        SeedQuestion q = build();
        q.tags = null;
        Question e = QuestionSeeder.toEntity(q, "id-notags");
        assertNull(e.getTags());
    }
}
