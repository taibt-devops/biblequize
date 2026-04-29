# BibleQuiz — SPEC v4 (delta + new features since v3)

> **Status**: Active. Effective from 2026-04-19.
> **Builds on**: `SPEC_USER_v3.md` (2026-04-07) + `SPEC_ADMIN_v3.md` (2026-04-07).
> **Authority chain**: v3 base → v4 deltas (this doc) → DECISIONS.md ADRs → CLAUDE.md operational rules.
>
> **Đọc thế nào**: v4 KHÔNG thay thế v3. Nội dung trong v3 vẫn còn hiệu
> lực TRỪ KHI section dưới đây nói "supersedes" hoặc "replaces". Đọc v3
> cho baseline; đọc v4 cho những gì mới/thay đổi.

---

## Mục lục

0. [What changed from v3 — TL;DR](#0-tldr)
1. [Tier naming — canonical (no longer SUPERSEDED note)](#1-tier-naming)
2. [XP economy — Ranked-only source of truth](#2-xp-economy)
3. [Practice mode — no XP, tracks early-unlock counters](#3-practice-mode)
4. [Early Ranked Unlock — bypass 1,000 XP gate via accuracy](#4-early-ranked-unlock)
5. [Daily Challenge — current state + planned XP/streak](#5-daily-challenge)
6. [Streak system — implemented vs spec gaps](#6-streak-system)
7. [Help / FAQ page — 14 topics with deep-link](#7-help-faq-page)
8. [Admin: Early Unlock Metrics dashboard](#8-admin-metrics)
9. [Question seeding — JSON source, 2 types, VI+EN pair](#9-question-seeding)
10. [Lifelines — hint endpoint](#10-lifelines)
11. [API additions](#11-api-additions)
12. [Database migrations V28-V30](#12-migrations)
13. [Deferred features (with prompt file pointers)](#13-deferred)
14. [Implementation status matrix](#14-status-matrix)

---

## 0. What changed from v3 — TL;DR

| Area | v3 status | v4 status |
|---|---|---|
| Tier names | Light-themed primary, religious noted as alternate | **Religious primary** (Tân Tín Hữu → Sứ Đồ); v3's light-themed naming officially retired |
| XP source | Ambiguous (FAQ said "Practice earns XP") | **Ranked-only** — Practice không grant XP |
| Practice mode | "Earn XP toward tier" | "Onboarding path; tracks accuracy for Early Unlock" |
| Ranked unlock | Only via 1,000 XP (Tier 2) | **2 paths**: 1,000 XP **HOẶC** Early Unlock (≥80% / 10 Practice) |
| Help/FAQ | None | **14-topic accordion page** at `/help` |
| Admin Metrics | None for early-unlock | **`/admin/metrics/early-unlock`** dashboard with KPI + 30-day chart |
| Question seeding | Mixed SQL + JSON, 4 types, ad-hoc | **JSON source of truth, 2 types only** (MCQ single + multi), VI+EN paired |
| Lifelines | Concept | **`/api/sessions/{id}/lifeline/hint`** wired (eliminate 1 wrong option) |
| Audience | VN-focused | **Tin Lành toàn cầu** (Protestant worldwide, VN + EN) |
| Bible canon | Implicit | **Protestant 66 books only** (no Deuterocanonical) |

Migrations added: **V28** (lifeline), **V29** (early unlock columns), **V30** (early unlock timestamp).

---

## 1. Tier naming — canonical

> **Supersedes**: SPEC_USER_v3 §3.1 "Tier names (Light-based)" + §3 SUPERSEDED note.

| Tier | Tên VI | Tên EN | XP threshold | i18n key | Material icon |
|---|---|---|---|---|---|
| 1 | Tân Tín Hữu | New Believer | 0 | `tiers.newcomer` | `eco` |
| 2 | Người Tìm Kiếm | Seeker | 1,000 | `tiers.seeker` | `local_florist` |
| 3 | Môn Đồ | Disciple | 5,000 | `tiers.disciple` | `auto_stories` |
| 4 | Hiền Triết | Sage | 15,000 | `tiers.sage` | `psychology` |
| 5 | Tiên Tri | Prophet | 40,000 | `tiers.prophet` | `local_fire_department` |
| 6 | Sứ Đồ | Apostle | 100,000 | `tiers.apostle` | `workspace_premium` |

**Rationale**: religious naming mirror "hành trình đức tin" — meaningful cho audience Tin Lành (cả Tin Lành lẫn Công Giáo dù app stick Protestant canon). Light-themed naming là neutral hơn nhưng mất nuance. Xem DECISIONS.md "Keep OLD religious tier naming".

**Tier per-tier rewards** (unchanged from v3 §3.2.2):

| Tier | XP × | Energy regen/h | Streak Freeze/tuần |
|---|---|---|---|
| 1 | 1.0× | 20 | 1 |
| 2 | 1.1× | 22 | 1 |
| 3 | 1.2× | 25 | 2 |
| 4 | 1.3× | 28 | 2 |
| 5 | 1.5× | 30 | 3 |
| 6 | 2.0× | 35 | 3 |

**Tier difficulty distribution** (unchanged from v3 §3.2.1):

| Tier | Easy | Medium | Hard | Timer |
|---|---|---|---|---|
| 1 | 70% | 25% | 5% | 30s |
| 2 | 55% | 35% | 10% | 28s |
| 3 | 35% | 45% | 20% | 25s |
| 4 | 20% | 50% | 30% | 23s |
| 5 | 10% | 40% | 50% | 20s |
| 6 | 5% | 35% | 60% | 18s |

---

## 2. XP economy — Ranked-only source of truth

> **Supersedes**: bất kỳ phần nào trong v3 nói Practice/Daily/Weekly grants XP.

### Rule

XP **chỉ tích** từ Ranked mode. `totalPoints` = `SUM(user_daily_progress.points_counted)` qua tất cả ngày, và **chỉ `RankedController.syncProgress`** ghi vào field này (xem `RankedController.java:269`).

| Mode | Tích XP? | Ghi gì? |
|---|---|---|
| Ranked | ✅ Có (10-30/câu + bonuses) | `user_daily_progress.points_counted` |
| Practice | ❌ Không | `users.practice_correct_count`, `users.practice_total_count` (Early Unlock counters), `answers` table (history) |
| Daily Challenge | ❌ Không (hiện tại) | Redis cache 48h (idempotency) — planned: +50 XP, xem §13 deferred |
| Multiplayer Rooms | ❌ Không | `answers` table (history) |
| Weekly / Mystery / Speed | ❌ Không | `answers` table (history) |

### Rationale

1. Practice không tốn năng lượng + không có timer → nếu cho XP sẽ thành đường farm dễ hơn Ranked → Ranked mất ý nghĩa, leaderboard distort.
2. Ranked giữ vai trò "competitive progression" — XP đến từ performance trong điều kiện áp lực thực.
3. Practice vẫn có giá trị: onboarding (Early Unlock path), learning without stakes, tick history.

### Implementation guards

- `SessionService.submitAnswer` KHÔNG ghi UserDailyProgress cho non-ranked modes.
- Test `submitAnswer_practiceMode_doesNotWriteUserDailyProgress` là regression guard.
- Quiz.tsx invalidate `['me']` + `['me-tier-progress']` khi `isQuizCompleted=true` để FE refresh đúng tier sau Ranked session.

Xem DECISIONS.md "XP source of truth: Ranked only".

---

## 3. Practice mode — đặc tả mới

> **Supersedes**: v3 §5.1 phần "Practice earns XP".

### Behavior

- **Free, unlimited, no energy cost, no timer**
- Pick any book + difficulty + question count
- Mỗi answer correct → tick `users.practice_correct_count`
- Mỗi answer (correct hoặc wrong) → tick `users.practice_total_count`
- **KHÔNG grant XP** (xem §2)
- Records vào `answers` + `quiz_session_questions` (cho streak, smart selection, weakness analysis)
- Gợi ý hint vô hạn (lifeline đã implement v28)

### Data model

```sql
-- Added in V29__add_early_ranked_unlock.sql
users.practice_correct_count INT NOT NULL DEFAULT 0
users.practice_total_count   INT NOT NULL DEFAULT 0
```

### Stop conditions

`updateEarlyRankedUnlockProgress` (SessionService) short-circuits khi:
- mode != practice
- user.earlyRankedUnlock == true (đã unlock rồi)
- totalPoints >= 1,000 (đã ≥ Tier 2 qua XP path → counters không relevant nữa)

---

## 4. Early Ranked Unlock — bypass XP gate via accuracy

> **NEW** in v4. Xem DECISIONS.md "Early Ranked unlock via Practice accuracy".

### Spec

User Tier 1 có thể chơi Ranked **trước khi đủ 1,000 XP** nếu thỏa mãn:

```
practice_correct_count * 100 >= practice_total_count * 80
AND
practice_total_count >= 10
```

(≥80% accuracy qua ≥10 Practice answers, cumulative all-time, KHÔNG reset.)

Khi thỏa → set `users.early_ranked_unlock = true` + `users.early_ranked_unlocked_at = NOW()`. **Permanent flag** — không reset kể cả accuracy giảm sau này.

### Ranked gate logic

`SessionService.createSession(mode=ranked)` reject nếu:

```java
totalPoints < 1_000 && !earlyRankedUnlock
```

Cả 2 path (XP hoặc Early Unlock) đều mở Ranked.

### Frontend UX

**Locked Ranked card** (`GameModeGrid.tsx`) hiển thị **dual progress**:
- Path 1 — XP: gold progress bar, "Cần thêm X điểm để đạt Người Tìm Kiếm"
- Path 2 — Accuracy: green progress bar, "X/Y đúng (Z%) — cần N câu đúng nữa"

Helper formula trong `utils/earlyUnlock.ts`:
```typescript
minCorrectNeededForEarlyUnlock(c, t) = max(0, 10 - t, 4t - 5c)
```

### Celebration modal

Khi flag flip true lần đầu, `useEarlyUnlockCelebration` hook so sánh
`earlyRankedUnlockedAt` (BE) với localStorage marker `seenEarlyRankedUnlockAt:<email>` → fire `EarlyRankedUnlockModal` exactly once.

Modal nội dung: 🏆 + "Chúc mừng! Bạn đã mở khóa Thi Đấu Xếp Hạng sớm!" + 2 CTA "Vào Thi Đấu Ngay" / "Tiếp Tục Luyện Tập".

### Backend artifacts

- Policy class: `EarlyRankedUnlockPolicy.shouldUnlock(int correct, int total)` — public for testability, thresholds là constants.
- Counter update: `SessionService.updateEarlyRankedUnlockProgress(user, mode, isCorrect)` — chỉ chạy cho practice mode + Tier 1 user chưa unlock.
- DTO: `UserResponse` expose 4 fields: `earlyRankedUnlock`, `practiceCorrectCount`, `practiceTotalCount`, `earlyRankedUnlockedAt`.

---

## 5. Daily Challenge — current state + planned

### Hiện tại (implemented)

- 5 câu hỏi cố định/ngày, **giống nhau cho mọi user** (deterministic seed: `date.toEpochDay() * 31 + lang.hashCode()`)
- Per-language pool (vi/en separate)
- Guests đọc + chơi được (no auth required for GET)
- Auth completion → cache Redis 48h với score + correctCount
- **Idempotent**: chơi 2 lần/ngày → trả về cached result, không tăng score

### Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/daily-challenge` | Optional | Lấy 5 câu hôm nay + status `alreadyCompleted` |
| POST | `/api/daily-challenge/start` | Optional | Sinh `sessionId` cho tracking |
| POST | `/api/daily-challenge/complete` | Required | Mark hoàn thành (idempotent) |

### Gaps so với product intent

Hiện tại Daily là "fun puzzle hằng ngày" — **không** ảnh hưởng:
- ❌ XP / tier (chưa wire `+50 XP/completion`)
- ❌ Streak (`User.currentStreak` không tự tăng từ Daily — chỉ Ranked gọi `recordActivity`)
- ❌ Leaderboard riêng (không có)

### Planned (deferred — xem §13)

- **Daily extends streak** (prompt: `docs/prompts/daily-challenge-extends-streak.md`)
- **+50 XP per completion** (prompt khác chưa tạo, design = Option β)
- **Daily leaderboard** (chưa có prompt)

---

## 6. Streak system — wired vs spec-only

### Wired (đang chạy thật)

| Cơ chế | Implementation |
|---|---|
| `User.currentStreak` increment khi user chơi Ranked mỗi ngày | `StreakService.recordActivity()` gọi từ Ranked flow |
| Streak Freeze auto-consume khi miss 1 ngày | `recordActivity` L58-62, freeze count theo tier |
| `User.longestStreak` track kỷ lục | `recordActivity` L73-75 |
| Notification "Streak X ngày sắp gãy" | `NotificationScheduler` + `NotificationService.createStreakWarning` |
| Achievement `perfect_20` (session combo ≥ 20) | `AchievementService.checkAndAward` L79 |
| Streak count hiển thị trên Home hero | Home.tsx — ngày liên tiếp icon |

### Spec-only (chưa wired)

| Spec nói | Reality |
|---|---|
| 3+ days: +10% Ranked score; 7+ days: +15% | `StreakService.getStreakBonusPercent` exists nhưng KHÔNG được gọi từ ScoringService → bonus không apply |
| 7-day badge "Chuyên cần", 30-day "Trung tín", 100-day "Kiên nhẫn như Gióp" | Docstring nói có, nhưng `AchievementService.checkAndAward` không grant 3 badge này |
| 30-day badge unlock avatar frame | Cosmetics có tier-gated frames, không có streak-gated |
| 100-day unlock theme | Same — không wired |

### Streak triggers (mode coverage)

| Mode | Extends streak? |
|---|---|
| Ranked | ✅ Có |
| Daily Challenge | ❌ Chưa (planned — xem §13) |
| Practice / Weekly / Mystery / Speed / Multiplayer | ❌ Không (by design) |

---

## 7. Help / FAQ page — 14 topics

> **NEW** in v4. Route: `/help`

### Structure

- 5 categories: Getting Started, Tiers & XP, Game Modes, Gameplay, Account & Privacy
- 14 items với Q + A (VI + EN trong i18n keys `help.items.<id>.{q,a}`)
- Accordion UI: chỉ 1 item mở tại 1 thời điểm
- Filter pills: 5 categories + "All"
- Deep-link support: `/help#<itemId>` → tự expand + smooth scroll
- Footer: mailto contact link

### FAQ items

| Category | ID | Topic |
|---|---|---|
| Getting Started | `howToPlay` | Bắt đầu chơi như thế nào |
| Getting Started | `bibleTranslation` | Bản dịch Kinh Thánh app dùng (RVV11/ESV) |
| Getting Started | `changeLanguage` | Đổi ngôn ngữ câu hỏi |
| Tiers & XP | `tierSystem` | 6 tier, scale 5 thứ theo tier |
| Tiers & XP | `streakVsXp` | Streak vs XP — 2 currencies độc lập (mới thêm) |
| Tiers & XP | `howUnlockRanked` | 2 path mở khóa Ranked |
| Tiers & XP | `howEarnXp` | XP từ đâu (Ranked-only) |
| Modes | `practiceVsRanked` | So sánh 2 mode |
| Modes | `dailyStreak` | Daily + Streak (ghi rõ "planned" cho XP) |
| Modes | `groupsTournament` | Nhóm Giáo Xứ + Tournament |
| Gameplay | `energySystem` | Năng lượng |
| Gameplay | `lifelines` | Gợi ý 50/50 |
| Account | `dataPrivacy` | Quyền riêng tư |
| Account | `deleteAccount` | Xóa tài khoản |

### Files

- `apps/web/src/data/faqData.ts` — registry of items + categories
- `apps/web/src/pages/Help.tsx` — page component
- `apps/web/src/pages/__tests__/Help.test.tsx` — 9 test cases
- `apps/web/src/i18n/{vi,en}.json` — `help.*` namespace

### Entry points

- AppLayout user menu dropdown — "Trợ giúp"
- Locked Ranked card "Tìm hiểu thêm →" link → `/help#howUnlockRanked` (deep-link)

---

## 8. Admin: Early Unlock Metrics dashboard

> **NEW** in v4. Route: `/admin/metrics/early-unlock`

### Endpoint

`GET /api/admin/metrics/early-unlock` (ADMIN + CONTENT_MOD only)

### Response shape

```json
{
  "totalUnlockers": 42,
  "unlocksLast7Days": 12,
  "unlocksLast30Days": 30,
  "avgAccuracyPctAtUnlock": 87.6,
  "timeline": [
    {"date": "2026-03-20", "count": 0},
    ... 30 zero-filled days ...
    {"date": "2026-04-19", "count": 2}
  ]
}
```

### UI

4 KPI cards + 30-bar timeline chart:

| KPI | Source |
|---|---|
| Total unlockers | `users.early_ranked_unlock = true` count |
| Unlocks last 7 days | `early_ranked_unlocked_at >= NOW() - 7d` |
| Unlocks last 30 days | `early_ranked_unlocked_at >= NOW() - 30d` |
| Avg accuracy at unlock | `AVG(practice_correct_count * 100.0 / practice_total_count)` WHERE flag=true |

Empty state: "Chưa có ai đạt ngưỡng mở khóa sớm. Chờ dữ liệu tích lũy."

### Files

- `apps/api/src/main/java/com/biblequiz/api/AdminMetricsController.java`
- `apps/api/src/main/java/com/biblequiz/modules/user/repository/UserRepository.java` — 3 new queries
- `apps/web/src/pages/admin/EarlyUnlockMetrics.tsx`
- Sidebar entry trong `AdminLayout.tsx`: "Early Unlock" với icon `lock_open`

---

## 9. Question seeding — JSON source, 2 types, VI+EN pair

> **Supersedes**: legacy `R__*_questions.sql` Flyway repeatable seeds (vẫn còn, đang phase out).

### Source of truth

```
apps/api/src/main/resources/seed/questions/
  ├── {slug}_quiz.json      ← Tiếng Việt (RVV11)
  └── {slug}_quiz_en.json   ← English (ESV)
```

Seeder: `QuestionSeeder` (`@EventListener(ApplicationReadyEvent)`) auto-scan, deterministic UUID hash từ `(book, chapter, verseStart, verseEnd, language, content)` → idempotent restart.

### Allowed question types — CHỈ 2 LOẠI

| Type | Options | correctAnswer |
|---|---|---|
| `multiple_choice_single` | 4 strings | mảng 1 phần tử |
| `multiple_choice_multi` | 4 strings | mảng 2-3 phần tử |

**Phase out**: `true_false` + `fill_in_blank` không sinh thêm. Existing data với 2 types này vẫn run được nhưng new content chỉ dùng 2 types trên.

### Generation rule (per book)

Mỗi lần generate cho 1 book → **bắt buộc output cặp VI + EN** với 1:1 mapping:
- Cùng số câu, cùng thứ tự
- Cùng `book`, `chapter`, `verseStart`, `verseEnd`, `difficulty`, `type`, `correctAnswer`
- `options` EN giữ cùng thứ tự với VI (để index match)
- `content` / `options` / `explanation` / `tags` translate giữa 2 ngôn ngữ

### Recommended pool size (Option A — ambitious target)

| Tier | Số câu/book | Sách áp dụng |
|---|---|---|
| Minimum viable | 20 câu | Sách ngắn (Obadiah, Philemon, 2-3 John, Jude) |
| Balanced | 40-60 câu | Sách TB (Ruth, Jonah, Galatians, James) |
| Rich coverage | 100+ câu | Core book (Genesis, Matthew, John, Psalms, Romans) |

Reality hiện tại: avg 22.7 câu/sách (43 sách VI), max 75. Target Option A = 3.4× pool size.

### Pipeline reference

Spec đầy đủ: `PROMPT_GENERATE_QUESTIONS.md` (480 dòng) — covers schema, tag taxonomy, 66 books table, anti-patterns, self-check.

---

## 10. Lifelines — hint endpoint

> **NEW** in v4 (V28 migration). Spec full xem CLAUDE.md API table.

### Endpoint

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/sessions/{id}/lifeline/hint` | Eliminate 1 wrong option (per question) |
| GET | `/api/sessions/{id}/lifeline/status?questionId=X` | Quota còn lại + eliminated options |

### Behavior

- Quota: 3 hints/session ban đầu (configurable)
- Each hint: returns `eliminatedOptionIndex`, `hintsRemaining`, `method` (random / lowest-pick-rate adaptive)
- Idempotent per question — gọi lại cùng questionId trả về cùng eliminated index

### Frontend

- Hook: `useLifeline` (`apps/web/src/hooks/useLifeline.tsx`)
- Quiz UI: 50/50 button, hiện badge khi còn quota

### Deferred

- `askOpinion` lifeline (community vote) — defer vì cold-start concern (xem CLAUDE.md context)

---

## 11. API additions (v3 → v4)

### Practice / Early Unlock

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/sessions/{id}/lifeline/hint` | Yes | Eliminate 1 wrong option |
| GET | `/api/sessions/{id}/lifeline/status` | Yes | Hint quota status |

### Admin

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/admin/metrics/early-unlock` | ADMIN + CONTENT_MOD | Early unlock dashboard data |

### Updated DTO

`UserResponse` (`/api/me`) thêm 4 field:
- `earlyRankedUnlock: boolean`
- `practiceCorrectCount: number`
- `practiceTotalCount: number`
- `earlyRankedUnlockedAt: ISO datetime | null`

---

## 12. Database migrations V28-V30

| Migration | Mô tả | Columns |
|---|---|---|
| `V28__add_lifeline_system.sql` | Lifeline tracking | (chi tiết xem file) |
| `V29__add_early_ranked_unlock.sql` | Early unlock counters | `users.early_ranked_unlock BOOLEAN`, `practice_correct_count INT`, `practice_total_count INT` |
| `V30__add_early_ranked_unlocked_at.sql` | Timestamp first unlock | `users.early_ranked_unlocked_at DATETIME NULL` |

Tất cả forward-only, không destructive.

---

## 13. Deferred features (with prompt files)

Các feature đã có spec/prompt nhưng chưa execute:

| Feature | Priority | Effort | Prompt file |
|---|---|---|---|
| **Daily extends streak** | High (quick win, fix product promise gap) | 1-2h | `docs/prompts/daily-challenge-extends-streak.md` |
| **Daily +50 XP/completion** | Medium (giải quyết "user mắc kẹt" Tier 1) | 1 ngày | (chưa tạo prompt — Option β trong threading) |
| **Church Group WebSocket realtime** | Medium (engagement boost) | 2-3 ngày | `docs/prompts/church-group-websocket-realtime.md` |
| **Streak score bonus wire-up** | Low (feature complete spec, bonus chưa apply) | 2-4h | (chưa tạo prompt) |
| **Streak milestone badges** (7/30/100 days) | Low (matches FAQ promise) | 4-6h | (chưa tạo prompt) |
| **Daily leaderboard** | Low | 1-2 ngày | (chưa tạo prompt) |
| **askOpinion lifeline** | Low (cold-start concern) | 1-2 ngày | (deferred per CLAUDE.md) |

---

## 14. Implementation status matrix

### v4 features

| Feature | Spec | BE | FE | Test | Deployed | Notes |
|---|---|---|---|---|---|---|
| Tier naming canonicalization | ✅ | ✅ | ✅ | ✅ | ✅ | Religious naming primary |
| XP economy (Ranked-only) | ✅ | ✅ | ✅ | ✅ | ✅ | Reverted Practice XP credit |
| Practice mode (no XP, counters) | ✅ | ✅ | ✅ | ✅ | ✅ | V29 migration |
| Early Ranked Unlock | ✅ | ✅ | ✅ | ✅ | ✅ | V29 + V30, Policy + DTO + UI |
| Early Unlock celebration modal | ✅ | ✅ | ✅ | ✅ | ✅ | useEarlyUnlockCelebration hook |
| Help / FAQ page (14 topics) | ✅ | — | ✅ | ✅ | ✅ | Deep-link enabled |
| Admin Metrics dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | `/admin/metrics/early-unlock` |
| Question seeding (JSON, 2 types, pair) | ✅ | ✅ | — | ✅ | ✅ | 43 books seeded, 15 with EN pair |
| Lifelines (hint) | ✅ | ✅ | ✅ | ✅ | ✅ | V28 migration |
| Quiz cache invalidation | ✅ | — | ✅ | ✅ | ✅ | Quiz.tsx invalidate ['me'] on completion |

### Deferred

| Feature | Status |
|---|---|
| Daily extends streak | ⏳ Prompt ready (`docs/prompts/`) |
| Daily +50 XP | ⏳ Designed, no prompt yet |
| Church Group WebSocket | ⏳ Prompt ready (`docs/prompts/`) |
| Streak score bonus wired | ⏳ Code exists in StreakService, never called |
| Streak milestone badges | ⏳ Spec only |
| Daily leaderboard | ⏳ Spec only |

---

## Appendix A — Cross-reference

| Document | Purpose |
|---|---|
| `SPEC_USER_v3.md` | Baseline user spec (still authoritative for unchanged sections) |
| `SPEC_ADMIN_v3.md` | Baseline admin spec |
| `SPEC_v4.md` (this doc) | Delta + new features |
| `DECISIONS.md` | ADRs explaining "why" — read after spec for rationale |
| `CLAUDE.md` | Operational rules cho AI agents (BẮT BUỘC đọc trước khi code) |
| `TODO.md` | In-flight tasks |
| `PROMPT_GENERATE_QUESTIONS.md` | Spec for AI question generation |
| `docs/prompts/*.md` | Deferred feature prompts ready for Claude Code |

## Appendix B — Glossary v4 additions

| Term | Định nghĩa |
|---|---|
| **Early Ranked Unlock** | Permanent flag bypass Ranked gate khi đạt ≥80% / 10 Practice |
| **Early Unlock counters** | `practice_correct_count`, `practice_total_count` track accuracy cumulative |
| **XP source of truth** | Quy ước: chỉ Ranked ghi `points_counted`; modes khác để 0 |
| **VI+EN pair** | Quy ước: mỗi book sinh đồng thời 2 file `_quiz.json` + `_quiz_en.json`, 1:1 question mapping |
| **Question type allowlist** | Chỉ `multiple_choice_single` + `multiple_choice_multi` cho new content |
| **Tier scaling** | Mỗi tier change 5 dimension cùng lúc (XP×, energy/h, freeze/tuần, difficulty mix, timer) |
| **Canonical reference file** | `genesis_quiz.json` + `1peter_quiz*.json` — template chuẩn cho format |
