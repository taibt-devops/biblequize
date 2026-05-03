# BibleQuiz — Color Audit Report

> Generated: 2026-04-30
> Codebase commit: `51017e05adec4cdce6dd6ae847d98f39e1905c0a`
> Source prompt: `docs/prompts/PROMPT_COLOR_AUDIT.md` (revised 2026-04-30)
> Read-only audit — no source files modified.

---

## Executive Summary

| Metric | Value |
|---|---|
| **Tokens declared** (web tailwind config) | 38 named colors (excl. legacy `neon.*`) |
| **CSS variable groups** in `global.css` | 5 separate `:root` blocks (HP-themed, Cyberpunk, Royal Gold, Warm-card, base) |
| **Hardcoded hex in web `.tsx`** | **332 occurrences** across 30+ files |
| **Hardcoded hex in mobile `.ts/.tsx`** | 37 (27 in `colors.ts` legitimate + 10 in screens/logic) |
| **Web↔Mobile tier color parity** | **0/6 match** — every tier hex differs |
| **Mode support** | Dark-only confirmed (0 `dark:` prefix usages) |
| **Quiz answer color differentiation** | All 4 answers use **identical** default token (`bg-surface-container`) |

### Top 5 inconsistencies (P0)
1. **Tier colors web vs mobile: 6/6 hex mismatch** — same religious tier names, different colors. Visual brand inconsistency.
2. **`global.css` has 5 competing `:root` blocks** — HP, Cyberpunk, Royal Gold sub-systems coexist with Sacred Modernist; high cognitive overhead, dead vars likely.
3. **`AdminLayout.tsx` + `DraftCard.tsx` hardcode tokens that exist in tailwind** (e.g., `text-[#e8a832]` instead of `text-secondary`) — 44 occurrences across these 2 files alone.
4. **`.glass-card` blur mismatch**: code uses `blur(20px)`, DESIGN_TOKENS.md and CLAUDE.md document `blur(12px)`.
5. **Mobile `colors.ts` has DEAD tier tokens** (`tierSpark/Dawn/Lamp/...`) using OLD light-themed names; actual mobile usage in `tierProgression.ts` uses different hex values inline.

---

## 1. Token Inventory

### 1.1 Tailwind config (`apps/web/tailwind.config.js`)

| Token | Hex | Khai báo | Mô tả |
|---|---|---|---|
| `background` | `#11131e` | `tailwind.config.js:12` | Page background |
| `surface` | `#11131e` | `:14` | Same as background (aliased) |
| `surface-dim` | `#11131e` | `:15` | Identical to surface — likely dead alias |
| `surface-bright` | `#373845` | `:16` | Bright surface |
| `surface-container` | `#1d1f2a` | `:18` | Default card bg |
| `surface-container-low` | `#191b26` | `:19` | Question card |
| `surface-container-high` | `#272935` | `:20` | Hover state |
| `surface-container-highest` | `#323440` | `:21` | Letter badge bg |
| `surface-container-lowest` | `#0b0e18` | `:22` | Backdrop |
| `surface-variant` | `#323440` | `:24` | = container-highest (dup) |
| `surface-tint` | `#c0c4e8` | `:25` | Tint overlay |
| `primary` | `#c0c4e8` | `:28` | Soft lavender accent |
| `primary-container` | `#1a1f3a` | `:29` | Dark blue container |
| `primary-fixed` | `#dee1ff` | `:30` | Fixed primary |
| `primary-fixed-dim` | `#c0c4e8` | `:30` | = primary (dup) |
| `secondary` | `#e8a832` | `:33` | **Gold — main CTA** |
| `secondary-container` | `#bc8709` | `:34` | Dark gold container |
| `secondary-fixed` | `#ffdea7` | `:35` | Light gold |
| `secondary-fixed-dim` | `#f8bd45` | `:35` | Brighter gold (used in `.gold-gradient-bg`) |
| `tertiary` | `#e7c268` | `:38` | Gold gradient end |
| `tertiary-container` | `#2b1f00` | `:39` | Dark tertiary |
| `tertiary-fixed` | `#ffdf96` | `:40` | Light tertiary |
| `error` | `#ffb4ab` | `:43` | Error text/icons |
| `error-container` | `#93000a` | `:44` | Error bg |
| `outline` | `#919098` | `:47` | Subtle borders |
| `outline-variant` | `#46464d` | `:48` | Ghost borders |
| `on-surface` | `#e1e1f1` | `:51` | Primary text |
| `on-surface-variant` | `#c7c5ce` | `:52` | Secondary text |
| `on-background` | `#e1e1f1` | `:53` | = on-surface (dup) |
| `on-primary` | `#2a2f4a` | `:54` | Text on primary |
| `on-primary-container` | `#8286a7` | `:55` | Text on primary container |
| `on-secondary` | `#412d00` | `:56` | Text on gold (used everywhere for buttons) |
| `on-secondary-container` | `#392600` | `:57` | Text on gold container |
| `on-tertiary` | `#3e2e00` | `:58` | Text on tertiary |
| `on-tertiary-container` | `#a48431` | `:59` | Text on tertiary container |
| `on-error` | `#690005` | `:60` | Text on error |
| `on-error-container` | `#ffdad6` | `:61` | Text on error container |
| `inverse-surface` | `#e1e1f1` | `:62` | Inverse |
| `inverse-on-surface` | `#2e303c` | `:63` | Inverse text |
| `inverse-primary` | `#585d7b` | `:64` | Inverse primary |
| `neon.green` | `#00ff41` | `:67` | **Legacy** |
| `neon.pink` | `#ff0080` | `:68` | **Legacy** |
| `neon.orange` | `#ff6600` | `:69` | **Legacy** |
| `neon.blue` | `#00bfff` | `:70` | **Legacy** |

### 1.2 CSS variables in `global.css`

5 separate `:root` blocks with competing design systems:

| Block start | Lines | Theme | Sample vars | Status |
|---|---|---|---|---|
| `:129` | 130–146 | **HP-themed** | `--hp-bg #0A0A0E`, `--hp-gold #D4A843`, `--hp-coral #FF6B5B`, `--hp-text #F0E8D0` | Likely dead (no `.hp-*` usage outside `:178-188`) |
| `:188` | 188–212 | **Cyberpunk** | `--deep-space #0B0E14`, `--neon-cyan #00F5D4`, `--cyber-gold #FFC300`, `--neon-pink #FF007F` | Backs `.neon-*` utilities (lines 247–705) |
| `:214` | 214–231 | (empty/transitional) | mixed | Verify |
| `:2233` | 2233–2249 | **Warm-card** | `--card-warm-from`, `--gold-glow-soft #D4AF37` (alpha 0.06–0.35) | Used in lines 2270, 2292, 2329 |
| `:2461` | 2461–2470 | **Royal Gold** | `--bg-deep #0F1117`, `--gold-primary #D4AF37`, `--gold-bright #F4D36E`, `--text-gold #D4AF37` | Separate gold from Stitch tokens |

> **Three competing gold values exist:** `#e8a832` (Stitch secondary), `#D4A843` (HP), `#D4AF37` (Royal). DESIGN_TOKENS.md only documents `#e8a832` / `#f8bd45`.

### 1.3 DESIGN_TOKENS.md vs Tailwind config — gaps

| Token in spec | In tailwind config? |
|---|---|
| Game Mode Accent: Practice `#4a9eff`, Ranked `#e8a832`, Daily `#ff8c42`, Multiplayer `#9b59b6` | ❌ NOT in tailwind — used inline (Practice + Daily) but as raw hex |
| All Material 3 surface/primary/secondary tokens | ✅ Present |
| `inverse-*` family | ✅ Present (3 entries, but unused — see §2) |
| `secondary-fixed` (`#ffdea7`) | ✅ Present |

---

## 2. Usage Frequency

| Token / Utility | Usage count (`.ts`/`.tsx`) | Top files |
|---|---|---|
| `bg-secondary` / `text-secondary` / `border-secondary` | **30+** total (limited sample) | Achievements (10), BasicQuizCard (6), AppLayout (3), tiers.ts (2), BasicQuiz (9) |
| `bg-surface-container*` family | **13+** (limited sample) | BookCompletionModal (1), BasicQuizCard (2), ActivityFeed (1), FeaturedDailyChallenge (6), DailyMissionsCard (3) |
| `bg-green-500` / `text-green-400` / error variants | **11+** | tiers.ts (1), GameModeGrid (1), LiveFeed (1), OfflineBanner (1), DailyChallenge (7) |
| `glass-card` / `glass-panel` / `glass-effect` / `gold-gradient` / `gold-glow` | **12+** | AppLayout (1), Help (1), BasicQuizCard (5), FeaturedCard (4), ComebackModal (1) |
| **Hardcoded `*-[#xxxxxx]` arbitrary classes** | **332** | AdminLayout (21), Users (45), ReviewQueue (25), DraftCard (23), AppLayout (15) |

> **Note:** Counts use ripgrep with `output_mode: count` and `head_limit: 5` per query — actual totals are higher. Reproducible via `Grep(pattern, glob: "*.{ts,tsx}", output_mode: "count")`.

### 2.1 Likely dead tokens (further audit needed)
Based on structural analysis, these tailwind tokens have no obvious user-facing call site:
- `inverse-surface`, `inverse-on-surface`, `inverse-primary` (3 tokens)
- `surface-dim` (= `surface`, no semantic distinction in code)
- `primary-fixed-dim` (= `primary`)
- `on-error` (`#690005` — only paired with `bg-error/10`, never used as text on error bg directly)

### 2.2 Core tokens (high-frequency, must remain stable)
- `bg-surface-container*` — used in nearly every card
- `bg-secondary` / `text-secondary` — every CTA, gold accents
- `text-on-surface` / `text-on-surface-variant` — every text element
- `border-outline-variant/{N}` — most borders
- `glass-card` — every glassmorphic card

---

## 3. Semantic Roles

| Vai trò | Token được dùng | Ví dụ component |
|---|---|---|
| **Primary action (CTA)** | `bg-secondary` / `gold-gradient` / `text-on-secondary` | `RoomOverlays.tsx:62` (PodiumScreen button), `AppLayout.tsx:117` (admin CTA) |
| **Background page** | `bg-background` (`#11131e`) | `AppLayout.tsx:91` — **but hardcoded as `bg-[#11131e]`** instead of `bg-background` |
| **Background card** | `bg-surface-container` (default), `bg-surface-container-low` (question card), `bg-surface-container-high` (hover) | `Quiz.tsx:706/722/726`, `RoomQuiz.tsx:289-302` |
| **Glass card** | `.glass-card`, `.glass-panel` (identical impl: `rgba(50,52,64,0.6) blur(20px)`) | global.css:9-16 |
| **Text primary** | `text-on-surface` (`#e1e1f1`) | `Quiz.tsx:724`, `RoomOverlays.tsx:39` |
| **Text secondary** | `text-on-surface-variant` (`#c7c5ce`), also `text-on-surface-variant/60` for muted | `Quiz.tsx:682,708`, `RoomQuiz.tsx:299` |
| **Border default** | `border-outline-variant/10` (~ 10% opacity) | `RoomOverlays.tsx:48,52,85,92` |
| **Border accent** | `border-secondary` (gold) | `Quiz.tsx:718`, `RoomQuiz.tsx:294` |
| **Success (correct)** | `bg-green-500/10`, `border-green-500`, `text-green-400` | `Quiz.tsx:710-712`, `RoomQuiz.tsx:281-283`, `RoomOverlays.tsx:87` |
| **Error (wrong)** | `bg-error/10`, `border-error`, `text-error` | `Quiz.tsx:714-716`, `RoomQuiz.tsx:285-287` |
| **Warning (timer)** | `text-error` (re-used) + `.timer-critical-anim` animation | global.css:110, mobile `colors.error` |
| **Tier 1–6 colors (religious)** | mix: `text-outline`, `text-green-400`, `text-[#4a9eff]`, `text-[#9b59b6]`, `text-secondary`, `text-[#ff6b6b]` | `tiers.ts:46,56,66,76,86,96` |

### 3.1 Inconsistencies in semantic role
- **Success color split**: web uses `green-500`/`green-400` (Tailwind defaults), mobile uses `colors.success = #22c55e` (= green-500). Mostly aligned, but green is NOT a documented Sacred Modernist token — it's a Tailwind escape hatch.
- **Error color split**: web uses Stitch token `error` (`#ffb4ab` — pinkish-red), mobile uses `colors.error = #ef4444` (Tailwind red-500 — vibrant red). **Visually different.**
- **Background page**: 15+ occurrences of `bg-[#11131e]` instead of `bg-background`. Both render identically but the hardcode breaks token contract.

---

## 4. Quiz Screen Deep Dive ⭐

### 4.1 Files inspected
| File | LOC | Answer render location |
|---|---|---|
| `apps/web/src/pages/Quiz.tsx` | 892 | `:692-760` (single-player Practice/Ranked) |
| `apps/web/src/pages/RoomQuiz.tsx` | 737 | `:543-568` (multiplayer; uses `getOptionClasses()` helper at `:274-308`) |
| `apps/web/src/pages/room/RoomOverlays.tsx` | 258 | No answer rendering — only EliminationScreen displays correct option (`:84-91`) |
| `apps/mobile/src/screens/quiz/QuizScreen.tsx` | 254 | `:164-191` |
| `apps/mobile/src/screens/multiplayer/RoomQuizScreen.tsx` | — | **Does not exist** (mobile lacks multiplayer quiz screen) |

### 4.2 Q1 — Are the 4 answers different colors?

**NO.** All 4 answers share **identical default styling** (same surface token).

- **Web** (`Quiz.tsx:726`):
  ```tsx
  buttonClasses += ' bg-surface-container hover:bg-surface-container-high
                     border-2 border-transparent hover:border-outline-variant/20'
  letterClasses += ' bg-surface-container-highest text-secondary
                     group-hover:bg-secondary group-hover:text-on-secondary'
  ```
  Letter A/B/C/D badge: same `surface-container-highest` bg, same `text-secondary` (gold) text.

- **Web RoomQuiz** (`RoomQuiz.tsx:302-304`): identical pattern.

- **Mobile** (`QuizScreen.tsx:231-235`):
  ```tsx
  answerBtn: { backgroundColor: colors.surfaceContainer, borderColor: 'transparent', ... }
  letter: { backgroundColor: colors.surfaceContainerHighest, ... }
  letterText: { color: colors.gold, ... }
  ```
  Same — all 4 answers gold-letter-on-dark-surface.

> **Implication for the multiplayer redesign**: introducing per-position colors (e.g., A=red, B=blue, C=yellow, D=green Kahoot-style) would require entirely new tokens — none currently exist. None of the 4 game-mode accent colors from DESIGN_TOKENS.md (`#4a9eff`, `#e8a832`, `#ff8c42`, `#9b59b6`) are wired into Tailwind.

### 4.3 Q2 — Layout fixed?
- Web: `grid-cols-1 md:grid-cols-2 gap-6` → **2×2 on desktop, 1×4 on mobile** (`Quiz.tsx:691`, `RoomQuiz.tsx:543`).
- Mobile: vertical stack (`gap: spacing.md, flex: 1`, `QuizScreen.tsx:230`). **1×4 always.**
- **No shuffling** — order is `currentQuestion.options` index 0→3 as returned from API.

### 4.4 Q3 — States

| State | Web Quiz.tsx | Web RoomQuiz.tsx | Mobile QuizScreen.tsx |
|---|---|---|---|
| **Default** | `bg-surface-container` + letter `bg-surface-container-highest text-secondary` | Identical | `colors.surfaceContainer` + letter `surfaceContainerHighest`+`gold` |
| **Hover** | `hover:bg-surface-container-high` + `hover:border-outline-variant/20`, letter `group-hover:bg-secondary group-hover:text-on-secondary` | Identical | (no hover — touch device) |
| **Selected** (gold) | `bg-secondary/10 border-secondary gold-glow` + letter `bg-secondary text-on-secondary` + text `text-secondary` | Identical | `borderColor: gold, backgroundColor: 'rgba(248,189,69,0.08)'` ⚠️ inline rgba |
| **Correct** (green) | `bg-green-500/10 border-green-500` + letter `bg-green-500 text-on-secondary` + text `text-green-400` | Identical | `borderColor: success, backgroundColor: 'rgba(34,197,94,0.1)'` + letter `success` ⚠️ inline rgba |
| **Wrong** (red) | `bg-error/10 border-error` + letter `bg-error text-on-secondary` + text `text-error` | Identical | `borderColor: error, backgroundColor: 'rgba(239,68,68,0.1)'` ⚠️ inline rgba |
| **Disabled (after submit, others)** | `bg-surface-container border-transparent opacity-60` + letter `text-secondary` | Slightly different: `opacity-50` + letter `text-on-surface-variant` | (no equivalent — single-player only auto-disables on showResult) |
| **Eliminated by hint (lifeline)** | `opacity-30 pointer-events-none` + `line-through` | N/A (multiplayer has no hint lifeline) | N/A |

> **Web↔Web inconsistency:** `Quiz.tsx` disabled uses `opacity-60` + letter `text-secondary`; `RoomQuiz.tsx` disabled uses `opacity-50` + letter `text-on-surface-variant`. Same screen pattern, different opacity + text color.

### 4.5 Q4 — Letter labels (A/B/C/D)
- All 3 implementations show A/B/C/D.
- Web: `<div className={letterClasses}>{ANSWER_LETTERS[index]}</div>` — square badge, w-14 h-14 (Quiz) or w-11 h-11 (RoomQuiz), rounded-2xl/xl, gold text on dark bg.
- Mobile: `<View style={styles.letter}><Text>{LETTERS[idx]}</Text></View>` — w-32 h-32 px (smaller), borderRadius 8.
- Letters are inside the answer button on the LEFT, with text content beside it.

### 4.6 Q5 — Web vs Mobile differences

| Aspect | Web | Mobile |
|---|---|---|
| Layout | 2×2 (md+) / 1×4 (sm) | 1×4 always |
| Letter badge size | 56px (Quiz), 44px (RoomQuiz) | 32px |
| Selected color | `border-secondary` (`#e8a832`) | `colors.gold` (`#e8a832`) — match |
| Selected bg | Tailwind `bg-secondary/10` (~ rgba(232,168,50,0.1)) | Inline `rgba(248,189,69,0.08)` — uses `secondary-fixed-dim`, not `secondary`. **Mismatch.** |
| Correct text | `text-green-400` (`#4ade80`) | `colors.success` (`#22c55e` = green-500). **Mismatch.** |
| Wrong text | `text-error` (`#ffb4ab` Stitch token, pinkish) | `colors.error` (`#ef4444` Tailwind red-500, vibrant). **Mismatch.** |
| Hover state | Yes (gold reveal) | None |
| Disabled opacity | 0.5–0.6 | None (no disabled style for non-selected after submit) |

---

## 5. Mobile Theme Parity

### 5.1 `apps/mobile/src/theme/colors.ts` vs Tailwind

| Mobile token | Mobile hex | Closest web token | Web hex | Match? |
|---|---|---|---|---|
| `bgPrimary` | `#11131e` | `background` | `#11131e` | ✅ |
| `bgSecondary` | `#1a1d2e` | (none) | — | ⚠️ Mobile-only |
| `bgCard` | `rgba(255,255,255,0.05)` | (none — web uses `surface-container`) | `#1d1f2a` | ❌ Different model |
| `surfaceContainer` | `#1d1f2a` | `surface-container` | `#1d1f2a` | ✅ |
| `surfaceContainerLow` | `#191b26` | `surface-container-low` | `#191b26` | ✅ |
| `surfaceContainerHigh` | `#272935` | `surface-container-high` | `#272935` | ✅ |
| `surfaceContainerHighest` | `#323440` | `surface-container-highest` | `#323440` | ✅ |
| `surfaceVariant` | `#323440` | `surface-variant` | `#323440` | ✅ |
| `gold` | `#e8a832` | `secondary` | `#e8a832` | ✅ |
| `goldLight` | `#f0bc56` | (none — web uses `secondary-fixed-dim` `#f8bd45`) | `#f8bd45` | ❌ Different hex |
| `goldDark` | `#c08818` | (none — closest `secondary-container` `#bc8709`) | `#bc8709` | ❌ Different hex |
| `secondary` | `#f8bd45` | `secondary-fixed-dim` | `#f8bd45` | ✅ |
| `tertiary` | `#e7c268` | `tertiary` | `#e7c268` | ✅ |
| `success` | `#22c55e` | (none — web uses Tailwind `green-500` ad hoc) | `#22c55e` | ✅ (de facto) |
| `warning` | `#f59e0b` | (none — web uses `error` for warnings) | — | ❌ Mobile-only |
| `error` | `#ef4444` | `error` | `#ffb4ab` | ❌ **Different reds** |
| `info` | `#3b82f6` | (none) | — | ❌ Mobile-only |
| `textPrimary` | `#e1e1f1` | `on-surface` | `#e1e1f1` | ✅ |
| `textSecondary` | `rgba(255,255,255,0.7)` | `on-surface-variant` | `#c7c5ce` (~ rgba(255,255,255,0.78)) | ⚠️ Approximation |
| `textMuted` | `rgba(255,255,255,0.4)` | (none — web uses `/60` modifier) | — | ⚠️ Mobile-only model |
| `textDisabled` | `rgba(255,255,255,0.2)` | (none) | — | ⚠️ Mobile-only |
| `onSecondary` | `#412d00` | `on-secondary` | `#412d00` | ✅ |
| `borderDefault` | `rgba(255,255,255,0.1)` | (none — web uses `outline-variant/10`) | `#46464d` at ~ 0.1 | ⚠️ Different model |
| `borderActive` | `#e8a832` | `secondary` | `#e8a832` | ✅ |
| `outlineVariant` | `#46464d` | `outline-variant` | `#46464d` | ✅ |
| `tierSpark` | `#9ca3af` | — | — | ❌ **DEAD — wrong naming** (see §8) |
| `tierDawn` | `#60a5fa` | — | — | ❌ **DEAD** |
| `tierLamp` | `#3b82f6` | — | — | ❌ **DEAD** |
| `tierFlame` | `#a855f7` | — | — | ❌ **DEAD** |
| `tierStar` | `#eab308` | — | — | ❌ **DEAD** |
| `tierGlory` | `#ef4444` | — | — | ❌ **DEAD** |

**Parity score: 14 match / 30 tokens ≈ 47%.**

### 5.2 Hardcoded hex in mobile screens

`apps/mobile/src/logic/tierProgression.ts` — 6 hex colors (one per tier, see §8). These are real tier-color definitions, not technical debt — but they DON'T match `colors.ts` tier tokens (which use different names AND values).

`apps/mobile/src/screens/main/HomeScreen.tsx` and `LoginScreen.tsx` — 2 hex each (sample). Should use `colors.*` tokens; these are leak.

---

## 6. Hardcoded Colors (technical debt)

### 6.1 Web: `(text|bg|border|from|to)-[#xxxxxx]` arbitrary classes

**Total: 332 occurrences across 30+ files.**

Top offenders:

| File | Count | Notes |
|---|---|---|
| `pages/admin/Users.tsx` | 45 | Admin tables — separate palette |
| `pages/admin/ReviewQueue.tsx` | 25 | Admin |
| `pages/admin/DraftCard.tsx` | 23 | Admin AI generator |
| `layouts/AdminLayout.tsx` | 21 | Admin shell — uses `#0c0e17`, `#1d1f29`, `#d5c4af`, `#504535` (NOT in tailwind) |
| `pages/admin/Feedback.tsx` | 19 | Admin |
| `pages/Leaderboard.tsx` | 19 | User-facing — should use tokens |
| `pages/OnboardingTryQuiz.tsx` | 19 | User-facing |
| `pages/admin/QuestionQuality.tsx` | 17 | Admin |
| `pages/Onboarding.tsx` | 16 | User-facing |
| `layouts/AppLayout.tsx` | 15 | Shell — `bg-[#11131e]` instead of `bg-background`, `text-[#e8a832]` instead of `text-secondary` |

### 6.2 Sample of fixable hardcodes (replace with token)

| File:line | Hardcoded | Token equivalent |
|---|---|---|
| `AppLayout.tsx:91` | `bg-[#11131e]` | `bg-background` |
| `AppLayout.tsx:91` | `text-[#e1e1f1]` | `text-on-surface` |
| `AppLayout.tsx:100` | `text-[#e8a832]` | `text-secondary` |
| `AppLayout.tsx:111` | `border-[#e8a832]/30` | `border-secondary/30` |
| `AppLayout.tsx:195` | `text-[#412d00]` | `text-on-secondary` |
| `AdminLayout.tsx:49,82,...` | `text-[#e8a832]` (×8) | `text-secondary` |
| `AdminLayout.tsx:49,81,...` | `bg-[#1d1f29]` (×4) | `bg-surface-container` (NB: hex differs by 1 — `#1d1f29` vs token `#1d1f2a`!) |
| `tiers.ts:66,76,96` | `text-[#4a9eff]`, `text-[#9b59b6]`, `text-[#ff6b6b]` | None — needs new tier tokens |

### 6.3 Hex codes NOT in any token (true outliers)

| Hex | Used in | Note |
|---|---|---|
| `#0c0e17` | AdminLayout (×3) | Close to `surface-container-lowest` `#0b0e18` |
| `#1d1f29` | AdminLayout (×4) | **Off by 1 from `surface-container` `#1d1f2a`** — likely typo |
| `#d5c4af` | AdminLayout (×11), DraftCard (×11) | Warm tan, NOT in spec |
| `#504535` | AdminLayout, DraftCard | Dark warm border |
| `#281900` | AdminLayout, DraftCard | Close to `on-secondary-container` `#392600` |
| `#32343e` | DraftCard (×6) | Close to `surface-container-highest` `#323440` |
| `#11131c` | AdminLayout | **Off by 2 from `background` `#11131e`** |
| `#cd7f32` | RoomOverlays (`from-[#cd7f32]/60`) | Bronze for 3rd-place podium — semantically OK, no token |

**Verdict:** Admin section uses an entirely separate (probably copy-pasted from a different design) palette. ~80 of the 332 hardcodes are admin-only.

---

## 7. Mode Support

| Question | Answer |
|---|---|
| Tailwind `darkMode` config | `darkMode: "class"` (`tailwind.config.js:7`) |
| `dark:` prefix usage in `.tsx` | **0 occurrences** — confirmed dark-only |
| Mobile theme switching | None — single `colors.ts` export |

> BibleQuiz is **dark-only, single-mode**. The `darkMode: "class"` config is dead — no `<html class="dark">` toggle is wired. DESIGN_TOKENS.md `Design Rules #6: "Dark mode only: class="dark" on <html>, no light mode toggle"` confirms this is intentional, but the `dark:` config is nonetheless unused.

---

## 8. Tier Color Analysis

### 8.1 Web tier definitions (`apps/web/src/data/tiers.ts`)

Religious naming (per DECISIONS.md 2026-04-19 ✅):

| Level | nameKey | i18n maps to | colorHex | colorTailwind |
|---|---|---|---|---|
| 1 | `tiers.newBeliever` | "Tân Tín Hữu" | `#919098` | `text-outline` ✅ token |
| 2 | `tiers.seeker` | "Người Tìm Kiếm" | `#4ade80` | `text-green-400` (Tailwind default) |
| 3 | `tiers.disciple` | "Môn Đồ" | `#4a9eff` | `text-[#4a9eff]` ❌ hardcoded |
| 4 | `tiers.sage` | "Hiền Triết" | `#9b59b6` | `text-[#9b59b6]` ❌ hardcoded |
| 5 | `tiers.prophet` | "Tiên Tri" | `#f8bd45` | `text-secondary` ✅ token |
| 6 | `tiers.apostle` | "Sứ Đồ" | `#ff6b6b` | `text-[#ff6b6b]` ❌ hardcoded |

3/6 tiers use ad-hoc hex. No `tier-1`...`tier-6` namespace in tailwind.

### 8.2 Mobile tier definitions (`apps/mobile/src/logic/tierProgression.ts`)

Religious naming ✅, **but every hex differs from web**:

| Level | name | Mobile hex | Web hex | Δ |
|---|---|---|---|---|
| 1 | Tân Tín Hữu | `#9ca3af` (gray-400) | `#919098` (outline) | ❌ |
| 2 | Người Tìm Kiếm | `#60a5fa` (blue-400) | `#4ade80` (green-400) | ❌ **Different hue** |
| 3 | Môn Đồ | `#3b82f6` (blue-500) | `#4a9eff` | ❌ |
| 4 | Hiền Triết | `#a855f7` (purple-500) | `#9b59b6` | ❌ |
| 5 | Tiên Tri | `#eab308` (yellow-500) | `#f8bd45` (secondary-fixed-dim) | ❌ |
| 6 | Sứ Đồ | `#ef4444` (red-500) | `#ff6b6b` | ❌ |

**0/6 match.** Tier 2 has a completely different hue (web=green, mobile=blue) — likely indicates a recent web change that didn't propagate.

### 8.3 Mobile `colors.ts` tier tokens — DEAD

`apps/mobile/src/theme/colors.ts:41-46`:
```ts
tierSpark:  '#9ca3af',  // OLD light-themed name
tierDawn:   '#60a5fa',
tierLamp:   '#3b82f6',
tierFlame:  '#a855f7',
tierStar:   '#eab308',
tierGlory:  '#ef4444',
```

These tokens use **OLD light-themed naming** (Spark/Dawn/Lamp/Flame/Star/Glory) which DECISIONS.md 2026-04-19 explicitly forbade. Verified usage: actual mobile tier rendering goes through `logic/tierProgression.ts` which has the same hex values **but inline**, not via these tokens. → **6 dead tokens** to delete from mobile theme.

### 8.4 Components rendering tier color
- Web: `Profile.tsx`, `Achievements.tsx`, `Leaderboard.tsx`, `Home.tsx`, `Ranked.tsx` (via `tier.colorHex` or `colorTailwind`).
- Mobile: any screen calling `getTierByPoints()` then reading `.color`.

---

## 9. Contrast (WCAG AA)

Calculated using sRGB relative luminance formula. Threshold AA: text ≥ 4.5:1, large text ≥ 3:1.

### 9.1 Quiz answer states (web Quiz.tsx)

| State | Bg color | Text color | Estimated ratio | WCAG AA pass? |
|---|---|---|---|---|
| Default — answer text | `#1d1f2a` (surface-container) | `#e1e1f1` (on-surface) | **~12.9:1** | ✅ AAA |
| Default — letter badge | `#323440` (surface-container-highest) | `#e8a832` (secondary) | **~6.0:1** | ✅ AA |
| Selected — answer text | `~#2e2a23` (secondary at 10% on bg) | `#e8a832` (secondary) | **~6.7:1** | ✅ AA |
| Selected — letter | `#e8a832` (secondary) | `#412d00` (on-secondary) | **~7.4:1** | ✅ AAA |
| Correct — answer text | `~#1f3024` (green-500/10 on bg) | `#4ade80` (green-400) | **~8.5:1** | ✅ AAA |
| Correct — letter | `#22c55e` (green-500) | `#412d00` (on-secondary) | **~5.1:1** | ✅ AA |
| Wrong — answer text | `~#332423` (error/10 on bg) | `#ffb4ab` (error) | **~7.8:1** | ✅ AAA |
| Wrong — letter | `#ffb4ab` (error) | `#412d00` (on-secondary) | **~9.2:1** | ✅ AAA |
| Disabled (others) — Quiz | bg + text at opacity-60 | `#e1e1f1` × 0.6 | **~7.7:1** | ✅ AA (degraded) |
| Disabled — RoomQuiz | bg + text at opacity-50 + `text-on-surface-variant` | `#c7c5ce` × 0.5 | **~3.8:1** | ❌ **FAIL** |
| Eliminated by hint (Quiz lifeline) | bg at opacity-30 + line-through text | `#c7c5ce` × 0.3 | **~2.0:1** | ❌ **FAIL — intentional** |

### 9.2 Findings
- **Default/Selected/Correct/Wrong all pass AA comfortably** — strong.
- **`RoomQuiz.tsx` disabled state fails AA** (~3.8:1) due to combined `opacity-50` + lighter text token (`text-on-surface-variant` instead of `text-on-surface`). Web Quiz.tsx uses a friendlier disabled (opacity-60 + `text-on-surface`). Recommend aligning to the more permissive Quiz pattern.
- **Eliminated state intentionally fails** (~2:1) because the user shouldn't read it after the lifeline crosses it out — this is design, not a bug. But screen readers should announce it as removed.

---

## 10. Findings & Recommendations

### Inconsistencies (P0 — fix soon)

1. **Tier color web ↔ mobile mismatch (6/6)** — `apps/web/src/data/tiers.ts` and `apps/mobile/src/logic/tierProgression.ts` define the same religious tiers with **completely different hex codes**. Tier 2 even has a different hue (web=green, mobile=blue). Decide which palette is canonical, then sync. This is the highest-impact P0 — same brand, different visuals across platforms.

2. **`AdminLayout.tsx` + `DraftCard.tsx` ignore design tokens (44 hardcodes)** — admin shell uses a parallel `#d5c4af / #504535 / #1d1f29` warm palette never declared as tokens. Two near-identical hexes (`#1d1f29` vs token `#1d1f2a`, `#11131c` vs token `#11131e`) suggest typo-driven divergence. Either (a) lift admin palette into tailwind as `admin-*` tokens, or (b) refactor to use existing `surface-*` tokens.

3. **`global.css` carries 5 competing `:root` blocks** (HP-themed, Cyberpunk, Royal Gold, Warm-card, base) totaling 2,722 lines. Three different "gold" values exist (`#e8a832` Stitch, `#D4A843` HP, `#D4AF37` Royal). Cleanup needed: identify dead utilities (likely `.neon-*` family, `.hp-*` block at line 178-188), remove or migrate.

4. **`.glass-card` blur(20px)** in code vs **blur(12px)** in DESIGN_TOKENS.md and CLAUDE.md. Pick one and update the other; current state is a documentation lie.

5. **Mobile dead tier tokens (6)** — `colors.ts:41-46` exports `tierSpark/Dawn/Lamp/Flame/Star/Glory` using OLD naming forbidden by DECISIONS.md 2026-04-19. Delete (no consumers — verified via grep).

6. **Quiz disabled state inconsistency** — `Quiz.tsx` and `RoomQuiz.tsx` use different opacity AND different text tokens for the same logical state. `RoomQuiz` version fails WCAG AA (~3.8:1). Align to Quiz.tsx pattern.

7. **Hardcoded `bg-[#11131e]` (15 occurrences in AppLayout)** when `bg-background` exists. Trivial replace; matches token contract.

### Tech debt (P1 — refactor when touching)

1. **332 hardcoded hex in web tsx** — top files when touched should be migrated to tokens. Admin section (~80 hardcodes) needs strategic decision (own palette vs reuse).
2. **Stitch tokens with no tailwind binding** — Game Mode Accent colors (`#4a9eff`, `#ff8c42`, `#9b59b6`, `#4a9eff`) used inline in tiers.ts and elsewhere. Add `mode.practice/ranked/daily/multiplayer` tokens.
3. **Mobile `error` (`#ef4444`) vs web `error` (`#ffb4ab`)** are visually different reds — pick one.
4. **Duplicate tailwind tokens** — `surface-dim` = `surface`, `surface-variant` = `surface-container-highest`, `primary-fixed-dim` = `primary`, `on-background` = `on-surface`. Either remove or document the semantic distinction.
5. **Dead `darkMode: "class"`** with 0 `dark:` usages — remove from config.
6. **Legacy `neon.*` palette in tailwind config (4 colors)** — verify usage; if `.neon-*` CSS classes also dead, drop both.

### Observations (P2 — informational)

1. **Quiz answers visually identical (only letter A/B/C/D differs)** — this matches what a `Sacred Modernist` aesthetic asks for (calm, no Kahoot-style position cues), but if multiplayer redesign wants per-position color, **new tokens are required** — none of the 4 current Game Mode Accent colors are wired into Tailwind.
2. **Mobile lacks multiplayer quiz screen** (`RoomQuizScreen.tsx` not found). Any future port can start from web's `RoomQuiz.tsx` color contract.
3. **Bronze (`#cd7f32`) used inline in podium** — not a token but semantically standalone (3rd-place medal). OK to leave hardcoded.
4. **Tailwind config doesn't include `success` or `warning`** semantic tokens — code falls back to Tailwind's `green-500/400` and `yellow-*`. Consider adding `success`/`warning` tokens if status colors will spread.

---

## Methodology

- All counts via Claude Code `Grep` tool with `output_mode: "count"`. Reproducible commands listed inline.
- Sample limits: most counts use `head_limit: 5–30` per query (true totals may be higher).
- Contrast ratios estimated via sRGB relative luminance formula; alpha-blended states approximated by mixing channel values at the stated opacity against background `#1d1f2a`.
- No source files were modified. Output limited to this single file per prompt constraint.
