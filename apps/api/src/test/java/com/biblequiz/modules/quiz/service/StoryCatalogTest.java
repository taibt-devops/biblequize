package com.biblequiz.modules.quiz.service;

import com.biblequiz.infrastructure.seed.question.SeedQuestion;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Checks the bundled story catalog against the bundled "Dễ cốt lõi" questions. Both
 * files come from {@code content/easy-core/build.py export}; a story id typo would
 * leave questions that no story can play, or a story with nothing to play.
 */
class StoryCatalogTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final StoryCatalog catalog = new StoryCatalog(MAPPER);

    private static List<SeedQuestion> easyCoreQuestions() throws IOException {
        try (InputStream in = new ClassPathResource("seed/questions/easy_core_quiz.json").getInputStream()) {
            return MAPPER.readValue(in, new TypeReference<List<SeedQuestion>>() {});
        }
    }

    @Test
    void bundledCatalog_holds120StoriesInCanonicalOrder() {
        List<StoryCatalog.Story> all = catalog.all();
        assertEquals(120, all.size());
        for (int i = 0; i < all.size(); i++) {
            assertEquals(i + 1, all.get(i).order());
        }
        assertEquals("sang-tao", all.get(0).id());
    }

    @Test
    void storyIds_areUniqueSlugsThatFitTheColumn() {
        List<StoryCatalog.Story> all = catalog.all();
        Set<String> ids = all.stream().map(StoryCatalog.Story::id).collect(Collectors.toSet());
        assertEquals(all.size(), ids.size());
        for (String id : ids) {
            assertTrue(id.matches("^[a-z0-9-]+$"), id);
            assertTrue(id.length() <= 64, id);
        }
    }

    @Test
    void oldTestamentHoldsTheFirstSixtyStories() {
        for (StoryCatalog.Story s : catalog.all()) {
            assertEquals(s.order() <= 60 ? "OT" : "NT", s.testament(), s.title());
            assertFalse(s.title().isBlank());
            assertFalse(s.ref().isBlank());
        }
    }

    @Test
    void everyStoryHasAnEnglishTitleAndRef() {
        for (StoryCatalog.Story s : catalog.all()) {
            assertNotNull(s.titleEn(), s.id());
            assertFalse(s.titleEn().isBlank(), s.id());
            assertNotNull(s.refEn(), s.id());
            assertEquals(s.titleEn(), s.title("en"));
            assertEquals(s.title(), s.title("vi"));
        }
    }

    @Test
    void everyEasyCoreQuestionBelongsToAStory_andEveryStoryHasQuestions() throws IOException {
        List<SeedQuestion> questions = easyCoreQuestions();
        assertFalse(questions.isEmpty());
        Map<String, Long> perStory = questions.stream()
                .collect(Collectors.groupingBy(q -> String.valueOf(q.story), Collectors.counting()));
        for (SeedQuestion q : questions) {
            assertTrue(catalog.find(q.story).isPresent(), "unknown story '" + q.story + "': " + q.content);
            assertEquals("easy", q.difficulty, q.content);
            assertEquals("vi", q.language, q.content);
        }
        for (StoryCatalog.Story s : catalog.all()) {
            assertTrue(perStory.getOrDefault(s.id(), 0L) > 0, "no questions for " + s.title());
        }
    }

    @Test
    void find_returnsEmptyForUnknownOrNullIds() {
        assertTrue(catalog.find("no-e-va-tran-lut").isPresent());
        assertTrue(catalog.find("khong-co").isEmpty());
        assertTrue(catalog.find(null).isEmpty());
    }

    @Test
    void constructor_sortsStoriesByOrder() {
        StoryCatalog c = new StoryCatalog(List.of(
                new StoryCatalog.Story("b", 2, "B", "Ref B", "OT"),
                new StoryCatalog.Story("a", 1, "A", "Ref A", "OT")));
        assertEquals(List.of("a", "b"), c.all().stream().map(StoryCatalog.Story::id).toList());
    }
}
