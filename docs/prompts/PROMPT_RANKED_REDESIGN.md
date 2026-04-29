# Prompt: Redesign Ranked.tsx (Sacred Modernist v2)

> Paste toàn bộ file này vào Claude Code để thực hiện redesign trang Ranked.
> Reference mockup: `ranked-redesign-mockup.html` đã được approve.
> Ước tính: 4-6 giờ, chia thành 5 commits riêng để dễ rollback.

---

## Bối cảnh

Trang `apps/web/src/pages/Ranked.tsx` hiện tại có các vấn đề UX sau (đã verify với screenshot user):

1. Layout loãng — half trên màn hình trống vô lý, sidebar 60% chiều dọc trống
2. Information bị duplicate — `#26` xuất hiện 2 lần (HÔM NAY + MÙA THI ĐẤU), `40 điểm` cũng vậy
3. Cards trông y hệt nhau — không có visual hierarchy
4. Decorative icons mờ (lightning, trophy, water drop) — trông như bug render
5. Thiếu hook cảm xúc — không có streak indicator, không có tier progress đến tier sau
6. CTA "VÀO THI ĐẤU" tách rời, user phải scroll qua 3 cards mới tới
7. Phần "Bắt đầu — Đỉnh" trong Season vô nghĩa (nên là milestones cụ thể: Top 50, Top 10)

Mockup redesign đã được approve. Cần implement theo mockup, giữ nguyên business logic, KHÔNG thay đổi API.

---

## Design tokens (BẮT BUỘC tuân theo)

Dùng đúng tokens đã có trong project — KHÔNG được hardcode màu khác:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#11131e` | Main bg |
| Sidebar bg | `#0d0f17` | Sidebar (đậm hơn 1 chút) |
| Glass card | `rgba(50,52,64,0.45)` + `backdrop-blur(12px)` | Tất cả cards chính |
| Card border | `rgba(255,255,255,0.06)` | Border cho cards |
| Gold primary | `#e8a832` | CTA, accents, gold numbers |
| Gold gradient | `linear-gradient(135deg, #e8a832, #e7c268)` | CTA button, progress fills |
| Gold glow | `box-shadow: 0 8px 32px rgba(232,168,50,0.25)` | CTA hover |
| Streak orange | `#fb923c` | Streak fire icon + number |
| Success green | `#4ade80` | Positive deltas (↑ +12) |
| Text primary | `#e1e1f1` | Headings, values |
| Text muted | `rgba(225,225,241,0.6)` | Subtitles |
| Text subtle | `rgba(225,225,241,0.4)` | Captions, metadata |
| Font | `Be Vietnam Pro` | Tất cả text |

CSS utilities đã có trong `global.css` — DÙNG, không tạo mới:
- `.glass-card` cho cards
- `.gold-gradient` cho CTA
- `.gold-glow` cho hover

---

## Layout cuối cùng (theo mockup)

```
┌─ Header ────────────────────────────────────────────────┐
│ Thi Đấu Xếp Hạng                                        │
│ [🌱 Tân Tín Hữu] Còn 650 điểm nữa lên Người Tìm Kiếm    │
│ ━━━━━━━━━━━━━━━░░░░░░  (gold tier progress bar 56%)     │
└─────────────────────────────────────────────────────────┘

┌─ Energy ──────────────────┬─ Streak (mới) ────────────┐
│ ⚡ NĂNG LƯỢNG              │ 🔥 ĐANG CHÁY             │
│ 61 / 100                  │ 🔥 7 ngày                │
│ ━━━━━━━━━░░ 61%           │   Đừng dừng!             │
│ Đủ ~12 câu • Hồi: 23h59m  │                          │
└───────────────────────────┴──────────────────────────┘

┌─ Câu hôm nay ─┬─ Điểm hôm nay ─┬─ Độ chính xác ─┐
│ 12/100        │ 40 (gold)      │ 75%            │
│ Còn 88 câu    │ ↑ +12 vs hôm qua│ 9/12 đúng     │
│ ━░░░░░░       │                │                │
└───────────────┴────────────────┴────────────────┘

┌─ 📖 Genesis • Sách 2/66 ────────────────────[Đổi sách]┐
│ Đang chinh phục — 18% câu đã trả lời đúng             │
│ ━━░░░░░░░░░░░░                                        │
└───────────────────────────────────────────────────────┘

┌─ 🏆 Mùa Thi Đấu — Còn 23 ngày ────────────────────────┐
│ #26          ━━━━━━━━━━━━░░░░░░░░░░░░                 │
│ 40đ mùa      Top 100  ▼ Bạn  Top 50 (60đ)  Top 10    │
└───────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ▶  VÀO THI ĐẤU NGAY                                    │
│     Tiếp tục Genesis • ~12 câu với năng lượng hiện có   │
└─────────────────────────────────────────────────────────┘
(gold gradient, glow shadow, full width)
```

**Background:** main content area có radial gradient gold (alpha 0.07) ở góc trên-phải:
```css
.main::before {
  content: '';
  position: absolute;
  top: -300px; right: -300px;
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(232,168,50,0.07), transparent 65%);
  pointer-events: none;
}
```

---

## Tasks (5 commits)

### Task R1: Header + Tier Progress Bar (P0)

**File:** `apps/web/src/pages/Ranked.tsx`

**Implement:**

```tsx
// Component: TierProgressHeader
// Shows: title + tier badge + "còn X điểm" + progress bar to next tier

interface TierProgress {
  currentTier: { name: string; nameVi: string; icon: string }
  nextTier: { name: string; nameVi: string } | null  // null nếu max tier
  currentPoints: number
  nextThreshold: number
  pointsToNext: number  // nextThreshold - currentPoints
  progressPercent: number  // (currentPoints / nextThreshold) * 100
}
```

**Data source:** `GET /api/me/tier-progress` (đã có theo TODO TP-1).

**UI:**
- `<h1>Thi Đấu Xếp Hạng</h1>` (32px, weight 700, letter-spacing -0.5px)
- Tier badge: pill với background `rgba(232,168,50,0.1)`, border `rgba(232,168,50,0.3)`, text gold
- Progress info: "Còn **650 điểm** nữa lên **Người Tìm Kiếm**" (Người Tìm Kiếm có color gold)
- Progress bar: height 6px, gold gradient fill, animate width on mount

**Edge case:** nếu `nextTier === null` (max tier "Vinh Quang"), thay text bằng "Đã đạt tier cao nhất 👑" và bar full 100%.

**Tests:** `Ranked.test.tsx`
- Render với mock tier progress → verify text "Còn 650 điểm... Người Tìm Kiếm"
- Render với max tier → verify text "Đã đạt tier cao nhất"
- Progress bar width đúng % được pass vào

**Commit:** `feat: Ranked header with tier progress bar (R1)`

---

### Task R2: Energy + Streak 2-column row (P0)

**Implement 2 cards trong grid 1.6fr 1fr:**

#### Card 1: Energy (left, 60% width)
- Header: `⚡ NĂNG LƯỢNG` (uppercase, letter-spacing 1.5px, color muted)
- Big number: `61` (38px, weight 800, gold) + `/ 100` (18px, muted)
- Progress bar (gold gradient, 8px tall)
- Footer 2 cols:
  - Left: "Đủ chơi **~Z câu** nữa" — Z = `Math.floor(energy / 5)` (mỗi câu sai trừ 5 năng lượng)
  - Right: "⏱ Phục hồi: HH h MMm" — countdown đến 0:00 UTC

#### Card 2: Streak (right, 40% width)
- Background gradient: `linear-gradient(135deg, rgba(251,146,60,0.08), rgba(232,168,50,0.04))`
- Border: `rgba(251,146,60,0.2)`
- Header: `🔥 ĐANG CHÁY`
- Display: 🔥 emoji 42px (filter drop-shadow orange) + "**N ngày**" (orange #fb923c, 26px, weight 800)
- Caption: "Đừng dừng — chơi tiếp!" (nếu streak > 0) hoặc "Bắt đầu streak hôm nay!" (nếu streak = 0)

**Data source:** `currentStreak` từ `/api/me`, `energyRemaining` từ `/api/me/ranked-status`.

**Tests:**
- Render với 61 energy → text "Đủ chơi ~12 câu"
- Render với 0 streak → text "Bắt đầu streak hôm nay!"
- Countdown timer format đúng (HH h MMm)

**Commit:** `feat: Ranked energy + streak cards (R2)`

---

### Task R3: 3 Stats Cards row (P0)

**Implement 3 cards equal width:**

| Card | Value | Sub | Note |
|------|-------|-----|------|
| Câu hôm nay | `12/100` | Còn 88 câu được tính rank | + thin progress bar (3px) |
| Điểm hôm nay | `40` (gold) | ↑ +12 so với hôm qua | green nếu delta > 0, gray nếu = 0 |
| Độ chính xác | `75%` | 9/12 câu đúng | bỏ progress bar |

**Quan trọng — LOẠI BỎ:** card "Xếp hạng #26" hiện tại. Rank chỉ hiện ở Mùa Thi Đấu (R5).

**Data source `/api/me/ranked-status`:**
- `dailyQuestionsAnswered` / `dailyQuestionCap` → 12/100
- `dailyPoints` → 40
- `dailyAccuracy` → 0.75 (hoặc compute frontend từ correct/total)
- `dailyDelta` → +12 (so với yesterday — nếu backend chưa có, FE hardcode null và bỏ "↑ +12 so với hôm qua")

**Nếu backend chưa có `dailyDelta` và `dailyAccuracy`:** ghi chú trong PR và mở task riêng `BE-EXTEND-RANKED-STATUS` cho sau. Trong commit này chỉ render placeholder "—" cho các field thiếu.

**Tests:**
- Render với delta dương → text "↑ +12 so với hôm qua" + class `up`
- Render với delta = 0 → bỏ delta text (không show "↑ +0")
- Accuracy null → render "—"

**Commit:** `feat: Ranked 3 stats cards without duplicate rank (R3)`

---

### Task R4: Active Book Card (P1)

**Implement slim horizontal card:**

```
[📖 icon 48x48 gold bg]  [Genesis • Sách 2/66]              [Đổi sách →]
                          [Đang chinh phục — 18% câu...]
                          [━━░░░░░░ progress 18%]
```

**Data source:**
- Active book name: từ `lastSession.book` hoặc `userPreference.activeBook`
- Progress: `bookMastery[book].percentMastered` từ `/api/me/journey`

**Button "Đổi sách":**
- Style: `btn-secondary` (gold border, gold text, transparent bg)
- onClick → mở modal book selector hoặc navigate `/practice?selectBook=true`
- Nếu chưa có book selector flow → button hiển thị nhưng disabled với tooltip "Sắp ra mắt"

**Tests:**
- Render với book progress → verify progress bar width
- Click "Đổi sách" → verify navigation hoặc modal open

**Commit:** `feat: Ranked active book card with progress (R4)`

---

### Task R5: Season Card with Milestones + CTA (P0)

#### Season card
```
🏆 MÙA THI ĐẤU — CÒN 23 NGÀY
#26       ━━━━━━━━━━━━━░░░░░░  
40đ mùa   Top 100   ▼ Bạn ở đây   Top 50 (60đ)   Top 10 (200đ)
```

**Logic milestones:**
- Lấy 4 mốc xếp hạng phổ biến: Top 100, Top 50, Top 10, Top 1
- Find current rank → highlight mốc gần nhất bằng "▼ Bạn ở đây" (color gold, weight 700)
- Tính progress bar: 
  - Nếu rank = 26 → đã qua Top 100, đang giữa Top 100 và Top 50 → bar fill ~48%
  - Công thức: lerp giữa các mốc dựa trên rank

**Data source:** `/api/me/ranked-status` cần có:
- `seasonRank: number`
- `seasonPoints: number`
- `seasonDaysRemaining: number`
- `pointsToTop50: number`, `pointsToTop10: number` (nếu chưa có → hardcode "60đ" / "200đ" placeholder và mở backend task)

#### CTA Button (BIG)
```
▶  VÀO THI ĐẤU NGAY
   Tiếp tục Genesis • ~12 câu với năng lượng hiện có
```

**Style:**
- Width: 100%, padding 18px 28px
- Background: `linear-gradient(135deg, #e8a832, #e7c268)`
- Color: `#1a1410` (dark text on gold)
- Border-radius: 14px
- Box-shadow: `0 8px 32px rgba(232,168,50,0.25)`
- Hover: `transform: translateY(-1px)` + shadow tăng lên `0 12px 36px rgba(232,168,50,0.35)`
- Main text: 16px, weight 800, uppercase, letter-spacing 1.2px
- Sub text: 12px, opacity 0.7, weight 500

**onClick:** navigate `/quiz?mode=ranked&book={activeBook}` (giữ logic cũ).

**Disabled state:** nếu `energyRemaining < 5` → disable button, sub text đổi thành "Hết năng lượng — chờ phục hồi" + opacity 0.5.

**Tests:**
- Render với rank 26 → milestones hiển thị đúng, "▼ Bạn ở đây" giữa Top 100 và Top 50
- Render với energy 0 → CTA disabled
- Click CTA → navigate với query params đúng

**Commit:** `feat: Ranked season + CTA (R5)`

---

## Quy tắc bắt buộc

### KHÔNG được làm
- ❌ Hardcode màu ngoài design tokens trong bảng trên
- ❌ Tạo CSS module mới — dùng Tailwind utilities + global.css đã có
- ❌ Thay đổi API endpoints (chỉ consume data có sẵn)
- ❌ Sửa file `AppLayout.tsx` (sidebar widgets sẽ làm trong task riêng)
- ❌ Bỏ business logic hiện tại (energy deduction, daily cap, season tracking)
- ❌ Dùng emoji trong code logic — chỉ dùng emoji trong UI text/labels

### BẮT BUỘC làm
- ✅ Mỗi task = 1 commit riêng (rollback dễ)
- ✅ Mock data cho fields backend chưa có, comment rõ `// TODO: BE-EXTEND-RANKED-STATUS`
- ✅ Ambient gradient góc trên-phải (xem mockup)
- ✅ Animation transition smooth: progress bars `transition: width 0.6s ease-out` on mount
- ✅ Hover states cho tất cả interactive elements (CTA, "Đổi sách", cards có click)
- ✅ Loading skeleton state (dùng `<RankedSkeleton />` đã có hoặc tạo mới)
- ✅ Empty state nếu API fail (chỉ phần đó, không break full page)

---

## Data requirements — backend gaps

Nếu các field sau chưa có trong `/api/me/ranked-status`, ghi chú trong PR description và tạo task BE riêng. KHÔNG block frontend:

| Field | Type | Default nếu thiếu |
|-------|------|-------------------|
| `dailyAccuracy` | float 0-1 | hide card "Độ chính xác" |
| `dailyDelta` | int (delta vs yesterday) | hide "↑ +N so với hôm qua" |
| `pointsToTop50` | int | hardcode "60đ" với comment TODO |
| `pointsToTop10` | int | hardcode "200đ" với comment TODO |
| `activeBook` | string | fallback từ `lastSession.book` |
| `bookMasteryPercent` | float 0-100 | hide book progress bar |

---

## Testing Strategy (3-tier regression guard)

### Tầng 1: Unit tests (Ranked.test.tsx)
- Min 12 tests covering tất cả 5 tasks
- Mock `useQuery` returns cho từng API
- Test edge cases: max tier, energy = 0, streak = 0, missing data fields

```bash
npx vitest run apps/web/src/pages/__tests__/Ranked.test.tsx
```

### Tầng 2: Page-level tests
```bash
npx vitest run apps/web/src/pages/
# Verify Practice, DailyChallenge, Home không bị ảnh hưởng
```

### Tầng 3: Full regression
```bash
cd apps/web && npx vitest run
cd apps/api && ./mvnw test
```

**Baseline tests phải pass:** FE 387+, BE 494+ (theo TODO.md mới nhất).

---

## Deliverable checklist

Khi hoàn thành, PR description phải có:

- [ ] 5 commits riêng theo Task R1-R5
- [ ] Screenshot trang Ranked sau redesign (so với screenshot bản cũ trong PR)
- [ ] Test coverage report: bao nhiêu tests mới, baseline pass
- [ ] List các backend gaps đã handle với fallback (nếu có)
- [ ] Mention bất kỳ deviation nào khỏi mockup với lý do
- [ ] Verify mobile responsive (breakpoint sm: stack vertical, md+: 2-col grid)

---

## Mockup reference

File mockup HTML đã được approve: `ranked-redesign-mockup.html`. Khi có bất đồng giữa prompt và mockup → ƯU TIÊN MOCKUP về visual, ưu tiên prompt về data/logic.

Mockup được render với data giả định. Code thật phải đọc data từ API thật.

---

## Sau khi xong

1. Tạo PR với title: `redesign: Ranked page Sacred Modernist v2`
2. Update `TODO.md` mục "Ranked Redesign v2" → mark DONE với 5 sub-tasks
3. Update `DESIGN_SYNC_AUDIT.md` (nếu có): Ranked → ✅ Synced (custom v2)
4. Document backend gaps trong file mới `BACKEND_GAPS_RANKED_V2.md` (nếu có gaps thật)

Khởi chạy task R1 trước. Sau khi commit R1, hỏi xác nhận trước khi tiếp R2.
