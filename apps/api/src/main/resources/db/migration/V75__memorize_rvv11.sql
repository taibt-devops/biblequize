-- V75: Học Thuộc chuyển từ Bản Truyền Thống 1926 sang Bản Truyền Thống Hiệu Đính 2010 (RVV11)
--
-- DECISIONS 2026-10-09: Học Thuộc dùng toàn văn RVV11 (user đã xác nhận quyền dùng nguyên văn,
-- DECISIONS 2026-09-15 D2). BibleVerse.ACTIVE_VERSION = 'RVV11'; seed ở seed/bible/rvv11/.
--
-- RVV11 gộp vài câu thành một khối ("Phục Truyền Luật Lệ Ký 13:17-18"): khối lưu ở câu đầu,
-- bible_verses.verse_end = câu cuối (NULL = một câu). Idempotent như V73.
--
-- Danh sách câu gốc của người dùng giữ nguyên địa chỉ (sách/chương/câu) và lịch ôn, chỉ đổi bản:
-- chữ hiển thị đổi theo RVV11. Hàng trùng địa chỉ với một hàng RVV11 sẵn có thì bỏ (UPDATE IGNORE
-- để lại nó ở BTT1926, rồi xóa). Văn bản 1926 trong bible_verses không còn ai đọc nên xóa.

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'bible_verses'
      AND column_name = 'verse_end'
);

SET @ddl := IF(@has_col = 0,
    'ALTER TABLE bible_verses ADD COLUMN verse_end INT NULL AFTER verse',
    'DO 0');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE IGNORE user_memory_verses SET version = 'RVV11' WHERE version = 'BTT1926';
DELETE FROM user_memory_verses WHERE version = 'BTT1926';
DELETE FROM bible_verses WHERE version = 'BTT1926';
