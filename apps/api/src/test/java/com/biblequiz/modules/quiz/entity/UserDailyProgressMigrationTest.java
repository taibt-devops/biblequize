package com.biblequiz.modules.quiz.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema-lock for the V71 drift fix. The test profile runs H2 without Flyway, so
 * a missing migration for an entity column is invisible to the normal suite — this
 * guards that the column the entity maps is created, idempotently.
 */
class UserDailyProgressMigrationTest {

    private static String migration() throws IOException {
        try (InputStream in = UserDailyProgressMigrationTest.class.getResourceAsStream(
                "/db/migration/V71__add_asked_question_ids_to_user_daily_progress.sql")) {
            assertNotNull(in, "V71 migration must exist on the classpath");
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).replaceAll("\\s+", " ");
        }
    }

    @Test
    void entityColumnMatchesMigration() throws Exception {
        Column column = UserDailyProgress.class.getDeclaredField("askedQuestionIds").getAnnotation(Column.class);
        assertEquals("asked_question_ids", column.name());
        assertEquals("JSON", column.columnDefinition());
        assertTrue(migration().contains("ADD COLUMN asked_question_ids JSON NULL"));
    }

    @Test
    void migrationIsIdempotentForDatabasesThatAlreadyHaveTheColumn() throws Exception {
        String sql = migration();
        assertTrue(sql.contains("information_schema.columns"), "must check for an existing column first");
        assertTrue(sql.contains("column_name = 'asked_question_ids'"));
        assertTrue(sql.contains("IF(@has_col = 0,"), "ALTER must only run when the column is absent");
    }
}
