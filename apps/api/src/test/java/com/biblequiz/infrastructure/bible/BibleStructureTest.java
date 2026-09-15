package com.biblequiz.infrastructure.bible;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BibleStructureTest {

    @Test
    void isKnown_returnsTrueForCanonicalBooks() {
        assertTrue(BibleStructure.isKnown("Genesis"));
        assertTrue(BibleStructure.isKnown("Mark"));
        assertTrue(BibleStructure.isKnown("Revelation"));
        assertFalse(BibleStructure.isKnown("Tobit"));
        assertFalse(BibleStructure.isKnown(null));
        assertFalse(BibleStructure.isKnown(""));
    }

    @Test
    void getMaxChapter_returnsExpectedCounts() {
        assertEquals(50, BibleStructure.getMaxChapter("Genesis"));
        assertEquals(16, BibleStructure.getMaxChapter("Mark"));
        assertEquals(150, BibleStructure.getMaxChapter("Psalms"));
        assertEquals(1, BibleStructure.getMaxChapter("Obadiah"));
        assertEquals(0, BibleStructure.getMaxChapter("Unknown"));
    }

    @Test
    void getVerseCount_returnsExpectedCounts() {
        assertEquals(31, BibleStructure.getVerseCount("Genesis", 1));
        assertEquals(45, BibleStructure.getVerseCount("Mark", 1));
        assertEquals(20, BibleStructure.getVerseCount("Mark", 16));
        assertEquals(0, BibleStructure.getVerseCount("Mark", 17)); // out of range
        assertEquals(0, BibleStructure.getVerseCount("Mark", 0));  // 1-indexed
    }

    @Test
    void validateRange_returnsNullWhenAllNull() {
        assertNull(BibleStructure.validateRange("Mark", null, null, null, null));
        assertNull(BibleStructure.validateRange(null, null, null, null, null));
    }

    @Test
    void validateRange_rejectsRangeWithoutBook() {
        assertNotNull(BibleStructure.validateRange(null, 1, 5, null, null));
        assertNotNull(BibleStructure.validateRange("", 1, 5, null, null));
    }

    @Test
    void validateRange_rejectsUnknownBook() {
        assertNotNull(BibleStructure.validateRange("Tobit", 1, 5, null, null));
    }

    @Test
    void validateRange_rejectsChapterOutOfBounds() {
        assertNotNull(BibleStructure.validateRange("Mark", 50, 60, null, null),
                "Mark only has 16 chapters");
        assertNotNull(BibleStructure.validateRange("Mark", 0, 5, null, null));
        assertNotNull(BibleStructure.validateRange("Mark", 5, 17, null, null));
    }

    @Test
    void validateRange_rejectsInvertedChapterRange() {
        assertNotNull(BibleStructure.validateRange("Genesis", 10, 5, null, null));
    }

    @Test
    void validateRange_acceptsValidChapterRange() {
        assertNull(BibleStructure.validateRange("Genesis", 1, 50, null, null));
        assertNull(BibleStructure.validateRange("Mark", 3, 8, null, null));
        assertNull(BibleStructure.validateRange("Mark", 5, 5, null, null));
    }

    @Test
    void validateRange_rejectsVerseRangeAcrossChapters() {
        assertNotNull(BibleStructure.validateRange("Mark", 1, 2, 5, 10),
                "Verse range only allowed within a single chapter");
    }

    @Test
    void validateRange_rejectsVerseOutOfBounds() {
        // Mark 1 has 45 verses
        assertNotNull(BibleStructure.validateRange("Mark", 1, 1, 1, 50));
        assertNotNull(BibleStructure.validateRange("Mark", 1, 1, 0, 10));
    }

    @Test
    void validateRange_acceptsValidVerseRange() {
        assertNull(BibleStructure.validateRange("Mark", 1, 1, 1, 45));
        assertNull(BibleStructure.validateRange("Mark", 1, 1, 10, 20));
    }

    @Test
    void validateRange_rejectsInvertedVerseRange() {
        assertNotNull(BibleStructure.validateRange("Mark", 1, 1, 20, 10));
    }

    // BT-3a (2026-09-15): Leviticus 19–27, Ecclesiastes 4–5, Isaiah 34–66 and Ephesians 4–6 had
    // wrong verse counts (total 31,152). Locked against the bundled BTT 1926 text (31,102).
    @Test
    void verseCounts_matchStandardProtestantVersification() {
        int total = 0;
        for (String book : BibleStructure.getCanonicalBooks()) {
            for (int v : BibleStructure.getVerses(book)) total += v;
        }
        assertEquals(31_102, total);
        assertEquals(37, BibleStructure.getVerseCount("Leviticus", 19));
        assertEquals(20, BibleStructure.getVerseCount("Ecclesiastes", 5));
        assertEquals(12, BibleStructure.getVerseCount("Isaiah", 53));
        assertEquals(31, BibleStructure.getVerseCount("Isaiah", 40));
        assertEquals(33, BibleStructure.getVerseCount("Ephesians", 5));
    }
}
