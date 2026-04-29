# Bỏ Tier Hard-Lock — Mở Hết Game Modes Cho User Mới

**Decision**: Đổi từ Triết lý A (Progressive Unlock — lock mode theo tier) sang Triết lý B (Open Access — mọi mode mở từ tier 1, tier chỉ ảnh hưởng perks/rewards).

**Lý do**: Target user của BibleQuiz là mọi người (không chỉ thành viên hội thánh hiện tại). Lock 5/8 modes cho user mới = barrier quá cao cho first impression launch. Pattern này không match với apps gamification thành công (Duolingo, Khan Academy, Strava — tất cả đều mở full feature từ đầu, tier chỉ ảnh hưởng perks).

**3 Quyết định đã chốt cho launch v1**:
- ✅ Modal gợi ý mạnh Daily Challenge cho user mới (KHÔNG force)
- ✅ Defer matchmaking → v1.1, launch với warning trên Multiplayer
- ✅ Hardcode "Đề xuất bắt đầu" section (KHÔNG implement recommendation engine)

**Cost ước tính**: 5-8 giờ (~1 ngày làm việc).

**Quy tắc**: Mỗi step = 1 commit riêng để rollback dễ. KHÔNG gộp.

---

## Verify trước khi code (Step 0)

Đọc và trả lời trong reply đầu tiên trước khi code:

1. **Backend tier check ở đâu?** Grep:
   ```
   rg "requiredTier|minimumTier|tierLevel.*<|unlockedAtTier"
   ```
   Liệt kê tất cả file có check tier để gate mode access. Đặc biệt check:
   - `apps/api/src/main/java/com/biblequiz/modules/quiz/` (mode entry points)
   - `apps/api/src/main/java/com/biblequiz/modules/multiplayer/` 
   - `apps/api/src/main/java/com/biblequiz/modules/tournament/`
   - `apps/api/src/main/java/com/biblequiz/modules/ranked/`
   
2. **Frontend tier check ở đâu?** Grep:
   ```
   rg "requiredTier|isLocked|tier.*<|unlockedAtTier" apps/web/src/
   ```
   Liệt kê components hiện hide/disable mode theo tier.

3. **Có user nào hiện tại đang ở tier > 1 trong DB?** (test data hay real user?)
   - Nếu có user ở tier cao → đổi logic tier benefit có ảnh hưởng họ không?
   - Sample: query `SELECT tier_level, COUNT(*) FROM users GROUP BY tier_level`

KHÔNG bắt đầu Step 1 cho đến khi có findings cho 3 câu trên.

---

## Step 1 — Backend: Bỏ tier-based access checks

### Mục tiêu
Mọi user (kể cả tier 1) đều có thể call API của mọi mode. Backend KHÔNG còn reject với 403 "Tier not unlocked".

### Implementation

1. **Identify endpoints cần unlock** theo SPEC_USER_v3 §3.2.3:
   - Ranked Mode (yêu cầu tier 2)
   - Multiplayer Speed Race (tier 2)
   - Battle Royale (tier 3)
   - Tournament (tier 4)
   - Team vs Team (tier 4)
   - Sudden Death (tier 5)
   - Mystery Mode (?)
   - Speed Round (?)

2. **Remove tier checks**:
   - Tìm và XÓA (không comment-out) các check như:
     ```java
     if (user.getTierLevel() < 2) {
       throw new ForbiddenException("Tier 2 required");
     }
     ```
   - Giữ lại nếu check có lý do KHÁC tier (vd: ranked yêu cầu energy > 0)

3. **EXCEPTION — KHÔNG bỏ checks này**:
   - Energy check cho Ranked (tier 1 vẫn có energy 100/day)
   - Daily question cap (100 câu/ngày)
   - Group membership check (Group Quiz Set vẫn cần là member)
   - Admin-only endpoints

### Acceptance criteria

- Tier 1 user có thể call thành công:
  - `POST /api/sessions` với mode=ranked
  - `POST /api/rooms` với mode=battle_royale, sudden_death, team_vs_team
  - `POST /api/tournaments`
  - `POST /api/quiz/mystery`
  - `GET /api/quiz/speed-round`
- Tests pass (update tests cũ đang assert 403 cho tier 1)
- Commit: `refactor(api): remove tier-based access gates for game modes`

### Cost: 1-2h

---

## Step 2 — Backend: Verify tier benefits vẫn work

Tier 1 user giờ chơi được mọi mode, nhưng PHẢI giữ tier benefits theo SPEC §3.2.1 và §3.2.2:

### Verify các benefits sau VẪN HOẠT ĐỘNG:

1. **§3.2.1 — Difficulty distribution** (per tier):
   - Tier 1: 70% Easy / 25% Medium / 5% Hard
   - Tier 6: 5% Easy / 35% Medium / 60% Hard

2. **§3.2.1 — Timer per question**:
   - Tier 1: 30s
   - Tier 6: 18s

3. **§3.2.2 — XP multiplier**:
   - Tier 1: ×1.0 base
   - Tier 6: ×2.0

4. **§3.2.2 — Energy regen**:
   - Tier 1: 20/giờ
   - Tier 6: 35/giờ

5. **§3.2.2 — Streak freeze**:
   - Tier 1-2: 1/tuần
   - Tier 3-4: 2/tuần
   - Tier 5-6: 3/tuần

### Action

- Run existing tests, đảm bảo các benefits trên vẫn pass
- Nếu thiếu test, thêm 1 integration test "tier 1 user gets correct multiplier and difficulty mix"

### Cost: 30 phút - 1h (chỉ verify, không refactor)

### Commit
- `test: verify tier benefits still apply after removing access gates`

---

## Step 3 — Frontend: Bỏ LockedModesTeaser, thay bằng TierPerksTeaser

### Component mới: `TierPerksTeaser.tsx`

**Wireframe**:
```
┌──────────────────────────────────────────────────────────────┐
│  ✨  LÊN HẠNG ĐỂ NHẬN                                         │
│                                                                │
│  Khi đạt Người Tìm Kiếm (1,000 XP), bạn sẽ nhận:              │
│                                                                │
│  ⚡  +10% XP cho mọi câu trả lời                               │
│  📅  Daily missions tăng từ 3 → 4                              │
│  ❄️  Streak freeze 1 → 2 lần/tuần                              │
│  🎨  Avatar frame xanh dương đặc biệt                          │
│                                                                │
│  ▓░░░░░░░░░░░░░░░░░  81 / 1,000 XP                            │
│                                                                │
│  Tìm hiểu hệ thống hạng →                                      │
└──────────────────────────────────────────────────────────────┘
```

### Logic per tier

Hiển thị perks của **tier kế tiếp** (không phải tier hiện tại):

| User tier | Hiện perks của |
|---|---|
| 1 (Tia Sáng) | Tier 2 (Bình Minh) |
| 2 (Bình Minh) | Tier 3 (Ngọn Đèn) |
| 3 (Ngọn Đèn) | Tier 4 (Ngọn Lửa) |
| 4 (Ngọn Lửa) | Tier 5 (Ngôi Sao) |
| 5 (Ngôi Sao) | Tier 6 (Vinh Quang) |
| 6 (Vinh Quang) | Hide HOẶC show "Prestige System" teaser |

### Perks data structure

Tạo file `apps/web/src/data/tierPerks.ts`:

```typescript
export interface TierPerk {
  icon: string;
  textKey: string;
  textParams?: Record<string, string | number>;
}

export const TIER_PERKS: Record<number, TierPerk[]> = {
  2: [
    { icon: '⚡', textKey: 'tierPerks.xpBoost', textParams: { percent: 10 } },
    { icon: '📅', textKey: 'tierPerks.dailyMissionsIncrease', textParams: { from: 3, to: 4 } },
    { icon: '🎨', textKey: 'tierPerks.avatarFrame', textParams: { color: 'xanh nhạt' } },
  ],
  3: [
    { icon: '⚡', textKey: 'tierPerks.xpBoost', textParams: { percent: 20 } },
    { icon: '❄️', textKey: 'tierPerks.streakFreeze', textParams: { from: 1, to: 2 } },
    { icon: '🔋', textKey: 'tierPerks.energyRegen', textParams: { perHour: 25 } },
    { icon: '🎨', textKey: 'tierPerks.avatarFrame', textParams: { color: 'xanh dương' } },
  ],
  4: [
    { icon: '⚡', textKey: 'tierPerks.xpBoost', textParams: { percent: 30 } },
    { icon: '🔋', textKey: 'tierPerks.energyRegen', textParams: { perHour: 28 } },
    { icon: '🎨', textKey: 'tierPerks.avatarFrame', textParams: { color: 'tím' } },
    { icon: '🏆', textKey: 'tierPerks.tournamentSeed' },
  ],
  5: [
    { icon: '⚡', textKey: 'tierPerks.xpBoost', textParams: { percent: 50 } },
    { icon: '❄️', textKey: 'tierPerks.streakFreeze', textParams: { from: 2, to: 3 } },
    { icon: '🔋', textKey: 'tierPerks.energyRegen', textParams: { perHour: 30 } },
    { icon: '👑', textKey: 'tierPerks.exclusiveTitle' },
  ],
  6: [
    { icon: '⚡', textKey: 'tierPerks.xpBoostMax' },
    { icon: '🔋', textKey: 'tierPerks.energyRegen', textParams: { perHour: 35 } },
    { icon: '🎨', textKey: 'tierPerks.goldFrame' },
    { icon: '🏆', textKey: 'tierPerks.gloryBadge' },
  ],
};
```

### Acceptance criteria

- Component `TierPerksTeaser.tsx` thay thế hoàn toàn `LockedModesTeaser.tsx`
- Render đúng perks của tier kế tiếp dựa trên `user.tierLevel`
- Tier 6 user: hide hoặc show Prestige teaser
- Click "Tìm hiểu hệ thống hạng →" navigate `/help#tiers`
- Test cases (5): render perks tier 2, render perks tier 5, hide ở tier 6, navigate, progress bar correct

### Cost: 2-3h

### Commit
- `feat(home): TierPerksTeaser replaces LockedModesTeaser`

---

## Step 4 — Frontend: Home layout 2 sections

### Layout mới

```
[Hero compact]
[Daily Verse]
[FeaturedDailyChallenge]
        ↓
[ĐỀ XUẤT CHO BẠN]                    ← MỚI (2 cards lớn)
  ⭐ Luyện Tập (highlighted, gold border)
  Nhóm Giáo Xứ
        ↓
[TẤT CẢ CHẾ ĐỘ]                       ← MỚI (5 cards nhỏ)
  Thi Đấu Xếp Hạng
  Mystery Mode
  Speed Round
  Phòng Chơi
  Giải Đấu
        ↓
[Daily Mission]
[Bible Journey]
[TierPerksTeaser]                     ← thay LockedModesTeaser
[Leaderboard]
[Activity Feed]
```

### Logic "Đề xuất bắt đầu" (hardcode cho launch)

```typescript
function getRecommendedModes(user, dailyChallengeCompleted) {
  if (!dailyChallengeCompleted) {
    return ['practice', 'group'];
  }
  return ['practice', 'mystery'];
}
```

### Implementation notes

- Modes trong "Đề xuất" hiển thị **kích thước lớn hơn** (highlighted, có gold border)
- Modes trong "Tất cả" hiển thị compact
- KHÔNG còn lock icon, KHÔNG còn "Cần đạt tier X"
- Click bất kỳ mode nào → navigate trực tiếp vào mode

### Multiplayer warning (vì defer matchmaking)

Trên cards Phòng Chơi, Battle Royale, Sudden Death, Tournament — thêm subtle hint:

```
🎮 Phòng Chơi
Tạo phòng bằng mã 6 chữ số. 2-20 người/phòng.
ⓘ Có thể gặp người chơi mạnh hơn — tạo phòng riêng với bạn bè
```

KHÔNG dùng warning đỏ/yellow scary, dùng info icon nhỏ màu xám.

### Acceptance criteria

- Home có 2 sections: "Đề xuất" (2 cards lớn) + "Tất cả" (5 cards nhỏ)
- KHÔNG còn `LockedModesTeaser` ở Home
- TierPerksTeaser nằm ở vị trí trước Leaderboard
- Multiplayer cards có info icon với hint matchmaking
- Test cases (4): render 2 sections, hide locked teaser, render perks teaser, all modes clickable

### Cost: 2-3h

### Commit
- `refactor(home): split game modes into Recommended + All sections`

---

## Step 5 — First-time Daily Challenge Modal

### Component: `FirstTimeDailyModal.tsx`

**Wireframe**:
```
┌──────────────────────────────────────────────────┐
│                                              [×] │
│                                                  │
│              🎉                                   │
│                                                  │
│       Chào mừng đến BibleQuiz!                   │
│                                                  │
│  Hãy bắt đầu hành trình của bạn với              │
│  Thử Thách Hôm Nay — chỉ 5 phút.                 │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  ▶  Bắt đầu Thử Thách Hôm Nay            │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│         [Để sau, tôi muốn khám phá]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Logic hiển thị

```typescript
const shouldShowModal = (
  user.createdAt &&
  Date.now() - new Date(user.createdAt).getTime() < 60 * 60 * 1000 && // < 1h ago
  !dailyChallengeCompletedToday &&
  !localStorage.getItem('firstTimeDailyModalDismissed')
);
```

### Behavior

- **Click "Bắt đầu Thử Thách Hôm Nay"**: navigate `/daily` + set localStorage flag
- **Click "Để sau"** hoặc **[×]**: close modal + set localStorage flag (không hiện lại)
- Auto-show 1 lần duy nhất sau khi user login lần đầu
- Modal có overlay backdrop, KHÔNG cho click outside để dismiss

### Acceptance criteria

- Modal chỉ show khi user mới (< 1 hour) chưa làm daily
- Modal KHÔNG show ở các lần mở app sau (localStorage flag)
- 2 CTA work đúng (Bắt đầu / Để sau)
- Test cases (3): show conditions correct, navigate on CTA, dismiss persists

### Cost: 1-2h

### Commit
- `feat(home): first-time Daily Challenge suggestion modal`

---

## Step 6 — i18n updates

### Strings mới

`apps/web/src/i18n/vi.json`:
```json
{
  "tierPerks": {
    "title": "LÊN HẠNG ĐỂ NHẬN",
    "subtitle": "Khi đạt {{tierName}} ({{xp}} XP), bạn sẽ nhận:",
    "xpBoost": "+{{percent}}% XP cho mọi câu trả lời",
    "xpBoostMax": "×2 XP cho mọi câu trả lời (vĩnh viễn)",
    "dailyMissionsIncrease": "Daily missions tăng từ {{from}} → {{to}}",
    "streakFreeze": "Streak freeze {{from}} → {{to}} lần/tuần",
    "energyRegen": "Energy regen {{perHour}}/giờ",
    "avatarFrame": "Avatar frame {{color}} đặc biệt",
    "goldFrame": "Avatar frame vàng độc quyền",
    "tournamentSeed": "Được seed cao hơn trong giải đấu",
    "exclusiveTitle": "Title độc quyền",
    "gloryBadge": "Badge Vinh Quang",
    "linkText": "Tìm hiểu hệ thống hạng →",
    "maxedOut": "Bạn đã đạt hạng cao nhất!",
    "prestigeAvailable": "Khám phá Prestige System →"
  },
  "home": {
    "recommendedSection": "ĐỀ XUẤT CHO BẠN",
    "allModesSection": "TẤT CẢ CHẾ ĐỘ",
    "multiplayerHint": "Có thể gặp người chơi mạnh hơn — tạo phòng riêng với bạn bè"
  },
  "firstTimeModal": {
    "title": "Chào mừng đến BibleQuiz!",
    "body": "Hãy bắt đầu hành trình của bạn với Thử Thách Hôm Nay — chỉ 5 phút.",
    "cta": "Bắt đầu Thử Thách Hôm Nay",
    "dismiss": "Để sau, tôi muốn khám phá"
  }
}
```

`apps/web/src/i18n/en.json`: tương ứng (translate sang English).

### Strings cần XÓA

`apps/web/src/i18n/vi.json` + `en.json` — xóa toàn bộ `home.lockedTeaser.*`.

### Acceptance criteria

- i18n validator pass: `cd apps/web && npm run validate:i18n`
- Tất cả keys mới có cả vi và en
- Không còn key cũ `home.lockedTeaser.*`

### Cost: 30 phút - 1h

### Commit
- `i18n: tier perks + recommended section + first-time modal strings`

---

## Step 7 — Full regression

### Checklist

- [ ] `npm run build` pass (0 errors)
- [ ] FE tests pass (>= baseline + ~15 mới)
- [ ] BE tests pass (>= 494)
- [ ] Manual smoke test:
  - Login fresh tier 1 account → thấy modal welcome
  - Click "Bắt đầu" → navigate /daily → làm xong → quay lại Home
  - Verify Home layout: 2 sections (Recommended + All), TierPerksTeaser hiện perks tier 2
  - Click vào Mystery Mode (tier 1) → vào được, không bị block
  - Click vào Tournament (tier 1) → vào được
  - Click vào Battle Royale → vào được, có info hint
- [ ] i18n validator pass
- [ ] No console errors
- [ ] LockedModesTeaser file đã xóa

### Commit
- `chore: regression after tier hard-lock removal`

---

## Workflow Order (BẮT BUỘC)

```
Step 0: Verify (grep + DB query)         — KHÔNG commit
Step 1: Backend remove tier checks       — 1 commit
Step 2: Backend verify benefits          — 1 commit (optional, may merge với Step 1)
Step 3: TierPerksTeaser component        — 1 commit
Step 4: Home layout 2 sections           — 1 commit
Step 5: First-time Daily modal           — 1 commit
Step 6: i18n updates                     — 1 commit
Step 7: Full regression                  — 1 commit
```

**KHÔNG skip steps. Mỗi commit revertable độc lập.**

---

## Files dự kiến đụng tới

### Backend
- **Sửa**: 
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java`
  - `apps/api/src/main/java/com/biblequiz/modules/multiplayer/service/RoomService.java` (hoặc tương đương)
  - `apps/api/src/main/java/com/biblequiz/modules/tournament/service/TournamentService.java`
  - `apps/api/src/main/java/com/biblequiz/api/RankedController.java`
- **Tests**: update tests đang assert 403 cho tier 1

### Frontend
- **Mới**:
  - `apps/web/src/components/TierPerksTeaser.tsx`
  - `apps/web/src/components/FirstTimeDailyModal.tsx`
  - `apps/web/src/data/tierPerks.ts`
  - Tests cho 2 components mới
- **Sửa**:
  - `apps/web/src/pages/Home.tsx` (replace section, split modes)
  - `apps/web/src/components/GameModeGrid.tsx` (thêm prop layout='recommended' | 'all')
  - `apps/web/src/i18n/vi.json` + `en.json`
  - `apps/web/src/pages/__tests__/Home.test.tsx`
- **Xóa**:
  - `apps/web/src/components/LockedModesTeaser.tsx`
  - Tests của LockedModesTeaser
  - i18n keys `home.lockedTeaser.*`

### Mobile
- **TÁCH PR** — không làm chung. Sau khi web done, sync mobile riêng.

---

## Definition of Done

✅ Tất cả 7 steps implemented  
✅ 6-7 commits riêng biệt, mỗi commit revertable  
✅ Web build pass (0 errors)  
✅ Tests pass (FE + BE baseline + new)  
✅ Manual smoke test: tier 1 user vào được mọi mode  
✅ TierPerksTeaser hiển thị perks tier kế tiếp đúng  
✅ First-time modal hiện đúng điều kiện, dismiss persist  
✅ i18n validator pass  
✅ KHÔNG còn `LockedModesTeaser` trong production code  
✅ KHÔNG còn 403 "Tier required" responses  
✅ Tier benefits (XP multiplier, difficulty, energy regen, freeze) VẪN HOẠT ĐỘNG  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên trước khi code:

1. **Step 0 findings**: Backend tier checks ở những file nào? Frontend ở những components nào?
2. **DB state**: Có user nào tier > 1 chưa? (chỉ test data hay đã có real user?)
3. **Edge case**: Nếu tier 1 user vào Tournament, hệ thống matchmaking xếp họ với tier 5 → trải nghiệm thua liên tục. Có cần thêm warning trên Tournament card hay chỉ Multiplayer card?

Sau khi tôi confirm 3 câu trên → bắt đầu Step 1.

---

## Reminder cuối

- Đây là **major design pivot** — không chỉ refactor code mà thay đổi philosophy của app.
- Nếu Step 1 phát hiện tier checks rải rác > 10 file → STOP và báo cáo trước khi xóa hết.
- SPEC §3.2.3 (Game mode unlocks) sẽ outdated sau PR này → flag TODO update spec sau.
- KHÔNG xóa logic tier hoàn toàn — chỉ bỏ tier check như **gate access**. Tier vẫn ảnh hưởng XP, difficulty, perks (theo §3.2.1 và §3.2.2).
- Update TODO mới sau khi launch:
  - "DB-MIGRATE: Update Book.nameVi sang Bản Truyền Thống Hiệu Đính 2011 (P2, v1.1)"
  - "MATCHMAKING: Implement tier-based matchmaking cho Multiplayer (P1, v1.1)"
  - "RECOMMENDATION: Replace hardcoded recommended modes với behavior-based engine (P2, v1.5)"
