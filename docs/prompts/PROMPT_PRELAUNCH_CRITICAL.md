# Prompt: Pre-launch Critical Fixes (B1 + B2 + V1)

> 3 critical fixes trước soft-launch.
> Tổng ước tính: 1.5-2 giờ, 3 commits riêng để rollback dễ.

---

## Bối cảnh

Sau khi hoàn thành Ranked redesign + Path A + C, screenshot Home page được review và phát hiện 3 issues critical cần fix TRƯỚC launch:

- **B1:** Leaderboard sort tie-break không xác định — cùng 0 XP nhưng rank khác nhau, không có quy tắc rõ
- **B2:** Tier threshold off-by-one — user 1.000 XP vẫn ở Tier 1 nhưng UI nói "Còn 1.000 điểm để lên Tier 2"
- **V1:** 3 nút gold cùng size cùng color trong viewport (Daily + Practice + Ranked) → decision paralysis cho user mới

3 issues này phải fix vì:
- B1, B2 là **logic bugs**, không phải UI polish — user thấy → app trông unreliable
- V1 là **first impression bug** — user mới mở Home không biết bấm gì

Các issues khác (C1, C2, C3, V2-V5) defer post-launch để học từ user thật.

---

## Tasks (3 commits)

### Task PL-1: Fix tier threshold off-by-one (B2)

**Priority: P0 — block launch**

#### Verification trước fix

Đọc và confirm:

1. `apps/web/src/data/tiers.ts`:
   ```
   Tier 1 → 0-999 XP (per SPEC_USER 3.1)
   Tier 2 → 1000-4999 XP
   ```
   Check: thresholds dùng `>=` hay `>`?

2. `apps/api/src/main/java/com/biblequiz/modules/ranked/service/TierProgressService.java`:
   - Method tính tier từ totalPoints
   - Boundary check logic (`points >= threshold` vs `points > threshold`)

3. `apps/api/src/main/java/com/biblequiz/modules/ranked/service/RankedService.java` (hoặc nơi tính UP TIER event):
   - Logic detect tier-up event

#### Expected behavior

```
totalPoints = 999  → Tier 1 (Tân Tín Hữu)
totalPoints = 1000 → Tier 2 (Người Tìm Kiếm) ← BOUNDARY
totalPoints = 1001 → Tier 2
totalPoints = 4999 → Tier 2
totalPoints = 5000 → Tier 3 (Môn Đệ)
```

Quy tắc: `points >= threshold` thì lên tier mới. User đạt đúng threshold = qualified.

#### Implementation

1. **Backend** (`TierProgressService.java`):
   - Verify logic dùng `>=` không phải `>`
   - Nếu sai → fix
   - Add unit tests cho boundary cases:
     - `getTier(0)` → Tier 1
     - `getTier(999)` → Tier 1
     - `getTier(1000)` → Tier 2 ← critical
     - `getTier(4999)` → Tier 2
     - `getTier(5000)` → Tier 3
     - `getTier(99999)` → Tier 5
     - `getTier(100000)` → Tier 6

2. **Frontend** (`data/tiers.ts` + `components/TierProgressBar.tsx`):
   - Verify cùng logic dùng `>=`
   - Verify "pointsToNext" calculation:
     - User 999 XP → pointsToNext = 1 (đến Tier 2)
     - User 1000 XP → pointsToNext = 4000 (đến Tier 3, vì đã ở Tier 2)
   - Add tests cho boundaries

3. **Header copy** (`pages/Home.tsx` hoặc tương tự):
   - "Còn X điểm để đạt {nextTier}"
   - X = nextTierThreshold - currentPoints
   - Verify khi user đúng boundary (totalPoints = 1000 sau khi lên tier) → text đổi sang "Còn 4.000 điểm để đạt Môn Đệ" ngay lập tức

#### Tests

**Backend** (`TierProgressServiceTest.java`):
- 7 boundary cases như liệt kê trên
- Test tier-up event được trigger khi cross boundary
- Verify `>=` semantic, không phải `>`

**Frontend** (`tiers.test.ts` hoặc inline trong existing tests):
- Same 7 boundary cases
- pointsToNext computation tại boundary

#### Migration concern

Nếu existing user trong DB có totalPoints = 1000+ nhưng đang stuck ở Tier 1 do bug:
- Sau khi fix logic → tier sẽ recompute correct ngay khi user request
- KHÔNG cần data migration script (fix is forward-compatible)
- Nếu có concern: chạy SQL query verify count users affected, log số

#### Commit

`fix: tier threshold uses >= for boundary inclusion (B2)`

---

### Task PL-2: Fix leaderboard sort tie-break (B1)

**Priority: P0 — block launch**

#### Symptom

Screenshot show:
```
Rank 3: Test Tier 3 — 0 XP, 20 câu
Rank 4: TAI THANH    — 0 XP, 1 câu
```

Cùng 0 XP nhưng different rank. Tie-break có vẻ là "số câu đã làm" nhưng:
- Không document trong code
- Không hiển thị trong UI
- Có thể không phải intent (có thể là quirk của ORDER BY)

#### Verification trước fix

Đọc backend leaderboard query:

1. `apps/api/src/main/java/com/biblequiz/modules/leaderboard/service/LeaderboardService.java`
2. Query tương tự: `findTopUsersBy...` hoặc trong UserRepository
3. Identify `ORDER BY` clause hiện tại
4. Identify whether tie-break có defined hay là implicit (DB-dependent ordering)

#### Expected behavior — quyết định tie-break

Đề xuất tie-break order (ưu tiên fairness + transparency):

```
1. Primary: totalPoints DESC (hoặc seasonPoints tùy context)
2. Tie-break 1: totalQuestionsAnswered DESC
   (user đầu tư nhiều câu hơn ranked higher khi cùng điểm)
3. Tie-break 2: createdAt ASC
   (user join trước ranked higher khi cùng điểm + cùng câu)
```

Lý do:
- "Số câu" là proxy cho "active hơn" — fair signal
- "createdAt" ASC là last resort, deterministic, không tạo flutter

#### Implementation

1. **Backend** (`LeaderboardService.java` hoặc UserRepository):
   ```java
   @Query("""
       SELECT u FROM User u
       WHERE u.totalPoints >= 0
       ORDER BY u.totalPoints DESC,
                u.totalQuestionsAnswered DESC,
                u.createdAt ASC
       LIMIT :limit
   """)
   List<User> findTopUsersForLeaderboard(int limit);
   ```

2. **Verify field names** đúng theo entity:
   - Có thể là `totalQuestionsAnswered` hoặc `questionsAnswered` hoặc trong UserDailyProgress aggregate
   - Nếu User entity không có field này → cần aggregate từ QuizSession/Answer

3. **Same logic for daily/weekly leaderboards** — apply tie-break consistently

4. **UI transparency** (`Leaderboard.tsx` + `Home.tsx` mini leaderboard):
   - Khi 2 user same points → show câu count làm secondary signal
   - Currently: "0 XP / 0 câu" và "0 XP / 20 câu" — đã có rồi, just verify visible
   - Nếu chưa có → add subscript "({N} câu)" dưới XP

#### Tests

**Backend** (`LeaderboardServiceTest.java`):
```
Setup: 3 users
- A: 1000 XP, 50 câu, joined 2026-01-01
- B: 1000 XP, 30 câu, joined 2026-01-02
- C: 1000 XP, 30 câu, joined 2026-01-03

Expected order: A (most câu) > B (joined first) > C

Setup: 2 users with everything tied
- D: 500 XP, 20 câu, joined 2026-02-01 12:00:00
- E: 500 XP, 20 câu, joined 2026-02-01 12:00:01

Expected: D > E (deterministic by createdAt)
```

**Frontend** (`Leaderboard.test.tsx`):
- Verify rendering preserves backend order (KHÔNG re-sort frontend)
- Verify câu count visible khi tie

#### Commit

`fix: leaderboard tie-break by questions answered then createdAt (B1)`

---

### Task PL-3: Visual hierarchy 3 CTAs (V1)

**Priority: P1 — pre-launch nice fix**

#### Problem

Home page có 3 nút gold cùng size cùng color trong cùng viewport:
- BẮT ĐẦU HÔM NAY (Daily Challenge card)
- BẮT ĐẦU (Practice card)
- BẮT ĐẦU RANKED (Ranked card)

User mới không biết bấm cái nào → decision paralysis. Theo product instinct: Daily là **action of the day**, Ranked là **competitive flagship**, Practice là **always available learning**.

#### Visual hierarchy mới

| CTA | Variant | Lý do |
|-----|---------|-------|
| Daily Challenge | Gold filled (primary) | Action of the day, FOMO trigger |
| Ranked | Gold filled (primary) | Competitive flagship |
| Practice | Outline gold (secondary) | Always available, không khẩn cấp |

Daily và Ranked vẫn cùng primary nhưng OK vì:
- Daily ở section riêng (top of page)
- Ranked ở "Chế độ chơi" section
- Practice cùng section với Ranked → contrast giữa 2 cards rõ

#### Implementation

File: `apps/web/src/pages/Home.tsx` + có thể `apps/web/src/components/GoldButton.tsx`

1. **Verify GoldButton component** đã có variant prop:
   ```tsx
   <GoldButton variant="primary" />   // gold filled (current default)
   <GoldButton variant="outline" />   // border gold + transparent bg
   ```
   - Nếu chưa có outline variant → add
   - Outline style:
     - `border: 1px solid #e8a832`
     - `background: transparent`
     - `color: #e8a832`
     - Hover: `background: rgba(232,168,50,0.1)`

2. **Update Practice card CTA**:
   ```tsx
   // Trước:
   <GoldButton onClick={...}>BẮT ĐẦU</GoldButton>
   
   // Sau:
   <GoldButton variant="outline" onClick={...}>BẮT ĐẦU</GoldButton>
   ```

3. **Daily Challenge CTA** giữ nguyên (primary)

4. **Ranked CTA** giữ nguyên (primary)

#### Visual verification

Sau fix, screenshot Home page → confirm:
- Daily card: gold filled button
- Practice card: outline gold button (border + transparent bg + gold text)
- Ranked card: gold filled button
- 3 buttons có **visual contrast rõ**, không còn cùng style

User mới scan → mắt sẽ rest trên 2 gold filled (Daily + Ranked) → biết đó là main action.

#### Tests

**Frontend** (`Home.test.tsx` hoặc GoldButton tests):
- Render Practice card → verify outline class hoặc style
- Render Daily card → verify primary (filled) class
- Render Ranked card → verify primary class
- Click outline button → verify same onClick logic, không break navigation

#### Commit

`ux: practice CTA uses outline variant for visual hierarchy (V1)`

---

## Quy tắc chung

### KHÔNG được làm
- ❌ Touch các issues khác ngoài B1, B2, V1 (drift)
- ❌ Refactor không liên quan
- ❌ Skip tests cho boundary cases (đặc biệt PL-1)
- ❌ Force commit nếu test fail

### BẮT BUỘC làm
- ✅ 3 commits riêng (rollback dễ)
- ✅ Verification trước implementation cho mỗi task
- ✅ Boundary tests cho PL-1 (off-by-one rất dễ regress)
- ✅ Stop-and-confirm sau từng commit

### Stop-points

Sau commit từng task, **STOP và post results** trước khi tiếp:
- PL-1 done → post results + tier boundary test → confirm → PL-2
- PL-2 done → post results + leaderboard order test → confirm → PL-3
- PL-3 done → post results + screenshot Home → final regression

---

## Final regression sau PL-3

- Tầng 1 + 2 + 3 FE
- Tầng 3 BE
- Tầng 4 Playwright smoke (W-M02 home + W-M04 ranked đặc biệt)
- Screenshot Home để compare visual với screenshot trước fix

---

## Sau khi xong

Update `TODO.md`:
```
## 2026-04-30 — Pre-launch Critical Fixes [DONE]
- [x] PL-1 (B2): Tier threshold uses >= for boundary inclusion
- [x] PL-2 (B1): Leaderboard tie-break by questions then createdAt
- [x] PL-3 (V1): Practice CTA outline variant for visual hierarchy
```

Sau đó BibleQuiz **sẵn sàng cho soft-launch** với 1-2 hội thánh.

Defer post-launch (track riêng, fix khi có user feedback):
- B3, V2-V5: visual polish
- C1-C4: content & copy improvements
- All P3 items: nice-to-have

---

## Estimate breakdown

| Task | Backend | Frontend | Tests | Total |
|------|---------|----------|-------|-------|
| PL-1 | 30 phút | 20 phút | 20 phút | 70 phút |
| PL-2 | 30 phút | 10 phút | 20 phút | 60 phút |
| PL-3 | 0 | 15 phút | 10 phút | 25 phút |
| Final regression | — | — | 30 phút | 30 phút |
| **Total** | | | | **~3 giờ** |

Có thể nhanh hơn nếu verification phase confirm logic đã đúng và chỉ cần thêm tests + UI tweaks.
