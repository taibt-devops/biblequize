# Prompt: Path A + C — Pre-launch Polish

> Path C: Sidebar widgets (Streak + Daily Mission) trong AppLayout.tsx
> Path A: Backend gaps cho Ranked — `dailyAccuracy`, `dailyDelta`, `pointsToTop50/10`
> Tổng ước tính: 5-7 giờ, chia thành 7 commits riêng để dễ rollback.

---

## Execution order — quan trọng

**Làm Path C TRƯỚC, Path A SAU.**

Lý do:
- Path C: chỉ touch frontend, low risk, value visible ngay (cross-cutting impact 30+ pages)
- Path A: touch backend + frontend, dependency lớn hơn (cần BE schema thay đổi rồi FE mới consume được)
- Nếu Path A break gì → Path C đã safe, không cần rollback chéo
- Làm Path C trước cho tự tin để bước vào Path A

---

# PATH C — Sidebar Widgets

## Bối cảnh

`apps/web/src/components/AppLayout.tsx` là shared layout cho toàn bộ app (30+ pages). Sidebar trái hiện chỉ có:
- Logo
- User card (avatar + name)
- 4 nav items (Trang chủ, Xếp hạng, Nhóm, Cá nhân)

Sau đó là **khoảng trống ~60% chiều dọc** (verified trong screenshot Ranked).

Cần thêm 2 widget có giá trị engagement:
1. **Streak widget** — 🔥 N ngày, caption motivational
2. **Daily Mission widget** — X/3 hoàn thành + progress bar

Data source đã sẵn sàng:
- Streak: `user.currentStreak` từ authStore (R2 đã expose)
- Daily Missions: `GET /api/me/daily-missions` (đã có theo task TP-3)

⚠️ AppLayout.tsx là **sensitive file** — đổi 1 dòng có thể break 30+ pages. Mọi change cần Tầng 2 + Tầng 3 testing kỹ.

## Tasks (3 commits)

### Task C1: StreakWidget component

**File:** `apps/web/src/components/StreakWidget.tsx` (mới)

**Specs:**
```tsx
interface StreakWidgetProps {
  variant?: 'sidebar' | 'compact'  // sidebar = full version, compact = shorter
}

// Logic:
// - currentStreak từ useAuth().user.currentStreak (default 0 nếu user null)
// - Nếu streak = 0: caption "Bắt đầu streak hôm nay!"
// - Nếu streak > 0 và streak < 7: caption "Đừng dừng — chơi tiếp!"
// - Nếu streak >= 7: caption "Wow, {streak} ngày! 🎉"
```

**UI:**
- Container: `rgba(255,255,255,0.03)` background, `rgba(255,255,255,0.06)` border, border-radius 10px, padding 12px 14px
- Label: "🔥 STREAK" (10px uppercase, letter-spacing 1.2px, color muted)
- Number: 22px weight 800 color `#fb923c` (orange) + caption "ngày liên tục" (11px muted)
- Subtitle: 10px color `#fb923c` opacity 0.8

**Tests:** `apps/web/src/components/__tests__/StreakWidget.test.tsx`
- Render với streak = 0 → text "Bắt đầu streak hôm nay!"
- Render với streak = 5 → text "Đừng dừng — chơi tiếp!"
- Render với streak = 30 → text "Wow, 30 ngày! 🎉"
- Render khi user = null → fallback streak = 0, không crash

**Commit:** `feat: StreakWidget component (C1)`

---

### Task C2: DailyMissionWidget component

**File:** `apps/web/src/components/DailyMissionWidget.tsx` (mới)

**Specs:**
```tsx
// Data: useQuery GET /api/me/daily-missions
// Response shape (đã có theo TP-3):
//   { missions: [{ id, type, target, progress, completed }], totalCompleted, totalTarget }
// 
// Display: "{totalCompleted}/{totalTarget} hoàn thành"
// Progress bar: green #4ade80, width = (totalCompleted/totalTarget) * 100
// 
// Edge case: API loading → skeleton 2 dòng grey
// Edge case: API error → hide widget hoàn toàn (không hiển thị error trong sidebar)
// Edge case: totalTarget = 0 → hide widget
```

**UI:**
- Same container style với StreakWidget
- Label: "🎯 NHIỆM VỤ NGÀY"
- Number: 15px weight 700 color text-primary
- Progress bar: 4px height, background `rgba(255,255,255,0.08)`, fill `#4ade80`
- Click widget → navigate `/profile?tab=missions` (hoặc trang Daily Mission detail nếu có)

**Tests:** `apps/web/src/components/__tests__/DailyMissionWidget.test.tsx`
- Render với 2/3 missions → text "2/3 hoàn thành" + bar 67%
- Render với 0/3 → text "0/3 hoàn thành" + bar 0%
- Render với 3/3 → text "3/3 hoàn thành" + bar 100%
- Render khi loading → skeleton state
- Render khi error → return null (component không render)

**Commit:** `feat: DailyMissionWidget component (C2)`

---

### Task C3: Integrate vào AppLayout

**File:** `apps/web/src/components/AppLayout.tsx`

**Implementation:**

1. **Import** 2 widgets mới
2. **Vị trí:** sau nav items, trong sidebar (giữa nav và spacer/footer)

```tsx
// Sidebar structure sau update:
<aside className="sidebar">
  <Logo />
  <UserCard />
  <NavItems />          // Trang chủ, Xếp hạng, Nhóm, Cá nhân
  
  {/* NEW — chỉ render khi user logged in */}
  {user && (
    <div className="sidebar-widgets">
      <StreakWidget variant="sidebar" />
      <DailyMissionWidget />
    </div>
  )}
  
  <div className="sidebar-spacer" />  // flex-grow để đẩy footer xuống
  <SidebarFooter />
</aside>
```

3. **Responsive behavior:**
- Desktop (≥ md breakpoint): widgets visible
- Tablet (sm-md): widgets visible nhưng compact hơn (variant="compact" — chỉ 1 dòng)
- Mobile (< sm): widgets HIDE hoàn toàn (sidebar đã collapsed thành bottom tab bar)

```tsx
<div className="sidebar-widgets hidden md:flex md:flex-col gap-2 mt-4">
  ...
</div>
```

4. **Spacing:** giữ visual hierarchy
- Nav items: nhóm trên
- Widgets: nhóm dưới với `mt-auto` không đúng vì sẽ đẩy quá xa, dùng `mt-4` rồi `flex-grow` ở spacer
- Footer (settings/version): luôn ở bottom

**KHÔNG được làm:**
- ❌ Đổi cấu trúc nav items hiện tại
- ❌ Đổi user card layout
- ❌ Thêm/bớt nav links
- ❌ Touch logo/branding

**Tests:** `apps/web/src/components/__tests__/AppLayout.test.tsx` (UPDATE existing)
- Existing tests phải pass nguyên — KHÔNG thay đổi assertions cũ
- Thêm 4 cases mới:
  - Render khi logged in → widgets visible
  - Render khi logged out → widgets HIDE (không có user)
  - Mobile viewport (< 640px) → widgets HIDE
  - Desktop viewport → widgets visible
- Mock `useAuth` và `useQuery` cho daily missions

**Tầng 2 testing — CRITICAL:**
- Run `npx vitest run apps/web/src/pages/` — tất cả pages phải pass
- Đặc biệt verify: Home, Practice, Ranked, Daily, Multiplayer, Groups, Profile pages render bình thường
- Nếu bất kỳ page nào break → ROLLBACK ngay, debug

**Tầng 3 testing:**
- `npx vitest run` full FE
- `npx playwright test smoke` — toàn bộ smoke tests phải pass
- Đặc biệt smoke nào navigate qua nhiều pages (login flow) phải verify sidebar render đúng mọi page

**Commit:** `feat: integrate Streak + DailyMission widgets into AppLayout (C3)`

---

## Path C Deliverables

Khi xong:
- [ ] 3 commits riêng (C1, C2, C3)
- [ ] Screenshot 4 pages khác nhau cho thấy sidebar mới (Home, Ranked, Practice, Profile)
- [ ] Test count delta + total
- [ ] Confirm Playwright smoke không break

---

# PATH A — Backend gaps cho Ranked

## Bối cảnh

R3 và R5 hiện đang HIDE 3 thông tin vì backend chưa có:
1. `dailyAccuracy` — Card "Độ chính xác" hidden
2. `dailyDelta` — Delta line "↑ +N so với hôm qua" hidden
3. `pointsToTop50` + `pointsToTop10` — Milestone labels chỉ hiển thị thứ tự, không có "60đ"/"200đ"

Trong code FE đã có `// TODO: BE-EXTEND-RANKED-STATUS` markers. Path A fix cả 3 fields.

## Tasks (4 commits)

### Task A1: Backend — dailyAccuracy field

**Files:**
- `apps/api/src/main/java/com/biblequiz/modules/ranked/dto/RankedStatusResponse.java`
- `apps/api/src/main/java/com/biblequiz/modules/ranked/service/RankedService.java`
- `apps/api/src/main/java/com/biblequiz/modules/quiz/repository/SessionAnswerRepository.java` (hoặc tương tự)

**Implementation:**

1. **Add field to DTO:**
```java
public class RankedStatusResponse {
    // ... existing fields ...
    private Float dailyAccuracy;  // 0.0 to 1.0, null if no answers today
    private Integer dailyCorrectCount;
    private Integer dailyTotalAnswered;
}
```

2. **Repository query:**
```java
@Query("""
    SELECT 
        COUNT(CASE WHEN sa.isCorrect = true THEN 1 END) as correct,
        COUNT(sa) as total
    FROM SessionAnswer sa
    JOIN sa.session s
    WHERE s.userId = :userId
      AND s.mode = 'RANKED'
      AND sa.createdAt >= :todayStart
      AND sa.createdAt < :tomorrowStart
""")
DailyAccuracyResult getRankedAccuracyForUserToday(...)
```

3. **Service logic:**
```java
public RankedStatusResponse getRankedStatus(UUID userId) {
    // ... existing logic ...
    
    var accuracy = sessionAnswerRepo.getRankedAccuracyForUserToday(
        userId,
        LocalDate.now().atStartOfDay(),
        LocalDate.now().plusDays(1).atStartOfDay()
    );
    
    if (accuracy.total() == 0) {
        response.setDailyAccuracy(null);
    } else {
        response.setDailyAccuracy((float) accuracy.correct() / accuracy.total());
        response.setDailyCorrectCount((int) accuracy.correct());
        response.setDailyTotalAnswered((int) accuracy.total());
    }
    
    return response;
}
```

4. **Caching:** dùng `@Cacheable` với key `ranked-status:{userId}:{today}`, TTL 60s (data updates mỗi answer nên không cache lâu)

**Tests:** `RankedServiceTest.java`
- User answer 8/10 today → accuracy = 0.8
- User chưa answer hôm nay → accuracy = null
- User answer hôm qua nhưng chưa hôm nay → accuracy = null (filter by today only)
- Filter mode = RANKED only (practice answers không count)

**Commit:** `feat: add dailyAccuracy to RankedStatus response (A1)`

---

### Task A2: Backend — dailyDelta field

**Files:**
- `apps/api/src/main/java/com/biblequiz/modules/ranked/dto/RankedStatusResponse.java`
- `apps/api/src/main/java/com/biblequiz/modules/user/repository/UserDailyProgressRepository.java`

**Logic:**
```java
// Add field
private Integer dailyDelta;  // today_points - yesterday_points, null if either missing

// Service:
Integer todayPoints = dailyProgressRepo.findPointsByUserAndDate(userId, LocalDate.now());
Integer yesterdayPoints = dailyProgressRepo.findPointsByUserAndDate(userId, LocalDate.now().minusDays(1));

if (todayPoints == null || yesterdayPoints == null) {
    response.setDailyDelta(null);
} else {
    response.setDailyDelta(todayPoints - yesterdayPoints);
}
```

**UI rule trong frontend (cập nhật sau khi BE deploy):**
- delta > 0 → show "↑ +N so với hôm qua" (green)
- delta < 0 → show "↓ N so với hôm qua" (red/orange) — note: delta đã âm rồi
- delta = 0 → HIDE line (không show "↑ +0")
- delta = null → HIDE line

**Tests:**
- Today 50, yesterday 30 → delta = 20
- Today 30, yesterday 50 → delta = -20
- Today 0, yesterday 50 → delta = -50
- Today null (no progress) → delta = null
- Both null → delta = null

**Commit:** `feat: add dailyDelta to RankedStatus response (A2)`

---

### Task A3: Backend — pointsToTop50 + pointsToTop10

**Files:**
- `apps/api/src/main/java/com/biblequiz/modules/ranked/dto/RankedStatusResponse.java`
- `apps/api/src/main/java/com/biblequiz/modules/leaderboard/service/LeaderboardService.java` (hoặc tương tự)

**Logic — dùng Redis ZSET nếu đã có:**

```java
// Add fields
private Integer pointsToTop50;  // null if user already in top 50
private Integer pointsToTop10;  // null if user already in top 10

// Service:
public RankedStatusResponse getRankedStatus(UUID userId) {
    // ... existing logic ...
    
    Long userSeasonPoints = user.getSeasonPoints();
    Long userRank = leaderboardService.getRankForUser(userId);  // Redis ZRANK
    
    if (userRank > 50) {
        Long top50Threshold = leaderboardService.getScoreAtRank(50);  // Redis ZRANGE
        response.setPointsToTop50((int) (top50Threshold - userSeasonPoints + 1));
    } else {
        response.setPointsToTop50(null);  // already in top 50
    }
    
    if (userRank > 10) {
        Long top10Threshold = leaderboardService.getScoreAtRank(10);
        response.setPointsToTop10((int) (top10Threshold - userSeasonPoints + 1));
    } else {
        response.setPointsToTop10(null);
    }
    
    return response;
}
```

**Fallback nếu chưa có Redis ZSET:**
```java
// Direct DB query (slower but works)
Long top50Threshold = userRepo.findSeasonPointsAtRank(50);  // 50th highest seasonPoints
// ... same logic
```

**Edge cases:**
- Leaderboard có < 50 users → `getScoreAtRank(50)` return null → set field = null
- User là rank 1 → cả 2 fields = null (đã đỉnh)
- Tie scores → dùng `>=` thay vì `>` cho fairness

**Tests:**
- User rank 100 (40đ), top50 user có 100đ → pointsToTop50 = 61
- User rank 25 → pointsToTop50 = null, pointsToTop10 vẫn có
- User rank 5 → cả 2 = null
- Leaderboard có 30 users → pointsToTop50 = null (no rank 50 exists)

**Commit:** `feat: add pointsToTop50 + pointsToTop10 to RankedStatus response (A3)`

---

### Task A4: Frontend — consume new fields, unhide hidden UI

**Files:**
- `apps/web/src/pages/Ranked.tsx`
- `apps/web/src/pages/__tests__/Ranked.test.tsx`
- TypeScript types cho RankedStatus response

**Changes:**

1. **Update RankedStatus type:**
```typescript
interface RankedStatus {
  // ... existing fields ...
  dailyAccuracy: number | null;        // 0-1
  dailyCorrectCount: number | null;
  dailyTotalAnswered: number | null;
  dailyDelta: number | null;           // can be negative
  pointsToTop50: number | null;
  pointsToTop10: number | null;
}
```

2. **R3 — Unhide accuracy card (Card 3):**
```tsx
{rankedStatus.dailyAccuracy !== null && (
  <StatCard label="Độ chính xác" testid="ranked-accuracy">
    <span className="stat-value">
      {Math.round(rankedStatus.dailyAccuracy * 100)}<span className="sub-text">%</span>
    </span>
    <span className="stat-sub">
      {rankedStatus.dailyCorrectCount}/{rankedStatus.dailyTotalAnswered} câu đúng
    </span>
  </StatCard>
)}
```

3. **R3 — Unhide delta line:**
```tsx
{rankedStatus.dailyDelta !== null && rankedStatus.dailyDelta !== 0 && (
  <span className={`stat-sub ${rankedStatus.dailyDelta > 0 ? 'up' : 'down'}`}>
    {rankedStatus.dailyDelta > 0 ? '↑ +' : '↓ '}
    {Math.abs(rankedStatus.dailyDelta)} so với hôm qua
  </span>
)}
```

4. **R5 — Update milestone labels:**
```tsx
const formatMilestone = (rank: number, points: number | null) => {
  if (points === null) return `Top ${rank}`;
  return `Top ${rank} (${points}đ)`;
};

// Render:
<span>{formatMilestone(50, rankedStatus.pointsToTop50)}</span>
<span>{formatMilestone(10, rankedStatus.pointsToTop10)}</span>
```

5. **Remove all `// TODO: BE-EXTEND-RANKED-STATUS` comments** trong code

**Tests:**
- Render với accuracy = 0.75 → Card 3 visible, text "75%" + "9/12 câu đúng"
- Render với accuracy = null → Card 3 HIDDEN
- Render với delta = +12 → text "↑ +12 so với hôm qua" green
- Render với delta = -5 → text "↓ 5 so với hôm qua" 
- Render với delta = 0 → HIDDEN
- Render với pointsToTop50 = 60 → label "Top 50 (60đ)"
- Render với pointsToTop50 = null → label "Top 50" (no points suffix)

**Tầng 4 Playwright:**
- W-M04 smoke có thể cần update assertion vì có element mới (accuracy card, delta line)
- Verify L1-002 (Today section) vẫn pass
- Add optional new TC: L1-008 verify accuracy card render khi có data

**Commit:** `feat: Ranked frontend consumes new BE fields, unhide hidden UI (A4)`

---

## Path A Deliverables

Khi xong:
- [ ] 4 commits riêng (A1, A2, A3, A4)
- [ ] Backend tests pass (BE 494+ baseline + new tests)
- [ ] Frontend tests pass (FE 1017+ baseline + new tests)
- [ ] Playwright smoke W-M04: 7/7 vẫn pass
- [ ] Screenshot trang Ranked sau A4 — should see 3 cards (not 2), delta line, milestone với điểm
- [ ] Update TODO.md mark BE-EXTEND-RANKED-STATUS DONE

---

# Quy tắc chung cho Path A + C

## KHÔNG được làm
- ❌ Force commit nếu Tầng 2/3 fail
- ❌ Hardcode placeholder values khi backend chưa deploy (dùng null + conditional render)
- ❌ Skip Playwright smoke chỉ vì test manual đã ổn
- ❌ Touch unrelated files (drift)

## BẮT BUỘC làm
- ✅ Mỗi task = 1 commit riêng (rollback dễ)
- ✅ Sau mỗi commit Path C: Tầng 1 + Tầng 2 + Tầng 3 đầy đủ
- ✅ Sau mỗi commit Path A backend: BE tests trước FE tests
- ✅ Stop-and-confirm sau mỗi commit (đặc biệt C3 vì sensitive AppLayout)
- ✅ Document edge cases và fallbacks trong PR description

## Stop-points

Sau commit từng task, **STOP và post results** trước khi tiếp:
- C1 done → post results → confirm → C2
- C2 done → post results → confirm → C3
- C3 done → post results + screenshots 4 pages → confirm → start Path A
- A1 done → post BE test results → confirm → A2
- A2 done → post BE test results → confirm → A3
- A3 done → post BE test results → confirm → A4
- A4 done → post FE + Playwright + screenshot → confirm → mark TODO DONE

Không tự ý làm 1 lèo tất cả 7 tasks.

---

# Sau khi xong Path A + C

Update `TODO.md`:
- Section "Path C — Sidebar Widgets [DONE]" với 3 tasks
- Section "Path A — Ranked BE gaps [DONE]" với 4 tasks
- Mark BE-EXTEND-RANKED-STATUS resolved

Optional follow-up (defer post-launch):
- Streak widget click → modal hiển thị streak history (calendar heatmap)
- Daily mission widget click → modal showing 3 missions detail
- Pointto-top points refresh more frequent (websocket push thay vì poll)

Khi tất cả xong, BibleQuiz đã sẵn sàng cho soft-launch với 1-2 hội thánh.
