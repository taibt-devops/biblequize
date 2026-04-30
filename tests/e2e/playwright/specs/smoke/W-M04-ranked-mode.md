# W-M04 — Ranked Mode (L1 Smoke)

**Routes:** `/ranked`, `/quiz` (mode=ranked)
**Spec ref:** SPEC_USER §5.2, §4.4

---

### W-M04-L1-001 — Trang Ranked render đúng với energy display

**Priority**: P0
**Est. runtime**: ~3s
**Auth**: storageState=tier3
**Tags**: @smoke @ranked @critical

**Setup**:
- `POST /api/admin/test/users/{userId}/refill-energy` — đảm bảo energy đầy

**Preconditions**:
- User đã đăng nhập, energy > 0

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-page"]')`

**Assertions**:
- `expect(page).toHaveURL('/ranked')`
- `expect(page.getByTestId('ranked-page')).toBeVisible()`
- `expect(page.getByTestId('ranked-energy-display')).toBeVisible()`
- `expect(page.getByTestId('ranked-energy-display')).toHaveText(/\d+\/\d+/)` ← vd "75/100"
- `expect(page.getByTestId('ranked-start-btn')).toBeVisible()`
- `expect(page.getByTestId('ranked-start-btn')).toBeEnabled()`

**Cleanup**: none

**Notes**:
- [NEEDS TESTID: ranked-page] — wrapper trang Ranked
- [NEEDS TESTID: ranked-energy-display] — text "{livesRemaining}/{dailyLives}"
- [NEEDS TESTID: ranked-start-btn] — nút "Vào Thi Đấu" (gold gradient)

---

### W-M04-L1-002 — Today's Progress section hiển thị đúng

**Priority**: P1
**Est. runtime**: ~3s
**Auth**: storageState=tier3
**Tags**: @smoke @ranked

**Setup**: none

**Preconditions**:
- User đã đăng nhập

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-today-progress"]')`

**Assertions**:
- `expect(page.getByTestId('ranked-today-progress')).toBeVisible()`
- `expect(page.getByTestId('ranked-questions-counted')).toBeVisible()`
- `expect(page.getByTestId('ranked-points-today')).toBeVisible()`

**Cleanup**: none

**Notes**:
- [NEEDS TESTID: ranked-today-progress] — Card 1 progress bar (3px) under "Câu hôm nay"
- [NEEDS TESTID: ranked-questions-counted] — value of "{questionsCounted}/{cap}" in Card 1
- [NEEDS TESTID: ranked-points-today] — points today (large gold number) in Card 2
- Rank #N display removed in R3 redesign (2026-04-30) — rank-only in Season card; assertion belongs to W-M04-L1-005

---

### W-M04-L1-003 — Current book section hiển thị

**Priority**: P1
**Est. runtime**: ~3s
**Auth**: storageState=tier3
**Tags**: @smoke @ranked

**Setup**: none

**Preconditions**:
- User đã đăng nhập

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-current-book"]')`

**Assertions**:
- `expect(page.getByTestId('ranked-current-book')).toBeVisible()`
- `expect(page.getByTestId('ranked-current-book-name')).toBeVisible()`
- `expect(page.getByTestId('ranked-current-book-progress')).toBeVisible()`

**Cleanup**: none

**Notes**:
- [NEEDS TESTID: ranked-current-book] — section "Đang Chơi"
- [NEEDS TESTID: ranked-current-book-name] — tên sách đang chơi
- [NEEDS TESTID: ranked-current-book-progress] — "{currentIndex+1}/{totalBooks}"

---

### W-M04-L1-004 — Click "Vào Thi Đấu" → tạo session và vào quiz

**Priority**: P0
**Est. runtime**: ~6s
**Auth**: fresh login as test3@dev.local
**Tags**: @smoke @ranked @critical @write

**Setup**:
- `POST /api/admin/test/users/{userId}/refill-energy`
- `POST /api/admin/test/users/{userId}/reset-history` ← đảm bảo còn questions chưa hỏi hôm nay

**Preconditions**:
- Energy > 0
- questionsCounted < cap (100)

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-start-btn"]')`
3. `page.getByTestId('ranked-start-btn').click()`
4. `page.waitForURL('/quiz')`

**Assertions**:
- `expect(page).toHaveURL('/quiz')`
- `expect(page.getByTestId('quiz-question-text')).toBeVisible()`

**Cleanup**: none (session sẽ tự expire hoặc complete)

**Notes**:
- Gọi `POST /api/ranked/sessions` để tạo session
- mode='ranked' truyền vào Quiz component

---

### W-M04-L1-005 — Season card hiển thị với rank và points

**Priority**: P1
**Est. runtime**: ~3s
**Auth**: storageState=tier3
**Tags**: @smoke @ranked

**Setup**: none

**Preconditions**:
- User đã đăng nhập, seed data đã chạy (có season active)

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-season-card"]')`

**Assertions**:
- `expect(page.getByTestId('ranked-season-card')).toBeVisible()`
- `expect(page.getByTestId('ranked-season-rank')).toHaveText(/#\d+/)` ← "#N"
- `expect(page.getByTestId('ranked-season-points')).toBeVisible()`
- `expect(page.getByTestId('ranked-reset-timer')).toBeVisible()`

**Cleanup**: none

**Notes**:
- [NEEDS TESTID: ranked-season-card] — section "Mùa Giải"
- [NEEDS TESTID: ranked-season-rank] — "#N" rank
- [NEEDS TESTID: ranked-season-points] — total points
- [NEEDS TESTID: ranked-reset-timer] — countdown "Đặt lại: HH:MM:SS"

---

### W-M04-L1-006 — Trạng thái hết energy: button bị disable

**Priority**: P1
**Est. runtime**: ~4s
**Auth**: fresh login as test1@dev.local
**Tags**: @smoke @ranked

**Setup**:
- Set energy về 0: dùng `POST /api/admin/test/users/{userId}/full-reset` rồi manually drain energy
- Hoặc: có endpoint set energy về 0 trực tiếp (dùng mock-history với percentWrong=100 và nhiều câu)

**Preconditions**:
- User có livesRemaining = 0

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-page"]')`

**Assertions**:
- `expect(page.getByTestId('ranked-start-btn')).toBeDisabled()`
- `expect(page.getByTestId('ranked-start-btn')).toHaveText(/Hết Năng lượng/)`
- `expect(page.getByTestId('ranked-reset-timer')).toBeVisible()` ← hiện countdown refill

**Cleanup**:
- `POST /api/admin/test/users/{userId}/refill-energy`

**Notes**:
- Cần cách set energy = 0 từ test. Hiện `AdminTestController` có `refill-energy` nhưng không có endpoint set energy về 0 trực tiếp.
- Workaround: dùng `mock-history?percentSeen=0&percentWrong=100` với số câu lớn để drain 100 energy (20 câu sai × 5 energy)
- [XEM THÊM: nên thêm endpoint `POST /api/admin/test/users/{userId}/drain-energy` vào AdminTestController]

---

### W-M04-L1-007 — Energy countdown timer cập nhật theo thời gian thực

**Priority**: P2
**Est. runtime**: ~5s
**Auth**: storageState=tier3
**Tags**: @smoke @ranked

**Setup**: none

**Preconditions**:
- User đã đăng nhập

**Actions**:
1. `page.goto('/ranked')`
2. `page.waitForSelector('[data-testid="ranked-energy-timer"]')`
3. Lấy giá trị timer lần 1
4. `page.waitForTimeout(2000)` ← đợi 2 giây (exception cho countdown timer)
5. Lấy giá trị timer lần 2

**Assertions**:
- `expect(timerValue1).not.toEqual(timerValue2)` ← timer đang chạy
- Timer format match `/\d{2}:\d{2}:\d{2}/`

**Cleanup**: none

**Notes**:
- [NEEDS TESTID: ranked-energy-timer] — countdown "HH:MM:SS" trong Energy card
- Đây là trường hợp ngoại lệ dùng `waitForTimeout` vì cần verify timer chạy real-time

---

## NEEDS TESTID Summary

| Element | Suggested testid | File |
|---------|-----------------|------|
| Ranked page wrapper | `ranked-page` | Ranked.tsx |
| Energy display "{N}/{N}" | `ranked-energy-display` | Ranked.tsx |
| Energy countdown timer | `ranked-energy-timer` | Ranked.tsx |
| Start ranked button | `ranked-start-btn` | Ranked.tsx |
| Today progress bar (Card 1) | `ranked-today-progress` | Ranked.tsx |
| Questions counted | `ranked-questions-counted` | Ranked.tsx |
| Points today | `ranked-points-today` | Ranked.tsx |
| Current book section | `ranked-current-book` | Ranked.tsx |
| Current book name | `ranked-current-book-name` | Ranked.tsx |
| Current book progress | `ranked-current-book-progress` | Ranked.tsx |
| Season card | `ranked-season-card` | Ranked.tsx |
| Season rank | `ranked-season-rank` | Ranked.tsx |
| Season points | `ranked-season-points` | Ranked.tsx |
| Reset timer | `ranked-reset-timer` | Ranked.tsx |

---

## NOT IMPLEMENTED Summary

_Không phát hiện feature nào chưa implement._

## Ghi chú kỹ thuật

- **Thiếu endpoint drain-energy**: Cần thêm `POST /api/admin/test/users/{userId}/set-energy?value=0` vào `AdminTestController` để test case W-M04-L1-006 thực hiện được cleanly.
