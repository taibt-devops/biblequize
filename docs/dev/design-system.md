# Design System — "Lữ Khách"

> Thay "Khung Sáng" và "Sacred Modernist" từ 2026-10-08 (DECISIONS.md). Referenced from CLAUDE.md §References.
> Nguồn thiết kế: mockup canvas "BibleQuiz × Lữ Khách" (https://claude.ai/artifact/PGPt4eys2jWJiKPjNRu4dQ) + file này.
> Stitch MCP không còn là nguồn thiết kế. Thay đổi → update file này, KHÔNG add lại vào CLAUDE.md.

## Nhận diện (giữ đúng 5 điều này là ra "Lữ Khách")

1. **Giấy kem + viền mực:** mọi khối nội dung là thẻ giấy kem, viền mực 3px, góc bo lớn.
2. **Bóng cứng:** bóng lệch, không nhoè (`6px 10px 0` cho thẻ, `0 6px 0` cho nút). Không dùng bóng mờ phát sáng.
3. **Nút ấn được:** bấm thì nút lún xuống 4px, bóng ngắn lại.
4. **Tranh vẽ truyện:** nền các màn chính là tranh vẽ cùng nét với game Lữ Khách (Game Asset Studio, style "Lữ Khách").
5. **Ẩn dụ hành trình:** lữ khách là linh vật; nhiệm vụ là đèn lồng; tiến trình là con đường; Lời Chúa là gươm.

## Design tokens (`src/styles/tokens.css`, dùng qua `var(--bq-*)` hoặc Tailwind `bq-*`)

Tên token giữ từ Khung Sáng, giá trị đổi sang Lữ Khách.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bq-paper` | `#EFE3C3` (da dê) | nền trang |
| `--bq-white` | `#FFF8E7` (giấy kem) | mặt thẻ, bảng |
| `--bq-paper-sunk` | `#F3E6C4` | track, chip nền, ô nhập |
| `--bq-hairline` | `#C9B58C` | đường kẻ phân cách mảnh bên trong thẻ |
| `--bq-ink` | `#1D2B22` (mực) | chữ chính, viền, bóng |
| `--bq-ink-soft` | `#4D3A1F` | chữ phụ |
| `--bq-ink-faint` | `#6B5530` | chú thích (≥ 4.5:1 trên giấy kem) |
| `--bq-amber` | `#FFC93C` (vàng) | nút chính, thanh tiến độ, điểm nhấn |
| `--bq-amber-deep` | `#8A5A12` | chữ màu vàng-nâu trên nền sáng |
| `--bq-sapphire` / `--bq-emerald` / `--bq-ruby` | `#2F6FB0` / `#2E7D4F` / `#B3452F` | màu nhấn theo chế độ (Luyện Tập / Phòng chơi / Đấu Hạng) |
| `--bq-leaf` | `#D9F0C8` | nút phụ |
| `--bq-wood` | `#8A5A2B` (gỗ) / `#C68A4E` (biển gỗ) | trục cuộn giấy, biển chỉ đường |
| `--bq-line` | `3px solid var(--bq-ink)` | viền thẻ và nút |
| `--bq-shadow-card` | `6px 10px 0 rgba(29,43,34,.35)` | bóng thẻ |
| `--bq-shadow-btn` | `0 6px 0 var(--bq-ink)` | bóng nút |
| Bo góc | nút 18px · thẻ 26px · chip 999px | |

**Độ trong suốt:** Tailwind lấy màu `bq-*` từ kênh RGB `--bq-<tên>-rgb` (vd `--bq-amber-rgb: 255 201 60`) nên `bg-bq-amber/10`, `border-bq-emerald/30` mới sinh CSS. Đổi một màu gốc thì **đổi cả biến `-rgb` đi kèm**. Thiếu kênh RGB, Tailwind 3.4 bỏ qua class có `/NN` mà không báo lỗi gì (lỗi này có từ thời Khung Sáng, sửa ở LKD-19).

## Chữ

| Vai trò | Font | Ghi chú |
|---|---|---|
| Giao diện, tiêu đề, nút, số liệu | **Baloo 2** 600/700/800 | mặc định (`font-sans`, `font-display`) |
| Đoạn đọc dài | **Be Vietnam Pro** 400/500 | `font-read`: giải thích đáp án, đoạn Kinh Thánh, trang pháp lý |

## Màu đáp án (C5 lock) — giữ nguyên

| Option | Màu | Hex |
|---|---|---|
| A | Coral | `#E8826A` |
| B | Sky | `#6AB8E8` |
| C | Gold | `#E8C76A` |
| D | Sage | `#7AB87A` |

Nút đáp án là "biển gỗ" tô màu C5, viền mực 3px, ô chữ cái tròn giấy kem. Đúng: viền sáng vàng + dấu ✓. Sai: viền hồng + dấu ✗. Các đáp án còn lại mờ 50%.

## Thành phần mẫu

- **Thẻ dán:** `bg-bq-white`, viền mực 3px, bo 26, `--bq-shadow-card`.
- **Cuộn giấy:** trục gỗ trên/dưới (thanh bo tròn `--bq-wood` viền mực) + thân giấy `#F9ECC8`. Dùng cho câu hỏi và câu gốc.
- **Biển gỗ:** `#C68A4E`, chữ `#2B1A08`, viền mực, bóng cứng. Dùng cho lối vào chế độ chơi.
- **Thanh tiến độ:** track `#F0DFB8` viền mực 2–3px, phần đã đi màu vàng.
- **Đèn nhiệm vụ:** đèn sáng = xong, đèn mờ = đang làm, đèn tắt = chưa làm (luôn kèm số và thanh, không chỉ dựa vào màu).
- **Khiên hạng:** 6 ảnh khiên theo C1 (`/images/lk/tier-1..6.webp`). Màu chữ hạng (`data/tiers.ts`) đã làm đậm cho nền giấy: `#6B5530` · `#2E7D4F` · `#2F6FB0` · `#7A4AA0` · `#A8690C` · `#B3452F`.
- **Chữ sticker:** số/tiêu đề lớn cần nổi bật thì dùng chữ mực + bóng vàng lệch xuống: `color: #1D2B22; text-shadow: 0 0.06em 0 #FFC93C`. KHÔNG dùng chữ tô gradient (`background-clip: text`): mọi gradient Lữ Khách đều đi qua vàng sáng và biến mất trên nền kem.
- **Bục xếp hạng:** khối vàng (hạng 1) / giấy (2) / rãnh (3), viền mực, điểm chữ mực.
- **Trang trống / lỗi:** 404 = lữ khách cầm bản đồ trắng (`hero-lost.webp`); lỗi = lữ khách ngồi nghỉ cạnh đèn tắt (`hero-rest.webp`); danh sách trống = icon trong vòng tròn lá viền mực (`EmptyState`).

## Ảnh (`apps/web/public/images/lk/`)

- Vẽ bằng Game Asset Studio, style "Lữ Khách" (ảnh mốc: nhân vật lữ khách), chất lượng medium.
- Sprite nền trong suốt → WebP, cạnh dài ≤ 420px (sprite lớn cho 404 / màn lỗi ≤ 512px). Tranh nền 1536×1024 → WebP q82.
- Mọi ảnh trang trí có `alt=""`; ảnh mang nghĩa có `alt` tiếng Việt.

## Cầu nối cho class cũ (global.css + tailwind.config.js)

Code cũ còn dùng tên của 2 design system trước. Các tên đó được giữ lại nhưng trỏ sang màu Lữ Khách, để màn cũ tự đổi theo. **Code mới không dùng các tên này.**

| Tên cũ | Giờ là |
|---|---|
| `bg-surface-*`, `bg-background` | giấy / giấy kem |
| `text-on-surface*`, `text-secondary`, `text-error`, `text-primary` | mực / vàng sậm / hồng đất / lam |
| `--hp-*` (`.form-input`, `.form-select`, `.segmented-control`, `.badge-*`) | giấy, mực, vàng |
| `.bg-bq-white.border-bq-hair.shadow-bq-soft` | thẻ dán (viền mực 3px) |
| `button/a.bg-bq-action.shadow-bq-action`, `.gold-gradient`, `.lk-btn` | nút vàng ấn được; `.lk-btn-2` = nút lá |

Admin dùng mã hex viết thẳng đã đổi sang màu Lữ Khách (LKD-18). `index.html` đặt `body` màu mực, nên phần tử không tự đặt màu chữ sẽ là mực.

## Quy tắc UI bắt buộc

- Màu, font, bóng chỉ lấy từ token. KHÔNG hardcode hex mới (C5 là ngoại lệ đã khoá).
- Thẻ mới → kiểu thẻ dán; CTA chính → nút vàng ấn được; KHÔNG dùng gradient sặc, bóng mờ phát sáng, kính mờ.
- Chữ trên nút vàng luôn là màu mực (không dùng chữ trắng trên vàng).
- Tôn trọng `prefers-reduced-motion`; vùng chạm ≥ 44px; tương phản chữ ≥ 4.5:1.
- Mobile-first, breakpoints Tailwind mặc định.

## Khi nghi ngờ về design

1. Xem mockup canvas và file này trước, KHÔNG tự chế kiểu mới.
2. Màn chưa có mockup → dùng các thành phần mẫu ở trên, cùng token.
