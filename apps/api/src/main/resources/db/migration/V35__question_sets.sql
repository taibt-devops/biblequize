-- Question Sets: named, reusable collections of user questions
CREATE TABLE question_sets (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    user_id     VARCHAR(36)  NOT NULL,
    visibility  ENUM('PRIVATE','PUBLIC') NOT NULL DEFAULT 'PRIVATE',
    question_count INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_qs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ordered items inside a set
CREATE TABLE question_set_items (
    id          VARCHAR(36) NOT NULL PRIMARY KEY,
    set_id      VARCHAR(36) NOT NULL,
    question_id VARCHAR(36) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_qsi_set      FOREIGN KEY (set_id)      REFERENCES question_sets(id)  ON DELETE CASCADE,
    CONSTRAINT fk_qsi_question FOREIGN KEY (question_id) REFERENCES user_questions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_set_question (set_id, question_id)
);

-- Rooms can reference a question set (CUSTOM source)
ALTER TABLE rooms ADD COLUMN question_set_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE rooms ADD CONSTRAINT fk_room_question_set
    FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE SET NULL;

CREATE INDEX idx_question_sets_user    ON question_sets(user_id);
CREATE INDEX idx_question_sets_public  ON question_sets(visibility);
CREATE INDEX idx_qsi_set               ON question_set_items(set_id, order_index);
