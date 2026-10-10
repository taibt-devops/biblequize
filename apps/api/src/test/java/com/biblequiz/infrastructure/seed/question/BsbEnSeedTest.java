package com.biblequiz.infrastructure.seed.question;

import com.biblequiz.modules.quiz.service.StoryCatalog;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Guards the English BSB set ({@code content/en/build.py export}) against hand edits: the script
 * checks the Bible text, this checks what the seeder and the story picker rely on.
 */
class BsbEnSeedTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String FILE = "bsb_en_quiz.json";

    private static List<SeedQuestion> read(Resource r) throws IOException {
        try (InputStream in = r.getInputStream()) {
            return MAPPER.readValue(in, new TypeReference<List<SeedQuestion>>() {});
        }
    }

    private static Resource[] seedFiles() throws IOException {
        return new PathMatchingResourcePatternResolver().getResources("classpath*:seed/questions/*_quiz*.json");
    }

    private static List<SeedQuestion> bsb() throws IOException {
        for (Resource r : seedFiles()) {
            if (FILE.equals(r.getFilename())) return read(r);
        }
        return fail(FILE + " is not on the classpath");
    }

    @Test
    void everyQuestionIsAnEnglishSingleChoiceWithFourOptions() throws IOException {
        List<SeedQuestion> questions = bsb();
        assertFalse(questions.isEmpty());
        for (SeedQuestion q : questions) {
            assertEquals("en", q.language, q.content);
            assertTrue(Set.of("easy", "medium", "hard").contains(q.difficulty), q.content);
            assertEquals("multiple_choice_single", q.type, q.content);
            assertEquals(4, new HashSet<>(q.options).size(), q.content);
            assertEquals(1, q.correctAnswer.size(), q.content);
            int answer = q.correctAnswer.get(0);
            assertTrue(answer >= 0 && answer < 4, q.content);
            assertTrue(q.tags.contains("BSB"), q.content);
            assertNotNull(q.explanation, q.content);
            assertFalse(q.content.matches(".*\\b\\d+:\\d+\\b.*"), "cites a verse: " + q.content);
        }
    }

    @Test
    void storyQuestionsAreEasyAndUseKnownStoryIds() throws IOException {
        StoryCatalog catalog = new StoryCatalog(MAPPER);
        for (SeedQuestion q : bsb()) {
            if (q.story == null) continue;
            assertEquals("easy", q.difficulty, q.content);
            assertTrue(catalog.find(q.story).isPresent(), "unknown story '" + q.story + "': " + q.content);
        }
    }

    @Test
    void noQuestionSharesAContentHashWithAnotherSeedQuestion() throws IOException {
        Map<String, String> seen = new HashMap<>();
        for (Resource r : seedFiles()) {
            if (FILE.equals(r.getFilename())) continue;
            for (SeedQuestion q : read(r)) seen.put(QuestionSeeder.computeContentHash(q), r.getFilename());
        }
        Set<String> own = new HashSet<>();
        for (SeedQuestion q : bsb()) {
            String h = QuestionSeeder.computeContentHash(q);
            assertTrue(own.add(h), "twice in " + FILE + ": " + q.content);
            assertFalse(seen.containsKey(h), "also in " + seen.get(h) + ": " + q.content);
        }
    }
}
