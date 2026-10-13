-- V79: app Cầu nguyện (doc.forbible.org/cau-nguyen): sổ cầu nguyện, lần cầu nguyện, link nhờ cầu thay, người cầu thay.
-- Chỉ tạo bảng mới (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 2). Mốc giờ đều là UTC.

CREATE TABLE IF NOT EXISTS prayer_items (
    id           CHAR(36)     NOT NULL,
    user_id      VARCHAR(36)  NOT NULL,
    title        VARCHAR(200) NOT NULL,
    detail       TEXT         NULL,
    status       VARCHAR(10)  NOT NULL,
    testimony    TEXT         NULL,
    created_at   DATETIME(3)  NOT NULL,
    answered_at  DATETIME(3)  NULL,
    updated_at   DATETIME(3)  NOT NULL,
    deleted_at   DATETIME(3)  NULL,
    saved_at     DATETIME(3)  NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_prayer_items_user (user_id, updated_at),
    CONSTRAINT fk_prayer_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prayer_prayed (
    id         CHAR(36)    NOT NULL,
    item_id    CHAR(36)    NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    prayed_at  DATETIME(3) NOT NULL,
    saved_at   DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_prayer_prayed_item (item_id, prayed_at),
    INDEX idx_prayer_prayed_user (user_id, prayed_at),
    CONSTRAINT fk_prayer_prayed_item FOREIGN KEY (item_id) REFERENCES prayer_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prayer_shares (
    token       CHAR(22)    NOT NULL,
    item_id     CHAR(36)    NOT NULL,
    user_id     VARCHAR(36) NOT NULL,
    created_at  DATETIME(3) NOT NULL,
    revoked_at  DATETIME(3) NULL,
    PRIMARY KEY (token),
    INDEX idx_prayer_shares_item (item_id),
    INDEX idx_prayer_shares_user (user_id, revoked_at),
    CONSTRAINT fk_prayer_shares_item FOREIGN KEY (item_id) REFERENCES prayer_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prayer_intercessions (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    share_token   CHAR(22)    NOT NULL,
    visitor_id    CHAR(36)    NOT NULL,
    visitor_name  VARCHAR(60) NULL,
    prayed_at     DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_prayer_inter_share (share_token, prayed_at),
    INDEX idx_prayer_inter_visitor (share_token, visitor_id, prayed_at),
    CONSTRAINT fk_prayer_inter_share FOREIGN KEY (share_token) REFERENCES prayer_shares(token) ON DELETE CASCADE
);
