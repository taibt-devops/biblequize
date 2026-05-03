-- Personal question bank for users (AI-generated or manual)
CREATE TABLE user_questions (
    id                VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id           VARCHAR(36)   NOT NULL,
    content           TEXT          NOT NULL,
    options           JSON          NOT NULL COMMENT '["A","B","C","D"]',
    correct_answer    INT           NOT NULL COMMENT '0-based index',
    difficulty        VARCHAR(20)   NOT NULL DEFAULT 'MIXED',
    book              VARCHAR(100)  NULL,
    chapter_start     INT           NULL,
    chapter_end       INT           NULL,
    verse_start       INT           NULL,
    verse_end         INT           NULL,
    theme             VARCHAR(255)  NULL,
    source            VARCHAR(20)   NOT NULL DEFAULT 'MANUAL' COMMENT 'AI | MANUAL',
    language          VARCHAR(10)   NOT NULL DEFAULT 'vi',
    explanation       TEXT          NULL,
    created_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_uq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_uq_user_id (user_id),
    INDEX idx_uq_user_difficulty (user_id, difficulty),
    INDEX idx_uq_user_book (user_id, book)
);

-- Questions selected for a specific room (ordered set)
CREATE TABLE room_question_selections (
    id               VARCHAR(36) NOT NULL PRIMARY KEY,
    room_id          VARCHAR(36) NOT NULL,
    user_question_id VARCHAR(36) NOT NULL,
    order_index      INT         NOT NULL DEFAULT 0,
    CONSTRAINT fk_rqs_room     FOREIGN KEY (room_id)          REFERENCES rooms(id)          ON DELETE CASCADE,
    CONSTRAINT fk_rqs_question FOREIGN KEY (user_question_id) REFERENCES user_questions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_rqs_room_question (room_id, user_question_id),
    INDEX idx_rqs_room (room_id)
);

-- Add question source to rooms
ALTER TABLE rooms
    ADD COLUMN question_source VARCHAR(20) NOT NULL DEFAULT 'DATABASE'
        COMMENT 'DATABASE | CUSTOM'
        AFTER book_scope;
