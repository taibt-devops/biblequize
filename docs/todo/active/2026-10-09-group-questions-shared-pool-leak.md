# 2026-10-09 — Câu của Nhóm lọt vào kho chung + tên sách sai (GQL)

> **Source**: user 09/10/2026 "46 câu sai tên sách đó hãy sửa tên lại" (phát hiện khi deploy RFR 08/10). · **Scope**: `ChurchGroupController.buildQuestionFromMap`, dữ liệu `questions` trên prod. KHÔNG đổi trình soạn bộ câu Nhóm (vẫn lưu tên sách tiếng Việt, xem `BIBLE_BOOKS_VI`).

Nguyên nhân 46 câu `vi` (và 25 câu `en`) mang tên sách lạ:
- `Song of Solomon` (25 vi + 25 en, `seed:json`): bản cũ trước khi file seed đổi tên sách sang `Song of Songs`; cả 50 câu trùng nguyên văn một câu `Song of Songs` đang bật. Đổi tên sẽ thành câu trùng.
- `Gióp` 16 + `Sáng Thế Ký` 5 (`ai-group` 20, `group-custom` 1): câu riêng của Nhóm. Thiết kế từ 840d8aea là lưu `isActive=false` (ngoài kho chung), nhưng `buildQuestionFromMap` (58c05c7b, trình soạn bộ câu) lại lưu `isActive=true`, nên câu AI sinh / thêm từng câu của Nhóm vào Đấu Hạng + Luyện Tập với tên sách tiếng Việt của trình soạn. Có câu sai nội dung ("Ai là ông Nội chúa Jesus" → "Giô sép", "Gióp 1:1-43" trong khi chương 1 có 22 câu); mọi câu AI có đáp án đúng ở ô A.

### Tasks
- GQL-1 `buildQuestionFromMap` lưu câu Nhóm `isActive=false`
  - Status: [x] DONE · Nhóm vẫn chơi được: tự ôn (`SessionService` customQuestionIds), phòng/quiz hẹn giờ (`RoomQuizService` customQuestionIds), trình soạn (`findAllById`) đều tải theo id, không lọc `isActive` · Test: `ChurchGroupControllerTest` 36/36 (thêm kiểm `ai-generate` + `addQuestionToSet` lưu `isActive=false`)
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- GQL-2 Sửa dữ liệu prod (user duyệt 09/10)
  - Status: [x] DONE 09/10 · sao lưu 71 dòng vào bảng `questions_bak_20261009_bookfix` · tắt 50 câu `Song of Solomon` trùng + 21 câu Nhóm · sau sửa: không còn câu đang bật mang tên sách ngoài 66 tên chuẩn; vi 5.083 câu / 66 sách, en 5.051 / 66
  - Hoàn tác: `UPDATE questions q JOIN questions_bak_20261009_bookfix b ON b.id = q.id SET q.is_active = b.is_active;`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- GQL-3 Deploy BE prod
  - Status: [x] DONE 09/10 · commit `67b6176b`, BE `sha256:80a8662b…` (rollback `sha256:471bfd55…`), API khởi động 5 s, health 200
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
