# Home Refactor — 4 Fixes Trước Khi Code (REVISED v2)

**Context**: Plan trong `ui-ux-refactor.md` đã approved 80%. Cần fix 4 điểm sau trước khi implement. KHÔNG bắt đầu code Home.tsx hay tạo components mới cho đến khi 4 fixes này được verify/update xong.

**Quy tắc**: Mỗi fix = 1 commit riêng để rollback dễ. KHÔNG gộp vào 1 commit lớn.

**v2 changes**: Fix 1 đã được revised — KHÔNG rewrite backend daily challenge algorithm. Dùng frontend-only "Book Mix Display" thay thế. Cost giảm từ 17-23h → 11-15h.

---

## FIX 1 (REVISED) — FeaturedDailyChallenge với Book Mix Display

**Decision**: KHÔNG rewrite Daily Challenge selection algorithm. Giữ nguyên random scatter (architecture hiện tại đang work + spec §5.3 đã design Daily = variety, Journey = depth).

**Approach**: FE-only — extract unique books từ `questions` array có sẵn trong response, hiển thị tagline động.

### Verify trước khi code

Đọc `apps/api/src/main/java/com/biblequiz/modules/daily/dto/` (hoặc tên DTO tương đương) và trả lời:

1. Question object trong `/api/daily-challenge` response có field `book` không? (yes/no)
2. Nếu yes, format là gì?
   - English key: `"Genesis"`, `"Exodus"`, `"John"`, etc.
   - Vietnamese key: `"Sáng Thế Ký"`, `"Xuất Hành"`, etc.
   - Hay format khác?

KHÔNG bắt đầu code FeaturedDailyChallenge cho đến khi verify xong.

### Component design

```
┌──────────────────────────────────────────────────────────────┐
│  📅  THỬ THÁCH HÔM NAY                                        │
│                                                                │
│  🌍 Hành trình qua 4 sách hôm nay                              │
│  Sáng Thế • Thi Thiên • Giăng • Khải Huyền                    │
│                                                                │
│  5 câu • 5 phút • +50 XP                                       │
│                                                                │
│  ⏱  Thử thách mới sau 14:23:11                                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            ▶  BẮT ĐẦU HÔM NAY                            │ │  ← gold-gradient CTA
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Logic tagline

```typescript
const uniqueBooks = [...new Set(questions.map(q => q.book))]
const bookCount = uniqueBooks.length

// Translate book names sang tiếng Việt qua existing helper
const bookNames = uniqueBooks.map(b => getBookName(b, currentLanguage))

let tagline: string
if (bookCount === 1) {
  // 1 sách: "Khám phá Sáng Thế Ký hôm nay"
  tagline = t('home.featuredDaily.singleBook', { book: bookNames[0] })
} else if (bookCount <= 3) {
  // 2-3 sách: "Hành trình qua 3 sách: Sáng Thế • Thi Thiên • Giăng"
  tagline = t('home.featuredDaily.fewBooks', { 
    count: bookCount, 
    books: bookNames.join(' • ') 
  })
} else {
  // 4-5 sách: "🌍 Hành trình qua 5 sách: A • B • C • D • E"
  tagline = t('home.featuredDaily.manyBooks', { 
    count: bookCount, 
    books: bookNames.join(' • ') 
  })
}
```

### State variants

| State | Display |
|-------|---------|
| Loading | Skeleton placeholder (không spinner) |
| Loaded + chưa làm | Tagline + countdown + CTA "Bắt đầu hôm nay" |
| Loaded + đã làm | Tagline + "✅ Bạn đã hoàn thành hôm nay — Quay lại sau {countdown}" |
| Error | Fallback "Thử Thách Hôm Nay — 5 câu mỗi ngày" + retry button |

### Implementation notes

- Sử dụng existing `getBookName(bookKey, language)` helper trong `apps/web/src/data/bibleData.ts`
- Countdown đến 00:00 UTC (theo spec §5.3 timezone)
- Click CTA → navigate `/daily`
- Component đặt ngay sau Daily Verse banner (xem Fix 3)

### Acceptance criteria

- Component `FeaturedDailyChallenge.tsx` render đúng 4 state variants
- Book names translate đúng theo language hiện tại (vi/en)
- Countdown update mỗi second
- Click CTA navigate `/daily`
- Test cases (8): render loading, render loaded với 1 book, render với 5 books, completed state, error state, countdown format, language switch, navigate on click

### Cost

**1-2 giờ** (giảm từ 6-8h trong plan v1)

---

## FIX 2 — LockedModesTeaser Visual Redesign

**Vấn đề**: Wireframe hiện tại của LockedModesTeaser là text list:
```
🔒  5 CHẾ ĐỘ ĐANG CHỜ BẠN
⚡ Thi Đấu • 🎲 Mystery • ⚡ Speed • 🏆 Giải Đấu • 🎮 Phòng Chơi
Lên hạng Người Tìm Kiếm (1,000 XP) để mở khóa →
```

Trông như feature list landing page — không tạo curiosity gap. User đọc xong nghĩ "ờ" thay vì "ồ tôi muốn unlock".

### Design mới

```
┌──────────────────────────────────────────────────────────────┐
│  🔒  ĐANG CHỜ MỞ KHÓA                                         │
│                                                                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │
│  │  ⚡  │  │  🎲  │  │  ⚡  │  │  🏆  │  │  🎮  │            │  ← 5 ô blurred
│  │ blur │  │ blur │  │ blur │  │ blur │  │ blur │            │     (filter: blur(4px))
│  │  🔒  │  │  🔒  │  │  🔒  │  │  🔒  │  │  🔒  │            │     + lock overlay
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘            │
│  Ranked    Mystery   Speed     Tournament Multiplayer         │  ← tên hiện rõ dưới
│                                                                │
│  ▓░░░░░░░░░░░░░░░░░  0 / 1,000 XP đến Người Tìm Kiếm          │  ← progress bar
│                                                                │
│  Tìm hiểu hệ thống hạng →                                      │
└──────────────────────────────────────────────────────────────┘
```

### Implementation notes

- **Grid breakpoint**: `grid-cols-3 sm:grid-cols-5 gap-3`
  - Mobile (<640px): 3 cells row 1 + 2 cells row 2 (3+2 wrap)
  - ≥640px (sm/md/lg/xl): 5 cells single row
- **Visual blur**: CSS `filter: blur(4px)` trên icon, KHÔNG blur tên mode (để user vẫn đọc được)
- **Lock overlay**: lock icon SVG positioned center của mỗi ô, opacity ~0.7
- **Progress bar**: tái sử dụng `TierProgressBar` component nếu compatible, hoặc inline progress bar đơn giản
- **Hover** (desktop only): hover vào ô → tooltip hiện preview mô tả mode (vd: "Thi đấu xếp hạng — Cạnh tranh real-time")
- **Click toàn card** → navigate `/help#tiers`

### Acceptance criteria

- Component `LockedModesTeaser.tsx` render 5 cells grid với blur + lock
- Progress bar hiển thị đúng XP gap đến next tier
- Mobile responsive (3+2 wrap), desktop 5 cells single row
- Click card → navigate `/help#tiers`
- Test cases (5): render 5 modes, blur applied, progress bar correct value, navigate on click, hide khi tier ≥ 5

### Cost

**3-4 giờ**

---

## FIX 3 — Daily Verse Repositioning

**Vấn đề**: Plan đặt Daily Verse ở góc phải dưới cùng — sau Leaderboard. Vị trí afterthought.

Với BibleQuiz, Bible verse là **brand soul**. Đặt verse ở góc dưới = bỏ lỡ moment thiết lập tone "đây là app về Lời Chúa, không phải app game thông thường".

### Vị trí mới

```
[Hero compact — greeting + tier progress]
        ↓
[📜 Daily Verse — full-width banner]    ← MOVE LÊN ĐÂY
        ↓
[Featured Daily Challenge — hero card]
        ↓
[2 secondary cards: Practice + Group]
        ↓
... (giữ nguyên thứ tự còn lại)
```

### Design verse banner

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│   "Ban đầu Đức Chúa Trời dựng nên trời và đất."               │
│                                                                │
│   — Sáng Thế Ký 1:1 (Bản Truyền Thống Hiệu Đính 2011)         │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Implementation notes

- Component đã tồn tại trong codebase (search `DailyVerse` hoặc `verses.ts`)
- Chỉ cần MOVE vị trí trong `Home.tsx`, KHÔNG tạo component mới
- Style: italic font, gold accent border-left (4px solid gold), padding rộng, font size lớn hơn body text
- Background: subtle gradient hoặc transparent, KHÔNG dùng glass-card heavy
- Tooltip nhỏ: "Câu Kinh Thánh hôm nay" trên mobile khi tap

### Acceptance criteria

- Daily Verse component render ngay sau Hero compact
- Sidebar phải KHÔNG còn verse (tránh duplicate)
- Verse rotate theo `getDailyVerse()` (đã implement, không đổi logic)
- Test update: position assertion trong Home.test.tsx

### Cost

**1-1.5 giờ**

---

## FIX 4 — Activity Feed Empty State (Part A only)

**Vấn đề**: Wireframe vẫn show dummy data:
```
• Nguyễn A vừa đạt Hiền Triết
• Minh Tâm đã tham gia vào Nhóm Giáo Xứ của bạn
• Hùng Dũng đã duy trì chuỗi 30 ngày!
```

Nhưng ngày launch thực tế = 0 user → feed sẽ trống.

**Decision**: Part A only (frontend hardcode empty state + system welcome). Defer Part B (backend activity feed pipeline) → v1.1 vì Backend chưa có `/api/activity` endpoint, build full pipeline sẽ tốn nhiều time.

### Component empty state

Khi `activityFeed.length === 0` (luôn đúng cho launch):

```
┌──────────────────────────────────────────────────────────────┐
│  📰  Hoạt động gần đây                                        │
│                                                                │
│  🌱  Bạn là người tiên phong!                                  │
│                                                                │
│  Hoạt động cộng đồng sẽ xuất hiện khi anh em                  │
│  trong hội thánh chơi cùng bạn.                                │
│                                                                │
│  [Mời anh em →]                                                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

CTA "Mời anh em" → navigate `/groups` (user có thể tạo hoặc mời vào group).

### System welcome message (cho user mới)

Nếu `user.createdAt < 7 days ago` (frontend check), prepend 1 system message vào feed:

```
🎉  Chào mừng đến BibleQuiz! Phiên bản 1.0 vừa ra mắt.
    Hãy bắt đầu hành trình của bạn ngay hôm nay.
```

Style khác biệt user activity: gold border-left, không avatar, icon 🎉.

### Implementation notes

- Frontend hardcode trong `Home.tsx` hoặc tạo component `ActivityFeedEmpty.tsx`
- Logic kiểm tra `user.createdAt`:
  ```typescript
  const isNewUser = (Date.now() - new Date(user.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000
  ```
- KHÔNG xóa code dummy data hoàn toàn — comment ra với note `// TODO v1.1: replace with real activity feed from /api/activity`
- Hoặc xóa hẳn nếu sạch hơn

### Acceptance criteria

- Component có branch render empty state khi feed.length === 0
- Empty state có CTA dẫn tới `/groups`
- KHÔNG còn dummy data hardcode "Nguyễn A", "Minh Tâm", "Hùng Dũng" trong production code
- System welcome render khi user mới (< 7 days)
- Test cases (3): render empty state, CTA click navigates, system welcome render khi user mới

### Cost

**2-3 giờ**

---

## Workflow Order (BẮT BUỘC)

```
Step 0:       VERIFY trước khi code
              └─ Trả lời 1 câu hỏi: Question DTO có field `book` không?
                 (Đọc DailyChallengeController + DTO)
              KHÔNG có commit, chỉ comment trong reply

Step 1:       FIX 1 — FeaturedDailyChallenge component (FE-only)
              ├─ Component với 4 state variants
              ├─ Logic extract uniqueBooks + tagline
              ├─ Translate book names qua getBookName()
              ├─ Tests (8 cases)
              └─ Commit: "feat(home): FeaturedDailyChallenge with book mix display"

Step 2:       FIX 2 — LockedModesTeaser blur grid
              ├─ Component mới với grid blur + lock overlay
              ├─ Progress bar XP đến next tier
              ├─ Mobile responsive (3+2 wrap)
              ├─ Tests (5 cases)
              └─ Commit: "feat(home): LockedModesTeaser with blurred preview"

Step 3:       FIX 3 — Daily Verse reposition
              ├─ Move vị trí trong Home.tsx
              ├─ Style update (italic, gold border-left)
              ├─ Xóa khỏi sidebar phải
              └─ Commit: "ui(home): reposition DailyVerse to top banner"

Step 4:       FIX 4 — Activity Feed empty state
              ├─ Empty state component
              ├─ System welcome message logic
              ├─ Xóa dummy data
              ├─ i18n keys
              ├─ Tests (3 cases)
              └─ Commit: "feat(home): activity feed empty state for launch"

Step 5:       Integration Home.tsx
              ├─ Hero compact (gộp 3 chỗ tier info → 1)
              ├─ Wire FeaturedDailyChallenge, DailyVerse, LockedModesTeaser
              ├─ GameModeGrid layout='tier1' prop (chỉ Practice + Group)
              ├─ Update Home.test.tsx
              └─ Commit: "refactor(home): tier-1 first impression layout"

Step 6:       Full regression
              ├─ npm run build pass (0 errors)
              ├─ FE tests pass (>= 756 = baseline 733 + 23 new)
              ├─ BE tests pass (>= 494)
              ├─ Manual smoke test: fresh tier 1 user account
              ├─ i18n validator pass
              └─ Commit: "chore: regression after Home tier 1 refactor"
```

**KHÔNG skip steps. KHÔNG merge steps. Mỗi commit phải có thể revert độc lập.**

---

## i18n Strings Mới

### `apps/web/src/i18n/vi.json`

```json
{
  "home": {
    "featuredDaily": {
      "title": "THỬ THÁCH HÔM NAY",
      "singleBook": "Khám phá {{book}} hôm nay",
      "fewBooks": "Hành trình qua {{count}} sách",
      "manyBooks": "🌍 Hành trình qua {{count}} sách",
      "bookList": "{{books}}",
      "meta": "5 câu • 5 phút • +50 XP",
      "countdown": "Thử thách mới sau {{time}}",
      "cta": "Bắt đầu hôm nay",
      "completed": "✅ Bạn đã hoàn thành hôm nay — Quay lại sau {{time}}",
      "loading": "Đang tải thử thách...",
      "errorFallback": "Thử Thách Hôm Nay — 5 câu mỗi ngày",
      "retry": "Thử lại"
    },
    "lockedTeaser": {
      "title": "ĐANG CHỜ MỞ KHÓA",
      "modeNames": {
        "ranked": "Thi Đấu",
        "mystery": "Mystery",
        "speedRound": "Speed",
        "tournament": "Giải Đấu",
        "multiplayer": "Phòng Chơi"
      },
      "progressLabel": "{{current}} / {{target}} XP đến {{tierName}}",
      "linkText": "Tìm hiểu hệ thống hạng →"
    },
    "activityFeed": {
      "title": "Hoạt động gần đây",
      "emptyTitle": "Bạn là người tiên phong!",
      "emptyBody": "Hoạt động cộng đồng sẽ xuất hiện khi anh em trong hội thánh chơi cùng bạn.",
      "emptyCta": "Mời anh em",
      "systemWelcome": "🎉 Chào mừng đến BibleQuiz! Phiên bản 1.0 vừa ra mắt. Hãy bắt đầu hành trình của bạn ngay hôm nay."
    },
    "emptyLeaderboard": {
      "title": "Bạn chưa có trên bảng xếp hạng",
      "body": "Chơi 5 câu để bắt đầu xuất hiện",
      "cta": "Chơi ngay"
    },
    "emptyStreak": "Bắt đầu chuỗi của bạn — chơi 1 câu hôm nay"
  }
}
```

### `apps/web/src/i18n/en.json`

```json
{
  "home": {
    "featuredDaily": {
      "title": "TODAY'S CHALLENGE",
      "singleBook": "Explore {{book}} today",
      "fewBooks": "Journey through {{count}} books",
      "manyBooks": "🌍 Journey through {{count}} books",
      "bookList": "{{books}}",
      "meta": "5 questions • 5 min • +50 XP",
      "countdown": "Next challenge in {{time}}",
      "cta": "Start today",
      "completed": "✅ You finished today — Come back in {{time}}",
      "loading": "Loading challenge...",
      "errorFallback": "Today's Challenge — 5 questions daily",
      "retry": "Try again"
    },
    "lockedTeaser": {
      "title": "WAITING TO UNLOCK",
      "modeNames": {
        "ranked": "Ranked",
        "mystery": "Mystery",
        "speedRound": "Speed",
        "tournament": "Tournament",
        "multiplayer": "Multiplayer"
      },
      "progressLabel": "{{current}} / {{target}} XP to {{tierName}}",
      "linkText": "Learn the tier system →"
    },
    "activityFeed": {
      "title": "Recent activity",
      "emptyTitle": "You're a pioneer!",
      "emptyBody": "Community activity will appear when fellow believers play with you.",
      "emptyCta": "Invite friends",
      "systemWelcome": "🎉 Welcome to BibleQuiz! Version 1.0 just launched. Start your journey today."
    },
    "emptyLeaderboard": {
      "title": "You're not on the leaderboard yet",
      "body": "Play 5 questions to start appearing",
      "cta": "Play now"
    },
    "emptyStreak": "Start your streak — play 1 question today"
  }
}
```

**Validator**: Phải chạy `cd apps/web && npm run validate:i18n` — keys mới phải đồng bộ vi/en.

---

## Time Estimate (REVISED v2)

| Step | Task | Cost v2 | Cost v1 |
|------|------|---------|---------|
| 0 | Verify Question DTO | 15 phút | — |
| 1 | FeaturedDailyChallenge (FE-only book mix) | **1-2h** | ~~6-8h~~ |
| 2 | LockedModesTeaser blur grid | 3-4h | 3-4h |
| 3 | Daily Verse reposition | 1-1.5h | 1-1.5h |
| 4 | Activity Feed empty state (Part A) | 2-3h | 2-3h |
| 5 | Integration Home.tsx | 4-5h | 4-5h |
| 6 | Full regression | 1-2h | 1-2h |
| **Tổng** | | **12-17.5h** | ~~17-23.5h~~ |

Buffer 20%: **~2-2.5 ngày làm việc** (giảm từ 3-4 ngày v1).

---

## Files dự kiến đụng tới

### Backend
- KHÔNG đổi (decision: skip rewrite Daily Challenge algorithm)

### Frontend
- **Mới**: 
  - `apps/web/src/components/FeaturedDailyChallenge.tsx`
  - `apps/web/src/components/LockedModesTeaser.tsx`
  - Tests cho 2 components trên
- **Sửa**:
  - `apps/web/src/pages/Home.tsx` (refactor lớn)
  - `apps/web/src/components/GameModeGrid.tsx` (thêm prop layout)
  - `apps/web/src/components/ActivityFeed.tsx` (hoặc tên hiện tại — thêm empty state)
  - `apps/web/src/i18n/vi.json` + `en.json`
  - `apps/web/src/pages/__tests__/Home.test.tsx`

### Mobile (TÁCH PR — không làm chung)
- Để Bui quyết riêng sau khi web done.

---

## Definition of Done

✅ Tất cả 4 fixes implemented theo spec  
✅ 6 commits riêng biệt, mỗi commit revertable độc lập  
✅ Web build pass (npm run build, 0 errors)  
✅ FE test count >= 756 (baseline 733 + 23 mới)  
✅ BE test count >= baseline (494)  
✅ Manual smoke test: mở Home với fresh tier 1 user → verify wireframe match  
✅ i18n validator pass (vi/en đồng bộ keys)  
✅ KHÔNG còn dummy data hardcode trong production code  
✅ Daily Challenge book mix tagline render đúng (1, 2-3, 4-5 books variants)  
✅ KHÔNG đụng vào DailyChallengeService backend  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên trước khi code:

1. **Step 0 verify**: Question DTO trong `/api/daily-challenge` response có field `book` không? Format gì? (English key hay Vietnamese?)
2. **Tablet breakpoint Fix 2**: Confirm `grid-cols-3 sm:grid-cols-5` (3+2 mobile, 5 single row tablet+desktop)?
3. **Activity Feed dummy data**: Xóa hẳn hay comment với TODO v1.1?

Sau khi tôi confirm → bắt đầu Step 1.

---

**Reminder**: Đây là first impression cho launch. Mỗi pixel quan trọng. Đừng vội. Quality > speed.