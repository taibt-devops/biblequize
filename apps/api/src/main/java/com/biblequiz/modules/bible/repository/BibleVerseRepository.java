package com.biblequiz.modules.bible.repository;

import com.biblequiz.modules.bible.entity.BibleVerse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BibleVerseRepository extends JpaRepository<BibleVerse, String> {

    /** Một đoạn liền nhau trong 1 chương, theo thứ tự câu. */
    List<BibleVerse> findByVersionAndBookAndChapterAndVerseBetweenOrderByVerseAsc(
            String version, String book, int chapter, int verseFrom, int verseTo);

    /** Importer dùng để bỏ qua sách đã đủ câu. */
    long countByVersionAndBook(String version, String book);
}
