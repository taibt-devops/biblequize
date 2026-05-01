# Bug Report — Home Page (Post-Redesign Implementation)

> **Source:** Visual review screenshots 2026-04-30 (desktop + mobile)
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Home.tsx` + `apps/web/src/layouts/AppLayout.tsx`
> **Reference mockups:** Conversation 2026-04-30 (Sacred Modernist redesign — desktop + mobile variants)
> **Decision:** Bui đã chọn **Hướng B** (bỏ top bar trên desktop, giữ trên mobile)
> **Severity overview:** 1× P0 (architecture), 5× P1 (UX), 6× P2 (improvements), 5× P3 (polish) — bao gồm 4 mobile-specific issues

---

## 🔄 Audit 2026-05-01 — sau khi H1-H8 ship trên `feat/home-redesign-v2`

Bug report viết 2026-04-30, **trước** khi 8 commit redesign (H1 `7d05f63` → H8 `555ff74`).
Sau khi đối chiếu code hiện tại trên branch:

| Status | Count | Issue IDs |
|--------|-------|-----------|
| ✅ **FIXED** trên FE + BE | 8 | HM-P1-2, HM-P1-3, HM-P2-2, HM-P2-4, HM-MB-3, HM-P0-1, HM-MB-2, **HM-P1-1** |
| ⚠️ **STILL VALID** — cần fix | 0 | (none on FE/BE) |
| 🟢 **BY DESIGN** — match mockup intent | 4 | HM-P1-4, HM-P2-3, HM-P3-1, HM-P3-2 |
| 💡 **ENHANCEMENT** — vượt mockup, subjective | 2 | HM-MB-1, HM-P3-3 |
| ⏳ **DEPENDS ON** other work | 1 | HM-MB-5 (COLOR_AUDIT Task 1) |
| ℹ️ **NOTE only** | 1 | HM-MB-6 |
| ❌ **INACCURATE CLAIM** | 1 | HM-P0-1 "logo duplicate" — sidebar không có logo |

**Effort còn lại sau audit + 9 fix commits 2026-05-01: 0h trên cả FE và BE cho Home.** Branch `feat/home-redesign-v2` chỉ chờ:
- **HM-MB-5** — chờ COLOR_AUDIT Task 1 (sync 6 tier colors web↔mobile). Không phải refactor riêng cho Home.

Tất cả issues khác đã: (a) FIXED bởi H1-H8 + AppLayout refactor + Direction-3 tabs, (b) BY DESIGN match mockup, (c) ENHANCEMENT vượt mockup defer, (d) NOTE only. **Branch ready để merge sau visual review trên dev server.**

Commits đã ship cho bug report này:
- H1-H8 redesign (`7d05f63` → `555ff74`)
- HM-P0-1 AppLayout Direction-B (`c2fe8fb` → `f5a8da2`, 6 commits)
- HM-MB-2 bottom tabs Direction-3 (`91bb388`)

Status markers (✅/⚠️/🟢/💡/⏳/ℹ️) được thêm vào title từng bug bên dưới — xem phần tương ứng để biết chi tiết audit.

---

## 🎯 Tóm tắt Implementation Status

**Desktop:** 80% mockup được implement đúng (8/10 sections chính khớp).
**Mobile:** 85% mockup được implement đúng (12/14 sections khớp + bonus tốt hơn mockup).

**Gì đã làm tốt (desktop + mobile):**
- Hero compact với greeting + tier pill + sub-tier stars
- Daily Challenge card với badge "CHỈ HÔM NAY"
- Practice + Ranked với hierarchy đúng (desktop side-by-side, mobile vertical)
- 6 mode cards (desktop 3 cột, mobile 2x3 grid) với accent colors
- Daily Missions card với progress bars
- Bible Journey 2-segment bar (Cựu Ước / Tân Ước)
- "Lên hạng để nhận" card với 2 bullets benefits
- Empty state "Bạn là người tiên phong"
- Daily verse footer ở cuối trang

**Mobile-specific tốt:**
- Top header sticky (logo + avatar) + bottom tabs 4 items
- 2 micro-stats Streak + Hôm Nay với colored bg subtle (cam + xanh)
- Empty states actionable (CTA "Mời anh em →" + leaderboard preview)
- Bottom tab "TRANG CHỦ" active gold, 3 tabs còn lại muted
- Tap targets đa số đáp ứng iOS HIG 44px+

**Bonus vượt mockup:**
- Empty state "Bạn chưa có trên bảng xếp hạng" với CTA "CHƠI NGAY →" — Bui handle edge case user mới rất tự nhiên
- Mobile leaderboard hiển thị highlighted row TAI THANH (rank #1, 0 điểm) khi user là only player → tốt hơn empty card
- Practice + Ranked vertical thay vì side-by-side trên mobile — quyết định tốt cho tap target safety

---

## 🔴 P0 — Architecture / Decision

### HM-P0-1: Bỏ top bar trên desktop (Hướng B đã chọn) ✅ DONE 2026-05-01

**Status:** Shipped via 6-commit refactor on `feat/home-redesign-v2` per `docs/prompts/PROMPT_LAYOUT_HUONG_B.md`. Branch commits: `c2fe8fb` → `d4c877f` → `b2929bf` → `7f4da66` → `baa3631` → cleanup. Detailed entry in `DECISIONS.md` 2026-05-01.

Layout post-refactor:
- Desktop (≥ md): NO top bar. Sidebar carries logo + bell + user card (5-item dropdown) + nav + Streak/Mission widgets.
- Mobile (< md): MobileTopBar (logo + bell + avatar) + MobileBottomTabs (4 tabs).
- Both viewports share the same `NotificationBell` + `UserDropdown` components → identical UX, zero menu drift.

❌ **CLAIM SAI:** "Logo Bible Quiz duplicate với sidebar" — sidebar **không có logo** "Bible Quiz", chỉ có user card. Logo chỉ xuất hiện 1 lần ở top bar. Điểm duplicate thực tế là **avatar** (top bar + sidebar) + **tên** (sidebar + hero card), không phải logo. Audit corrected.

**Severity:** Critical · **Type:** Architecture · **Effort:** 2-3h

**Triệu chứng hiện tại:**
Top bar tồn tại trên desktop nhưng không có chức năng:
- Logo "Bible Quiz" góc trái (~~duplicate với sidebar~~ — sidebar KHÔNG có logo, claim sai)
- Avatar "T" góc phải (duplicate với user card sidebar) ✓
- Không có search, không có notification bell, không có dropdown
- Chiếm ~60-70px chiều cao
- Không có border-bottom rõ ràng → "trôi nổi"

**Identity duplicate trong cùng viewport:**
1. Top bar: avatar "T"
2. Sidebar: avatar "T" + tên "TAI THANH"
3. Hero card: text "TAI THANH"

**Decision đã chốt: Hướng B** — bỏ top bar trên desktop, giữ trên mobile.

**Implementation steps:**

**1. Tách layout component theo viewport:**
```tsx
// apps/web/src/layouts/AppLayout.tsx
function AppLayout({ children }: PropsWithChildren) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <div className="...">
      {isMobile && <MobileTopBar />}
      <div className="flex">
        {!isMobile && <Sidebar />}
        <main>{children}</main>
        {isMobile && <MobileBottomTabs />}
      </div>
    </div>
  );
}
```

**2. Sidebar header section** (desktop only):
- Logo "Bible Quiz" trên cùng
- User card (avatar + tên + tier) ngay dưới
- Nav items
- Sidebar footer: notification badge + settings icon (thay cho top bar functions)

**3. Mobile top bar** (mobile only):
- Logo + Bell icon + Avatar (chứa dropdown menu)
- Sticky position
- Border-bottom 0.5px

**4. Notification access** (desktop):
- Sidebar có bell icon ở footer (cạnh streak widget)
- Hoặc inline trong user card với badge số nhỏ

**Files affected:**
- `apps/web/src/layouts/AppLayout.tsx` (major refactor)
- Có thể tạo mới: `apps/web/src/layouts/MobileTopBar.tsx`, `MobileBottomTabs.tsx`
- `apps/web/src/components/Sidebar.tsx` (thêm footer section)

**Acceptance:**
- [ ] Desktop: KHÔNG có top bar, sidebar có đầy đủ identity (logo + user + nav)
- [ ] Mobile: CÓ top bar (logo + bell + avatar) + bottom tabs
- [ ] Notification bell accessible từ cả 2 viewport (sidebar footer trên desktop, top bar trên mobile)
- [ ] User identity hiển thị 1 lần per viewport (không duplicate)
- [ ] Logo "Bible Quiz" hiển thị 1 lần per viewport
- [ ] Visual regression test: 4 viewport (375px / 768px / 1024px / 1440px)

---

## 🟠 P1 — UX Issues

### HM-P1-1: 6 mode cards thiếu live data ✅ DONE 2026-05-01 (4/4 dynamic + 2 static)

**Audit 2026-05-01 → fix 2026-05-01:** H4 commit `918fd75` shipped 4/6 wired (multiplayer + weekly + mystery + speed). HM-P1-1 followup commit shipped the 2 missing BE endpoints + FE wiring same day. All 6 cards now render their intended hint.

| Card | Live data status | API |
|------|------------------|-----|
| Nhóm Giáo Xứ | ✅ "Trong {name}" / "Bạn chưa có nhóm" | `GET /api/groups/me` (shipped) |
| Phòng Chơi | ✅ "{N} phòng đang mở" | `/api/rooms/public` |
| Giải Đấu | ✅ "{N} đấu trường đang mở" | `GET /api/tournaments/upcoming` (shipped) |
| Chủ Đề Tuần | ✅ theme name | `/api/quiz/weekly/theme` |
| Mystery Mode | ✅ "+50% XP" | static |
| Speed Round | ✅ "+100% XP" | static |

**Severity:** High · **Type:** Content · **Effort:** 1h FE wiring sau khi BE ready (~2-3h tổng cả BE)

**Triệu chứng:**
3 cards đã có content tốt:
- ✅ Chủ Đề Tuần: "Tinh yêu thương" (theme name)
- ✅ Mystery Mode: "+50% XP"
- ✅ Speed Round: "+100% XP"

3 cards còn lại **thiếu live data**, chỉ có generic label:
- ❌ Nhóm Giáo Xứ: chỉ "Hội thánh"
- ❌ Phòng Chơi: chỉ "2-20 người" (sau H4: "X phòng đang mở" ✅)
- ❌ Giải Đấu: chỉ "Bracket 1v1"

**Đề xuất theo mockup:**
| Card | Live data đề xuất | API source |
|---|---|---|
| Nhóm Giáo Xứ | Nếu user chưa có nhóm: "Bạn chưa có nhóm" (CTA mềm)<br>Nếu có: "X anh em đang online" | `GET /api/me/groups` |
| Phòng Chơi | "X phòng đang mở" (FOMO nhẹ) | `GET /api/rooms?status=open&limit=0` |
| Giải Đấu | "Tournament mới sau X ngày" hoặc "X tournament đang diễn ra" | `GET /api/tournaments?status=upcoming&limit=1` |

**Files affected:**
- `apps/web/src/pages/Home.tsx` (component ExploreMoreSection hoặc tương đương)
- Có thể cần new API hooks: `useGroupsCount`, `useOpenRoomsCount`, `useUpcomingTournament`
- Backend: verify endpoints có support filter + limit query params

**Acceptance:**
- [ ] 6/6 cards có 1 dòng live data hoặc content hint
- [ ] Loading state cho live data (skeleton thay vì empty)
- [ ] Error state graceful (fallback về generic text nếu API fail)
- [ ] Cache 5 phút để tránh hammering backend

---

### HM-P1-2: Sub-tier stars copy "0/200 XP" gây confusion ✅ FIXED bởi H1

**Audit 2026-05-01:** H1 commit `7d05f63` rewrote HeroStatSheet với progress thật từ `tier-progress.starXp/.nextStarXp`. User 81 XP tier 1 → display "**81 / 200 XP đến sao kế**" (Option A đã chọn). Bug closed.

[HeroStatSheet.tsx:81-86](../apps/web/src/components/HeroStatSheet.tsx#L81):
```ts
const starXp = tierProgressData?.starXp ?? 0
const nextStarXp = tierProgressData?.nextStarXp ?? starXp
const starWindow = Math.max(1, nextStarXp - starXp)
const pointsInCurrentStar = Math.max(0, totalPoints - starXp)
```

**Severity:** Medium · **Type:** Copy · **Effort:** 15min

**Triệu chứng:**
Hero card hiển thị:
- "0 / 200 XP đến sao kế" (sub-tier stars)
- Nhưng phía dưới "LÊN HẠNG ĐỂ NHẬN" card hiện "**81 / 1.000 XP**"

→ User confused: "Tôi có 0 XP hay 81 XP?"

**Root cause:**
Logic đúng: user có 81 XP, sub-tier 1 cần 200 XP → "đã qua sao 0, đang đi đến sao 1, cần 200 XP để đạt sao 1". Nhưng copy "0/200" hiểu nhầm là "có 0 XP".

**Đề xuất fix:**

**Option A:** Hiển thị progress thực:
```
81 / 200 XP đến sao kế ★
```

**Option B:** Đổi narrative:
```
Sao 1: cần 119 XP nữa
```

**Option C:** Hiển thị tổng:
```
81 XP · Còn 119 XP đến ★
```

**Recommend:** Option A — đơn giản, rõ ràng, nhất quán với "X / Y" format.

**Files affected:**
- `apps/web/src/components/TierProgressBar.tsx` (hoặc component hero greeting)

**Acceptance:**
- [ ] Copy nhất quán giữa hero card và "Lên hạng" card (cùng 81 XP)
- [ ] User không nhầm "0 XP"
- [ ] Test với edge cases: user mới (0 XP), user gần lên sao (199 XP), user vừa lên sao (200 XP)

---

### HM-P1-3: Sub-tier stars không dynamic theo XP ✅ FIXED — verification, logic đã đúng

**Audit 2026-05-01:** Logic verification pass. [HeroStatSheet.tsx:160-163](../apps/web/src/components/HeroStatSheet.tsx#L160) `renderStars(starIndex)` returns ★ × earned + ☆ × remaining. Backend `TierProgressService.getStarInfo()` đã có boundary tests trong [tiers.test.ts:71-81](../apps/web/src/data/__tests__/tiers.test.ts#L71). Bug report's "4 sao đều xám" là **behavior đúng** khi user < 200 XP, không phải logic bug.

**Severity:** Medium · **Type:** ~~Logic Bug~~ Verification request · **Effort:** 30min

**Triệu chứng:**
Mockup em vẽ: **1 sao gold (★) + 4 sao xám (☆)** thể hiện "user đã đạt sao 1, chưa đạt 4 sao còn lại".

Implement hiện tại: **4 sao đều cùng màu xám** — nếu user có 81 XP < 200 thì OK (chưa đạt sao nào), nhưng cần verify logic.

**Verification:**
```bash
# Find component
grep -rn "sao kế\|subTierStar\|getStarInfo" apps/web/src --include="*.tsx"
```

**Logic cần đảm bảo:**
```ts
const totalStars = 5;
const xpPerStar = 200;
const earnedStars = Math.floor(currentXP / xpPerStar);
// Render: earnedStars sao gold, (totalStars - earnedStars) sao xám
```

**Test với 5 user states:**
- 0 XP → 0 sao gold
- 199 XP → 0 sao gold
- 200 XP → 1 sao gold
- 999 XP → 4 sao gold
- 1000 XP → tier up celebration (không phải 5 sao gold)

**Files affected:**
- `apps/web/src/components/TierProgressBar.tsx` hoặc tương đương
- Backend: verify `TierProgressService.getStarInfo()` (theo TODO.md TP-1 đã done)

**Acceptance:**
- [ ] Sao gold count = `Math.floor(xp / 200)`
- [ ] Sao xám = remaining
- [ ] Test với 5 states ở trên
- [ ] Có animation khi user đạt sao mới (pop + glow)

---

### HM-P1-4: Section label "Chế độ chính" thừa 🟢 BY DESIGN — match mockup

**Audit 2026-05-01:** Mockup desktop [proposal.html:79](../docs/designs/biblequiz_home_redesign_proposal.html#L79) **CÓ** label "Chế độ chính" làm category eyebrow. H3 implementation match mockup pixel-perfect ([GameModeGrid.tsx:174-179](../apps/web/src/components/GameModeGrid.tsx#L174)). Bug **disagree với mockup intent**, không phải bug — designer judgment call. Bỏ thì OK, giữ cũng OK.

**Severity:** Low · **Type:** Copy · **Effort:** 5min

**Triệu chứng:**
Section "Chế độ chơi" có 2 labels:
- Trái: "Tiếp tục hành trình"
- Phải: "Chế độ chính"

Label phải redundant — đã có context từ "Tiếp tục hành trình".

**Đề xuất:**
- Bỏ label "Chế độ chính" hoàn toàn
- Hoặc thay bằng link mềm: "Xem tất cả →" dẫn đến `/quiz/modes`

**Files affected:**
- `apps/web/src/pages/Home.tsx`

**Acceptance:**
- [ ] Section chỉ có 1 label "Tiếp tục hành trình"
- [ ] Hoặc nếu giữ 2 labels, label phải có chức năng (link/action)

---

## 🟡 P2 — Improvements

### HM-P2-1: Top bar hiện tại lãng phí space (sẽ giải quyết khi làm P0)
**Severity:** Medium · **Type:** Layout · **Effort:** Bao gồm trong HM-P0-1

Đã được giải quyết bởi HM-P0-1 (Hướng B). Section này chỉ để track.

---

### HM-P2-2: Icon "🌱" cho "0 câu hôm nay" không phù hợp semantic ✅ FIXED bởi H1

**Audit 2026-05-01:** H1 đã dùng 🎯 (target) per Option đề xuất. [vi.json `home.hero.questionsToday`](../apps/web/src/i18n/vi.json) = `"🎯 {{count}} câu hôm nay"`. 🌱 đã được tái dùng cho activity card empty state ("Bạn là người tiên phong" 🌱) — match mockup intent.

**Severity:** Low · **Type:** Visual · **Effort:** 5min

**Triệu chứng:**
Hero card có 2 micro-stats:
- "📖 Đang đọc Genesis" — OK, sách phù hợp
- "🌱 0 câu hôm nay" — **kỳ lạ**, sprout không liên quan đến số câu hỏi

**Đề xuất:**
- 🎯 (target) cho "câu hỏi" — nhấn mạnh aim
- 📝 (memo) cho "câu hỏi" — nhấn mạnh writing/answering
- 💡 (lightbulb) cho "câu hỏi" — nhấn mạnh learning
- ❓ (question) — direct match

🌱 nên dành cho:
- Streak/growth metric ("🌱 streak ngày 1")
- Journey progress ("🌱 đang ở Genesis")
- Onboarding ("🌱 mới gia nhập")

**Files affected:**
- `apps/web/src/pages/Home.tsx` (hero greeting section)

**Acceptance:**
- [ ] Icon match semantic của metric
- [ ] Icon library nhất quán (emoji vs Material Symbols)

---

### HM-P2-3: Tier pill "Tân Tín Hữu" position lệch khỏi cluster greeting 🟢 BY DESIGN

**Audit 2026-05-01:** [HeroStatSheet.tsx:88-110](../apps/web/src/components/HeroStatSheet.tsx#L88) dùng `flex items-start justify-between gap-3` — pill ở góc phải, greeting/name ở trái với khoảng giữa do `justify-between`. Match mockup line 30-36 pixel-perfect. Khoảng trắng là **intent** (visual breathing room), không phải bug.

**Severity:** Low · **Type:** Layout · **Effort:** 15min

**Triệu chứng:**
Hero card có:
- Trái: "CHÀO BUỔI SÁNG · TAI THANH"
- Phải: pill "Tân Tín Hữu" — nhưng nằm xa khỏi cluster trái, có khoảng trắng lớn ở giữa

**Đề xuất:**
- Dùng `flex justify-between align-items-center` chặt hơn
- Hoặc gộp pill vào cluster trái dưới greeting:
  ```
  CHÀO BUỔI SÁNG
  TAI THANH [Tân Tín Hữu]
  ```

**Files affected:**
- `apps/web/src/pages/Home.tsx` (hero section)

**Acceptance:**
- [ ] Visual cluster greeting + tier pill cohesive
- [ ] Test ở viewports khác nhau (1024px, 1280px, 1440px, 1920px)

---

### HM-P2-4: Practice button outline gold — decision có chủ ý hay accident? ✅ FIXED bởi H3

**Audit 2026-05-01:** Bui đã decide **Option B (blue)** trước khi H3 ship. H3 commit `76b6d06` rewrote FeaturedCard với theme prop ('blue' | 'gold'). Practice giờ full blue theme: blue bg + blue border + blue icon + blue outline button. PL-3 gold-outline intermediate state đã bị superseded.

[FeaturedCard.tsx:54-62](../apps/web/src/components/FeaturedCard.tsx#L54): `THEMES.blue` config. [GameModeGrid.tsx:182-200](../apps/web/src/components/GameModeGrid.tsx#L182) dùng `theme="blue"` cho Practice.

**Severity:** Low · **Type:** Decision · **Effort:** 15min nếu đổi

**Triệu chứng:**
Mockup em vẽ: Practice button outline **xanh** (`#4a9eff`) để khác biệt với Ranked gold.
Implement: Practice button outline **gold** — vẫn dùng gold theme.

**Phân tích:**
- Pro của outline gold: giữ Sacred Modernist tone đơn sắc, không introduce blue
- Pro của outline blue: differentiate clearer giữa Practice (relaxed) vs Ranked (competitive)

**Câu hỏi cho Bui:** Decision này có chủ ý hay accident?

**Nếu có chủ ý:** OK, ghi vào DECISIONS.md để future devs hiểu.
**Nếu accident:** Decide lại — Bui muốn:
- A. Giữ outline gold (Sacred Modernist purity)
- B. Đổi outline blue (visual differentiation)

**Files affected:**
- `apps/web/src/pages/Home.tsx` (Practice card)
- `docs/DECISIONS.md` (ghi decision)

**Acceptance:**
- [ ] Decision documented trong DECISIONS.md
- [ ] Nhất quán với pattern xuyên suốt app (nếu Practice ở các nơi khác cũng có button)

---

## 🟢 P3 — Polish (defer)

### HM-P3-1: Daily Challenge countdown timer mờ 🟢 BY DESIGN

**Audit 2026-05-01:** Mockup desktop line 70: `color: rgba(255,255,255,0.4)` — chính xác 40% opacity, intentional muted. Mobile mockup line 69: `rgba(255,255,255,0.35)` — còn muted hơn. H2 implementation `text-on-surface-variant/40` match mockup. Bug muốn tăng readability nhưng **mockup intent là làm subtle** (countdown < CTA importance).

**Severity:** Very Low · **Type:** Visual · **Effort:** 10min

**Triệu chứng:**
"Mới sau 23:20:50" góc phải Daily card font khá nhỏ + opacity thấp → khó đọc.

**Đề xuất:**
- Tăng contrast: opacity 0.8 thay vì 0.4
- Hoặc thêm icon ⏱ trước countdown
- Hoặc tăng font 11px → 12px

**Files affected:**
- `apps/web/src/pages/Home.tsx` (Daily Challenge card)

---

### HM-P3-2: Bible Journey segment colors có thể gradient mượt hơn 🟢 BY DESIGN

**Audit 2026-05-01:** Mockup [proposal.html:210](../docs/designs/biblequiz_home_redesign_proposal.html#L210) `gap: 3px` giữa OT và NT — hard edge intentional. H6 implementation [BibleJourneyCard.tsx:90](../apps/web/src/components/BibleJourneyCard.tsx#L90) `gap-[3px]` match mockup. Bug đề xuất gradient = vượt mockup. Subjective.

**Severity:** Very Low · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
2 segments (blue Cựu Ước + purple Tân Ước) có **hard edge** giữa.

**Đề xuất (optional):**
- Gradient mượt: `linear-gradient(90deg, #4a9eff 0%, #4a9eff 59%, #a855f7 59%, #a855f7 100%)` (39:27 ratio)
- Hoặc gap 2px giữa 2 segments để tách rõ
- Hoặc giữ nguyên (hard edge cũng OK)

**Files affected:**
- `apps/web/src/components/JourneyProgressCard.tsx` hoặc tương đương

---

### HM-P3-3: Bảng Xếp Hạng empty state có thể thêm preview 💡 ENHANCEMENT (vượt mockup)

**Audit 2026-05-01:** Đề xuất "Hôm nay đứng đầu: An Nguyễn (450 điểm)" preview là enhancement vượt mockup hiện tại. Mockup chỉ có empty state phẳng. EmptyLeaderboardCTA hiện đang đủ mockup. Defer.

**Severity:** Very Low · **Type:** Enhancement · **Effort:** 1h

**Triệu chứng:**
Empty state hiện tại đẹp, nhưng có thể thêm preview top 1 user để tạo aspiration:
```
🌱 Bạn chưa có trên bảng xếp hạng
Chơi 5 câu để bắt đầu xuất hiện

Hôm nay đứng đầu: An Nguyễn (450 điểm)  ← preview
[CHƠI NGAY →]
```

**Files affected:**
- `apps/web/src/pages/Home.tsx` (LeaderboardCard component)

---

## 📱 Mobile-specific issues (post-mobile-implement)

> Section này thêm sau khi review screenshot mobile responsive 2026-04-30.
> Các issues chung với desktop (live data, sub-tier copy, sub-tier logic) đã có ở phần trên — không lặp lại.

### HM-MB-1: 6 mode cards thiếu tap indicator (mobile-critical) 💡 ENHANCEMENT (vượt mockup)

**Audit 2026-05-01:** Mockup mobile [biblequiz_home_redesign_mobile.html:101-147](../docs/designs/biblequiz_home_redesign_mobile.html#L101) **KHÔNG có** arrow indicators. Mockup chỉ có 1 dot indicator nhỏ trên Phòng Chơi (line 113 — active state). H4 [CompactCard.tsx:65](../apps/web/src/components/CompactCard.tsx#L65) render là `<button>` clickable nhưng không có arrow — match mockup intent. Bug đề xuất ENHANCEMENT vượt mockup. Subjective UX call.

**Severity:** P1 (mobile-critical, P2 desktop) · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
6 mode cards trong "Khám phá thêm" có **icon + tên + meta** nhưng KHÔNG có button hoặc indicator "tap to enter".

**So sánh trong viewport:**
- Practice/Ranked card: có button "Bắt đầu" / "Vào trận" rõ → tappable
- 6 mode cards: không có button → ambiguous

Trên mobile, user cần affordance rõ vì:
- Không có hover state để discover interactivity
- Tap target không rõ → user không biết tap vào đâu (icon? text? cả card?)
- Pattern card khác (Daily Mission rows) cũng không tappable → user có thể assume mode cards cũng không tappable

**Đề xuất fix:**

**Option A (recommend):** Thêm icon `→` góc phải mỗi card
```
┌────────────────────┐
│ ⛪              →  │
│ Nhóm Giáo Xứ      │
│ Hội thánh          │
│ Bạn chưa có nhóm   │
└────────────────────┘
```

**Option B:** Cả card có active state (background highlight on tap, scale 0.98)

**Option C:** Thay "Hội thánh" subtitle bằng button-like text "Tham gia →"

**Files affected:**
- `apps/web/src/pages/Home.tsx` (ExploreMoreSection hoặc tương đương)

**Acceptance:**
- [ ] User scan 1 giây biết card là tappable
- [ ] Tap area = cả card (không chỉ icon)
- [ ] Active state visual feedback khi tap
- [ ] Test trên iPhone SE 320px

---

### HM-MB-2: Bottom tabs labels có thể wrap ở viewport hẹp ✅ DONE 2026-05-01

**Status:** Implemented Direction-3 (label only when active) in `MobileBottomTabs.tsx`. Inactive tabs show the icon only; the active tab renders an icon + label pill. Only one label is on screen at any time, and the pill flexes to its content width — eliminates the wrap risk on 320px viewports. `safe-area-inset-bottom` honored for iPhone home indicator.

**Severity:** P2 · **Type:** Responsive · **Effort:** 30min test + fix

**Triệu chứng:**
4 tabs labels: "TRANG CHỦ" / "XẾP HẠNG" / "NHÓM" / "CÁ NHÂN".
- "TRANG CHỦ": 9 ký tự, 2 từ (risk wrap)
- "XẾP HẠNG": 8 ký tự, 2 từ (risk wrap)
- "CÁ NHÂN": 7 ký tự, 2 từ (risk wrap)
- "NHÓM": 4 ký tự (safe)

Trên iPhone SE 320px (width / 4 tabs = 80px/tab, trừ padding ~64px usable), labels 2 từ có thể wrap thành 2 dòng hoặc bị cắt ellipsis.

**Verification:**
```bash
# Test viewport 320px (iPhone SE)
# Hoặc chạy Chrome DevTools responsive mode 320×568
```

**Đề xuất fix:**

**Option A:** Rút gọn labels (preferred — concise + clear):
- "TRANG CHỦ" → "TRANG"
- "XẾP HẠNG" → "BXH" hoặc "RANK"
- "NHÓM" → giữ nguyên
- "CÁ NHÂN" → "PROFILE" hoặc "CỦA TÔI"

**Option B:** Giảm font 10px → 9px (reluctant — đã ở minimum)

**Option C:** Bỏ labels, chỉ giữ icons + tooltip on long-press (risky — UX ambiguous)

**Files affected:**
- `apps/web/src/components/MobileBottomTabs.tsx` (sẽ tạo từ HM-P0-1)

**Acceptance:**
- [ ] Test trên 320px / 360px / 375px / 414px viewport
- [ ] Labels không wrap, không bị cắt
- [ ] Font size ≥ 10px (không nhỏ hơn iOS HIG khuyến cáo)

---

### HM-MB-3: Practice card có 2 mức outline gold gây visual noise ✅ FIXED bởi H3

**Audit 2026-05-01:** Sau H3 commit `76b6d06`, Practice card chuyển từ gold theme sang **full blue theme**. Không còn gold layer nào trên Practice card. Visual noise issue mặc nhiên biến mất. Bug closed.

**Severity:** P3 · **Type:** Visual · **Effort:** 15min

**Triệu chứng:**
Trên mobile (vertical stack), Practice card hiển thị:
- **Outer border:** outline gold quanh card
- **Inner button:** outline gold "▶ Bắt đầu"

→ 2 mức outline gold trong cùng card → visual noise nhẹ.

**So sánh:**
- Ranked card: filled gold button trên dark card → 1 accent layer, clean
- Practice card: outline outer + outline inner → 2 accent layers

**Đề xuất fix:**

**Option A:** Giảm outline outer của Practice card (border 0.5px tertiary thay vì 1px gold)

**Option B:** Practice button **filled với opacity thấp** (`bg-secondary/20`) thay vì outline → 1 accent type per card

**Option C:** Bỏ luôn outer border Practice card, chỉ giữ button outline → match standard card style

**Recommend:** Option A — giảm outer border, giữ button outline (đỡ phá visual hierarchy với Ranked).

**Files affected:**
- `apps/web/src/pages/Home.tsx` (Practice card)
- Liên quan đến HM-P2-4 (Practice button color decision)

**Acceptance:**
- [ ] Practice card có 1 element accent rõ (button hoặc border, không cả 2)
- [ ] Visual parallel với Ranked card (different style nhưng cùng noise level)

---

### HM-MB-4: Section transitions thiếu visual breaks (mobile) 💡 ENHANCEMENT (subjective)

**Audit 2026-05-01:** [Home.tsx](../apps/web/src/pages/Home.tsx) dùng `space-y-8` (32px) giữa outer sections. Đủ "rhythm" hay không là subjective. Bug đề xuất 16-20px thêm dividers — chỉ là enhancement, không phải bug. Defer.

**Severity:** P3 · **Type:** Polish · **Effort:** 15min

**Triệu chứng:**
Các sections trên mobile xếp chồng nhau với gap nhỏ (~8-12px). Khi scroll nhanh, user khó phân biệt section boundaries vì:
- Không có divider rõ
- Background tất cả sections gần giống nhau (rgba dark)
- Spacing giữa sections không đủ tạo "rhythm"

**Đề xuất (optional):**

**Option A:** Tăng gap giữa section groups (16-20px thay vì 8-12px)

**Option B:** Thêm dòng divider mảnh giữa sections lớn:
```css
.section-divider {
  height: 1px;
  background: rgba(232, 168, 50, 0.08);
  margin: 16px 0;
}
```

**Option C:** Group sections theo background subtle differentiation (vd Daily group có bg slightly khác Game Modes group)

**Recommend:** Option A — đơn giản nhất, không thêm element mới.

**Files affected:**
- `apps/web/src/pages/Home.tsx` (mobile responsive css)

**Acceptance:**
- [ ] Visual rhythm rõ ràng khi scroll mobile
- [ ] Không tăng total height quá 50px (acceptable trade-off)

---

### HM-MB-5: Bảng Xếp Hạng row TAI THANH avatar tier color không rõ (mobile) ⏳ DEPENDS ON COLOR_AUDIT

**Audit 2026-05-01:** H7 commit `10c867c` áp dụng tier colors cho avatar via `style={{ background: tier.colorHex, color: '#11131e' }}` ([Home.tsx:255](../apps/web/src/pages/Home.tsx#L255)). Tân Tín Hữu colorHex `#919098` gray nhạt vẫn issue contrast trên mobile. Phụ thuộc Color Audit Task 1 (sync 6 tier colors web↔mobile + tăng saturation). Defer.

**Severity:** P2 · **Type:** Visual · **Effort:** Phụ thuộc COLOR_FIXES Task 1

**Triệu chứng:**
Mobile Bảng Xếp Hạng có row TAI THANH với:
- Avatar tròn xám nhạt với "T"
- Tên TAI THANH
- Subtitle "Tân Tín Hữu" (màu chữ không rõ tier color)

Trong mockup mobile em vẽ, avatar background là **tier color rõ ràng** (Tân Tín Hữu = `#9ca3af` xám). Implement đúng tier color này nhưng:
- Avatar size 30px trên dark bg → màu xám nhạt **gần như invisible**
- Subtitle "Tân Tín Hữu" cũng xám → user scan không nhận biết

→ Khi có nhiều user trong leaderboard, tất cả avatars xám = không phân biệt được tier.

**Phụ thuộc:** Đây là vấn đề Task 1 trong COLOR_AUDIT — sync 6 tier colors web↔mobile + tăng contrast. Sau khi fix, row sẽ có tier color rõ ràng hơn.

**Files affected:**
- `apps/web/src/components/LeaderboardRow.tsx` (mobile variant)
- Phụ thuộc COLOR_FIXES Task 1

**Acceptance:**
- [ ] 6 tier có 6 avatar color khác biệt rõ (không phải shade gần nhau)
- [ ] Subtitle có color tier tương ứng (không phải xám đồng loạt)
- [ ] Test contrast WCAG AA cho avatar bg + text

---

### HM-MB-6: Mobile có header top bar khác mockup (vẫn dùng top bar) ℹ️ NOTE only (không phải bug)

**Audit 2026-05-01:** Note correct — top bar trên mobile match Hướng B intent. Cần thêm bell + dropdown khi làm HM-P0-1 refactor.

**Severity:** Note (không phải bug) · **Type:** Decision · **Effort:** N/A

**Quan sát:**
Trong screenshot mobile, top bar hiển thị:
- Logo "Bible Quiz" góc trái
- Avatar "T" góc phải

Đây là **đúng pattern Hướng B** đã chọn (giữ top bar trên mobile, bỏ trên desktop). Không có vấn đề.

**Note:** Sau khi implement HM-P0-1, mobile top bar nên có thêm:
- Notification bell icon (cạnh avatar)
- Badge số notifications nếu có
- Avatar dropdown menu (Logout / Settings / Switch language)

Hiện tại chỉ có Logo + Avatar (no dropdown), giống top bar desktop trước khi refactor.

---

## 📊 Tổng kết (post-audit 2026-05-01)

### Original effort estimate vs actual remaining

| Severity | Original count | After H1-H8 audit | Effort còn lại |
|---|---|---|---|
| 🔴 P0 (architecture) | 1 | 1 STILL VALID | 2-3h |
| 🟠 P1 (UX) | 5 | 1 still valid + 1 partial + 3 fixed/by-design | ~1h |
| 🟡 P2 (improve) | 6 | 1 still valid + 1 fixed + 2 by-design + 1 enhancement + 1 depends | ~30min |
| 🟢 P3 (polish) | 5 | 0 still valid + 1 fixed + 2 by-design + 1 enhancement + 1 depends | 0h (defer) |
| Note (mobile decision) | 1 | 1 (no action) | N/A |
| **Total** | **17 issues + 1 note** | **3 valid + 5 fixed + 4 by-design + 2 enhancement + 1 depends + 1 note** | **~3-4h** |

**Original estimate ~10-13h** vs **actual remaining ~3-4h** — phần lớn bugs đã được giải quyết bởi H1-H8 hoặc match mockup intent.

### Phân tích original (giữ nguyên cho lịch sử):
- 12 issues áp dụng cho cả desktop + mobile (đa số ảnh hưởng cả 2)
- 5 issues mobile-specific (cần fix riêng trong responsive css)
- 1 note về decision mobile top bar (không cần action)

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — Architecture refactor (Hướng B) [2-3h]
1. **HM-P0-1** — Bỏ top bar desktop, sidebar có đầy đủ identity, mobile vẫn có top bar (kèm bell icon + dropdown menu — xem HM-MB-6 note)

### Sprint 2 — Quick wins copy/visual [1.5h]
2. **HM-P1-2** — Sub-tier stars copy "0/200" → "81/200" (15min) — fix cả desktop + mobile cùng lúc
3. **HM-P1-4** — Bỏ label "Chế độ chính" (5min)
4. **HM-P2-2** — Đổi icon 🌱 → 🎯 cho "0 câu hôm nay" (5min)
5. **HM-P2-3** — Fix tier pill alignment (15min)
6. **HM-P2-4** — Decide Practice button color + ghi DECISIONS.md (15min)
7. **HM-P3-1** — Tăng contrast countdown timer (10min)
8. **HM-MB-3** — Practice card 1 accent layer (15min) — liên quan #6
9. **HM-MB-2** — Test bottom tabs ở 320px viewport, rút gọn nếu cần (30min)

### Sprint 3 — Mobile UX critical [1h]
10. **HM-MB-1** — Mode cards thêm tap indicator (icon → corner) (30min) — mobile-critical
11. **HM-MB-4** — Section transitions visual breaks (15min) — optional polish
12. **HM-MB-5** — Verify tier color contrast trên mobile leaderboard (phụ thuộc COLOR_FIXES Task 1)

### Sprint 4 — Logic verification + live data [3-4h]
13. **HM-P1-3** — Verify sub-tier stars dynamic theo XP (30min)
14. **HM-P1-1** — Wire 3 live data cho mode cards (2-3h, cần backend endpoints) — fix cả desktop + mobile cùng lúc

### Backlog
15. Tất cả P3 còn lại (HM-P3-2, HM-P3-3)

---

## 🔗 Related artifacts

- `BUG_REPORT_LEADERBOARD.md` — bug report trang Leaderboard
- `BUG_REPORT_RANKED.md` — bug report trang Ranked
- `docs/COLOR_AUDIT.md` — color audit
- `PROMPT_COLOR_FIXES.md` — color fixes (5 tasks)
- Conversation 2026-04-30 — original mockup discussions

---

## 🤔 Questions cần Bui quyết

**Architecture (Sprint 1):**
1. **Notification bell trên desktop**: đặt ở sidebar footer hay sidebar header (cạnh user card)?
2. **Mobile top bar items**: Logo + Bell + Avatar dropdown — đủ chưa hay cần search icon?

**Mobile-specific (Sprint 2-3):**
3. **Bottom tabs labels** (HM-MB-2): rút gọn ("TRANG CHỦ" → "TRANG"/"HOME") hay giảm font?
4. **Mode cards tap indicator** (HM-MB-1): icon `→` corner (Option A) hay button-like text "Tham gia →" (Option C)?

**Decisions ghi DECISIONS.md:**
5. **Practice button color** (HM-P2-4): giữ outline gold hay đổi outline blue?
6. **Live data cho mode cards** (HM-P1-1): có endpoint nào sẵn sàng chưa, hay cần backend implement mới?

**Workflow:**
7. **Sprint order**: làm Sprint 1 (architecture) trước, hay Sprint 2 (quick wins desktop+mobile) trước?
8. **Mobile vs Desktop priority**: fix song song cả 2 (mỗi commit cover cả desktop+mobile), hay tách 2 commits riêng?

---

## 📝 So sánh với mockup gốc

### Desktop — Implement đúng mockup (8/10 sections):
| Section | Mockup → Implement | Note |
|---|---|---|
| Hero compact | ✅ Đúng | Greeting + tier pill + sub-tier stars + 2 micro-stats |
| Daily Challenge card | ✅ Đúng | Border gold + badge "CHỈ HÔM NAY" |
| Practice + Ranked | ✅ Đúng | Side-by-side, hierarchy đúng |
| 6 mode cards 3 cột | ✅ Đúng | Layout chuẩn, accent colors |
| Daily Missions | ✅ Đúng | 3 missions với progress |
| Bible Journey | ✅ Đúng | Mini timeline 2 segments |
| Lên hạng card | ✅ Đúng | 2 bullets benefits |
| Daily verse footer | ✅ Đúng | "Hãy hết lòng tin cậy..." Châm Ngôn 3:5 |

### Desktop — Khác mockup (2/10 + bonus):
| Element | Mockup | Implement | Verdict |
|---|---|---|---|
| Top bar | ❌ Không có | ✅ Có nhưng thừa | Cần fix (HM-P0-1) |
| 6 mode cards live data | 6/6 có | 3/6 có | Cần fix (HM-P1-1) |
| Bảng Xếp Hạng | Top 5 + highlight | Empty state | **Bonus tốt hơn mockup** |

### Mobile — Implement đúng mockup (12/14 sections):
| Section | Mockup → Implement | Note |
|---|---|---|
| Top header sticky | ✅ Đúng | Logo + avatar |
| Hero compact + 2 micro-stats | ✅ Đúng | Streak + Hôm Nay grid 2 cột |
| Daily Challenge card | ✅ Đúng | Badge + countdown |
| Practice + Ranked | ⚠️ **Vertical** thay horizontal | **Tốt hơn mockup** cho tap target |
| 6 mode cards 2x3 grid | ✅ Đúng | Accent colors |
| Daily Missions | ✅ Đúng | 3 missions inline |
| Bible Journey | ✅ Đúng | 2 segments |
| Lên hạng card | ✅ Đúng | 2 bullets |
| Bảng Xếp Hạng row TAI THANH | ✅ Bonus | Highlighted row khi only player |
| Activity empty state | ✅ Đúng | Mời anh em CTA |
| Daily verse footer | ✅ Đúng | Châm Ngôn 3:5 |
| Bottom tabs 4 items | ✅ Đúng | TRANG CHỦ active gold |

### Mobile — Khác mockup (2/14 + bonus):
| Element | Mockup | Implement | Verdict |
|---|---|---|---|
| Mode cards tap indicator | Có icon → corner | Không có | Cần fix (HM-MB-1) |
| Mode cards live data | 6/6 có | 3/6 có | Same as desktop (HM-P1-1) |
| Practice/Ranked layout | Side-by-side | **Vertical stack** | **Tốt hơn mockup** |
| Empty state Bảng Xếp Hạng | CTA "Chơi ngay" | Highlighted row TAI THANH | **Tốt hơn mockup** |

---

## 📊 Bảng tổng hợp issues theo platform (post-audit)

| Issue ID | Severity | Audit Status | Action |
|---|---|---|---|
| HM-P0-1 | P0 | ✅ DONE 2026-05-01 (`c2fe8fb`..cleanup) | Closed — see DECISIONS.md 2026-05-01 |
| HM-P1-1 | P1 | ✅ DONE 2026-05-01 (BE endpoints shipped + FE wired) | Closed — 4/4 dynamic + 2 static hints |
| HM-P1-2 | P1 | ✅ FIXED bởi H1 (`7d05f63`) | Closed |
| HM-P1-3 | P1 | ✅ FIXED — logic verified correct | Closed |
| HM-P1-4 | P1 | 🟢 BY DESIGN — match mockup | Skip |
| HM-P2-1 | P2 | ✅ Resolved by HM-P0-1 (DONE 2026-05-01) | Closed |
| HM-P2-2 | P2 | ✅ FIXED bởi H1 (🎯 emoji) | Closed |
| HM-P2-3 | P2 | 🟢 BY DESIGN — match mockup justify-between | Skip |
| HM-P2-4 | P2 | ✅ FIXED bởi H3 (`76b6d06` — full blue theme) | Closed |
| HM-P3-1 | P3 | 🟢 BY DESIGN — match mockup opacity 40% | Skip |
| HM-P3-2 | P3 | 🟢 BY DESIGN — match mockup hard edge | Skip |
| HM-P3-3 | P3 | 💡 ENHANCEMENT (vượt mockup) | Defer |
| **HM-MB-1** | **P1** | 💡 ENHANCEMENT (mockup không có arrow) | Defer / subjective |
| **HM-MB-2** | **P2** | ✅ DONE 2026-05-01 (Direction-3 active-only-label) | Closed |
| **HM-MB-3** | **P3** | ✅ FIXED bởi H3 (Practice → blue theme) | Closed |
| **HM-MB-4** | **P3** | 💡 ENHANCEMENT (subjective) | Defer |
| **HM-MB-5** | **P2** | ⏳ DEPENDS ON COLOR_AUDIT Task 1 | Wait for color audit |
| **HM-MB-6** | **Note** | ℹ️ NOTE only — no action | Skip |

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
*Updated 2026-04-30 — Added mobile-specific issues section + 8 questions structured.*
*Updated 2026-05-01 — Audit pass after H1-H8 ship: 5 bugs FIXED, 4 BY DESIGN, 2 ENHANCEMENT, 1 STILL VALID + INACCURATE CLAIM correction (HM-P0-1 logo). Effort còn lại ~3-4h thay vì ~10-13h gốc.*
*Updated 2026-05-01 (later) — HM-P0-1 AppLayout Direction-B refactor shipped (6 commits `c2fe8fb`..`f5a8da2`); HM-MB-2 bottom tabs Direction-3 active-only-label shipped (`91bb388`). Open FE work = 0h. Remaining: HM-P1-1 (1h FE wiring after BE adds 2 endpoints) + HM-MB-5 (depends on COLOR_AUDIT Task 1).*
