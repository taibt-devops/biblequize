-- V73: questions.story — the "Dễ cốt lõi" story a question belongs to
--
-- Practice can run one story at a time ("Theo câu chuyện"). The value is the story id
-- from seed/stories/stories.json (e.g. 'no-e-va-tran-lut'); NULL for every question
-- outside that set. QuestionSeeder fills it from seed/questions/easy_core_quiz.json.
--
-- Idempotent like V71: MySQL 8.0 has no ADD COLUMN IF NOT EXISTS, so check
-- information_schema first.

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'questions'
      AND column_name = 'story'
);

SET @ddl := IF(@has_col = 0,
    'ALTER TABLE questions ADD COLUMN story VARCHAR(64) NULL',
    'DO 0');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'questions'
      AND index_name = 'idx_questions_story'
);

SET @ddl := IF(@has_idx = 0,
    'CREATE INDEX idx_questions_story ON questions (story, language)',
    'DO 0');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
