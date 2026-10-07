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
  - Status: [ ] TODO · Files: `apps/web/index.html`, `apps/web/tailwind.config.js` · Test: Tầng 3 + ảnh chụp
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-2 `tokens.css`: bảng màu, bo góc, bóng cứng, tắt vòm/ánh sáng kính của Khung Sáng
  - Status: [ ] TODO · Files: `apps/web/src/styles/tokens.css` · Test: Tầng 3 + ảnh chụp 10 trang
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-3 CTA vàng: chữ trên `bg-bq-action` đổi sang mực (vàng + chữ trắng không đủ tương phản)
  - Status: [ ] TODO · Files: các file dùng `bg-bq-action` + `text-white` · Test: Tầng 3
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-4 Nền app: body, thanh cuộn, phần global.css còn màu tối
  - Status: [ ] TODO · Files: `apps/web/src/styles/global.css` · Test: Tầng 3
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKD-5 Bộ ảnh Lữ Khách trong `public/images/lk/` (nhân vật, đèn, tim, gươm, cuộn giấy, 6 khiên hạng, 3 tranh nền)
  - Status: [ ] TODO · Files: `apps/web/public/images/lk/*` · Test: —
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)

### Đợt 2 — Component dùng chung
- LKD-6 `ui/Button` kiểu nút ấn được (viền mực, bóng cứng, lún khi bấm)
- LKD-7 `ui/Card` kiểu thẻ dán (viền mực 3px, bóng 6×10)
- LKD-8 `ui/Modal`, `ui/Input`
- LKD-9 Lớp tiện ích `lk-card` / `lk-btn` trong global.css + thay các tổ hợp class thẻ/nút lặp lại ở các trang
  - Mỗi task: Status [ ] TODO · Test: Tầng 3 + ảnh chụp · **Spec impact**: None · **Spec strategy**: (c)

### Đợt 3 — Khung app
- LKD-10 Thanh điều hướng trên (máy tính) + thanh dưới (điện thoại) theo mockup
  - Status: [ ] TODO · Files: `layouts/AppLayout.tsx`, `layouts/components/*` (file nhạy cảm → Tầng 3 ngay)

### Đợt 4 — Quiz và Kết quả
- LKD-11 Câu hỏi trên cuộn giấy + đồng hồ "dầu đèn" + combo gươm + lữ khách đi trên thanh tiến độ
- LKD-12 Nút đáp án kiểu biển gỗ, giữ màu C5; trạng thái đúng/sai
- LKD-13 Bảng phản hồi có lữ khách (nhảy mừng / động viên)
- LKD-14 Màn kết quả: sao, lữ khách

### Đợt 5 — Trang chủ
- LKD-15 Cảnh ngã ba + biển chỉ đường làm lối vào chế độ + bảng chào có khiên hạng
- LKD-16 Thử thách hôm nay, nhiệm vụ dạng đèn lồng, câu gốc trên cuộn giấy, mùa, bảng xếp hạng

### Đợt 6 — Hành trình 66 sách
- LKD-17 Bản đồ vẽ tay 8 vùng đất + trạm sách + thẻ chi tiết
  - **Spec impact**: [x] SPEC_USER §6.3 · **Spec strategy**: [x] (a) update inline

### Đợt 7 — Dọn dẹp
- LKD-18 Admin + các file còn class Sacred Modernist (47 file) → token `bq-*`
- LKD-19 Mã màu viết thẳng ở các file nhiều nhất (RoomAnalytics, GroupDetail, Multiplayer, Home…)
- LKD-20 Trang trống / 404 / lỗi có lữ khách
- LKD-21 Hồi quy toàn bộ + bộ ảnh chụp trước/sau + cập nhật design-system.md
