# Home Page UI Refactor — Tier 1 First Impression

**Goal**: Redesign Home page for first release. Tất cả user là tier 1 (Tân Tín Hữu). Mục tiêu: first impression mạnh, giảm overwhelm từ 9 game mode cards → 1 featured + 2 secondary + 1 locked teaser.

**Context**:
- Spec §2: "70% users bỏ app trong 3 phút đầu nếu không biết làm gì"
- Hiện tại Home hiện 9 modes cho user mới → quá tải
- Đây là design decision có chủ đích, KHÔNG dựa data/analytics

---

## A. Wireframe ASCII

### Tier 1 (sau release — first impression)

```
┌──────────────────────────────────────────────────────────────────┐
│  ☼ Chào buổi sáng, Nghĩa!                            🔥 0 ngày  │  ← Hero compact, full-width
│  Tân Tín Hữu  ▓░░░░░░░░░░  0 / 1,000 XP                          │     - 1 dòng greeting + streak inline
│  Còn 1,000 XP để đạt Người Tìm Kiếm                              │     - 1 progress bar
└──────────────────────────────────────────────────────────────────┘     - KHÔNG có "Next Tier Card" riêng

┌──────────────────────────────────────────────────────────────────┐
│  📅  THỬ THÁCH HÔM NAY                              [hero card]  │  ← FEATURED (full-width, large)
│  "Sáng Tạo & Nguyên Tổ" — Sáng Thế 1-3                           │
│  5 câu • 5 phút • +50 XP                                         │
│                                                                  │
│  ⏱  Thử thách mới sau 14:23:11                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           ▶  BẮT ĐẦU HÔM NAY                              │   │  ← gold-gradient CTA lớn
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬────────────────────────────────┐
│  📖 Luyện Tập                   │  ⛪ Nhóm Giáo Xứ                │  ← 2 secondary cards
│  Học không áp lực                │  Chơi cùng cộng đồng           │     (50% size, no loud CTA)
│  Tap để bắt đầu →                │  Tap để khám phá →             │
└─────────────────────────────────┴────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  🎯 Nhiệm Vụ Hôm Nay   0/3                          [+50 XP]    │  ← DailyMissionsCard (giữ nguyên)
│  • Trả lời đúng 3 câu                            ░░░░░ 0/3       │
│  • Hoàn thành Thử Thách Ngày                     ░░░░░ 0/1       │
│  • Combo 5 câu liên tiếp                         ░░░░░ 0/1       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  🗺  Hành Trình Kinh Thánh   0/66 sách             [chevron] →   │  ← JourneyWidget (giữ nguyên)
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  🔒  5 CHẾ ĐỘ ĐANG CHỜ BẠN                                       │  ← LockedModesTeaser (MỚI)
│  ⚡ Thi Đấu Xếp Hạng  •  🎲 Mystery  •  ⚡ Speed Round           │     1 card duy nhất
│  🏆 Giải Đấu  •  🎮 Phòng Chơi                                   │     icon row, không từng card riêng
│                                                                  │
│  Lên hạng Người Tìm Kiếm (1,000 XP) để mở khóa  →                │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┬─────────────────────────────┐
│  🏆 Bảng Xếp Hạng [daily|weekly]   │  📰 Hoạt động gần đây        │
│  ┌──────────────────────────────┐  │  • Nguyễn A đạt Hiền Triết  │
│  │ Empty state action-oriented: │  │  • Minh Tâm tham gia nhóm   │
│  │ "Chơi 5 câu để xuất hiện     │  │  • Hùng Dũng streak 30 ngày │
│  │  trên bảng xếp hạng"         │  │                              │
│  │ [▶ Chơi ngay]                │  ├─────────────────────────────┤
│  └──────────────────────────────┘  │  📜 Daily Verse              │
│                                    │  "Ban đầu Đức Chúa Trời..."  │
│                                    │  — Sáng Thế 1:1              │
└────────────────────────────────────┴─────────────────────────────┘
```

### Tier 2+ (sau khi user lên hạng)

```
[Hero compact — giữ nguyên như tier 1]

[Featured Daily Challenge — vẫn ở vị trí #1]   ← daily luôn là hero, kể cả tier cao

┌───────────────┬───────────────┬───────────────┐
│ 📖 Luyện Tập  │ ⚡ Thi Đấu    │ ⛪ Nhóm Giáo  │  ← grid 3 cột — primary/secondary
│               │ Xếp Hạng [LIVE]│   Xứ          │     (Ranked unlock → promoted lên grid)
└───────────────┴───────────────┴───────────────┘

┌───────────────┬───────────────┬───────────────┐
│ 🎮 Phòng Chơi │ 🎲 Mystery    │ ⚡ Speed       │  ← variety unlock dần khi tier ≥ 2
│               │   1.5x XP     │   Round        │     (tier 4+ thêm 🏆 Giải Đấu)
└───────────────┴───────────────┴───────────────┘

[Daily Missions / Journey / Leaderboard — như tier 1]

┌──────────────────────────────────────────────────────────────────┐
│  🔒 1 chế độ sắp mở: Giải Đấu (Hiền Triết)                       │  ← teaser thu nhỏ — chỉ còn locked
└──────────────────────────────────────────────────────────────────┘
```

---

## B. Component Diff

### Files đổi

| File | Thay đổi |
|------|----------|
| `apps/web/src/pages/Home.tsx` | Thay hero 2-column (lines 125-205) → hero 1-row compact. Thay GameModeGrid props → tier-aware rendering. Thêm `<FeaturedDailyChallenge>` trên đầu. Thêm `<LockedModesTeaser>` cuối. Sửa empty state leaderboard (line 261) action-oriented. |
| `apps/web/src/components/GameModeGrid.tsx` | Thêm prop `layout: 'tier1' \| 'tier2plus'`. Tier1: render only Practice + Group (2 cards). Tier2+: render full grid như cũ. |

### Files tạo mới

| File | Vai trò |
|------|---------|
| `apps/web/src/components/FeaturedDailyChallenge.tsx` | Hero card cho Daily Challenge: title chủ đề, countdown đến midnight UTC, 1 CTA "Bắt đầu hôm nay". Fetch từ `/api/daily-challenge` để lấy theme + chapter. |
| `apps/web/src/components/LockedModesTeaser.tsx` | 1 card duy nhất, list 5 mode locked với icon row + CTA "Lên hạng để mở khóa" → link `/help#tiers` hoặc page mới. |
| `apps/web/src/components/EmptyLeaderboardCTA.tsx` | Thay `<p>{t('home.noLeaderboardData')}</p>` cứng → action-oriented card với "Chơi 5 câu" CTA → `/practice`. |

### Files xóa / không dùng nữa

| File | Lý do |
|------|-------|
| Section "Next Rank Preview" trong Home.tsx (lines 178-204, `data-testid="home-next-tier-card"`) | Trùng với progress bar — gộp vào hero compact. |
| `t('home.exploreModes', { count: 9 })` | Bỏ count cứng, có thể giữ key cho tier2+ với count động. |

### Component KHÔNG đổi

- `MilestoneBanner`, `TierProgressBar` (vẫn dùng trong hero compact)
- `DailyMissionsCard`, `JourneyWidget`
- `ComebackModal`, `DailyBonusModal`, `EarlyRankedUnlockModal`, `TutorialOverlay`
- `getRecommendedMode` utility (Tier 2+ vẫn cần)

---

## C. Test Impact

### Tests sẽ FAIL (cần update)

| Test file | Test cases fail | Lý do | Cost |
|-----------|----------------|-------|------|
| `Home.test.tsx:169-175` | "displays section header" assert `KHÁM PHÁ 9 CHẾ ĐỘ` | Đổi count + có thể đổi label | Update 1 assertion |
| `Home.test.tsx:119-125` | "displays next rank preview" assert `Hạng kế tiếp` | Card này bị xóa | Xóa hẳn test (info đã nằm trong progress bar dưới) |
| `Home.test.tsx:104-107` | "displays tier progress bar" | Còn nhưng layout đổi | Có thể vẫn pass nếu giữ `data-testid="home-tier-progress-bar"` |
| `Home.test.tsx:253-261` | "shows empty state" assert `Chưa có dữ liệu xếp hạng` | Đổi sang action-oriented copy | Update assertion + thêm test cho CTA button |
| `GameModeGrid.test.tsx` (90+ tests) | Không break — Home.test.tsx mock GameModeGrid (line 13). GameModeGrid riêng vẫn pass nếu prop `layout` default = 'tier2plus'. | Test riêng còn nguyên | 0 fail nếu backward compat |

### Tests cần thêm mới

| Component | Test cases |
|-----------|-----------|
| `FeaturedDailyChallenge.test.tsx` | (8) render, props loading, theme display, countdown formatting, CTA navigates `/daily`, error state, midnight rollover, completed state ("Đã hoàn thành hôm nay") |
| `LockedModesTeaser.test.tsx` | (5) render 5 mode icons, CTA text shows tier requirement, click navigates, hidden when tier ≥ 5, mobile responsive |
| `EmptyLeaderboardCTA.test.tsx` | (3) render copy, CTA navigates `/practice`, only shows when leaderboard.length === 0 |
| `Home.test.tsx` thêm | (4) tier-1 hero compact (no next-rank card), tier-2+ shows full grid, FeaturedDailyChallenge above grid, LockedModesTeaser only when tier < 5 |
| `GameModeGrid.test.tsx` thêm | (3) layout='tier1' renders only Practice + Group, layout='tier2plus' renders full grid (existing behavior), default layout when prop omitted |

**Tổng**: ~5 tests update + ~23 tests mới. Baseline 733 → mục tiêu ≥ 751. Refactor cost: **~1 ngày**.

---

## D. i18n strings mới

### `apps/web/src/i18n/vi.json`

```json
{
  "home": {
    "featuredDaily": {
      "title": "THỬ THÁCH HÔM NAY",
      "subtitle": "{{theme}} — {{chapterRange}}",
      "meta": "5 câu • 5 phút • +50 XP",
      "countdown": "Thử thách mới sau {{time}}",
      "cta": "Bắt đầu hôm nay",
      "completed": "Bạn đã hoàn thành hôm nay — quay lại sau {{time}}",
      "loading": "Đang tải thử thách..."
    },
    "lockedTeaser": {
      "title": "{{count}} chế độ đang chờ bạn",
      "modes": "Thi Đấu Xếp Hạng • Mystery • Speed Round • Phòng Chơi • Giải Đấu",
      "ctaTier2": "Lên hạng {{tierName}} ({{points}} XP) để mở khóa",
      "ctaTier4": "Đạt hạng {{tierName}} để mở khóa Giải Đấu",
      "linkText": "Tìm hiểu hệ thống hạng →"
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
      "subtitle": "{{theme}} — {{chapterRange}}",
      "meta": "5 questions • 5 min • +50 XP",
      "countdown": "Next challenge in {{time}}",
      "cta": "Start today",
      "completed": "You finished today — come back in {{time}}",
      "loading": "Loading challenge..."
    },
    "lockedTeaser": {
      "title": "{{count}} modes waiting for you",
      "modes": "Ranked • Mystery • Speed Round • Multiplayer • Tournament",
      "ctaTier2": "Reach {{tierName}} ({{points}} XP) to unlock",
      "ctaTier4": "Reach {{tierName}} to unlock Tournament",
      "linkText": "Learn the tier system →"
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

**Validator**: Phải chạy `cd apps/web && npm run validate:i18n` — thêm 11 keys mỗi ngôn ngữ.

---

## E. Mobile parity

### Hiện trạng `apps/mobile/src/screens/main/HomeScreen.tsx:15-22`

- Mobile hardcode 6 modes (Practice, Ranked, Daily, Mystery, Speed, Multiplayer) — KHÁC web (web có 9 + Tournament + Group + Weekly)
- KHÔNG dùng i18n keys cho mode title/desc — hardcode tiếng Việt
- KHÔNG có concept tier-aware visibility

### Cần đổi mobile?

**Đề xuất: CÓ — đồng bộ tinh thần, không 1:1 layout.**

| Section | Action mobile |
|---------|--------------|
| Hero compact | Đã compact (tier card đơn giản) — chỉ xóa nếu có duplication. Hiện ổn. |
| FeaturedDailyChallenge | **THÊM** — đặt trên `GAME_MODES` grid. Cùng prop fetch `/api/daily-challenge`. Native equivalent của web component. |
| Tier 1 game mode grid | **REDUCE** từ 6 → 2 (Practice + giả lập "Group" — hoặc giữ 3: Practice/Daily/Multiplayer nếu muốn social). Hiện đang hardcoded array — chỉ filter theo `tier.current.id === 1`. |
| LockedModesTeaser | **THÊM** native version: 1 card với icon row của các mode bị ẩn. |
| Empty leaderboard CTA | Mobile chưa có leaderboard preview hoàn chỉnh trong file đọc được — kiểm tra `LeaderboardPreview` component (line 98 reference) trước khi quyết. |

**Cost mobile**: ~0.5-1 ngày (3 tasks: thêm FeaturedDailyChallenge component native, filter GAME_MODES theo tier, thêm LockedModesTeaser).

**KHÔNG block release web**: Mobile có thể làm trong sprint kế tiếp. Hai platform có thể tạm khác layout — mobile vẫn ổn vì 6 modes < 9 modes web hiện tại, không quá tải.

---

## Summary trước khi implement

| Aspect | Số liệu |
|--------|---------|
| Files đổi | 2 (Home.tsx, GameModeGrid.tsx) |
| Files mới | 3 components + 3 test files |
| Tests update | 4-5 cases |
| Tests mới | ~23 cases |
| i18n keys mới | 11 keys × 2 ngôn ngữ |
| Mobile parity | Tách sprint sau, ~1 ngày |
| Tổng cost web | ~1.5-2 ngày |

---

## Câu hỏi để clarify trước khi code

1. **Daily Challenge có theme/chapter range chưa?** Tôi giả định endpoint `/api/daily-challenge` trả về object có `theme`, `chapterRange`. Cần verify backend DTO để FeaturedDailyChallenge fetch đúng — nếu chưa có, dùng fallback "Thử Thách Hôm Nay" generic.
2. **Locked teaser click → đi đâu?** `/help#tiers` (FAQ section), hay page mới `/tiers` dedicated? Tôi đề xuất `/help#tiers` (đã có Help page, không tạo route mới).
3. **Mobile có làm cùng PR này không?** Đề xuất TÁCH — web release trước, mobile sprint sau.
