package com.biblequiz.modules.quiz.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema-lock tests for the leaderboard native SQL queries.
 *
 * <p>Reads each {@link Query} annotation via reflection and asserts the
 * value contains the PL-2 tie-break clause {@code ORDER BY points DESC,
 * questions DESC, u.created_at ASC}. This is a regression guard — it
 * does <em>not</em> exercise the SQL against a live database, since the
 * project has no Testcontainers / @DataJpaTest infrastructure yet (see
 * QuestionSeederTest comment). Adding that infra is out of pre-launch
 * scope; the lock test is still valuable because it makes an accidental
 * rollback of the tie-break clause fail loudly.
 *
 * <p>Runtime correctness is verified manually post-deploy and by the
 * deferred E2E suite W-M17 (see {@code tests/e2e/TC-TODO.md}).
 */
class UserDailyProgressRepositoryTest {

    private String getQuery(String methodName, Class<?>... paramTypes) throws NoSuchMethodException {
        Method m = UserDailyProgressRepository.class.getMethod(methodName, paramTypes);
        Query q = m.getAnnotation(Query.class);
        assertNotNull(q, "Method " + methodName + " must have @Query annotation");
        return q.value();
    }

    @Test
    void findDailyLeaderboard_orderByIncludesTieBreakColumns() throws Exception {
        String sql = getQuery("findDailyLeaderboard", java.time.LocalDate.class, int.class, int.class);
        assertOrderByTieBreak(sql, "findDailyLeaderboard");
    }

    @Test
    void findWeeklyLeaderboard_orderByIncludesTieBreakColumns() throws Exception {
        String sql = getQuery("findWeeklyLeaderboard",
                java.time.LocalDate.class, java.time.LocalDate.class, int.class, int.class);
        assertOrderByTieBreak(sql, "findWeeklyLeaderboard");
    }

    @Test
    void findWeeklyLeaderboard_groupByIncludesCreatedAt() throws Exception {
        // u.created_at must appear in GROUP BY so that ORDER BY u.created_at
        // is valid under MySQL's only_full_group_by mode.
        String sql = getQuery("findWeeklyLeaderboard",
                java.time.LocalDate.class, java.time.LocalDate.class, int.class, int.class);
        assertTrue(sql.contains("GROUP BY u.id, u.name, u.avatar_url, u.created_at"),
                "findWeeklyLeaderboard GROUP BY must include u.created_at; was:\n" + sql);
    }

    @Test
    void findAllTimeLeaderboard_orderByIncludesTieBreakColumns() throws Exception {
        String sql = getQuery("findAllTimeLeaderboard", int.class, int.class);
        assertOrderByTieBreak(sql, "findAllTimeLeaderboard");
    }

    @Test
    void findAllTimeLeaderboard_groupByIncludesCreatedAt() throws Exception {
        String sql = getQuery("findAllTimeLeaderboard", int.class, int.class);
        assertTrue(sql.contains("GROUP BY u.id, u.name, u.avatar_url, u.created_at"),
                "findAllTimeLeaderboard GROUP BY must include u.created_at; was:\n" + sql);
    }

    private void assertOrderByTieBreak(String sql, String methodName) {
        // Match the canonical tie-break clause; whitespace tolerant.
        String normalized = sql.replaceAll("\\s+", " ");
        assertTrue(
                normalized.contains("ORDER BY points DESC, questions DESC, u.created_at ASC"),
                methodName + " must use tie-break ORDER BY (points DESC, questions DESC, u.created_at ASC); was:\n" + sql
        );
    }
}
