-- V74: tên sách tiếng Việt theo Bản Truyền Thống Hiệu Đính 2010 (RVV11)
--
-- Câu hỏi mới (bộ Dễ cốt lõi, bộ RVV11 theo sách) trích RVV11 và ghi tên sách theo bản nầy.
-- Bảng books còn hai tên của bản 1925: Xuất Ê-díp-tô Ký, Ê-xơ-ra. RVV11 viết "Xuất Ai Cập Ký"
-- và "E-xơ-ra" (đối chiếu VIE2010 trên bible.com, cùng nguyên văn với RVV11). Công Vụ Các Sứ Đồ
-- đã đúng trên prod nhưng còn là "Công Vụ" trong R__data.sql, nên đặt lại cho mọi môi trường.
--
-- Cập nhật theo cột name (khóa duy nhất uk_name), nên đúng cho cả id '02' (V1) lẫn 'book-002'
-- (R__data). Không sửa R__data.sql: file repeatable đổi checksum sẽ chạy lại trên prod.

UPDATE books SET name_vi = 'Xuất Ai Cập Ký'    WHERE name = 'Exodus';
UPDATE books SET name_vi = 'E-xơ-ra'           WHERE name = 'Ezra';
UPDATE books SET name_vi = 'Công Vụ Các Sứ Đồ' WHERE name = 'Acts';
