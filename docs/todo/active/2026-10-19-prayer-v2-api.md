# API Cầu nguyện bản 2 (doc.forbible.org/cau-nguyen) — PRA-7..11

Spec ở repo forbible-doc: `docs/cau-nguyen/05-ban-2.md` (phân tích nghiệp vụ, thiết kế lại; chủ dự án giao Claude tự quyết 19/10/2026), `02-trai-nghiem.md`, `03-du-lieu-va-api.md` mục "Bản 2". Kế hoạch: `forbible-doc/docs/superpowers/plans/2026-10-19-cau-nguyen-ban-2.md`, Task 1–5.

- PRA-7 V80 (chỉ thêm cột) và đọc trường bản 2: nhịp `DAILY`, 7 mục, tin mới ≤ 20 × 500, `ARCHIVED`, lời nhờ của người khác (`sourceToken`, `sourceOwner`), lời nhắn ≤ 300; payload thiếu khóa `updates` (app bản 1) thì `v2 = null` — Status: [x] DONE
- PRA-8 Lưu trường bản 2 (thiếu `updates` thì giữ trường bản 2 trên máy chủ; bia mộ xóa sạch); không tạo link cho điều đã cất hay lời nhờ của người khác — Status: [x] DONE
- PRA-9 Lời nhắn của người cầu thay (cùng máy trong 12 giờ thì cập nhật tên và lời nhắn); trang công khai có mục, tin mới, lời chứng khi được cho đọc; link kèm 3 người cầu thay gần nhất — Status: [x] DONE
- PRA-10 JSON bản 2 của hai controller — Status: [x] DONE
- PRA-11 Cả bộ test (1.539, 0 lỗi), boot jar thật trên DB trống (Flyway tới V80, 0 ERROR) + smoke bản 2 (18/18) — Status: [x] DONE; deploy prod cùng app: [x] DONE

Sau review toàn nhánh (19/10): `sourceOwner` dài hơn 100 ký tự thì cắt còn 100 ký tự thật thay vì trả 400 cho cả lượt PUT (users.name cho 255) — test `items_sourceOwnerTooLong_isCutTo100Characters`; cả bộ 1.582 test, 0 lỗi; smoke jar thật 19/19.

Lên prod 20/10/2026 00:57: image `taibt2docker/biblequiz-be:ce4c0cbb` (= latest, `sha256:e9c68b01…`), Flyway V80 thành công, health 200, 0 ERROR, bảng `prayer_*` utf8mb4. Dump trước migrate: `/home/cura/backups/biblequiz/biblequiz-20261020-0056-pre-v80.sql.gz` (chmod 600). Lùi: `biblequiz-be@sha256:b5c8e9eb…` (V80 chỉ thêm cột cho phép rỗng hoặc có mặc định; Flyway bỏ qua migration mới hơn mã nên bản cũ vẫn khởi động). Giao diện `forbible-doc:3e39be7` lên cùng lúc.
