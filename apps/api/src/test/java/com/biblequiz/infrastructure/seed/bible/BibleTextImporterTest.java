package com.biblequiz.infrastructure.seed.bible;

import com.biblequiz.infrastructure.seed.bible.BibleTextImporter.VerseRow;
import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.repository.BibleVerseRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Text trong test là chuỗi giả — không phải câu Kinh Thánh. */
class BibleTextImporterTest {

    private BibleVerseRepository repository;
    private JdbcTemplate jdbc;
    private BibleTextImporter importer;

    @BeforeEach
    void setUp() {
        repository = mock(BibleVerseRepository.class);
        jdbc = mock(JdbcTemplate.class);
        importer = new BibleTextImporter(repository, jdbc, new ObjectMapper(), mock(ResourcePatternResolver.class));
    }

    private static List<VerseRow> rows(String book, int chapter, int count) {
        List<VerseRow> out = new ArrayList<>();
        for (int v = 1; v <= count; v++) out.add(new VerseRow(chapter, v, "fixture " + book + " " + chapter + ":" + v));
        return out;
    }

    @Test
    void skipsBookThatIsAlreadyComplete() {
        when(repository.countByVersionAndBook(BibleVerse.ACTIVE_VERSION, "Jude")).thenReturn(25L);
        assertEquals(0, importer.importFile("65-Jude.json", rows("Jude", 1, 25)));
        verifyNoInteractions(jdbc);
    }

    @Test
    void upsertsMissingBookWithDeterministicIdsAndOrder() {
        when(repository.countByVersionAndBook(any(), any())).thenReturn(3L);
        assertEquals(25, importer.importFile("65-Jude.json", rows("Jude", 1, 25)));

        ArgumentCaptor<List<Object[]>> captor = ArgumentCaptor.captor();
        verify(jdbc).batchUpdate(eq(BibleTextImporter.UPSERT_SQL), captor.capture());
        Object[] first = captor.getValue().get(0);
        assertEquals(BibleVerse.idFor(BibleVerse.ACTIVE_VERSION, "Jude", 1, 1), first[0]);
        assertEquals("Jude", first[2]);
        assertEquals(65, first[3]);
        assertEquals(25, captor.getValue().size());
    }

    @Test
    void splitsLargeBooksIntoBatches() {
        when(repository.countByVersionAndBook(any(), any())).thenReturn(0L);
        List<VerseRow> many = new ArrayList<>();
        many.addAll(rows("Genesis", 1, 31));
        for (int i = 0; i < 1100; i++) many.add(new VerseRow(2, 1, "fixture dup"));
        importer.importFile("01-Genesis.json", many);
        verify(jdbc, times(3)).batchUpdate(eq(BibleTextImporter.UPSERT_SQL), anyList());
    }

    @Test
    void underscoreInFileNameMapsToSpaceInBookKey() {
        when(repository.countByVersionAndBook(BibleVerse.ACTIVE_VERSION, "1 Samuel")).thenReturn(0L);
        assertEquals(2, importer.importFile("09-1_Samuel.json", rows("1 Samuel", 1, 2)));
    }

    @Test
    void rejectsFileNameThatDoesNotMatchCanonicalOrder() {
        assertThrows(IllegalArgumentException.class, () -> importer.importFile("01-John.json", rows("John", 1, 1)));
        assertThrows(IllegalArgumentException.class, () -> importer.importFile("John.json", rows("John", 1, 1)));
        verifyNoInteractions(jdbc);
    }

    @Test
    void structureMismatches_flagsUnknownRefsAndBlankText() {
        List<VerseRow> in = List.of(
                new VerseRow(1, 25, "ok"),
                new VerseRow(1, 26, "verse beyond chapter"),
                new VerseRow(2, 1, "chapter beyond book"),
                new VerseRow(1, 3, "  "));
        assertEquals(List.of("1:26", "2:1", "1:3"), BibleTextImporter.structureMismatches("Jude", in));
    }

    @Test
    void verseRow_deserializesFromSeedJsonShape() throws Exception {
        List<VerseRow> parsed = new ObjectMapper().readValue(
                "[{\"chapter\":1,\"verse\":2,\"text\":\"fixture\"}]", new TypeReference<>() {});
        assertEquals(new VerseRow(1, 2, "fixture"), parsed.get(0));
    }
}
