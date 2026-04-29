# Feature: Daily Challenge grants +50 XP per completion

## Context & motivation

Hiện tại XP (tier progression) chỉ tích qua Ranked mode — xem 
DECISIONS.md entry "XP source of truth: Ranked only (Practice không grant XP)".
User mới chỉ có 1 cách vào Ranked: early-unlock (≥80% / 10 câu Practice). 
Nếu accuracy consistently 70-79%, user mắc kẹt vĩnh viễn.

Option β (đã chọn): thêm 1 XP path phụ — hoàn thành Daily Challenge = +50 XP.
- Giữ Ranked là primary XP source (mỗi Ranked session ~50-500 XP, chơi liên tục)
- Daily XP rate thấp (tối đa 50 XP/ngày, 1,500 XP/tháng) → không thay thế Ranked
- 20 ngày Daily liên tiếp = 1,000 XP → Tier 2 unlock tự nhiên
- User casual có path retention rõ ràng: "vào app mỗi ngày, làm Daily"

## Scope

Backend:
- Phát hiện Daily Challenge session vừa hoàn thành (answer cuối submitted)
- Credit +50 XP vào user_daily_progress.points_counted
- Idempotent: không double-credit nếu user submit lại hoặc retry
- Chỉ credit khi user thực sự completion, không phải per-answer

Frontend:
- Sau khi hoàn thành Daily → invalidate ['me'] và ['me-tier-progress'] 
  (có thể đã có trong DailyChallenge.tsx, verify + sửa nếu thiếu)
- Toast hoặc banner ngắn "+50 XP!" khi completion screen render

i18n:
- Cập nhật help.items.howEarnXp (vi + en) thêm Daily XP path
- Cập nhật help.items.howUnlockRanked (vi + en) thêm path Daily

Tests:
- BE: SessionServiceTest hoặc DailyChallengeControllerTest — verify +50 XP 
  chỉ credit 1 lần per Daily completion, không credit mid-session
- FE: DailyChallenge.test.tsx — verify invalidation fires on completion

Docs:
- DECISIONS.md: thêm ADR mới "Daily Challenge as secondary XP path"

## Files cần đọc trước (Think Before Code)

1. apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java
   - Method submitAnswer (L167) — hiểu flow answer submission
   - Check mode detection: session.getMode() == QuizSession.Mode.daily
2. apps/api/src/main/java/com/biblequiz/modules/quiz/entity/QuizSession.java
   - Enum Mode, Status, field totalQuestions, correctAnswers
3. apps/api/src/main/java/com/biblequiz/api/RankedController.java
   - Xem cách Ranked credit XP (via sync-progress) — pattern tham khảo
4. apps/web/src/pages/DailyChallenge.tsx
   - Xem completion detection + current state handling
5. apps/web/src/pages/Quiz.tsx L180-190
   - Pattern invalidate ['me'] khi isQuizCompleted=true — replicate

## Implementation hints (không bắt buộc theo, nhưng là starting point)

Phát hiện Daily completion trong SessionService.submitAnswer:

```java
// Sau khi save answer + update session
if (session.getMode() == QuizSession.Mode.daily) {
    long answeredCount = answerRepository.countBySessionId(sessionId);
    if (answeredCount >= session.getTotalQuestions() 
            && session.getStatus() != QuizSession.Status.completed) {
        creditDailyCompletionXp(user);
        session.setStatus(QuizSession.Status.completed);
        quizSessionRepository.save(session);
    }
}
```

Idempotency guard chính: dùng `session.getStatus() != completed`. Một session 
chỉ transition sang completed đúng 1 lần → credit đúng 1 lần.

Credit helper:
```java
private void creditDailyCompletionXp(User user) {
    var today = LocalDate.now(ZoneOffset.UTC);
    UserDailyProgress udp = userDailyProgressRepository
        .findByUserIdAndDate(user.getId(), today)
        .orElseGet(() -> {
            var fresh = new UserDailyProgress(UUID.randomUUID().toString(), user, today);
            fresh.setLivesRemaining(100);
            fresh.setPointsCounted(0);
            fresh.setQuestionsCounted(0);
            return fresh;
        });
    udp.setPointsCounted(Optional.ofNullable(udp.getPointsCounted()).orElse(0) + 50);
    userDailyProgressRepository.save(udp);
    log.info("Daily completion XP: user={} +50 XP", user.getId());
}
```

## Edge cases BẮT BUỘC xử lý

1. **Idempotency**: user F5 giữa chừng hoặc submit answer đã existing 
   (line 185: `if (existing.isPresent()) return ...`). Phải đảm bảo 
   re-submit không double-credit.

2. **Daily đã làm hôm nay**: DailyChallengeController thường có guard 
   "1 Daily per day" — nhưng nếu user somehow tạo 2 Daily session cùng ngày, 
   chỉ Daily đầu credit XP (guard qua status=completed).

3. **Status value `completed`**: check QuizSession.Status enum đã có 
   value completed chưa. Nếu chưa có, thêm hoặc dùng `finished` / 
   value tương đương. KHÔNG thêm value mới trừ khi thật sự cần.

4. **Timezone**: today dùng ZoneOffset.UTC hay local? Match pattern hiện có 
   trong RankedController (đang dùng UTC).

5. **Concurrent submissions**: nếu 2 request submit cùng lúc câu cuối, 
   có thể double-credit. @Transactional + status check là đủ.

## Acceptance criteria

1. Hoàn thành Daily Challenge (5/5 câu, tỉ lệ đúng không matter) → 
   totalPoints tăng đúng +50 XP
2. Hoàn thành Daily lần 2 trong cùng ngày (nếu được phép) → KHÔNG 
   credit thêm (status=completed block)
3. Mid-session Daily (mới answer 3/5) → KHÔNG credit XP
4. Ranked completion không bị ảnh hưởng (vẫn credit qua sync-progress path)
5. Home page sau hoàn thành Daily → XP bar update (nhờ 
   invalidateQueries('me-tier-progress'))
6. FAQ VI + EN phản ánh đúng: Daily grants +50 XP, Ranked grants 10-30/câu, 
   Practice grants 0 XP
7. BE log sau Daily completion: "Daily completion XP: user=X +50 XP"
8. Tất cả test pass (SessionServiceTest + DailyChallenge.test.tsx + full 
   regression: `./mvnw test -Dtest="com.biblequiz.api.**,com.biblequiz.service.**"` 
   + `cd apps/web && npx vitest run`)

## Quy trình theo CLAUDE.md (BẮT BUỘC)

1. Đọc TODO.md → có task dở không, nếu có xử lý trước
2. Chia task nhỏ (<100 LOC mỗi task, 1 task = 1 commit):
   - Task 1: BE logic + idempotency
   - Task 2: BE tests
   - Task 3: FE invalidation + toast
   - Task 4: FE tests
   - Task 5: i18n FAQ update (vi + en)
   - Task 6: DECISIONS.md ADR
   - Task 7: Full regression
3. Ghi tất cả vào TODO.md TRƯỚC khi code
4. Mỗi task: code → Tầng 1 test → commit
5. Cuối cùng: Tầng 3 full regression → pass hết → mới merge/push

## DECISIONS.md entry cần thêm (mẫu)

```markdown
## 2026-04-19 — Daily Challenge as secondary XP path (+50 XP per completion)

- Quyết định: Daily Challenge hoàn thành = +50 XP vào 
  user_daily_progress.points_counted, bổ sung Ranked là primary XP source.
- Lý do: Giải quyết vấn đề user mới không đạt early-unlock (70-79% accuracy) 
  bị mắc kẹt. Daily +50 XP × 20 ngày = 1,000 XP → Tier 2 unlock tự nhiên 
  qua retention loop, không cần accuracy cao.
- Trade-off: Ranked không còn là source duy nhất. Nhưng Daily XP rate thấp 
  (max 50/ngày, 1,500/tháng) vs Ranked (100-500/session) → Ranked vẫn 
  là primary progression cho users đã unlock.
- Idempotency: session.status=completed là guard. Một Daily session chỉ 
  credit đúng 1 lần.
- Scope: Chỉ Daily Challenge (mode=daily). Practice, Weekly, Mystery, 
  Speed VẪN không grant XP.
- KHÔNG thay đổi khi refactor trừ khi metrics cho thấy rate sai.
```

## Output expected từ bạn (Claude Code)

Sau khi hoàn thành, gửi report ngắn (< 400 từ):
- Files đã thay đổi
- Test count before/after
- Có edge case nào phát hiện thêm không
- Đã commit theo pattern "feat: daily challenge +50 XP on completion" chưa

Nếu gặp blocker (vd: QuizSession.Status không có value completed), DỪNG và 
hỏi clarify thay vì tự quyết định thay đổi enum.