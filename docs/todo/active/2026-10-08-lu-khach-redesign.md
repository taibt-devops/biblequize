# 2026-10-08 — Đổi giao diện toàn app sang phong cách Lữ Khách (LKD)

> **Source**: user 2026-10-08 — "bible quiz đổi lại style giao diện theo game lữ khách", chọn phương án A (đổi toàn bộ), duyệt mockup canvas "BibleQuiz × Lữ Khách" và yêu cầu "triển khai luôn" · **Scope**: apps/web (tokens, fonts, global CSS, shared components, layout, Quiz, Home, Journey, admin) + docs · **Decision**: DECISIONS.md 2026-10-08 · **Branch**: `feat/lu-khach-ui`

Nguyên tắc: tên token `--bq-*` giữ nguyên, chỉ đổi giá trị (đợt 1 phủ ~90% app). Mỗi task < 100 LOC, 1 commit. Ảnh vẽ bằng Game Asset Studio (style "Lữ Khách"), nén WebP, đặt ở `apps/web/public/images/lk/`.

### Đợt 0 — Quyết định và tài liệu
- LKD-0 DECISIONS.md + `docs/dev/design-system.md` (Lữ Khách) + file task này + TODO index
  - Status: [x] DONE · Files: `DECISIONS.md`, `docs/dev/design-system.md`, `TODO.md`, file này · Test: —
  - **Spec impact**: [x] None (spec 8 vùng làm ở LKD-17)
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Đợt 1 — Nền tảng (token, font, ảnh)
- LKD-1 Font Baloo 2 (index.html + Tailwind `fontFamily`); Be Vietnam Pro chuyển thành `font-read`
  - Status: [x] DONE (2e71cf89) · Files: `apps/web/index.html`, `apps/web/tailwind.config.js` · Test: Tầng 3 + ảnh chụp
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-2 `tokens.css`: bảng màu, bo góc, bóng cứng, tắt vòm/ánh sáng kính của Khung Sáng
  - Status: [x] DONE (0d66cf6a) · Files: `apps/web/src/styles/tokens.css` · Test: Tầng 3 + ảnh chụp 10 trang
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-3 CTA vàng: chữ trên `bg-bq-action` đổi sang mực (vàng + chữ trắng không đủ tương phản)
  - Status: [x] DONE (6111c3c5 + 7b77ed0d) · Files: các file dùng `bg-bq-action` + `text-white` · Test: Tầng 3
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-4 Nền app: body, thanh cuộn, phần global.css còn màu tối
  - Status: [x] DONE (50800a57) · Files: `apps/web/src/styles/global.css` · Test: Tầng 3
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-5 Bộ ảnh Lữ Khách trong `public/images/lk/` (nhân vật, đèn, tim, gươm, cuộn giấy, 6 khiên hạng, 3 tranh nền)
  - Status: [x] DONE (6536b7b1) · Files: `apps/web/public/images/lk/*` · Test: —
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)

### Đợt 2 — Component dùng chung
- LKD-6 `ui/Button` kiểu nút ấn được (viền mực, bóng cứng, lún khi bấm)
- LKD-7 `ui/Card` kiểu thẻ dán (viền mực 3px, bóng 6×10)
- LKD-8 `ui/Modal`, `ui/Input`
- LKD-9 Lớp tiện ích `lk-card` / `lk-btn` trong global.css + thay các tổ hợp class thẻ/nút lặp lại ở các trang
  - Status: [x] DONE (LKD-6..8 241107fc · LKD-9 8798103b) · Test: Tầng 3 + ảnh chụp · **Spec impact**: None · **Spec strategy**: (c)

### Đợt 3 — Khung app
- LKD-10 Thanh điều hướng trên (máy tính) + thanh dưới (điện thoại) theo mockup
  - Status: [x] DONE (0f921ab0) · Files: `layouts/AppLayout.tsx`, `layouts/components/*` (file nhạy cảm → Tầng 3 ngay)

### Đợt 4 — Quiz và Kết quả
- LKD-11 Câu hỏi trên cuộn giấy + đồng hồ "dầu đèn" + combo gươm + lữ khách đi trên thanh tiến độ
- LKD-12 Nút đáp án kiểu biển gỗ, giữ màu C5; trạng thái đúng/sai
- LKD-13 Bảng phản hồi có lữ khách (nhảy mừng / động viên)
- LKD-14 Màn kết quả: sao, lữ khách
  - Status: [x] DONE (LKD-11 5ce24cfd + e8237f28 · LKD-12 04989e0d · LKD-13 63526a90 · LKD-14 34056e76) · **Spec impact**: None

### Đợt 5 — Trang chủ
- LKD-15 Cảnh ngã ba + biển chỉ đường làm lối vào chế độ + bảng chào có khiên hạng
- LKD-16 Thử thách hôm nay, nhiệm vụ dạng đèn lồng, câu gốc trên cuộn giấy, mùa, bảng xếp hạng
  - Status: [x] DONE (LKD-15 1bd3b639 · LKD-16 1cd78b45 + af658df9) · Ghi chú: KHÔNG thêm thẻ Hành trình ở trang chủ vì Home.test khoá không có `home-journey`; lối vào Hành trình là biển chỉ đường thứ 4 · **Spec impact**: None

### Đợt 6 — Hành trình 66 sách
- LKD-17 Bản đồ vẽ tay 8 vùng đất + trạm sách + thẻ chi tiết
  - Status: [x] DONE (b8ae53aa) · Bản đồ hiện 8 vùng đất (không vẽ trạm cho từng sách); sách xếp theo vùng bên dưới, giữ mọi testid E2E
  - **Spec impact**: [x] SPEC_USER §6.3 · **Spec strategy**: [x] (a) update inline

### Đợt 7 — Dọn dẹp
- LKD-18 Admin + các file còn class Sacred Modernist → màu Lữ Khách
  - Status: [x] DONE (2823aa25 palette cũ trỏ sang Lữ Khách · 01e0c631 admin 14 trang + `--hp-*` + `index.html` body mực + manifest)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-19 Mã màu viết thẳng còn sót + opacity cho token bq
  - Status: [x] DONE (f7bcc7c6) · Gồm: hex Khung Sáng ở ~69 file, kênh RGB `--bq-*-rgb` (613 class `bq-*/NN` trước đây không sinh CSS), màu hạng, bục xếp hạng, thanh gỗ, chữ sticker thay chữ gradient
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-20 Trang trống / 404 / lỗi có lữ khách
  - Status: [x] DONE (6d32e9c5) · Ảnh mới `hero-lost.webp`, `hero-rest.webp` (Game Asset Studio #166, #165)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-21 Hồi quy toàn bộ + ảnh chụp + cập nhật design-system.md
  - Status: [x] DONE · Vitest 168 file / 1494 test; validate:i18n 1137 (main 1145)
  - E2E smoke local (166 test, stack `bqlk`): nhánh 69 pass / 81 fail / 16 skip; `main` cùng stack 68 / 82 / 16. 81 test fail trên nhánh đều fail y hệt trên `main` (nợ sẵn có của bộ test: activity log admin, `toHaveCount({min})`, selector cũ…) ⇒ redesign không gây hồi quy E2E. Lưu ý: rate limit mặc định 1000 req/giờ/IP làm login 429 ⇒ phải nâng `APP_RATE_LIMIT_*` khi chạy E2E local
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)

### Còn lại (chưa làm, ngoài phạm vi đợt này)
- Ảnh splash Capacitor + `SplashScreen.backgroundColor` (`#11131e`) — cần vẽ lại splash rồi đổi màu cùng lúc.
- Font số `font-mono` (Orbitron) ở admin và vài chỗ khác.
- Nhãn chữ in hoa giãn chữ (eyebrow) còn ở nhiều trang.
- Code chết vẫn còn style cũ: `GameModeGrid`, `FeaturedCard`, `HeroRankedCard`, `HomeBanner`, `VerseFooter`, các class `*.module.css` không dùng.
