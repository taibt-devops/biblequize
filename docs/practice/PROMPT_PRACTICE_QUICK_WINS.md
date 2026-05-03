# PROMPT: Practice Page Quick Wins (Sprint 2)

> **Source:** `BUG_REPORT_PRACTICE.md` Sprint 2
> **Scope:** 5 P1 fixes — quick visual + UX improvements
> **Effort:** 1.5-2h total
> **Risk:** Low (chỉ Practice.tsx + 1-2 components nhỏ)
> **Branch:** `fix/practice-quick-wins`

---

## Tổng quan 5 tasks

| Task | Issue ID | Effort | Files |
|---|---|---|---|
| 1 | PR-P1-1 | 30min | LanguageSelector |
| 2 | PR-P1-2 | 15min | QuestionCountSelector |
| 3 | PR-P1-3 | 30min | DifficultySelector |
| 4 | PR-P1-4 | 15min | Practice.tsx (layout) |
| 5 | PR-P1-5 | 5min decision + 15min apply | Practice.tsx (title) |

**Mỗi task = 1 commit riêng**, rollback-friendly.

---

## ⚠️ Trước khi bắt đầu

```bash
# 1. Verify clean working dir
git status  # phải clean

# 2. Tạo branch
git checkout -b fix/practice-quick-wins

# 3. Baseline test count
cd apps/web && npx vitest run | tail -5
# Ghi nhận số test pass — VD: "387 passed"

# 4. Audit cấu trúc Practice.tsx hiện tại
cat apps/web/src/pages/Practice.tsx | head -100
# Hoặc nếu page đã chia thành nhiều components:
find apps/web/src -path '*practice*' -name '*.tsx' -not -path '*test*' | head -20
```

---

## Task 1 — VI/EN Segmented Control (PR-P1-1)

**Mục tiêu:** Đổi 2 buttons rời rạc thành 1 segmented control liền nhau.

### Triệu chứng hiện tại

```
[VI gold filled] [EN dark filled]
   ↑ active        ↑ inactive
```

2 buttons có spacing → trông giống 2 buttons độc lập, không phải 1 toggle.

### Implementation

**Tìm component hiện tại:**

```bash
grep -rn "VI\|EN\|quizLanguage" apps/web/src/pages/Practice.tsx apps/web/src/components --include="*.tsx" | grep -v test
```

**Decision:**
- Nếu đã có component `<LanguageSelector>` riêng → refactor in place
- Nếu inline trong Practice.tsx → có thể giữ inline hoặc tách ra (depend on existing pattern)

**Pattern segmented control:**

```tsx
// Inline pattern (recommend nếu chỉ dùng ở Practice)
<div className="inline-flex bg-surface-container-low rounded-lg p-1">
  <button
    onClick={() => setLanguage('vi')}
    className={cn(
      'px-4 py-2 rounded-md text-sm font-medium transition-colors',
      language === 'vi'
        ? 'bg-secondary text-on-secondary'
        : 'text-on-surface/60 hover:text-on-surface'
    )}
    aria-pressed={language === 'vi'}
  >
    Tiếng Việt
  </button>
  <button
    onClick={() => setLanguage('en')}
    className={cn(
      'px-4 py-2 rounded-md text-sm font-medium transition-colors',
      language === 'en'
        ? 'bg-secondary text-on-secondary'
        : 'text-on-surface/60 hover:text-on-surface'
    )}
    aria-pressed={language === 'en'}
  >
    English
  </button>
</div>
```

**Lưu ý quan trọng:**
- Container có `inline-flex` (không full-width) — chỉ wrap 2 buttons
- Padding outer `p-1` tạo "track" cho segmented
- Background outer dùng `bg-surface-container-low` (or token tương đương trong stack)
- Button radius `rounded-md` nhỏ hơn container `rounded-lg` → "pill in pill" effect
- Không có gap giữa 2 buttons (segmented = liền nhau)
- Label đầy đủ "Tiếng Việt" / "English" thay vì "VI" / "EN" — rõ nghĩa hơn

**Verify token tên:**
```bash
grep -rn "surface-container\|bg-secondary\|on-secondary" apps/web/tailwind.config.* apps/web/src --include="*.tsx" -l | head -5
```

Match với token system thực tế của codebase.

### Acceptance

- [ ] 2 buttons trong cùng container, không có gap
- [ ] Background outer khác inactive button → visible "track"
- [ ] Active state rõ ràng (gold bg + text contrast)
- [ ] Inactive: hover state subtle
- [ ] Labels "Tiếng Việt" / "English" thay vì "VI" / "EN"
- [ ] `aria-pressed` cho a11y
- [ ] Existing test pass
- [ ] Commit: `fix(practice): VI/EN segmented control (PR-P1-1)`

---

## Task 2 — Số câu hỏi buttons cùng size (PR-P1-2)

**Mục tiêu:** 4 buttons (5/10/20/50) cùng width, cùng font-size, không gây layout shift khi switch active.

### Triệu chứng hiện tại

```
[5]  [██10██]  [20]  [50]
sm    HUGE     sm    sm
```

Active "10" có font-size ~32px (gấp đôi inactive ~16px) → grid lệch.

### Implementation

**Tìm component hiện tại:**

```bash
grep -rn "questionCount\|numQuestions\|countOptions" apps/web/src/pages/Practice.tsx apps/web/src/components --include="*.tsx" | grep -v test
```

**Pattern uniform size:**

```tsx
const COUNTS = [5, 10, 20, 50] as const;

<div className="grid grid-cols-4 gap-2">
  {COUNTS.map(count => (
    <button
      key={count}
      onClick={() => setQuestionCount(count)}
      className={cn(
        // Base: cùng size cho mọi state
        'h-12 rounded-lg font-medium text-base transition-colors',
        // States
        questionCount === count
          ? 'bg-secondary text-on-secondary ring-2 ring-secondary/40'
          : 'bg-surface-container text-on-surface/70 hover:text-on-surface hover:bg-surface-container-high'
      )}
      aria-pressed={questionCount === count}
    >
      {count}
    </button>
  ))}
</div>
```

**Lưu ý quan trọng:**
- `h-12` fixed height cho mọi button
- `text-base` cùng font-size mọi button (không jump 16→32)
- Active state: `bg-secondary` + ring outer (KHÔNG change font-size)
- `grid-cols-4` đảm bảo 4 cột bằng nhau
- `gap-2` tạo space giữa buttons (8px)

**Tránh:**
- ❌ `text-2xl` chỉ trên active button
- ❌ `px-8` chỉ trên active button
- ❌ Active button có border thicker (làm width thực khác)

### Acceptance

- [ ] 4 buttons cùng width (test bằng DevTools, đo px)
- [ ] Cùng font-size mọi state
- [ ] Switch active KHÔNG gây layout shift (test: tap 5, tap 50, observe)
- [ ] Active state visually clear (background + ring)
- [ ] Existing test pass
- [ ] Commit: `fix(practice): question count buttons uniform size (PR-P1-2)`

---

## Task 3 — Difficulty buttons có color differentiation (PR-P1-3)

**Mục tiêu:** 4 difficulty buttons có 4 màu khác biệt cho fast scanning.

### Triệu chứng hiện tại

4 buttons cùng dark bg, chỉ khác icon color:
- Tất cả: 🌐 (gold icon)
- Dễ: 😊 (green icon)
- Trung bình: ⚡ (yellow icon)
- Khó: 🔥 (red icon)

### Implementation

**Tìm component hiện tại:**

```bash
grep -rn "difficulty\|easy\|medium\|hard" apps/web/src/pages/Practice.tsx apps/web/src/components --include="*.tsx" | grep -v test
```

**Verify token names:**

```bash
grep -rn "bg-success\|bg-warning\|bg-error\|text-success\|text-warning\|text-error" apps/web/tailwind.config.* apps/web/src --include="*.tsx" | head -10
```

Nếu codebase dùng `success/warning/error` → OK. Nếu dùng tên khác (e.g., `green/orange/red`) → adjust.

**Pattern colored buttons:**

```tsx
const DIFFICULTIES = [
  {
    id: 'all',
    label: 'Tất cả',
    icon: '🌐',
    activeBg: 'bg-secondary/15',
    activeBorder: 'border-secondary/50',
    activeText: 'text-secondary',
    activeRing: 'ring-secondary/20',
    inactiveBg: 'bg-secondary/8',
    inactiveBorder: 'border-secondary/20',
    inactiveText: 'text-on-surface',
  },
  {
    id: 'easy',
    label: 'Dễ',
    icon: '😊',
    activeBg: 'bg-success/15',
    activeBorder: 'border-success/50',
    activeText: 'text-success',
    activeRing: 'ring-success/20',
    inactiveBg: 'bg-success/8',
    inactiveBorder: 'border-success/20',
    inactiveText: 'text-on-surface',
  },
  {
    id: 'medium',
    label: 'Trung bình',
    icon: '⚡',
    activeBg: 'bg-warning/15',
    activeBorder: 'border-warning/50',
    activeText: 'text-warning',
    activeRing: 'ring-warning/20',
    inactiveBg: 'bg-warning/8',
    inactiveBorder: 'border-warning/20',
    inactiveText: 'text-on-surface',
  },
  {
    id: 'hard',
    label: 'Khó',
    icon: '🔥',
    activeBg: 'bg-error/15',
    activeBorder: 'border-error/50',
    activeText: 'text-error',
    activeRing: 'ring-error/20',
    inactiveBg: 'bg-error/8',
    inactiveBorder: 'border-error/20',
    inactiveText: 'text-on-surface',
  },
] as const;

<div className="grid grid-cols-2 gap-2">
  {DIFFICULTIES.map(diff => {
    const isActive = difficulty === diff.id;
    return (
      <button
        key={diff.id}
        onClick={() => setDifficulty(diff.id)}
        aria-pressed={isActive}
        className={cn(
          'p-3 rounded-lg flex items-center gap-2 transition-all border',
          isActive
            ? `${diff.activeBg} ${diff.activeBorder} ring-2 ${diff.activeRing}`
            : `${diff.inactiveBg} ${diff.inactiveBorder} hover:bg-opacity-15`
        )}
      >
        <span className="text-base">{diff.icon}</span>
        <span className={cn(
          'text-sm font-medium',
          isActive ? diff.activeText : diff.inactiveText
        )}>
          {diff.label}
        </span>
      </button>
    );
  })}
</div>
```

**Lưu ý quan trọng:**
- Inactive: opacity 8% bg → subtle hint of color
- Active: opacity 15% bg + border 50% + ring 20% → clearly stronger
- Text color theo difficulty trên active state
- Hover state: tăng opacity nhẹ cho inactive

**Test colorblind:**
Em không biết Bui có tools nào sẵn, nhưng có thể dùng Chrome DevTools → Rendering → Emulate vision deficiencies → Deuteranopia + Protanopia. Verify 4 buttons vẫn distinguishable (icons + labels backup color cues).

**Tránh:**
- ❌ Background quá đậm (lấn át text)
- ❌ Border quá mảnh (không visible trên dark theme)
- ❌ Tailwind arbitrary colors mỗi lần (`bg-[#97C459]/10`) — dùng tokens

### Acceptance

- [ ] 4 buttons có 4 màu khác biệt (gold/green/yellow/red)
- [ ] Active state visually distinct vs inactive (border thicker + ring)
- [ ] Text contrast WCAG AA trên mỗi color bg
- [ ] Hover state subtle
- [ ] Test colorblind: vẫn distinguishable nhờ icons + labels
- [ ] Existing test pass
- [ ] Commit: `fix(practice): difficulty buttons color differentiation (PR-P1-3)`

---

## Task 4 — Toggle "Hiển thị giải thích" full-width row (PR-P1-4)

**Mục tiêu:** Move toggle xuống full-width row dưới 2 cột config → cân bằng layout.

### Triệu chứng hiện tại

Cột phải (Độ khó + Toggle) ngắn hơn cột trái (Ngôn ngữ + Sách + Số câu) → khoảng trắng lớn ở cột phải.

### Implementation

**Cấu trúc mới:**

```tsx
<div className="config-panel">
  {/* 2 cols grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
    {/* Cột trái */}
    <div className="space-y-4">
      <LanguageSelector />
      <BookSelector />
      <QuestionCountSelector />
    </div>

    {/* Cột phải — chỉ Difficulty */}
    <div className="space-y-4">
      <DifficultySelector />
      {/* Smart Selection nếu muốn thêm — em đề xuất trong mockup */}
    </div>
  </div>

  {/* Full-width row — toggle + CTA */}
  <div className="border-t border-border-tertiary/20 pt-4 flex items-center justify-between gap-4">
    {/* Toggle bên trái */}
    <label className="flex items-center gap-3 cursor-pointer">
      <span className="text-sm">💡 Hiển thị giải thích sau mỗi câu</span>
      <Toggle
        checked={showExplanation}
        onChange={setShowExplanation}
        ariaLabel="Hiển thị giải thích"
      />
    </label>

    {/* CTA bên phải */}
    <button
      onClick={handleStart}
      className="bg-secondary text-on-secondary rounded-lg px-6 py-3 font-medium flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
    >
      <span className="material-symbols-outlined text-base">play_arrow</span>
      <span>Bắt đầu luyện tập</span>
    </button>
  </div>

  {/* Sub-text dưới CTA — meta info */}
  <div className="text-center mt-2 text-on-surface/45 text-xs">
    {questionCount} câu hỏi · ~{estimatedMinutes} phút · {scopeLabel}
  </div>
</div>
```

**Lưu ý quan trọng:**
- `border-t` separator giữa 2 cột grid và full-width row
- `flex justify-between` cho row → toggle trái, CTA phải
- Mobile responsive: `grid-cols-1` trên mobile, `md:grid-cols-2` từ tablet+
- Sub-text "10 câu hỏi · ~4 phút · 66 sách" move xuống dưới CTA (PR-P2-2 quick win đi kèm)

### Acceptance

- [ ] 2 cột config có chiều cao tương đương (visual balance)
- [ ] Toggle "Hiển thị giải thích" ở row riêng dưới grid
- [ ] CTA "Bắt đầu" cùng row với toggle, bên phải
- [ ] Mobile (<768px): stack vertical, toggle trên CTA
- [ ] Sub-text meta hiện dưới CTA, không bên trái
- [ ] Existing test pass
- [ ] Commit: `fix(practice): toggle + CTA full-width row (PR-P1-4)`

---

## Task 5 — Title "Luyện Tập" plain (PR-P1-5)

**Mục tiêu:** Bỏ highlight gold "Tập" — title plain để consistency với Ranked / Daily.

### Decision

**Em đã chốt sẵn Option A (recommend trong bug report):**
- Bỏ highlight, title plain `text-on-surface`
- Match với Ranked title (plain "Thi đấu Xếp hạng")
- Đơn giản nhất, không cần commit pattern systematic

Nếu Bui muốn đi Option B (systematic highlight) hoặc Option C (verb highlight) → revert decision này, làm task riêng.

### Implementation

**Tìm title hiện tại:**

```bash
grep -n "Luyện\|Tập" apps/web/src/pages/Practice.tsx | head -10
grep -rn "Luyện\|Tập" apps/web/src/i18n --include="*.json" | head -10
```

**Trước:**

```tsx
<h1 className="text-3xl font-medium">
  Luyện <span className="text-secondary">Tập</span>
</h1>
```

**Sau:**

```tsx
<h1 className="text-3xl font-medium text-on-surface">
  Luyện tập
</h1>
```

**Lưu ý:**
- Đổi cả case: "Luyện Tập" → "Luyện tập" (sentence case, không phải Title Case)
- Vietnamese style guide: chỉ chữ đầu câu viết hoa
- I18n key value cũng update nếu cần

**Document decision:**

Append vào `docs/DECISIONS.md`:

```md
## 2026-04-30: Title styling — plain (no per-word highlight)

Practice page title đổi từ "Luyện **Tập**" (highlight "Tập" gold) sang
"Luyện tập" plain để consistency với Ranked ("Thi đấu Xếp hạng") và
Daily ("Thử thách hàng ngày"). Chọn Option A vì:
- Đơn giản nhất, không cần commit pattern systematic
- Match với pages khác đã không highlight
- Highlight 1 từ random không có meaning rõ

Issue: PR-P1-5 trong BUG_REPORT_PRACTICE.md
```

### Acceptance

- [ ] Title "Luyện tập" plain `text-on-surface`
- [ ] Sentence case (không phải Title Case)
- [ ] DECISIONS.md updated với entry
- [ ] Existing test pass
- [ ] Commit: `fix(practice): plain title styling (PR-P1-5)`

---

## Final regression

**Sau cả 5 tasks:**

```bash
# 1. Build pass
cd apps/web && npm run build

# 2. Tests pass
npx vitest run | tail -5
# Expect: ≥ baseline (387)

# 3. Visual smoke test
# Open /practice in browser
# Verify cả 5 fixes visible:
# ✓ VI/EN segmented liền nhau
# ✓ Số câu hỏi 4 buttons cùng size
# ✓ Difficulty 4 colors khác biệt
# ✓ Toggle full-width row dưới grid
# ✓ Title plain "Luyện tập"

# 4. Mobile viewport check
# DevTools → 375px, 768px, 1024px
# Verify responsive ổn

# 5. Push branch
git push origin fix/practice-quick-wins
```

**Update bug report sau khi xong:**

Trong `BUG_REPORT_PRACTICE.md`, mark 5 issues status `✅ DONE`:

```md
### PR-P1-1: VI/EN toggle...
**Status:** ✅ DONE 2026-04-30 — Segmented control implemented.
**Commit:** [hash]

### PR-P1-2: Số câu hỏi...
**Status:** ✅ DONE 2026-04-30
...
```

---

## ⚠️ Constraints

- **Mỗi task = 1 commit riêng** (5 commits total). KHÔNG gộp.
- **Sau mỗi task: build pass + visual verify** trước khi commit.
- **Không refactor ngoài scope.** Nếu thấy issue khác (vd dropdown sách hardcoded books), ghi vào `docs/FOLLOWUPS.md`.
- **Web-only this turn.** Mobile sync (apps/mobile) là follow-up commit riêng.
- **Không thêm package mới.** Tất cả tasks dùng existing utilities.
- **Token names:** Verify match với codebase thực tế trước khi paste code (em assume `bg-secondary`, `text-success`, etc. — có thể tên khác).

---

## 🤔 Nếu gặp blocker

| Blocker | Action |
|---|---|
| Component đã có và share với page khác (vd LanguageSelector dùng cả Ranked) | Tạo variant riêng cho Practice, không break các page khác |
| Token names khác với code mẫu | Adjust theo token system thực tế của codebase |
| Tests fail do snapshot | Update snapshot nếu visual change đúng intention |
| Mobile responsive break | Thêm media query, test 320/375/768 |
| Build fail Tailwind purge | Đảm bảo dynamic class names (vd `bg-${diff.color}/15`) có safelist nếu cần |

---

## Files manifest (kết quả cuối)

**Modify (chính):**
- `apps/web/src/pages/Practice.tsx` (Tasks 1-5)

**Có thể modify (depends on existing structure):**
- `apps/web/src/components/practice/LanguageSelector.tsx` (nếu component riêng)
- `apps/web/src/components/practice/QuestionCountSelector.tsx`
- `apps/web/src/components/practice/DifficultySelector.tsx`

**Update docs:**
- `docs/DECISIONS.md` (Task 5)
- `BUG_REPORT_PRACTICE.md` (mark 5 issues DONE)

---

## Definition of Done

- [ ] 5 commits pushed lên branch `fix/practice-quick-wins`
- [ ] Tất cả 5 visual changes visible khi mở `/practice`
- [ ] Build pass: `npm run build`
- [ ] Tests pass ≥ baseline
- [ ] Mobile responsive OK ở 320/375/768/1024
- [ ] Colorblind test cho difficulty buttons
- [ ] DECISIONS.md updated
- [ ] BUG_REPORT_PRACTICE.md đánh dấu 5 issues DONE
- [ ] Mobile sync ghi vào FOLLOWUPS.md (cho next sprint)

---

*Generated 2026-04-30 — Quick wins prompt cho Sprint 2 Practice page.*
