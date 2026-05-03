# PROMPT: Color Audit — BibleQuiz

> Mục tiêu: Tạo báo cáo đầy đủ về hiện trạng màu sắc trong codebase BibleQuiz (web + mobile) để có cơ sở quyết định khi tinh chỉnh design system, đặc biệt cho Answer Color Mapping trong multiplayer Quiz screen.

---

## Context

- Monorepo: `apps/web` (React 18 + Vite + Tailwind), `apps/mobile` (React Native + Expo)
- Design system: **Sacred Modernist** (gold trên navy, contemplative tone)
- Tham chiếu chuẩn: `docs/designs/DESIGN_TOKENS.md` (root-level, không ở apps/web)
- Theme file mobile: `apps/mobile/src/theme/colors.ts`
- Tailwind config: `apps/web/tailwind.config.js`
- Global CSS: `apps/web/src/styles/global.css` (utilities: `glass-card`, `gold-gradient`, `gold-glow`)
- Tier naming: **religious** (Tân Tín Hữu → Sứ Đồ) theo DECISIONS.md 2026-04-19. KHÔNG dùng tên cũ "Tia Sáng → Vinh Quang".

---

## Yêu cầu chung

- **KHÔNG đoán, không suy diễn.** Mọi số liệu phải từ tool Grep/Glob/Read thực tế.
- **Dùng tool Grep/Glob của Claude Code, KHÔNG bash grep/find** (sandbox sẽ block).
- **Trích dẫn evidence cụ thể** (file path + line number) cho mọi finding.
- **Phân biệt rõ:** token được khai báo (declared) vs được dùng (used) vs hardcoded (raw hex/rgb trong JSX).
- **Trước khi audit**, ghi 8 tasks vào TODO.md theo format CLAUDE.md (1 task = 1 section của report).

---

## Tasks

### Task 1 — Inventory design tokens (web)

Liệt kê toàn bộ color tokens được khai báo:

1. Đọc `apps/web/tailwind.config.*` → extract `theme.colors` và `theme.extend.colors`
2. Đọc `apps/web/src/global.css` → tìm CSS variables (`--color-*`, `--gold-*`, etc.)
3. Đọc `apps/web/docs/designs/DESIGN_TOKENS.md` → tokens chính thức trong spec

**Output (table):**

| Token name | Hex value | Khai báo ở | Mô tả |
|---|---|---|---|

Sau đó so sánh: token nào trong DESIGN_TOKENS.md mà KHÔNG có trong tailwind config? Token nào trong tailwind mà KHÔNG có trong spec? → flag inconsistency.

### Task 2 — Usage frequency (web)

Với mỗi token từ Task 1, đếm số lần được sử dụng (dùng Grep tool với `output_mode: "count"`):

```
Grep(pattern: "text-gold", path: "apps/web/src", glob: "*.{ts,tsx}", output_mode: "count")
Grep(pattern: "bg-navy",   path: "apps/web/src", glob: "*.{ts,tsx}", output_mode: "count")
Grep(pattern: "glass-card", path: "apps/web/src", glob: "*.{ts,tsx}", output_mode: "count")
```

**Output (table):**

| Token | Usage count | Top 5 files dùng nhiều nhất |
|---|---|---|

Tokens có usage = 0 → flag "dead token" (xóa được).
Tokens có usage > 100 → core tokens (cần ổn định).

### Task 3 — Semantic role mapping

Phân loại mỗi token theo vai trò semantic thực tế (đọc context sử dụng):

| Vai trò | Token được dùng | Ví dụ component |
|---|---|---|
| Primary action (CTA) | ? | GoldButton, ... |
| Background page | ? | AppLayout, ... |
| Background card | ? | glass-card, ... |
| Text primary | ? | ... |
| Text secondary | ? | ... |
| Border default | ? | ... |
| Success (correct answer) | ? | Quiz, RoomQuiz |
| Error (wrong answer) | ? | Quiz, RoomQuiz |
| Warning (timer < 5s) | ? | Quiz, RoomQuiz |
| Tier 1–6 colors (religious: Tân Tín Hữu → Sứ Đồ) | ? | TierBadge, Achievements |

Nếu một vai trò có >1 token được dùng → flag inconsistency (vd: success có chỗ dùng `green-500`, chỗ dùng `emerald-400`).

### Task 4 — Quiz screen deep dive ⭐ (PRIORITY)

Đây là phần quan trọng nhất. Phân tích cách 4 đáp án được render trong:

- `apps/web/src/pages/Quiz.tsx`
- `apps/web/src/pages/RoomQuiz.tsx`
- `apps/web/src/pages/room/RoomOverlays.tsx`
- `apps/mobile/src/screens/quiz/QuizScreen.tsx`
- `apps/mobile/src/screens/multiplayer/RoomQuizScreen.tsx` (nếu có)

**Trả lời cụ thể:**

1. **4 đáp án hiện tại có khác màu nhau không?**
   - Nếu CÓ: liệt kê 4 màu + token name
   - Nếu KHÔNG: tất cả dùng token gì (vd: cùng `glass-card`)?

2. **Vị trí có cố định không?**
   - Layout: 2x2 grid hay 1x4 vertical hay khác?
   - Có shuffle vị trí giữa các câu không? (đọc logic render)

3. **States:**
   - Default state (chưa chọn): màu gì?
   - Hover state: thay đổi gì?
   - Selected state (vừa tap): màu gì?
   - Correct reveal (sau khi submit): màu gì?
   - Wrong reveal: màu gì?
   - Disabled state (sau khi đã chọn, đợi người khác): màu gì?

4. **Letter labels (A/B/C/D):**
   - Có hiển thị không?
   - Nếu có: style thế nào (badge tròn, prefix text, ...)?

5. **Khác biệt web vs mobile:**
   - Layout có giống nhau không?
   - Color tokens có sync không?

**Output:** Một section chi tiết với code snippets minh họa (5-10 lines mỗi snippet), kèm text description ngắn (3-5 dòng) mô tả visual hiện tại của default/correct/wrong states.

### Task 5 — Mobile theme parity check

So sánh `apps/mobile/src/theme/colors.ts` với tailwind config web:

| Color name | Web hex | Mobile hex | Match? |
|---|---|---|---|

Flag mọi mismatch. Mobile thiếu token nào mà web có? Ngược lại?

Cũng check: mobile screens có dùng đúng theme tokens không, hay có hardcode `#xxxxxx` trong StyleSheet?

```
Grep(pattern: "#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b",
     path: "apps/mobile/src/screens", glob: "*.tsx",
     output_mode: "content", head_limit: 30)
```

### Task 6 — Hardcoded colors (technical debt)

Tìm mọi nơi hardcode màu thay vì dùng token. **Loại trừ** `tailwind.config.js`, `apps/web/src/styles/`, `apps/mobile/src/theme/`:

```
# Web — Tailwind arbitrary values (text-[#xxx], bg-[#xxx], border-[#xxx])
Grep(pattern: "(text|bg|border)-\\[#[0-9a-fA-F]{6}\\]",
     path: "apps/web/src", glob: "*.tsx",
     output_mode: "content", head_limit: 50)

# Web — inline style với hex
Grep(pattern: "(color|background|backgroundColor):\\s*['\"]?#[0-9a-fA-F]{3,6}",
     path: "apps/web/src", glob: "*.tsx",
     output_mode: "content", head_limit: 30)

# Mobile — hex trong StyleSheet (regex chỉ match 3 hoặc 6 chars, loại trừ 4/5)
Grep(pattern: "#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b",
     path: "apps/mobile/src", glob: "*.{ts,tsx}",
     output_mode: "content", head_limit: 50)
# Sau đó filter bỏ matches từ apps/mobile/src/theme/colors.ts
```

**Output (table):**

| File | Line | Hardcoded color | Có thể thay bằng token nào? |
|---|---|---|---|

Đếm tổng số hardcoded colors. >50 = high tech debt, cần plan refactor.

### Task 7 — Light/dark mode support

- Tailwind config có `darkMode` enabled không?
- Có file nào dùng `dark:` prefix không? (`grep -rn "dark:" apps/web/src --include="*.tsx" | wc -l`)
- Mobile có theme switching không?

→ Trả lời ngắn: BibleQuiz hiện tại dark-only, single-mode hay đã có light mode?

### Task 8 — Tier color analysis

6 religious tiers (Tân Tín Hữu → Sứ Đồ — xem DECISIONS.md 2026-04-19) — verify mỗi tier có color riêng:

- Tìm file định nghĩa: grep `RankTier` hoặc `tier` trong `apps/web/src/data/`, `apps/web/src/utils/`, hoặc shared types
- Liệt kê 6 màu thực tế đang dùng
- Check: 6 màu này có nằm trong DESIGN_TOKENS.md không, hay là tokens riêng biệt?
- Component nào render tier color? (TierBadge, Profile, Achievements, Leaderboard, ...)

### Task 9 — Contrast ratio cho 4 answer states (WCAG AA)

Với mỗi state ở Task 4 (default / selected / correct / wrong / disabled), tính contrast ratio giữa text color và background color. WCAG AA yêu cầu ≥ 4.5:1 cho text thường, ≥ 3:1 cho large text.

**Output (table):**

| State | Text color | Bg color | Ratio | WCAG AA pass? |
|---|---|---|---|---|

Flag mọi state fail (< 4.5:1) — đây là accessibility bug.

---

## Output deliverable

Tạo file: **`docs/COLOR_AUDIT.md`** (cùng level với `docs/designs/DESIGN_TOKENS.md`) với cấu trúc:

```markdown
# BibleQuiz — Color Audit Report

> Generated: YYYY-MM-DD
> Codebase commit: <git rev-parse HEAD>

## Executive Summary
- Total tokens declared: X
- Total tokens used: Y (Z dead tokens)
- Hardcoded colors found: N
- Web ↔ Mobile parity: X% match
- Major inconsistencies: <list 3-5 chính>

## 1. Token inventory
<Task 1 output>

## 2. Usage frequency
<Task 2 output>

## 3. Semantic roles
<Task 3 output>

## 4. Quiz screen deep dive ⭐
<Task 4 output — chi tiết nhất>

## 5. Mobile parity
<Task 5 output>

## 6. Hardcoded colors
<Task 6 output>

## 7. Mode support
<Task 7 output>

## 8. Tier colors
<Task 8 output>

## 9. Contrast (WCAG AA)
<Task 9 output>

## 10. Findings & recommendations

### Inconsistencies (P0 — fix soon)
1. ...
2. ...

### Tech debt (P1 — refactor when touching)
1. ...

### Observations (P2 — informational)
1. ...
```

---

## Constraints

- **KHÔNG sửa bất kỳ file source code nào.** Đây là read-only audit.
- **KHÔNG cài thêm package.** Chỉ dùng grep/find/cat/awk.
- File output duy nhất: `docs/COLOR_AUDIT.md`. Không tạo file khác.
- Báo cáo bằng **tiếng Việt** (technical terms giữ tiếng Anh).
- Mọi số liệu phải reproducible — kèm command đã chạy nếu cần.

---

## Definition of Done

- [ ] File `docs/COLOR_AUDIT.md` tồn tại, đủ 10 sections
- [ ] Mỗi finding có file:line evidence
- [ ] Task 4 (Quiz screen) có code snippets thực tế
- [ ] Executive summary có số liệu cụ thể (không mơ hồ)
- [ ] Section 10 (Findings) có ít nhất 3 inconsistencies P0 hoặc xác nhận "0 inconsistencies found"
- [ ] Section 9 (Contrast) liệt kê ratio cho mọi answer state, flag những state fail WCAG AA
