-- Bible Basics catechism quiz: replaces the XP/practice-accuracy gate for
-- unlocking Ranked mode. A user passes a fixed 10-question doctrinal quiz
-- (≥8/10 = pass) and the unlock is permanent.
--
-- This migration only adds schema. Data (the 10 questions in vi + en) is
-- seeded via JSON files consumed by QuestionSeeder — see CLAUDE.md
-- "Question Seeding (source of truth)" for the canonical pattern.
--
-- Co-existence with the legacy early-Ranked-unlock path (V29 + V30):
-- earlyRankedUnlock / practiceCorrectCount / practiceTotalCount /
-- earlyRankedUnlockedAt are NOT dropped here. The Ranked gate switches
-- to basicQuizPassed in Step 2; legacy fields go dead but remain in the
-- schema until V32 drops them after 1–2 stable production weeks.

-- 1) Track per-user basic quiz state.
ALTER TABLE users
    ADD COLUMN basic_quiz_passed          BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN basic_quiz_passed_at       DATETIME NULL,
    ADD COLUMN basic_quiz_attempts        INT      NOT NULL DEFAULT 0,
    ADD COLUMN basic_quiz_last_attempt_at DATETIME NULL;

-- 2) Categorize questions. NULL = regular question; 'bible_basics' marks
-- the 10 catechism questions that gate Ranked. Indexed because the
-- BasicQuizService loads all 10 by category every time the page mounts.
ALTER TABLE questions
    ADD COLUMN category VARCHAR(50) NULL;

CREATE INDEX idx_questions_category ON questions(category);
