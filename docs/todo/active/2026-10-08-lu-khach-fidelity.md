# 2026-10-08 — Lữ Khách: code bám đúng mockup đã duyệt (LKF)

> **Source**: user 2026-10-08 sau LKD-21 — "ko đẹp cần design lại", chọn "Giữ Lữ Khách, làm kỹ", ưu tiên Trang chủ + Quiz/kết quả; "mockup thì đẹp mà code ko giống mockup"; biển chỉ đường cần hiệu ứng cho biết bấm được; phần thẻ dưới Trang chủ gom vào tranh · **Mockup**: canvas "BibleQuiz × Lữ Khách" (claude.ai/artifact/PGPt4eys2jWJiKPjNRu4dQ) · **Branch**: `feat/lu-khach-ui`

Nguyên tắc: render artboard ra PNG, đặt cạnh ảnh app cùng khổ (1280 / 390×844), sửa tới khi khớp. Lệch mockup thì ghi ở đây + báo user.

- LKF-1 Khung app theo mockup: menu Trang chủ · Hành trình · Xếp hạng · Nhóm · Cá nhân; chip chuỗi ngày / năng lượng / điểm mùa; avatar tròn nền lá; chuông viền mực; thanh dưới điện thoại
  - Status: [x] DONE · Lệch mockup: giữ chuông thông báo; thanh dưới điện thoại có thêm "Nhóm" (mockup 4 tab); Phòng Chơi vào từ biển chỉ đường
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-2 Mockup Trang chủ "cả trang là một cảnh game" — v2 → v3 → v4 "biển gỗ sống" (user góp ý từng vòng, duyệt v4 "v4 ok rồi bạn triển khai code đi")
  - Status: [x] DONE · artboard `HomeSceneV4*` trên canvas
- LKF-3 Code Trang chủ theo v4 (desktop + điện thoại + sáng/hoàng hôn/đêm)
  - Status: [x] DONE · `components/home/scene/*` (sceneData, SignBoards, PlayerPlate, QuestLanterns, SceneDove, SceneDecor, HomeHud, ScenePanel, HomeScene) + `pages/Home.tsx` chỉ còn lấy dữ liệu
  - Ảnh mới: tranh cột trơn sáng/hoàng hôn/đêm + bản nối rộng 3:1 (vẽ nối 2 bên bằng Game Asset Studio, ghép mép mờ dần), 2 tấm biển gỗ rời, bàn tay hướng dẫn, bồ câu bay / bồ câu đậu, icon bản đồ / cúp
  - Quyết định khi code (khác mockup):
    - Theo góp ý giữa chừng "2 khoảng trống 2 bên… để full": desktop full bề ngang, cảnh cao bằng màn hình, hai bên là tranh vẽ nối dài; bảng tên + icon bám góc màn hình
    - Thưởng thử thách hiện +150 XP (giá trị thật `DailyChallengeService`, mockup ghi +50)
    - Làm xong thử thách: bồ câu đậu trên đầu cột kèm thư đã mở (bấm = xem lại); bong bóng quay về "Hôm nay đi lối nào đây?"
    - Điện thoại: bong bóng chỉ còn nút "Mở thư · +150 XP" (dòng chữ đẩy bong bóng đè lên biển "Phòng Chơi" ở máy 360px)
    - Không còn tên người trên Trang chủ: icon Xếp hạng chỉ mang huy hiệu "#hạng" (ẩn khi < 10 người chơi tuần — LBF-11)
    - Câu gốc: cuộn giấy có nút Nghe (Web Speech, chỉ hiện khi trình duyệt hỗ trợ), Học thuộc, và "Ôn N câu đến hạn" khi có câu đến hạn (thay thẻ MemoryDueCard — spec §5.1.1 cập nhật)
    - Lần đầu vào (0 XP, 0 chuỗi, chưa làm thử thách): bàn tay hướng dẫn chạm biển Luyện Tập
  - **Spec impact**: [x] SPEC_USER §5.1.1 (lối vào Học Thuộc trên Home) · **Spec strategy**: [x] (a) update inline
- LKF-4 Quiz theo artboard Quiz / QuizPhone (hàng chip trên tranh, 20 chấm + lữ khách, dầu đèn + combo trong cuộn giấy, phản hồi dưới đáp án)
  - Status: [x] DONE · Lệch mockup: giữ badge "✓ ĐÚNG · BẠN CHỌN" (test khoá, giúp người mù màu) + nhãn độ khó cạnh tham chiếu; quiz > 20 câu dùng thanh thay chấm
  - Sửa kèm: `.group:hover { box-shadow:none !important }` (tắt quầng đáp án + bóng nút khi rê chuột), `:root`/`select` color-scheme dark → light, `quiz.correctAnswerIs` thiếu đáp án (thay bằng `quiz.lk.correctIs`)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-5 Mockup màn Kết quả → user duyệt → code
  - Status: [ ] TODO
- LKF-6 Hành trình theo artboard Journey (trạm sách trên bản đồ, panel chi tiết, 8 vùng, huy hiệu)
  - Status: [ ] TODO
