# PROMPT: Ranked Dashboard Redesign — Sacred Modernist v2

> **Issue scope:** 16 bugs trong [BUG_REPORT_RANKED.md](../rank/BUG_REPORT_RANKED.md) (3 P0 + 6 P1 + 4 P2 + 3 P3)
> **Reference mockup:** [biblequiz_ranked_redesign_desktop.html](../rank/biblequiz_ranked_redesign_desktop.html) (267 dòng, addresses 13/16 issues = 81%)
> **Target file:** `apps/web/src/pages/Ranked.tsx` (hiện 698 LOC — vượt 300 LOC ceiling per CLAUDE.md → cần extract sub-components trong quá trình refactor)
> **Effort estimate:** 24-30h chia thành 11-12 commits (desktop + mobile responsive + BE additions)
> **Pattern:** áp dụng workflow đã proven trên Home redesign H1-H8 + AppLayout Direction-B + HM-P1-1

---

## 🔄 Phase 0 audit — done 2026-05-01 (sẵn sàng start R1)

### Backend state — endpoints + entities verified

✅ **Available — sử dụng được ngay:**

| Endpoint / field | Lives in | Notes |
|------------------|----------|-------|
| `GET /api/me/ranked-status` | `RankedController:446` | Has `livesRemaining`, `questionsCounted`, `pointsToday`, `cap`, `currentBook`, `bookProgress`, `dailyAccuracy`, `dailyDelta`, `pointsToTop50`, `pointsToTop10`, `resetAt` |
| `GET /api/me/tier-progress` | `UserController:435` | `tierLevel`, `tierName`, `starIndex`, `starProgressPercent`, `starXp`, `nextStarXp` |
| `GET /api/seasons/active` | `SeasonController:47` | Returns `id`, `name`, `startDate`, `endDate` (LocalDate) |
| `GET /api/seasons/{id}/my-rank` | `SeasonController:81` | `rank`, `points`, `questions`, `userId`, `name` |
| `GET /api/seasons/{id}/leaderboard` | `SeasonController:63` | Paginated |
| `GET /api/me/history?limit=20&page=0` | `UserController:290` | Generic session history with `item.mode` field — but NO `?mode=ranked` filter |
| `data/tiers.ts` — `getTierByPoints` + `colorHex` | client | Single source of truth (per H7 reuse) |

❌ **Missing — cần BE add:**

| Field | Where needed | Proposed implementation |
|-------|--------------|------------------------|
| `seasonRank` + `seasonTotalPlayers` + `seasonPoints` on `/ranked-status` | R6 Mùa Xuân card — currently FE has to call `/seasons/active` then `/seasons/{id}/my-rank` (2 round-trips) | Add to `/ranked-status` response (1 call) |
| `seasonRankDelta` (rank today vs yesterday) | R6 "Xu hướng ▲ 2 so với hôm qua" | New field — requires `season_rankings_history` snapshot table OR query `SeasonRanking` for "rank yesterday" computed per-day |
| `pointsToTop100` (in addition to top 50/10) | R5 "Cần 38 điểm để vào top 100" | Trivial extension to existing `pointsToTopN` logic |
| `winRateToday` (= dailyAccuracy renamed for sidebar) | Sidebar "Win rate hôm nay" | **Already returns `dailyAccuracy`** — reuse, no new field |
| `weekHighestCombo` (max consecutive correct in 7 days) | Sidebar "Combo cao nhất tuần" | New aggregation query — `quiz_session_questions` joined by combo metric |
| `?mode=ranked` filter on `/api/me/history` | R8 Trận gần đây section | Add `@RequestParam(required=false) String mode` filter to existing `/api/me/history` |
| `seasonGoal` user pref (Top 50 / Top 10 / Top 1) | Sidebar "Mục tiêu mùa" | Either user-set pref (new `users.season_goal` column) **OR** auto-derive from current rank (e.g., "Top X is 1.5× away") |

### Frontend state — Ranked.tsx 698 LOC

⚠️ **Vi phạm CLAUDE.md** "Component không quá 300 LOC — nếu vượt, tách thành sub-components".

Existing testids đã có (preserve khi refactor):
- `ranked-page`, `ranked-tier-badge`, `ranked-tier-progress-text/bar`
- `ranked-energy-card/display/timer`, `ranked-energy-timer`, `ranked-reset-timer`
- `ranked-questions-counted`, `ranked-today-progress`, `ranked-points-today/delta`, `ranked-accuracy`
- `ranked-current-book`, `ranked-current-book-name`, `ranked-current-book-progress`
- `ranked-season-card`, `ranked-season-rank/points/progress-bar`, `ranked-season-reset-time`

→ Refactor strategy: extract 5-6 sub-components, mỗi component < 150 LOC. Ranked.tsx orchestrator < 200 LOC.

### Mockup CSS vars — same issue như Home redesign

`var(--border-radius-lg)` không tồn tại trong global.css. Convert sang Tailwind `rounded-2xl` / `rounded-xl` khi implement (đã proven trong H1-H8).

### Mobile mockup chưa có

File này chỉ desktop. Áp dụng pattern Home: `md:` Tailwind breakpoints, hide sidebar mobile, stack 2-col → vertical.

---

## Tasks (R1 → R12)

Mỗi R = 1 commit riêng (rollback dễ). Pre-launch path = R1-R9 desktop. Mobile responsive + final regression cuối.

### R1 — Sidebar widgets specific cho Ranked

**Issues:** RK-P0-1 (Streak duplicate), RK-P3-3 (sidebar generic) · **Effort:** 30-45 phút

**Goal:** AppLayout sidebar khi user ở `/ranked` route render 3 context-specific widgets thay vì StreakWidget + DailyMissionWidget generic.

**Implementation options:**

- **Option A (recommend):** AppLayout đọc `useLocation()` → render sidebar widgets conditional theo route. Home + others giữ Streak + Mission, Ranked override với 3 new widgets.
- Option B: Create generic `<RouteSidebarWidgets />` component với route map. Clean nhưng over-engineered.

**3 widgets mới (mockup line 21-35):**

1. **MụcTiêuMùa** (gold tinted) — Hiển thị goal user set / auto + current rank
2. **WinRateHômNay** (blue tinted) — Reuse `dailyAccuracy` từ /ranked-status
3. **ComboCaoNhấtTuần** (orange tinted) — NEW BE field cần add (R10)

**Files:**
- `apps/web/src/layouts/AppLayout.tsx` (route-aware sidebar)
- `apps/web/src/components/sidebar/SeasonGoalWidget.tsx` (new)
- `apps/web/src/components/sidebar/WinRateWidget.tsx` (new)
- `apps/web/src/components/sidebar/WeekComboWidget.tsx` (new)

**Acceptance:**
- Streak widget KHÔNG render khi `/ranked` (giải quyết RK-P0-1 duplicate)
- 3 new widgets render với mockup styling
- Mobile (< md): sidebar hidden như cũ

**Commit:** `feat(ranked): sidebar widgets specific to Ranked route (R1 — RK-P0-1)`

---

### R2 — Header section + tier card redesign

**Issues:** RK-P3-1 (title to 22px), RK-P2-1 partial (Cách chơi link), RK-P1-1 (tier pill styling), RK-P1-2 (single-color progress bar) · **Effort:** 1h

**Goal:** Top of Ranked page = clean header + redesigned tier section per mockup line 40-72.

**Header (mockup 40-46):**
```
Thi đấu Ranked              Cách chơi →
Cạnh tranh điểm số mỗi ngày
```

**Tier section (mockup 48-72):**
- Pill "Tân Tín Hữu" với `bg-gray/15 + border-gray/50 + text-gray` (không phải solid disabled-look)
- Inline "Còn 919 điểm để lên Người Tìm Kiếm" với tier kế tiếp colored
- 5-star sub-tier indicator bên phải
- Progress bar single gold (8.1% fill) — KHÔNG còn blue track
- Sub-text: `81 / 1,000 XP` (left) + `Mục tiêu: tier kế` (right blue muted)

**Files:** `apps/web/src/components/ranked/RankedHeader.tsx`, `apps/web/src/components/ranked/TierProgressCard.tsx`

**Commit:** `feat(ranked): header + tier card redesign (R2 — RK-P3-1, RK-P2-1, RK-P1-1, RK-P1-2)`

---

### R3 — Energy + Streak 2-col cards

**Issues:** RK-P2-4 (energy urgency states), RK-P0-1 partial (Streak as proper card not duplicate) · **Effort:** 1.5h

**Goal:** 2 cards 1.5fr/1fr grid (mockup 74-116).

**Energy card:**
- `⚡ NĂNG LƯỢNG` label + countdown right `Phục hồi sau 23:59:56`
- Big number `100 /100` + descriptor `Đủ chơi ~20 câu`
- 5 segments visual bar (mỗi segment đại diện 20 energy)
- Footer text: `Mỗi câu sai sẽ tốn 5 năng lượng · Trả lời đúng không tốn gì`
- **NEW: Urgency states** (per RK-P2-4 Option A):
  - 100-50: gold #e8a832
  - 50-20: yellow #eab308
  - 20-10: orange #ff8c42 + warning icon
  - <10: red #ef4444 + pulse animation
  - 0: gray + lock icon "Hết năng lượng"

**Streak card:**
- 🔥 + `CHUỖI LIÊN TỤC` orange-tinted bg
- `0 ngày` big number
- Motivational sub-text: `Chơi hôm nay để bắt đầu streak — đạt 7 ngày nhận badge "Chuyên cần"`

**Files:** `apps/web/src/components/ranked/EnergyCard.tsx`, `apps/web/src/components/ranked/RankedStreakCard.tsx`

**Commit:** `feat(ranked): Energy + Streak 2-col cards with urgency states (R3 — RK-P2-4)`

---

### R4 — Stats 2-col (Câu hỏi + Điểm hôm nay) consistent

**Issues:** RK-P1-5 (consistency between 2 cards) · **Effort:** 45 phút

**Goal:** 1fr/1fr grid với 2 cards cùng pattern (mockup 118-150).

**Câu ranked hôm nay card:**
- Label `CÂU RANKED HÔM NAY` + meta `Cap 100/ngày`
- Big number `1 /100` gold
- Thin progress bar 1%
- Sub-text `Còn 99 câu được tính rank hôm nay`

**Điểm hôm nay card:**
- Label `ĐIỂM HÔM NAY` + delta `+10 điểm hôm qua` (blue, from `dailyDelta`)
- Big number `12 điểm` gold
- Gradient bar (gold→blue) 24% fill
- Sub-text `Cần 38 điểm nữa để vào top 100 hôm nay` (NEW: `pointsToTop100` field — R10)

**Files:** `apps/web/src/components/ranked/DailyStatsCards.tsx`

**Commit:** `feat(ranked): consistent 2-col daily stats cards (R4 — RK-P1-5)`

---

### R5 — Mùa Xuân card (replace BẠN Ở ĐÂY marker)

**Issues:** RK-P0-2 (BẠN Ở ĐÂY hardcoded), RK-P1-3 (linear progress bar concept sai), RK-P1-4 (#3 thiếu context), RK-P3-2 (countdown formats) · **Effort:** 1.5h

**Goal:** Replace existing season progress bar (with markers) bằng card mới (mockup 152-186) — **bỏ entire concept** "BẠN Ở ĐÂY" position bar.

**Card content:**
- Header: `🏆 Mùa Xuân 2026` + `Kết thúc sau 47 ngày` (countdown computed from Season.endDate)
- Reward hint: `Top 3 mỗi tier nhận badge "Vinh Quang Mùa Xuân 2026"`
- 3-column stats divider:
  - **HẠNG MÙA**: `#3 / 247` + `Top 1.2%` (percentile = rank/total*100)
  - **ĐIỂM MÙA**: `81` + `Còn 1,000 đến vô địch`
  - **XU HƯỚNG**: `▲ 2` + `so với hôm qua` (NEW: `seasonRankDelta` field — R10)
- Footer link: `Xem bảng xếp hạng đầy đủ →` → `/leaderboard?period=season`

**Logic:**
```ts
const percentile = ((1 - (rank - 1) / totalPlayers) * 100).toFixed(1)
const daysRemaining = differenceInDays(season.endDate, new Date())
```

**Files:** `apps/web/src/components/ranked/SeasonCard.tsx`

**Commit:** `feat(ranked): Mùa Xuân card replacing position bar (R5 — RK-P0-2, RK-P1-3, RK-P1-4, RK-P3-2)`

---

### R6 — Sách hiện tại card (correct copy)

**Issues:** RK-P0-3 (Sách 2/66 vs 2% mastery math), RK-P1-6 (Đổi sách tap area) · **Effort:** 30 phút

**Goal:** Replace ambiguous copy với mockup line 188-210.

**New copy:**
```
Sách hiện tại                                Đổi sang sách khác →

[📖 icon]  Genesis  Sách thứ 1 trong Cựu Ước  [TỔNG HỢP pill]
            ━━━━░░░░░░░░░░░░░░░░  2% mastery · 50 câu
```

- "Sách thứ 1 trong Cựu Ước" thay vì "Sách 2/66" ambiguous
- Mastery percent + question count
- "Đổi sang sách khác →" thành text link section header (clearer than tiny button trên card)

**Files:** `apps/web/src/components/ranked/CurrentBookCard.tsx`

**Commit:** `feat(ranked): clear book copy (R6 — RK-P0-3, RK-P1-6)`

---

### R7 — Trận gần đây section

**Issues:** RK-P2-3 (missing match history) · **Effort:** 1.5h

**Goal:** Match history rows (mockup 212-248) — 3-5 trận gần nhất với check/cross + book + accuracy + time + points earned.

**Row pattern:**
```
[✓ green border] Genesis    5 câu · accuracy 100% · 4 phút trước    +12
[✗ red border]   Genesis    5 câu · accuracy 40% · 1 giờ trước      +3
[✓ green border] Exodus     8 câu · accuracy 87.5% · hôm qua        +18
```

Click row → navigate `/sessions/{id}/review` (existing route).

**Data source:** `GET /api/me/history?mode=ranked&limit=5`. Requires R10 BE filter param.

**Files:** `apps/web/src/components/ranked/RecentMatchesSection.tsx`, `apps/web/src/components/ranked/MatchHistoryRow.tsx`

**Commit:** `feat(ranked): Trận gần đây section (R7 — RK-P2-3)`

---

### R8 — CTA + soft path links

**Issues:** RK-P2-2 (no soft path) · **Effort:** 30 phút

**Goal:** Bottom CTA section (mockup 250-262):

```
[▶ Vào trận đấu]  ← gold filled, full width

Luyện tập trước · Đổi mode chơi · Lịch sử đầy đủ

Tiếp tục Genesis · ~20 câu với năng lượng hiện có
```

3 soft path links nhỏ + contextual subtitle.

**Files:** `apps/web/src/components/ranked/RankedActionFooter.tsx`

**Commit:** `feat(ranked): CTA + soft path actions (R8 — RK-P2-2)`

---

### R9 — Refactor Ranked.tsx orchestrator

**Issues:** Vi phạm 300 LOC ceiling (currently 698 LOC) · **Effort:** 1h

**Goal:** Sau khi extract xong R1-R8 sub-components, Ranked.tsx chỉ orchestrate (~200 LOC):

```tsx
export default function Ranked() {
  // hooks + queries
  return (
    <main data-testid="ranked-page" className="max-w-5xl mx-auto space-y-6">
      <RankedHeader />
      <TierProgressCard ... />
      <div className="grid md:grid-cols-[1.5fr_1fr] gap-3">
        <EnergyCard ... />
        <RankedStreakCard ... />
      </div>
      <DailyStatsCards ... />
      <SeasonCard ... />
      <CurrentBookCard ... />
      <RecentMatchesSection ... />
      <RankedActionFooter ... />
    </main>
  )
}
```

**Acceptance:**
- Ranked.tsx < 250 LOC
- Mọi sub-component < 150 LOC
- Tất cả existing testids preserved (xem Phase 0 list)
- Existing tests pass without modifications (testids stable)

**Commit:** `refactor(ranked): orchestrator < 250 LOC after extraction (R9)`

---

### R10 — BE: 4 missing fields/endpoints

**Issues:** Supports R4, R5, R7, R1 widgets · **Effort:** 2-3h (BE) + tests

**Changes:**

1. **Add to `/api/me/ranked-status`:**
   - `seasonRank: number | null`
   - `seasonTotalPlayers: number | null`
   - `seasonPoints: number | null`
   - `seasonRankDelta: number | null` (rank vs yesterday — requires snapshot OR computed)
   - `pointsToTop100: number | null` (extend existing `getCachedSeasonScoreAtRank` to support N=100)
   - `weekHighestCombo: number | null` (max consecutive correct in last 7 days — query `quiz_session_questions`)

2. **Add `mode` filter to `/api/me/history`:**
   ```java
   @RequestParam(required = false) String mode
   // filter: if (mode != null) sessions = sessions.filter(s -> s.mode == mode)
   ```

3. **Optional: User pref `season_goal`** — if implementing R1 sidebar "Mục tiêu mùa" as user-set value. Alternative: auto-derive (e.g., "Top X = current 1.5× lower").

**Decision needed before implement:** seasonRankDelta calculation strategy:
- A) Snapshot daily — new table `season_ranking_snapshots` with `(season_id, user_id, date, rank)`. Cron job at 00:00 UTC. Cleaner but requires migration + cron.
- B) Computed on-the-fly — query `season_rankings` for "rank yesterday" by comparing points yesterday EOD. Cheaper but requires `points_at_eod` field per UDP.
- C) Defer for v1.1 — R5 hardcode `seasonRankDelta = null`, FE hide column "Xu hướng".

→ **Recommend C** for pre-launch (đơn giản nhất, FE hide gracefully). A/B làm trong v1.1.

**Files:**
- `RankedController.java` (add fields to `/ranked-status`)
- `UserController.java` (add mode filter to `/history`)
- New tests: 4-5 cases trong RankedControllerTest + UserControllerTest

**Commit:** `feat(api): ranked-status season + delta fields, history mode filter (R10)`

---

### R11 — Mobile responsive variant

**Issues:** Scope addition per Home pattern · **Effort:** 2-3h

**Goal:** Áp dụng `md:` Tailwind breakpoints trên 8 sub-components để mobile (< md):
- 2-col Energy/Streak → vertical stack
- 2-col DailyStats → vertical stack
- Season card 3-col → vertical stack
- Match history rows giữ pattern (already 1-col)
- Sidebar widgets hidden (đã handle bởi AppLayout)
- Bottom CTA full-width giữ nguyên

**Files:** all R2-R8 components (Tailwind utility additions only)

**Commit:** `feat(ranked): mobile responsive layout (R11)`

---

### R12 — Final regression + docs

- Tầng 3 FE + Tầng 3 BE
- Update [BUG_REPORT_RANKED.md](../rank/BUG_REPORT_RANKED.md) — mark issues DONE
- Append [DECISIONS.md](../../DECISIONS.md) entry
- Create [BACKEND_GAPS_RANKED_V2.md](../../BACKEND_GAPS_RANKED_V2.md) (if any defer items remaining)

**Commit:** `docs: mark Ranked redesign R1-R11 DONE`

---

## Quy tắc chung

### KHÔNG được làm
- ❌ Touch sidebar widgets generic (`StreakWidget` / `DailyMissionWidget`) — chỉ override on `/ranked` route
- ❌ Hardcode rank position trên progress bar (root cause RK-P0-2)
- ❌ Hardcode `seasonRankDelta` placeholder data — null gracefully nếu BE chưa có
- ❌ Skip 300 LOC ceiling — R9 phải đảm bảo Ranked.tsx + mọi sub-component dưới ngưỡng
- ❌ Refactor business logic (energy decay, point computation, etc.) — chỉ UI/styling

### BẮT BUỘC làm
- ✅ Mỗi R = 1 commit riêng (rollback dễ)
- ✅ Tests pass sau mỗi commit (existing testids preserved)
- ✅ Reuse Home redesign patterns (HeroStatSheet, BibleJourneyCard, LeaderboardRow)
- ✅ Stop-and-confirm sau từng R (per H1-H8 pattern)
- ✅ i18n keys đầy đủ — KHÔNG hardcode Vietnamese
- ✅ Mobile responsive bằng Tailwind `md:` (không JS-based useMediaQuery)
- ✅ Match mockup pixel-perfect — bug report có 4 questions for Bui đã được mockup answer (Mùa Option C, soft path 3 links, history 3-5 rows)

---

## Definition of Done (toàn bộ R1-R12)

- [ ] 12 commits pushed lên branch `feat/ranked-redesign-v2`
- [ ] 13/16 bug report issues closed (P0-1, P0-2, P0-3, P1-1 → P1-6, P2-2, P2-3, P2-4, P3-1, P3-2, P3-3)
- [ ] 3 issues còn lại documented:
  - RK-P2-1 onboarding tutorial → ENHANCEMENT, defer post-launch
  - Mobile mockup variant không có file riêng → applied via Tailwind md:
- [ ] Ranked.tsx < 250 LOC
- [ ] Tests baseline: 1045+ FE pass
- [ ] BE: 274+ tests, no new regressions
- [ ] BUG_REPORT_RANKED.md status table updated
- [ ] DECISIONS.md entry appended
- [ ] Visual review trên dev server: 5 viewports (320 / 375 / 768 / 1024 / 1440 px)

---

## Estimate breakdown

| Task | Type | Effort |
|------|------|--------|
| Phase 0 (done) | Verify | 0 (already done 2026-05-01) |
| R1 Sidebar widgets | FE + new components | 45 phút |
| R2 Header + tier card | FE | 1h |
| R3 Energy + Streak | FE + urgency states | 1.5h |
| R4 Daily stats | FE | 45 phút |
| R5 Mùa card | FE | 1.5h |
| R6 Sách card | FE | 30 phút |
| R7 Match history | FE | 1.5h |
| R8 CTA + soft paths | FE | 30 phút |
| R9 Orchestrator refactor | FE | 1h |
| R10 BE additions | BE + tests | 2-3h |
| R11 Mobile responsive | FE | 2h |
| R12 Final regression | Verify + docs | 1h |
| **Total** | | **~14-15h FE + 2-3h BE = 16-18h** |

(Bug report ước tính 16-22h — actual ~16-18h vì áp dụng patterns đã proven từ Home redesign + một số phương án defer như R10 seasonRankDelta = null.)

---

## Pre-execution checklist

Trước khi start R1, confirm với user:

1. **seasonRankDelta strategy** — A snapshot, B on-the-fly, C defer? **Recommend C.**
2. **Sidebar season goal** — user-set pref hay auto-derive? **Recommend auto-derive cho v1**, user-set v1.1.
3. **Branch** — tạo `feat/ranked-redesign-v2` mới hay tiếp trên `feat/home-redesign-v2`? **Recommend riêng** vì scope độc lập.
4. **Mobile variant** — chỉ Tailwind responsive hay cần mockup mobile riêng? **Tailwind đủ** (per Home precedent).

---

## Liên quan

- [BUG_REPORT_RANKED.md](../rank/BUG_REPORT_RANKED.md) — 16 issues source
- [biblequiz_ranked_redesign_desktop.html](../rank/biblequiz_ranked_redesign_desktop.html) — mockup
- [DECISIONS.md](../../DECISIONS.md) — 2026-05-01 entries (Home redesign + AppLayout + HM-P1-1) làm reference patterns
- [BACKEND_GAPS_HOME_V2.md](../../BACKEND_GAPS_HOME_V2.md) — pattern cho doc deferred BE work
- `apps/web/src/data/tiers.ts` — single source of truth tier colors
- `apps/web/src/components/HeroStatSheet.tsx` — pattern reuse cho R2 tier card
- `apps/web/src/components/BibleJourneyCard.tsx` — pattern reuse cho R5 Mùa card 3-col stats
- `apps/web/src/pages/Home.tsx:LeaderboardRow` — pattern reuse cho R7 match rows

---

*Generated 2026-05-01 — based on BUG_REPORT_RANKED.md (2026-04-30) + audited mockup + Phase 0 BE/FE state verification.*
