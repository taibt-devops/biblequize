# 2026-10-24 — Đổi giao diện cả hệ forbible sang phong cách Funny Hour

> **Source**: chủ dự án 24/10/2026: "giao diện lỗi quá tròi", "nhìn trang chủ rối quá"; một bạn trẻ chê "khó hiểu, kiểu con nít". Chốt theo funny-hour.infaxia.io, quyết định ở `DECISIONS.md` (2026-10-24).
> **Scope**: `apps/web` (mọi màn người dùng; admin chỉ đổi token) và `forbible-home`; sau đó app Đọc hằng ngày và Cầu nguyện (doc.forbible.org). Thiết kế + mockup: `docs/designs/2026-10-24-forbible-funny-hour/`.
> **Trạng thái**: chưa bắt đầu. Chủ dự án sẽ làm sau ("rảnh tôi làm sau").

### Tasks

- FHS-0 Chốt 4 câu hỏi mở (README mục "Còn phải chốt khi bắt tay làm") và viết spec token + thành phần thay `docs/dev/design-system.md`
  - Status: [ ] TODO · Files: `docs/dev/design-system.md`, `docs/designs/2026-10-24-forbible-funny-hour/README.md` · Test: —
  - **Spec impact**: [x] None [ ] SPEC_USER §X [ ] SPEC_ADMIN §X [ ] SPEC_GROUP §X [ ] SPEC_MULTIPLAYER §X [ ] BL-N
  - **Spec strategy**: [ ] (a) update inline [ ] (b) new BL-N [x] (c) [no-spec-impact]
  - Checklist: impl · spec/BACKLOG updated · commit

- FHS-1 Token và font: đổi giá trị `--bq-*` (+ kênh `-rgb`) theo bảng token, nạp Unbounded + Plus Jakarta Sans, bỏ Baloo 2 và Be Vietnam Pro
  - Status: [ ] TODO · Files: `apps/web/src/styles/tokens.css`, `apps/web/tailwind.config.js`, `apps/web/index.html` / `public/load-fonts.js` · Test: Vitest + `pnpm build` + ảnh chụp 360/393/768/1280
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: impl · Tầng 1+2+3 pass · `audit.sh` no NEW broken · commit

- FHS-2 Khung app: thanh trên, thanh dưới, `AppLayout`; bỏ nền tranh "địa điểm" (`components/lk/Place.tsx`)
  - Status: [ ] TODO · Files: `layouts/AppLayout.tsx` (file nhạy cảm → Tầng 3 ngay), `layouts/components/*`, `components/lk/*` · Test: Vitest layout + E2E smoke
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
  - Checklist: impl · Tầng 1+2+3 pass · commit

- FHS-3 Trang chủ người chơi và trang chủ khách theo mockup; xóa `components/home/scene/` (nguồn lỗi đè chữ trên điện thoại)
  - Status: [ ] TODO · Files: `pages/Home.tsx`, `pages/GuestHome.tsx`, `components/home/scene/*` · Test: viết lại `Home.test.tsx`, `GuestScene.test.tsx`; E2E dùng `data-testid` `home-scene`, `home-mode-*`, `featured-daily-cta` phải sửa theo
  - **Spec impact**: [x] None (giữ đủ lối vào: Thử thách hôm nay, 4 cách chơi, nhiệm vụ, chuỗi, năng lượng, mùa) · **Spec strategy**: [x] (c)
  - Checklist: impl · Tầng 1+2+3 pass · ảnh chụp 360/393/768/1280 không đè · commit

- FHS-4 Quiz và Kết quả: thẻ đáp án trắng + ô chữ cái nền nhạt màu C5, thanh tiến độ cam, cúp/lửa 3D ở màn thắng
  - Status: [ ] TODO · Files: `pages/Quiz.tsx`, màn kết quả · Test: Vitest Quiz + E2E chơi 10 câu
  - **Spec impact**: [x] None (C5 giữ đúng hex) · **Spec strategy**: [x] (c)
  - Checklist: impl · Tầng 1+2+3 pass · commit

- FHS-5 Các màn còn lại (Luyện Tập, Đấu Hạng, Phòng Chơi + sảnh/màn chơi phòng, Hành Trình, Xếp hạng, Nhóm, Cá nhân, Học Thuộc, Giải đấu, trang pháp lý…): chia nhỏ thành từng task khi tới lượt
  - Status: [ ] TODO

- FHS-6 Hình 3D: Fluent Emoji 3D (thêm LICENSE MIT, tải về `public/images/`, không gọi CDN lúc chạy), hoặc bộ linh vật riêng vẽ bằng Game Asset Studio
  - Status: [ ] TODO · Phụ thuộc FHS-0

- FHS-7 `forbible-home`: trang chủ theo mockup (bản máy tính + điện thoại); sửa quy tắc "Giao diện theo bộ Lữ Khách" trong `forbible-home/CLAUDE.md` và `docs/quyet-dinh.md`
  - Status: [ ] TODO · Repo khác: `taibt-devops/forbible-home`

- FHS-8 App Đọc hằng ngày và Cầu nguyện (doc.forbible.org) theo màn mẫu trong mockup; vẫn không điểm, không xếp hạng
  - Status: [ ] TODO · Repo khác: `taibt-devops/forbible-doc`

- FHS-9 Dọn: xóa ảnh và thành phần Lữ Khách không còn dùng, cập nhật `CLAUDE.md` (Definition of Done đang nhắc "design tokens Lữ Khách"), lưu trữ task này
  - Status: [ ] TODO
