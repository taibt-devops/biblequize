# BACKLOG — Code Gaps vs Canonical Spec

**Last updated:** 2026-05-20
**Purpose:** Mọi điểm code chưa khớp canonical spec (SPEC_USER_v3.1 / SPEC_ADMIN_v3.1 / SPEC_GROUP_v1.2 / SPEC_MULTIPLAYER) hoặc tech debt cần fix.

> **Quy tắc:** Mỗi item có ID `BL-N`, status, owner placeholder, references. Khi fix xong → đánh ✅ DONE + ghi commit hash + xoá item sau 1 sprint.

---

## Critical (chặn user-visible feature parity với spec)

### BL-1 — Bible version: BTT 1926 → BTTHĐ 2011
- **Spec canonical (Q1):** BTTHĐ 2011 (Bản Truyền Thống Hiệu Đính 2011).
- **Code reality:** Seed comments + question text dùng BTT 1926 (public domain).
- **Cần làm:**
  - Thẩm định license cho BTTHĐ 2011 (có cần permission từ UBS/Vietnamese Bible Society?)
  - Re-seed `apps/api/src/main/resources/seed/questions/*_quiz*.json` với verse text BTTHĐ 2011
  - Update `scripts/sql_to_json.py` reference table nếu cần
  - Audit: ~664 câu hỏi cần check (xem CLAUDE.md Question Seeding)
- **Học Thuộc (2026-09-15):** toàn văn `bible_verses` đang là BTT 1926 (`BibleVerse.ACTIVE_VERSION`, nguồn eBible `vie1934` public domain — DECISIONS 2026-09-15). Khi có BTTHĐ 2011: nạp seed `seed/bible/btthd2011/`, đổi `ACTIVE_VERSION`, và quyết cách chuyển `user_memory_verses` đang lưu `version = 'BTT1926'`.
- **Status:** ⬜ TODO
- **Ref:** AUDIT_SUMMARY Q1, AUDIT_CONSTRAINTS C4

### BL-2 — Q-A scoring: filter group leaderboard by source
- **Status:** 🪦 SUPERSEDED by BL-16 (2026-06-22). The group leaderboard endpoint was retired (410 Gone) instead of fixed — the score-source drift it described is gone with the deleted `getLeaderboard`. Building the proposed `source` ENUM + migration + backfill on the hot `UserDailyProgress` table for a 0-caller endpoint was wasted work (verified: web + mobile have no callers; Collective Growth §18 replaced the social signal in GD-1).
- ~~**Spec canonical (Q2):** Group leaderboard chỉ cộng điểm từ group-room + scheduled-quiz~~ — moot: no leaderboard.
- **Ref:** BL-16 (resolution), SPEC_GROUP §10 (RETIRED), AUDIT_SUMMARY Q2.

### BL-3 — Wire XP Surge bonus (Milestone Burst) — Consume
- **Spec canonical (Q5):** Khi `user.xp_surge_until > now`, mọi điểm Ranked × 1.5.
- **Wired 2026-05-13** (commit on `chore/code-quality-improvements`):
  - `RankedController.submitRankedAnswer` calls `scoringService.calculateWithTier(..., tierLevel, xpSurgeActive)` per [SPEC_USER §4.6](SPEC_USER_v3.1.md) formula. Both tier multiplier AND surge multiplier now applied.
  - `GET /api/me/tier-progress` returns honest `surgeActive` / `surgeUntil` / `surgeMultiplier` (Bui 2026-05-02 honesty contract relaxed). FE `MilestoneBanner.SurgeCountdown` shows real countdown.
  - Unit tests: `RankedControllerTest` 43/43 pass with new stub signature; `UserControllerTest` 16/16 pass with two surge-state cases.
  - **Side effect:** Tier 2-6 user điểm tăng theo `TierRewardsConfig` (1.1× → 2.0×) lần đầu kể từ V24. Leaderboard mid-season sẽ shift cho high-tier users.
- **Status:** ✅ DONE
- **Ref:** AUDIT_SUMMARY Q5, AUDIT_UNDOCUMENTED feature 2

### BL-3-trigger — XP Surge auto-trigger (Milestone Burst)
- **Spec canonical (Q5):** Khi user cross 90% tier progress lần đầu trong tier → backend set `xp_surge_until = now + 2h`, fire notification.
- **Code reality (sau BL-3 consume wired):**
  - Consume path đã hoạt động — admin có thể test bằng `xpSurgeHoursFromNow` ([SPEC_ADMIN §622](SPEC_ADMIN_v3.1.md))
  - Auto-trigger từ user gameplay vẫn dead — `TierProgressService` không có 90% threshold detection
- **Cần làm:**
  - `TierProgressService` thêm helper detect cross 90% threshold lần đầu trong tier
  - Khi cross → `userRepository.save(user.setXpSurgeUntil(now + 2h))`, fire `NotificationService` event
  - Edge case: nếu user đã có `xpSurgeUntil > now` (active) → KHÔNG re-trigger (1 lần/tier)
  - Reset on tier-up: khi user lên tier mới, reset surge flag eligibility
  - Unit test cho threshold detection + edge cases
- **Status:** ⬜ TODO
- **Ref:** Spinoff từ BL-3 consume wire 2026-05-13

### BL-4 — i18n wording normalize: "Đấu Hạng"
- **Spec canonical (Q4):** Mode names = "Luyện Tập" + "Đấu Hạng" (Vietnamese-only).
- **Code reality (không nhất quán):**
  - ~~`apps/web/src/i18n/vi.json:37-38` — "Luyện tập" (l thường) + "Leo Rank"~~ → **2026-05-13 web fix**: line 37 → "Luyện Tập", line 38 → "Đấu Hạng"
  - ~~`apps/mobile/src/i18n/vi.json:63-65` — "Luyện Tập" + "Thi Đấu"~~ → **2026-05-18 S0-4 fix**: line 65 → "Đấu Hạng" + ranked.title (line 114) "Thi Đấu Xếp Hạng" → "Đấu Hạng" + ranked.start "Vào Thi Đấu" → "Vào Đấu Hạng"
  - ~~Một số string khác trong vi.json dùng "Thi Đấu Xếp Hạng" trực tiếp~~ → **2026-05-13 web fix**: replace_all "Thi Đấu Xếp Hạng" → "Đấu Hạng" (passUnlock, rankedHeader, unlockHeader, ranked.title + ~6 FAQ sentences). 1 test updated (`Ranked.test.tsx:117`).
- **Cần làm:**
  - ✅ `apps/web/src/i18n/vi.json`: "Leo Rank" → "Đấu Hạng" + "Luyện tập" → "Luyện Tập" + "Thi Đấu Xếp Hạng" → "Đấu Hạng" (DONE 2026-05-13)
  - ✅ `apps/mobile/src/i18n/vi.json`: "Thi Đấu" → "Đấu Hạng" + ranked.title + ranked.start (DONE 2026-05-18 S0-4)
  - ⬜ Re-run `cd apps/web && npm run validate:i18n` (chạy 2026-05-13 — count 1002 hardcoded / 16 missing keys; pre-existing debt, không tăng từ BL-4)
  - Update unit tests assert text mới — web 1 test done; mobile N/A (no test asserting old "Thi Đấu" string)
- **Status:** ✅ DONE (web 2026-05-13, mobile 2026-05-18 S0-4 via packages/shared/constants/modes.ts CORE_MODE_LABELS_VI)
- **Ref:** AUDIT_SUMMARY Q4 · prereq cho HR-4 HeroRankedCard 2026-05-13

### BL-5 — Liturgical Seasons: ship 2 mùa thiếu + wire ×1.5 bonus
- **Spec canonical (Q3):** 4 mùa Liturgical (Phục Sinh / Ngũ Tuần / Cảm Tạ / Giáng Sinh) + ×1.5 bonus trong Ranked + Daily Challenge.
- **Code reality:**
  - `VarietyQuizController.java:184-212` chỉ detect Christmas (Dec 1-25) + Easter (Mar + Apr 1-20)
  - Pentecost (Ngũ Tuần T5-7) — KHÔNG có
  - Thanksgiving (Cảm Tạ T8-10) — KHÔNG có
  - ×1.5 multiplier — dead code (controller comment `:24-43` nói "no XP, no leaderboard")
- **Cần làm:**
  - Thêm date detection cho Pentecost (May-July) + Thanksgiving (Aug-Oct)
  - Mỗi mùa: define books filter + description (consult với product/team về books relevant)
  - Wire ×1.5 trong `ScoringService` khi season active + question tagged seasonal
  - Add `seasonal_tag` column vào questions (hoặc seasonal_books config map)
  - Unit test (mock date trong từng mùa)
- **Status:** ⬜ TODO (large — chia 3 sub-tasks: detection, books config, scoring wire)
- **Ref:** AUDIT_SUMMARY Q3, AUDIT_CONSTRAINTS C3, SPEC_USER_v3.1 §5.6, SPEC_ROADMAP §2.3

---

## High (cleanup — small but visible)

### BL-6 — Drop CANCELLED Room status (deprecated per C7)
- **Code reality:**
  - `Room.java:93` enum value `CANCELLED` defined
  - `RoomPresenceListener.java:140` defensive check `status == CANCELLED || status == ENDED`
  - `setStatus(CANCELLED)` — 0 hits trong code
- **Cần làm:**
  - Migration V?: nếu có row nào status='CANCELLED' → update thành 'ENDED' (chắc không có nhưng safety)
  - Remove enum value khỏi `Room.RoomStatus`
  - Remove defensive checks (chỉ còn `== ENDED`)
  - Update specs/docs nếu còn mention
- **Status:** ⬜ TODO
- **Ref:** SPEC_MULTIPLAYER §2.2, AUDIT_CONSTRAINTS C7

### BL-7 — Sentry: remove placeholder mentions
- **Spec canonical (Q6):** Sentry chưa ship → KHÔNG document trong current spec; move to ROADMAP.
- **Code reality:**
  - `apps/web/package.json` — không có `@sentry/*`
  - `apps/api/pom.xml` — không có `sentry-spring-boot`
  - Spec_user_v3 cũ + 2 prompt files mention Sentry
- **Cần làm:**
  - Đã làm (Phase 2): SPEC_USER_v3.1.md không nhắc Sentry, đã đưa vào SPEC_ROADMAP.md §2.9
  - Cleanup: prompt files (`docs/prompts/release-readiness-verify-and-plan.md`, `archive/PROMPT_*.md`) — archive, không cần update
- **Status:** ✅ DONE (xử lý trong Phase 2 spec rewrite)

---

## Medium (tech debt)

### BL-8 — i18n hardcoded VN strings (baseline 116 lines)
- **Source:** CLAUDE.md i18n Coverage section
- **Status:** Tracked, chưa close.
- **Validator:** `cd apps/web && npm run validate:i18n` (fails CI nếu count tăng)
- **Accepted debt** (không count):
  - data/verses.ts (30 lines) — Bible verse content
  - PrivacyPolicy + TermsOfService (57 lines) — bilingual via isVi ternary
  - LandingPage (10 lines) — marketing copy
  - AIQuestionGenerator DEFAULT_PROMPT (8 lines) — literal AI prompt
  - Mock sample data (11 lines) — placeholder
- **Action:** Khi PR mới chạm các file ngoài accepted-debt list → phải dùng `t()`.

### BL-9 — Verify TanStack Query coverage in admin pages
- **Status:** TanStack Query confirmed shipped (web ^5.56.2, mobile ^5.96.2, 71 web files use it). Audit phát hiện ít nhất 70+ files use `@tanstack/react-query`. Admin Dashboard.tsx confirmed dùng.
- **Action:** Spec đã document. Nếu phát hiện admin page mới dùng `useEffect + fetch` thủ công → fix theo CLAUDE.md Frontend rules.

### BL-10 — AI Question Generator: verify quota + provider
- **Spec claim:** 200/day quota, 3-layer dedup, draft approval, batch explanations.
- **Code:** `AIQuestionGenerator.tsx` + `AIGenerationService` exist; quota field NOT verified deeply.
- **Action:** Đọc kỹ `AIGenerationService` — confirm:
  - AI provider (Gemini? OpenAI? — `GEMINI_API_KEY` mention trong CLAUDE.md hint là Gemini cho translation script; GenAI cho question gen có thể khác)
  - Daily quota implementation (DB column? Config?)
  - 3-layer dedup actually wired
- **Status:** ⬜ TODO (verify-then-spec-update)
- **Ref:** SPEC_ADMIN_v3.1 §7

---

## Lower priority

### BL-11 — Mobile feature parity gaps vs web
| Gap | Where | Notes |
|---|---|---|
| ~~Multiplayer realtime (STOMP)~~ ✅ | `apps/mobile/src/screens/multiplayer/` + `components/multiplayer/` | **2026-05-19 S1+S3 fully wired**: useStomp + RoomWaiting + MultiplayerQuiz (timer + haptic + combo) + Results + TournamentBracket + 3 mode overlays (EliminationOverlay BR, TeamScoreBar TVT, MatchResultOverlay SD) + ChatOverlay + ReactionBar (6 emojis) + Quản trò RoomQuizHostScreen (5 controls) + RoomAnalyticsScreen. |
| Cosmetics page | ✅ | **2026-05-19 S6 shipped**: CosmeticsScreen (2 sections Khung Avatar + Theme, 3-col grid, tier-tinted icons, gold ring active, 🔒 locked với Alert "Lên hạng để mở khoá"). Wired GET/PATCH /api/me/cosmetics. |
| Tournament match scoring detail | ✅ | **2026-05-19 S5 shipped**: TournamentDetailScreen (hero + join/start CTAs + status badge) + TournamentMatchScreen (VS layout, 3 hearts, forfeit). Real-time match gameplay defer (BE flow TBD). |
| SetEditor (personal MVP) | ✅ | **2026-05-19 S4 shipped**: MySets + PersonalQuizSetEditor (metadata 6 fields + manual save + publish workflow) + QuestionEditor sub-screen (4 options + difficulty + book/chapter) + QuizSetDetail read-only + GroupQuizSetList. AI gen + auto-save + group editor + folder mgmt + visibility toggle defer S6+. |
| Scheduled quizzes | ✅ | **2026-05-19 S5 shipped**: ScheduledQuizList (status filter) + Create (leader/mod form với quiz set picker) + Detail (status banner + my stats + leaderboard 30s poll) + Play (question carousel + submit + result). Native date picker + push notif defer. |
| GroupAnalytics | ✅ | **2026-05-19 S5 shipped**: GroupAnalyticsScreen (4-stat grid + weekly 7-bar chart + top contributors). GD-2 rule: hide charts khi group <7 ngày. |
| GROUP_LIVE_SEQUENTIAL per-player reveal | none | Defer S6+ |

- **Action:** Discuss với product timeline cho mobile parity.

### BL-12 — Group Leaderboard endpoint test for Q-A fix
- **Status:** 🪦 SUPERSEDED by BL-16 (2026-06-22) — depended on BL-2. No leaderboard to test; the endpoint now returns 410 (covered by `ChurchGroupControllerTest.getLeaderboard_isRetired_returns410WithDeprecatedCode`).
- ~~**Phụ thuộc:** BL-2 · **Action:** E2E test group-play-only scoring.~~

---

## Added 2026-05-09 (Phase 2 spec refinement)

### BL-13 — Comeback Bridge: wire xpMultiplier rewards
- **Spec:** [SPEC_USER_v3.1.md §12.4](SPEC_USER_v3.1.md)
- **Code:** `ComebackService.java:117-126` TODO comment xác nhận: rewardTier persists vào DB nhưng `XP_BOOST +50 XP`, `2X_XP_DAY`, `RECOVERY_PACK`, `STARTER_PACK` xpMultiplier KHÔNG wire ScoringService.
- **Cần làm:** (giống pattern BL-3 XP surge)
  - Thêm `User.comeback_active_until` (nullable LocalDateTime) — khi claim → set tùy theo tier (XP_BOOST=instant, 2X_XP_DAY=24h, RECOVERY_PACK=24h+freeze, STARTER_PACK=48h)
  - `ScoringService.calculateScore()`: nếu `now < comeback_active_until` → multiply × `comebackMultiplier`
  - XP_BOOST one-shot +50 → call `dailyProgress.addBonusPoints(50)` ngay khi claim
  - Migration mới (V49 hoặc gộp với BL-3)
  - Unit test
- **Status:** ⬜ TODO

### BL-14 — Sequential Mode: host "Skip idle player" button
- **Spec:** [SPEC_MULTIPLAYER.md §3.5 Edge cases / Appendix B MP-6](SPEC_MULTIPLAYER.md)
- **Code:** `SequentialScoringService.java:27` — hiện 10 phút timeout buộc 9 player đợi nếu 1 idle.
- **Cần làm:**
  - Add STOMP handler `/room/{roomId}/skip-player { userId }` — host-only check
  - Mark target player as ABSENT cho round hiện tại; đếm tiếp như đã trả lời sai
  - UI button "Bỏ qua" trong RoomQuiz Sequential variant — show after 30s nếu player chưa answer
  - Broadcast `PLAYER_SKIPPED { userId }`
  - Unit test
- **Status:** ⬜ TODO

### BL-15 — Deprecate `useWebSocket.ts` (legacy raw WS hook)
- **Spec:** [SPEC_MULTIPLAYER.md §5.1 + Appendix B MP-7](SPEC_MULTIPLAYER.md)
- **Closed 2026-05-13** (CQ-3, commit on `chore/code-quality-improvements`):
  - `grep "useWebSocket" apps/web/src` → 0 production callers (only the hook's own test file referenced it).
  - Migration was already done previously — Rooms use `useStomp.ts` (STOMP CONNECT header) for all WebSocket needs.
  - Deleted `apps/web/src/hooks/useWebSocket.ts` (285 LOC) + `apps/web/src/hooks/__tests__/useWebSocket.test.ts` (256 LOC, 15 tests).
  - CLAUDE.md §Known Issues "Critical" row removed.
- **Status:** ✅ DONE

### BL-AD-1 — AI Quota: persist via Redis sorted-set
- **Spec:** [SPEC_ADMIN_v3.1.md §20.1 AD-1](SPEC_ADMIN_v3.1.md)
- **Code:** `AIAdminController.java:38-45` in-memory `ConcurrentHashMap<adminId, AtomicInteger>` — restart mất count.
- **Cần làm:** Redis key `ai:quota:{adminId}:{YYYY-MM-DD}` ZINCRBY 1 cho mỗi request; TTL 48h tự cleanup. Check trước khi generate.
- **Status:** ⬜ TODO

### BL-AD-2 — Configuration: build `app_config` table + admin CRUD
- **Spec:** [SPEC_ADMIN_v3.1.md §13 + §20.1 AD-2](SPEC_ADMIN_v3.1.md)
- **Cần làm:** Migration V?: `app_config(key VARCHAR PK, value TEXT, value_type ENUM, updated_by FK, updated_at)`. `AdminConfigController` GET/PUT. `ConfigService` với Caffeine 5min cache. Sample keys: `biblequiz.room.idle-timeout-minutes`, `biblequiz.room.ended-retention-hours`, `biblequiz.room.reconnect-grace-seconds`, `biblequiz.ai.daily-quota`, etc.
- **Status:** ⬜ TODO

### BL-AD-3 — Notification broadcast: lightweight campaign system
- **Spec:** [SPEC_ADMIN_v3.1.md §12 + §20.1 AD-3](SPEC_ADMIN_v3.1.md)
- **Cần làm:** Migration V?: `notification_campaigns(id, target_audience JSON, content TEXT, sent_count INT, opened_count INT, sent_by FK, sent_at)`. Endpoint `POST /api/admin/notifications/broadcast`. Spawn batch insert vào `notifications` table. Track `opened` qua existing `read_at`.
- **Status:** ⬜ TODO

### BL-AD-4 — Audit log: standardize via `AuditEventService.record(...)`
- **Spec:** [SPEC_ADMIN_v3.1.md §14 + §20.1 AD-4](SPEC_ADMIN_v3.1.md)
- **Cần làm:** Tạo `AuditEventService.record(actorId, action, targetType, targetId, before JSON, after JSON, metadata JSON)` — write `audit_events` (V4 table). Wire từ mọi admin write controller (ban user, lock group, edit question, end season, etc.).
- **Status:** ⬜ TODO

### BL-AD-5 — Question soft delete (30-day retention)
- **Spec:** [SPEC_ADMIN_v3.1.md §5 + §20.1 AD-5](SPEC_ADMIN_v3.1.md)
- **Cần làm:** Migration V?: `questions.deleted_at` nullable. `DELETE` admin endpoint set `deleted_at = now`. Active queries filter `WHERE deleted_at IS NULL`. Cron purge sau 30 days. Admin Trash tab cho restore.
- **Status:** ⬜ TODO

### BL-AD-6 — CONTENT_MOD UI label switch in AdminLayout
- **Spec:** [SPEC_ADMIN_v3.1.md §20.1 AD-6](SPEC_ADMIN_v3.1.md)
- **Cần làm:** `AdminLayout.tsx` — đọc `useAuthStore` user.role, render header text "Moderation Dashboard" vs "Admin Panel". Hide sidebar items: Configuration / Test Panel / Notifications campaign nếu role = CONTENT_MOD. Unit test cả 2 roles.
- **Status:** ⬜ TODO

### BL-16 — Group leaderboard endpoint `410 Gone` (Q-A sunset)
- **Spec:** [SPEC_GROUP_v1.3.md §10 (DEPRECATED in v1.4 changelog)](SPEC_GROUP_v1.3.md)
- **Code:** `ChurchGroupController.java:272 getLeaderboard(...)` + `ChurchGroupService.getLeaderboard(...)` — backend query still sums `UserDailyProgressRepository` (Q-A drift: counts solo/ranked/daily activity, not group-play-only).
- **Cần làm:**
  - ~~keep endpoint `200 OK` for ~2 sprints (mobile compat). Then `410 Gone`.~~
  - ~~drop `ChurchGroupService.getLeaderboard`; remove FE callers.~~
- **Status:** ✅ DONE (2026-06-22). Verified web + mobile = 0 callers (compat window from GD-1 2026-05-10 long elapsed). `GET /api/groups/{id}/leaderboard` → `410 Gone` `{ code:"LEADERBOARD_DEPRECATED" }`; `ChurchGroupService.getLeaderboard` deleted (shared `udpRepository` queries left intact — used by analytics/streak). Test `ChurchGroupControllerTest.getLeaderboard_isRetired_returns410WithDeprecatedCode`. Supersedes BL-2 + BL-12. SPEC_GROUP §10 → RETIRED + v1.6.1 changelog.
- **Cause:** GD-1 / 2026-05-10 leaderboard sunset

### BL-17 — Group Activity Feed (Sprint 6)
- **Spec:** [SPEC_GROUP_v1.3.md §12 (NEW in v1.4 changelog)](SPEC_GROUP_v1.3.md)
- **Code:** `apps/web/src/components/group/ActivityFeedPlaceholder.tsx` is the placeholder shipped GD-1; replace with real feed.
- **Cần làm:**
  - Migration V53: `group_activity (id UUID PK, group_id FK, actor_id FK, type ENUM, metadata JSONB, created_at TIMESTAMP, INDEX (group_id, created_at DESC))`
  - Recorder: `GroupActivityService.record(group, actor, type, metadata)` called from QuizSetMasteryService (MASTERY_COMPLETED), GroupQuizSetService (QUIZ_SET_CREATED), RoomService (LIVE_ROOM_STARTED/ENDED), GroupAnnouncementService (ANNOUNCEMENT_POSTED), ChurchGroupService (MEMBER_JOINED/LEFT), ScheduledQuizService (SCHEDULED_QUIZ_CREATED).
  - API: `GET /api/groups/{id}/activity?type=&limit=20&before=<ISO>` (paginated by created_at).
  - FE: replace ActivityFeedPlaceholder with paginated list + 30s refetchInterval (future: STOMP push).
  - Retention: delete > 90 days nightly cron.
- **Status:** ⬜ DEFER Sprint 6
- **Cause:** GD-1 / 2026-05-10 (placeholder shipped, real feed deferred)

### BL-18 — Cell Group Pulse heuristic (Sprint 6, leader-only)
- **Spec:** [SPEC_GROUP_v1.3.md §13 (NEW in v1.4 changelog)](SPEC_GROUP_v1.3.md)
- **Code:** `apps/web/src/components/group/CellGroupPulseCard.tsx` is the placeholder shipped GD-9; wire backend.
- **Cần làm:**
  - Migration V54: `group_pulse_snapshot (id UUID PK, group_id FK, snapshot_date DATE, score DECIMAL(3,2), status ENUM(STRONG,MEDIUM,WEAK), active_ratio DECIMAL, live_rooms_per_week INT, new_content_per_week INT, UNIQUE (group_id, snapshot_date))`
  - Heuristic: `score = activeRatio×0.5 + min(1, liveRoomsPerWeek/2)×0.3 + min(1, newContentPerWeek/1)×0.2`. Status STRONG ≥0.7, MEDIUM 0.4–0.7, WEAK <0.4. Expectations configurable per group (`expectedLiveRooms`, `expectedContent`).
  - Cron: `@Scheduled(cron = "0 0 1 * * *")` daily 1am — compute snapshots for all groups.
  - API: `GET /api/groups/{id}/pulse` — leader/mod-only (`@PreAuthorize`); returns latest snapshot + 7-day trend for sparkline.
  - FE: replace CellGroupPulseCard placeholder with real strong/medium/weak banner + sparkline mini-chart.
- **Status:** ⬜ DEFER Sprint 6
- **Cause:** GD-9 / 2026-05-10 (placeholder shipped, heuristic deferred)

---

## Done (recent — keep until next sprint review)

| ID | Item | Commit |
|---|---|---|
| (Pre-Phase 2) | Idle-lobby threshold unification (G4, G8) | 1f40e6a |
| (Pre-Phase 2) | RoomAbandonmentScheduler stuck recovery (R5, G1) | 7a43b0f |
| (Pre-Phase 2) | Purge ENDED rooms 24h (R3) | a1a8620 |
| (Pre-Phase 2) | Rehydrate current question for mid-game rejoiners | 0e65bd9 |
| (Pre-Phase 2) | Broadcast ROOM_ENDED with reason from all cleanup paths (G5) | 5aef216 |
| BL-7 | Sentry: remove from current specs | Phase 2 spec rewrite |

---

## Added 2026-05-09 (First spec-audit run — `tools/spec-audit/`)

> Source: `tools/spec-audit/REPORT.md` (first run). Top-priority items only;
> full broken/orphan/undocumented lists in REPORT.md.
>
> First-run baseline: 38 broken refs · 304 orphan sections · 200 undocumented
> business-logic files. Coverage: BE Controller 5%, BE Service 6%, FE User Page 4%,
> FE Admin Page 11%.

### BL-AUDIT-1 — Spec refs use partial paths (e.g. `pages/Multiplayer.tsx`)
- **Issue:** SPEC_MULTIPLAYER §7.x references `pages/Multiplayer.tsx`, `pages/CreateRoom.tsx`, `pages/JoinRoom.tsx`, `pages/RoomLobby.tsx`, `pages/RoomQuiz.tsx`, etc. — partial paths that fail audit's filesystem check (must be `apps/web/src/pages/...`).
- **Cần làm:** Bulk replace partial paths → full repo-rooted paths in SPEC_MULTIPLAYER (and any other spec hit by this).
- **Status:** ⬜ TODO
- **Ref:** REPORT.md §Broken Refs (≈10 of 38 broken)

### BL-AUDIT-2 — `RoomQuizHost.tsx` / `RoomQuizPlayer.tsx` referenced but not implemented
- **Issue:** SPEC_MULTIPLAYER §7.5 documents Sprint 4 split routes (`pages/RoomQuizHost.tsx`, `pages/RoomQuizPlayer.tsx`), code still has single `pages/RoomQuiz.tsx`. Sprint 4 in-progress (S4-1...S4-4 merged, split route not yet).
- **Cần làm:** Either (a) add deferral note in SPEC_MULTIPLAYER §7.5 ("Split deferred to Sprint 4 closeout") or (b) defer entire split to ROADMAP until ship.
- **Status:** ⬜ TODO

### BL-AUDIT-3 — Migration filename refs in SPEC_USER use bare names
- **Issue:** SPEC_USER §3.5/§4.7/§5.3 reference `add_basic_quiz_unlock.sql`, `add_xp_surge_to_users.sql`, `add_daily_completions.sql` (bare). Actual Flyway files use `V{n}__` prefix and don't match basename search.
- **Cần làm:** Update spec to reference actual `apps/api/src/main/resources/db/migration/V{n}__...sql` filenames.
- **Status:** ⬜ TODO

### BL-AUDIT-4 — Variety mode pages referenced but don't exist (`MysteryMode.tsx`, `SpeedRound.tsx`, `WeeklyQuiz.tsx`)
- **Issue:** SPEC_USER §5.4 Variety Modes references `pages/MysteryMode.tsx`, `pages/SpeedRound.tsx`, `pages/WeeklyQuiz.tsx`. None exist in `apps/web/src/pages/`. Either vaporware or planned.
- **Cần làm:** Verify with user — ship status? If not shipped → move to ROADMAP. If shipped under different name → fix refs.
- **Status:** ⬜ TODO

### BL-AUDIT-5 — `Groups.tsx` ambiguous (admin vs user page)
- **Issue:** SPEC_ADMIN_v3.1 §2 references `Groups.tsx`. Two files match: `apps/web/src/pages/admin/Groups.tsx` AND `apps/web/src/pages/Groups.tsx`. Audit flags as ambiguous.
- **Cần làm:** Use full path in spec ref (`apps/web/src/pages/admin/Groups.tsx`).
- **Status:** ⬜ TODO

### BL-AUDIT-6 — Coverage critically low across all concerns
- **Issue:** First-run coverage stats: BE Controller 5% (2/37), BE Service 6% (3/51), FE User Page 4% (4/90), FE Admin Page 11% (4/35). 200 business-logic files have zero spec ref.
- **Cần làm:** Plan systematic spec coverage push — minimum target: every Controller + Service mentioned in at least one spec section. Track via REPORT.md coverage table over sprints.
- **Status:** ⬜ TODO

### BL-AUDIT-7 — 304 orphan spec sections (no code refs)
- **Issue:** 304 of 426 spec sections (71%) have zero file:line refs. Could be section overhead (intro/headers) or genuine vaporware.
- **Cần làm:** Filter via `node tools/spec-audit/parse-spec-refs.js --orphans`. Triage: prose-only sections OK, "behavior X happens at Y" sections need refs.
- **Status:** ⬜ TODO

---

## Sprint 5 (Quiz Set Professional) — Deferred items

### BL-S5-1 — Mastery hook into QuizSession.completeSession
- **Issue:** Q-4 shipped `GroupQuizSetMasteryService.recordPracticeSession()` but caller wiring chưa có. Mastery KHÔNG tự động cập nhật khi user complete solo practice từ group quiz set.
- **Cần làm:**
  1. V53 migration: `ALTER TABLE quiz_sessions ADD COLUMN group_quiz_set_id VARCHAR(36) NULL` + index
  2. Update QuizSession entity + add field setter
  3. Update 2-3 session-creation paths (Practice page, group quiz set "Tự ôn solo" flow) để set `groupQuizSetId`
  4. Hook trong `SessionService.completeSession`: nếu `session.groupQuizSetId != null` → call `masteryService.recordPracticeSession(...)`
  5. Compute `correctQuestionIds` từ session answers (Answer entity)
- **Q-A guard:** đảm bảo KHÔNG insert vào UserDailyProgress cho group leaderboard purposes
- **Status:** ✅ DONE 2026-05-10

### BL-S5-2 — i18n keys cho 3 FE pages Sprint 5
- **Issue:** QuizSetCreate/Detail/List ship với hardcoded VN strings (~50-80 lines). Tăng debt từ 648 → ~700 hardcoded.
- **Cần làm:**
  1. Tạo `quizSet:` block trong vi.json + en.json
  2. Refactor 3 pages dùng `useTranslation()`
  3. Run `npm run validate:i18n` — verify count giảm ≤ 648 baseline
- **Status:** ✅ DONE 2026-05-10

### BL-S5-3 — Auto-derive Difficulty cho quiz set
- **Issue:** Q-5 publishQuizSet hiện fallback `Difficulty.MEDIUM`. Logic auto-derive từ Question.difficulty được defer vì enum mismatch (Question lowercase `easy/medium/hard`, GroupQuizSet uppercase `EASY/MEDIUM/HARD/MIXED`).
- **Cần làm:** Implement `computeDifficulty()` per Q-0 P-D patch sample (map lowercase → uppercase với MIXED rule).
- **Status:** ✅ DONE 2026-05-10

### BL-S5-4 — Folder UI trong QuizSetList + QuizSetCreate
- **Issue:** Folder CRUD endpoints đã ship nhưng FE list page chưa render group-by-folder header + folder selector trong create form.
- **Cần làm:** QuizSetList: load folders + render section headers; QuizSetCreate: thêm `<FolderSelector>` (existing folders + "Tạo mới" inline).
- **Status:** ✅ DONE 2026-05-10

### BL-S5-5 — Pixel-perfect mockup match
- **Issue:** 3 FE pages ship functional baseline với inline Tailwind. Mockup `docs/mockups/MOCKUP_QUIZ_SET_V2_PROFESSIONAL.html` có chi tiết design tokens (Be Vietnam Pro 800/900, gradient cards, exact spacing) chưa được apply.
- **Cần làm:** Stitch sync workflow — verify mockup, refine spacing/typography/animations.
- **Status:** ✅ DONE 2026-05-10

### BL-AD-7 — DeepSeek V3.2 Bedrock integration
- **Issue:** Add DeepSeek V3.2 (AWS Bedrock, ap-northeast-1 Tokyo) as default AI provider, with Gemini + Claude as fallbacks. Refactor in-memory per-admin quota → Redis shared-global quota (admin + group leaders).
- **Spec impact:** SPEC_ADMIN §7.3, §7.4, §7.5, §7.6 (updated inline); SPEC_GROUP §6.A new (Group AI Question Generation).
- **Decisions locked (D1-D6):** see `docs/prompts/PROMPT_DEEPSEEK_BEDROCK_INTEGRATION.md`.
- **Delivered:**
  - `AIProvider` interface + 3 implementations (BedrockDeepSeek, Gemini, Claude wrappers).
  - `AIProviderRouter` with auto + explicit modes (auto = default→fallback chain; explicit = no fallback).
  - `AIQuotaService` Redis-backed shared global 200/day, fail-open on Redis errors.
  - Admin AI Generator FE: 3-tab selector with DeepSeek "DEFAULT" badge.
  - Group leader `/ai-generate` endpoint wired through router + shared quota guard.
  - 30 new unit/integration tests; pre-existing FE baseline failures (Ranked, DailyChallenge) untouched.
- **Deferred follow-up:** `AuditLogService` integration (`ai.generate.deepseek`, `ai.fallback.triggered`, `group.ai_generate`); cost tracking; CloudWatch monthly-spend alarm; manual verify Bedrock pricing constants before prod.
- **Status:** ✅ DONE 2026-05-12 — commits `d4f2f42` (Phase B BE), `c88d465` (Phase C FE), `1a2980a` (Phase D tests).

### BL-19 — Personal Quiz Set parity with Group (Phase 1 + Phase 2 shipped)
- **Issue:** Personal sets (MySets + SetEditor) shipped pre-Sprint-5 with only `{name, description, visibility}` and no DRAFT→PUBLISHED workflow, while group sets (Sprint 5) gained 15 metadata fields + workflow + AI-on-set. Users creating bộ câu hỏi from the multiplayer page got a much weaker editor than the group flow.
- **Spec impact:** SPEC_USER §19 updated inline (Phase 1) — file paths, V56 schema, DRAFT/PUBLISHED workflow, AI on personal sets.
- **Delivered (Phase 1 MVP, 2026-05-14):**
  - V56 migration: 10 new cols on `question_sets` (cover, tags, scripture, authorNote, difficulty, duration, suggestedMode, language, publishStatus, publishedAt); existing rows backfilled to PUBLISHED so CreateRoom keeps working.
  - `QuestionSetController`: POST + new PATCH accept full Sprint 5 metadata; new PATCH `/publish` (≥5 câu, ≥3 char name, must be DRAFT); new GET `/full` returning EditorQuestion-shape questions; GET list accepts `?status=PUBLISHED` filter.
  - `apps/web/src/pages/group/QuizSetEditor.tsx` refactored to receive an injectable API adapter + ownership flag; `apps/web/src/pages/group/GroupQuizSetEditor.tsx` wrapper preserves the existing /groups route unchanged.
  - New `apps/web/src/api/personalQuizSets.ts` adapter + `apps/web/src/pages/PersonalQuizSetEditor.tsx` wrapper + routes `/my-sets/new` and `/my-sets/:setId/edit`; legacy 553-LOC SetEditor.tsx removed.
  - `MySets` shows DRAFT/PUBLISHED chips, scripture/tag previews; inline create form gone — button goes straight to the editor.
  - `CreateRoom` custom-set picker queries `?status=PUBLISHED` so DRAFTs aren't playable.
- **Delivered (Phase 2 AI, 2026-05-15):**
  - `POST /api/question-sets/{id}/ai-generate` — set-scoped AI generation, persists UserQuestion(source=AI), attaches to set; shares 200/day `AIQuotaService` bucket with group.
  - `POST /api/question-sets/{id}/questions/{qid}/ai-rewrite` — returns fresh draft, FE accepts via existing PUT `/api/user-questions/{qid}`.
  - `GET /api/question-sets/ai-quota` — quota snapshot for the personal editor top-bar badge.
  - FE adapter (`personalQuizSets.ts`) wires the 3 endpoints; `QuizSetEditor` gains optional `aiEnabled` prop, `PersonalQuizSetEditor` opts in. AI Generate + Rewrite + quota badge now show for personal sets too.
- **Still deferred (Phase 3):**
  - Personal folder entity + UI (group has `GroupQuizSetFolder`, personal does not).
  - Difficulty / estimatedDurationMin auto-derive on publish (group has `computeDifficulty()`).
- **Status:** ✅ DONE 2026-05-15.
- **Ref:** task files `docs/todo/archive/2026-05-14-personal-quiz-set-parity-phase-1.md`, `docs/todo/archive/2026-05-15-personal-quiz-set-ai-phase-2.md`.

### BL-AD-8 — Quiz Set Editor unified page
- **Issue:** Modal 2-tab "AI tạo / Tự soạn" + metadata-only `QuizSetCreate.tsx` thay bằng 1 trang editor thống nhất — AI là tool button, không phải mode tách biệt. Question list sidebar 260px + main editor body.
- **Spec impact:** SPEC_GROUP §6.B new (Quiz Set Editor Page); §6.A workflow paragraph reduced (delegates to §6.B).
- **Decisions locked (D1-D10):** see `docs/prompts/PROMPT_QUIZ_SET_EDITOR_PAGE.md`. Q1-Q4 confirmed in `docs/audit/AUDIT_REPORT_QUIZSET_EDITOR.md`.
- **Delivered:**
  - 7 new endpoints in `ChurchGroupController.java` (per-question CRUD + reorder + set-scoped AI gen + per-question AI rewrite).
  - New page `apps/web/src/pages/group/QuizSetEditor.tsx` + 9 sub-components in `pages/group/quizset-editor/`.
  - API client extended (`api/quizSets.ts`): getQuizSetFull, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, aiGenerateForSet, aiRewriteQuestion.
  - Auto-save: debounce 2s + force 30s + tab-close + React Router blocker.
  - Mobile responsive (CSS media queries < 768px).
  - Deleted: `CreateQuizSetModal.tsx` (774 LOC) + `QuizSetCreate.tsx` (510 LOC); GroupDetail.tsx modal state/handlers (~280 LOC) removed.
- **Question.source convention:** `ai-group` (AI in group editor), `group-custom` (manual in group editor).
- **Deferred follow-up:**
  - BL-AD-9: Bible verse preview card under scripture ref input (requires new `BookController` endpoint to return verse text). Mockup desktop shows italic gold card but ships without preview.
  - "AI sinh tương tự" + "AI gợi ý đáp án nhiễu" (D8 v2).
  - RN port of editor (mobile parity beyond responsive web).
- **Status:** ✅ DONE 2026-05-13 — commits `58c05c7` (Phase A+B), `e4de3e4` (Phase C-H), this commit (Phase I).

### BL-20 — Ranked không enforce tier-based difficulty distribution
- **Issue:** SPEC_USER §3.2 hứa Easy/Med/Hard% theo tier (T1: 70/25/5 → T6: 5/35/60). `TierDifficultyConfig.getDistribution()` có sẵn nhưng chỉ được consume bởi `SmartQuestionSelector.selectQuestions()`. Ranked.tsx FE gọi thẳng `/api/questions?excludeIds=...&book={book}` không qua SmartQuestionSelector → mọi tier nhận distribution uniform từ pool seed của sách đó. T6 không nhận nhiều câu Hard hơn T1; "leo tier khó hơn" chỉ tồn tại qua XP multiplier ×2.0, không qua content khó.
- **Audit ref:** Ranked.tsx:51-67 manual select; SmartQuestionSelector callers: SessionService (Practice), VarietyQuizController (Mystery/Speed), AdminTestController (preview) — none from Ranked.
- **Fix:** RANK-CATCHUP-1 + RANK-CATCHUP-2 — BE endpoint `/api/ranked/questions/select` wrap SmartQuestionSelector; FE Ranked.tsx 1 call thay 3 fallback.
- **Effort:** ~1 ngày BE + 0.5 ngày FE
- **Status:** ✅ DONE 2026-05-20 — this commit. New endpoint `POST /api/ranked/questions/select` wraps SmartQuestionSelector; Ranked.tsx now 1-call (was 3-fallback).

### BL-21 — Ranked không ghi UserQuestionHistory → profile stats thiếu + cross-day repeat
- **Issue:** `RankedController.submitRankedAnswer` không upsert `UserQuestionHistory` row sau khi user trả lời. Practice path qua `SessionService:763` đã ghi đúng. Hệ quả: (1) Profile stats `userQuestionHistoryRepository.countByUserId` ("đã chơi N câu") thiếu count Ranked toàn bộ; (2) Cross-day anti-repeat không khả thi vì không có lifetime history — `UserDailyProgress.askedQuestionIds` chỉ scope 1 ngày UTC; (3) Spaced-repetition (nextReviewAt) impossible cho Ranked.
- **Audit ref:** `historyRepository.save` callers: SessionService.persistAnswer + AdminTestController (test seed) — RankedController missing.
- **Fix:** RANK-CATCHUP-3 — upsert UQH row trong RankedController.submitRankedAnswer after UDP save. Wrap try/catch để UQH failure không break Ranked response.
- **Follow-up (defer):** RANK-CATCHUP-4 cross-day exclude via UQH recent-N IDs.
- **Effort:** ~0.5 ngày BE
- **Status:** ✅ DONE 2026-05-20 — this commit. `RankedController.submitRankedAnswer` now upserts UQH (try/catch isolated so a UQH failure doesn't break the ranked answer response). Spaced-repetition (`nextReviewAt`) populated mirroring SessionService.

---

## Multiplayer Lobby Redesign (2026-05-15) — Deferred items

### BL-MP-QM — Quick Match (Đấu Nhanh) — 🚧 ACTIVE SPRINT (2026-05-15)
- **Status:** 🚧 IN PROGRESS — pivoted from BL-MP-SOLO after concept misinterpretation. Implementation tracked as QP-1..QP-REGRESSION in `docs/todo/active/2026-05-15-multiplayer-quickmatch-pivot.md`.
- **Effort:** ~3 days
- **Why active:** "Solo" was misinterpreted as single-player. Real intent = multiplayer without Quản trò, server soft-coordinates. See `docs/new-multiplayer/PROMPT_MULTIPLAYER_QUICKMATCH_PIVOT.md`.
- **Scope (locked 2026-05-15 after 4 corrections):**

#### BE
- Migration **V57**: `ALTER TABLE rooms ADD COLUMN quick_match BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN ai_questions_payload JSON NULL` + index `(quick_match, status)`.
- `POST /api/rooms/quick-match` — body `{ mode, bookScope, questionCount, timePerQuestion, source }`. **Always-create** (Liên Quân custom lobby pattern, no matchmaking). Daily cap 3/user/day + AI tier-lock (Tier 4+) + anti-cheat (not in another room).
- `QuickMatchQuestionSourceService` — DB random with book/chapter/verse filter (30/50/20 difficulty mix) OR AI gen one-shot. **AI questions persist ONLY in `Room.aiQuestionsPayload` JSON** — not saved to `Question` table. Purged with R5 room cleanup.
- `DailyQuickMatchCounter` (Redis SETEX 24h TTL, key `quickmatch:daily:{userId}:{yyyymmdd}`).
- Soft-host: `hostPlaysGame=true` forced, `hostId` = creator (no privilege). Any player can `POST /api/rooms/{id}/start` when ≥2 ready.
- 5 host control endpoints (pause/resume/skip/broadcast/end-early) reject quick-match with 422 `QUICK_MATCH_NO_HOST_CONTROLS`.

#### FE
- Rename `SoloArenaEntryCard.tsx` → `QuickMatchEntryCard.tsx` (git mv), copy update per mockup v3 (rocket icon, "Vào ngay · Không cần host" kicker, daily quota indicator).
- **NEW** `QuickMatchConfigModal.tsx` — modal popup with 5 sections: mode picker (4 cards) · scope select · count chips · time chips · source toggle (AI disabled+badge if Tier < 4). Click EntryCard CTA → opens this modal → submit → `triggerQuickMatch(config)`.
- Delete `SoloArenaPlaceholder.tsx` + `/solo-arena` route (replaced by Quick Match flow).
- `EmptyRoomsState`: 4-mode-grid + Solo soft-link → **2 CTAs** (Đấu Nhanh indigo opens modal · Tạo phòng Quản trò gold).
- `QuickMatchRoomCard.tsx` — distinct variant: indigo accent, "Đấu Nhanh" badge, room code title, mode+scope kicker, source icon (cpu/auto_awesome).
- `RoomsSection` filter chip "Đấu Nhanh" first.
- `RoomLobby` variant: indigo info banner thay Quản trò gold, start visible to all when 2+ ready, hide host control panel.
- `triggerQuickMatch(config)` + error handler trong `api/rooms.ts`.

#### Locked decisions (LOCK 2026-05-15)
- Naming: "Đấu Nhanh" (VI) / `quickMatch` field / `QUICK_MATCH_NO_HOST_CONTROLS` error code
- Match policy: **always-create** (creator chooses config)
- Source: DATABASE default / AI_GENERATED Tier 4+ unlock
- AI storage: ephemeral `Room.aiQuestionsPayload JSON` — NO save to `Question` pool
- Daily cap: 3 trận/ngày/user — Redis backed
- Color: indigo `#6366f1` → `#818cf8` gradient
- Config UI: modal popup (`QuickMatchConfigModal`)
- XP/Leaderboard: NONE (variety-style)

- **Ref:** `docs/new-multiplayer/PROMPT_MULTIPLAYER_QUICKMATCH_PIVOT.md` + `docs/new-multiplayer/MOCKUP_MULTIPLAYER_LOBBY_v3.html`

### BL-MP-QM-CUSTOM — Quick Match v2 user preferences (deferred)
- **Status:** ⬜ Deferred (v2)
- **Effort:** ~1 day FE + 0.5 day BE
- **Trigger:** After BL-MP-QM v1 ships + user feedback indicates demand
- **Scope:**
  - Persistent user preferences for default Quick Match config (source / count / scope)
  - Sticky in user profile, not query param
  - Sidebar gear button on `QuickMatchEntryCard` to open settings
  - BE: add user preference fields to `User` entity or new `UserPreferences` table
- **Ref:** `docs/new-multiplayer/PROMPT_MULTIPLAYER_QUICKMATCH_PIVOT.md` §0.2

### BL-MP-SOLO — Solo Arena (CLOSED 2026-05-15)
- **Status:** ❌ CANCELLED — concept pivoted to BL-MP-QM (Quick Match)
- **Reason:** "Solo" was misinterpreted as single-player. Intent was multiplayer-without-host (Quick Match pattern). MPP-3/4 shipped Solo Arena placeholder + entry card; QP-6/7 will rename/replace those with Quick Match equivalents.
- **Replacement:** All scope absorbed into BL-MP-QM above.

### BL-MP-PALETTE — Multiplayer palette canonical patch (2026-05-15, shipped)
- **Issue:** MLR commit 77165a9 đã ship palette mode khác với canonical PROMPT_MULTIPLAYER_LOBBY_REDESIGN §0.1.
- **Delivered:** commit `c71506c` realigns `apps/web/src/pages/create-room/modeMeta.ts` palette: speed=#38bdf8 (was #60a5fa), battle=#ef4444 (was #f87171), team=#a855f7 (was #4ade80), sudden=#fbbf24 AMBER (was #c084fc, never #fb923c streak). Sudden icon `workspace_premium` → `target`.
- **Status:** ✅ DONE 2026-05-15 — commits c71506c (palette), 64d01ca (Solo Arena hero), 60988f7 (sidebar widget), 510df61 (Solo soft-link).

---

## Added 2026-05-21 (Liturgical Coverage §7 follow-ups)

### BL-COVERAGE-PHASE-4A — Rename deprecated UserDailyProgress columns
- **Source:** SPEC_USER_v3.2 §7.9.7 (Phase 4a — point of no return prep)
- **Scope:** V?? Flyway migration renaming `users.{current_book,current_book_index,is_post_cycle}` and `user_daily_progress.{current_book,current_book_index,is_post_cycle}` to `_deprecated_*` prefix. Update Hibernate entity `@Column(name=...)` annotations to match.
- **Gate to ship:** 30 days stable Phase 3 (mobile migrate) + DB backup verified + pre-rename FK/index check (see §7.9.7).
- **Status:** ⬜ DEFER — held out of sprint v1 to avoid bundling irreversible change

### BL-COVERAGE-PHASE-4B — Drop deprecated UserDailyProgress columns
- **Source:** SPEC_USER_v3.2 §7.9.5
- **Scope:** Drop renamed `_deprecated_current_book`, `_deprecated_current_book_index`, `_deprecated_is_post_cycle` columns after 7-day grace post-4a. Also remove `BookProgressionService.java` + dual-gate code in `RankedController:432-444`.
- **Gate to ship:** 7 days post-Phase 4a (rename) stable, zero P0/P1 bugs touching deprecated columns.
- **Status:** ⬜ DEFER — follows BL-COVERAGE-PHASE-4A

### BL-COVERAGE-PHASE-4C — Drop user_daily_progress.current_difficulty
- **Source:** SPEC_USER_v3.2 §7.7.3 + §7.9.5
- **Scope:** Drop `user_daily_progress.current_difficulty` separately because mobile RankedScreen pre-migration still writes this field.
- **Gate to ship:** `mobile_legacy_request_count` telemetry = 0 for 30 consecutive days (verifies all mobile users on new endpoint).
- **Status:** ⬜ DEFER — depends on mobile migration completion

### BL-COVERAGE-MOBILE-MIGRATE — Mobile RankedScreen → new endpoints
- **Source:** SPEC_USER_v3.2 §7.9.4, task file commit 8 deferred item
- **Scope:** `apps/mobile/src/screens/quiz/RankedScreen.tsx` migrate `/api/me` → `/api/me/ranked-status` + `/api/me/coverage-status`. Render CoverageCard equivalent. Stop writing `currentDifficulty` field.
- **Effort:** S (~150 LOC), 1-2 days
- **Status:** ✅ DONE 2026-05-22 — migrated to `POST /api/ranked/questions/select` (3× legacy GET removed), CoverageHint (Option C), useCoverageStatus hook, header C2 fix, vi/en i18n. tsc clean. Commit-6 tests deferred → BL-MOBILE-COMPONENT-TEST-INFRA.

### BL-MOBILE-COMPONENT-TEST-INFRA — RN component-test infrastructure
- **Source:** Mobile Ranked migration commit 6 (2026-05-22), blocked
- **Scope:** Mobile jest currently `ts-jest`/node, `testMatch: *.test.ts` — only pure-logic tests. No RN component testing. Need: add `jest-expo` + `@testing-library/react-native` + `react-test-renderer@19.1.0` devDeps, switch jest preset, write first screen test (`RankedScreen.test.tsx` — verify single endpoint call, language field, no book field, canonical header).
- **Blocker:** `pnpm add` fails on this Windows env with `ERR_PNPM_ENOENT` on `_tmp_` dirs (likely Defender real-time scan). Retry on env with Defender exclusion for repo dir, or CI.
- **Effort:** M (infra setup + first test), 1 day
- **Status:** ⬜ DEFER

### BL-COVERAGE-ADMIN-UI — Admin UI for weekly pairing override
- **Source:** SPEC_USER_v3.2 §7.14.4 (locked 2026-05-21 — defer v1.5)
- **Spec canonical:** v1 ship endpoint `PATCH /api/admin/seasons/{seasonId}/pairings/{weekNumber}` only. No UI in v1.
- **v1.5 requirement:** Admin page `/admin/seasons/{id}/pairings` cho visual editor:
  - Display 13 weekly pairings của 1 mùa
  - Drag-drop sách giữa các tuần
  - Validation: 66 sách cover exactly once, 6 sách/tuần (Foundation/Acceleration/Climax), Mastery weeks empty
  - Save → call PATCH endpoint per week changed
- **Effort:** S (~200 LOC FE + reuse existing endpoint), 2-3 ngày
- **Rationale defer:** Auto pairing đủ tốt cho 4 mùa đầu launch. Manual override rare. UI effort không justify trước v1 launch. Bui/đội mục vụ FMC dùng API/DB nếu cần override gấp.
- **Status:** ⬜ DEFER v1.5

### BL-UUID-V7-SEASONS — Migrate seasons.id UUID v4 → v7
- **Source:** SPEC_USER_v3.2 §7.7.1 M1 note (2026-05-21)
- **Current state:** `Season.java` legacy dùng UUID v4 (entity tồn tại trước CLAUDE.md UUID v7 rule). New entities `weekly_pairings.id`, `user_season_coverage.id` dùng UUID v7 per current convention.
- **Drift accepted:** FK reference value-only — no compatibility issue. Spec drift documented in §7.7.1.
- **Future migration:** Only if needed for time-ordered insert performance (e.g., DB index hotspot trên seasons table). Currently 4 mùa × seed = 4 rows total, không có hotspot risk.
- **Effort:** XS (~10 LOC + 1 migration), 0.5 ngày
- **Status:** ⬜ DEFER (low ROI, no current pain)
- **Trigger:** Bump priority if SeasonSeeder logic expands beyond 4 rows hoặc seasons becomes high-write table
- **Related:** MP-5 (Room/RoomPlayer UUID v4 → v7) — similar tech debt pattern. Consider bundling into single "UUID v7 migration sprint" nếu/khi attack.

### BL-QUESTION-RESEED-HISTORY-PRESERVATION — Preserve user history on book rename
- **Source:** PROMPT_FIX_SONG_OF_SONGS migration design 2026-05-22
- **Issue:** QuestionSeeder orphan sweep CASCADE-deletes `user_question_history` when a seed JSON `book` field changes (UUID derived from `book,chapter,verseStart,verseEnd,language,content`). Future book renames lose user progress.
- **Acceptable for v1:** Pre-launch, few/no real users — Song of Songs fix accepted history loss.
- **Post-launch problem:** Production user history cannot be discarded for naming standardization.
- **Solution sketch:** Pre-sweep migration captures `(old_uuid → history rows)` mapping; post-seeder updates `user_question_history.question_id` old→new. Or add `migration_alias` column to `questions` for backward-compat lookup.
- **Effort:** M (~1-2 days design + impl + test)
- **Status:** ⬜ DEFER until next book-name change needed post-launch

### BL-RANKED-TEST-STALE-MILESTONE — Cleanup stale `ranked-milestone-*` testids
- **Source:** 2026-05-21 — flagged during PROMPT_RANKED_ERROR_TOASTS execution
- **Issue:** `apps/web/src/pages/__tests__/Ranked.test.tsx` có **42 failures** với pattern "Unable to find `[data-testid="ranked-milestone-N"]`". Testids đã bị remove trong prior refactor (commit `f1cbcac` "orchestrator < 250 LOC" hoặc `a8dfcc3 A4`) nhưng tests không được update tương ứng.
- **Current state:** Tests fail nhưng pre-existing — KHÔNG phải regression từ Coverage sprint. Confirmed via grep: testid `ranked-milestone-*` không tồn tại trong current component tree.
- **Impact:**
  - CI noise — 42 false failures hiding real regressions
  - Developer trust giảm — habit ignore failed tests
  - Coverage metric inflated/deflated incorrectly
- **Effort:** S (~2-3 hours)
  - Option A — Remove stale tests entirely (nếu functionality không còn relevant)
  - Option B — Update testids to current component structure
  - Decision depends on whether milestone UX still exists conceptually
- **Status:** ⬜ DEFER post-launch (không block v1)
- **Trigger:** Bump priority nếu CI failures cản trở merge/deploy decisions
- **Related:** Coverage sprint (added 53 new tests passing) — separate from this debt

### BL-BR-SURVIVOR-RANKING — Battle Royale survivor tie-break: spec says score, code ranks by correctAnswers
- **Source:** 2026-06-12 — domain deep-dive on Sinh tồn (BATTLE_ROYALE) during multiplayer refactor sprint
- **Issue:** SPEC_MULTIPLAYER §3.2 edge case nói khi nhiều người sống tới hết `questionCount` thì "xếp hạng theo **score**", nhưng `BattleRoyaleEngine.assignFinalRanks` xếp theo **correctAnswers DESC → averageReactionTime ASC**. Hai thước tương quan nhưng không đồng nhất (score có speed-bonus phi tuyến từ công thức Speed Race) — có thể cho thứ hạng khác nhau.
- **Also found:** `BattleRoyaleEngine.shouldEndGame` (luật max rounds `min(questionCount*2, 50)`) là **dead code** — không call-site nào; trận chỉ chạy đúng `questionCount` vòng. Hoặc xoá method, hoặc spec hóa luật vòng phụ rồi wire vào loop.
- **Effort:** S — chốt canonical (score vs correct-count) rồi sửa 1 trong 2 phía + pin test; xoá/wire `shouldEndGame`.
- **Status:** ✅ RESOLVED 2026-06-12 — user chốt canonical = **correctAnswers → avgReactionTime** (giữ code, sửa spec §3.2; xem DECISIONS.md 2026-06-12). `shouldEndGame` dead code đã xoá cùng tests của nó. Wrap-up Quản trò hiển thị "X/Y đúng" làm số chính cho BR.
- **Related:** apps/api/DOMAIN.md §4.3.1 (as-implemented chi tiết, LOCAL-ONLY)

### BL-22 — Daily Challenge: verify từng đáp án server-side (chống khai khống correctCount)
- **Source:** 2026-06-16 — scoring rework (DECISIONS.md 2026-06-16). XP Daily giờ cao hơn (tới 150) → giá trị gian lận tăng.
- **Issue:** `POST /api/daily-challenge/complete` nhận `correctCount` từ client; server tính XP từ đó (`DailyChallengeService.dailyXp`) nhưng KHÔNG verify client thật sự trả đúng bấy nhiêu câu. Client tampered có thể gửi `correctCount:5` để luôn nhận 150 XP. Hiện chỉ chặn out-of-range (`@Max(5)`).
- **Mitigation hiện có:** Daily cap 1 lần/ngày (cap thiệt hại) + `/answer` đã chấm đúng/sai server-side per câu (chỉ chưa persist running count).
- **Fix hướng:** track correct-count server-side per daily session (lưu kết quả mỗi `/answer` vào session/Redis theo `sessionId`), rồi `/complete` dùng count server thay vì trust client. Hoặc gộp `/complete` vào luồng `/answer` cuối.
- **Effort:** M — cần session-side answer tracking (daily session hiện chỉ là client-side tracking ID).
- **Status:** ⬜ DEFER — chấp nhận risk ngắn hạn, bump nếu có dấu hiệu abuse leaderboard.
- **Related:** `DailyChallengeService`, `DailyChallengeController`, `CompleteDailyChallengeRequest`.

---

## Added 2026-06-17 (Group differentiator — Collective Growth)

### BL-23 — Group Collective Growth ("Cùng nhau thuộc Lời") — anti-leaderboard shared progress
- **Source:** 2026-06-17 — khảo sát + đánh giá Group ("không có điểm nổi bật": đủ cơ chế nhưng kẹt giữa pivot — leaderboard cạnh tranh đã sunset (Q-A / GD-1 / BL-16) còn hook thay thế (BL-17 Feed, BL-18 Pulse) đều defer).
- **Concept:** *anti-leaderboard*. KHÔNG xếp hạng cá nhân — một con số chung cả nhóm cùng lấp đầy: "Nhóm đã cùng thuộc **N** câu Lời Chúa" + thanh tiến tới cột mốc + breakdown theo bộ câu hỏi. Hợp văn hóa Tin Lành "cùng nhau lớn lên".
- **Q-A SAFE:** dùng `GroupQuizSetMastery` (solo practice), aggregate thành chỉ số tập thể *không-ranking* → KHÔNG đụng `ChurchGroupService.getLeaderboard` (BL-16). Bổ sung BL-17/BL-18, không trùng.
- **Decisions locked (D1–D5, default 2026-06-17 — DECISIONS.md):** D1 hero = `SUM(questionsLearned)` (UNION v2) · D2 nguồn mastery-only (group-play v2) · D3 hero trong Activity tab · D4 group goal v2 (v1 milestone tự động) · D5 mọi member thấy.
- **Implementation (idiom codebase):** repo trả `List<Object[]>` aggregate · service trả `Map<String,Object>` (như mastery/scheduled service) · test Mockito (group module không có Testcontainers/@DataJpaTest). **v1 KHÔNG cần Flyway migration** (read-only).
- **Delivered (CG-1..8):**
  - CG-1 repo `aggregateGrowthByGroupId` + `GroupCollectiveGrowthService.getCollectiveGrowth` (hero SUM + milestone band 50→10000).
  - CG-2 per-set `aggregatePerSetByGroupId` + `memberCount` (ChurchGroupRepository) + `buildPerSet`.
  - CG-3 endpoint `GET /api/groups/{id}/collective-growth` (member-visible; non-member 400) + 2 controller test.
  - CG-4 reflection Q-A guard test (no UserDailyProgress/leaderboard dependency).
  - CG-5 `useGroupCollectiveGrowth` (TanStack) + `getCollectiveGrowth` api + queryKeys groups domain.
  - CG-6 `CollectiveGrowthCard` (hero + milestone bar + per-set, emerald GD-12, 3 states) + 4 test.
  - CG-7 wired into `GroupActivityTab` (mọi member) + i18n `groups.growth.*` (vi+en).
  - CG-8 SPEC_GROUP §18 authored (+ §15.7 endpoint, §19 cross-ref renumber) + this BACKLOG close.
- **Tests:** BE Tầng 3 1075 pass · FE Tầng 3 1331 pass (≥ baseline). Side-fix: jsdom pinned ^26 (Node 22.11 require-ESM, unbreaks seo-dedupe) — commit `c272ad61`.
- **Status:** ✅ DONE 2026-06-17 — commits `76ac4415` (CG-1), `a3bc110f` (CG-2), CG-3/CG-4 folded into concurrent history, `330b5403` (CG-5..7 FE), CG-8 this commit.
- **Spec impact:** [SPEC_GROUP_v1.3.md §18](SPEC_GROUP_v1.3.md) (Collective Growth, authored). Related: BL-16, BL-17, BL-18.
- **Deferred (v2):** UNION distinct hero (D1) · group-play sources (D2) · leader-set group goal (D4) · milestone celebration/notification · mobile RN port.
- **Ref:** task `docs/todo/active/2026-06-17-group-collective-growth.md`.

---

## Added 2026-06-20 (Group engagement — announcement notifications)

### BL-24 — Group announcement → notify members (Q-K increment 1)
- **Source:** 2026-06-20 — user hỏi mục đích tab "Thông báo"; phát hiện `ChurchGroupService.createAnnouncement` chỉ lưu DB, KHÔNG gọi `NotificationService` → member không nhận noti khi leader/mod đăng (UI "🔔 Bạn sẽ nhận thông báo khi có bài mới" là lời hứa chưa nối dây). Auto-noti hiện chỉ chạy ở scheduled-quiz-end.
- **Concept:** đăng thông báo → in-app notification cho mọi member (trừ tác giả), reuse `NotificationService.createNotification(...)` (pattern `scheduled_quiz_ended`). Là increment **đầu** của Q-K (11 push events — locked nhưng defer).
- **Delivered:** GAN-1 BE — `ChurchGroupService.createAnnouncement` inject `NotificationService`, loop `findByGroupId`, `createNotification(u, "group_announcement", "Thông báo mới · {group}", content≤140, {groupId,announcementId})` cho mọi member ≠ author, try/catch best-effort; +2 Mockito test. GAN-2 FE — `NotificationPanel` TYPE_STYLE +`group_announcement` 📢 (panel vốn render generic; deep-link defer — cần plumb `metadata`). GAN-3 — SPEC_GROUP §12 (endpoint `{content}`, noti = shipped, banner/pin marked chưa ship).
- **Decisions (locked default 2026-06-20):** D1 in-app only (push/FCM defer Q-K) · D2 mọi member trừ tác giả · D3 chỉ event "đăng thông báo".
- **Effort:** S. No migration (reuse `notifications` table).
- **Follow-up DONE 2026-06-20:** click-to-group deep-link — `resolveNotificationTarget` route `group_announcement` → `/groups/{groupId}?tab=announcements` qua `metadata` (thêm `metadata` vào `PanelNotification`; BE vốn đã trả `metadata`). +3 unit test.
- **Deferred:** banner 7d + pin (§12) · Q-K events còn lại (member join, live room, scheduled-quiz-created…) + push/FCM transport.
- **Status:** ✅ DONE 2026-06-20.
- **Spec impact:** [SPEC_GROUP_v1.3.md §12](SPEC_GROUP_v1.3.md) (author khi ship). Related: Q-K (push events), BL-17 (Activity Feed — sự kiện phong phú hơn).
- **Ref:** task `docs/todo/active/2026-06-20-group-announcement-notifications.md`.

---

## Added 2026-06-20 (Group differentiator — Hành Trình Nhóm)

### BL-25 — Hành Trình Nhóm (Group Journey) — async/persistent/ministry differentiator
- **Source:** 2026-06-20 — user chốt: live "Chơi cùng nhau" trùng multiplayer → group thiếu lý do tồn tại. Hướng A: dồn vào trục **bất đồng bộ + bền bỉ + có người dẫn** (multiplayer không nhái được).
- **Concept:** cả nhóm cùng đi qua 1 sách/chủ đề trong N **chặng**; mỗi người tự học theo nhịp, có **tiến độ chung + checkpoint mỗi chặng**. Mỗi **chặng = 1 `ScheduledQuiz`**; tiến độ suy từ `ScheduledQuizAttempt`.
- **✅ Data source verified LIVE:** scheduled-quiz flow wired end-to-end (FE Create/Detail/Play + BE `submitAttempt` save attempt) → KHÔNG rỗng như Collective Growth (vốn dựa solo-practice đã chết).
- **Decisions (LOCKED 2026-06-20):** D1 leader tự mở từng chặng (auto-weekly→v2) · D2 hoàn thành = chỉ cần làm (no %-gate) · D3 Hành trình = hero, Quiz tuần lẻ giữ ad-hoc · D4 hạ live co-play xuống shortcut.
- **Cần làm (GJ-1..8):** entities+migration · service (openNextWeek delegate ScheduledQuizService + progress aggregate) · endpoints · FE api/hooks · leader builder · journey view · hero+demote-live+i18n · SPEC §X + Tầng 3.
- **Effort:** L (multi-day). Reuse: ScheduledQuiz, GroupQuizSet+AI, GroupAnnouncement+noti (BL-24).
- **Status:** ✅ DONE (2026-06-21) — GJ-1..8 shipped. BE: V70 + `GroupJourney`/`GroupJourneyWeek` + `GroupJourneyService` (`openNextWeek` delegates `ScheduledQuizService.create`; progress aggregates `ScheduledQuizAttempt`) + `GroupJourneyController` (17 BE tests). FE: `apps/web/src/api/groupJourney.ts` + `useGroupJourney` hooks + `JourneyBuilder`/`JourneyView`/`JourneyHeroCard` (16 FE tests) + `groupJourney` i18n vi/en. Live co-play demoted (D4).
- **Spec impact:** [SPEC_GROUP_v1.3.md §19 (Hành Trình Nhóm)](SPEC_GROUP_v1.3.md) + §7 demote note + v1.6 changelog. Related: §9 Scheduled Quizzes (reuse), BL-24 (noti).
- **Ref:** task `docs/todo/active/2026-06-20-group-journey.md`.

---

## Added 2026-06-21 (Ranked scoring deep-dive)

### BL-26 — Ranked scoring rework: công bằng theo kỹ năng + động lực
- **Source:** 2026-06-21 deep-dive cơ chế tính điểm Ranked. Quyết định LOCKED (LD1–LD4): [DECISIONS.md 2026-06-22](../../DECISIONS.md).
- **Status:** ✅ DONE 2026-06-22 (A+B+C) — `calculateRanked` additive cap 2.0 + timer 90s (A1) + daily-first wired (A2) + comeback (D3) + accuracy match-bonus endpoint (B/LD1). SPEC_USER v3.1/v3.2 §4 updated. D1/E (sao + rank tuần surface) DEFER. Test: ScoringServiceTest 49 + RankedControllerTest match-complete 5 + FE 1386. Sprint: `docs/todo/active/2026-06-22-ranked-scoring-rework-abc.md`.
- **Vấn đề:**
  - **P1 (bug):** `ScoringService.TIME_LIMIT_MS = 30_000` nhưng timer Ranked = 90s (policy 2026-05-20) → trả lời giây 31–90 mất sạch speed bonus; `clientElapsedMs` clamp 30000. Ref: `ScoringService.java:18,59-63`.
  - **P2 (lệch SPEC §4.4):** daily-first ×2 không wire cho Ranked — `RankedController.java:546` truyền literal `isDailyFirst=false`.
  - **P3:** tier = grind thời lượng; accuracy không thưởng (chỉ phạt gián tiếp qua energy).
  - **P4:** multiplier nhân chồng → biên độ 1 câu ×22 (8→182); surge×season khiến timing át kỹ năng.
  - **P5 (nhất quán):** `/me/tier` (`RankedController.java:1228`) + tier-up notification dùng raw ledger sum, lệch `UserTierService.getTotalPoints()` (prestige-aware) dùng cho scoring multiplier.
- **Cần làm (chia nhóm A–E, chi tiết + số đề xuất trong DECISIONS):**
  - **A** (rẻ, ít rủi ro — có thể tách task ngay): A1 speed bonus theo timer thật · A2 wire daily-first ×2.
  - **B** thưởng accuracy cuối phiên (≥90% +15%, 75–89% +8%, không phạt âm) — lever công bằng chính.
  - **C** ghìm variance: situational (combo/surge/season) **cộng dồn cap 2.0**, tier giữ nhân.
  - **D** động lực: D1 surface sub-tier sao (`TierProgressService` đã build) · D2 breakdown điểm/câu · D3 wire Comeback (gộp **BL-13**) · D4 daily goal.
  - **E** cạnh tranh ở leaderboard Tuần (đã sống) — **KHÔNG** hồi sinh season (LBF-9/13 giữ nguyên).
  - **(kèm)** P5: `/me/tier` + tier-up dùng chung `UserTierService.getTotalPoints()`.
- **Effort:** A nhỏ (~0.5 ngày) · B+C trung bình (đổi formula + test) · D rải nhiều task · E nhỏ (FE surface).
- **Spec impact:** SPEC_USER_v3.x §4.1–4.6 — strategy (a) update inline **sau khi chốt số**.
- **Related:** BL-13 (Comeback, gộp vào D3) · BL-5 (season ×1.5 — seasonBonus trong C) · BL-3 (XP surge — surgeBonus trong C).

---

## Cross-references
- Canonical specs: [SPEC_USER_v3.2.md](SPEC_USER_v3.2.md), [SPEC_MULTIPLAYER.md](SPEC_MULTIPLAYER.md), [SPEC_ADMIN_v3.1.md](SPEC_ADMIN_v3.1.md), [SPEC_GROUP_v1.3.md](SPEC_GROUP_v1.3.md) (Sprint 5)
- Roadmap (defer features): [SPEC_ROADMAP.md](SPEC_ROADMAP.md)
- Audit findings: [../audit/](../audit/)
