package com.biblequiz.modules.bible.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import static org.junit.jupiter.api.Assertions.*;

/** Schema-lock cho JPQL của BibleVerseRepository (project chưa có @DataJpaTest). */
class BibleVerseRepositoryTest {

    @Test
    void findChapterRange_isVersionBookScoped_orderedByChapterThenVerse() throws Exception {
        Query q = BibleVerseRepository.class
                .getMethod("findChapterRange", String.class, String.class, int.class, int.class)
                .getAnnotation(Query.class);
        assertNotNull(q);
        String s = q.value().replaceAll("\s+", " ");
        assertTrue(s.contains("v.version = :version and v.book = :book"));
        assertTrue(s.contains("v.chapter between :fromChapter and :toChapter"));
        assertTrue(s.endsWith("order by v.chapter, v.verse"));
    }
}
