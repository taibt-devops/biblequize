# Audit Report: Variety Modes vs Ranked Leaderboard

Date: 2026-05-01
Auditor: Claude Code (read-only)

## TL;DR

**Partial compliance.** Daily Challenge and (partially) Practice mode VIOLATE Option A by writing into `UserDailyProgress.pointsCounted` — the same field that backs the daily/weekly/monthly/all-time/season leaderboards. Mystery / Speed Round / Weekly Quiz / Daily Bonus / Seasonal Content currently appear "compliant by accident": their FE flow never persists answers, so no points reach the leaderboard table — but the architecture has no enforcement, just an unwired path. There is no separation between "ranked leaderboard points" and "tier XP" — both read from the same field.

## Findings

### Key architectural fact (read first — everything below depends on it)

There is **one** point ledger: `UserDailyProgress.pointsCounted` (`apps/api/src/main/java/com/biblequiz/modules/quiz/entity/UserDailyProgress.java`). The `User` entity has **no** `totalPoints / seasonPoints / dailyPoints / allTimeXp` columns (verified `User.java:1-363`). Both the **Ranked Leaderboard** and the **Tier XP progression** are derived from the *same* `pointsCounted` sum (`UserTierService.getTotalPoints()`, `UserDailyProgressRepository.findDailyLeaderboard()` etc.). Per Option A, variety modes should contribute to tier XP but NOT to the leaderboard — but the architecture has no way to make that split since they share the column.

The only modal exception is the season ledger (`SeasonRanking.totalPoints`), which is updated **only** from `RankedController` (verified — single call site).

---

### ✅ Compliant (đã đúng theo Option A)

- **Mystery Mode** — `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java:70-86`:
  - Endpoint `POST /api/quiz/mystery` returns `questions` + `xpMultiplier: 1.5` only. **Does NOT create a QuizSession.** **Does NOT write to UserDailyProgress.** **Does NOT call `seasonService.addPoints()`.**
  - FE (`apps/web/src/pages/MysteryMode.tsx:14-23`) navigates to `/quiz` with `state.mode='mystery_mode'` but **without `sessionId`**. In `Quiz.tsx:312-322`, the answer-submit branch falls through to the local `else` that *only compares the answer locally* — no API call hits `SessionService.submitAnswer`.
  - Net effect: Mystery Mode does **not** add any points to leaderboard, nor to tier XP. The advertised "1.5x XP" multiplier is **never applied anywhere on the server**.
  - Code snippet:
    ```java
    // VarietyQuizController.java:70-86
    @PostMapping("/mystery")
    public ResponseEntity<?> startMysteryQuiz(Authentication auth, ...) {
        List<Question> questions = smartQuestionSelector.selectQuestions(...);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questions", questions);
        response.put("xpMultiplier", 1.5);   // <-- value advertised to FE
        response.put("timerSeconds", 25);
        return ResponseEntity.ok(response);   // no session, no scoring path
    }
    ```

- **Speed Round** — `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java:90-107`:
  - Same shape: endpoint returns `xpMultiplier: 2.0` but does NOT create a session. FE (`SpeedRound.tsx:14-25`) navigates to `/quiz` without `sessionId`. No DB writes for points.

- **Weekly Themed Quiz** — `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java:50-61`:
  - Same shape: endpoint returns questions only. FE (`WeeklyQuiz.tsx:17-30`) navigates to `/quiz` with `state.mode='weekly_quiz'` but no `sessionId`. No points persisted.

- **Daily Bonus** — `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java:111-150`:
  - Returns `bonusType` (DOUBLE_XP / EXTRA_ENERGY / FREE_FREEZE / BONUS_STREAK) with `value: 2.0`. **No code anywhere applies the DOUBLE_XP multiplier to ranked points** — it is purely UI advertised. (Confirmed by grep: only hit on `DOUBLE_XP` is the literal in this controller.)

- **Seasonal Content** — `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java:154-183`:
  - Returns `xpMultiplier: 1.5` but again, no scoring path consumes it.

- **Practice (NEW intent — submit IS hooked up but is gated)** — `apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java:272-306` (`creditNonRankedProgress`):
  - Practice answers DO write to `UserDailyProgress.pointsCounted`, **but** XP is **capped at totalPoints >= 1,000** (line 277-281). Above that, only `questionsCounted` ticks (no points → no leaderboard contribution). For Tier-2+ users, Practice is correctly excluded from leaderboard.
  - **However, this is still a violation for Tier-1 users** (see Violations below).

- **Ranked → Season ranking** — `apps/api/src/main/java/com/biblequiz/api/RankedController.java:329-331`:
  - `seasonService.addPoints(user, earned, 1)` is called **only** inside `submitRankedAnswer` (verified single call site). Variety modes cannot reach this method. ✅

- **Tier-up notification** — `RankedController.java:343-355`:
  - Tier transitions are detected only inside the Ranked submit path. Variety modes can't fire these.

- **Ranked accuracy / week-highest combo** — `apps/api/src/main/java/com/biblequiz/modules/quiz/repository/AnswerRepository.java:42-98`:
  - All three queries (`countRankedAnswersByUserBetween`, `countCorrectRankedAnswersByUserBetween`, `findRankedAnswerCorrectnessSince`) explicitly filter `a.session.mode = ranked`. Practice / weekly_quiz / mystery_mode / speed_round are correctly excluded from accuracy stats. ✅

---

### ❌ Violations (vi phạm Option A — variety modes / non-ranked đang vào ranked leaderboard)

#### V1. Daily Challenge writes +50 XP into the leaderboard ledger

- **File:** `apps/api/src/main/java/com/biblequiz/modules/daily/service/DailyChallengeService.java:218-236`
- **Why it's a problem:** Per the spec, "Daily Challenge → separate leaderboard". But `creditCompletionXp()` adds 50 XP to `UserDailyProgress.pointsCounted` — the exact field the daily/weekly/monthly/all-time/season leaderboards sum. There is no separate "daily challenge leaderboard" — these +50 XP just appear in the main leaderboard alongside Ranked points.
- **Code snippet:**
  ```java
  // DailyChallengeService.java:218-236
  private void creditCompletionXp(User user) {
      LocalDate today = LocalDate.now(ZoneOffset.UTC);
      UserDailyProgress udp = userDailyProgressRepository
              .findByUserIdAndDate(user.getId(), today)
              .orElseGet(() -> { ... });
      int before = Optional.ofNullable(udp.getPointsCounted()).orElse(0);
      udp.setPointsCounted(before + DAILY_COMPLETION_XP);   // +50 XP into the SAME field leaderboard reads
      userDailyProgressRepository.save(udp);
      ...
  }
  ```
- **Confirming the leaderboard reads it:** `apps/api/src/main/java/com/biblequiz/api/LeaderboardController.java:70` calls `udpRepository.findDailyLeaderboard(d, ...)` which sums `points_counted` (`UserDailyProgressRepository.java:54-61`). Same query path for `/weekly`, `/monthly`, `/all-time`, `/season`.

#### V2. Practice mode (Tier-1 users) credits XP into the same leaderboard ledger

- **File:** `apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java:272-306`
- **Why it's a problem:** For users with totalPoints < 1,000 (Tier-1), `creditNonRankedProgress` adds Practice scoreDelta into `UserDailyProgress.pointsCounted`. This means:
  - A new user grinding Practice climbs the daily leaderboard. (Spec: "Practice → MUST NOT enter leaderboard".)
  - A new user reaches the same daily ranking as a Ranked player.
- **Code snippet:**
  ```java
  // SessionService.java:272-306 (paraphrased control flow)
  private void creditNonRankedProgress(User user, QuizSession.Mode mode, boolean isCorrect, int scoreDelta) {
      if (mode == QuizSession.Mode.ranked) return;       // ranked uses its own path
      boolean grantXp = true;
      if (mode == QuizSession.Mode.practice) {
          int totalPoints = userTierService.getTotalPoints(user.getId());
          if (totalPoints >= 1_000) grantXp = false;     // Tier-2+ Practice: no XP. ✅
          // Tier-1 Practice: XP is granted ❌ — leaderboard contaminated.
      }
      ...
      int addPoints = (isCorrect && grantXp) ? Math.max(0, scoreDelta) : 0;
      udp.setPointsCounted(beforePoints + addPoints);    // SAME field as leaderboard
      ...
  }
  ```
- Also: `creditNonRankedProgress` does **not** branch out `weekly_quiz / mystery_mode / speed_round`. If FE were ever to start passing a `sessionId` to `/api/sessions/{id}/answer` for those modes (i.e. the missing wiring described above), every variety mode would immediately start contaminating the leaderboard at the SessionService.submitAnswer entry point. The protection today is purely "FE doesn't call the endpoint." That is fragile.

#### V3. Tier XP and Ranked Leaderboard share one field — architectural

- **Files:**
  - `apps/api/src/main/java/com/biblequiz/modules/ranked/service/UserTierService.java:22-27` (sums `pointsCounted` for tier)
  - `apps/api/src/main/java/com/biblequiz/api/LeaderboardController.java:70,88,106,122,152` (sums `pointsCounted` for leaderboard)
- **Why it's a problem:** Option A says variety modes should still grant *tier XP* but NOT *leaderboard points*. With one field, you can't have both. Either they go to both (current Daily Challenge behavior) or neither (current Mystery/Speed/Weekly behavior). There is no path to honor Option A without a schema change.

---

### ⚠️ Ambiguous (không rõ — cần Bui quyết)

1. **Mystery / Speed Round / Weekly: are the advertised XP multipliers (1.5x / 2.0x / 1.5x) supposed to do anything?** Currently, they are returned to the FE but the FE has no scoring code path that uses them (no `sessionId` → no `submitAnswer` server call → answer is only validated locally). Either:
   - (a) the multipliers are intentional spec for a future feature, currently dark — fine, but should be documented; or
   - (b) the spec wants them applied to tier XP — that requires hooking up a scoring path, in which case Bui must also decide leaderboard vs tier XP separation (V3 above).

2. **Daily Bonus (DOUBLE_XP all-day):** the bonus `value: 2.0` is rolled by `VarietyQuizController.java:118-148` and returned, but no Java code consumes it. Was it ever wired? Should it apply to Ranked points? To Tier XP only? Currently dead code.

3. **`xpSurgeUntil` field on User (`User.java:65`):** there is also a "Milestone Burst" XP surge with a 1.5x multiplier inside `ScoringService.calculateWithTier()` (line 100). I could not find a controller call site that passes `xpSurgeActive=true`. Is this dark code, or is it called somewhere I missed? Worth checking before any refactor.

4. **`ComebackService.java:117-123`** advertises `2X_XP_DAY` rewards — same question as Daily Bonus. Wired?

5. **Practice Tier-1 leaderboard contamination — by design or bug?** The codebase has clear comments explaining why the Tier-2 cutoff exists ("Practice mode is the onboarding path"). It's possible the original product intent was "Practice contributes to leaderboard while you're learning, then stops once you've earned Ranked." If so, Option A spec contradicts existing product intent — surface to Bui.

---

## Architecture Issue

**One field, two consumers — and they want different behavior.**

`UserDailyProgress.pointsCounted` is read by:
1. `UserTierService.getTotalPoints()` → drives tier progression (per Option A: should include variety XP)
2. All `LeaderboardController` endpoints + `SeasonRanking` (via `RankedController.addPoints`) → ranked leaderboard (per Option A: should NOT include variety XP)

Without a schema change, you cannot honor Option A. Two viable shapes:

**Option A1 (additive — recommended for migration safety):** keep `pointsCounted` as "ranked leaderboard points" (write only from Ranked path). Add a new column `tierXp` (or compute it as `pointsCounted + variety_xp_separate_table`) that includes everything. Migrate all existing `pointsCounted` rows accordingly.

**Option A2 (separate ledgers):** keep `pointsCounted` as the all-source XP for tier. Build a *separate* `RankedLeaderboardEntry` table fed only by `RankedController`. Leaderboard endpoints query the new table. Backwards compat: backfill from existing ranked answers via `Answer.session.mode = ranked` (data is preserved).

A2 is cleaner long-term; A1 is faster to ship.

---

## Đề xuất Fix Plan

**P0 — Critical (vi phạm trực tiếp Option A):**

1. **Daily Challenge XP must NOT enter the leaderboard ledger.** Either move `creditCompletionXp` to a new "daily challenge ledger" table, or stop writing it into `pointsCounted` and find another channel for the advertised "+50 XP". (This is the only currently-live violation that contaminates the leaderboard for real users.)
2. **Practice (Tier-1 users) must NOT enter the leaderboard ledger.** Either:
   - Move Practice scoreDelta out of `pointsCounted` into a Practice-only ledger, or
   - Apply the same Tier-2 cap at zero (i.e. Practice never grants leaderboard points), or
   - Rebuild leaderboard query to filter by `Answer.session.mode = ranked`.

**P1 — Architecture (cần fix để long-term clean):**

3. **Split "ranked leaderboard points" from "tier XP".** Implement Option A1 or A2 above. Without this, V3 means the system *cannot* honor Option A.
4. **Harden `creditNonRankedProgress` against future FE wiring.** Today it relies on the FE not having a `sessionId` for variety modes. Add an explicit early-return whitelist (only `practice` ever credits) so when the variety modes DO get sessions, they don't silently start contaminating the leaderboard.
5. **Audit `xpSurgeUntil`, `ComebackService.2X_XP_DAY`, and Daily Bonus DOUBLE_XP.** Either wire them up properly to the new tier-XP ledger (P1.3 above), or delete the dead code.

**P2 — Polish:**

6. **Remove or document advertised `xpMultiplier` values** in `VarietyQuizController` — currently they are JSON noise the FE does nothing with.
7. **Add backend test:** "Mystery/Speed/Weekly Mode does not increase any leaderboard query result for the user." Lock the contract.
8. **Add test for Daily Challenge:** assert it does not appear in `findDailyLeaderboard()` after V1 fix lands.

---

## Files đã audit

- [x] `apps/api/src/main/java/com/biblequiz/modules/ranked/service/ScoringService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/ranked/service/UserTierService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/ranked/service/TierProgressService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/quiz/service/WeeklyThemeService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/quiz/entity/QuizSession.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/quiz/repository/UserDailyProgressRepository.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/quiz/repository/AnswerRepository.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/daily/service/DailyChallengeService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/season/service/SeasonService.java`
- [x] `apps/api/src/main/java/com/biblequiz/modules/user/entity/User.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/VarietyQuizController.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/SessionController.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/RankedController.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/DailyChallengeController.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/LeaderboardController.java`
- [x] `apps/api/src/main/java/com/biblequiz/api/ChallengeController.java`
- [x] `apps/web/src/pages/MysteryMode.tsx`
- [x] `apps/web/src/pages/SpeedRound.tsx`
- [x] `apps/web/src/pages/WeeklyQuiz.tsx`
- [x] `apps/web/src/pages/DailyChallenge.tsx`
- [x] `apps/web/src/pages/Quiz.tsx`
- [x] `apps/web/src/pages/Leaderboard.tsx`

---

## Baseline tests

`cd apps/api && ./mvnw test -Dtest="com.biblequiz.api.**,com.biblequiz.service.**"` → **Tests run: 717, Failures: 1, Errors: 6, Skipped: 0** (exit code 0 from mvnw wrapper, but maven reports BUILD FAILURE due to test failures).

Pre-existing failures (not introduced or investigated by this audit — read-only run):
- `QuestionReviewControllerTest.stats_shouldReturn200:175` — JSON path "$.pending" missing
- `SecurityTest.TC_AUTH_008_*` x2, `SecurityTest.TC_AUTH_009_*` x2, `SecurityTest.TC_SEC_008_*` — ApplicationContext failed to load (cascading from a single root cause)
- `LifelineServiceTest.useHint_unlimitedQuota_returnsMinusOneRemaining` — Mockito UnnecessaryStubbing

The audit made **zero source code changes**. These failures existed before the audit and are out of scope.

---

## Mode-by-Mode Summary Table

| Mode | Multiplier (advertised) | Multiplier actually applied? | Writes pointsCounted? | Writes SeasonRanking? | Tier XP? (= same field as leaderboard) | Leaderboard contamination | Status |
|---|---|---|---|---|---|---|---|
| Ranked | tier 1.0–2.0× + xpSurge 1.5× + combo 1.2/1.5× + dailyFirst ×2 | YES (`ScoringService.calculate`/`calculateWithTier` from `RankedController`) | YES (`RankedController:299`) | YES (`RankedController:330`) | YES (same field) | Expected per Option A | ✅ Compliant |
| Daily Challenge | n/a (fixed +50 XP completion) | YES (`DailyChallengeService.creditCompletionXp` writes +50) | YES (+50 XP) | NO | YES (same field) | YES — appears in daily/weekly/monthly/all-time/season LB | ❌ Violation V1 |
| Weekly Themed Quiz | none server-side | NO | NO (no session created) | NO | NO | NO (today, by accident) | ✅ Compliant (fragile) |
| Mystery Mode | `xpMultiplier: 1.5` returned to FE | NO (FE never round-trips to scoring) | NO | NO | NO | NO (today, by accident) | ✅ Compliant (fragile) |
| Speed Round | `xpMultiplier: 2.0` returned to FE | NO | NO | NO | NO | NO (today, by accident) | ✅ Compliant (fragile) |
| Daily Bonus (DOUBLE_XP) | `value: 2.0` returned to FE | NO (no consumer in Java) | NO | NO | NO | NO | ✅ Compliant (dead code) |
| Seasonal Content | `xpMultiplier: 1.5` returned to FE | NO | NO | NO | NO | NO | ✅ Compliant (dead code) |
| Practice (Tier 1) | none | scoreDelta from `SessionService.computeScore` | YES (line 297) | NO | YES (same field) | YES — Practice climbs leaderboard | ❌ Violation V2 |
| Practice (Tier 2+) | none | scoreDelta from `SessionService.computeScore` | NO (capped at 1,000) | NO | NO | NO | ✅ Compliant |
| `single` mode | none | scoreDelta | YES (no cap, falls to else) | NO | YES | YES (single answers contaminate) | ❌ Same as V2 |

---

## Câu hỏi mở của Bui — trả lời cuối báo cáo

1. **Variety modes hiện đang đóng góp vào ranked leaderboard ở mức nào?** (0% / một phần / toàn bộ)
   **Trả lời:** **Một phần — không phải các mode được liệt kê dưới tên "Variety", mà là các mode khác đang vi phạm.** Cụ thể:
   - Mystery / Speed Round / Weekly Themed Quiz / Daily Bonus / Seasonal: **0%** đóng góp vào leaderboard (vì FE chưa wire scoring path — accidental compliance).
   - Daily Challenge: **+50 XP/day mỗi user** thẳng vào `pointsCounted` → vào tất cả leaderboards (daily/weekly/monthly/all-time/season).
   - Practice mode cho user Tier-1 (totalPoints < 1,000): **toàn bộ scoreDelta** vào leaderboard.
   - Single mode: **toàn bộ scoreDelta** vào leaderboard (không có cap).

2. **Cần thay đổi bao nhiêu file để implement Option A?** (rough: <5 / 5-15 / >15)
   **Trả lời: 5–15 files.** Cụ thể tối thiểu:
   - `DailyChallengeService.java` (di chuyển +50 XP ra khỏi `pointsCounted`)
   - `SessionService.java` (cap Practice Tier-1 cũng phải bằng 0 cho leaderboard, hoặc tách ledger)
   - `LeaderboardController.java` + `UserDailyProgressRepository.java` (đổi query để filter theo `mode=ranked` hoặc đọc từ ledger riêng)
   - `RankedController.java` (giữ nguyên — đã đúng)
   - 1 Flyway migration (`V{N}__split_ranked_leaderboard_ledger.sql`)
   - Backfill script (data migration)
   - Tests: thêm 4–6 test cases mới
   - Nếu chọn Option A2 (table tách riêng): thêm Entity + Repository + Service mới (~3 files nữa)

3. **Có architecture issue gì không?** (vd User entity gộp totalPoints với allTimeXp → cần migration tách field)
   **Trả lời: CÓ — và đây là root cause của tất cả violations.** `UserDailyProgress.pointsCounted` là **một** field duy nhất phục vụ **hai** consumer khác nhau (Tier XP progression + Ranked Leaderboard). Option A yêu cầu chúng có ngữ nghĩa khác nhau (variety vào Tier XP nhưng không vào Leaderboard) — schema hiện tại không cho phép tách. Cần migration: hoặc tạo column `tier_xp` riêng (additive), hoặc tạo bảng `ranked_leaderboard_entry` riêng (separate ledger). Xem section "Architecture Issue" + "Đề xuất Fix Plan P1.3" ở trên.
