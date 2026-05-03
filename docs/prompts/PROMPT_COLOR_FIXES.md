# PROMPT: Color Fixes — BibleQuiz (Tasks 1-5)

> Mục tiêu: Sửa các vấn đề về màu sắc đã phát hiện trong `docs/COLOR_AUDIT.md` (commit `51017e0`). Tổng 5 tasks độc lập, mỗi task **1 commit riêng** để dễ rollback.
> Đọc audit report trước khi bắt đầu: `docs/COLOR_AUDIT.md`

---

## Nguyên tắc chung

- **Mỗi task = 1 commit.** Không gộp commits.
- **Sau mỗi task: chạy regression** (`npm run build` web + `tsc --noEmit` mobile + relevant tests). Pass mới commit.
- **Không refactor ngoài scope** của task. Nếu thấy vấn đề khác, ghi vào `docs/FOLLOWUPS.md` chứ đừng sửa.
- **Báo cáo cuối:** Sau khi xong cả 5, append section vào `docs/COLOR_AUDIT.md` với tiêu đề `## Fixes Applied (YYYY-MM-DD)` liệt kê các thay đổi + commit hashes.

---

## ⚠️ DECISION REQUIRED — Đọc trước khi bắt đầu Task 1

Task 1 cần biết palette nào là canonical. Anh phải chọn một trong hai trước khi chạy:

```
CANONICAL_TIER_PALETTE = ?  // điền "web" hoặc "mobile"
```

**So sánh nhanh:**

| Tier | Tên | Web | Mobile | Ghi chú |
|---|---|---|---|---|
| 1 | Tân Tín Hữu | `#919098` (gray) | `#9ca3af` (gray-400) | Cùng hue, khác shade |
| 2 | Người Tìm Kiếm | `#4ade80` (**green**) | `#60a5fa` (**blue**) | **Khác hue hoàn toàn** |
| 3 | Môn Đồ | `#4a9eff` (blue) | `#3b82f6` (blue-500) | Cùng hue |
| 4 | Hiền Triết | `#9b59b6` (purple) | `#a855f7` (purple-500) | Cùng hue |
| 5 | Tiên Tri | `#f8bd45` (gold) | `#eab308` (yellow-500) | Cùng hue, khác saturation |
| 6 | Sứ Đồ | `#ff6b6b` (coral) | `#ef4444` (red-500) | Cùng hue |

- **Web palette:** ad-hoc, có 1 token (`text-secondary` cho Tier 5), 1 outline (Tier 1), 4 hardcoded. Tier 2 = green phá pattern cool→warm gradient.
- **Mobile palette:** sequential gradient gray → blue → blue → purple → yellow → red, hài hoà về thị giác (cool → warm progression). Đúng pattern "tiến triển spiritual → glory".

→ **Em đề xuất CANONICAL = mobile** (gradient nhất quán hơn). Nhưng đây là quyết định brand của anh, không phải em.

Sau khi quyết định, điền vào constant ở Task 1 và bắt đầu.

---

## Task 1 — Sync 6 tier colors web ↔ mobile

### Mục tiêu
Cả 6 tiers có cùng hex giữa web và mobile. Đồng thời chuyển từ ad-hoc hex sang Tailwind tokens (web).

### Files affected
- `apps/web/tailwind.config.js` (thêm tier tokens)
- `apps/web/src/data/tiers.ts` (đổi colorHex + colorTailwind)
- `apps/mobile/src/logic/tierProgression.ts` (đổi nếu canonical = web)
- `apps/web/docs/designs/DESIGN_TOKENS.md` (cập nhật spec)

### Steps

**1.1.** Mở file decision (hoặc CLI flag): xác nhận `CANONICAL_TIER_PALETTE = "mobile"` (hoặc "web" theo anh chọn).

**1.2.** Thêm 6 tier tokens vào `apps/web/tailwind.config.js`:

```js
// Trong theme.extend.colors:
tier: {
  1: '#9ca3af',  // Tân Tín Hữu — gray
  2: '#60a5fa',  // Người Tìm Kiếm — blue
  3: '#3b82f6',  // Môn Đồ — blue-500
  4: '#a855f7',  // Hiền Triết — purple
  5: '#eab308',  // Tiên Tri — yellow
  6: '#ef4444',  // Sứ Đồ — red
}
```
(Hex theo CANONICAL — ví dụ trên là mobile.)

**1.3.** Cập nhật `apps/web/src/data/tiers.ts`:
- 6 entries, mỗi entry:
  - `colorHex`: hex từ palette canonical
  - `colorTailwind`: `text-tier-N` (N = level)
- **Xoá toàn bộ ad-hoc class** (`text-[#4a9eff]`, `text-[#9b59b6]`, `text-[#ff6b6b]`).

**1.4.** Nếu CANONICAL = "web", cập nhật `apps/mobile/src/logic/tierProgression.ts` với hex từ web. Nếu CANONICAL = "mobile", file này không cần đổi (đã đúng).

**1.5.** Cập nhật `apps/web/docs/designs/DESIGN_TOKENS.md`:
- Section tier colors → liệt kê 6 hex chính thức + Vietnamese names
- Ghi rõ: "Source of truth: `tier.{1..6}` trong Tailwind config"

### Verification

```bash
# Tất cả 6 tiers phải dùng token, không ad-hoc
grep -E "text-\[#" apps/web/src/data/tiers.ts && echo "FAIL: still has hardcoded" || echo "OK"

# Web ↔ mobile phải khớp
diff <(grep -oE "#[0-9a-f]{6}" apps/web/src/data/tiers.ts | sort) \
     <(grep -oE "#[0-9a-f]{6}" apps/mobile/src/logic/tierProgression.ts | sort)
# → no diff output
```

### Acceptance
- [ ] 6 `tier-*` tokens trong tailwind config
- [ ] `tiers.ts` không còn hex ad-hoc
- [ ] Web hex == Mobile hex (6/6)
- [ ] DESIGN_TOKENS.md cập nhật
- [ ] Build pass: `cd apps/web && npm run build`
- [ ] Mobile typecheck: `cd apps/mobile && npx tsc --noEmit`
- [ ] FE tests pass (baseline 387)
- [ ] Mobile screens hiển thị đúng tier color (manual smoke test: open Profile, Achievements, Leaderboard)
- [ ] Commit: `fix(colors): sync 6 tier colors web↔mobile + add tier-* tokens`

---

## Task 2 — Fix hardcoded colors trong AppLayout + AdminLayout

### Mục tiêu
Thay hardcoded hex bằng Tailwind tokens ở 2 file shell quan trọng nhất. Đồng thời sửa 4 typo "off-by-one" trong AdminLayout.

### Files affected
- `apps/web/src/layouts/AppLayout.tsx` (15 hardcodes)
- `apps/web/src/layouts/AdminLayout.tsx` (21 hardcodes, bao gồm 4 typo)

### Replacement table (apply chính xác)

**AppLayout.tsx:**

| Find | Replace |
|---|---|
| `bg-[#11131e]` | `bg-background` |
| `text-[#e1e1f1]` | `text-on-surface` |
| `text-[#e8a832]` | `text-secondary` |
| `border-[#e8a832]` | `border-secondary` |
| `border-[#e8a832]/30` | `border-secondary/30` |
| `text-[#412d00]` | `text-on-secondary` |

**AdminLayout.tsx (gồm 4 typo fixes):**

| Find | Replace | Note |
|---|---|---|
| `bg-[#11131c]` | `bg-background` | TYPO: off-by-2 from `#11131e` |
| `bg-[#1d1f29]` | `bg-surface-container` | TYPO: off-by-1 from `#1d1f2a` |
| `bg-[#0c0e17]` | `bg-surface-container-lowest` | Close enough to `#0b0e18` |
| `text-[#e8a832]` | `text-secondary` |  |
| `text-[#e1e1f1]` | `text-on-surface` |  |
| `text-[#412d00]` | `text-on-secondary` |  |
| `border-[#e8a832]/30` | `border-secondary/30` |  |

**Còn lại trong AdminLayout** (KHÔNG có equivalent token, giữ tạm):
- `#d5c4af` (warm tan, 11 occurrences) — **không thay**, ghi chú trong FOLLOWUPS
- `#504535` (dark warm border) — **không thay**
- `#281900` — **không thay**

### Steps

**2.1.** Verify danh sách hardcode hiện tại:

```bash
grep -nE "(bg|text|border|from|to)-\[#[0-9a-fA-F]+\]" apps/web/src/layouts/AppLayout.tsx
grep -nE "(bg|text|border|from|to)-\[#[0-9a-fA-F]+\]" apps/web/src/layouts/AdminLayout.tsx
```

Số lượng phải khớp với audit (15 + 21 = 36).

**2.2.** Apply replacement table. Dùng find-and-replace, KHÔNG sửa thủ công từng dòng.

**2.3.** Diff phải clean — chỉ thay class name, không động đến markup/logic/spacing.

**2.4.** Tạo `docs/FOLLOWUPS.md` (hoặc append nếu đã có) với section:

```md
## Admin warm palette (P1)

AdminLayout + DraftCard + 4 admin pages dùng palette warm tan/brown
(`#d5c4af`, `#504535`, `#281900`, `#32343e`) không có trong Tailwind.

Cần quyết định:
(a) Thêm `admin-{warm,border,bg}` tokens vào tailwind, hoặc
(b) Refactor admin section dùng Sacred Modernist standard tokens.

Files: AdminLayout, DraftCard, Users, ReviewQueue, Feedback,
QuestionQuality (~80 hardcodes total).
```

### Verification

```bash
# Sau fix: AppLayout phải còn 0 hardcoded core colors
grep -E "(bg|text|border)-\[#(11131e|11131c|1d1f29|e8a832|e1e1f1|412d00)" apps/web/src/layouts/AppLayout.tsx | wc -l
# → 0

# AdminLayout còn lại CHỈ là warm palette
grep -E "(bg|text|border)-\[#" apps/web/src/layouts/AdminLayout.tsx | grep -vE "#(d5c4af|504535|281900|32343e)" | wc -l
# → 0
```

### Acceptance
- [ ] AppLayout: 0 hardcode còn lại (trong scope replacement)
- [ ] AdminLayout: 4 typo fixed, chỉ còn warm palette ngoài scope
- [ ] Visual không đổi (compare pre/post screenshot AppLayout home + Admin Dashboard)
- [ ] `docs/FOLLOWUPS.md` có entry "Admin warm palette"
- [ ] Build pass + FE tests pass (387 baseline)
- [ ] Commit: `fix(colors): replace hardcoded hex with tokens in App+AdminLayout (-36 hardcodes, +4 typo fixes)`

---

## Task 3 — Xoá 6 dead tier tokens trong mobile colors.ts

### Mục tiêu
Xoá `tierSpark`/`tierDawn`/`tierLamp`/`tierFlame`/`tierStar`/`tierGlory` — vi phạm DECISIONS.md 2026-04-19 (OLD light-themed naming).

### Files affected
- `apps/mobile/src/theme/colors.ts` (xoá lines 41-46)

### Steps

**3.1.** Verify zero usages:

```bash
grep -rnE "tier(Spark|Dawn|Lamp|Flame|Star|Glory)" apps/mobile/src --include="*.ts" --include="*.tsx"
# → expect 0 results (or only the declaration in colors.ts)
```

Nếu có usage ngoài colors.ts → DỪNG, báo lại để Bui review (có thể đang dùng ngầm, không an toàn xoá).

**3.2.** Xoá lines 41-46 (6 dòng tier tokens cũ).

**3.3.** Nếu colors.ts có import sort hoặc grouping comments, dọn cho gọn.

### Verification

```bash
# Sau xoá:
grep -E "tier(Spark|Dawn|Lamp|Flame|Star|Glory)" apps/mobile/src/theme/colors.ts | wc -l
# → 0

# Mobile typecheck
cd apps/mobile && npx tsc --noEmit
# → 0 errors
```

### Acceptance
- [ ] 6 tokens xoá khỏi colors.ts
- [ ] `tsc --noEmit` pass
- [ ] Mobile chạy được: `cd apps/mobile && npx expo start` → không lỗi
- [ ] Commit: `chore(colors): remove 6 dead tier tokens from mobile colors.ts (DECISIONS.md violation)`

---

## Task 4 — Dọn `global.css` (5 :root blocks → 1)

### Mục tiêu
Giảm cognitive overhead. Hiện tại có 5 `:root` blocks (HP, Cyberpunk, transitional, Warm-card, Royal Gold) chồng lên Sacred Modernist. Mục tiêu: chỉ giữ Sacred Modernist + tokens thực sự được dùng.

### ⚠️ Đây là task RISKY nhất. Chia 4 sub-commits.

### Files affected
- `apps/web/src/global.css`

### Sub-task 4.1 — Audit "thực sự dead"

Trước khi xoá bất cứ thứ gì, verify từng block:

```bash
# HP block (line ~129-146)
grep -rE "var\(--hp-[a-z-]+\)" apps/web/src --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
grep -rE "\.hp-[a-z]+" apps/web/src --include="*.tsx" --include="*.ts" --include="*.css" | wc -l

# Cyberpunk block (line ~188-212)
grep -rE "var\(--(deep-space|neon-cyan|cyber-gold|neon-pink)\)" apps/web/src | wc -l
grep -rE "\.neon-[a-z]+" apps/web/src --include="*.tsx" --include="*.ts" | wc -l
# (Cyberpunk có .neon-* utilities ở global.css line 247-705 — verify riêng)

# Royal Gold block (line ~2461-2470)
grep -rE "var\(--(bg-deep|gold-primary|gold-bright|text-gold)\)" apps/web/src | wc -l

# Warm-card block (line ~2233-2249)
grep -rE "var\(--(card-warm-from|gold-glow-soft)\)" apps/web/src | wc -l
# (Audit nói block này CÓ usage ở line 2270, 2292, 2329 trong global.css → keep)
```

Tạo file `tmp/css-audit.md` với kết quả từng block:

```md
## Block audit
- HP `:root` (line 129): X tsx usages, Y css usages → DEAD/USED
- Cyberpunk `:root` (line 188): X tsx usages, Y .neon-* class usages → DEAD/USED
- Transitional (line 214): X usages → DEAD/USED
- Warm-card (line 2233): X usages → KEEP (per audit)
- Royal Gold (line 2461): X usages → DEAD/USED
```

### Sub-task 4.2 — Xoá HP block (nếu dead)

Nếu HP block có 0 usages → xoá lines 129-146 + bất kỳ `.hp-*` utilities (kiểm tra line 178-188).
Build + test → commit: `chore(css): remove dead HP-themed root block from global.css`

### Sub-task 4.3 — Xoá Cyberpunk block (nếu dead)

Nếu Cyberpunk + `.neon-*` đều dead → xoá lines 188-212 + utilities 247-705.
Đây là cleanup lớn nhất (~450 dòng). **Test kỹ** sau khi xoá.
Build + test → commit: `chore(css): remove dead Cyberpunk root + .neon-* utilities (-450 lines)`

### Sub-task 4.4 — Xử lý Royal Gold + transitional

- Nếu Royal Gold dead → xoá lines 2461-2470. Commit: `chore(css): remove dead Royal Gold root block`
- Nếu CÒN dùng → migrate sang Sacred Modernist tokens (`--gold-primary` → `var(--color-secondary)`, etc.) — đây là refactor, scope riêng, có thể defer.
- Transitional block (line 214-231): inspect, có thể là leftover từ migration. Xử lý case-by-case.

### Verification (mỗi sub-commit)

```bash
cd apps/web && npm run build  # pass
npx vitest run                  # 387 tests pass
# Manual: open landing, home, quiz, leaderboard → no visual regression
```

### Acceptance
- [ ] Audit file `tmp/css-audit.md` được tạo trước khi xoá bất cứ thứ gì
- [ ] Mỗi block dead được xoá trong commit riêng
- [ ] Block "uncertain" → defer (không xoá), ghi vào FOLLOWUPS
- [ ] global.css cuối cùng giảm ít nhất 30% dòng (target: từ 2722 → <1900)
- [ ] Visual regression: 0 (compare screenshots Home + Quiz + Landing pre/post)
- [ ] FE tests pass (387)
- [ ] **2-4 commits** (tuỳ vào số block thực sự dead)

---

## Task 5 — Wire 4 Game Mode Accent vào Tailwind

### Mục tiêu
DESIGN_TOKENS.md spec đã có 4 màu Game Mode Accent (Practice/Ranked/Daily/Multiplayer) nhưng chưa wire vào Tailwind config. Wire vào để code dùng được.

### Files affected
- `apps/web/tailwind.config.js`
- `apps/web/src/data/gameModes.ts` hoặc tương đương (nếu tồn tại)
- Optional: `apps/mobile/src/theme/colors.ts` (sync nếu mobile cần)

### Steps

**5.1.** Thêm vào `apps/web/tailwind.config.js`:

```js
// Trong theme.extend.colors:
mode: {
  practice: '#4a9eff',      // blue
  ranked: '#e8a832',        // gold (= secondary, alias để readable)
  daily: '#ff8c42',         // orange
  multiplayer: '#9b59b6',   // purple
}
```

**5.2.** Tìm hardcoded hex matching 4 colors này, thay bằng tokens:

```bash
grep -rnE "#(4a9eff|ff8c42|9b59b6)" apps/web/src --include="*.tsx" --include="*.ts"
```

Replace:
- `#4a9eff` → `mode-practice` (text/bg/border tuỳ context)
- `#ff8c42` → `mode-daily`
- `#9b59b6` → `mode-multiplayer`
- `#e8a832` đã có `secondary` token, không cần đổi

**5.3.** Note conflict với tier colors:
- Tier 3 `#4a9eff` (= mode-practice) → conflict
- Tier 4 `#9b59b6` (= mode-multiplayer) → conflict

Quyết định: **giữ riêng namespace** (`tier-3` và `mode-practice` cùng hex `#4a9eff` nhưng khác semantic). Đừng alias.

**5.4.** Sync mobile (optional — chỉ làm nếu mobile screens cần dùng game mode accent):

```ts
// apps/mobile/src/theme/colors.ts
mode: {
  practice: '#4a9eff',
  ranked: '#e8a832',
  daily: '#ff8c42',
  multiplayer: '#9b59b6',
},
```

**5.5.** Cập nhật `DESIGN_TOKENS.md` đánh dấu Game Mode Accent đã wired.

### Verification

```bash
# Tokens wired
grep -E "mode:" apps/web/tailwind.config.js | head -5
# → có entry

# Sample usage compile
cd apps/web && npm run build
# → pass

# Hardcode còn lại (chỉ nên còn các chỗ KHÔNG phải game mode)
grep -rnE "#(4a9eff|ff8c42|9b59b6)" apps/web/src --include="*.tsx" --include="*.ts" | wc -l
# → giảm so với baseline
```

### Acceptance
- [ ] 4 `mode-*` tokens trong Tailwind
- [ ] Hardcode `#4a9eff`/`#ff8c42`/`#9b59b6` migrated sang tokens
- [ ] DESIGN_TOKENS.md cập nhật
- [ ] Build pass + FE tests pass (387)
- [ ] Commit: `feat(colors): wire 4 game mode accent tokens into Tailwind`

---

## Final regression (sau cả 5 tasks)

```bash
# Web
cd apps/web && npm run build && npx vitest run

# Mobile
cd apps/mobile && npx tsc --noEmit && npx expo start --no-dev --minify
# (Ctrl+C sau khi confirm bundle thành công)

# Test count phải >= baseline
# Baseline: FE 387, BE không đổi (không động backend), Mobile typecheck clean
```

### Append vào `docs/COLOR_AUDIT.md`

Thêm section ở cuối:

```md
---

## Fixes Applied (2026-04-30)

| Task | Commit | Files | Impact |
|---|---|---|---|
| 1 | `<hash>` | tiers.ts + tailwind + tierProgression.ts | Web↔Mobile tier parity 0/6 → 6/6 |
| 2 | `<hash>` | App+AdminLayout | -36 hardcodes, +4 typo fixes |
| 3 | `<hash>` | mobile/colors.ts | -6 dead tokens |
| 4 | `<hash1>`, `<hash2>`, ... | global.css | -X lines, removed Y dead :root blocks |
| 5 | `<hash>` | tailwind + DESIGN_TOKENS.md | +4 game mode tokens wired |

### Remaining tech debt
- Admin warm palette (`#d5c4af`, `#504535`, `#281900`) — see FOLLOWUPS.md
- Hardcoded hex remaining: ~XXX (down from 332)
- ...
```

---

## Constraints

- **Không đụng backend** trong 5 tasks này.
- **Không đụng admin pages** ngoài AdminLayout shell (Users, ReviewQueue, etc. defer).
- **Không thêm package mới**.
- **Không thay đổi visual design** — chỉ thay token, behavior phải identical.
- **Mỗi commit phải build + test pass** trước khi commit.
- Nếu task nào quá phức tạp / có blocker → DỪNG và báo, đừng force-fix.

---

## Definition of Done (toàn bộ 5 tasks)

- [ ] Task 1 commit pushed
- [ ] Task 2 commit pushed
- [ ] Task 3 commit pushed
- [ ] Task 4: 2-4 sub-commits pushed
- [ ] Task 5 commit pushed
- [ ] Final regression pass (Web build + tests, Mobile typecheck)
- [ ] `docs/COLOR_AUDIT.md` cập nhật với section "Fixes Applied"
- [ ] `docs/FOLLOWUPS.md` có ít nhất entry "Admin warm palette"
- [ ] Visual smoke test: Home, Quiz, Leaderboard, Profile, Admin Dashboard — không regression
