-- V76: app Đọc hằng ngày (doc.forbible.org) — tiến độ đọc trọn Kinh Thánh theo phần.
-- Lịch nằm ở repo forbible-doc; máy chủ chỉ cất tiến độ cả khối (forbible-doc docs/04-kien-truc.md, Bản 2).
-- Mốc giờ đều là UTC.

CREATE TABLE IF NOT EXISTS reading_progress (
    user_id       VARCHAR(36) NOT NULL,
    plan_id       VARCHAR(8)  NOT NULL,
    next_portion  INT         NOT NULL,
    lap           INT         NOT NULL DEFAULT 0,
    started_at    DATETIME(3) NOT NULL,
    last_read_at  DATETIME(3) NULL,
    updated_at    DATETIME(3) NOT NULL,
    saved_at      DATETIME(3) NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_reading_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_log (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    user_id       VARCHAR(36) NOT NULL,
    plan_id       VARCHAR(8)  NOT NULL,
    next_portion  INT         NOT NULL,
    lap           INT         NOT NULL,
    logged_at     DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_reading_log_user_time (user_id, logged_at),
    CONSTRAINT fk_reading_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
