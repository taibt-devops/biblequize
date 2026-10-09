package com.biblequiz.modules.bible.repository;

import com.biblequiz.modules.bible.entity.BibleVerse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BibleVerseRepository extends JpaRepository<BibleVerse, String> {

    /** Số câu (và câu cuối của khối gộp) — không tải chữ. */
    interface VerseNumberView {
        int getVerse();
        Integer getVerseEnd();
    }

    /** Một đoạn liền nhau trong 1 chương, theo thứ tự câu. */
    List<BibleVerse> findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
            String version, String book, int chapter, int verseFrom, int verseTo);

    /** Mọi câu (và khối gộp) của một chương — bộ chọn câu Học Thuộc theo đúng cách đánh số của bản dịch. */
    @Query("select v.verse as verse, v.verseEnd as verseEnd from BibleVerse v "
            + "where v.version = :version and v.book = :book and v.chapter = :chapter order by v.verse")
    List<VerseNumberView> findNumbersByVersionAndBookAndChapterOrderByVerseAsc(
            @Param("version") String version, @Param("book") String book, @Param("chapter") int chapter);

    /** Câu cuối có chữ của chương (kể cả câu cuối của khối gộp); null nếu chưa import. */
    @Query("select max(coalesce(v.verseEnd, v.verse)) from BibleVerse v "
            + "where v.version = :version and v.book = :book and v.chapter = :chapter")
    Integer findLastVerse(@Param("version") String version, @Param("book") String book, @Param("chapter") int chapter);

    /** Importer dùng để bỏ qua sách đã đủ câu. */
    long countByVersionAndBook(String version, String book);

    /** Cổng hiển thị Học Thuộc: đã import chữ cho bản dịch này chưa. */
    boolean existsByVersion(String version);
}
