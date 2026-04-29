# Home Redesign — Option Y: Daily Banner + Practice/Ranked Featured + Secondary Grid

**Decision**: 3-tier visual hierarchy với Practice + Ranked là **core experience** cho user ấn tượng, Daily Challenge giữ vai trò gateway hằng ngày, các modes khác visible trong secondary grid (KHÔNG hide).

**Lý do**: User cần ấn tượng app có 2 core modes (Practice = học, Ranked = thi đấu) ngay từ Home. Daily Challenge là habit loop nhưng không phải core experience. Các modes khác vẫn visible để user biết app rich features.

**Cost ước tính**: 3-4 giờ.

**Quy tắc**: Mỗi step = 1 commit riêng để rollback dễ.

---

## Layout đích

```
[Hero compact — Greeting + Tier progress]

[Daily Verse banner]

┌──────────────────────────────────────────────────────────────┐
│  📅 THỬ THÁCH HÔM NAY                                         │
│  Hành trình qua 5 sách: A-mốt • 2 Giăng • Ê-sai • ...        │
│  5 câu • 5 phút • +50 XP                                       │
│                                                                │
│  [▶ BẮT ĐẦU HÔM NAY]            ← Featured banner, full width │
└──────────────────────────────────────────────────────────────┘
                            HOẶC nếu đã làm hôm nay:
┌──────────────────────────────────────────────────────────────┐
│  ✅ Đã hoàn thành Thử Thách Hôm Nay — 4/5 đúng                │
│  Quay lại sau 19:30:38                                        │
│  [Xem lại bài làm]                                             │
└──────────────────────────────────────────────────────────────┘

═══════════════ CHẾ ĐỘ CHƠI ═══════════════

┌────────────────────────────┐  ┌────────────────────────────┐
│  📖                         │  │  🎯                         │
│                              │  │                              │
│  LUYỆN TẬP                  │  │  THI ĐẤU RANKED             │
│                              │  │                              │
│  Học không áp lực           │  │  Tranh tài, kiếm điểm rank. │
│  Không giới hạn thời gian   │  │                              │
│                              │  │  ✅ Đã mở khóa              │  ← state-based
│  [▶ Bắt đầu]                │  │  [▶ Bắt đầu Ranked]         │
└────────────────────────────┘  └────────────────────────────┘
                ↑ FEATURED CORE GRID (2 BIG cards)

   ─────  Khám phá thêm  ─────

┌──────┐ ┌──────┐ ┌──────┐
│ 👥   │ │ 🎮   │ │ 🏆   │       ← SECONDARY GRID 3x2 (6 cards medium)
│ Nhóm │ │ Phòng│ │ Giải │
└──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐ ┌──────┐
│ 📅   │ │ 🎲   │ │ ⚡   │
│ Tuần │ │ Mys  │ │ Speed│
└──────┘ └──────┘ └──────┘

[Daily Missions]
[Bible Journey]
[TierPerksTeaser]
[Leaderboard]
[Activity Feed]
```

---

## Constants & Decisions (KHÔNG đổi giữa chừng)

| Item | Value |
|---|---|
| Featured banner | Daily Challenge (như hiện tại) |
| Daily completed state | Show "✅ Đã hoàn thành 4/5" + countdown + "Xem lại bài làm" |
| Core featured grid | Practice + Ranked (2 BIG cards) |
| Secondary grid | 6 modes (Group, Phòng, Giải Đấu, Weekly, Mystery, Speed) — 3x2 layout |
| Visibility | TẤT CẢ visible, KHÔNG collapsible |
| Ranked khi chưa pass Bible Basics | Show "📖 Cần hoàn thành Bài Giáo Lý" + CTA dẫn /basic-quiz |
| Background patterns trên cards | BỎ HOÀN TOÀN |
| Description trên secondary cards | Tiny subtitle max 4 từ |
| Description trên core featured cards | 1-2 dòng ngắn (vì cards lớn hơn) |

---

## Step 0 — Verify trước khi code

Trả lời trong reply đầu tiên:

1. **Hiện tại GameModeGrid structure**:
   - File: `apps/web/src/components/GameModeGrid.tsx`
   - CARDS array hiện có bao nhiêu items?
   - Đã có concept 'tier' (primary/secondary/discovery) chưa?

2. **FeaturedDailyChallenge component**:
   - File path
   - Có handle state "đã hoàn thành" không? Hay chỉ render "Bắt đầu hôm nay"?
   - API endpoint nào cho biết user đã làm Daily hôm nay?

3. **BasicQuizCard component**:
   - File path
   - Có thể reuse logic state (passed/cooldown) cho Ranked compact card không?

4. **Backend API check**:
   - `/api/me/daily-challenge-status` hoặc tương đương — có trả về `completedToday`, `score` chưa?
   - Nếu chưa có → cần endpoint mới hay extend existing?

KHÔNG bắt đầu Step 1 cho đến khi có findings.

---

## Step 1 — Featured Daily Challenge: 2 states (active + completed)

### Mục tiêu

FeaturedDailyChallenge banner hiện tại chỉ render state "active" (chưa làm). Cần thêm state "completed" với UX khác.

### State A — Chưa làm hôm nay (current)

```
┌──────────────────────────────────────────────────────────────┐
│  📅 THỬ THÁCH HÔM NAY                                         │
│                                                                │
│  🌍 Hành trình qua 5 sách hôm nay                             │
│  A-mốt • 2 Giăng • Ê-sai • 1 Cô-rinh-tô • Châm Ngôn          │
│                                                                │
│  5 câu • 5 phút • +50 XP                                       │
│                                                                │
│  ⏱ Thử thách mới sau 19:30:38                                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▶  BẮT ĐẦU HÔM NAY                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### State B — Đã hoàn thành hôm nay (NEW)

```
┌──────────────────────────────────────────────────────────────┐
│  ✅ ĐÃ HOÀN THÀNH HÔM NAY                                     │
│                                                                │
│  🎉 Bạn đúng 4/5 câu — giỏi hơn 67% người chơi                │
│                                                                │
│  Hôm nay: Hành trình qua 5 sách                                │
│  +50 XP đã nhận                                                │
│                                                                │
│  ⏱ Thử thách mới sau 19:30:38                                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  📖  Xem lại bài làm                                      │ │  ← secondary CTA
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Visual specs:
- Background giữ gold gradient nhưng opacity nhẹ hơn (subtle celebration vibe)
- ✅ icon thay 📅 icon
- CTA "Xem lại bài làm" — không phải gold gradient bự, dùng outline button (tertiary CTA)
- Score percentile lấy từ API daily-challenge result

### Implementation

```tsx
function FeaturedDailyChallenge() {
  const { data: status } = useQuery({
    queryKey: ['daily-challenge-status'],
    queryFn: () => api.get('/api/me/daily-challenge-status'),
  })
  
  if (!status) return <SkeletonBanner />
  
  if (status.completedToday) {
    return <CompletedBanner status={status} />
  }
  
  return <ActiveBanner status={status} />
}
```

### Backend (nếu chưa có)

Endpoint `/api/me/daily-challenge-status` trả về:
```json
{
  "completedToday": true,
  "score": 4,
  "totalQuestions": 5,
  "xpEarned": 50,
  "betterThanPercent": 67,
  "theme": "Hành trình qua 5 sách",
  "books": ["A-mốt", "2 Giăng", ...],
  "nextResetAt": "2026-04-30T00:00:00Z"
}
```

### Acceptance criteria

- 2 states render đúng
- State B hiện sau khi user submit Daily Challenge
- "Xem lại bài làm" CTA navigate `/daily/review` (hoặc tương đương)
- Tests (4): render state A, state B, navigate review, countdown work

### Cost: 1-1.5h

### Commit
- `feat(home): FeaturedDailyChallenge with completed state`

---

## Step 2 — Refactor GameModeGrid: 2-tier structure

### Mục tiêu

GameModeGrid hiện flat → đổi thành 2 sections rõ ràng:
- Section 1: Core Featured Grid (Practice + Ranked) — 2 BIG cards
- Section 2: Secondary Grid (6 modes) — 3x2 medium cards

KHÔNG còn Daily card trong grid (đã có Featured banner riêng).

### Component structure

```tsx
<GameModeGrid>
  {/* Section 1: Core Featured */}
  <CoreFeaturedSection>
    <FeaturedCard mode="practice" />
    <FeaturedCard mode="ranked" basicQuizPassed={...} />
  </CoreFeaturedSection>
  
  <Divider label={t('home.exploreMore')} />
  
  {/* Section 2: Secondary */}
  <SecondaryGrid>
    <CompactCard mode="group" />
    <CompactCard mode="multiplayer" />
    <CompactCard mode="tournament" />
    <CompactCard mode="weekly" />
    <CompactCard mode="mystery" />
    <CompactCard mode="speed" />
  </SecondaryGrid>
</GameModeGrid>
```

### FeaturedCard design (Core)

```css
.featured-card {
  min-height: 220px;
  padding: 24px 28px;
  background: linear-gradient(135deg, rgba(20,22,30,0.8), rgba(40,42,52,0.6));
  border: 1px solid rgba(212,175,55,0.2);  /* subtle gold border */
  border-radius: 16px;
  
  /* NO background pattern */
}

.featured-card-icon {
  font-size: 36px;
  margin-bottom: 16px;
}

.featured-card-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
}

.featured-card-description {
  font-size: 14px;
  opacity: 0.7;
  line-height: 1.5;
  margin-bottom: 20px;
  /* max 2 lines, không quá dài */
}

.featured-card-cta {
  width: 100%;
  background: linear-gradient(90deg, #d4af37, #f4d36e);
  color: #1a1a1a;
  font-weight: 600;
  padding: 14px;
  border-radius: 10px;
}
```

### Practice featured card

```
┌────────────────────────────────────┐
│  📖                                  │
│                                      │
│  LUYỆN TẬP                          │
│                                      │
│  Học không áp lực, không giới       │
│  hạn thời gian.                     │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  ▶  Bắt đầu                    │ │  ← gold gradient
│  └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### Ranked featured card — 3 states

**State A: Đã pass Bible Basics**
```
┌────────────────────────────────────┐
│  🎯                                  │
│                                      │
│  THI ĐẤU RANKED                     │
│                                      │
│  Tranh tài trực tiếp,               │
│  kiếm điểm rank lớn.                │
│                                      │
│  ✅ Đã mở khóa                       │
│  ⚡ 100/100 năng lượng              │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  ▶  Bắt đầu Ranked             │ │
│  └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**State B: Chưa pass Bible Basics**
```
┌────────────────────────────────────┐
│  🎯                                  │
│                                      │
│  THI ĐẤU RANKED                     │
│                                      │
│  Tranh tài trực tiếp,               │
│  kiếm điểm rank lớn.                │
│                                      │
│  📖 Cần hoàn thành                  │
│     Bài Giáo Lý (10 câu)            │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  ▶  Làm bài giáo lý ngay       │ │  ← gold gradient
│  └────────────────────────────────┘ │
│                                      │
│  ⏱ Chỉ mất 5 phút                  │
└────────────────────────────────────┘
```

**State C: Bible Basics cooldown (đang chờ retry)**
```
┌────────────────────────────────────┐
│  🎯                                  │
│                                      │
│  THI ĐẤU RANKED                     │
│                                      │
│  Tranh tài trực tiếp,               │
│  kiếm điểm rank lớn.                │
│                                      │
│  📖 Bài Giáo Lý — Lần thử: 2        │
│  ⏱ Thử lại sau 0:42                 │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  ⏳  Đang chờ... (0:42)         │ │  ← disabled, gray
│  └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### CompactCard design (Secondary)

```css
.compact-card {
  height: 100px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  
  /* NO background pattern */
}

.compact-card:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(212,175,55,0.2);
  cursor: pointer;
}

.compact-card-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.compact-card-title {
  font-size: 15px;
  font-weight: 600;
}

.compact-card-subtitle {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 4px;
}
```

### Compact card example

```
┌──────────────────────┐
│  👥                  │
│  Nhóm Giáo Xứ        │
│  Hội thánh           │
└──────────────────────┘
```

Toàn card clickable, không có CTA button riêng.

### Subtitle mapping (max 4 từ)

| Mode | Compact Subtitle |
|---|---|
| Group | "Hội thánh" |
| Multiplayer | "2-20 người" |
| Tournament | "Bracket 1v1" |
| Weekly | "Chủ đề tuần" |
| Mystery | "Random hoàn toàn" |
| Speed | "10 câu × 10s" |

### Layout responsive

**Desktop**:
- Core grid: 2 columns (Practice + Ranked)
- Secondary grid: 3 columns × 2 rows = 6 cards

**Tablet (768-1023px)**:
- Core grid: 2 columns (giữ nguyên)
- Secondary grid: 3 columns × 2 rows (giữ nguyên)

**Mobile (<768px)**:
- Core grid: 1 column (Practice trên, Ranked dưới)
- Secondary grid: 2 columns × 3 rows = 6 cards

### Acceptance criteria

- 2 sections rõ ràng, có divider giữa
- Core featured cards: ~220px height, gold border subtle, BIG CTA
- Secondary cards: ~100px height, no patterns, tiny subtitle
- Ranked card render đúng 3 states (A/B/C)
- Mobile responsive đúng
- Tests (8): render core, render secondary, Ranked state A/B/C, navigate đúng, mobile layout

### Cost: 2-2.5h

### Commit
- `refactor(home): GameModeGrid 2-tier with Practice + Ranked featured`

---

## Step 3 — Bỏ BasicQuizCard banner khỏi Home

### Mục tiêu

BasicQuizCard banner standalone không còn cần thiết vì Ranked featured card đã handle state Bible Basics (State B trong Step 2).

### Implementation

1. Mở `apps/web/src/pages/Home.tsx`
2. Remove BasicQuizCard banner khỏi render
3. Component file BasicQuizCard.tsx KHÔNG xóa (vẫn dùng cho /basic-quiz page logic nếu có)

### Acceptance criteria

- Home KHÔNG còn BasicQuizCard banner standalone
- Tất cả thông tin Bible Basics đã được integrate vào Ranked featured card
- Test update: Home.test.tsx remove assertion về BasicQuizCard banner

### Cost: 15 phút

### Commit
- `refactor(home): remove BasicQuizCard banner (info now in Ranked card)`

---

## Step 4 — Cleanup: Bỏ background patterns + long descriptions

### Files cần update

1. **GameModeGrid.tsx hoặc compact card components**:
   - Xóa background pattern images
   - Xóa CSS `background-image` cho cards

2. **i18n cleanup**:
   - Long descriptions cho secondary modes → đổi thành tiny subtitle
   - Featured cards (Practice, Ranked) giữ description ngắn 1-2 dòng

### Acceptance criteria

- KHÔNG còn background patterns trên bất kỳ card nào
- Secondary cards: subtitle max 4 từ
- Featured cards: description max 2 dòng

### Cost: 30 phút

### Commit
- `polish(home): remove card background patterns, shorten descriptions`

---

## Step 5 — i18n updates

### Strings mới `vi.json`

```json
{
  "home": {
    "exploreMore": "Khám phá thêm",
    "compactSubtitles": {
      "group": "Hội thánh",
      "multiplayer": "2-20 người",
      "tournament": "Bracket 1v1",
      "weekly": "Chủ đề tuần",
      "mystery": "Random hoàn toàn",
      "speed": "10 câu × 10s"
    }
  },
  "featuredDaily": {
    "completed": {
      "title": "ĐÃ HOÀN THÀNH HÔM NAY",
      "score": "🎉 Bạn đúng {{correct}}/{{total}} câu — giỏi hơn {{percent}}% người chơi",
      "themeLabel": "Hôm nay: {{theme}}",
      "xpEarned": "+{{xp}} XP đã nhận",
      "nextChallenge": "Thử thách mới sau {{time}}",
      "ctaReview": "Xem lại bài làm"
    }
  },
  "rankedFeatured": {
    "title": "THI ĐẤU RANKED",
    "description": "Tranh tài trực tiếp, kiếm điểm rank lớn.",
    "unlocked": {
      "badge": "✅ Đã mở khóa",
      "energyLabel": "⚡ {{current}}/{{max}} năng lượng",
      "cta": "Bắt đầu Ranked"
    },
    "needBasicQuiz": {
      "label": "📖 Cần hoàn thành Bài Giáo Lý ({{count}} câu)",
      "cta": "Làm bài giáo lý ngay",
      "duration": "⏱ Chỉ mất 5 phút"
    },
    "cooldown": {
      "label": "📖 Bài Giáo Lý — Lần thử: {{attempts}}",
      "countdown": "⏱ Thử lại sau {{time}}",
      "ctaDisabled": "⏳ Đang chờ... ({{time}})"
    }
  },
  "practiceFeatured": {
    "title": "LUYỆN TẬP",
    "description": "Học không áp lực, không giới hạn thời gian.",
    "cta": "Bắt đầu"
  }
}
```

### Strings cần XÓA

- `gameModes.*.longDescription` (nếu có)
- `home.basicQuizBanner.*` (banner standalone đã bỏ)

### `en.json` corresponding

(Translate all keys)

### Acceptance criteria

- i18n validator pass
- New keys có cả vi và en
- Old long-description keys removed

### Cost: 30 phút

### Commit
- `i18n: featured cards + completed daily + Ranked states + cleanup`

---

## Step 6 — Full regression

### Manual smoke test

**Flow A — Fresh user, chưa pass Bible Basics, chưa làm Daily**:
1. Login → Home
2. Verify viewport đầu:
   - Hero compact
   - Daily Verse banner
   - **Featured Daily Challenge BIG** với CTA "Bắt đầu hôm nay"
3. Scroll → "Chế độ chơi" section:
   - **Core grid 2 BIG cards**: Practice + Ranked
   - Ranked card hiển thị "📖 Cần hoàn thành Bài Giáo Lý" + CTA "Làm bài giáo lý ngay"
4. Click Ranked → navigate `/basic-quiz`
5. Scroll thêm → Secondary grid 3x2 = 6 cards visible

**Flow B — User đã pass Bible Basics, chưa làm Daily**:
1. Login → Home
2. Daily Featured banner: state "Bắt đầu hôm nay" (active)
3. Ranked card: "✅ Đã mở khóa" + "⚡ 100/100 năng lượng" + CTA "Bắt đầu Ranked"
4. Click Ranked → navigate `/ranked`

**Flow C — User đã làm Daily, đã pass Bible Basics**:
1. Login → Home
2. Daily Featured banner: state "✅ Đã hoàn thành hôm nay 4/5"
3. CTA "Xem lại bài làm" → navigate `/daily/review`
4. Ranked card: state A "Đã mở khóa"

**Flow D — Visual focus test**:
1. Mở Home, không scroll
2. Đếm visual weights:
   - Featured Daily: dominant nhất
   - Practice + Ranked: 2 cards rõ ràng nổi bật
   - Secondary 6 cards: visible nhưng không compete
3. User mới dễ identify 3 actions chính: Daily / Practice / Ranked

### Checklist

- [ ] `npm run build` pass
- [ ] FE tests pass (>= baseline + ~12 new)
- [ ] BE tests pass (>= baseline + 2 new nếu có endpoint mới)
- [ ] Mobile responsive (core 1 column, secondary 2x3)
- [ ] No console errors
- [ ] i18n validator pass
- [ ] Manual flows A-D pass

### Commit
- `chore: regression after Home Option Y redesign`

---

## Workflow Order

```
Step 0: Verify                      — KHÔNG commit
Step 1: FeaturedDailyChallenge state— 1 commit
Step 2: GameModeGrid 2-tier         — 1 commit (bự nhất)
Step 3: Remove BasicQuizCard banner — 1 commit
Step 4: Cleanup patterns            — 1 commit
Step 5: i18n updates                — 1 commit
Step 6: Regression                  — 1 commit
```

6 commits, mỗi commit revertable.

---

## Files dự kiến đụng tới

### Frontend
- **Mới**:
  - `apps/web/src/components/FeaturedCard.tsx` (Practice + Ranked large)
  - `apps/web/src/components/CompactCard.tsx` (6 secondary modes)
  - Tests cho 2 components
- **Sửa**:
  - `apps/web/src/components/GameModeGrid.tsx` (2-tier refactor)
  - `apps/web/src/components/FeaturedDailyChallenge.tsx` (add completed state)
  - `apps/web/src/pages/Home.tsx` (remove BasicQuizCard banner)
  - `apps/web/src/i18n/vi.json` + `en.json`
  - Tests

### Backend
- **Có thể cần update** `/api/me/daily-challenge-status` để return `completedToday` + `score` + `betterThanPercent`
- Tests update nếu có change

### Mobile
- TÁCH PR sau

---

## Definition of Done

✅ Featured Daily Challenge: 2 states (active + completed) work đúng  
✅ Core grid: Practice + Ranked 2 BIG cards (~220px height)  
✅ Secondary grid: 6 cards medium (~100px height) visible 3x2  
✅ Ranked featured card: 3 states đúng (unlocked / need basic quiz / cooldown)  
✅ KHÔNG còn BasicQuizCard banner standalone  
✅ KHÔNG có background patterns trên cards  
✅ Visual hierarchy rõ: Featured Daily > Core (Practice/Ranked) > Secondary (6 cards)  
✅ User mới mở Home, identify được 3 actions chính trong 3 giây  
✅ Tests + i18n validator pass  
✅ Mobile responsive đúng  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên:

1. **Step 0 findings**: Số CARDS hiện tại trong GameModeGrid? FeaturedDailyChallenge có handle completed state chưa? `/api/me/daily-challenge-status` endpoint có completedToday field chưa?

2. **Edge case Daily completed banner**: Khi user click "Xem lại bài làm" — navigate đâu? `/daily/review` hay `/sessions/{lastDailyId}/review`?
   - **Đề xuất**: `/daily/result` hoặc `/daily/review` — route mới riêng cho Daily review

3. **Mobile core grid**: 2 cards stack vertical hay giữ horizontal scroll?
   - **Đề xuất**: Stack vertical (Practice trên, Ranked dưới) — natural reading flow trên mobile

Sau khi confirm 3 câu → bắt đầu Step 1.

---

## Reminder cuối

- **Visual hierarchy phải rõ**: Featured Daily > Core (Practice/Ranked) > Secondary
- **Practice + Ranked phải THẬT BIG** — đừng làm "core" nhưng vẫn 100px → fail mục tiêu
- Secondary cards visible KHÔNG hide — user phải thấy app có nhiều options
- KHÔNG over-engineer animations
- Mục tiêu: User mở Home, **3 actions chính rõ ràng trong 3 giây**: Daily / Practice / Ranked
- Background patterns BỎ HOÀN TOÀN, dù có thể "thiếu visual interest" — đó là trade-off acceptable cho focus
