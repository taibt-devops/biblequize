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
- LKF-5 Màn Kết quả (Quiz + Đấu Hạng)
  - Status: [x] DONE · Quiz: đồng cỏ, 3 sao bật lần lượt, lữ khách mừng/đứng, kết quả trên cuộn giấy, số liệu dạng huy chương viền gỗ, biên lai điểm, thanh độ khó gỗ · Đấu Hạng: sân đấu, 3 trạng thái (thường / lên hạng = khiên hạng mới tỏa sáng / hết năng lượng = lữ khách nghỉ), +XP chữ sticker, thanh hạng, 3 huy chương (câu đúng, điểm mùa, năng lượng = tim)
  - Quyết định: không làm mockup riêng (user uỷ quyền tự quyết) — dùng ngôn ngữ của Quiz/Trang chủ; tên sách trên kết quả đổi sang tiếng Việt qua `useBookName`
- LKF-6 Hành trình theo artboard Journey (trạm sách trên bản đồ, panel chi tiết, 8 vùng, huy hiệu)
  - Status: [ ] TODO

### Giai đoạn tự làm toàn bộ màn hình (user 08/10: "list các màn hình ra… design lại và code theo đến khi xong… điều gì cần tôi quyết định bạn cứ tự quyết định")

Hướng thiết kế chung (tự quyết): **mỗi màn là một địa điểm trong thế giới Lữ Khách** — tranh nền vẽ cùng nét (cố định sau nội dung, phủ lớp kem nhẹ để dễ đọc), tiêu đề trên tấm biển gỗ, nội dung trên tấm giấy da viền mực, số liệu dạng huy chương / chip như HUD Trang chủ, nút vàng ấn được. Tranh địa điểm: phòng đọc (Luyện Tập, Học Thuộc, Ôn tập), sân đấu (Đấu Hạng, Giải đấu), nhà bưu điện + chuồng bồ câu (Thử thách hôm nay), quảng trường làng buổi tối (Phòng chơi), gốc sồi cạnh nhà nguyện (Nhóm), đỉnh đồi có bục (Xếp hạng), lều trại lữ khách (Cá nhân, Thành tích, Ngoại hình), cổng làng lúc bình minh (Đăng nhập, Đăng ký, Onboarding), đồng cỏ (Quiz, Kết quả), bản đồ (Hành trình).

| # | Màn hình | Route | Ghi chú |
|---|---|---|---|
| LKF-5 | Kết quả Quiz, Kết quả Đấu Hạng | (cuối `/quiz`) | lữ khách ăn mừng, sao, huy chương số liệu |
| LKF-6 | Hành trình 66 sách | `/journey` | theo artboard Journey đã duyệt (trạm sách trên bản đồ, bảng chi tiết, 8 vùng, huy hiệu) |
| LKF-7 | Bộ "địa điểm" dùng chung ✅ | — | `components/lk/Place.tsx`: `PlaceBackdrop`, `Plaque` (biển gỗ), `ScrollPanel`, `Medal`, `TrackBar` + 8 tranh địa điểm `place-*.webp` |
| LKF-8 | Luyện Tập, Học Thuộc (3 màn), Ôn tập | `/practice`, `/practice/memorize*`, `/review` | phòng đọc |
| LKF-9 | Đấu Hạng, Bài kiểm tra cơ bản | `/ranked`, `/basic-quiz` | sân đấu |
| LKF-10 | Thử thách hôm nay | `/daily` | lá thư bồ câu mang tới |
| LKF-11 | Xếp hạng | `/leaderboard` | đỉnh đồi, bục vinh danh |
| LKF-12 | Cá nhân, Thành tích, Ngoại hình | `/profile`, `/achievements`, `/cosmetics` | lều trại |
| LKF-13 | Phòng chơi, Danh sách phòng, Tạo phòng, Vào phòng | `/multiplayer`, `/rooms`, `/room/create`, `/room/join` | quảng trường làng |
| LKF-14 | Phòng chờ, Chơi phòng, Màn chủ phòng, Phân tích phòng | `/room/:id/*` | quảng trường |
| LKF-15 | Nhóm + chi tiết + trang con | `/groups*` | gốc sồi nhà nguyện |
| LKF-16 | Giải đấu, chi tiết, trận | `/tournaments*` | sân đấu |
| LKF-17 | Đăng nhập, Đăng ký, Onboarding, Thử quiz, Landing, Câu đố Kinh Thánh | `/login`, `/register`, `/onboarding*`, `/landing`, `/cau-do-kinh-thanh` | cổng làng |
| LKF-18 | Chủ đề tuần, Bí ẩn, Tốc độ, Bộ đề của tôi, Trợ giúp, Chính sách, Điều khoản | … | |
| LKF-19 | Admin | `/admin/*` | **giữ dạng công cụ** (đã sang màu Lữ Khách ở LKD-18) — màn làm việc cần gọn, không đưa cảnh game vào |
| LKF-20 | Hồi quy + trang nghiệm thu trước/sau + báo cáo | — | |
