# 2026-10-09 — Trang chủ khách một màn: "ngã ba cho khách" (GCH)

> **Source**: user 09/10/2026: "trang landing tôi muốn nó là 1 màn như trang chủ, khi chưa login thì có giới thiệu 1 vài câu đơn giản về app, và tìm cách dẫn người dùng login vào, hạn chế ảnh hưởng đến SEO" → đề xuất "ngã ba cho khách", user: "ý tưởng quá hay, triển khai thôi". · **Scope**: `GuestScene` + `SceneStage` (tách từ `HomeScene`), `SignBoards` (biển khóa), `SpeechBubble` (chế độ khách), `QuestLanterns` (gợi ý khách), `ScenePanel.GatePanel`, `GoogleSignInButton` + `utils/googleLogin`, `HomeEntry` (định tuyến `/`), `GuestHome`, `AboutPage` (landing cũ → `/gioi-thieu`), `QuizResults` (mời đăng nhập), prerender/sitemap/JSON-LD. KHÔNG đổi trang chủ người chơi (chỉ tách khung dùng chung), không đổi backend.

### Tasks
- GCH-1 Cảnh ngã ba cho khách
  - Status: [x] DONE · `/` cho khách = AppLayout + `GuestHome` (một màn, cùng tranh ngã ba theo giờ) · thẻ chào: H1 duy nhất + 2 câu + Google + "Chơi thử" (`/daily`) · biển Luyện Tập mở; Đấu Hạng/Phòng Chơi/Hành Trình có ổ khóa, bấm mở thẻ đăng nhập (link vẫn thật) · đèn lồng tắt → thẻ đăng nhập "Nhiệm vụ mỗi ngày" · thư bồ câu mở cho khách, nhãn "5 câu" thay XP · lối tắt Giới thiệu/Xếp hạng, hàng link Câu đố/Trợ giúp/Bảo mật/Điều khoản/VI-EN · điện thoại: thẻ chào nằm dưới ảnh, hàng link phải cuộn chút mới thấy (360×740, 390×844) · Test: `GuestScene.test` 10, `GuestRouting.test` 3 (dùng `HomeShell`/`HomeIndex` thật), `HomeScene.test` giữ nguyên 8
  - **Spec impact**: [x] SPEC_USER §2.2
  - **Spec strategy**: [x] (a) update inline
- GCH-2 Dẫn khách đăng nhập
  - Status: [x] DONE · `GoogleSignInButton` (web → `/oauth2/authorization/google`, app → `/login`), `Login.tsx` dùng chung `googleAuthUrl()` · `QuizResults`: khách thấy thẻ "Muốn giữ chuỗi ngày?" (chỉ hứa cho lần chơi sau, lượt khách không được lưu) · đăng xuất về `/` thay `/landing` · Test: `QuizResults.test` +2, `AppLayout.test` sửa 1
  - **Spec impact**: [x] SPEC_USER §2.2
  - **Spec strategy**: [x] (a) update inline
- GCH-3 Giữ SEO
  - Status: [x] DONE · `/` vẫn prerender (`home.html`) với title/description cũ, H1 + giới thiệu + link thật trong HTML · landing dài cũ → `AboutPage` ở `/gioi-thieu` (canonical riêng, prerender, sitemap), không còn tự đẩy người đã đăng nhập về `/` · `/landing` → `Navigate` về `/` (bỏ khỏi prerender) · JSON-LD SoftwareApplication: mô tả có dấu, `operatingSystem` thêm Android · Test: `AboutPage.test` 15
  - **Spec impact**: [x] SPEC_USER §2.2
  - **Spec strategy**: [x] (a) update inline
- GCH-4 Deploy FE + kiểm `home.html` thật
  - Status: [ ] TODO
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Theo dõi sau deploy
- Search Console: so lượt hiển thị/nhấp của `/` 2–4 tuần trước và sau 09/10; theo dõi `/gioi-thieu` được index.
- Tỷ lệ khách bấm Google (thẻ chào, thẻ khóa, màn kết quả) — cần gắn sự kiện nếu muốn đo.
- Giai đoạn 2 (chưa làm): Google One Tap; giữ lượt chơi khách để cộng XP sau khi đăng nhập.
