package com.biblequiz.modules.memorize.repository;

import com.biblequiz.modules.memorize.entity.UserMemoryVerse;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema-lock cho các JPQL của Học Thuộc (project chưa có @DataJpaTest — xem
 * UserDailyProgressRepositoryTest). Khoá điều kiện sở hữu + định nghĩa "đến hạn".
 */
class UserMemoryVerseRepositoryTest {

    private String query(String name, Class<?>... types) throws NoSuchMethodException {
        Query q = UserMemoryVerseRepository.class.getMethod(name, types).getAnnotation(Query.class);
        assertNotNull(q, name + " must have @Query");
        return q.value().replaceAll("\\s+", " ");
    }

    @Test
    void findDue_isUserScoped_dueInclusive_oldestFirst() throws Exception {
        String q = query("findDue", String.class, LocalDateTime.class, Pageable.class);
        assertTrue(q.contains("m.user.id = :userId"));
        assertTrue(q.contains("m.nextReviewAt <= :now"));
        assertTrue(q.contains("ORDER BY m.nextReviewAt ASC"));
    }

    @Test
    void countDue_matchesFindDueCondition() throws Exception {
        String q = query("countDue", String.class, LocalDateTime.class);
        assertTrue(q.contains("m.user.id = :userId AND m.nextReviewAt <= :now"));
    }

    @Test
    void findOwned_requiresOwnership() throws Exception {
        assertTrue(query("findOwned", String.class, String.class).contains("m.id = :id AND m.user.id = :userId"));
    }

    @Test
    void existsRef_matchesUniqueKeyColumns() throws Exception {
        String q = query("existsRef", String.class, String.class, String.class, int.class, int.class, int.class);
        for (String col : new String[]{"m.version", "m.book", "m.chapter", "m.verseStart", "m.verseEnd"}) {
            assertTrue(q.contains(col + " = :"), "existsRef must filter on " + col);
        }
    }

    @Test
    void newVerse_isLevelZeroAndDueImmediately() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 15, 8, 0);
        UserMemoryVerse v = new UserMemoryVerse("id-1", null, "BTT1926", "John", 3, 16, 17, now);
        assertEquals(0, v.getMasteryLevel());
        assertTrue(v.isDue(now));
        assertFalse(v.isDue(now.minusSeconds(1)));
    }
}
