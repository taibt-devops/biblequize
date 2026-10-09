package com.biblequiz.modules.bible.entity;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class BibleVerseTest {

    /** DECISIONS 2026-10-09: Học Thuộc dùng toàn văn RVV11 (thay BTT 1926 tạm dùng từ 15/09). */
    @Test
    void activeVersion_isRvv11() {
        assertEquals("RVV11", BibleVerse.ACTIVE_VERSION);
    }

    @Test
    void idFor_isDeterministicPerReference() {
        String a = BibleVerse.idFor(BibleVerse.ACTIVE_VERSION, "John", 3, 16);
        String b = BibleVerse.idFor(BibleVerse.ACTIVE_VERSION, "John", 3, 16);
        assertEquals(a, b);
        assertEquals(36, a.length());
    }

    @Test
    void idFor_differsByVersionBookChapterVerse() {
        String base = BibleVerse.idFor("RVV11", "John", 3, 16);
        assertNotEquals(base, BibleVerse.idFor("BTT1926", "John", 3, 16));
        assertNotEquals(base, BibleVerse.idFor("RVV11", "Genesis", 3, 16));
        assertNotEquals(base, BibleVerse.idFor("RVV11", "John", 4, 16));
        assertNotEquals(base, BibleVerse.idFor("RVV11", "John", 3, 17));
    }

    @Test
    void constructor_assignsDeterministicId() {
        BibleVerse v = new BibleVerse("RVV11", "John", 43, 3, 16, "fixture text");
        assertEquals(BibleVerse.idFor("RVV11", "John", 3, 16), v.getId());
        assertEquals(43, v.getBookOrder());
        assertEquals("fixture text", v.getText());
    }

    /** Schema lock: test profile chạy H2 không Flyway, nên khoá các ràng buộc cốt lõi trong migration. */
    @Test
    void migrationV72_declaresUniqueRefsAndDueIndex() throws Exception {
        String sql;
        try (InputStream in = getClass().getResourceAsStream(
                "/db/migration/V72__bible_verses_and_memory_verses.sql")) {
            assertNotNull(in, "V72 migration must exist on classpath");
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8).replaceAll("\\s+", " ");
        }
        assertTrue(sql.contains("UNIQUE KEY uk_bv_ref (version, book, chapter, verse)"));
        assertTrue(sql.contains("UNIQUE KEY uk_umv_ref (user_id, version, book, chapter, verse_start, verse_end)"));
        assertTrue(sql.contains("INDEX idx_umv_due (user_id, next_review_at)"));
        assertTrue(sql.contains("REFERENCES users(id) ON DELETE CASCADE"));
    }
}
