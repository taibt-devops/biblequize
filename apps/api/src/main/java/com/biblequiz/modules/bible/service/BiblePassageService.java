package com.biblequiz.modules.bible.service;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.repository.BibleVerseRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Đọc một đoạn liền nhau của toàn văn (SPEC_USER §27.20).
 *
 * <p>Số câu theo đúng bản dịch đang dùng (RVV11), không theo {@link BibleStructure}: RVV11 gộp vài câu
 * thành một khối ("17-18", lưu ở câu đầu với {@code verseEnd}), lược vài câu chỉ có ở bản cổ
 * (Ma-thi-ơ 17:21…) và ở vài chỗ Cựu Ước đánh số theo bản Hê-bơ-rơ (Giô-na 2:1–11). Vì vậy câu cuối
 * chương lấy từ dữ liệu; {@link BibleStructure} chỉ kiểm sách và số chương (hai bên giống nhau).
 */
@Service
public class BiblePassageService {

    /** `to - from` tối đa — đủ cho ngữ cảnh ±2 quanh đoạn 5 câu, chặn đọc cả chương dài. */
    public static final int MAX_SPAN = 29;

    /** Số câu tối đa một khối gộp lùi về trước — đủ cho khối dài nhất của RVV11. */
    static final int MERGE_REACH = 4;

    /** Một câu, hoặc một khối gộp {@code verse..verseEnd} (verseEnd null = một câu). */
    public record VerseText(int verse, Integer verseEnd, String text) {
        public VerseText(int verse, String text) {
            this(verse, null, text);
        }

        public int lastVerse() {
            return verseEnd != null ? verseEnd : verse;
        }
    }

    public record Passage(String version, String book, int chapter, List<VerseText> verses) {}

    /** Một mục của bộ chọn câu: số câu, hoặc khối gộp. */
    public record VerseNumber(int verse, Integer verseEnd) {}

    private final BibleVerseRepository repository;

    public BiblePassageService(BibleVerseRepository repository) {
        this.repository = repository;
    }

    /** True khi đã có chữ của bản dịch đang dùng — FE chỉ hiện lối vào Học Thuộc khi đúng (SPEC_USER §5.1.1). */
    public boolean isTextAvailable() {
        return repository.existsByVersion(BibleVerse.ACTIVE_VERSION);
    }

    /** Các câu (và khối gộp) có chữ trong chương, theo cách đánh số của bản dịch; rỗng nếu chưa import. */
    public List<VerseNumber> chapterVerses(String book, int chapter) {
        validateChapter(book, chapter);
        return repository.findNumbersByVersionAndBookAndChapterOrderByVerseAsc(BibleVerse.ACTIVE_VERSION, book, chapter)
                .stream()
                .map(v -> new VerseNumber(v.getVerse(), v.getVerseEnd()))
                .toList();
    }

    /**
     * Mọi câu/khối giao với {@code from..to}; khối gộp bắt đầu trước {@code from} vẫn được trả nguyên.
     *
     * @throws IllegalArgumentException tham chiếu không hợp lệ (sách lạ, chương/câu ngoài phạm vi, quá dài)
     * @return empty nếu tham chiếu hợp lệ nhưng chưa có chữ (chưa import, hoặc câu bị lược)
     */
    public Optional<Passage> getPassage(String book, int chapter, int from, int to) {
        validate(book, chapter, from, to);
        Integer lastInText = repository.findLastVerse(BibleVerse.ACTIVE_VERSION, book, chapter);
        if (lastInText == null || lastInText < 1) return Optional.empty();
        if (from > lastInText) {
            throw new IllegalArgumentException("Khoảng câu không hợp lệ: " + from + "-" + to);
        }
        // Cắt phần vượt cuối chương thay vì báo lỗi: ngữ cảnh ±2 ở câu cuối chương là chuyện thường.
        int last = Math.min(to, lastInText);
        List<VerseText> verses = repository
                .findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
                        BibleVerse.ACTIVE_VERSION, book, chapter, Math.max(1, from - MERGE_REACH), last)
                .stream()
                .filter(v -> v.getLastVerse() >= from)
                .map(v -> new VerseText(v.getVerse(), v.getVerseEnd(), v.getText()))
                .toList();
        return verses.isEmpty()
                ? Optional.empty()
                : Optional.of(new Passage(BibleVerse.ACTIVE_VERSION, book, chapter, verses));
    }

    static void validateChapter(String book, int chapter) {
        if (!BibleStructure.isKnown(book)) throw new IllegalArgumentException("Sách không hợp lệ: " + book);
        if (chapter < 1 || chapter > BibleStructure.getMaxChapter(book)) {
            throw new IllegalArgumentException("Chương không hợp lệ: " + chapter);
        }
    }

    static void validate(String book, int chapter, int from, int to) {
        validateChapter(book, chapter);
        if (from < 1 || to < from) {
            throw new IllegalArgumentException("Khoảng câu không hợp lệ: " + from + "-" + to);
        }
        if (to - from > MAX_SPAN) throw new IllegalArgumentException("Đoạn quá dài (tối đa " + (MAX_SPAN + 1) + " câu)");
    }
}
