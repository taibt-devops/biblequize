package com.biblequiz.modules.ranked.service;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.biblequiz.modules.quiz.entity.Question;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pins the Ranked book rings (2026-10-08): which books each tier draws from
 * and the per-book cap that keeps one match varied.
 */
class RankedBookPoolTest {

    @Test
    void rings_coverAll66CanonicalBooks_withoutOverlap() {
        List<String> all = new ArrayList<>();
        all.addAll(RankedBookPool.FAMILIAR);
        all.addAll(RankedBookPool.KNOWN);
        all.addAll(RankedBookPool.LESS_KNOWN);

        assertEquals(66, all.size());
        assertEquals(66, new HashSet<>(all).size(), "a book sits in two rings");
        // Names must match Question.book exactly, or a ring silently loses the book.
        assertEquals(new HashSet<>(BibleStructure.getCanonicalBooks()), new HashSet<>(all));
    }

    @Test
    void ringForTier_opensWiderRingsAsTierRises() {
        assertEquals(1, RankedBookPool.ringForTier(1));
        assertEquals(1, RankedBookPool.ringForTier(2));
        assertEquals(2, RankedBookPool.ringForTier(3));
        assertEquals(2, RankedBookPool.ringForTier(4));
        assertEquals(3, RankedBookPool.ringForTier(5));
        assertEquals(3, RankedBookPool.ringForTier(6));
        assertEquals(1, RankedBookPool.ringForTier(0), "unknown tier starts with familiar books");
    }

    @Test
    void booksForRing_growsFromFamiliarToWholeBible() {
        assertEquals(RankedBookPool.FAMILIAR, RankedBookPool.booksForRing(1));

        List<String> ring2 = RankedBookPool.booksForRing(2);
        assertEquals(40, ring2.size());
        assertTrue(ring2.containsAll(RankedBookPool.FAMILIAR));
        assertTrue(ring2.containsAll(RankedBookPool.KNOWN));
        assertFalse(ring2.contains("Leviticus"));

        assertTrue(RankedBookPool.booksForRing(3).isEmpty(), "empty = no book filter = whole Bible");
    }

    @Test
    void varied_capsEachBook_andSkipsExcludedIds() {
        List<Question> candidates = new ArrayList<>();
        for (int i = 0; i < 5; i++) candidates.add(q("g" + i, "Genesis"));
        for (int i = 0; i < 2; i++) candidates.add(q("m" + i, "Mark"));
        candidates.add(q("x", "Ruth"));

        Map<String, Integer> perBook = new HashMap<>();
        List<Question> picked = RankedBookPool.varied(candidates, Set.of("x"), perBook, 10, 3);

        assertEquals(List.of("g0", "g1", "g2", "m0", "m1"), picked.stream().map(Question::getId).toList());
        assertEquals(3, perBook.get("Genesis"));
        assertEquals(2, perBook.get("Mark"));
    }

    @Test
    void varied_carriesTheCapAcrossDraws_andStopsAtLimit() {
        Map<String, Integer> perBook = new HashMap<>();
        perBook.put("Genesis", 2);

        List<Question> picked = RankedBookPool.varied(
                List.of(q("g8", "Genesis"), q("g9", "Genesis"), q("j1", "John"), q("j2", "John")),
                Set.of(), perBook, 2, 3);

        assertEquals(List.of("g8", "j1"), picked.stream().map(Question::getId).toList());
        assertTrue(RankedBookPool.varied(List.of(q("a", "Acts")), Set.of(), new HashMap<>(), 0, 3).isEmpty());
    }

    private static Question q(String id, String book) {
        Question q = new Question();
        q.setId(id);
        q.setBook(book);
        return q;
    }
}
