# 2026-10-08 — Lữ Khách: code bám đúng mockup đã duyệt (LKF)

> **Source**: user 2026-10-08 sau LKD-21 — "ko đẹp cần design lại", chọn "Giữ Lữ Khách, làm kỹ", ưu tiên Trang chủ + Quiz/kết quả; "mockup thì đẹp mà code ko giống mockup"; biển chỉ đường cần hiệu ứng cho biết bấm được; phần thẻ dưới Trang chủ gom vào tranh · **Mockup**: canvas "BibleQuiz × Lữ Khách" (claude.ai/artifact/PGPt4eys2jWJiKPjNRu4dQ) · **Branch**: `feat/lu-khach-ui`

Nguyên tắc: render artboard ra PNG, đặt cạnh ảnh app cùng khổ (1280 / 390×844), sửa tới khi khớp. Lệch mockup thì ghi ở đây + báo user.

- LKF-1 Khung app theo mockup: menu Trang chủ · Hành trình · Xếp hạng · Nhóm · Cá nhân; chip chuỗi ngày / năng lượng / điểm mùa; avatar tròn nền lá; chuông viền mực; thanh dưới điện thoại
  - Status: [x] DONE · Lệch mockup: giữ chuông thông báo; thanh dưới điện thoại có thêm "Nhóm" (mockup 4 tab); Phòng Chơi vào từ biển chỉ đường
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-2 Mockup mới "mọi thứ trong tranh" cho Trang chủ (đèn lồng nhiệm vụ trên hàng rào, bảng tin thử thách, dải băng câu gốc, cột mốc hành trình, cờ mùa, bảng gỗ xếp hạng) + hiệu ứng biển chỉ đường → user duyệt
  - Status: [ ] TODO
- LKF-3 Code Trang chủ theo mockup LKF-2 (desktop + điện thoại)
  - Status: [ ] TODO · **Spec impact**: [x] None (spec không mô tả bố cục Trang chủ)
- LKF-4 Quiz theo artboard Quiz / QuizPhone (hàng chip trên tranh, 20 chấm + lữ khách, dầu đèn + combo trong cuộn giấy, phản hồi dưới đáp án)
  - Status: [ ] TODO
- LKF-5 Mockup màn Kết quả → user duyệt → code
  - Status: [ ] TODO
- LKF-6 Hành trình theo artboard Journey (trạm sách trên bản đồ, panel chi tiết, 8 vùng, huy hiệu)
  - Status: [ ] TODO
