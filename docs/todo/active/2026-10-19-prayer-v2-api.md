# API Cầu nguyện bản 2 (doc.forbible.org/cau-nguyen) — PRA-7..11

Spec ở repo forbible-doc: `docs/cau-nguyen/05-ban-2.md` (phân tích nghiệp vụ, thiết kế lại; chủ dự án giao Claude tự quyết 19/10/2026), `02-trai-nghiem.md`, `03-du-lieu-va-api.md` mục "Bản 2". Kế hoạch: `forbible-doc/docs/superpowers/plans/2026-10-19-cau-nguyen-ban-2.md`, Task 1–5.

- PRA-7 V80 (chỉ thêm cột) và đọc trường bản 2: nhịp `DAILY`, 7 mục, tin mới ≤ 20 × 500, `ARCHIVED`, lời nhờ của người khác (`sourceToken`, `sourceOwner`), lời nhắn ≤ 300; payload thiếu khóa `updates` (app bản 1) thì `v2 = null` — Status: [x] DONE
- PRA-8 Lưu trường bản 2 (thiếu `updates` thì giữ trường bản 2 trên máy chủ; bia mộ xóa sạch); không tạo link cho điều đã cất hay lời nhờ của người khác — Status: [ ] TODO
- PRA-9 Lời nhắn của người cầu thay (cùng máy trong 12 giờ thì cập nhật tên và lời nhắn); trang công khai có mục, tin mới, lời chứng khi được cho đọc; link kèm 3 người cầu thay gần nhất — Status: [ ] TODO
- PRA-10 JSON bản 2 của hai controller — Status: [ ] TODO
- PRA-11 Cả bộ test, boot jar thật + smoke bản 2, deploy prod cùng app — Status: [ ] TODO
