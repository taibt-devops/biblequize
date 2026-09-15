-- V71: Flyway drift fix — user_daily_progress.asked_question_ids
--
-- The entity (UserDailyProgress.askedQuestionIds, JSON list of question ids asked
-- today in Ranked) has used this column for a long time, but no migration ever
-- created it. Environments that ran with `ddl-auto: update` (including prod) got
-- it from Hibernate; a fresh database on `ddl-auto: none` fails every UDP query
-- with "Unknown column 'udp1_0.asked_question_ids'".
--
-- Idempotent: MySQL 8.0 has no ADD COLUMN IF NOT EXISTS, so check
-- information_schema first. Databases that already have the column are untouched.

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_daily_progress'
      AND column_name = 'asked_question_ids'
);

SET @ddl := IF(@has_col = 0,
    'ALTER TABLE user_daily_progress ADD COLUMN asked_question_ids JSON NULL',
    'DO 0');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
