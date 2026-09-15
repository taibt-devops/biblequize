package com.biblequiz.infrastructure.seed.bible;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.InputStream;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Data-integrity guard for the bundled Bible text (BTT 1926, eBible {@code vie1934}) that
 * {@link BibleTextImporter} loads on prod. Checks the whole corpus against
 * {@link BibleStructure} so a bad regeneration can't ship missing, shifted or blank verses.
 */
class BibleSeedContentTest {

    private static final String PATTERN = "classpath*:seed/bible/btt1926/*.json";
    private static final Map<String, List<BibleTextImporter.VerseRow>> BOOKS = new LinkedHashMap<>();

    @BeforeAll
    static void load() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources(PATTERN);
        Arrays.sort(resources, Comparator.comparing(Resource::getFilename));
        for (Resource r : resources) {
            try (InputStream in = r.getInputStream()) {
                BOOKS.put(r.getFilename(), mapper.readValue(in, new TypeReference<>() {}));
            }
        }
    }

    @Test
    void hasOneFilePerCanonicalBookInOrder() {
        List<String> canon = BibleStructure.getCanonicalBooks();
        List<String> expected = new ArrayList<>();
        for (int i = 0; i < canon.size(); i++) {
            expected.add(String.format("%02d-%s.json", i + 1, canon.get(i).replace(' ', '_')));
        }
        assertEquals(expected, new ArrayList<>(BOOKS.keySet()));
    }

    @Test
    void everyChapterHasExactlyTheCanonicalVerses() {
        List<String> canon = BibleStructure.getCanonicalBooks();
        int total = 0;
        for (Map.Entry<String, List<BibleTextImporter.VerseRow>> e : BOOKS.entrySet()) {
            String book = canon.get(Integer.parseInt(e.getKey().substring(0, 2)) - 1);
            Map<Integer, List<Integer>> byChapter = new TreeMap<>();
            for (BibleTextImporter.VerseRow row : e.getValue()) {
                byChapter.computeIfAbsent(row.chapter(), c -> new ArrayList<>()).add(row.verse());
            }
            assertEquals(BibleStructure.getMaxChapter(book), byChapter.size(), book + " chapter count");
            for (Map.Entry<Integer, List<Integer>> ch : byChapter.entrySet()) {
                int count = BibleStructure.getVerseCount(book, ch.getKey());
                List<Integer> expected = new ArrayList<>();
                for (int v = 1; v <= count; v++) expected.add(v);
                assertEquals(expected, ch.getValue(), book + " " + ch.getKey() + " verses 1.." + count + " in order");
            }
            assertTrue(BibleTextImporter.structureMismatches(book, e.getValue()).isEmpty(), book);
            total += e.getValue().size();
        }
        assertEquals(31_102, total);
    }

    @Test
    void textIsCleanNfcWithoutMarkup() {
        for (Map.Entry<String, List<BibleTextImporter.VerseRow>> e : BOOKS.entrySet()) {
            for (BibleTextImporter.VerseRow row : e.getValue()) {
                String where = e.getKey() + " " + row.chapter() + ":" + row.verse();
                assertFalse(row.text().isBlank(), where);
                assertFalse(row.text().contains("\\"), where + " has USFM markup");
                assertEquals(row.text().strip(), row.text(), where + " has surrounding whitespace");
                assertTrue(java.text.Normalizer.isNormalized(row.text(), java.text.Normalizer.Form.NFC), where);
            }
        }
    }

    @Test
    void spotCheckWellKnownVerses() {
        assertEquals("Vì Đức Chúa Trời yêu thương thế gian, đến nỗi đã ban Con một của Ngài, hầu cho hễ ai tin Con ấy "
                + "không bị hư mất mà được sự sống đời đời.", text("43-John.json", 3, 16));
        assertEquals("Ban đầu Đức Chúa Trời dựng nên trời đất.", text("01-Genesis.json", 1, 1));
        assertEquals("Đức Giê-hô-va là Đấng chăn giữ tôi: tôi sẽ chẳng thiếu thốn gì.", text("19-Psalms.json", 23, 1));
    }

    private static String text(String file, int chapter, int verse) {
        return BOOKS.get(file).stream()
                .filter(r -> r.chapter() == chapter && r.verse() == verse)
                .findFirst().orElseThrow().text();
    }
}
