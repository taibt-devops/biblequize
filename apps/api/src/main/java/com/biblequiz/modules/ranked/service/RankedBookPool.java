package com.biblequiz.modules.ranked.service;

import com.biblequiz.modules.quiz.entity.Question;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Which books a Ranked match draws from (2026-10-08). Replaces the sequential
 * Genesis → Revelation journey, which put Leviticus and Numbers in front of new
 * players by their third book and made two players of the same tier face very
 * different questions depending on where their journey stood.
 *
 * <p>Books are grouped in three rings by how familiar they are to an ordinary
 * Vietnamese churchgoer. The tier opens the rings: tiers 1–2 play the familiar
 * books, tiers 3–4 add the books known from sermons and reading, tiers 5–6 play
 * the whole Bible. Inside a ring the tier difficulty mix and the smart history
 * pools of {@code SmartQuestionSelector} still apply, and one match never takes
 * more than {@link #MAX_PER_BOOK} questions from the same book.
 */
public final class RankedBookPool {

    private RankedBookPool() {
    }

    /** Ring 1: the stories taught in Sunday school and preached most often. */
    public static final List<String> FAMILIAR = List.of(
            "Genesis", "Exodus", "Ruth", "1 Samuel", "Esther", "Psalms", "Proverbs", "Daniel", "Jonah",
            "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "Ephesians", "Philippians", "James");

    /** Ring 2: books most players know from sermons and their own reading. */
    public static final List<String> KNOWN = List.of(
            "Deuteronomy", "Joshua", "Judges", "2 Samuel", "1 Kings", "2 Kings", "Nehemiah", "Job",
            "Ecclesiastes", "Isaiah", "Jeremiah",
            "1 Corinthians", "2 Corinthians", "Galatians", "Colossians", "1 Thessalonians",
            "1 Timothy", "2 Timothy", "Hebrews", "1 Peter", "1 John", "Revelation");

    /** Ring 3: ritual law, genealogies, minor prophets and the shortest letters. */
    public static final List<String> LESS_KNOWN = List.of(
            "Leviticus", "Numbers", "1 Chronicles", "2 Chronicles", "Ezra", "Song of Songs",
            "Lamentations", "Ezekiel", "Hosea", "Joel", "Amos", "Obadiah", "Micah", "Nahum",
            "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
            "2 Thessalonians", "Titus", "Philemon", "2 Peter", "2 John", "3 John", "Jude");

    /** At most this many questions from one book in a single draw. */
    public static final int MAX_PER_BOOK = 3;

    /** The widest ring: the whole Bible. */
    public static final int WHOLE_BIBLE = 3;

    /** Tiers 1–2 → ring 1, tiers 3–4 → ring 2, tiers 5–6 → ring 3. Unknown tiers start at ring 1. */
    public static int ringForTier(int tier) {
        if (tier <= 2) return 1;
        if (tier <= 4) return 2;
        return WHOLE_BIBLE;
    }

    /** Books of a ring. An empty list means no book filter, i.e. the whole Bible. */
    public static List<String> booksForRing(int ring) {
        if (ring <= 1) return FAMILIAR;
        if (ring == 2) {
            List<String> books = new ArrayList<>(FAMILIAR.size() + KNOWN.size());
            books.addAll(FAMILIAR);
            books.addAll(KNOWN);
            return List.copyOf(books);
        }
        return List.of();
    }

    /**
     * Take up to {@code limit} candidates in order, skipping excluded ids and any
     * book that already holds {@code maxPerBook} picks. {@code perBook} carries the
     * counts across calls so a widened second draw keeps the same cap.
     */
    public static List<Question> varied(List<Question> candidates, Set<String> exclude,
                                        Map<String, Integer> perBook, int limit, int maxPerBook) {
        List<Question> picked = new ArrayList<>();
        if (limit <= 0 || candidates == null) return picked;
        for (Question q : candidates) {
            if (q == null || q.getId() == null || exclude.contains(q.getId())) continue;
            String book = q.getBook() != null ? q.getBook() : "";
            int used = perBook.getOrDefault(book, 0);
            if (used >= maxPerBook) continue;
            perBook.put(book, used + 1);
            picked.add(q);
            if (picked.size() >= limit) break;
        }
        return picked;
    }
}
