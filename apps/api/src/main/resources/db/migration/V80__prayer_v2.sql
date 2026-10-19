-- V80: Cầu nguyện bản 2 (forbible-doc docs/cau-nguyen/05-ban-2.md, 03-du-lieu-va-api.md mục "Bản 2").
-- Chỉ thêm cột; status nhận thêm ARCHIVED (cột đã là VARCHAR(10)). Mốc giờ đều là UTC.

ALTER TABLE prayer_items
    ADD COLUMN cadence         VARCHAR(10)  NULL,
    ADD COLUMN topic           VARCHAR(16)  NULL,
    ADD COLUMN updates_json    TEXT         NULL,
    ADD COLUMN share_testimony BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN archived_at     DATETIME(3)  NULL,
    ADD COLUMN source_token    CHAR(22)     NULL,
    ADD COLUMN source_owner    VARCHAR(100) NULL;

ALTER TABLE prayer_intercessions
    ADD COLUMN message         VARCHAR(300) NULL;
