package com.biblequiz.modules.bible.service;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.repository.BibleVerseRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/** Đọc một đoạn liền nhau của toàn văn (SPEC_USER §27.20). */
@Service
public class BiblePassageService {

    /** `to - from` tối đa — đủ cho ngữ cảnh ±2 quanh đoạn 5 câu, chặn đọc cả chương dài. */
    public static final int MAX_SPAN = 29;

    public record VerseText(int verse, String text) {}

    public record Passage(String version, String book, int chapter, List<VerseText> verses) {}

    private final BibleVerseRepository repository;

    public BiblePassageService(BibleVerseRepository repository) {
        this.repository = repository;
    }

    /** True khi đã có chữ BTTHĐ 2011 — FE chỉ hiện lối vào Học Thuộc khi đúng (SPEC_USER §5.1.1). */
    public boolean isTextAvailable() {
        return repository.existsByVersion(BibleVerse.BTTHD_2011);
    }

    /**
     * @throws IllegalArgumentException tham chiếu không hợp lệ (sách lạ, chương/câu ngoài phạm vi, quá dài)
     * @return empty nếu tham chiếu hợp lệ nhưng chưa có chữ (chưa import)
     */
    public Optional<Passage> getPassage(String book, int chapter, int from, int to) {
        validate(book, chapter, from, to);
        // Cắt phần vượt cuối chương thay vì báo lỗi: ngữ cảnh ±2 ở câu cuối chương là chuyện thường.
        int last = Math.min(to, BibleStructure.getVerseCount(book, chapter));
        List<VerseText> verses = repository
                .findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                        BibleVerse.BTTHD_2011, book, chapter, Math.max(1, from), last)
                .stream()
                .map(v -> new VerseText(v.getVerse(), v.getText()))
                .toList();
        return verses.isEmpty()
                ? Optional.empty()
                : Optional.of(new Passage(BibleVerse.BTTHD_2011, book, chapter, verses));
    }

    static void validate(String book, int chapter, int from, int to) {
        if (!BibleStructure.isKnown(book)) throw new IllegalArgumentException("Sách không hợp lệ: " + book);
        if (chapter < 1 || chapter > BibleStructure.getMaxChapter(book)) {
            throw new IllegalArgumentException("Chương không hợp lệ: " + chapter);
        }
        if (from < 1 || to < from || from > BibleStructure.getVerseCount(book, chapter)) {
            throw new IllegalArgumentException("Khoảng câu không hợp lệ: " + from + "-" + to);
        }
        if (to - from > MAX_SPAN) throw new IllegalArgumentException("Đoạn quá dài (tối đa " + (MAX_SPAN + 1) + " câu)");
    }
}
