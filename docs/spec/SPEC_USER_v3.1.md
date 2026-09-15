# SPEC_USER v3.1 — User-Facing Spec

> **Last updated:** 2026-05-09
> **Replaces:** [SPEC_USER_v3.md](../../archive/SPEC_USER_v3.md) (archived 2026-05-09)
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
7. Smart Question Selection
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

> **RWP + Option C (2026-06-24):** Ranked dùng **draw lai (hybrid)** mỗi trận: ~**70% câu từ sách hành trình hiện tại** (`currentBook`) + ~**30% câu ngẫu nhiên toàn 66 sách** (đa dạng/ôn). Cả hai history-aware (unseen first) + cross-day exclude ~80 câu gần nhất (`UserQuestionHistory.lastSeenAt`). **Sách hành trình tiến** khi đã trả lời đủ **~25% câu distinct** của sách đó — `target = clamp(round(bookTotal×0.25), 12, 40)`, không quá tổng câu (sách nhỏ xem hết) → sang sách kế canon. Tỷ lệ (không cố định) để **tôn trọng sách giàu** (Thi Thiên/Phúc Âm ~40 câu) hơn thư tín ngắn (~12), hợp tinh thần dưỡng linh "đi xuyên Kinh Thánh" (~1600 câu ≈ 2.5–3 tháng). Gỡ 2 gate cũ: ≥50/session (dead — mỗi trận = session riêng reset 0) + 100-unique (không bao giờ đạt). `RANKED_CURRENT_BOOK_RATIO=0.7`; `RANKED_BOOK_SAMPLE_RATIO=0.25` floor 12 cap 40.

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

#### 5.1.1 Học Thuộc câu gốc (mode trong Luyện Tập)

> **Status:** Đợt 1 đang triển khai trên nhánh `feat/hoc-thuoc-cau-goc` — spec này merge cùng code. **Decision:** [DECISIONS.md](../../DECISIONS.md) 2026-09-15. **Task:** `docs/todo/active/2026-09-15-hoc-thuoc-cau-goc.md`.

Người dùng tự chọn câu/đoạn Kinh Thánh bất kỳ (BTTHĐ 2011, C4) vào **danh sách của tôi**, rồi ôn theo **lịch giãn cách**; mỗi lần ôn là một bài tập nhỏ có độ khó tăng theo mức thuộc.

| Field | Value |
|---|---|
| i18n namespace | `memorize.*` — VN "Học Thuộc", EN "Memorize" |
| Routes | `/practice/memorize` (danh sách) · `/practice/memorize/add` (chọn câu) · `/practice/memorize/session` (phiên ôn) |
| Auth | **bắt buộc** (guest thấy thẻ lối vào kèm nhắc đăng nhập) |
| Energy / XP / Leaderboard / Streak | **KHÔNG** — không tốn năng lượng, không cộng điểm, không xếp hạng |
| Bản dịch | `BTTHD2011`; toàn văn lưu bảng `bible_verses` (import gated `BIBLE_IMPORT_ENABLED`) |
| Đơn vị học | 1 câu hoặc 1 đoạn liền nhau **tối đa 5 câu** (`verseEnd - verseStart ≤ 4`); trùng đoạn → 409 |
| Lối vào | Thẻ "Học Thuộc câu gốc" trên `/practice` · thẻ "Câu gốc cần ôn hôm nay" trên Home, **chỉ hiện khi `dueCount > 0`** |

**Mức thuộc & lịch ôn** (`mastery_level` 0–5; câu mới thêm đến hạn ngay):

| Level | Bài tập (Đợt 1) | Đạt → ôn lại sau |
|---|---|---|
| 0 | Sắp xếp cụm lớn (3–4 chữ/cụm) | 1 ngày |
| 1 | Sắp xếp cụm nhỏ (2 chữ/cụm) | 2 ngày |
| 2 | Điền từ khuyết 25% | 4 ngày |
| 3 | Điền từ khuyết 50% | 7 ngày |
| 4 | Điền từ khuyết 75% | 14 ngày |
| 5 | Điền từ khuyết 100% | 30 ngày (giữ L5) |

- **Đạt** ở level L → `nextReviewAt = now + khoảng của L`, `level = min(L+1, 5)`.
- **Chưa đạt** → `level = max(L-1, 0)`; `nextReviewAt = now + 10 phút` nếu level mới = 0, ngược lại `now + 1 ngày`.
- Đạt: sắp xếp — sai ≤ 1 lần; điền khuyết — số lần sai ≤ max(1, 10% số ô). Chấm ở client; server chỉ nhận `passed` (không có phần thưởng → không cần chống khai khống).
- Phiên ôn: tối đa **10** câu đến hạn, cũ nhất trước. Mỗi câu: màn ngữ cảnh (đoạn ±2 câu, câu gốc tô đậm) → bài tập → hiện câu đầy đủ + đạt/chưa. Cuối phiên: tóm tắt số câu đã ôn / lên cấp, không điểm.
- Bài tập dùng **chạm-để-đặt** (không kéo thả). Điền khuyết: ngân hàng chữ = chữ bị ẩn + 2 chữ nhiễu từ đoạn xung quanh.
- Danh sách trống → gợi ý vài câu phổ biến để thêm nhanh (nội dung lấy từ API, không hardcode).

**Đợt sau (chưa shipped):** gõ chữ cái đầu (thay L4–5), nhớ địa chỉ câu, tìm theo từ khoá, quiz cùng chương, giải thích AI (nhãn "Do AI tóm tắt" + báo sai).

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

**Endpoints:**
- `GET /api/daily-challenge` — `{ date, questions[5], alreadyCompleted, globalStats }`.
- `POST /api/daily-challenge/complete` — body `{ score:0-10000, correctCount:0-5 }`. Idempotent same-day.

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

## 7. Smart Question Selection

### 7.1 Mục đích
Tránh user gặp lại câu cũ → giữ chân.

### 7.2 4-pool priority

> **Source:** `SmartQuestionSelector.java:36-76` + `UserQuestionHistory` table (V20).

| Pool | % default | Mô tả |
|---|---|---|
| 1 | 60% | Câu CHƯA gặp |
| 2 | 20% | Câu đã sai + quá hạn ôn (SRS) |
| 3 | 15% | Câu đã đúng nhưng > 30 ngày |
| 4 | fallback | Câu đã đúng gần đây |

### 7.3 Spaced Repetition

```
Đúng → next_review_at = now + (3, 6, 9, ...) ngày, max 30
Sai  → next_review_at = now + 1 ngày
```

### 7.4 Apply matrix

| Mode | Smart? |
|---|---|
| Practice | ✅ |
| Ranked | ✅ |
| Mystery | ✅ |
| Speed Round | ✅ |
| Daily Challenge | ❌ (random fair) |
| Multiplayer | ❌ (cùng câu cho cả room) |

### 7.5 Schema
```sql
user_question_history (
  user_id, question_id,
  times_seen, times_correct, times_wrong,
  last_seen_at, last_correct_at, last_wrong_at,
  next_review_at,
  UNIQUE(user_id, question_id)
)
```

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

> **Day boundary** — toàn bộ leaderboard window (daily/weekly/monthly/season) tính theo `Asia/Ho_Chi_Minh` (UTC+7) qua helper `GameClock.today()`. UDP writes (Ranked submit + Daily Challenge XP) cũng dùng cùng zone nên user chơi 06:00 ICT (= 23:00 UTC hôm trước) thấy điểm ghi vào "hôm nay". Lock 2026-05-23 (LBW-5).

| Endpoint | Scope | Window math |
|---|---|---|
| `GET /api/leaderboard/daily` | Hôm nay (ICT) | `today` |
| `GET /api/leaderboard/weekly` | Tuần này (ISO, T2→hôm nay ICT) | `weekStart(today) .. today` |
| `GET /api/leaderboard/monthly` | Tháng này | `today.withDayOfMonth(1) .. today` |
| `GET /api/leaderboard/all-time` | Toàn thời gian | — |
| `GET /api/leaderboard/season/{seasonId}` | Mùa hiện tại / chỉ định | `season.startDate .. min(today, season.endDate)` |

**Weekly = ISO calendar week** (Monday → Sunday), reset vào thứ Hai 00:00 ICT (LBW-6 decision 2026-05-23). Trước đó là rolling 7-day không bao giờ visible reset — bị bỏ vì không khớp cảm nhận "tuần này" của user VN.

**Zero-point filter** (LBW-1, 2026-05-23): leaderboard chỉ surface users có ≥1 điểm trong window. User chơi Practice/Single (chỉ ghi `questionsCounted`, không ghi `pointsCounted`) sẽ KHÔNG xuất hiện trong list — tránh pad bảng bằng user 0 điểm.

**Cache TTL**: 60s (LBW-4, 2026-05-23). Writers (RankedController submit + DailyChallengeService creditCompletionXp) gọi `CacheService.invalidateLeaderboards()` ngay sau khi ghi điểm để user không thấy stale rank.

### 22.2 Season leaderboard
- Mùa = 3 tháng (4 mùa / năm) — entity `Season` (V7).
- Reset điểm season về 0 đầu mỗi mùa; tier season tách biệt tier all-time.
- Top 3 mỗi tier nhận badge "Vinh Quang Mùa N".

### 22.3 Around-me
`GET /api/leaderboard/around-me` → 5 trên + bạn + 5 dưới.

### 22.4 UI widgets
- `LeaderboardRankWidget` — rank hiện tại trên Home.
- `LeaderboardSeasonWidget` — season standing.
- `EmptyLeaderboardCTA` — khi user chưa có điểm tuần.

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

### 27.20 Bible text & Học Thuộc (§5.1.1)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/bible/passage?book&chapter&from&to` | `{version, book, chapter, verses:[{verse,text}]}`; `to - from ≤ 29`; 404 nếu không có |
| GET | `/api/me/memory-verses` | `{items:[{id, book, chapter, verseStart, verseEnd, text, masteryLevel, nextReviewAt, due}], dueCount}` |
| GET | `/api/me/memory-verses/due` | Tối đa 10 item đến hạn (cùng shape) |
| GET | `/api/me/memory-verses/due-count` | `{dueCount}` |
| POST | `/api/me/memory-verses` | Body `{book, chapter, verseStart, verseEnd}` → 201 item · 400 range/không tồn tại · 409 trùng |
| DELETE | `/api/me/memory-verses/{id}` | 204 · 404 nếu không phải của mình |
| POST | `/api/me/memory-verses/{id}/review` | Body `{exerciseType, passed}` → item đã cập nhật |

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
