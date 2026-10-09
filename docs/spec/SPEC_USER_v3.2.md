# SPEC_USER v3.2 — User-Facing Spec

> **Last updated:** 2026-05-21
> **Replaces:** [SPEC_USER_v3.1.md](SPEC_USER_v3.1.md) (2026-05-09 → archived after v3.2 stable). Primary change: §7 redesigned from "Smart Question Selection" to "Question Selection System" with 3-layer architecture (Liturgical Coverage + Tier Difficulty + Smart History). See §7 changelog.
> **Scope:** Canonical truth for **shipped** user-facing features. Non-shipped / future features → [SPEC_ROADMAP.md](SPEC_ROADMAP.md). Code gaps vs canonical → [BACKLOG.md](BACKLOG.md).
> **Sibling specs:** [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md), [SPEC_ADMIN_v3.1.md](SPEC_ADMIN_v3.1.md), [SPEC_GROUP_v1.2.md](SPEC_GROUP_v1.2.md).

---

## Mục lục

1. Mục đích & Phạm vi
2. Đối tượng người dùng
3. Tier System (6 tiers)
4. Scoring & Energy System
5. Game Modes
6. Bible Journey Map (66 sách)
7. Question Selection System
8. Sound & Haptics
9. Lifeline System
10. Cosmetics — Frames + Themes
11. Prestige System
12. Comeback Bridge
13. Daily Mission
14. Streak System
15. Bookmarks
16. Notifications
17. Activity Feed + Daily Verse
18. Tutorial Overlay
19. Question Sets (user-created)
20. Achievements
21. Profile & Stats
22. Leaderboard
23. Tournaments
24. Mobile App
25. i18n (vi/en)
26. WebSocket Events
27. API Endpoints
28. Cross-references
29. Known Issues

---

## 1. Mục đích & Phạm vi

### 1.1 Mục đích
SPEC_USER v3.1 mô tả **các tính năng đã ship** đang phục vụ user thật. Mỗi rule có file path để verify trong code.

### 1.2 Phạm vi
- **Có** trong spec này: feature đã có code + DB migration + UI ship.
- **Không** trong spec này: roadmap (Friend, Premium, TV Host, Multi-leader, Seasonal UI, Offline đầy đủ, Sentry…) → xem [SPEC_ROADMAP.md](SPEC_ROADMAP.md).
- **Multiplayer** chỉ overview; chi tiết 5 mode + lifecycle R1–R5 → [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md).
- **Group** (Church Group) chỉ cross-link ngắn → [SPEC_GROUP_v1.2.md](SPEC_GROUP_v1.2.md).
- **Admin** → [SPEC_ADMIN_v3.1.md](SPEC_ADMIN_v3.1.md).

### 1.3 Constraint canonical (locked Bui 2026-05-09)
| # | Decision |
|---|---|
| C1 | Tier names religious: Tân Tín Hữu / Người Tìm Kiếm / Môn Đồ / Hiền Triết / Tiên Tri / Sứ Đồ |
| C2 | Mode names "Luyện Tập" / "Đấu Hạng" (Vietnamese-only). Layout Y trên Home |
| C3 | 4 mùa Liturgical (Phục Sinh / Ngũ Tuần / Cảm Tạ / Giáng Sinh) + ×1.5 score |
| C4 | Bible: BTTHĐ 2011, 66 books Protestant, 50/50 VN/EN |
| C5 | Answer colors: A=Coral / B=Sky / C=Gold / D=Sage |

---

## 2. Đối tượng người dùng

### 2.1 Personas
- **Tin Lành (Protestant) Việt Nam** là target chính (xem CLAUDE.md "Product context").
- **Bible canon 66 sách** (Protestant). KHÔNG bao gồm 7 Deuterocanonical Công Giáo.

### 2.2 User roles
| Role | Capability |
|---|---|
| `guest` | Onboarding try-quiz (3 câu); Daily Challenge xem-only |
| `user` | Mọi game mode đã unlock theo tier; tham gia 1 group; bookmark; cosmetics |
| `group_leader` | + tạo/manage Church Group; tạo Group Quiz Set + Scheduled Quiz; xem Group Analytics |
| `group_mod` | Approve members, announcement, tạo Quiz Set (xem SPEC_GROUP §4) |

> Premium / Friend → SPEC_ROADMAP.md.

**Trang chủ của khách (2026-10-09).** Khách vào `/` thấy **một màn**: cùng cảnh ngã ba như trang chủ của người chơi, trong AppLayout (header có nút Đăng nhập).
- Thẻ chào (góc trên trái; trên điện thoại nằm dưới ảnh): tiêu đề H1 duy nhất của trang, 2 câu giới thiệu, nút **Tiếp tục với Google** (web vào thẳng OAuth2; app điện thoại sang `/login` để đăng nhập native), link "Chơi thử, không cần đăng nhập" → `/daily`.
- Mở cho khách: biển Luyện Tập, thư bồ câu (thử thách hôm nay, 5 câu, không XP).
- Cần đăng nhập: biển Đấu Hạng, Phòng Chơi, Hành Trình (có ổ khóa, vẫn là link thật) và 3 đèn lồng nhiệm vụ (tắt). Bấm vào mở thẻ "Đăng nhập để …" với nút Google và link đăng nhập bằng email.
- Lối tắt: Giới thiệu → `/gioi-thieu`, Xếp hạng → `/leaderboard`; hàng link nhỏ: Câu đố Kinh Thánh, Trợ giúp, Bảo mật, Điều khoản, VI/EN.
- Sau mỗi lượt chơi khách (Luyện Tập, Thử thách ngày), màn kết quả mời đăng nhập; lời mời chỉ hứa thay đổi cho các lần chơi sau (lượt khách không được lưu).
- SEO: `/` vẫn prerender (`home.html`), giữ title/description cũ. Nội dung dài trước đây của landing chuyển sang `/gioi-thieu` (prerender, có trong sitemap). `/landing` chuyển về `/`.

---

## 3. Tier System (6 tiers)

### 3.1 Tier names + XP thresholds

> **Source of truth:** `apps/web/src/data/tiers.ts:37-98` + `apps/web/src/i18n/vi.json` keys `tiers.*`.

| Tier | nameKey | VN | EN | minPoints | maxPoints | Icon emoji | Material icon | Hex |
|---|---|---|---|---|---|---|---|---|
| 1 | `tiers.newBeliever` | Tân Tín Hữu | New Believer | 0 | 999 | 🌱 | spa | #919098 |
| 2 | `tiers.seeker` | Người Tìm Kiếm | Seeker | 1,000 | 4,999 | 🌿 | eco | #4ade80 |
| 3 | `tiers.disciple` | Môn Đồ | Disciple | 5,000 | 14,999 | 📜 | scrollable_header | #4a9eff |
| 4 | `tiers.sage` | Hiền Triết | Sage | 15,000 | 39,999 | 🪔 | lightbulb | #9b59b6 |
| 5 | `tiers.prophet` | Tiên Tri | Prophet | 40,000 | 99,999 | 🔥 | local_fire_department | #f8bd45 |
| 6 | `tiers.apostle` | Sứ Đồ | Apostle | 100,000 | ∞ | 👑 | workspace_premium | #ff6b6b |

**Rules:**
- Tier all-time chỉ tăng, không giảm.
- Đạt tier mới → `TierUpModal.tsx` full-screen + sound `tierUp` + push notification.
- Profile + Home hiện `TierProgressBar.tsx` ("X / Y điểm đến [tier next]").
- `getTierByPoints(points)` + `getTierInfo(points)` là API duy nhất (`tiers.ts:100-132`).

### 3.2 Difficulty distribution per tier

> **Source:** `apps/api/src/main/java/com/biblequiz/modules/ranked/service/TierDifficultyConfig.java:13-22`.

| Tier | Easy% | Medium% | Hard% |
|---|---|---|---|
| 1 | 70 | 25 | 5 |
| 2 | 55 | 35 | 10 |
| 3 | 35 | 45 | 20 |
| 4 | 20 | 50 | 30 |
| 5 | 10 | 40 | 50 |
| 6 | 5 | 35 | 60 |

Áp dụng cho Ranked + Practice (qua `SmartQuestionSelector.selectQuestions()` `:36-76` khi caller không chỉ định difficulty cụ thể).

> **Vòng sách quen thuộc (2026-10-08, thay Option C bên dưới):** Ranked không còn sách hành trình tuần tự. Mỗi trận rút câu từ cả Kinh Thánh theo vòng sách mở dần theo bậc (`RankedBookPool`): bậc 1–2 = 18 sách quen thuộc (Sáng Thế Ký, Xuất Ê-díp-tô Ký, Ru-tơ, 1 Sa-mu-ên, Ê-xơ-tê, Thi Thiên, Châm Ngôn, Đa-ni-ên, Giô-na, 4 sách Phúc Âm, Công Vụ, Rô-ma, Ê-phê-sô, Phi-líp, Gia-cơ); bậc 3–4 = thêm 22 sách hay nghe giảng; bậc 5–6 = cả 66 sách. Vòng hẹp không đủ câu thì nới sang vòng kế. Mỗi trận tối đa **3 câu/sách**. Tỷ lệ Dễ/Trung bình/Khó theo bảng trên vẫn áp trong vòng; cross-day exclude ~80 câu giữ nguyên. `currentBook` không còn tự chuyển; sách được **sưu tầm** theo thứ tự bất kỳ — một sách tính là đã sưu tầm khi trả lời đủ `rankedBookSampleTarget` (công thức 25% bên dưới), dùng cho huy hiệu Học Giả (10 sách).
>
> **RWP + Option C (2026-06-24, đã thay):** Ranked dùng **draw lai (hybrid)** mỗi trận: ~**70% câu từ sách hành trình hiện tại** (`currentBook`) + ~**30% câu ngẫu nhiên toàn 66 sách** (đa dạng/ôn). Cả hai history-aware (unseen first) + cross-day exclude ~80 câu gần nhất (`UserQuestionHistory.lastSeenAt`). **Sách hành trình tiến** khi đã trả lời đủ **~25% câu distinct** của sách đó — `target = clamp(round(bookTotal×0.25), 12, 40)`, không quá tổng câu (sách nhỏ xem hết) → sang sách kế canon. Tỷ lệ (không cố định) để **tôn trọng sách giàu** (Thi Thiên/Phúc Âm ~40 câu) hơn thư tín ngắn (~12), hợp tinh thần dưỡng linh "đi xuyên Kinh Thánh" (~1600 câu ≈ 2.5–3 tháng). Gỡ 2 gate cũ: ≥50/session (dead — mỗi trận = session riêng reset 0) + 100-unique (không bao giờ đạt). `RANKED_CURRENT_BOOK_RATIO=0.7`; `RANKED_BOOK_SAMPLE_RATIO=0.25` floor 12 cap 40.

**Timer:** 90s/câu flat cho Ranked (policy 2026-05-20 — user request "tối đa 90s"). Câu hỏi Bible có scripture reference dài + cần đọc kỹ → 30s quá ngắn. FE-controlled via `Ranked.tsx` truyền `timePerQuestion: 90` xuống Quiz.tsx. BE `TierDifficultyConfig.timerSeconds` còn lại (giá trị legacy 30→18) chỉ dùng cho `SessionService.startSession` (Practice smart selection path) — không ảnh hưởng Ranked.

### 3.3 Rewards per tier

> **Source:** `TierRewardsConfig.java:11-21`.

| Tier | XP × | Energy regen / hour | Streak freezes / week |
|---|---|---|---|
| 1 | 1.0 | 20 | 1 |
| 2 | 1.1 | 22 | 1 |
| 3 | 1.2 | 25 | 2 |
| 4 | 1.3 | 28 | 2 |
| 5 | 1.5 | 30 | 3 |
| 6 | 2.0 | 35 | 3 |

XP multiplier áp dụng qua `ScoringService.calculateWithTier()` `:102-113`.

### 3.4 Game mode unlocks per tier

> **Source:** `GameModeUnlockConfig.java:11-20`.

| Mode | Required tier | Tier name |
|---|---|---|
| `PRACTICE` | 1 | Tân Tín Hữu (mở sẵn) |
| `DAILY` | 1 | mở sẵn |
| `RANKED` | 2 | Người Tìm Kiếm |
| `SPEED_RACE` | 2 | Người Tìm Kiếm |
| `BATTLE_ROYALE` | 3 | Môn Đồ |
| `TOURNAMENT` | 4 | Hiền Triết |
| `TEAM_VS_TEAM` | 4 | Hiền Triết |
| `SUDDEN_DEATH` | 5 | Tiên Tri |

UI: Locked card + dòng "Đạt [tier name] để mở khóa".

### 3.5 Basic Quiz gate (catechism → unlock Ranked)

> **Source:** `BasicQuizService.java`, `BasicQuizController` (`/api/basic-quiz`), V31 migration `add_basic_quiz_unlock.sql`, `apps/web/src/pages/BasicQuiz.tsx`.

- User Tier 1 phải pass **8/10 câu giáo lý** (`Question.category = 'BASIC_CATECHISM'`) để unlock Ranked.
- Field: `User.basic_quiz_passed` (boolean).
- Flow:
  1. Tier 1 user mở Ranked → check `basic_quiz_passed`.
  2. Chưa pass → redirect `/basic-quiz`.
  3. Pass 8/10 → set `basic_quiz_passed=true` → unlock Ranked.
- Bypass-able qua **Early Ranked Unlock** (3.6).

### 3.6 Early Ranked Unlock (Practice fast-track)

> **Source:** V29 + V30 migrations, `EarlyRankedUnlockPolicy.java`, admin page `EarlyUnlockMetrics.tsx`.

- Tier 1 user trả lời ≥ **10 câu Practice** với accuracy ≥ **80%** → auto-set `User.early_ranked_unlock=true` + `early_ranked_unlocked_at=now()`.
- Counters: `User.practice_correct_count`, `User.practice_total_count`.
- Effect: bypass cả XP gate (1k điểm) lẫn Basic Quiz để vào Ranked sớm.
- Ghi vào DECISIONS.md để admin theo dõi qua `EarlyUnlockMetrics`.

---

## 4. Scoring & Energy System

### 4.1 Base points

> **Source:** `ScoringService.getBaseScore()` `:115-122`.

| Difficulty | Base điểm |
|---|---|
| `easy` | 8 |
| `medium` | 12 |
| `hard` | 18 |

### 4.2 Speed bonus (quadratic)

> **Source:** `ScoringService.calculate()` `:53-55`. Legacy const `TIME_LIMIT_MS = 30_000`; Ranked (`calculateRanked()`) dùng timer THẬT 90s (BL-26 A1, xem §4.5).

```
speedRatio = max(0, (TIME_LIMIT_MS - clientElapsedMs) / TIME_LIMIT_MS)
speedBonus = floor(basePoints × 0.5 × speedRatio²)
```

Ví dụ medium (12 điểm), trả lời trong 6s → ratio=0.8 → bonus = floor(12 × 0.5 × 0.64) = 3.

### 4.3 Combo (in-session streak) multiplier

> **Source:** `ScoringService.calculate()` `:60-66`.

| `currentStreak` | Multiplier |
|---|---|
| 0–4 | ×1.0 |
| 5–9 | ×1.2 |
| ≥ 10 | ×1.5 |

### 4.4 Daily-first bonus

> **Source:** `ScoringService.calculate()` `:69-71`.

- Câu đúng đầu tiên trong ngày (bất kỳ mode tracked) → ×2 sau khi áp combo.

### 4.5 Tier XP multiplier

> **Source:** `ScoringService.calculateWithTier()` `:102-113` × `TierRewardsConfig.getRewards().xpMultiplier()`.

Kết quả cuối — **2 path** (BL-26 LOCKED 2026-06-22, xem [DECISIONS.md](../../DECISIONS.md)):

- **Legacy `calculate()` / `calculateWithTier()`** (non-ranked, vẫn dùng): `final = round(base × combo × tier.xpMultiplier × (surge?1.5) × (season?1.5) × (dailyFirst?2))` — multiplicative, timer 30s.
- **Ranked `calculateRanked()`** (canonical cho Đấu Hạng):
  ```
  core        = base + floor(base × 0.75 × speedRatio²)  // weight 0.75 (2026-06-24); speedRatio theo timer THẬT 90s
  situational = min(2.0, 1 + combo + surge(+.5) + season(+.3) + comeback(+.2))
                combo = +.2 (streak≥5) / +.35 (≥10)
  earned      = round(core × situational × tier.xpMultiplier × (dailyFirst?2))
  ```
  Situational **cộng dồn rồi cap 2.0** (KHÔNG nhân chồng) → biên độ 1 câu ~×5 thay vì ×22. Comeback +0.2 sau 1 câu sai (gộp BL-13). Tier nhân riêng (1.0–2.0). Daily-first ×2 **đã wire cho Ranked** (trước đây dead).
- **Accuracy bonus cuối trận (LD1):** sau trận 10 câu, `POST /api/ranked/sessions/{id}/match-complete` cộng % tổng điểm trận theo accuracy **server-recompute** (chống khai khống): ≥90% → +15%, 75–89% → +8%, <75% → 0% (không phạt âm, idempotent).

### 4.6 Energy

> **Source:** `EnergyService` (modules/ranked); cap 100/ngày, refill mỗi 0:00 UTC.

| Hành vi | Energy |
|---|---|
| Trả lời đúng | 0 |
| Trả lời sai | −5 |
| Timeout = no-answer | −5 (sau auto-submit) |
| Hết energy | Practice/Daily vẫn chơi; Ranked KHÔNG vào leaderboard |

Auto-regen theo bảng 3.3.

### 4.7 Milestone Burst (XP surge)

> **Source:** V24 migration `add_xp_surge_to_users.sql`; `User.xp_surge_until`; UI `MilestoneBanner.tsx` + `StarPopup.tsx`.

**Canonical rule:** Khi user đạt **≥ 90% progress** đến tier kế (tính qua `getTierInfo().progressPct ≥ 90`), backend set `User.xp_surge_until = now() + 2h`. Trong 2h đó mọi điểm Ranked được nhân ×1.5.

**Consume status (BL-3, wired 2026-05-13):**
- `RankedController.submitRankedAnswer` calls `scoringService.calculateWithTier(..., tierLevel, xpSurgeActive)` per §4.6 canonical formula. While `User.xpSurgeUntil > now`, awarded Ranked points are multiplied ×1.5. ✓ DONE.
- `GET /api/me/tier-progress` returns honest `surgeActive` / `surgeUntil` / `surgeMultiplier` (Bui 2026-05-02 honesty contract relaxed). FE `MilestoneBanner.SurgeCountdown` shows the badge for real. ✓ DONE.

**Auto-trigger status (BL-3-trigger, PENDING):**
- Detecting 90% threshold cross in `TierProgressService` and writing `xpSurgeUntil = now + 2h` is NOT YET wired. Admin can set it manually via [SPEC_ADMIN §622](SPEC_ADMIN_v3.1.md) `xpSurgeHoursFromNow`, but no user-facing auto-trigger fires. Track via BACKLOG `BL-3-trigger`.

### 4.8 Wrong-answer explanation

- Mọi `Question` BẮT BUỘC có `explanation` + `scriptureRef` (BTTHĐ 2011 — xem §1.3 C4 và BACKLOG cho code mismatch BTT 1926).
- Sai → slide-down panel hiện đáp án đúng + verse + explanation + nút "🔖 Đánh dấu" (tạo Bookmark).
- Đúng → KHÔNG hiện explanation (giữ nhịp).

---

## 5. Game Modes

### 5.1 Luyện Tập (Practice)

> **Source:** `apps/web/src/pages/Practice.tsx`, `Quiz.tsx`; `SessionController` `POST /api/sessions`.

| Field | Value |
|---|---|
| i18n key VN | `modes.practice` = "Luyện Tập" (Q4 canonical) |
| i18n key EN | `modes.practice` = "Practice" |
| Auth | mixed (guest có thể chơi, không lưu tier) |
| Energy | KHÔNG tốn |
| Leaderboard | KHÔNG vào ranked |
| Smart Selection | ✅ áp dụng (xem §7) |
| Retry mode | `POST /api/sessions/practice/retry-last` chơi lại các câu sai phiên trước |

Cấu hình trong UI: chọn book / quiz set / difficulty / count / language / bật/tắt explanation.

**Luyện theo câu chuyện** (2026-10-09). Màn Luyện Tập có hai cách: **Theo sách** (như trên) và **Theo câu chuyện**.
- Danh sách: 120 câu chuyện cốt lõi (`content/easy-core/stories.md`), lấy qua `GET /api/public/stories?language=` (khách xem được). Mỗi chuyện có `id`, `title`, `ref`, `testament`, `questionCount`. Chuyện không có câu ở ngôn ngữ đang chọn trả `questionCount = 0`; màn hình ẩn nó khỏi danh sách nhưng vẫn dùng tên để hiện ở Phiên gần đây.
- Một phiên chơi **hết các câu của chuyện** (5–10 câu Dễ), xáo thứ tự mỗi lần. Không chọn số câu, độ khó, chương/câu. Vẫn chỉnh được thời gian mỗi câu và bật/tắt giải thích.
- Đã đăng nhập: `POST /api/sessions` với `story` (bỏ Smart Selection). Khách: `GET /api/questions?story=` rồi chấm ở máy như luyện tập khách.
- Chỉ có tiếng Việt. Câu hỏi trích nguyên văn bản Truyền Thống Hiệu Đính 2010 (RVV11).
- Dữ liệu: cột `questions.story` (V73), do `QuestionSeeder` nạp từ `seed/questions/easy_core_quiz.json`. Các câu này là câu Dễ bình thường nên cũng vào kho Đấu Hạng.

### 5.2 Đấu Hạng (Ranked)

> **Source:** `apps/web/src/pages/Ranked.tsx`; `RankedSessionService.java`; controller `/api/ranked`.

| Field | Value |
|---|---|
| i18n key VN | `modes.ranked` = "Đấu Hạng" (Q4 canonical) |
| Auth | required |
| Cap | 100 câu/ngày, 100 energy/ngày |
| Leaderboard | daily / weekly / monthly / all-time / season |
| Smart Selection + Tier difficulty | ✅ |
| Unlock | Tier 2 (hoặc Basic Quiz pass / Early Unlock — xem §3.5–3.6) |

Endpoints:
- `POST /api/ranked/session` — start.
- `POST /api/ranked/answer` — submit one answer.
- `POST /api/ranked/sync-progress` — client → server snapshot (resume từ device khác).
- `GET /api/ranked/status` — energy, today's count, current book.
- `GET /api/ranked/tier` — current tier info.

### 5.3 Daily Challenge

> **Source:** `DailyChallengeService.java`, `DailyChallengeController`, V38 `add_daily_completions.sql`, entity `DailyCompletion`.

| Field | Value |
|---|---|
| Số câu | 5 cố định / ngày |
| Determinism | Cùng seed theo UTC date → tất cả user thấy cùng câu |
| Guest | Được chơi (xem-only mode) |
| Smart Selection | ❌ (random fair) |
| Completion tracking | Bảng `daily_completions(user_id, date, score, correct_count, completed_at)` |
| **XP / điểm** | Theo số câu đúng: `0/20/40/60/100/150` (0→5 đúng). Bỏ ngưỡng — trả từ câu đúng đầu. `score` = `xpEarned` (1 con số hiển thị). |

**Scoring (DECISIONS.md 2026-06-16, supersedes flat +50):**

| Số đúng | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| XP | 0 | 20 | 40 | 60 | **100** | **150** |

- XP cộng vào `user_daily_progress.points_counted` (cùng ledger leaderboard/tier với Ranked). Tính **server-side từ `correctCount`** (`DailyChallengeService.dailyXp`); client `score` bị bỏ qua → không thể khai khống điểm. Verify từng đáp án thật → BACKLOG.
- Mốc Tier-2 (1,000 XP): ~7-10 ngày liên tục (cũ: 20). Daily vẫn cap 1 lần/ngày → không farm.

**Endpoints:**
- `GET /api/daily-challenge` — `{ date, questions[5], alreadyCompleted, globalStats }`.
- `POST /api/daily-challenge/complete` — body `{ score:0-10000, correctCount:0-5 }`. `score` client gửi bị bỏ qua (server recompute). Idempotent same-day.
- `GET /api/daily-challenge/result` — `{ score, xpEarned, correctCount, ... }` với `score == xpEarned`.

**Edge cases:**
- Re-call cùng ngày → `{ alreadyCompleted: true }` không overwrite.
- Unknown body field → HTTP 400 "Field 'xxx' is not allowed".
- Timezone: seed theo UTC; UI hiển thị countdown theo local time (UTC+7 → 7:00 sáng VN câu mới).

### 5.4 Variety Modes

#### 5.4.1 Mystery Mode

> **Source:** `pages/MysteryMode.tsx`, `VarietyQuizController GET /api/variety/mystery`.

- Random hoàn toàn (không biết book / difficulty / chủ đề).
- 10 câu, timer 25s.
- Sau mỗi câu reveal book name.
- **×1.5 XP bonus** (canonical) — *hiện chưa wire vào ScoringService, xem BACKLOG*.
- Smart Selection ✅.

#### 5.4.2 Speed Round

> **Source:** `pages/SpeedRound.tsx`, `GET /api/variety/speed`.

- 10 câu × 10s; chỉ Easy.
- 1 lần / ngày.
- **×2.0 XP bonus** (canonical) — *xem BACKLOG cho wire status*.
- UI: timer đỏ pulse, sound `timerWarning` mỗi giây cuối.

#### 5.4.3 Weekly Themed Quiz

> **Source:** `pages/WeeklyQuiz.tsx`, `WeeklyThemeService.java`, `GET /api/variety/weekly`.

- 10 câu / tuần, leaderboard riêng.
- 10 themes xoay vòng theo `weekOfYear % 10`: Miracles / Kings / Prophecy / Creation / Women / Parables / Prayers / Journeys / Love / Courage.
- Badge "Người Theo Đuổi" — hoàn thành 4 tuần liên tiếp.

### 5.5 Multiplayer (overview)

> **Chi tiết:** [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md).

- 5 modes: `SPEED_RACE`, `BATTLE_ROYALE`, `TEAM_VS_TEAM`, `SUDDEN_DEATH`, `GROUP_LIVE_SEQUENTIAL`.
- Mã phòng 6 ký tự, 2–20 người (tùy mode).
- Realtime via STOMP `/topic/room/{roomId}` (xem §26).
- Lifecycle R1–R5 (canonical, xem SPEC_MULTIPLAYER §4).
- Routes FE: `/multiplayer`, `/rooms`, `/room/create`, `/room/join`, `/room/:roomId/lobby`, `/room/:roomId/quiz`, `/room/:roomId/host` (Sprint 4 — Quản trò spectator).
- **Sprint 4 — Host-Organizer separation (default cho rooms mới):** host KHÔNG trả lời câu hỏi, chỉ điều phối (pause/skip/broadcast/end-early qua `POST /api/rooms/{id}/host/*`). Min 2 players không tính host. Field `Room.hostPlaysGame` (default `false` cho rooms mới, `true` cho rooms tạo trước Sprint 4 + ChurchGroup "Tự ôn"/"Chơi cùng nhau"). WS events mới: `GAME_PAUSED`, `GAME_RESUMED`, `QUESTION_SKIPPED`, `HOST_BROADCAST`. `ROOM_ENDED.reason` thêm `HOST_ENDED_EARLY`.

### 5.6 Liturgical Seasons (4 mùa canonical)

> **Source:** `VarietyQuizController.java GET /api/variety/seasonal`; `DailyThemeService.java`.

**Canonical 4 mùa + ×1.5 score bonus áp dụng cho Ranked + Daily Challenge:**

| # | Tên VN | Tên EN | Tháng (UTC) | Books focus |
|---|---|---|---|---|
| 1 | Phục Sinh | Easter | T2 – T4 | 4 Phúc Âm + Acts |
| 2 | Ngũ Tuần | Pentecost | T5 – T7 | Acts + thư tín Phao-lô |
| 3 | Cảm Tạ | Thanksgiving | T8 – T10 | Thi Thiên + Châm Ngôn |
| 4 | Giáng Sinh | Christmas | T11 – T1 | Matthew, Luke, Isaiah |

> **Known gap:** Code hiện chỉ ship 2/4 mùa (Christmas + Easter); bonus ×1.5 dead-code trong DTO. Xem [BACKLOG.md](BACKLOG.md) — "Ship Pentecost + Thanksgiving + wire ×1.5 in ScoringService".

---

## 6. Bible Journey Map (66 sách)

### 6.1 Mục đích
Gamify hành trình chinh phục 66 sách → mục tiêu dài hạn thay grind điểm vô hồn.

### 6.2 Mastery formula

> **Source:** `BookMasteryService.java`; entity `UserBookProgress`.

```
mastery% = (số câu user đã trả lời ĐÚNG ít nhất 1 lần) / (tổng câu của sách) × 100

Status:
  COMPLETED   : mastery ≥ 80%
  IN_PROGRESS : mastery > 0% hoặc unlocked
  LOCKED      : sách trước chưa COMPLETED (theo book.order_index)
```

### 6.3 UI

> **Source:** `pages/Journey.tsx`, `components/BibleJourneyCard.tsx`, `BookProgress.tsx`.

- Chia 2 nhóm: Cựu Ước (39 sách) / Tân Ước (27 sách).
- Mỗi sách: name VN, mastery%, status icon (✅ / 📖 / 🔒).
- Click sách → Practice mode pre-filtered.

### 6.4 Book completion celebration
Khi đạt 80% 1 sách → `BookCompletionModal.tsx` full-screen + confetti + sound `bookComplete` + Share Card auto-generate + badge "Người Chinh Phục [Book]".

### 6.5 Milestone badges
Khởi Hành (1 sách) · Ngũ Thư (5) · Chinh Phục (10) · Cựu Ước (39) · Phúc Âm (4) · Thư Tín (21) · Tân Ước (27) · Toàn Thư (66).

### 6.6 API

```
GET /api/users/{id}/progress  → tier + book progress (66 entries)
GET /api/me/journey           → giống ↑ cho self (qua UserController)
```

---

## 7. Question Selection System

### 7.0 Overview — 3-layer architecture

Selection cho mỗi câu hỏi Ranked đi qua **3 lớp độc lập**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Liturgical Coverage  (§7.1)                        │
│ → Quyết định POOL SÁCH (week's book list)                   │
│ → "Tuần này user đang ở phase nào, sách gì còn chưa cover?" │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Tier Difficulty Distribution  (§7.2)               │
│ → Quyết định TỶ LỆ ĐỘ KHÓ (Easy/Medium/Hard % theo tier)   │
│ → "User Tier 4 → 20% Easy / 50% Medium / 30% Hard"          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Smart History Pools  (§7.4)                        │
│ → Quyết định CÂU CỤ THỂ (chưa thấy / SRS / lâu chưa thấy)   │
│ → "Chọn 60% Pool 1 + 20% Pool 2 + ..."                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  Final: N câu hỏi
```

Apply chỉ cho **Ranked** ở Layer 1. **Layers 2-3 vẫn được tái sử dụng** cho Practice / Mystery / Speed Round (xem §7.6 apply matrix). Coverage System (Layer 1) là Ranked-exclusive.

---

### 7.1 Liturgical Coverage System (NEW — primary mechanic)

#### 7.1.1 Mục đích

Đảm bảo user **chơi qua tất cả 66 sách Kinh Thánh** trong mỗi mùa liturgical (90 ngày). Thay thế cơ chế `currentBook` sequential Genesis → Revelation (deprecated, xem §7.10).

#### 7.1.2 Season structure

Mỗi mùa = **13 tuần × 7 ngày = 91 ngày** (locked §7.14.3: 11 weeks regular + 2 weeks Mastery = 91 ngày tổng).

| Phase | Tuần | Ngày | Số sách | Mục tiêu |
|---|---|---|---|---|
| **Foundation** (Nền Tảng) | 1–4 | 28 | 24 sách (6/tuần × 4 tuần) | Khởi đầu, sách lớn + nhỏ pair đều |
| **Acceleration** (Tăng Tốc) | 5–8 | 28 | 24 sách (6/tuần × 4 tuần) | Đào sâu, kết hợp Cựu Ước + Tân Ước |
| **Climax** (Đỉnh Cao) | 9–11 | 21 | 18 sách (6/tuần × 3 tuần) | Focus books của mùa (×1.5 bonus fire mạnh nhất) |
| **Mastery** (Hoàn Thiện) | 12–13 | 14 | 0 sách mới | Catchup + Toàn Thư badge ceremony |

Tổng: 24 + 24 + 18 = **66 sách** cover trong tuần 1–11. Tuần 12–13 (14 ngày) dành cho catch-up.

#### 7.1.3 Weekly pairing — 6 sách/tuần

Mỗi tuần có **6 sách** được system auto-pair theo thuật toán (§7.3) với constraints:

- Phải có ≥ 1 sách "lớn" (pool ≥ 100 câu) để Tier 6 đủ pool Hard
- Pair Cựu Ước + Tân Ước (theo phase) cho đa dạng
- Trong **Climax phase**, focus books của mùa hiện tại (per §5.6) được reserve

**Ví dụ Mùa Phục Sinh (focus: Matthew, Mark, Luke, John, Acts):**

| Tuần | Phase | Sách | Note |
|---|---|---|---|
| 1 | Foundation | Genesis (50ch) + Áp-đia + 2 Peter + Jude + 2 John + 3 John | Khởi đầu, anchor Genesis |
| 2 | Foundation | Exodus (40ch) + Phi-lê-môn + Mi-chê + Habacúc + Sô-phô-ni + A-ghê | Anchor Exodus |
| ... | ... | ... | ... |
| 9 | Climax | **Matthew** + Hosea + Amos + Joel + Na-hum + Ma-la-chi | Focus + minor prophets |
| 10 | Climax | **Mark** + **Luke** + Lamentations + Ecclesiastes + Song + Ruth | Double focus + Wisdom |
| 11 | Climax | **John** + **Acts** + Daniel + Esther + Ezra + Nehemiah | Focus + Historical |
| 12–13 | Mastery | (no new books) | User catchup sách miss |

→ Concrete pairings cho 4 mùa pre-computed seed-time, lưu DB (xem §7.7).

#### 7.1.4 Coverage tracking per user

Mỗi user có 1 `UserSeasonCoverage` record per (user, season):

```
{
  userId, seasonId,
  currentWeek: 1..13,
  weeksCompleted: [1, 2, 3, ...],          // Tuần đã hoàn thành
  bookCoverage: {                           // Per-book counter
    "Genesis": 12,        // ≥ 4 → covered ✅
    "Áp-đia": 2,          // < 4 → in progress 🌱
    "Habacúc": 0,         // 0 → not started ⚪
    ...
  },
  startedAt, lastActivityAt
}
```

**Coverage threshold per sách:** ≥ **4 câu/sách** chơi trong mùa (KHÔNG yêu cầu đúng, chỉ cần answered).

**Tuần hoàn thành** = tất cả 6 sách của tuần đó đều `bookCoverage ≥ 4`.

#### 7.1.5 Week progression — unlock next week early

**Mặc định:** 1 tuần active tại thời điểm, theo lịch calendar của mùa.

**Unlock early:** Khi user hoàn thành tuần hiện tại (6/6 sách ≥ 4 câu):
- Tuần kế tiếp **unlock ngay lập tức** (không đợi qua đêm)
- User có thể chọn tiếp tục với pool của tuần kế hoặc nghỉ
- UI modal: "🎉 Hoàn thành tuần 3! Bạn có muốn bắt đầu tuần 4 ngay?"

**Giới hạn:** Tối đa **1 tuần ahead** so với lịch calendar. Không cho user rush 5 tuần liên tiếp trong 1 ngày (giữ pacing).

```
Calendar: Tuần 5 đang active (per date)
User completed: 1, 2, 3, 4, 5
User can play: tuần 6 (1 ahead) ✓
User CANNOT play: tuần 7 (2 ahead) ✗ — phải đợi tuần 6 calendar
```

#### 7.1.6 Forgiveness mechanic — skip days

Nếu user **skip nhiều ngày**, tuần đã pass **không bị compound debt**:

```
Tuần 1 (calendar tuần 1-7): user chơi 0 câu → tuần 1 = MISSED, coverage stays 0
Tuần 2 (calendar tuần 8-14): bắt đầu fresh → user chơi tuần 2 bình thường
```

Tuần 1 không quay lại "ám" tuần 2. Goal mùa (66/66) quan trọng hơn goal tuần.

> **⚠️ Forgiveness scope clarification:** Forgiveness áp dụng ở **week-level** (không có debt tuần). Nhưng **book-level coverage vẫn track persistent** — sách miss trong tuần 1 vẫn nằm trong `bookCoverage` với count thấp, và sẽ pool vào Mastery Week (tuần 12-13) để catchup.

**Cuối mùa:** Sách miss trong tuần 1-11 sẽ tự động được pool vào tuần 12-13 (Mastery Week) — xem §7.1.7.

#### 7.1.7 Mastery Week (tuần 12-13) — catchup phase

Tuần 12-13 không có sách mới. Pool sách = **toàn bộ sách chưa cover của user**.

```
Logic tuần 12-13:
  uncoveredBooks = [b for b in allBooks if user.bookCoverage[b] < 4]
  
  if len(uncoveredBooks) == 0:
    # User đã full coverage → BONUS MODE
    # Pool = toàn bộ 66 sách, smart history active
    badge "Toàn Thư - [Mùa]" awarded (nếu chưa có)
    
  else:
    # Catchup mode
    # Pool = uncoveredBooks
    # Display: "Còn [N] sách chưa cover trong mùa này"
    # Aggressive UI nudges: highlight các sách miss
```

#### 7.1.8 End-of-season badges

Khi mùa kết thúc, award badge dựa trên `bookCoverage` total. Threshold + tên locked tại §7.14.2:

| Tổng sách cover (≥ 4 câu) | Badge | Tên VN | Tên EN |
|---|---|---|---|
| 66/66 | 👑 Toàn Thư | "Toàn Thư - Mùa [X]" | "Whole Bible - [X] Season" |
| 51-65 | 🌟 Tận Tâm | "Tận Tâm - Mùa [X]" | "Devoted - [X] Season" |
| 21-50 | 🙏 Hành Hương | "Hành Hương - Mùa [X]" | "Pilgrim - [X] Season" |
| 1-20 | (no badge) | — | — |

Badges accumulate across seasons (collectible). Display trong Profile → Achievements.

#### 7.1.9 Season transition

Khi 1 mùa kết thúc + mùa mới bắt đầu:

1. Award end-of-season badge dựa trên coverage cuối
2. **Reset `UserSeasonCoverage`** cho mùa mới — `bookCoverage = {}`, `currentWeek = 1`, `weeksCompleted = []`
3. User bắt đầu fresh từ tuần 1 mùa mới
4. UI banner "🎊 Bắt đầu Mùa [Ngũ Tuần] 2026!" với 7-day welcome

**Edge case:** User đang chơi giữa session khi mùa transition (00:00 UTC boundary):
- Cho phép finish session hiện tại với pool tuần cuối mùa cũ
- Session next → reset, áp pool tuần 1 mùa mới

---

### 7.2 Tier Difficulty Distribution

> **Source canonical:** `TierDifficultyConfig.java:13-22` (giữ nguyên, không thay đổi).

| Tier | Easy% | Medium% | Hard% | Timer (s) |
|---|---|---|---|---|
| 1 (Tân Tín Hữu) | 70 | 25 | 5 | 30 |
| 2 (Người Tìm Kiếm) | 55 | 35 | 10 | 28 |
| 3 (Môn Đồ) | 35 | 45 | 20 | 25 |
| 4 (Hiền Triết) | 20 | 50 | 30 | 23 |
| 5 (Tiên Tri) | 10 | 40 | 50 | 20 |
| 6 (Sứ Đồ) | 5 | 35 | 60 | 18 |

Áp dụng **TRONG pool sách của tuần** (Layer 1 đã filter sách trước):

```
Pool tuần 5 = [Numbers, Joel, Na-hum, Ma-la-chi, Esther, Lamentations]
Tier 6 user mở Ranked, count = 10:
  → 5% Easy (0-1 câu) — trong Numbers/Esther/etc.
  → 35% Medium (3-4 câu) — trong Numbers/Esther/etc.
  → 60% Hard (5-6 câu) — trong Numbers/Esther/etc.
```

**Tier-aware coverage:** User Tier 1 và Tier 6 cùng "cover" cùng 6 sách, nhưng độ khó câu khác hoàn toàn. Cùng narrative, khác depth.

---

### 7.3 Weekly Pairing Algorithm (auto-compute)

#### 7.3.1 Mục đích

Tự động compute 13 weekly groups × 4 mùa = **52 pairings** mà không cần manual curate. Match Bui's decision Q5 (auto compute + season focus boost).

#### 7.3.2 Algorithm v1 — pseudocode

```python
def compute_pairings_for_season(season: Season) -> List[WeeklyPairing]:
    """
    Returns 13 weekly pairings for 1 season.
    Deterministic: same input → same output.
    
    Invariants:
    - len(season.focus_books) must be in range [1, 18] — checked at entry
    - All 66 books must appear exactly once across weeks 1-11
    - No duplicate books within a week
    """
    all_books = get_66_books_with_metadata()  
    # Each book: { name, testament: OT|NT, chapter_count, total_questions }
    
    focus_books = season.focus_books  # 3-5 books typically
    
    # INVARIANT CHECK — fail fast if season config invalid
    assert 1 <= len(focus_books) <= 18, \
        f"Season focus_books must be 1-18 books, got {len(focus_books)}"
    assert all(b in all_books for b in focus_books), \
        "All focus books must be canonical 66"
    
    # Step 1: Reserve Climax phase (tuần 9-11) for focus books
    climax_books = list(focus_books)  # Start with focus (deduped via list-init)
    
    if len(climax_books) < 18:
        # Expand with semantic neighbors (Pauline, Wisdom, Major Prophets)
        # Dedupe against already-included focus books
        neighbors = expand_with_neighbors(focus_books, target=18 - len(climax_books))
        climax_books += [b for b in neighbors if b not in climax_books]
    
    climax_books = climax_books[:18]  # Hard cap (in case focus = 18+)
    
    # INVARIANT: exactly 18 climax books, no duplicates
    assert len(climax_books) == 18, f"Climax must have 18 books, got {len(climax_books)}"
    assert len(set(climax_books)) == 18, "Climax books must be unique"
    
    climax_weeks = chunk(climax_books, weeks=3, books_per_week=6)
    
    # Step 2: Remaining books for tuần 1-8
    remaining = [b for b in all_books if b not in climax_books]  # 48 books
    
    # INVARIANT: remaining must be exactly 48
    assert len(remaining) == 48, f"Remaining must be 48 books, got {len(remaining)}"
    
    # Sort by pool size desc
    remaining.sort(key=lambda b: b.total_questions, reverse=True)
    
    large_books = remaining[:8]   # Top 8 by pool size (anchors)
    small_books = remaining[8:]   # Remaining 40 (satellites)
    
    # Step 3: Distribute - 1 large + 5 small per week
    weeks_1_8 = []
    for i in range(8):
        week = [large_books[i]]
        week.extend(small_books[i*5:(i+1)*5])
        weeks_1_8.append(week)
    
    # Step 4: Order weeks by phase + testament balance
    # Phase 1 (Foundation, tuần 1-4): more OT anchors
    # Phase 2 (Acceleration, tuần 5-8): mix
    weeks_1_8 = balance_testament_per_phase(weeks_1_8)
    
    # Step 5: Final assembly + integrity check
    pairings = []
    seen_books = set()
    
    for week_num in range(1, 12):  # 1-11
        if week_num <= 8:
            books = weeks_1_8[week_num - 1]
            phase = 'FOUNDATION' if week_num <= 4 else 'ACCELERATION'
        else:
            books = climax_weeks[week_num - 9]
            phase = 'CLIMAX'
        
        # INVARIANT: no book duplicated across season
        for b in books:
            assert b not in seen_books, f"Book {b} duplicated in week {week_num}"
            seen_books.add(b)
        
        pairings.append(WeeklyPairing(
            season_id=season.id,
            week_number=week_num,
            phase=phase,
            book_codes=[b.name for b in books]
        ))
    
    # FINAL INVARIANT: all 66 books covered
    assert len(seen_books) == 66, \
        f"Pairing must cover all 66 books, got {len(seen_books)}"
    
    # Tuần 12-13: Mastery Week (no books — dynamic per user)
    for week_num in [12, 13]:
        pairings.append(WeeklyPairing(
            season_id=season.id,
            week_number=week_num,
            phase='MASTERY',
            book_codes=[]  # Empty — runtime computed per user
        ))
    
    return pairings
```

#### 7.3.3 Caching strategy

Pairings deterministic → compute 1 lần, cache vĩnh viễn.

- **App startup:** Check `weekly_pairings` table, nếu empty → compute cho 4 mùa, insert
- **Admin update season focus:** Recompute affected season's pairings, INSERT ON CONFLICT
- **Runtime:** Read from `weekly_pairings` table (cache trong Redis 1h TTL)

#### 7.3.4 Override capability (admin)

Admin có thể override auto pairing nếu muốn manual curate:

```
PATCH /api/admin/seasons/{id}/pairings
Body: {
  week: 5,
  book_codes: ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "Psalms"]
}
```

Override persisted, không bị overwrite bởi re-compute.

---

### 7.4 Smart History Pools (within selected pool)

> **Source canonical:** `SmartQuestionSelector.java:90-154` (giữ nguyên logic, scope thay đổi).

Sau khi Layer 1 chọn pool sách (6 sách tuần) và Layer 2 chọn ratio difficulty, Layer 3 chọn câu cụ thể:

| Pool | % default | Mô tả |
|---|---|---|
| 1 | 60% | Câu CHƯA gặp |
| 2 | 20% | Câu đã sai + quá hạn ôn (SRS) |
| 3 | 15% | Câu đã đúng nhưng > 30 ngày |
| 4 | fallback | Câu đã đúng gần đây |

**Spaced Repetition (unchanged):**

```
Đúng → next_review_at = now + (3, 6, 9, ...) ngày, max 30
Sai  → next_review_at = now + 1 ngày
```

**Scope thay đổi:** Pool 1/2/3/4 query trong `book IN (weekBooks)` thay vì `book = currentBook`.

---

### 7.5 Tier-aware Pool Composition Example

End-to-end ví dụ cho user Tier 4, tuần 3 Mùa Phục Sinh:

```
Layer 1 (Coverage):
  Tuần 3, Foundation phase
  Books: [Leviticus, Joel, Na-hum, Ma-la-chi, Hosea, Amos]
  User progress: Leviticus 12/4 ✅, Joel 3 🌱, Na-hum 0 ⚪, ...
  Active pool = [Joel, Na-hum, Ma-la-chi, Hosea, Amos]  (Leviticus đã ≥ 4)
  
Layer 2 (Tier Distribution):
  Tier 4 → 20% Easy / 50% Medium / 30% Hard
  Limit = 10 câu
  → 2 Easy + 5 Medium + 3 Hard
  
Layer 3 (Smart History):
  Within [Joel, Na-hum, Ma-la-chi, Hosea, Amos]:
    - Easy bucket: 2 câu (1 Pool 1 + 1 Pool 2)
    - Medium bucket: 5 câu (3 Pool 1 + 1 Pool 2 + 1 Pool 3)
    - Hard bucket: 3 câu (2 Pool 1 + 1 Pool 2)
  
Final: 10 câu mixed, shuffled
```

User trả lời 10 câu → bookCoverage tăng → có thể tick thêm 1-2 sách → potentially complete tuần.

---

### 7.6 Apply matrix

| Mode | Layer 1 Coverage | Layer 2 Tier | Layer 3 Smart |
|---|---|---|---|
| **Ranked** | ✅ Primary | ✅ | ✅ |
| Practice | ❌ User pick book | ⚠️ Optional | ✅ |
| Daily Challenge | ❌ Deterministic seed | ❌ Random fair | ❌ |
| Multiplayer (room) | ❌ Cùng câu cho cả room | ❌ | ❌ |
| Mystery Mode | ❌ Random across books | ✅ | ✅ |
| Speed Round | ❌ Easy only | ❌ | ✅ |
| Weekly Themed | ❌ Pre-defined theme | ❌ | ✅ |

**Layer 1 Coverage System ONLY applies to Ranked.** Layers 2-3 reuse cross-mode per matrix above.

---

### 7.7 Schema additions

#### 7.7.1 New entity: `WeeklyPairing`

**Java entity (camelCase fields per Hibernate convention):**

| Field (Java) | Column (DB) | Type | Note |
|---|---|---|---|
| `id` | `id` | `String(36)` | UUID v7 (CLAUDE.md backend rule), gen via `UuidV7Generator` |
| `seasonId` | `season_id` | `String(36)` | FK → `seasons.id` (legacy UUID v4 from `Season.java`, see note below) |
| `weekNumber` | `week_number` | `Integer` | 1..13 |
| `phase` | `phase` | enum | `FOUNDATION` / `ACCELERATION` / `CLIMAX` / `MASTERY` |
| `bookCodes` | `book_codes` | `List<String>` (JSON) | Book name array |
| `isAdminOverride` | `is_admin_override` | `Boolean` | Default `false` |
| `createdAt` | `created_at` | `LocalDateTime` | Hibernate `@CreationTimestamp` |
| `updatedAt` | `updated_at` | `LocalDateTime` | Hibernate `@UpdateTimestamp` |

> **Note — UUID version drift (accepted):** Legacy `seasons.id` dùng UUID v4 (Season entity tồn tại trước CLAUDE.md UUID v7 rule). New entities (`weekly_pairings.id`, `user_season_coverage.id`) dùng UUID v7 per current convention. FK reference value-only — no compatibility issue. Future migration `seasons.id` v4 → v7 tracked separately (BACKLOG: `BL-UUID-V7-SEASONS`) nếu cần time-ordered insert performance.

**Migration SQL:**

```sql
CREATE TABLE weekly_pairings (
    id VARCHAR(36) PRIMARY KEY,                    -- UUID v7
    season_id VARCHAR(36) NOT NULL,                -- FK to seasons.id (UUID)
    week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 13),
    phase ENUM('FOUNDATION', 'ACCELERATION', 'CLIMAX', 'MASTERY') NOT NULL,
    book_codes JSON NOT NULL,
    is_admin_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_season_week (season_id, week_number),
    INDEX idx_season (season_id),
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);
```

Pre-seed: 4 mùa × 13 tuần = **52 rows**.

> **Type verified (2026-05-21):** `seasons.id = VARCHAR(36)` UUID from `Season.java`. Spec sync với existing schema.

#### 7.7.2 New entity: `UserSeasonCoverage`

**Java entity (camelCase fields):**

| Field (Java) | Column (DB) | Type | Note |
|---|---|---|---|
| `id` | `id` | `String(36)` | UUID v7 |
| `userId` | `user_id` | `String(36)` | FK → `users.id` |
| `seasonId` | `season_id` | `String(36)` | FK → `seasons.id` (UUID) |
| `currentWeek` | `current_week` | `Integer` | 1..13, default 1 |
| `weeksCompleted` | `weeks_completed` | `List<Integer>` (JSON) | E.g., `[1, 2, 3]` |
| `bookCoverage` | `book_coverage` | `Map<String, Integer>` (JSON) | `{"Genesis": 12, ...}` |
| `startedAt` | `started_at` | `LocalDateTime` | `@CreationTimestamp` |
| `lastActivityAt` | `last_activity_at` | `LocalDateTime` | `@UpdateTimestamp` |
| `completedAt` | `completed_at` | `LocalDateTime` nullable | Set khi 66/66 cover |

**Migration SQL:**

```sql
CREATE TABLE user_season_coverage (
    id VARCHAR(36) PRIMARY KEY,                    -- UUID v7
    user_id VARCHAR(36) NOT NULL,
    season_id VARCHAR(36) NOT NULL,                -- FK to seasons.id (UUID)
    
    current_week INT NOT NULL DEFAULT 1 CHECK (current_week BETWEEN 1 AND 13),
    weeks_completed JSON DEFAULT ('[]'),
    book_coverage JSON DEFAULT ('{}'),
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    UNIQUE KEY uk_user_season (user_id, season_id),
    INDEX idx_user (user_id),
    INDEX idx_season (season_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);
```

#### 7.7.3 Deprecated columns in `users` / `user_daily_progress`

Drop sequentially trong Phase 4 migration (xem §7.9 + §7.9.7 for exact phase split):

```sql
-- Phase 4b (after Phase 4a rename verification, 30 days post-Phase 3):
ALTER TABLE users
    DROP COLUMN current_book,
    DROP COLUMN current_book_index,
    DROP COLUMN is_post_cycle;

ALTER TABLE user_daily_progress
    DROP COLUMN current_book,
    DROP COLUMN current_book_index,
    DROP COLUMN is_post_cycle;

-- Phase 4c (DEFERRED — chỉ drop SAU KHI 100% mobile users migrate hoàn tất Phase 3):
ALTER TABLE user_daily_progress
    DROP COLUMN current_difficulty;  -- Mobile legacy may still send this field
```

> **⚠️ `current_difficulty` drop timing:** Mobile RankedScreen pre-migration vẫn gửi `currentDifficulty` field. Drop column này **SAU KHI** Phase 3 mobile migrate hoàn tất + 30 ngày grace (track via telemetry `mobile_legacy_request_count` = 0 in 30 consecutive days). Đây là why Phase 4 split thành 4a/4b/4c.

> **⚠️ Migration risk:** drop column irreversible after Phase 4b/4c. Implement với feature flag (xem §7.9).

#### 7.7.4 Modify `QuestionFilter` signature

Java DTO change:

```java
// OLD
public class QuestionFilter {
    private String book;        // single book
    private String difficulty;
    private String language;
}

// NEW
public class QuestionFilter {
    private List<String> books;     // 1+ books (Coverage tuần)
    private String difficulty;
    private String language;
}
```

Repository query change:

```java
// OLD
@Query("SELECT q FROM Question q WHERE q.book = :book ...")

// NEW
@Query("SELECT q FROM Question q WHERE q.book IN :books ...")
```

#### 7.7.5 Performance: DTO projection (Phase A quick-win)

> **Source:** Discussion 2026-05-21 dựa trên audit performance.

Selector load LIGHTWEIGHT metadata thay vì full entity:

```java
public record QuestionMeta(
    String id,
    String book,
    String difficulty
) {}

// Repository
@Query("SELECT new com.biblequiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
       "FROM Question q WHERE q.language = :lang AND q.book IN :books AND q.status = 'ACTIVE'")
List<QuestionMeta> findMetaByLanguageAndBooks(String lang, List<String> books);
```

Sau khi smart selector pick N IDs → batch fetch full:

```java
// After ID selection
List<String> selectedIds = ...; // N IDs
List<Question> fullQuestions = questionRepository.findAllById(selectedIds);  // 1 batch query
```

→ Memory ↓ ~40x (250KB metadata vs 10MB full entity).

#### 7.7.6 DB index

```sql
CREATE INDEX idx_questions_filter
  ON questions(language, book, difficulty, status)
  WHERE status = 'ACTIVE';
```

---

### 7.8 API Endpoints

#### 7.8.1 GET /api/me/coverage-status (NEW)

Trả về toàn bộ trạng thái coverage cho user hiện tại.

**Request:** authenticated

**Response:**
```json
{
  "season": {
    "id": "01HQ8Z3K4N5P6Q7R8S9T0V1W2X",
    "code": "EASTER",
    "nameVi": "Mùa Phục Sinh",
    "nameEn": "Easter Season",
    "startDate": "2026-02-01",
    "endDate": "2026-04-30",
    "daysRemaining": 47
  },
  "currentWeek": {
    "weekNumber": 3,
    "phase": "FOUNDATION",
    "books": [
      { "code": "Leviticus", "nameVi": "Lê-vi-ký", "covered": true, "answeredCount": 12 },
      { "code": "Joel", "nameVi": "Giô-ên", "covered": false, "answeredCount": 3 },
      { "code": "Nahum", "nameVi": "Na-hum", "covered": false, "answeredCount": 0 },
      { "code": "Malachi", "nameVi": "Ma-la-chi", "covered": false, "answeredCount": 0 },
      { "code": "Hosea", "nameVi": "Hô-sê-a", "covered": false, "answeredCount": 0 },
      { "code": "Amos", "nameVi": "A-mốt", "covered": false, "answeredCount": 0 }
    ],
    "completed": false,           // 6/6 books covered?
    "canUnlockNext": false        // Can advance to week 4?
  },
  "seasonProgress": {
    "totalCovered": 13,           // out of 66
    "weeksCompleted": [1, 2],
    "currentBadgePreview": "Người Hành Hương"  // What user would get if season ended now
  }
}
```

#### 7.8.2 POST /api/ranked/questions/select (MODIFIED)

**Request body CHANGED:**

```json
{
  "limit": 10,
  "language": "vi",
  "difficulty": null,
  "excludeIds": []
  // NO MORE `book` field — BE knows from coverage state
}
```

**Response:** Unchanged structure (`{ questions: [...] }`).

**Internal flow:**
1. Resolve user → tier
2. Resolve current season + week from `UserSeasonCoverage`
3. Get week's book pool from `WeeklyPairing`
4. Filter to non-covered books (or all if mastery week)
5. Apply Layer 2 + 3
6. Return N câu

#### 7.8.3 POST /api/ranked/coverage/unlock-next-week (NEW)

User trigger unlock tuần kế tiếp khi đã complete tuần hiện tại.

**Request:** authenticated, no body
**Response:**
```json
{
  "success": true,
  "newWeek": 4,
  "newBooks": [...]
}
```

**Error cases:**
- 400 `WEEK_NOT_COMPLETED` — chưa hoàn thành tuần hiện tại
- 400 `ALREADY_AHEAD_LIMIT` — đã ở 1 tuần ahead, không thể unlock thêm
- 404 `NO_NEXT_WEEK` — đang ở tuần 13 (Mastery Week, cuối mùa)

#### 7.8.4 Modified endpoints

| Endpoint | Change |
|---|---|
| `GET /api/me/ranked-status` | Drop `currentBook`, `currentBookIndex`, `isPostCycle`. Add `coverageStatus` (subset of 7.8.1 response) |
| `POST /api/ranked/sessions/{id}/answer` | Update `UserSeasonCoverage.bookCoverage[book]++` instead of `UserDailyProgress.currentBook` advance |

---

### 7.9 Migration strategy

#### 7.9.1 Phase 0: Feature flag

Add `feature_flags.liturgical_coverage_enabled` (boolean, default `false`).

```java
@Service
public class FeatureFlagService {
    public boolean isLiturgicalCoverageEnabled(String userId) {
        // Phase 1: All users false (default)
        // Phase 2: Internal admin true (testing)
        // Phase 3: 10% rollout
        // Phase 4: 100%
        // Phase 5: Remove flag
    }
}
```

#### 7.9.2 Phase 1: Backward compat (1-2 weeks)

- Both code paths coexist
- Feature flag OFF: old `currentBook` logic
- Feature flag ON: new Coverage logic
- Mobile chưa migrate → vẫn dùng old path
- Web pilot: 10% users opt-in via Settings → "Try new Ranked"

#### 7.9.3 Phase 2: Internal data migration

**Option A — App-layer migration (recommended):**

Run via `LiturgicalCoverageMigrationJob.java` Spring `@PostConstruct` hoặc dedicated `Flyway` callback. Mỗi user lazy-created qua `UuidV7Generator` ở app layer:

```java
// LiturgicalCoverageMigrationJob.java
public void migrateAllUsers() {
    String activeSeasonId = seasonRepository
        .findFirstByIsActiveTrue()
        .orElseThrow()
        .getId();
    
    userRepository.findAll().forEach(user -> {
        if (!coverageRepository.existsByUserIdAndSeasonId(user.getId(), activeSeasonId)) {
            UserSeasonCoverage coverage = new UserSeasonCoverage();
            coverage.setId(UuidV7Generator.generate());
            coverage.setUserId(user.getId());
            coverage.setSeasonId(activeSeasonId);
            coverage.setCurrentWeek(1);
            coverage.setBookCoverage(new HashMap<>());
            coverage.setWeeksCompleted(new ArrayList<>());
            coverageRepository.save(coverage);
        }
    });
}
```

**Option B — Pure SQL (fallback nếu cần raw migration):**

```sql
-- MySQL UUID() generates v4 (not v7) — use only if app-layer migration unavailable
INSERT INTO user_season_coverage (id, user_id, season_id, current_week, weeks_completed, book_coverage)
SELECT 
    UUID(),                                            -- v4 fallback
    u.id,
    (SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1),
    1,
    '[]',
    '{}'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_season_coverage usc
    WHERE usc.user_id = u.id
);
```

> **⚠️ Prefer Option A** — UUID v7 từ `UuidV7Generator` (CLAUDE.md convention) đảm bảo time-ordered IDs cho better insert performance. Option B chỉ dùng nếu app down hoặc emergency rollback.

**Decision:** Reset everyone's coverage = 0/66 for current season (per Bui decision 2026-05-21).

#### 7.9.4 Phase 3: Mobile migration

- Mobile RankedScreen migrate sang `/api/ranked/questions/select` (P0-A from audit)
- Mobile UI hiện coverage card
- Mobile fully on new system

#### 7.9.5 Phase 4: Drop deprecated columns

After 30 days stable (Phase 4b after Phase 4a rename verification — see §7.9.7):

```sql
-- users table
ALTER TABLE users 
    DROP COLUMN current_book,
    DROP COLUMN current_book_index,
    DROP COLUMN is_post_cycle;

-- user_daily_progress table (drop current_difficulty SEPARATELY — see N4 note)
ALTER TABLE user_daily_progress 
    DROP COLUMN current_book,
    DROP COLUMN current_book_index,
    DROP COLUMN is_post_cycle;
    
-- current_difficulty drop deferred to Phase 4c (after mobile migrate complete)
-- See §7.9.4 Phase 3 mobile migration completion checkpoint
```

Remove `BookProgressionService.java` (50/60% gate) + dual-gate code in `RankedController:572-585`.

#### 7.9.6 Phase 5: Remove feature flag

After 60 days stable post-migration. Code path becomes default.

#### 7.9.7 Rollback plan — per phase

**Phase 0-1 (feature flag off / opt-in):**
- Rollback: set flag global OFF qua admin endpoint
- Data: `UserSeasonCoverage` rows still exist nhưng không được read
- User impact: instant revert to old `currentBook` logic

**Phase 2 (data migration):**
- Rollback: `UserSeasonCoverage` rows orphan nhưng `users.current_book` chưa drop
- Data integrity: OK vì old columns still source-of-truth
- User impact: revert to flag OFF → old logic restored

**Phase 3 (mobile migrate):**
- Rollback: revert mobile app version
- Backend vẫn serve cả 2 endpoints (old `/api/questions` legacy không xoá)
- User impact: mobile users tạm dùng old flow trong khi web stays on new

**Phase 4 (drop columns — POINT OF NO RETURN):**
- **Trước Phase 4 bắt buộc:**
  - 30 ngày stable Phase 3 (zero P0/P1 bugs related to coverage)
  - DB backup full dump trước migration
  - Hibernate entities verified không reference deprecated columns
- **Rollback option:** restore from DB backup (downtime ~1h). KHÔNG có forward-rollback path.
- **Risk mitigation:** Phase 4 done in 2 sub-phases:
  - Phase 4a: rename columns (`current_book` → `_deprecated_current_book`) — reversible 7 days
  - Phase 4b: actual drop column after 7-day grace
  
  > **⚠️ Pre-rename FK/index check:** MySQL `ALTER TABLE ... RENAME COLUMN` có thể fail nếu column tham gia trong FK constraint hoặc composite index. Trước Phase 4a:
  > 1. `SHOW INDEX FROM users WHERE Column_name = 'current_book'` — drop index nếu có
  > 2. `SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE COLUMN_NAME = 'current_book'` — drop FK references nếu có
  > 3. Then `ALTER TABLE users RENAME COLUMN current_book TO _deprecated_current_book`
  > 4. Validate rename rồi mới proceed Phase 4b
  
- User impact nếu rollback: 1h downtime + may lose Phase 2-4a data → acceptable risk after stability proven

**Phase 5 (remove feature flag):**
- Rollback: re-add flag check trong code (1-line revert)
- Data: no schema change → no risk
- User impact: zero downtime revert

---

### 7.10 Cross-references — affected sections

#### 7.10.1 §6 Bible Journey Map — LOCKED removed

**Old §6.2:**
```
Status:
  COMPLETED   : mastery ≥ 80%
  IN_PROGRESS : mastery > 0% hoặc unlocked
  LOCKED      : sách trước chưa COMPLETED  ← REMOVE
```

**New §6.2:**
```
Status:
  COMPLETED   : mastery ≥ 80%
  IN_PROGRESS : mastery > 0%
  NOT_STARTED : mastery = 0
```

`LOCKED` status hoàn toàn gỡ bỏ. User có thể click sách bất kỳ → Practice mode pre-filtered.

#### 7.10.2 §3.6 Early Ranked Unlock — unchanged

Tier 1 user qua Basic Quiz hoặc Early Unlock → vào Ranked → tự động create `UserSeasonCoverage` cho mùa hiện tại.

#### 7.10.3 §5.6 Liturgical Seasons — ×1.5 score wire

Combined với BL-5 (Pentecost + Thanksgiving) + ×1.5 score wire vào `ScoringService`:

```java
// ScoringService.calculateWithTier(...)
boolean isInSeasonBook = liturgicalSeasonService
    .getCurrentSeason(LocalDate.now())
    .getFocusBooks()
    .contains(question.getBook());

if (isInSeasonBook) {
    multiplier *= 1.5;
}
```

Score animation FE: "×1.5 Mùa Phục Sinh!" khi đúng câu thuộc focus book.

---

### 7.11 Edge cases

#### 7.11.1 User chưa có UserSeasonCoverage record

Khi user lần đầu vào Ranked sau khi feature ship:
- Lazy create record với `currentWeek = 1`, `bookCoverage = {}`
- Show onboarding modal "Hành trình mùa Phục Sinh - 66 sách Kinh Thánh trong 13 tuần"

#### 7.11.2 Season transition mid-session

User đang chơi câu hỏi khi 00:00 UTC ngày 1 tháng kế (mùa transition):
- Finish session hiện tại với pool tuần cuối mùa cũ
- Update `UserSeasonCoverage` cho mùa cũ
- Create new `UserSeasonCoverage` cho mùa mới
- Next session → áp pool tuần 1 mùa mới

#### 7.11.3 User unlock tuần kế nhưng chưa play

User complete tuần 3 → unlock tuần 4 → đóng app → 3 ngày sau quay lại:
- `currentWeek` đã = 4 (persisted)
- Calendar đã advance → tuần 4 vẫn match calendar → continue normal

#### 7.11.4 Pool exhaustion within week

Week pool = 6 sách, mỗi sách trung bình 100 câu → ~600 câu/tuần. User Tier 6 cày 100 câu/ngày × 7 = 700 câu/tuần > pool size.

**Fallback chain (auto, không cần user action):**

1. **Primary attempt:** `book IN (weekBooks)` + difficulty + same-day exclusion
2. **Fallback 1:** Drop same-day exclusion (allow câu lặp trong ngày)
3. **Fallback 2:** Drop difficulty filter (mix tier distribution, vẫn trong week pool)
4. **Fallback 3:** Empty result → return `{ questions: [], poolExhausted: true, suggestedAction: "UNLOCK_NEXT_WEEK" }`

**User-facing behavior khi `poolExhausted: true`:**
- Nếu user đã complete tuần hiện tại → UI gợi ý "Pool tuần này đã cạn. Bạn có muốn unlock tuần kế tiếp?"
- Nếu user chưa complete tuần → UI message "Bạn đã hỏi gần hết câu của tuần. Quay lại ngày mai để pool refresh."

**KHÔNG auto-unlock next week** — bypass user action vi phạm contract §7.1.5 (user explicit choice). Auto-unlock ẩn next-week start moment khỏi celebration UX.

#### 7.11.5 Admin disable season mid-mùa

Admin set `season.is_active = false` cho mùa hiện tại:
- All users' `UserSeasonCoverage` for that season → frozen
- New Ranked sessions blocked với message "Mùa hiện tại đang được bảo trì"
- Resume khi admin re-enable

#### 7.11.6 Late-season joiner

User Tier 2+ unlock Ranked tại tuần 5 calendar (giữa mùa Phục Sinh):

**Behavior:**
- `UserSeasonCoverage` lazy-create với `currentWeek = max(calendarWeek, 1) = 5` (join thẳng tuần hiện tại, KHÔNG backlog)
- Tuần 1-4 sách KHÔNG có trong active pool của user → user không gặp Genesis/Exodus/Lev/Numbers trong normal weeks
- Mastery Week (tuần 12-13) sẽ pool toàn bộ uncovered books → user có cơ hội catchup
- Badge tier dựa trên actual coverage cuối mùa (không có grace cho late joiner)

**Math feasibility:**
- Tuần 5 join → còn 9 tuần (5-13) chơi
- Active pool: 6 sách/tuần × 7 tuần (5-11) = 42 sách + Mastery (24 sách uncovered) = 66
- Mastery Week catchup: 24 sách × 4 câu = 96 câu minimum. 14 ngày × 10 câu/ngày = 140 câu → khả thi
- Cày user 100 câu/ngày × 14 = 1400 câu → easy full Mastery
- Casual user 5 câu/ngày × 14 = 70 câu < 96 minimum → likely miss Toàn Thư badge, get Tận Tâm/Hành Hương

**Very late joiner (tuần 10+):**
- Chỉ còn 3-4 tuần → expectation Toàn Thư badge thấp
- UI welcome message: "Bạn vừa join Mùa Phục Sinh. Tham gia Mùa Ngũ Tuần T5/2026 từ tuần 1 để có cơ hội đạt Toàn Thư."
- Standard pool + Mastery Week áp dụng bình thường

---

### 7.12 Performance considerations

#### 7.12.1 Caching layers (post-Phase A)

| Cache | Layer | TTL | Invalidation |
|---|---|---|---|
| `WeeklyPairing` | Redis | 1h | Admin override pairing |
| `Season` config | Redis | 24h | Admin update season |
| `UserSeasonCoverage` | Redis hash per user | 5m | Per-answer update |
| `QuestionMeta` per (lang, books, diff) | Redis | 1h | Admin question CRUD event |
| Full Question entity (by ID) | Caffeine (in-process) | 30m | Question update event |

Phase A (Commit 1 of sprint) ships DTO projection + DB index. Phase B (Redis cache) ships sau P5 stable.

#### 7.12.2 Query patterns

**Per Ranked session start (10 câu):**
- 1 query `UserSeasonCoverage` (Redis hit)
- 1 query `WeeklyPairing` (Redis hit)
- 3 queries metadata (Easy + Medium + Hard buckets, mỗi query một difficulty subset của week pool)
- 1 query `UserQuestionHistory` (per-user, smart history)
- 1 batch query full Question by IDs (after smart selection)

→ Tổng ~6 DB queries. Current path loads **~1 full pool's worth of Question entities** per request (audit §C.4 — 3-4 bucket queries totaling ~1 pool of data materialized in memory). Với DTO projection (Phase A), pool load thành metadata-only ~250KB thay vì full entities ~10MB.

---

### 7.13 Implementation sequence (10 commits)

Tham chiếu Sprint P5 sequence (chốt 2026-05-21):

1. **PERF — DTO projection + DB index + heap config** (Phase A)
2. **LiturgicalSeasonService + 4 mùa (BL-5)**
3. **WeeklyPairingService + WeeklyPairing entity + auto compute**
4. **LiturgicalCoverageService + UserSeasonCoverage entity**
5. **SmartQuestionSelector refactor (book → List<book>)**
6. **RankedController integration + drop currentBook**
7. **×1.5 mùa wire vào ScoringService**
8. **FE Ranked.tsx redesign + coverage UI**
9. **FE Journey Map update (gỡ LOCKED)**
10. **Migration data existing users + feature flag rollout**

Total effort: ~12 ngày. Detailed PROMPT files per commit follow this SPEC.

---

### 7.14 Resolved decisions (locked 2026-05-21)

Final answers cho 4 open questions của v2:

#### 7.14.1 Phase i18n names (Q1) — LOCKED

| Phase | VN | EN | i18n key |
|---|---|---|---|
| FOUNDATION | "Nền Tảng" | "Foundation" | `coverage.phase.foundation` |
| ACCELERATION | "Tăng Tốc" | "Acceleration" | `coverage.phase.acceleration` |
| CLIMAX | "Đỉnh Cao" | "Climax" | `coverage.phase.climax` |
| MASTERY | "Hoàn Thiện" | "Mastery" | `coverage.phase.mastery` |

Rationale: ngắn gọn, match brand "Sacred Modernist", có narrative arc rõ.

#### 7.14.2 Badge thresholds (Q2) — LOCKED

| Tổng sách cover (≥ 4 câu) | Badge | Tên VN | Tên EN |
|---|---|---|---|
| 66/66 | 👑 Toàn Thư | "Toàn Thư - Mùa [X]" | "Whole Bible - [X] Season" |
| 51-65 | 🌟 Tận Tâm | "Tận Tâm - Mùa [X]" | "Devoted - [X] Season" |
| 21-50 | 🙏 Hành Hương | "Hành Hương - Mùa [X]" | "Pilgrim - [X] Season" |
| 1-20 | (no badge) | — | — |

Math check: 21 ≈ 1/3 of 66, 51 ≈ 77% (Tận Tâm ≈ COMPLETED tier), 66 = Toàn Thư (perfect).

#### 7.14.3 Mastery Week duration (Q3) — LOCKED

**14 ngày** (tuần 12 + tuần 13 = 7+7).

Tổng mùa: 11 weeks regular × 7 ngày + 14 ngày Mastery = **91 ngày**. Đủ tolerance cho 4 mùa fit vào 365 ngày (365 / 4 = 91.25).

UX messaging: "2 tuần cuối catchup" — cleaner than "13 ngày".

#### 7.14.4 Admin curation UI (Q4) — DEFERRED v1.5

**v1: CLI/DB-only.** Admin override pairing qua direct DB edit (UPDATE statement to `weekly_pairings` table) hoặc via Spring Boot Admin endpoint:

```
PATCH /api/admin/seasons/{seasonId}/pairings/{weekNumber}
Body: { bookCodes: [...] }
```

Endpoint above ship trong v1 (xem §7.3.4). **No UI** trong v1.

**v1.5:** Admin UI page `/admin/seasons/{id}/pairings` cho visual editor. Tracked trong BACKLOG: `BL-COVERAGE-ADMIN-UI`.

Rationale: Auto pairing đủ tốt cho 4 mùa đầu launch. Manual override rare. UI effort không justify trước v1 launch. Bui hoặc đội mục vụ FMC dùng API/DB nếu cần override gấp.

---

### 7.15 Test plan

Per CLAUDE.md "Quy trình test bắt buộc" + E2E Test Gate.

#### 7.15.1 Unit tests

| Service | Test class | Coverage requirement |
|---|---|---|
| `WeeklyPairingService` | `WeeklyPairingServiceTest` | ≥ 90% — invariants, edge cases (focus = 1/3/5/18 books), determinism |
| `LiturgicalCoverageService` | `LiturgicalCoverageServiceTest` | ≥ 90% — coverage tick, week completion detection, forgiveness, late joiner, season transition |
| `LiturgicalSeasonService` | `LiturgicalSeasonServiceTest` | ≥ 90% — boundary dates 4 mùa, focus books lookup |
| `SmartQuestionSelector` (modified) | `SmartQuestionSelectorTest` (existing, extended) | Existing baseline + new `book IN (list)` path |
| `ScoringService` (×1.5 wire) | `ScoringServiceTest` (existing, extended) | New `isInSeasonBook` parameter paths |

**Critical test cases:**
- `WeeklyPairing` deterministic: cùng season config → cùng 13 pairings
- Coverage threshold edge: user có exactly 4 câu trên 1 sách → covered
- Forgiveness: user skip tuần 3 hoàn toàn → tuần 4 không carry debt
- Mastery Week pool: user uncovered sách correctly pooled
- Late joiner: currentWeek = calendarWeek, không backlog
- Pool exhaustion: fallback chain executes in order

#### 7.15.2 Integration tests

| Test class | Scenario |
|---|---|
| `RankedCoverageIntegrationTest` | Full session 10 câu → coverage updated → status reflects |
| `WeekUnlockIntegrationTest` | Complete week → trigger unlock → next week active |
| `SeasonTransitionIntegrationTest` | UTC boundary cross → reset coverage → new pairings active |
| `MigrationDataIntegrityTest` | Phase 2 migration → all users have UserSeasonCoverage row |

#### 7.15.3 E2E (Playwright)

Module W-M07 — Liturgical Coverage (new):

| TC ID | Scenario | Priority |
|---|---|---|
| W-M07-001 | New user start Ranked → see week 1 books → complete 4 câu → coverage tick | P0 |
| W-M07-002 | User complete week → see unlock modal → tap unlock → next week active | P0 |
| W-M07-003 | User skip 2 weeks → return → no debt, current week aligned to calendar | P1 |
| W-M07-004 | User reach mastery week → uncovered books pool → can catchup | P1 |
| W-M07-005 | Season transition → coverage reset → new mùa banner | P2 |
| W-M07-006 | Pool exhaust scenario → fallback chain → no error | P2 |

Baseline numbers cập nhật sau khi ship. Performance baseline: P50 session start < 200ms, P95 < 500ms.

#### 7.15.4 Migration validation tests

Per CLAUDE.md migration rules — Phase 2 + 4 phải có integration test verify:
- All users get `UserSeasonCoverage` row trong Phase 2
- Drop column trong Phase 4 không break Hibernate boot
- Rollback từ Phase 4a (rename) → restore reads from renamed column

---

### 7.16 Telemetry & Analytics

Events cần track qua existing analytics pipeline (Mixpanel/PostHog/whichever wired):

#### 7.16.1 User journey events

| Event name | Properties | Trigger |
|---|---|---|
| `ranked_session_start` | `{ tier, week, phase, pool_size, books_in_pool }` | POST /api/ranked/sessions |
| `coverage_book_ticked` | `{ book, total_answered_in_book, tier, week, phase }` | **Chỉ fire trên transition `count: 3 → 4`** (sách vừa cross coverage threshold). `total_answered_in_book` ≥ 4 (track total bao gồm câu vừa tick, useful nếu logic tick lazy/batched). KHÔNG fire mỗi câu trả lời. Giảm event volume ~10x. |
| `week_completed` | `{ week, season_code, days_taken, all_books }` | All 6 books cover ≥ 4 |
| `unlock_next_week_triggered` | `{ from_week, to_week, days_ahead_of_calendar }` | POST /api/ranked/coverage/unlock-next-week |
| `mastery_week_entered` | `{ uncovered_count, season_code }` | User session khi `currentWeek >= 12` |
| `season_badge_awarded` | `{ badge_tier, total_covered, season_code }` | Season end + badge calc |
| `season_transition` | `{ from_season, to_season, prev_coverage }` | UTC boundary cross |

#### 7.16.2 System health events

| Event name | Properties | Trigger |
|---|---|---|
| `pool_exhaustion_fallback` | `{ fallback_level: 1\|2\|3, week, tier, lang }` | Mỗi lần fallback chain trigger |
| `pairing_compute_duration` | `{ season_code, duration_ms, books_count }` | Khi `WeeklyPairingService.compute` run |
| `coverage_calc_slow` | `{ user_id, duration_ms }` | Khi calc > 100ms (perf alert) |
| `late_joiner_detected` | `{ join_week, tier }` | User lần đầu tạo UserSeasonCoverage |

#### 7.16.3 Migration rollout events

| Event name | Properties | Trigger |
|---|---|---|
| `coverage_feature_flag_check` | `{ user_id, enabled }` | Mỗi `isLiturgicalCoverageEnabled` call |
| `coverage_migration_phase` | `{ phase: 0\|1\|2\|3\|4\|5, percent_users }` | Daily cron |
| `coverage_rollback_triggered` | `{ phase, reason }` | Admin trigger rollback |

#### 7.16.4 Dashboard requirements

Post-launch admin dashboard hiển thị:
- Coverage funnel: % users đạt 1+, 20+, 50+, 66 sách per mùa
- Average days to complete week 1 (engagement baseline)
- Unlock-next-week trigger rate (gamification effectiveness)
- Pool exhaustion frequency per (tier, week, language)
- Badge distribution at season end

---

## 8. Sound & Haptics

### 8.1 Sound effects
> **Source:** `apps/web/src/lib/soundManager.ts` (web), `expo-av` (mobile).

| Sound | Trigger | Volume |
|---|---|---|
| `correctAnswer` | Đúng | 0.7 |
| `wrongAnswer` | Sai | 0.7 |
| `timerTick` | <5s | 0.5 |
| `timerWarning` | <3s | 0.7 |
| `combo3/5/10` | Streak 3/5/10 | 0.7/0.8/0.9 |
| `quizComplete` | Hết quiz | 0.7 |
| `perfectScore` | 100% | 0.9 |
| `tierUp` | Lên tier | 1.0 |
| `badgeUnlock` | Nhận badge | 0.8 |
| `bookComplete` | Hoàn thành 1 sách | 0.9 |
| `dailyReady` | Daily mới | 0.6 |
| `buttonTap` | Tap | 0.4 |

Format MP3 < 50KB. Settings có volume slider + on/off.

### 8.2 Haptics (mobile)
| Haptic | Strength | Trigger |
|---|---|---|
| `correct` | Light | Đúng |
| `wrong` | Heavy | Sai |
| `select` | Selection | Chọn đáp án |
| `combo` | Medium | Streak 3+ |
| `tierUp` | Success | Lên tier |
| `timerWarning` | Warning | <3s |

Web fallback: `navigator.vibrate()` (limited).

### 8.3 Animations
| Element | Animation |
|---|---|
| Answer đúng | Flash xanh + scale 1.05 |
| Answer sai | Flash đỏ + horizontal shake |
| Combo banner | Slide-in + pulse |
| Score number | Pop 1.3× gold |
| Timer <5s | Pulse vàng |
| Timer <3s | Pulse đỏ critical |
| Tier up | Full screen + crown anim |
| Book complete | Confetti + book icon |

### 8.4 Settings
`Settings → Sound & Haptics`: volume slider 0-100, sound on/off, haptic on/off, animations on/off (slow devices).

---

## 9. Lifeline System

> **Source:** V28 `add_lifeline_system.sql`; `LifelineService.java`, `HintAlgorithmService.java`, `LifelineConfigService.java`; web `useLifeline.ts`; entity `LifelineUsage`, `LifelineType`.

### 9.1 Mục đích
Cho user "vớt" câu khó.

### 9.2 Hai loại — v1 ship HINT only

| Type | v1 status |
|---|---|
| `HINT` | ✅ ship (Eliminate-1-wrong-option) |
| `ASK_OPINION` | ❌ defer v2 (xem SPEC_ROADMAP) |

### 9.3 HINT — Eliminate-1-wrong-option

> **Algorithm:** `HintAlgorithmService` — pick a non-correct option index để loại; ưu tiên option có ít user chọn nhất (heuristic) hoặc fallback random.

**Preconditions** (`LifelineService:111-160`):
1. Session tồn tại + user là owner.
2. Session status = `in_progress` hoặc `created`.
3. Question thuộc session.
4. User CHƯA trả lời câu đó.
5. Question type = `multiple_choice_single` hoặc `multiple_choice_multi` (không hỗ trợ T/F, fill-blank).
6. Quota chưa hết.

**Quota:** Theo session mode (config qua `LifelineConfigService.getHintQuota(mode)`).
- Quota `< 0` = unlimited.
- Quota `= 0` = HINT disabled cho mode đó.

### 9.4 Endpoints

| Method | Path | Auth | Body / Response |
|---|---|---|---|
| POST | `/api/sessions/{id}/lifeline/hint` | Yes | body `{questionId}` → `{eliminatedOptionIndex, hintsRemaining, method}` |
| GET | `/api/sessions/{id}/lifeline/status?questionId=X` | Yes | `{remaining, quota, eliminated[], mode, askOpinionAvailable: false}` |

### 9.5 Error mapping
| Error | HTTP |
|---|---|
| `NotFoundException` | 404 |
| `ForbiddenException` | 403 |
| `ConflictException` (already answered, quota hit) | 409 |
| `UnsupportedLifelineException` (T/F, fill-blank) | 400 |

---

## 10. Cosmetics — Frames + Themes

> **Source:** V26 `add_user_cosmetics_table.sql`; `CosmeticService`; web `pages/Cosmetics.tsx`.

### 10.1 Mục đích
Trang điểm avatar + UI theme theo tier — visual reward không gameplay-affecting.

### 10.2 Schema
```sql
user_cosmetics (
  user_id PK,
  unlocked_frames JSON,    -- ["bronze","silver","gold",...]
  active_frame VARCHAR,
  unlocked_themes JSON,
  active_theme JSON
)
```

### 10.3 Unlock rules
- Đạt tier N → unlock frame "tier_N" + theme "tier_N".
- Prestige (xem §11) → unlock prestige frame riêng.
- Frame áp dụng quanh avatar (Profile + Leaderboard + Multiplayer player card).
- Theme áp dụng cho quiz screen background gradient.

### 10.4 UI
`/cosmetics` (RequireAuth): 2 tab Frames | Themes; "Active" badge; click "Apply" → PATCH `user_cosmetics`.

---

## 11. Prestige System

> **Source:** V27 `add_prestige_fields_to_users.sql`; `PrestigeService`; User fields `prestige_level`, `prestige_at JSON`, `days_at_tier6`, `tier6_reached_at`.

### 11.1 Mục đích
Cho user max-tier (Sứ Đồ) tiếp tục có goal — reset XP, giữ cosmetics, tăng prestige badge.

### 11.2 Rules (verified `PrestigeService.java:22-79`)
- Điều kiện unlock: `tier == 6 (Sứ Đồ)` AND `days_at_tier6 ≥ 30` (constant `DAYS_REQUIRED = 30`) AND `prestige_level < MAX_PRESTIGE` (constant `MAX_PRESTIGE = 3`).
- User chủ động trigger qua UI.
- 3 prestige levels (badge keys `prestige_1/2/3`):
  | Level | Tên | Badge key |
  |---|---|---|
  | 1 | Vinh Quang Tái Sinh | `prestige_1` |
  | 2 | Vinh Quang Bất Diệt | `prestige_2` |
  | 3 | Vinh Quang Đời Đời | `prestige_3` |
- Hiệu ứng khi execute prestige:
  - Reset all-time XP về 0 → tier về 1.
  - `prestige_level += 1`.
  - Append `{level, at}` vào `prestige_at` JSON array.
  - GIỮ: cosmetics đã unlock, badges, journey progress.
- Prestige icon hiện cạnh tier badge ở Profile + Leaderboard.
- Sau level 3 (Vinh Quang Đời Đời) → `canPrestige = false` vĩnh viễn.

### 11.3 UI
`Profile` → khi đủ điều kiện hiện CTA "Prestige Reset" → modal confirm 2 bước.

---

## 12. Comeback Bridge

> **Source:** V25 `add_comeback_fields_to_users.sql`; `ComebackService`, `ComebackModal.tsx`; User fields `last_active_date`, `comeback_claimed_at`.

### 12.1 Mục đích
Reactivate user vắng lâu → giảm churn.

### 12.2 Rule (verified `ComebackService.java:39-114`)
- Threshold: `daysSinceLastPlay = now − user.last_active_date` (UTC). Nếu `< 3 ngày` → `rewardTier = NONE`, không trigger.
- 4 tiers thưởng theo gap:
  | daysSinceLastPlay | rewardTier | Reward (intent) |
  |---|---|---|
  | `≥ 3` | `XP_BOOST` | +50 XP one-shot |
  | `≥ 7` | `2X_XP_DAY` | ×2 XP trong 24h |
  | `≥ 14` | `RECOVERY_PACK` | ×2 XP + 50 energy + 1 streak freeze |
  | `≥ 30` | `STARTER_PACK` | ×2 XP 48h + 100 energy + reset progress hint |
- 1 lần claim / ngày: nếu `comebackClaimedAt.toLocalDate() == today` → block.
- Sau claim → set `comeback_claimed_at = now (UTC)`.
- `updateLastActive(userId)` được gọi sau mỗi meaningful action để reset gap.

### 12.3 UI
Modal `ComebackModal.tsx` xuất hiện trên Home sau login lần đầu sau gap.

### 12.4 Known Issue — xpMultiplier rewards là dead code
- `XP_BOOST +50 XP`, `2X_XP_DAY`, `RECOVERY_PACK`, `STARTER_PACK` xpMultiplier **chưa wire vào ScoringService** (TODO comment `ComebackService.java:117-126`). Reward type được persist nhưng score path không apply multiplier.
- Tracked: [BACKLOG.md](BACKLOG.md) BL-13.

---

## 13. Daily Mission

> **Source:** V23 `add_daily_mission_table.sql`; `DailyMissionService.java`; web `DailyMissionsCard.tsx`, `DailyMissionsWidget.tsx`.

### 13.1 Mục đích
3 micro-quest / ngày, scaled theo tier — keep daily engagement.

### 13.2 Generation
- Sinh đầu mỗi ngày (UTC) per user.
- Template theo tier (xem `DailyMissionService.MISSION_TEMPLATES`):
  - Tier 1: `answer_correct_3`, `complete_daily_challenge`, `answer_combo_3`.
  - Tier 2: `play_any_mode`, `correct_medium_5`, `ranked_score_60`.
  - Tier 3: `answer_correct_5`, `correct_hard_3`, `win_multiplayer_room`.
  - Tier 4: `correct_book_5`, `complete_speed_round`, `correct_hard_10`.
  - Tier 5–6: scale lên hard/multiplayer-heavy.

### 13.3 Reward
- Mỗi mission complete → **+50 XP** (`BONUS_XP = 50` `DailyMissionService:20`).
- Hoàn thành 3/3 → bonus card claim (UI `DailyMissionsCard`).

### 13.4 Schema
```sql
daily_missions (
  id, user_id, date, mission_type, config JSON,
  progress, target, completed, bonus_claimed, created_at
)
```

### 13.5 API + Progress tracking (verified `DailyMissionService.java:114-149`)
- `GET /api/daily-missions` — danh sách của user hôm nay (UserController.java:518 → `dailyMissionService.getMissionsResponse(userId)`).
- Progress update qua **explicit caller pattern** (KHÔNG phải @EventListener): mỗi service chủ động gọi `dailyMissionService.trackProgress(userId, missionType, increment)` sau khi user hoàn thành relevant action.
- Confirmed callers (grep `dailyMissionService.trackProgress`):
  - `DailyChallengeService.java:251` — sau khi complete daily challenge → `trackProgress(userId, "complete_daily_challenge", 1)`
  - (Other callers: SessionService, RoomQuizService, etc — when adding new mission_type, must add corresponding caller)
- Bonus auto-grant: khi all 3 missions completed → set `bonus_claimed=true` trên cả 3 rows + log `bonus 50 XP granted` (BONUS_XP constant). **Note:** XP addition itself happens trong scored session flow, không phải trong DailyMissionService — caller pattern.

---

## 14. Streak System

### 14.1 Daily streak
- `User.current_streak`, `User.longest_streak`.
- Tăng khi user trả lời ≥ 1 câu đúng trong ngày (UTC).
- Reset về 0 nếu skip ngày (trừ khi dùng Streak Freeze).

### 14.2 Streak Freeze
- Số lượng / tuần theo tier (3.3).
- Tự dùng khi sắp gãy. Reset Chủ Nhật.

### 14.3 Milestone rewards
| Streak | Reward |
|---|---|
| 3 ngày | +10% điểm ngày 3 |
| 7 ngày | Badge "Chuyên cần" + +15% điểm |
| 30 ngày | Badge "Trung Tín" + frame đặc biệt |
| 100 ngày | Badge "Kiên Nhẫn Như Gióp" + theme đặc biệt |

### 14.4 Notifications
- Streak warning khi còn < 2h trước khi gãy (V47 dedup notification ngừng spam).

---

## 15. Bookmarks

> **Source:** Entity `Bookmark` (V20 era); endpoints `/api/me/bookmarks`.

### 15.1 Mục đích
Save câu để ôn lại sau (đặc biệt câu sai có explanation hay).

### 15.2 Schema
```sql
bookmarks (id, user_id, question_id, created_at, UNIQUE(user_id, question_id))
```

### 15.3 API
| Method | Path |
|---|---|
| GET | `/api/me/bookmarks` |
| POST | `/api/me/bookmarks` body `{questionId}` |
| DELETE | `/api/me/bookmarks/{id}` |

### 15.4 UI
- Nút "🔖 Đánh dấu" trong wrong-answer panel + Review screen.
- `Profile` có tab Bookmarks → list + filter book.

---

## 16. Notifications

> **Source:** `NotificationService`, `NotificationController`, `NotificationPanel.tsx`.

### 16.1 Types
| Notification | Trigger | Default ON? |
|---|---|---|
| Streak warning | Hourly check, sắp gãy <2h | ✅ |
| Daily Challenge ready | 8:00 AM local | ✅ |
| Tier up celebration | Đạt tier mới | ✅ |
| Group invite | Được mời vào group | ✅ |
| Tournament start | 5 phút trước start | ✅ |
| Welcome new user | Sau signup | ✅ |
| Weekly summary | Monday 9:00 AM | ❌ |
| Comeback eligible | Sau 7 ngày vắng | ✅ |
| Mission complete | Hoàn thành 3/3 missions | ✅ |

### 16.2 API
| Method | Path |
|---|---|
| GET | `/api/notifications` |
| PUT | `/api/notifications/{id}/read` |

### 16.3 Settings
`Settings → Notifications` toggle từng type + quiet hours `[22:00] – [07:00]`.

### 16.4 Push (mobile)
- FCM token đăng ký qua `POST /api/me/devices` `{ fcmToken, platform }`.
- Trigger backend (`NotificationService`) bắn FCM cho event tương ứng.

---

## 17. Activity Feed + Daily Verse

### 17.1 Activity Feed

> **Source:** `components/ActivityFeed.tsx`, `LiveFeed.tsx`.

- Home page widget: ticker các action gần đây (của user + group + global).
- Items: "An vừa hoàn thành Sáng Thế Ký 80%", "Bui đạt tier Môn Đồ", "Chi vô địch Speed Race".
- Auto-refresh qua TanStack Query 30s.

### 17.2 Daily Verse banner

> **Source:** `components/DailyVerseBanner.tsx`, `DailyThemeService.java`.

- Banner đầu Home: 1 câu Kinh Thánh / ngày (BTTHĐ 2011).
- Rotation deterministic theo `dayOfYear`.
- Click → mở Practice mode focus chapter chứa verse đó.

---

## 18. Tutorial Overlay — ĐÃ GỠ (2026-07-11)

> **Removed 2026-07-11** (user request): tour spotlight lần đầu vào Home ("Đã hiểu!") gây confuse user mới → gỡ `components/TutorialOverlay.tsx` + flag `onboardingStore.hasDoneTutorial`. Onboarding flow đăng ký (§18.1) giữ nguyên; Home không còn overlay hướng dẫn.

### 18.1 Onboarding flow đầy đủ
1. Language Selection (vi/en)
2. Welcome Slides (3 screens swipe)
3. Try Quiz (3 câu KHÔNG cần login) — `GET /api/public/sample-questions`
4. Login (Google OAuth)
5. Home (không còn Tutorial Overlay)
6. Bình thường

---

## 19. Question Sets (user-created)

> **Source:** V35 `question_sets.sql` + V36 + V37 + V56 (Phase 1 metadata parity with group); entities `apps/api/src/main/java/com/biblequiz/modules/userquiz/entity/QuestionSet.java`, `QuestionSetItem`; web `apps/web/src/pages/MySets.tsx`, `apps/web/src/pages/PersonalQuizSetEditor.tsx` (wrapper) → `apps/web/src/pages/group/QuizSetEditor.tsx` (shared with group).

### 19.1 Phân biệt
- **Personal Question Set** (§19 này) — user tự tạo, riêng tư hoặc public, dùng cho Practice + Multiplayer host custom.
- **Group Quiz Set** — leader/mod tạo trong scope group (xem [SPEC_GROUP_v1.2.md](SPEC_GROUP_v1.2.md) §6).

### 19.2 Schema
```sql
question_sets (id, owner_id, name, visibility ENUM('PRIVATE','PUBLIC'), created_at,
               -- V56 Phase 1 metadata parity:
               cover_image_url, tags JSON, cover_scripture, author_note,
               difficulty ENUM, estimated_duration_min, suggested_mode, language,
               publish_status ENUM('DRAFT','PUBLISHED','ARCHIVED','SOFT_DELETED'),
               published_at)
question_set_items (id, question_set_id FK, question_id, order_index)
rooms.question_set_id  -- FK optional (V37 also adds group_quiz_set_id)
rooms.custom_question_ids JSON  -- V36, host inline custom list
```

### 19.3 UI (Phase 1+2, 2026-05-15)
- `/my-sets` — list user's sets + DRAFT/PUBLISHED chip; "Tạo bộ mới" navigates straight to the editor.
- `/my-sets/new` — auto-creates DRAFT then redirects to `/my-sets/:id/edit`.
- `/my-sets/:setId/edit` — shared `QuizSetEditor` with `ownership="personal"` + `aiEnabled`: rich metadata, DRAFT→PUBLISHED workflow (≥5 câu + name ≥3 ký tự), auto-save, **AI tạo nháp + AI viết lại** (share 200/day quota with group via `AIQuotaService`).
- `/my-sets/:setId` — legacy path, redirects into editor.

### 19.4 Use cases
- Practice: "Chơi với set" → load questions từ set.
- Multiplayer: Host create room → chọn `question_source = CUSTOM` + chọn set hoặc custom_question_ids. CreateRoom picker only lists `publish_status = PUBLISHED` sets (BL-19, PQS-8).

---

## 20. Achievements

> **Source:** Entities `Achievement`, `UserAchievement` (V2); `AchievementService`; web `pages/Achievements.tsx`.

### 20.1 Categories
- Streak (3/7/30/100 days)
- Book completion (per book + milestone groups Ngũ Thư / Phúc Âm / etc.)
- Multiplayer (first win, MVP × N, etc.)
- Tier (đạt mỗi tier)
- Prestige (each prestige level)
- Daily Challenge (perfect 5/5, 7-day streak)
- Special (seasonal events)

### 20.2 API
| Method | Path |
|---|---|
| GET | `/api/achievements` — all + unlocked status |

### 20.3 UI
Grid layout, locked = grayscale + lock icon. Click → modal hiện điều kiện + reward.

---

## 21. Profile & Stats

> **Source:** `pages/Profile.tsx`; `UserController GET /api/users/me`.

### 21.1 Sections
- Avatar + name + tier badge + frame (cosmetic) + prestige icon (nếu có).
- Stats grid: total points, current streak, longest streak, sessions played, accuracy %.
- Activity heatmap (12 tháng GitHub-style).
- Badges grid.
- Bible Journey progress (66 sách).
- Recent activity feed.
- Bookmarks tab.

### 21.2 Settings
`Settings`:
- Account (name, avatar, email read-only). Avatar mechanism (FE `EditProfileModal`, BE `PATCH /api/me`):
  - Source-of-truth column: `users.avatar_url VARCHAR(500)` — single text field. **KHÔNG cho upload file**, **KHÔNG cho nhập URL tự do** trong UI.
  - 3 sources, resolved client-side bằng `resolveAvatar(avatarUrl, name)`:
    1. **OAuth picture URL** — http(s) URL set bởi `OAuth2SuccessHandler` lần đầu user đăng nhập Google/Facebook. Surface as a dedicated "use account photo" tile trong preset grid.
    2. **Preset library** — value `preset:<id>` (xem `apps/web/src/data/avatars.ts`, 12 emoji-based options).
    3. **Initial fallback** — chữ cái đầu của display name, render bằng `font-verse` Cormorant Garamond italic màu `#e8a832` khi cả 2 nguồn trên đều vắng / không nhận diện được.
  - Email row hiển thị read-only với chip 🔒.
- Language (interface + quiz)
- Sound & Haptics
- Notifications (xem §16)
- Privacy (profile visibility, leaderboard visibility)
- Legal (Privacy Policy, Terms)
- Danger Zone (Delete account)
- About (version, build)

### 21.3 Delete account
- `DELETE /api/me/account` với confirm phrase "XÓA TÀI KHOẢN".
- FK cascade order: user_question_history → answers → quiz_sessions → group_members → tournament_participants → user_badges → user_streak → notifications → device_tokens → feedback → user.
- Apple App Store yêu cầu — không bỏ.

---

## 22. Leaderboard

> **Source:** `LeaderboardController`; web `pages/Leaderboard.tsx`.

### 22.1 Periods
| Endpoint | Scope | UI |
|---|---|---|
| `GET /api/leaderboard/daily` | Hôm nay (ICT) | **BE-only** (LBF-8) — không có tab |
| `GET /api/leaderboard/weekly` | Tuần này | ✅ tab "Hàng tuần" |
| `GET /api/leaderboard/monthly` | Tháng này | **BE-only** (LBF-8) — không có tab |
| `GET /api/leaderboard/all-time` | Toàn thời gian | ✅ tab "Tất cả" (mặc định) |
| `GET /api/leaderboard/season` | Mùa hiện tại (window-sum UDP) | **BE-only**, tab ẩn (LBF-9) |

> **LBF-8 (DECISIONS 2026-06-18):** FE chỉ surface 2 tab **all-time + weekly**. `daily`/`monthly` (+ `*/my-rank`) giữ live ở BE nhưng **chưa lên UI giai đoạn đầu** — board chu kỳ ngắn càng thưa, con số nhỏ phản tác dụng (xem `DECISIONS.md` 2026-06-18 "né con số" + LBF-11). KHÔNG xoá endpoint.

### 22.2 Season leaderboard — **tab thi đua ẩn giai đoạn đầu (LBF-9, DECISIONS 2026-06-18)**
- **Trạng thái:** tab "Mùa" trên `/leaderboard` + SeasonCard trên trang Ranked **ẩn** cho giai đoạn early-launch (board 3 tháng trùng lặp dữ liệu thưa của all-time + phơi con số yếu). Endpoint `GET /api/leaderboard/season` + `/api/seasons/active` giữ **ngủ** (không drop).
- **Thực tế code:** "mùa thi đua" = `SUM(points_counted)` của `UserDailyProgress` trong khoảng `[season.start, today]` (dùng lại `findWeeklyLeaderboard`). KHÔNG có ledger reset riêng / tier-season tách biệt / badge "Vinh Quang Mùa N" — các mục đó **chưa từng được build** (intent cũ, gỡ khỏi spec). Bảng `season_rankings` từng double-write nay ngừng ghi (LBF-13).
- **KHÔNG nhầm với "mùa phụng vụ"** (Liturgical Coverage §7.10.3 + ×1.5 focus bonus): đó là hệ riêng, flag-gated, vẫn giữ — xem §7.10.

### 22.3 Around-me (LBF-4 2026-06-18 — implemented)
`GET /api/leaderboard/around-me?period=weekly|all-time&radius=5` → `radius` người trên + bạn + `radius` dưới, mỗi row có `rank` tuyệt đối. Dùng lại board query (cùng tie-break §22.5) với `offset = rank - radius - 1`. Rỗng khi chưa đăng nhập / 0 điểm. FE: thay dòng sticky 1-dòng bằng cửa sổ này khi user ngoài top hiển thị (fallback về sticky nếu rỗng).

### 22.6 Privacy opt-out (LBF-5 2026-06-19)
- `users.leaderboard_visible` (V69, default TRUE). Toggle ở Profile → Quyền riêng tư ("Hiển thị tôi trên bảng xếp hạng") qua `PATCH /api/me { leaderboardVisible }`.
- Khi FALSE: user bị loại khỏi **cả hiển thị board lẫn đếm hạng** (6 native + 1 JPQL query filter `leaderboard_visible = TRUE`) → ẩn mình không làm xê dịch hạng người khác; vẫn tự xem được hạng riêng.
- `/api/public/leaderboard` (guest) KHÔNG trả `userId` (chống lộ UUID nội bộ).

### 22.4 UI widgets
- `LeaderboardRankWidget` — rank hiện tại trên Home.
- `LeaderboardSeasonWidget` — season standing.
- `EmptyLeaderboardCTA` — khi user chưa có điểm tuần.

### 22.5 Rank tie-break (LBF-1 2026-06-18)
- Bảng xếp hạng + `/my-rank` dùng CÙNG thứ tự 3 tầng: **points DESC → questions DESC → created_at ASC** (user hoạt động nhiều hơn xếp trên khi bằng điểm; created_at là tie-break tất định cuối).
- `/my-rank` = `countUsersAhead(points, questions, createdAt) + 1` — đếm đúng số người đứng trước theo cả 3 tầng, nên số hạng khớp vị trí thật trong bảng (trước đây chỉ đếm `points >` → lệch khi trùng điểm).

---

## 23. Tournaments

> **Source:** Entities `Tournament`, `TournamentParticipant`, `TournamentMatch`, `TournamentMatchParticipant`; `TournamentService`, `TournamentMatchService`; web pages `Tournaments.tsx`, `TournamentDetail.tsx`, `TournamentMatch.tsx`.

### 23.1 Unlock
Tier 4 (Hiền Triết) trở lên — xem §3.4.

### 23.2 Format
- Bracket elimination 4 / 8 / 16 / 32 người (power of 2).
- Mỗi match: 3 lives / người, sai → -1 life, hết lives → thua.

### 23.3 Seeding
- Group tournament → seed theo group leaderboard.
- Public tournament → seed theo all-time tier points.
- Bằng → random.

### 23.4 Bye rules
- Bye chỉ ở Round 1.
- Seed cao nhất bye trước.
- Min 4 người để start.

### 23.5 Tie-break — Sudden Death
Cùng logic mode Sudden Death (xem [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md) §3.4).

### 23.6 API
| Method | Path |
|---|---|
| POST | `/api/tournaments` |
| GET | `/api/tournaments/{id}` |
| POST | `/api/tournaments/{id}/join` |
| GET | `/api/tournaments/{id}/matches` |

---

## 24. Mobile App

> **Source:** `apps/mobile/`; React Native (Expo) + TypeScript strict.

### 24.1 Stack
- React Native (Expo)
- React Navigation: bottom tabs (5: Home / Quiz / Multiplayer / Groups / Profile) + stacks
- Zustand + TanStack Query (chia sẻ pattern với web)
- AsyncStorage thay localStorage
- expo-haptics, expo-av (sound)

### 24.2 Auth (mobile-specific)
| Method | Path | Body |
|---|---|---|
| POST | `/api/mobile/auth/google` | `{idToken}` (Google ID Token verification) |
| POST | `/api/mobile/auth/refresh` | `{refreshToken}` (no httpOnly cookie) |

Khác web: web dùng OAuth Authorization Code + httpOnly cookie; mobile dùng Google Sign-In SDK + raw refresh token trong body.

### 24.3 Code reuse từ web
| Layer | % reuse |
|---|---|
| Types/interfaces | 100% |
| Business logic (scoring, tiers, journey) | 100% |
| i18n files | 100% |
| Zustand stores | 90% (storage adapter) |
| API client | 90% |
| TanStack Query hooks | 80% |
| JSX markup | 0% (View/Text) |
| Styling | 0% (StyleSheet) |

### 24.4 Architecture
```
apps/mobile/src/
  logic/      — pure functions (scoring, streaks, tierProgression)
  hooks/      — custom hooks
  api/        — axios client
  stores/     — Zustand (authStore, onboardingStore, settingsStore)
  components/ — reusable UI
  screens/    — screen components
  navigation/ — RootNavigator → OnboardingNavigator / AuthNavigator / MainTabNavigator
  theme/      — colors, typography, spacing
  i18n/       — translations
```

### 24.5 Push notifications
Firebase Cloud Messaging (FCM). Đăng ký device token: `POST /api/me/devices`.

### 24.6 Deep links
```
prefixes: ['biblequiz://', 'https://forbible.org']
config:
  Main → DailyTab: 'daily'
  Main → GroupsTab → GroupDetail: 'groups/:id'
```

### 24.7 Parity gaps vs web (current)
| Feature | Status |
|---|---|
| Multiplayer realtime (STOMP) | 🚧 stub |
| Cosmetics page | ❌ missing |
| Tournament detail/match | 🚧 partial (chỉ bracket view) |
| Set Editor (`MySets`) | ❌ missing |
| Scheduled Quizzes (group) | ❌ missing |
| Variety modes UI prominence | ⚠️ less prominent than web |
| Admin panel | ❌ intentional |

→ Tracked trong [BACKLOG.md](BACKLOG.md) "Mobile parity".

---

## 25. i18n (vi/en)

> **Source:** `apps/web/src/i18n/{vi,en}.json`; mobile `apps/mobile/src/i18n/{vi,en}.json`.

### 25.1 Strategy
- Default vi.
- Detect browser language ở lần đầu, sau đó dùng user choice (lưu `localStorage.i18nextLng`).
- React: `react-i18next` + `i18next-browser-languagedetector`.

### 25.2 Quiz language vs UI language — TÁCH BIỆT
- `uiLanguage` (`i18nextLng`): tiếng giao diện.
- `quizLanguage` (`localStorage.quizLanguage`): tiếng câu hỏi (filter `WHERE language = ?`).

User có thể chọn UI English nhưng quiz tiếng Việt.

### 25.3 Question content
- `Question.language` (vi/en) là field độc lập trên row — VI và EN là 2 row riêng (deterministic UUID seed by hash including language).
- Default theo user setting.

### 25.4 Bible book names
`apps/web/src/data/bookNames.ts`:
```
BOOK_NAMES = { Genesis: { vi: "Sáng Thế Ký", en: "Genesis" }, ... 66 }
getBookName(bookKey, language)
```

### 25.5 Validator
`apps/web/scripts/validate-i18n.ts` chạy qua `npm run validate:i18n`.
- Fails nếu hardcoded Vietnamese xuất hiện trong source (ngoại trừ allowlist trong CLAUDE.md).
- Baseline: 116 hardcoded lines, 0 missing keys.
- Chạy trước mỗi commit (CI requirement).

### 25.6 Layout
EN ~20–30% dài hơn VN → test buttons không tràn, nav labels không cắt, mobile responsive.

---

## 26. WebSocket Events

> **Chi tiết tất cả events + R1–R5 lifecycle:** [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md) §5.

### 26.1 Connection
```
wss://be.forbible.org/ws  (STOMP over WS)
JWT qua query param: ?token=<accessToken>  (xem useWebSocket.ts:142-145)
```

### 26.2 Topics
- `/topic/room/{roomId}` — room broadcasts
- `/topic/tournament/{tournamentId}` — tournament events

### 26.3 Reliability
- Reconnect: exponential backoff (1s, 2s, 4s … max 30s).
- Heartbeat ping/pong 30s.
- Redis Pub/Sub fan-out multi-instance.

### 26.4 Outbound events (server → client) — sample
```
PLAYER_JOINED, PLAYER_READY, QUESTION_START, ANSWER_SUBMITTED,
SEQUENTIAL_PROGRESS, ROOM_ENDED { reason }, HOST_CHANGED,
HOST_GONE, ALL_DISCONNECTED, EMPTY_LOBBY, STUCK_GAME,
REACTION, CHAT
```

`ROOM_ENDED.reason ∈ {EMPTY_LOBBY, IDLE_TIMEOUT, HOST_GONE, ALL_DISCONNECTED, STUCK_GAME, GAME_COMPLETE}`.

### 26.5 Rate limits
| Event | Limit |
|---|---|
| `answer` | 1/câu/2s per user |
| `chat` | 10 msg/phút per user |
| `reaction` | 3/10s per user |
| `join` | 5/phút per user |
| `ready` | 3/phút per user |
| Total | 60/phút per connection → disconnect + ban 5 phút |

---

## 27. API Endpoints

> **Master inventory:** [AUDIT_INVENTORY.md](../audit/AUDIT_INVENTORY.md) §2.

### 27.1 Auth
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/exchange` | Public — OAuth code → tokens (httpOnly cookie) |
| POST | `/api/auth/refresh` | Cookie |
| POST | `/api/auth/logout` | Bearer |
| POST | `/api/mobile/auth/google` | Public — `{idToken}` |
| POST | `/api/mobile/auth/refresh` | Public — `{refreshToken}` |

### 27.2 User & Profile
| Method | Path |
|---|---|
| GET | `/api/users/me` |
| PUT | `/api/users/me` |
| GET | `/api/users/{id}` |
| GET | `/api/users/{id}/progress` |
| DELETE | `/api/me/account` |
| GET | `/api/me/bookmarks` |
| POST | `/api/me/bookmarks` |
| DELETE | `/api/me/bookmarks/{id}` |
| GET | `/api/me/devices` |
| POST | `/api/me/devices` |
| DELETE | `/api/me/devices/{token}` |
| GET | `/api/me/multiplayer-stats?period=weekly` | Weekly multiplayer aggregated stats (wins, totalMatches, winRate, mvpCount). Powers the Phòng Chơi sidebar "Tuần này" widget. Week boundary = Monday 00:00 system zone. See `apps/api/src/main/java/com/biblequiz/modules/user/service/MultiplayerStatsService.java`. |

### 27.3 Books & Questions
| Method | Path |
|---|---|
| GET | `/api/books` |
| GET | `/api/books/{id}/questions` |

### 27.4 Sessions (Practice + general quiz)
| Method | Path |
|---|---|
| POST | `/api/sessions` |
| GET | `/api/sessions/{id}` |
| POST | `/api/sessions/{id}/answer` |
| POST | `/api/sessions/{id}/lifeline/hint` |
| GET | `/api/sessions/{id}/lifeline/status` |

### 27.5 Ranked
| Method | Path |
|---|---|
| POST | `/api/ranked/session` |
| POST | `/api/ranked/answer` |
| POST | `/api/ranked/sync-progress` |
| GET | `/api/ranked/status` |
| GET | `/api/ranked/tier` |

### 27.6 Basic Quiz
| Method | Path |
|---|---|
| POST | `/api/basic-quiz` |
| GET | `/api/basic-quiz/{id}` |
| POST | `/api/basic-quiz/{id}/submit` |

### 27.7 Daily Challenge
| Method | Path |
|---|---|
| GET | `/api/daily-challenge` |
| POST | `/api/daily-challenge/complete` |

### 27.8 Variety modes
| Method | Path |
|---|---|
| GET | `/api/variety/seasonal` |
| GET | `/api/variety/mystery` |
| GET | `/api/variety/weekly` |
| GET | `/api/variety/speed` |

### 27.9 Daily Mission
| Method | Path |
|---|---|
| GET | `/api/daily-missions` |

### 27.10 Leaderboard
| Method | Path |
|---|---|
| GET | `/api/leaderboard/daily` |
| GET | `/api/leaderboard/weekly` |
| GET | `/api/leaderboard/monthly` |
| GET | `/api/leaderboard/all-time` |
| GET | `/api/leaderboard/season/{id}` |
| GET | `/api/leaderboard/around-me` |

### 27.11 Seasons
| Method | Path |
|---|---|
| GET | `/api/seasons` |
| GET | `/api/seasons/{id}` |
| GET | `/api/seasons/{id}/rankings` |

### 27.12 Achievements
| Method | Path |
|---|---|
| GET | `/api/achievements` |

### 27.13 Rooms (chi tiết → SPEC_MULTIPLAYER)
| Method | Path |
|---|---|
| POST | `/api/rooms` |
| POST | `/api/rooms/join` |
| GET | `/api/rooms/{id}` |
| GET | `/api/rooms/{id}/current-question` |
| GET | `/api/rooms/{id}/leaderboard` |
| POST | `/api/rooms/{id}/start` |
| POST | `/api/rooms/{id}/leave` |
| POST | `/api/rooms/{id}/switch-team` |
| POST | `/api/rooms/{id}/kick` |
| GET | `/api/rooms/public` |

### 27.14 Groups (chi tiết → SPEC_GROUP)
| Method | Path |
|---|---|
| POST | `/api/groups` |
| GET | `/api/groups/{id}` |
| POST | `/api/groups/{id}/members` |
| DELETE | `/api/groups/{id}/members/{memberId}` |
| POST | `/api/groups/{id}/live-rooms` |
| GET | `/api/groups/{id}/live-rooms` |
| GET | `/api/groups/{id}/leaderboard` |
| POST | `/api/groups/{id}/announcement` |

### 27.15 Scheduled quizzes
| Method | Path |
|---|---|
| POST | `/api/scheduled-quizzes` |
| GET | `/api/scheduled-quizzes` |
| POST | `/api/scheduled-quizzes/{id}/attempt` |

### 27.16 Tournaments
| Method | Path |
|---|---|
| POST | `/api/tournaments` |
| GET | `/api/tournaments/{id}` |
| POST | `/api/tournaments/{id}/join` |
| GET | `/api/tournaments/{id}/matches` |

### 27.17 Notifications
| Method | Path |
|---|---|
| GET | `/api/notifications` |
| PUT | `/api/notifications/{id}/read` |

### 27.18 Question Sets
Verified `QuestionSetController.java:22-33`:
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/question-sets` | Create new set |
| GET | `/api/question-sets` | My sets |
| GET | `/api/question-sets/public` | Public sets (browse) |
| GET | `/api/question-sets/{id}` | Get set with items |
| PUT | `/api/question-sets/{id}` | Update name/description |
| DELETE | `/api/question-sets/{id}` | Delete |
| PATCH | `/api/question-sets/{id}/visibility` | Toggle PUBLIC/PRIVATE |
| POST | `/api/question-sets/{id}/items` | Add question to set |
| DELETE | `/api/question-sets/{id}/items/{questionId}` | Remove question |
| PUT | `/api/question-sets/{id}/items` | Reorder / bulk replace |
| POST | `/api/question-sets/{id}/share` | Share (copy) to user by email |
| POST | `/api/question-sets/{id}/copy` | Copy PUBLIC set to own library |

### 27.19 Misc
| Method | Path |
|---|---|
| POST | `/api/feedback` |
| GET | `/api/feedback` |
| POST | `/api/share-cards` |
| GET | `/api/share-cards/{id}` |
| GET | `/api/health` |

---

## 28. Cross-references

| Concern | Spec |
|---|---|
| 5 Multiplayer modes + R1–R5 lifecycle + STOMP events | [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md) |
| Admin Test Panel, AI Generator, Question Quality, Notification Campaigns, ExportCenter, EarlyUnlock metrics, Group lock | [SPEC_ADMIN_v3.1.md](SPEC_ADMIN_v3.1.md) |
| Church Group (Q-A…Q-O locked decisions, Group Quiz Sets, Scheduled Quizzes, Kick logs, Reports, Group Analytics) | [SPEC_GROUP_v1.2.md](SPEC_GROUP_v1.2.md) |
| Future / non-shipped features (Friend, Premium, TV Host, Multi-leader, Seasonal UI theming, Offline full PWA) | [SPEC_ROADMAP.md](SPEC_ROADMAP.md) |
| Code gaps vs canonical | [BACKLOG.md](BACKLOG.md) |

---

## 29. Known Issues

> **Master list:** [BACKLOG.md](BACKLOG.md). High-impact gaps for this user spec:

| # | Topic | Canonical | Code reality | Tracked in |
|---|---|---|---|---|
| 1 | Bible version | BTTHĐ 2011 | Code uses BTT 1926 (public domain) | BACKLOG: "Migrate seed to BTTHĐ 2011" |
| 2 | Liturgical seasons | 4 mùa + ×1.5 | Chỉ 2/4 ship (Christmas, Easter); ×1.5 dead code | BACKLOG: "Ship Pentecost + Thanksgiving + wire ×1.5" |
| 3 | Milestone Burst (XP surge) — consume | ×1.5 trong 2h khi `xp_surge_until > now` | Wired 2026-05-13 (BL-3) — `RankedController.submitRankedAnswer` calls `calculateWithTier(..., xpSurgeActive)`; `/api/me/tier-progress` returns real surge state | ✓ DONE |
| 3b | Milestone Burst (XP surge) — auto-trigger | Backend tự set `xp_surge_until = now + 2h` khi cross 90% threshold | Chưa wire — admin set manual qua `xpSurgeHoursFromNow` test panel | BACKLOG: BL-3-trigger |
| 4 | Mode wording | "Luyện Tập" / "Đấu Hạng" (Q4) | Web uses "Leo Rank"; mobile uses "Thi Đấu" | BACKLOG: "Normalize i18n vi.json mode keys" |
| 5 | Group leaderboard scope (Q-A) | Chỉ tính group-play | `ChurchGroupService.getLeaderboard()` sums tất cả `UserDailyProgress` của member | BACKLOG: "Filter group leaderboard to group-play only" |
| 6 | Variety mode XP bonus (Mystery ×1.5, Speed ×2.0) | Wire vào ScoringService | Hiện chỉ là field DTO không consume | BACKLOG: cùng item với #3 |
| 7 | Mobile parity | Multiplayer realtime, Cosmetics, Set Editor, Scheduled Quizzes | 🚧 chưa ship | BACKLOG: "Mobile parity sprint" |

---

*Living spec — cập nhật theo sprint. Mọi thay đổi tier names / scoring formula / endpoint shape PHẢI cập nhật file này TRƯỚC khi merge code.*
