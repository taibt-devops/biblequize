# Prompt: Home Redesign — Sacred Modernist v2

> Reference mockup: `biblequiz_home_redesign_proposal.html` (đã approve)
> Tổng ước tính: 6-8 giờ, chia thành 8 commits riêng để dễ rollback.
> Apply same workflow đã proven trên Ranked redesign (R1-R5).

---

## Bối cảnh

Sau khi hoàn thành Ranked redesign (R1-R5) + Path A + C, Home page review phát hiện 8 issues. Mockup mới address tất cả issues UX/copy:
- ✅ V1 — Practice outline button (decision paralysis fixed)
- ✅ V2 — 6 mode cards có color riêng (blue, purple, red, violet, pink, orange)
- ✅ V3 — Sub-tier stars system rõ ràng (5 sao, gold filled vs muted outline)
- ✅ V4 — Stars thay XP bar 8% demotivating
- ✅ V5 — Tier badge pill nhỏ, info compact
- ✅ C1 — Live data hint trên mỗi mode card ("3 phòng đang mở", "+50% XP")
- ✅ C2 — CTA text deduplication ("Bắt đầu" / "Vào trận" / "Vào thử thách")
- ✅ C3 — Bible Journey elevated (split bar Cựu/Tân Ước, motivational copy)

Issues KHÔNG fix trong scope này:
- B1, B2 (logic bugs) — fix riêng theo `PROMPT_PRELAUNCH_CRITICAL.md`
- B3 (avatar tier color) — dependency Color Audit fixes, defer

---

## Pre-flight verification (15 phút — quan trọng)

Trước khi bắt đầu H1, verify các điều sau và document findings:

### 1. Tier system consistency
- Đọc `apps/web/src/data/tiers.ts` để confirm:
  - 6 tier names theo OLD naming (Tân Tín Hữu, Người Tìm Kiếm, ...) — KHÔNG dùng Light-based per memory decision
  - Tier colors hiện có cho mỗi tier
  - Threshold cho mỗi tier
- Mockup labels leaderboard có inconsistency (Tier 1 với 4350 XP labeled "Sứ Đồ"). **DÙNG data/tiers.ts thật trong project, KHÔNG hardcode theo mockup labels.**

### 2. Sub-tier stars system
- Đọc `apps/web/src/components/TierProgressBar.tsx` (đã có theo task TP-2 trong TODO)
- Confirm component đã support 5-star display
- Nếu đã có → reuse trong H1
- Nếu chưa có 5-star format → cần extend component

### 3. Backend data gaps
- Confirm các endpoints có hay không cho mode cards live data:
  - `GET /api/groups/me` (user's group / "Bạn chưa có nhóm")
  - `GET /api/rooms/active` hoặc tương tự (active room count)
  - `GET /api/tournaments/upcoming` (next tournament countdown)
  - `GET /api/quiz/weekly` (current weekly theme name + player count)
  - Mystery + Speed Round (XP multiplier - chỉ là static value)

### 4. Bible Journey API
- Đọc response của `GET /api/me/journey`
- Confirm có split Cựu Ước (39 sách) / Tân Ước (27 sách) không
- Nếu chưa có split → compute frontend từ book list (book index 0-38 = OT, 39-65 = NT)

### 5. Sidebar widgets (đã có từ Path C)
- StreakWidget + DailyMissionWidget đang ở sidebar
- **KHÔNG remove khỏi sidebar** — chỉ adjust Home content nếu cần avoid duplicate

Document findings trước khi start H1.

---

## Layout overview

```
┌─ Sidebar (240px) ───┐  ┌─ Main content (max 880px) ──────────────────┐
│ Logo                │  │                                              │
│ User card           │  │ H1: Greeting + tier pill + stars + XP        │
│ Nav (4 items)       │  │ H2: Daily Challenge card (gold border)       │
│ ─────               │  │ H3: "Tiếp tục hành trình" (Practice+Ranked)  │
│ Streak widget       │  │ H4: "Khám phá thêm" (6 mode cards colorful)  │
│ Daily mission       │  │ H5: Daily missions (compact, 3 items)        │
│ widget              │  │ H6: Bible Journey 66 sách (OT/NT split)      │
│                     │  │ H7: Leaderboard + Activity (2-col)           │
└─────────────────────┘  │ H8: Daily verse (decorative footer)          │
                          └──────────────────────────────────────────────┘
```

Key constraints:
- `max-width: 880px` cho main content (mockup line 1)
- `gap: 1rem` between sections
- Sidebar đã có (Path C done) — KHÔNG touch sidebar trong scope này

---

## Tasks (8 commits)

### Task H1: Hero Greeting + Sub-tier Stars

**Priority: P0 — first impression**

#### Implement

Replace current Home top section (giant tier card với 3 stats Streak/Điểm/Tier) bằng hero compact:

```
┌─────────────────────────────────────────────────────┐
│ CHÀO BUỔI SÁNG                  [Tân Tín Hữu]      │
│ TAI THANH                                           │
│                                                     │
│ Sao: ★ ☆ ☆ ☆ ☆           81 / 200 XP đến sao kế    │
│ ━━━━━░░░░░░░░░░░░░░ (40%)                          │
│ ─────                                               │
│ 📖 Đang đọc Genesis  ·  🎯 0 câu hôm nay           │
└─────────────────────────────────────────────────────┘
```

**Sections:**
1. **Greeting line** (small uppercase muted): "CHÀO BUỔI SÁNG" / "CHÀO BUỔI CHIỀU" / "CHÀO BUỔI TỐI" theo giờ
2. **User name** (medium weight, 18px white)
3. **Tier badge** top-right pill: tier color background (theo `data/tiers.ts`), tier name VN
4. **Stars row**: "Sao:" + 5 stars
   - Sao đã đạt: gold filled `#e8a832`, font-size 14px
   - Sao chưa đạt: gold muted `rgba(232,168,50,0.25)`
   - Logic: mỗi 200 XP = 1 sao trong tier → 1000/200 = 5 stars per tier
   - Right side: "X / 200 XP đến sao kế" (muted small text)
5. **Progress bar**: 6px height, gold fill, % theo XP-toward-next-star
6. **Footer** (border-top divider): 2 contextual stats inline
   - 📖 Đang đọc {bookName} (từ active book trong Ranked context)
   - 🎯 X câu hôm nay (từ rankedStatus.questionsCounted)

#### Data sources
- Greeting: `new Date().getHours()` → morning/afternoon/evening
- User name: `useAuth().user.displayName` hoặc `name`
- Tier: `useAuth().user.tierLevel` + `data/tiers.ts`
- Stars: từ `tier-progress` API hoặc compute từ totalPoints
  - `currentStarIndex = Math.floor((totalPoints % tierThreshold) / 200)` (verify formula với existing TierProgressBar)
- XP-to-next-star: `200 - (totalPoints % 200)`
- Active book: từ `/api/me/ranked-status` `currentBook` field
- Questions today: `rankedStatus.questionsCounted`

#### Edge cases
- User mới (totalPoints = 0): 0 sao filled, "0 / 200 XP đến sao 1"
- Tier 6 (max): có thể skip stars hoặc show "Đã đạt Vinh Quang 👑"
- Active book null: hide "📖 Đang đọc..." (chỉ show "🎯 0 câu hôm nay")
- questionsCounted = 0: vẫn show "0 câu hôm nay" (motivational neutral)

#### Tests (Home.test.tsx)
- Render với user 81 XP → 0 stars filled, "81 / 200 XP đến sao kế"
- Render với user 800 XP → 4 stars filled, "0 / 200 XP đến sao kế" (sao 5 next)
- Render với morning hour → "CHÀO BUỔI SÁNG"
- Render với evening hour → "CHÀO BUỔI TỐI"
- Render với active book = "Genesis" → "📖 Đang đọc Genesis"
- Render với active book null → footer line không render "📖..."

#### Commit
`feat: Home hero with sub-tier stars + greeting (H1)`

---

### Task H2: Daily Challenge Card (compact)

**Priority: P0**

#### Implement

Card compact với gold border, không full-width oversized như hiện tại.

```
┌─────────────────────────────────────────────[CHỈ HÔM NAY]┐
│ THỬ THÁCH HÔM NAY                                       │
│ 🌍 Hành trình qua 5 sách                                │
│ Lu-ca · Ga-la-ti · Dân Số Ký · Giê-rê-mi · Mi-chê       │
│                                                          │
│ ⏱ 5 phút  📝 5 câu  +50 XP            Mới sau 05:27:15  │
│                                                          │
│ ▶ Vào thử thách                                         │
└──────────────────────────────────────────────────────────┘
```

**Differences vs current:**
- Border 1px gold (mockup line 59) — emphasis quan trọng
- Pill "CHỈ HÔM NAY" góc trên phải (urgency signal)
- Theme name compact (1 dòng) thay vì lớn block
- Books inline (line 64) thay vì list
- Meta row: ⏱ + 📝 + +50 XP gold + countdown right-aligned (line 66-71)
- CTA text "Vào thử thách" thay vì "BẮT ĐẦU HÔM NAY" (per V2 review)
- Background subtle: `rgba(50,52,64,0.4)` không gradient

#### Data sources
- `GET /api/daily-challenge` đã có
  - Theme name + book list
  - Time/question count + XP reward
  - Reset countdown
- `alreadyCompleted` flag để render state khác nếu user đã làm hôm nay

#### Empty/edge states
- `alreadyCompleted = true`: 
  - Pill đổi sang "ĐÃ HOÀN THÀNH" (green)
  - CTA: "Xem kết quả" thay vì "Vào thử thách"
  - Disable click để chơi lại (lock until reset)
- API loading: skeleton card same layout
- API error: hide section hoàn toàn (không break Home)

#### Tests
- Render với daily data → text + countdown đúng
- Render với alreadyCompleted = true → pill green + CTA "Xem kết quả"
- Render loading → skeleton
- Click CTA → navigate `/daily`
- Verify countdown timer update mỗi giây

#### Commit
`feat: Home Daily Challenge card compact redesign (H2)`

---

### Task H3: Tiếp tục Hành Trình (Practice + Ranked)

**Priority: P0**

#### Implement

Section header + 2 cards 50/50 grid:

```
Tiếp tục hành trình                              Chế độ chính

┌─────────────────────────┐  ┌─────────────────────────┐
│ [📖]      Không áp lực  │  │ [🏆]    100 năng lượng  │
│ Luyện tập               │  │ Thi đấu Ranked          │
│ Học theo nhịp riêng     │  │ Cạnh tranh ranking      │
│                         │  │                         │
│ ┌─────────────────────┐ │  │ ┌─────────────────────┐ │
│ │ ▶ Bắt đầu (outline) │ │  │ │ ▶ Vào trận (filled) │ │
│ └─────────────────────┘ │  │ └─────────────────────┘ │
└─────────────────────────┘  └─────────────────────────┘
   Blue accent #4a9eff         Gold accent #e8a832
```

**V1 fix bundled here:**
- Practice: outline blue button (border #4a9eff + transparent bg + blue text)
- Ranked: filled gold button (primary CTA)
- Visual contrast rõ → mắt rest trên Ranked, Practice là alternative

#### Data sources
- Practice card: static (no API needed)
- Ranked card meta:
  - "X năng lượng" từ `rankedStatus.livesRemaining`
  - Nếu energy = 0 → text đổi thành "Hết năng lượng" muted
  - Nếu cap reached → "Đã hết câu hôm nay"

#### Tests
- Render → 2 cards visible
- Practice button outline blue style
- Ranked button filled gold style
- Click Practice → navigate `/practice`
- Click Ranked → navigate `/ranked`
- Render với energy = 0 → meta đổi text + button có thể disabled hoặc vẫn enable navigate sang Ranked

#### Commit
`feat: Home Tiếp tục Hành Trình section (H3)`

---

### Task H4: Khám phá thêm — 6 Mode Cards

**Priority: P1 — biggest visual transformation**

#### Implement

Section header với link "Xem 8 chế độ →" + 3-column grid với 6 cards. Mỗi card có **color riêng** + **live data hint**.

```
Khám phá thêm                              Xem 8 chế độ →

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ ⛪ (blue)      │ │ 🎮 (purple)    │ │ 🏆 (red)       │
│ Nhóm Giáo Xứ  │ │ Phòng Chơi    │ │ Giải Đấu      │
│ Hội thánh     │ │ 2-20 người    │ │ Bracket 1v1   │
│ Bạn chưa có   │ │ 3 phòng đang  │ │ Mới sau 2 ngày│
│ nhóm          │ │ mở            │ │               │
└───────────────┘ └───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 📅 (violet)    │ │ 🎲 (pink)      │ │ ⚡ (orange)    │
│ Chủ Đề Tuần   │ │ Mystery Mode  │ │ Speed Round   │
│ Phép lạ Chúa  │ │ Random hoàn   │ │ 10 câu × 10s  │
│ Giê-su        │ │ toàn          │ │               │
│ 47 người chơi │ │ +50% XP       │ │ +100% XP      │
└───────────────┘ └───────────────┘ └───────────────┘
```

**Color tokens (per mockup):**
| Card | Background | Border | Icon/Accent |
|---|---|---|---|
| Nhóm Giáo Xứ | `rgba(74,158,255,0.06)` | `rgba(74,158,255,0.2)` | `#4a9eff` |
| Phòng Chơi | `rgba(155,89,182,0.06)` | `rgba(155,89,182,0.2)` | `#9b59b6` |
| Giải Đấu | `rgba(255,107,107,0.06)` | `rgba(255,107,107,0.2)` | `#ff6b6b` |
| Chủ Đề Tuần | `rgba(168,85,247,0.06)` | `rgba(168,85,247,0.2)` | `#a855f7` |
| Mystery Mode | `rgba(212,83,126,0.06)` | `rgba(212,83,126,0.2)` | `#d4537e` |
| Speed Round | `rgba(255,140,66,0.06)` | `rgba(255,140,66,0.2)` | `#ff8c42` |

#### Live data hints — backend gaps strategy

Per pre-flight findings, một số endpoints có thể chưa exist. **Conditional render** với fallback static text:

| Card | Dynamic text | Fallback nếu API unavailable |
|---|---|---|
| Nhóm Giáo Xứ | "Bạn chưa có nhóm" / "Trong {groupName}" | "Hội thánh đồng hành" |
| Phòng Chơi | "{N} phòng đang mở" / "Tạo phòng mới" | "Chơi cùng anh em" |
| Giải Đấu | "Mới sau {N} ngày" / "{N} đang diễn ra" | "Bracket 1v1" (static) |
| Chủ Đề Tuần | "{themeName} · {N} người chơi" | "Chủ đề tuần này" |
| Mystery Mode | "+50% XP" (always static) | n/a |
| Speed Round | "+100% XP" (always static) | n/a |

**KHÔNG hardcode placeholder data như "47 người đã chơi" trong code** nếu API thật trả null. Render fallback text static.

Document trong PR description: list các BE endpoints needed cho live data, mark task riêng `BE-EXTEND-MODE-CARDS` cho post-launch.

#### Click behavior
- Nhóm Giáo Xứ → `/groups`
- Phòng Chơi → `/multiplayer`
- Giải Đấu → `/tournaments`
- Chủ Đề Tuần → `/weekly-quiz` (verify route tồn tại, fallback `/practice?theme=weekly`)
- Mystery Mode → `/quiz?mode=mystery`
- Speed Round → `/quiz?mode=speed`

#### Tests
- Render → 6 cards visible với 6 colors khác nhau
- Each card có testid riêng (e.g., `home-mode-groups`, `home-mode-rooms`, etc.)
- Live data API success → text dynamic
- Live data API error/loading → fallback static text
- Click each → navigate đúng route
- "Xem 8 chế độ →" link → navigate `/modes` hoặc anchor scroll

#### Commit
`feat: Home 6 mode cards with colors and live data (H4)`

---

### Task H5: Daily Missions (compact)

**Priority: P1**

#### Implement

Compact section, KHÔNG remove khỏi Home dù sidebar đã có DailyMissionWidget. Lý do: sidebar widget chỉ show "X/3 hoàn thành" tổng — Home section show 3 missions cụ thể.

**KHÔNG duplicate UI** — sidebar widget có thể link đến Home section qua anchor (post-launch enhancement).

```
📋 Nhiệm vụ hôm nay                          0/3 hoàn thành

○ Trả lời đúng 3 câu                                  0/3
  ━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░ (3px progress)
○ Hoàn thành thử thách hàng ngày                      0/1
  ━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░
○ Trả lời 3 câu liên tiếp đúng                        0/3
  ━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Mỗi mission row:
- Circle icon (18px outline rgba(255,255,255,0.25), filled gold khi completed)
- Mission text (rgba(255,255,255,0.85))
- Inline progress bar 3px
- Right: "X/Y" text muted

#### Data sources
- `GET /api/me/daily-missions` đã có (Path C đã wire vào sidebar)
- Cùng queryKey `['daily-missions']` → TanStack dedupe (sidebar + Home cùng dùng 1 request)

#### Edge cases
- All completed: 3 circles filled gold, text strikethrough nhẹ
- Loading: skeleton 3 rows grey
- Error/empty: hide section

#### Tests
- Render với 0/3 → 3 outline circles, progress 0%
- Render với 1/3 → 1 filled circle (mission đầu)
- Render với 3/3 → all filled
- Render với error → section hidden

#### Commit
`feat: Home daily missions compact section (H5)`

---

### Task H6: Bible Journey 66 sách (elevated)

**Priority: P1 — differentiator!**

#### Implement

Section gradient blue/purple (Cựu Ước/Tân Ước theme), KHÔNG còn collapsed 1 dòng như hiện tại:

```
┌─ gradient blue→purple subtle ────────────────────────┐
│ 🗺 Hành trình 66 sách                          0 / 66│
│ Đang ở Genesis · Ma-thi-ơ và Khải Huyền đang đợi bạn │
│                                                       │
│ [▓▓░░░░░░░░░░░░░░] [░░░░░░░░░░░] (split bar)        │
│  Cựu Ước (39)       Tân Ước (27)                     │
└──────────────────────────────────────────────────────┘
```

**Key elements:**
- Background: `linear-gradient(135deg, rgba(74,158,255,0.06), rgba(168,85,247,0.06))`
- Border: `rgba(74,158,255,0.2)`
- Title row: 🗺 + "Hành trình 66 sách" + right "X / 66"
- Subtitle motivational: "Đang ở {currentBook} · Ma-thi-ơ và Khải Huyền đang đợi bạn"
- **Split bar** (mockup line 210-215):
  - Container 6px height
  - 2 segments: Cựu Ước (flex 39) + Tân Ước (flex 27)
  - Cựu Ước segment: `rgba(74,158,255,0.15)` background, fill `#4a9eff` theo progress
  - Tân Ước segment: `rgba(168,85,247,0.15)` background, fill `#a855f7` theo progress
- Labels below: "Cựu Ước (39)" blue / "Tân Ước (27)" purple

#### Data sources
- `GET /api/me/journey` (đã có)
- Compute split:
  - OT books = books với index 0-38 (Genesis → Malachi)
  - NT books = books với index 39-65 (Matthew → Revelation)
  - `otCompleted = books.filter(b => b.testament === 'OT' && b.completed).length`
  - `ntCompleted = books.filter(b => b.testament === 'NT' && b.completed).length`
- Nếu API chưa expose `testament` field → compute frontend từ book index

#### Subtitle copy logic
- User chưa start: "Bắt đầu hành trình từ Genesis"
- User đang OT: "Đang ở {currentBook} · Ma-thi-ơ và Khải Huyền đang đợi bạn"
- User đang NT: "Đang ở {currentBook} · Còn {N} sách Tân Ước"
- All complete (66/66): "Bạn đã chinh phục toàn bộ Kinh Thánh! 👑"

#### Click behavior
Toàn section clickable → navigate `/journey` hoặc tương tự (verify route).

#### Tests
- Render với 0/66 → "Bắt đầu hành trình từ Genesis"
- Render với 5/66 trong OT → "Đang ở Genesis · Ma-thi-ơ và Khải Huyền đang đợi"
- Render với 45/66 trong NT → "Đang ở Matthew · Còn 21 sách Tân Ước"
- Render với 66/66 → all-complete copy
- Split bar widths đúng theo OT/NT progress

#### Commit
`feat: Home Bible Journey elevated with split bar (H6)`

---

### Task H7: Leaderboard + Activity (2-col)

**Priority: P0**

#### Implement

Grid 1.4fr / 1fr (leaderboard wider):

```
┌─ Bảng xếp hạng (1.4fr) ────────┐  ┌─ Hoạt động (1fr) ─┐
│ Bảng xếp hạng [Hàng ngày|Tuần] │  │ Hoạt động         │
│                                │  │ Trong hội thánh   │
│ 1 [T-red]   Test Tier 1  4350 │  │                   │
│             Sứ Đồ        XP   │  │     🌱            │
│                                │  │                   │
│ 2 [T-yellow] Test Tier 2 1000 │  │ Bạn là người      │
│             Tiên Tri      XP   │  │ tiên phong        │
│                                │  │                   │
│ 3 [T-purple] Test Tier 3 200  │  │ Hoạt động sẽ      │
│             Hiền Triết    XP   │  │ xuất hiện khi anh │
│                                │  │ em hội thánh chơi │
│ 4 [T-gray]  TAI THANH    81  │  │ cùng bạn          │
│   ←gold     (bạn)         XP   │  │                   │
│   border    Tân Tín Hữu        │  │ [Mời anh em →]    │
│                                │  │                   │
│ ──────                         │  │                   │
│ Xem tất cả →                   │  │                   │
└────────────────────────────────┘  └───────────────────┘
```

**Leaderboard card details:**
- Tab: "Hàng ngày" / "Hàng tuần" toggle (gold filled active, transparent inactive)
- 4 rows: top 3 + user (current row)
- Mỗi row:
  - Rank number (24px wide, gold cho rank 1, muted cho rank 2-3)
  - Avatar circle 24x24 — **background = tier color** (key V3 fix in mockup)
    - Tân Tín Hữu: `#9ca3af` gray
    - Người Tìm Kiếm: `#3b82f6` blue (verify với data/tiers.ts)
    - Môn Đệ: `#8b5cf6` violet
    - ... etc per data/tiers.ts
  - Letter T (initial) trong avatar
  - Name + tier name (small, tier color text)
  - XP right-aligned (gold cho rank 1, white-85 cho 2-3)
- **Current user row** (TAI THANH):
  - Background: `rgba(232,168,50,0.04)` subtle gold tint
  - Left border: 2px gold `#e8a832`
  - Border radius: `0 6px 6px 0`
  - Suffix "(bạn)" sau name
- Footer: divider + "Xem tất cả →" centered

**Activity card details:**
- Title "Hoạt động" + subtitle "Trong hội thánh"
- Empty state centered:
  - 🌱 emoji 24px
  - "Bạn là người tiên phong" weight 500
  - "Hoạt động sẽ xuất hiện khi anh em hội thánh chơi cùng bạn"
  - Button "Mời anh em →" (gold tint background, gold text, gold border)

#### Data sources
- Leaderboard: `GET /api/leaderboard?period=daily&limit=3` + user's rank
- Activity feed: `GET /api/activity/community` (verify endpoint hoặc check Home.tsx hiện tại đang dùng gì)
- User group context: `useAuth().user.groupId` (nếu có group thì show group activity)

#### Tests
- Render top 3 + user → 4 rows
- User trong top 3 → KHÔNG show duplicate row (chỉ 3 rows top)
- User ngoài top 3 → 4 rows (top 3 + user with gold border)
- Avatar background = tier color
- Toggle "Hàng tuần" → refetch với period=weekly
- Click "Xem tất cả" → navigate `/leaderboard`
- Empty activity → render "tiên phong" empty state
- Click "Mời anh em" → trigger share/invite flow

#### Commit
`feat: Home Leaderboard with tier colors + Activity card (H7)`

---

### Task H8: Daily Verse Footer

**Priority: P2 — final polish**

#### Implement

Subtle decorative footer, italic, low opacity:

```
"Lời Chúa là ngọn đèn cho chân tôi, ánh sáng cho đường lối tôi."
                                              — Thi Thiên 119:105
```

- Center aligned
- Padding 1rem 0
- Opacity 0.7
- Verse text: italic serif font, 12px, color `rgba(255,255,255,0.6)`
- Reference: 10px gold muted `rgba(232,168,50,0.5)`, letter-spacing 0.5px
- KHÔNG có border, background, button — purely decorative

**KHÔNG clickable** (per recommendation trước: don't break devotional moment với navigate quiz).

Per memory: "Bản Truyền Thống Hiệu Đính 2011" — sử dụng verse rotation từ `data/verses.ts` đã có.

#### Tests
- Render verse text + reference
- Verify rotating verse từ data source (mỗi ngày 1 verse khác nhau)
- Verify NOT clickable (no onClick handler)

#### Commit
`feat: Home daily verse decorative footer (H8)`

---

## Quy tắc chung

### KHÔNG được làm
- ❌ Touch sidebar (Path C đã làm xong, không reopen)
- ❌ Hardcode tier names theo mockup (dùng data/tiers.ts)
- ❌ Hardcode placeholder live data ("47 người đã chơi") nếu API chưa có
- ❌ Refactor logic không liên quan
- ❌ Skip tests cho mỗi commit
- ❌ Force commit nếu Tầng 2/3 fail

### BẮT BUỘC làm
- ✅ 8 commits riêng (H1-H8), rollback dễ
- ✅ Pre-flight verification trước H1 (15 phút)
- ✅ Stop-and-confirm sau từng commit
- ✅ Tests cho mỗi section (5+ cases mỗi commit)
- ✅ Conditional render với fallback khi BE data missing
- ✅ Document BE gaps trong PR description
- ✅ Verify max-width 880px applied đúng cho main content
- ✅ Verify gap 1rem between sections consistent
- ✅ Reuse existing components (TierProgressBar nếu đã có 5-star format)

### Stop-points

Sau commit từng task, **STOP và post results**:
- H1 done → screenshot hero section + test count → confirm → H2
- H2 done → screenshot daily card → confirm → H3
- ... (tiếp tục pattern)
- H8 done → **screenshot full Home page** + final regression Tầng 1-4

### Backend gaps tracking

Sau H4, tạo file `BACKEND_GAPS_HOME_V2.md`:
```
# Backend gaps cho Home redesign V2

## Mode card live data (Task H4)
- [ ] GET /api/groups/me — user's group context
- [ ] GET /api/rooms/active/count — active room count
- [ ] GET /api/tournaments/upcoming — next tournament time
- [ ] GET /api/quiz/weekly/stats — theme + player count

## Bible Journey (Task H6)
- [ ] /api/me/journey response: add testament field per book (or compute FE)

## Daily missions sidebar dedup (Task H5)
- [ ] (Optional) sidebar widget click → anchor scroll to Home section
```

---

## Final regression sau H8

- Tầng 1: Home.test.tsx (target 25+ cases)
- Tầng 2: pages/ (495+ pass)
- Tầng 3 FE: 1039+ pass (no regressions)
- Tầng 4 Playwright:
  - W-M02 home smoke (verify pre-existing fails KHÔNG tăng)
  - W-M04 ranked (must remain 7/7 pass)
- Screenshot full Home page (real browser, not headless để Material Icons render đúng)
- Update TODO.md mark H1-H8 DONE

---

## Estimate breakdown

| Task | Complexity | Time |
|---|---|---|
| Pre-flight | Low | 15 phút |
| H1 Hero + stars | Medium | 60 phút |
| H2 Daily Challenge | Low | 45 phút |
| H3 Tiếp tục | Low | 30 phút |
| H4 6 mode cards | High (live data + colors) | 90 phút |
| H5 Daily missions | Medium | 45 phút |
| H6 Bible Journey | Medium | 60 phút |
| H7 Leaderboard + Activity | High (tier colors + 2-col) | 90 phút |
| H8 Daily verse | Low | 20 phút |
| Final regression | Medium | 45 phút |
| **Total** | | **~7-8 giờ** |

---

## Sau khi xong

App **sẵn sàng cho soft-launch** với 2 redesigned trang chính (Home + Ranked) + sidebar widgets. Defer post-launch:
- Mode card live data BE endpoints (BACKEND_GAPS_HOME_V2.md)
- B1 + B2 logic bugs (theo `PROMPT_PRELAUNCH_CRITICAL.md` riêng)
- COLOR_AUDIT.md fixes (avatar tier colors web/mobile sync)

Ready for users.
