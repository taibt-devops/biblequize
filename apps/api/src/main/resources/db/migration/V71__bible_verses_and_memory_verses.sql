-- V71: Học Thuộc câu gốc (SPEC_USER §5.1.1) — toàn văn Kinh Thánh + danh sách
-- câu gốc của từng user kèm lịch ôn giãn cách.
--
-- bible_verses: read-only sau import (BibleTextImporter, gated
-- BIBLE_IMPORT_ENABLED). id = UUID.nameUUIDFromBytes("bible|version|book|
-- chapter|verse") nên import lại là idempotent. `book` dùng English key giống
-- questions.book ("Genesis", "1 Samuel"); book_order 1..66 theo BibleStructure.
--
-- user_memory_verses: 1 dòng = 1 câu hoặc 1 đoạn liền nhau (≤ 5 câu, ràng buộc
-- ở service). Không FK sang bible_verses vì đơn vị là một khoảng câu; service
-- kiểm tra đoạn tồn tại lúc thêm.

CREATE TABLE IF NOT EXISTS bible_verses (
    id          VARCHAR(36) NOT NULL,
    version     VARCHAR(16) NOT NULL,
    book        VARCHAR(40) NOT NULL,
    book_order  INT NOT NULL,
    chapter     INT NOT NULL,
    verse       INT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_bv_ref (version, book, chapter, verse),
    INDEX idx_bv_order (version, book_order, chapter, verse)
);

CREATE TABLE IF NOT EXISTS user_memory_verses (
    id                VARCHAR(36) NOT NULL,
    user_id           VARCHAR(36) NOT NULL,
    version           VARCHAR(16) NOT NULL,
    book              VARCHAR(40) NOT NULL,
    chapter           INT NOT NULL,
    verse_start       INT NOT NULL,
    verse_end         INT NOT NULL,
    mastery_level     INT NOT NULL DEFAULT 0,
    next_review_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at  TIMESTAMP NULL,
    review_count      INT NOT NULL DEFAULT 0,
    lapse_count       INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_umv_ref (user_id, version, book, chapter, verse_start, verse_end),
    INDEX idx_umv_due (user_id, next_review_at),
    CONSTRAINT fk_umv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
