package com.biblequiz.modules.bible.service;

import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.repository.BibleVerseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Text là chuỗi giả — không phải câu Kinh Thánh. */
class BiblePassageServiceTest {

    private BibleVerseRepository repository;
    private BiblePassageService service;

    @BeforeEach
    void setUp() {
        repository = mock(BibleVerseRepository.class);
        service = new BiblePassageService(repository);
    }

    private void lastVerse(String book, int chapter, Integer last) {
        when(repository.findLastVerse(BibleVerse.ACTIVE_VERSION, book, chapter)).thenReturn(last);
    }

    private static BibleVerse row(String book, int chapter, int verse, Integer verseEnd, String text) {
        BibleVerse v = new BibleVerse("RVV11", book, 43, chapter, verse, text);
        v.setVerseEnd(verseEnd);
        return v;
    }

    @Test
    void returnsVersesInOrder() {
        lastVerse("John", 3, 36);
        when(repository.findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.ACTIVE_VERSION, "John", 3, 14 - BiblePassageService.MERGE_REACH, 18))
                .thenReturn(List.of(row("John", 3, 12, null, "before"), row("John", 3, 14, null, "fixture a"),
                        row("John", 3, 15, null, "fixture b")));

        var passage = service.getPassage("John", 3, 14, 18).orElseThrow();

        assertEquals("RVV11", passage.version());
        assertEquals(List.of(new BiblePassageService.VerseText(14, "fixture a"),
                new BiblePassageService.VerseText(15, "fixture b")), passage.verses());
    }

    @Test
    void mergedBlockStartingBeforeTheRange_isReturnedWhole() {
        // RVV11 prints Deuteronomy 13:17-18 as one block, stored at verse 17.
        lastVerse("Deuteronomy", 13, 18);
        when(repository.findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.ACTIVE_VERSION, "Deuteronomy", 13, 18 - BiblePassageService.MERGE_REACH, 18))
                .thenReturn(List.of(row("Deuteronomy", 13, 16, null, "a"), row("Deuteronomy", 13, 17, 18, "b")));

        var verses = service.getPassage("Deuteronomy", 13, 18, 18).orElseThrow().verses();

        assertEquals(List.of(new BiblePassageService.VerseText(17, 18, "b")), verses);
        assertEquals(18, verses.get(0).lastVerse());
    }

    @Test
    void clampsRangeToTheLastVerseInTheText() {
        // Jude 1 có 25 câu: ngữ cảnh ±2 quanh câu 25 xin tới 27.
        lastVerse("Jude", 1, 25);
        service.getPassage("Jude", 1, 23, 27);
        verify(repository).findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.ACTIVE_VERSION, "Jude", 1, 19, 25);
    }

    @Test
    void versesBeyondTheCanonicalTable_followTheTranslation() {
        // RVV11 numbers Jonah 2 as 1-11 (Hebrew); BibleStructure has 10.
        lastVerse("Jonah", 2, 11);
        when(repository.findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.ACTIVE_VERSION, "Jonah", 2, 7, 11))
                .thenReturn(List.of(row("Jonah", 2, 11, null, "fixture")));
        assertEquals(11, service.getPassage("Jonah", 2, 11, 11).orElseThrow().verses().get(0).verse());
    }

    @Test
    void emptyWhenTextNotImported() {
        assertTrue(service.getPassage("John", 3, 16, 16).isEmpty());
    }

    @Test
    void rejectsInvalidReferences() {
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Tobit", 1, 1, 1));
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Jude", 2, 1, 1));
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Jude", 1, 0, 3));
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Jude", 1, 5, 4));
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Psalms", 119, 1, 31));
        verifyNoInteractions(repository);

        lastVerse("Jude", 1, 25);
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Jude", 1, 26, 27));
    }

    @Test
    void allowsMaxSpan() {
        assertDoesNotThrow(() -> service.getPassage("Psalms", 119, 1, 30));
    }

    @Test
    void chapterVerses_listsVersesAndMergedBlocks() {
        BibleVerseRepository.VerseNumberView plain = view(16, null);
        BibleVerseRepository.VerseNumberView merged = view(17, 18);
        when(repository.findNumbersByVersionAndBookAndChapterOrderByVerseAsc(BibleVerse.ACTIVE_VERSION, "Deuteronomy", 13))
                .thenReturn(List.of(plain, merged));

        assertEquals(List.of(new BiblePassageService.VerseNumber(16, null), new BiblePassageService.VerseNumber(17, 18)),
                service.chapterVerses("Deuteronomy", 13));
        assertThrows(IllegalArgumentException.class, () -> service.chapterVerses("Jude", 2));
    }

    private static BibleVerseRepository.VerseNumberView view(int verse, Integer verseEnd) {
        return new BibleVerseRepository.VerseNumberView() {
            @Override public int getVerse() { return verse; }
            @Override public Integer getVerseEnd() { return verseEnd; }
        };
    }

    @Test
    void textAvailability_checksTheCanonicalVersion() {
        when(repository.existsByVersion(BibleVerse.ACTIVE_VERSION)).thenReturn(false, true);
        assertFalse(service.isTextAvailable());
        assertTrue(service.isTextAvailable());
    }
}
