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

    @Test
    void returnsVersesInOrder() {
        when(repository.findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.BTTHD_2011, "John", 3, 14, 18))
                .thenReturn(List.of(new BibleVerse("BTTHD2011", "John", 43, 3, 14, "fixture a"),
                        new BibleVerse("BTTHD2011", "John", 43, 3, 15, "fixture b")));

        var passage = service.getPassage("John", 3, 14, 18).orElseThrow();

        assertEquals("BTTHD2011", passage.version());
        assertEquals(List.of(new BiblePassageService.VerseText(14, "fixture a"),
                new BiblePassageService.VerseText(15, "fixture b")), passage.verses());
    }

    @Test
    void clampsRangeToEndOfChapter() {
        // Jude 1 có 25 câu: ngữ cảnh ±2 quanh câu 25 xin tới 27.
        service.getPassage("Jude", 1, 23, 27);
        verify(repository).findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                BibleVerse.BTTHD_2011, "Jude", 1, 23, 25);
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
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Jude", 1, 26, 27));
        assertThrows(IllegalArgumentException.class, () -> service.getPassage("Psalms", 119, 1, 31));
        verifyNoInteractions(repository);
    }

    @Test
    void allowsMaxSpan() {
        assertDoesNotThrow(() -> service.getPassage("Psalms", 119, 1, 30));
    }
}
