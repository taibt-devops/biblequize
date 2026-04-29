# Feature Prompt — Daily Challenge extends user streak

> **Status**: Deferred. Copy nội dung phần "PROMPT FOR CLAUDE CODE" bên dưới
> vào Claude Code khi sẵn sàng triển khai.
>
> **Priority**: High (low effort, high value). Fix mismatch giữa product
> promise và implementation — FAQ/tutorial đã mention "chơi Daily để giữ
> streak" nhưng code không wire up.
>
> **Complexity**: 🟢 Thấp. ~30-60 LOC. Ước tính 1-2 giờ.

## Background (cho người đọc)

Hiện tại:
- `StreakService.recordActivity(user)` đã có sẵn đầy đủ logic (increment,
  freeze, reset) tại `apps/api/src/main/java/com/biblequiz/modules/user/service/StreakService.java`.
- Docstring nói "Called when user completes a ranked answer" — nhưng logic
  chỉ dùng `user.getLastPlayedAt()` vs today, **không** bind với ranked mode.
- Daily Challenge completion (`DailyChallengeService.markCompleted`) CHỈ viết
  vào Redis cache, không gọi `recordActivity` → streak không tăng khi chơi Daily.

Gap này mâu thuẫn với:
1. Tutorial copy — `tutorial.streak: "Chơi mỗi ngày để giữ chuỗi liên tục!"`
2. FAQ copy — `dailyStreak.a: "Daily Challenge: 5 questions per day, once per
   day. Completing it increments your streak by 1."` (đã promise nhưng không làm)
3. Product intent — Daily là "retention hook" cốt lõi, streak là trụ chính
   của retention loop → 2 thứ phải nối với nhau.

## Mục tiêu

Khi user complete Daily Challenge → `StreakService.recordActivity(user)` được
gọi → streak tăng đúng theo rule hiện có (consecutive / freeze / reset).

Không thay đổi logic streak, chỉ **plumbing 1 call mới**.

## Acceptance tests (thủ công)

1. User mới (currentStreak=0, lastPlayedAt=null) → complete Daily hôm nay →
   `currentStreak = 1`, `lastPlayedAt` = now.
2. User đã chơi hôm qua (streak=5) → complete Daily hôm nay → streak=6.
3. User đã complete Daily hôm nay rồi → thử complete lần 2 → streak KHÔNG tăng
   tiếp (vì `lastPlayedDate.equals(today)` → early return trong recordActivity).
4. User bỏ 2 ngày (freeze chưa dùng) → complete Daily hôm nay → freeze auto
   consumed, streak=cũ+1, `streakFreezeUsedThisWeek=true`.
5. User bỏ 3 ngày → complete Daily hôm nay → streak reset về 1.
6. User chơi Ranked hôm qua (streak=3), hôm nay chỉ chơi Daily → streak=4.
7. User chơi cả Ranked và Daily trong cùng ngày → streak chỉ tăng 1 lần
   (whichever đến trước, hoặc idempotent qua `lastPlayedDate.equals(today)`).

---

# PROMPT FOR CLAUDE CODE

```
# Feature: Daily Challenge completion extends user streak

## Mục tiêu

Hiện tại StreakService.recordActivity(user) chỉ được gọi từ Ranked flow.
Daily Challenge completion cũng phải call nó để streak tăng khi user chơi
Daily hàng ngày. Logic streak đã đúng — chỉ thiếu 1 entry point.

## Files PHẢI đọc TRƯỚC khi code (Think Before Code)

1. apps/api/src/main/java/com/biblequiz/modules/user/service/StreakService.java
   — Nắm logic recordActivity(user): same-day → return, +1 day → increment,
   +2 day → freeze nếu available, >2 → reset.
2. apps/api/src/main/java/com/biblequiz/modules/daily/service/DailyChallengeService.java
   — Method markCompleted(userId, score, correctCount) — chỗ cần inject
   StreakService và gọi recordActivity.
3. apps/api/src/main/java/com/biblequiz/api/DailyChallengeController.java
   — Endpoint complete() gọi markCompleted; verify idempotency guard đã có
   (line 110: hasCompletedToday early-return).
4. apps/api/src/main/java/com/biblequiz/modules/user/entity/User.java
   — Field currentStreak, longestStreak, lastPlayedAt, streakFreezeUsedThisWeek.
5. apps/api/src/main/java/com/biblequiz/api/RankedController.java
   — Xem pattern Ranked gọi recordActivity như thế nào (reference).
6. apps/web/src/pages/DailyChallenge.tsx
   — Verify completion flow invalidate ['me'] cache để streak hiện lên Home.

## Implementation plan

### Task 1: BE — Inject StreakService vào DailyChallengeService

- Inject StreakService + UserRepository vào DailyChallengeService.
- Sửa markCompleted(String userId, int score, int correctCount):
  - Sau khi cache write, find User by userId:
    ```java
    userRepository.findById(userId).ifPresent(user -> {
        streakService.recordActivity(user);
    });
    ```
  - recordActivity() tự save user qua userRepository.save() ở cuối method
    đã có sẵn — không cần save thêm.

- Idempotency: markCompleted() đã có guard ở caller (DailyChallengeController.complete
  line 110 `if (hasCompletedToday) return`). Ngoài ra, recordActivity tự
  skip khi `lastPlayedDate.equals(today)` → double safety.

- Commit: "feat(daily): daily completion extends user streak via StreakService"

### Task 2: BE — Update StreakService javadoc

- Docstring method recordActivity(User) hiện ghi "Called when user completes
  a ranked answer" — sửa thành "Called when user completes a ranked answer
  or a Daily Challenge" để reflect actual usage.

- Commit: "docs(streak): clarify recordActivity is called from Daily + Ranked"

### Task 3: BE — Tests

- Mới: apps/api/src/test/java/com/biblequiz/service/DailyChallengeStreakTest.java
  (hoặc thêm vào DailyChallengeServiceTest nếu file đã tồn tại).

- 5 test cases (mock StreakService, verify interactions):

  1. `markCompleted_newUser_callsRecordActivity`
     — User mới, verify streakService.recordActivity được gọi đúng 1 lần.

  2. `markCompleted_existingUserYesterday_incrementsStreak`
     — User có lastPlayedAt = hôm qua, streak=3. Sau markCompleted,
     recordActivity chạy → verify user.currentStreak == 4.
     (Cần wire thật hoặc mock recordActivity để set field.)

  3. `markCompleted_sameDayIdempotent_doesNotIncrementTwice`
     — User đã chơi hôm nay. Gọi markCompleted → recordActivity sớm return
     vì same-day guard → streak không đổi.

  4. `markCompleted_userNotFound_doesNotThrow`
     — Nếu userRepository.findById trả empty, markCompleted không crash,
     chỉ skip streak update.

  5. `markCompleted_cacheWriteStillHappensEvenIfStreakFails`
     — Graceful degradation: nếu recordActivity throws (runtime exception),
     Redis write vẫn hoàn thành. Wrap streakService call trong try/catch.

- Chạy: `./mvnw test -Dtest="DailyChallengeStreakTest" -pl apps/api`

- Commit: "test(daily): streak integration tests"

### Task 4: FE — Ensure Home refresh after Daily completion

- File: apps/web/src/pages/DailyChallenge.tsx
- Verify sau khi gọi /api/daily-challenge/complete success, queryClient
  invalidate ['me'] và ['me-tier-progress'] để Home page sync streak mới
  và status alreadyCompleted.
- Pattern: giống Quiz.tsx L187-190 đã làm.
- Nếu đã có, skip. Nếu chưa, thêm invalidation trong onSuccess của mutation.

- Tests: DailyChallenge.test.tsx — thêm 1 case verify invalidateQueries
  được call sau completion.

- Commit: "feat(web): invalidate me cache after daily completion"

### Task 5: i18n + docs

- i18n: không cần thêm key mới (FAQ + tutorial đã mention streak).
- DECISIONS.md: thêm ADR:

```markdown
## YYYY-MM-DD — Daily Challenge extends user streak

- Quyết định: DailyChallengeService.markCompleted() gọi
  StreakService.recordActivity(user) để streak tăng khi user hoàn thành
  Daily hàng ngày. Trước đây Daily chỉ write Redis cache, không tác động
  User.currentStreak → mâu thuẫn với FAQ/tutorial.
- Lý do: Daily là retention hook chính; streak là trụ của retention loop;
  2 cơ chế phải nối với nhau. StreakService logic đã đúng, chỉ thiếu entry
  point từ Daily.
- Scope: Cả Ranked và Daily đều extend streak. Practice, Weekly, Mystery,
  Speed KHÔNG (theo cùng rule: "chơi mỗi ngày ≥ 1 câu Daily HOẶC Ranked").
- Trade-off: user chỉ chơi Practice không giữ được streak → có thể bất ngờ.
  UI nên hint: "Chơi Daily Challenge 5 câu để giữ streak" (đã có trong
  tutorial copy).
- KHÔNG thay đổi khi refactor trừ khi đổi product scope.
```

- Commit: "docs: add ADR — daily completion extends streak"

### Task 6: Full regression

- BE: `./mvnw test -Dtest="com.biblequiz.api.**,com.biblequiz.service.**"`
- FE: `cd apps/web && npx vitest run`
- i18n: `cd apps/web && npm run validate:i18n` (verify 0 missing keys)
- Baseline trước: ghi số test hiện tại. Sau task: baseline + ~6 test mới.

## Edge cases BẮT BUỘC handle

1. **Guest user** — guest không có userId, không auth. complete() endpoint
   đã reject với 401, nên markCompleted không gọi cho guest. Không làm gì
   thêm.

2. **User chơi Ranked rồi Daily trong cùng ngày** — Ranked gọi
   recordActivity trước, set lastPlayedAt=today. Khi Daily gọi, recordActivity
   early return (same-day). Streak chỉ tăng 1 lần/ngày → đúng ý.

3. **User complete Daily 2 lần (edge case)** — DailyChallengeController
   guard ở dòng 110 đã handle. recordActivity trong markCompleted được gọi
   đúng 1 lần/ngày.

4. **Exception trong recordActivity** — wrap try/catch để không block
   Redis cache write. Log warning, user thấy success nhưng streak không
   update (acceptable degradation).

5. **User bị ban** — recordActivity không có check ban. Hiện tại User entity
   có isBanned. Product question: banned user có nên update streak không?
   TẠO TODO riêng nếu phát hiện gap, không tự quyết định — acceptable
   default là "update bình thường, stream không phải security feature".

6. **Timezone** — StreakService dùng ZoneOffset.UTC consistent với
   DailyChallengeService. OK.

## Acceptance criteria

1. Chơi Daily 2 ngày liên tiếp → streak từ 1 → 2 (verify qua /api/me response
   field `currentStreak`).
2. Cùng ngày chơi Daily 2 lần → streak không tăng thêm (idempotent).
3. Bỏ 2 ngày (freeze còn) → complete Daily → freeze tự consume, streak
   tiếp tục.
4. Bỏ 3 ngày → complete Daily → streak reset về 1.
5. User chơi Ranked xong chơi Daily cùng ngày → streak tăng 1 (không 2).
6. Home page hiển thị streak mới ngay sau complete Daily (FE invalidation OK).
7. 5 BE test + 1 FE test pass.
8. Full regression pass, test count >= baseline + 6.

## Quy trình theo CLAUDE.md

1. Đọc TODO.md — task dở không?
2. Ghi 6 tasks trên vào TODO.md.
3. Mỗi task: code → Tầng 1 test → commit.
4. Cuối: Tầng 3 regression → pass → DONE.

## Output expected từ Claude Code

Report ngắn (< 300 từ):
- Files thay đổi (2-3 BE files + 1 FE file).
- Test count before/after.
- Có edge case nào phát hiện thêm không ngoài 6 case trên?
- Commits (5-6 commits, pattern "feat(daily): ..." / "test(daily): ..." / "docs: ...")
- Verify qua manual test case #1 (new user → streak=1) có pass không?

Nếu phát hiện DailyChallengeServiceTest chưa tồn tại và cần tạo từ đầu,
OK tạo mới; nếu cần thay đổi StreakService logic (không chỉ docstring), DỪNG
và hỏi clarify — scope prompt này chỉ là "wire up", không refactor streak.
```

---

## Ghi chú thêm (cho bạn khi đọc lại)

- Đây là task **quick win** — scope rất hẹp, không động chạm gì ngoài 2
  service và 1 FE page.
- KHÔNG gộp với Option β (Daily +50 XP) — là prompt riêng, scope riêng, ADR
  riêng. Không let Claude Code tự quyết định gộp.
- Nếu sau fix này mà streak trong FE vẫn không update, nghĩa là FE cache
  không invalidate — check Quiz.tsx pattern đã có invalidation tương tự.
- Thời gian thực tế nên < 2 giờ làm việc. Nếu quá 4 giờ → có vấn đề ngầm,
  DỪNG và review.
