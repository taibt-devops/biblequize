# SPEC_GROUP v1.6.1 — Church Group Features

**Last updated**: 2026-06-22 (Group leaderboard retired → 410 Gone — BL-16)
**Previous version**: v1.6 (Hành Trình Nhóm "Group Journey" — BL-25, 2026-06-21)
**Locked decisions**: Q-A through Q-O preserved
**Mockup reference**: `docs/mockups/MOCKUP_GROUP_DETAIL_REDESIGN.html`, `docs/group-page/group_detail_redesign_*.html`

---

## Changelog v1.6 → v1.6.1 (2026-06-22)

> [BL-16] **Group leaderboard retired (Q-A sunset).** The endpoint summed all `UserDailyProgress` (solo/ranked/daily drift) and had 0 callers (web + mobile) since GD-1; Collective Growth (§18) already carries the social signal. Rather than build the BL-2 "filter by source" machinery on the hot `UserDailyProgress` table, the dead code was removed.

| # | Section | Change |
|---|---|---|
| 1 | §10 | Marked **RETIRED**. `GET /api/groups/{id}/leaderboard` → `410 Gone` `{ code:"LEADERBOARD_DEPRECATED" }`; `ChurchGroupService.getLeaderboard` deleted. §10.4 rewritten as resolution. |
| 2 | BACKLOG | **BL-16 → DONE**; **BL-2 + BL-12 → SUPERSEDED by BL-16** (the scoring drift is gone with the method). |

---

## Changelog v1.5 → v1.6 (2026-06-21)

> [BL-25] **Hành Trình Nhóm (Group Journey)** — the async + persistent + leader-guided differentiator multiplayer can't copy. The group walks through one book/topic across N weeks (chặng); each week's checkpoint is a ScheduledQuiz (§9) and progress aggregates from `ScheduledQuizAttempt`. Shipped GJ-1..8 (BE entities + migration V70 + service + endpoints; FE builder + view + Activity-tab hero + i18n).

| # | Section | Change |
|---|---|---|
| 1 | §19 (NEW) | **Hành Trình Nhóm (Group Journey)**. `GroupJourney` + `GroupJourneyWeek` (V70). Leader builds → opens each week (→ creates a ScheduledQuiz). Progress = aggregate `ScheduledQuizAttempt` (stage k/N, per-week done X/Y, no separate progress table). Endpoints `/api/groups/{id}/journeys`. |
| 2 | §7 | Live "Chơi cùng nhau" **demoted** to a secondary shortcut (D4) — the journey hero now owns the group's spotlight. |
| 3 | §19 Cross-references | renumbered → §20. |

**Decisions locked (D1–D4, 2026-06-20 — see task `docs/todo/active/2026-06-20-group-journey.md`):** D1 leader opens each week manually (deadline = ScheduledQuiz deadline; auto-weekly → v2) · D2 "done" = an attempt exists, no %-gate (score shown for encouragement) · D3 journey = protagonist; ad-hoc scheduled quizzes still supported on the same infra · D4 demote live co-play.

---

## Changelog v1.4 → v1.5 (2026-06-17)

> [BL-23] **Group Collective Growth** — the anti-leaderboard engagement hook replacing the sunset Q-A leaderboard's social signal with a non-competitive "grow together" metric (fits Tin Lành culture). Shipped CG-1..7 (BE aggregate + service + endpoint, FE card in Activity tab).

| # | Section | Change |
|---|---|---|
| 1 | §18 (NEW) | **Collective Growth — "Cùng Nhau Thuộc Lời"**. Aggregates Q-A-safe `GroupQuizSetMastery` (§3.7) into ONE non-ranking group number: "Nhóm đã cùng thuộc N câu Lời Chúa" + milestone progress + per-set breakdown. Member-visible (D5). `GET /api/groups/{id}/collective-growth`. v1 read-only (no migration). |
| 2 | §15.7 | + endpoint `GET /api/groups/{id}/collective-growth` (member-visible aggregate). |
| 3 | §18 Cross-references | renumbered → §19. |

**Decisions locked (D1–D5, 2026-06-17 — see DECISIONS.md):** hero = `SUM(questionsLearned)` (UNION distinct → v2) · source = mastery solo only (group-play → v2) · placement = Activity-tab hero · group goal → v2 (v1 auto milestones) · visibility = all members.

---

## Changelog v1.3 → v1.4 (2026-05-10)

> Driven by [PROMPT_FIX_GROUP_DETAIL.md](../group-page/PROMPT_FIX_GROUP_DETAIL.md) — 13 commits (GD-1..GD-12 + GD-DOCS), audit `GROUP_DETAIL_AUDIT_REPORT.md`.

| # | Section | Change |
|---|---|---|
| 1 | §10 Group Leaderboard | **DEPRECATED** — Q-A leaderboard sunset. UI tab removed (replaced by "Hoạt động" Activity tab); backend `GET /api/groups/{id}/leaderboard` retained 2-3 sprints for mobile compat, then `410 Gone` Sprint 8+. Personal Mastery (Sprint 5) + Activity Feed (Sprint 6 in BL-17) replace the social signal. |
| 2 | §6.x Group Detail tabs | **Tab structure** rewritten. Member view: Hoạt động · Thành viên · Thông báo · Bộ câu hỏi (4 tabs). Leader/Mod view: + Phân tích 👑 (5 tabs). Default = `activity`. Legacy `?tab=leaderboard` redirects to `activity`. Tab labels carry count badges for Members/Announcements/Quiz Sets. |
| 3 | §6.x Activity tab content | **Sprint 5 placeholder**: Quick Actions (4 cards leader / 2 cards member) + Members preview + Quiz Sets top-3 + Live Now banner (polls `/api/groups/{id}/live-rooms` every 30s) + ActivityFeedPlaceholder. **Sprint 6** will replace placeholder with full Activity Feed (BL-17). |
| 4 | §6.x Analytics tab | **Leader-only embedded tab** (was standalone page `/groups/:id/analytics`; that route is preserved as a "View full page" deep link). Surface: Cell Group Pulse placeholder (BL-18) + 4 KPI cards w/ scope tooltips + 7-day chart + inactive-members alert. |
| 5 | §6.x Empty states | KPI chart **hidden** when group <7 days OR <5 members; inactive-members alert **hidden** when <7 days, sample <5, or inactive ratio <30% (statistical noise). |
| 6 | §6.x Onboarding | **NewGroupOnboarding banner** — leader-only, shows when group <7 days OR <5 members. 3 setup tasks (invite ≥5, create first quiz set, post welcome). Dismissable per group via `localStorage.bq_onboarding_dismissed_<groupId>`. |
| 7 | §11 Group Tournament | **DEFERRED Sprint 7+** — most groups have <4 members. UI: Tournament card disabled when memberCount<4 with reason "Cần ≥4 thành viên (hiện X)". Backend bracket logic untouched. Revisit when ≥30% groups have ≥8 active members. |
| 8 | §6.x Sidebar context | When user is in `/groups/:id*` route, AppLayout sidebar **hides** personal widgets (StreakWidget + DailyMissionWidget) to avoid context drift between personal and group focus. `/groups` (list) keeps personal widgets. |
| 9 | §6.x Header / Role badge | Group name promoted to text-22px/bold. Meta row split: stats left, code-copy right with explicit content_copy icon. Role badges WCAG-AA: leader = solid gold gradient on dark text, mod = sky gradient, member = emerald. |
| 10 | §6.x Code sharing | **Group Code QR modal** (qrcode.react ^4.2.0, already a dep) launched from qr_code_2 icon button in header. Encodes `${origin}/groups?code=<CODE>` for one-tap join. |
| 11 | §12 (NEW, deferred) | **Group Activity Feed** — entity GroupActivity (V53), API `GET /api/groups/{id}/activity?type=&limit=&before=`, recorded by QuizSetMasteryService / GroupQuizSetService / RoomService / GroupAnnouncementService / ChurchGroupService / ScheduledQuizService. 90-day retention. Sprint 6 (BL-17). |
| 12 | §13 (NEW, deferred) | **Cell Group Pulse** — entity GroupPulseSnapshot (V54), heuristic `pulse = activeRatio×0.5 + (liveRoomsPerWeek/2)×0.3 + (newContentPerWeek/1)×0.2`. Status STRONG ≥0.7, MEDIUM 0.4–0.7, WEAK <0.4. Cron `0 0 1 * * *` daily. API `GET /api/groups/{id}/pulse` leader/mod-only. Sprint 6 (BL-18). |
| 13 | §17 Known Issues | Add: BL-16 Q-A backend code drift (ChurchGroupService leaderboard query sums `UserDailyProgressRepository` regardless of source — endpoint deprecated, drift becomes irrelevant when endpoint hits 410). |
| 14 | §6.x Color palette | Locked policy in `apps/web/src/components/group/GroupActivityTab.tsx`: gold #e8a832, orange #ff8c42, emerald #97C459, sky #6AB8E8, pulse-strong #4ade80. No new orange shades inside `components/group/*`. |

**Architectural decisions (Bui authorized 2026-05-10):**
1. Bỏ Leaderboard — không phù hợp văn hóa Tin Lành (ranking sinh hoạt nhóm). Activity Feed thay social signal.
2. Tournament defer — UI gate, backend kept; revisit at adoption threshold.
3. Activity Feed deferred to Sprint 6 (entity + service + cron).
4. Pulse heuristic approved with `0.5/0.3/0.2` weights and `0.7/0.4` thresholds, cron daily 1am.

---

## Changelog v1.2 → v1.3

| # | Section | Thay đổi |
|---|---|---|
| 1 | §3.3 | **GroupQuizSet entity expanded** (Sprint 5): +16 fields metadata (description, cover, tags, scripture, suggested_mode, difficulty, duration, play_count, rating, publish_status, folder_id). Migration V50. |
| 2 | §3.7 (NEW) | **GroupQuizSetMastery entity** — track personal mastery (questions_learned, total_attempts, best_score, completed_mastery). Q-A safe — KHÔNG vào group leaderboard. Migration V51. |
| 3 | §3.8 (NEW) | **GroupQuizSetFolder entity** — group quiz sets vào folders. Migration V52. |
| 4 | §6 REWRITE | Quiz Sets nâng cấp full: lifecycle 4 statuses (DRAFT/PUBLISHED/ARCHIVED/SOFT_DELETED), multi-mode play (5 modes), mastery tracking, content management. |
| 5 | §7 | Live Rooms relax `GROUP_LIVE_SEQUENTIAL` constraint — quiz set có thể chơi cả 5 modes. Default mode = `quizSet.suggestedMode` hoặc Sequential. |
| 6 | §10.2 | Clarify Mastery KHÔNG đóng góp leaderboard (Q-A vẫn intact). |
| 7 | §15.4 | Thêm 4 endpoints: PATCH publish/archive/unarchive, POST clone. |
| 8 | §17 | Closed: "quiz set chỉ Sequential" — Sprint 5 fixed. New BACKLOG: marketplace defer v2.5. |

**Sprint 5 decisions (chốt 2026-05-09):**
1. **Multi-mode play** ✅ Implement — Quiz Set chơi với cả 5 modes
2. **Personal Mastery** ✅ Implement riêng — KHÔNG break Q-A leaderboard locked
3. **Marketplace/Discovery** ⏭️ Defer v2.5 — chưa critical mass, cần moderation
4. **Workflow** 4 statuses (skip TESTING)
5. **Scheduled vs Live Room** Giữ riêng, relax constraints — refactor unified concept defer Sprint 6

## Changelog v1.1 → v1.2

| # | Section | Thay đổi |
|---|---|---|
| 1 | §2, §10 | **Q-A clarified (Bui 2026-05-09)**: group leaderboard = group-play-only. Solo Practice/Ranked/Daily KHÔNG đóng góp. Code hiện tại còn sum `UserDailyProgress` → ghi BACKLOG. |
| 2 | §3 | Tách entity model rõ ràng: ChurchGroup + GroupMember + GroupQuizSet + GroupAnnouncement + GroupKickLog (V41) + GroupReport (V41) + ScheduledQuiz (V40) + ScheduledQuizAttempt. |
| 3 | §4 | Permission matrix dựa trên enum thật `LEADER/MOD/MEMBER` trong code (`GroupMember.GroupRole:14-16`). |
| 4 | §7 | Q-N clarified: BE rename `/live-quiz` → `/live-rooms` đã ship (`ChurchGroupController.java:670-741`); FE KHÔNG có route `/live-rooms` riêng — list inline trong `GroupDetail.tsx`. |
| 5 | §9 | Scheduled quizzes (V40) chi tiết: create/attempt/leaderboard, cron deadline. |
| 6 | §13 | Reports (V41): member → admin queue. |
| 7 | §17 | Known Issues consolidated, link → BACKLOG.md. |
| 8 | §18 | Multi-leader REMOVED khỏi spec → SPEC_ROADMAP.md (per Bui lock). |

**Backward compatibility v1.2**: align hoàn toàn với code đã ship.
**Backward compatibility v1.3**: V50 migration ADD COLUMN only (additive). Existing rows backfill `publish_status='PUBLISHED'`. NULL metadata fields acceptable.

---

## Mục lục

1. Mục đích
2. Locked Decisions (Q-A...Q-O)
3. Group Model
4. Roles & Permissions
5. Group Lifecycle
6. Group Quiz Sets (Q-O)
7. Live Rooms (Q-N)
8. Sequential mode (Q-B)
9. Scheduled Quizzes (V40)
10. Group Leaderboard (Q-A clarified)
11. Group Analytics
12. Announcements
13. Reports (V41)
14. Streak (GroupStreakService)
15. API Endpoints
16. WebSocket events
17. Known Issues
18. Collective Growth (Cùng nhau thuộc Lời)
19. Hành Trình Nhóm (Group Journey — BL-25)
20. Cross-references

---

## 1. Mục đích

Church Group là **feature differentiator** của BibleQuiz. Trong khi solo modes (Practice / Ranked / Daily) phục vụ học cá nhân, Church Group phục vụ **ministry hội thánh**: nhóm tế bào, Trường Chúa Nhật, ban thanh niên, ban giáo phẩm.

**3 use cases chính**:

| Use case | Activity type | Group size |
|---|---|---|
| Ôn bài sau buổi nhóm tế bào | Live "Chơi cùng nhau" sequential | 8-15 |
| Quiz tuần Trường Chúa Nhật | Scheduled quiz async | 15-30 |
| Bible challenge cả hội thánh | Scheduled quiz + Group Leaderboard | 100-200 |

**Spec này định nghĩa**: data model + roles + lifecycle + leaderboard semantics + API contract cho v1.2 (hậu beta cleanup).

---

## 2. Locked Decisions (Q-A...Q-O — verbatim from v1.1)

| ID | Decision | Status v1.2 | Source |
|---|---|---|---|
| **Q-A** | **Group leaderboard scope** | 🔒 **LOCKED — group-play-only** (Bui 2026-05-09 clarification) | AUDIT_SUMMARY.md Bui Q2 |
| Q-B | Sequential live mode = leader manual advance (KHÔNG auto, KHÔNG pause config) | 🔒 LOCKED ✅ shipped | v1.1 §8.4 |
| Q-C | Concurrent live rooms — mỗi click "Chơi cùng nhau" tạo room mới, KHÔNG dedup | 🔒 LOCKED ✅ shipped | v1.1 §8.2 |
| Q-D | Mod role giữ trong v1+ (LEADER/MOD/MEMBER enum) | 🔒 LOCKED ✅ shipped | `GroupMember.GroupRole:14-16` |
| Q-E | Backend max-2-groups-owned constraint | 🔒 LOCKED — gap, track BACKLOG | v1.1 §4.2 |
| Q-F | Backend max-5-groups-joined constraint | 🔒 LOCKED — gap, track BACKLOG | v1.1 §4.3 |
| Q-G | Soft delete grace 7 ngày, restore qua email link | 🔒 LOCKED | v1.1 §3.4 |
| Q-H | Auto-detect Inactive sau 30 ngày no activity | 🔒 LOCKED | v1.1 §3.3 |
| Q-I | Welcome flow: push noti + banner 24h + welcome message | 🔒 LOCKED | v1.1 §4.4 |
| Q-J | 1 user chỉ trong 1 active live room tại 1 thời điểm | 🔒 LOCKED — gap | v1.1 §8.7 |
| Q-K | Push notifications (11 events) — incremental implement | 🔒 LOCKED — gap | v1.1 §11 |
| Q-L | 7-day re-join cooldown sau kick | 🔒 LOCKED — gap, V41 GroupKickLog ready | v1.1 §12.2 |
| Q-M | Member report group endpoint (V41 GroupReport ready) | 🔒 LOCKED | v1.1 §12.4 |
| Q-N | Endpoint name `/api/groups/{id}/live-rooms` (rename từ `/live-quiz`) | 🔒 LOCKED ✅ BE shipped (`ChurchGroupController.java:677,741`); FE KHÔNG có route SPA riêng — inline GroupDetail.tsx | v1.1 §13.5 |
| Q-O | Quiz Set lưu `question_ids` JSON (KHÔNG dùng join table) | 🔒 LOCKED ✅ shipped | `GroupQuizSet.java` (`question_ids JSON NOT NULL`) |

### 2.1 Q-A clarification (Bui 2026-05-09) — IMPORTANT

**Câu hỏi gốc**: Có tính score của solo Practice / Ranked / Daily Challenge vào Group Leaderboard không?

**Bui lock 2026-05-09**: **KHÔNG. Group leaderboard = group-play-only.**

| Activity | Đóng góp Group Leaderboard? |
|---|---|
| ✅ Group live room ("Chơi cùng nhau") score | **CÓ** (sum across rooms) |
| ✅ Scheduled quiz attempts (best per quiz) | **CÓ** |
| ❌ Solo Practice mode (kể cả từ group quiz set "Tự ôn solo") | **KHÔNG** |
| ❌ Ranked Mode | **KHÔNG** (đã có global leaderboard riêng) |
| ❌ Daily Challenge | **KHÔNG** |

**Rationale**:
- Group leaderboard reflect **group activity** (cùng nhau chơi). Solo là activity cá nhân, không có group context.
- Member chăm chỉ tự ôn solo sẽ leo top dù không tham gia group → unfair với người tham gia thật.
- Anti-farm: prevent member spam solo để leo rank giả tạo.

**Code reality (BACKLOG)**:
- `ChurchGroupService.java:227,511,518,523,572,578,582` hiện đang query `UserDailyProgressRepository` (sum tất cả progress, bao gồm solo).
- → Code KHÔNG match Q-A lock.
- → **BACKLOG action**: refactor leaderboard query → chỉ aggregate từ `group_live_room_score` + `scheduled_quiz_attempt`. Track trong BACKLOG.md.
- → Spec v1.2 là source of truth; code phải catch up.

---

## 3. Group Model

### 3.1 ChurchGroup entity

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/ChurchGroup.java`

| Field | Type | Migration | Notes |
|---|---|---|---|
| `id` | BIGINT PK | V1 | |
| `name` | VARCHAR(50) | V1 | required, 3-50 chars |
| `description` | VARCHAR(200) | V1 | optional |
| `code` | VARCHAR(6) UNIQUE | V1 | A-Z 0-9, auto-gen |
| `privacy` | ENUM(PUBLIC, PRIVATE) | V1 | default PUBLIC |
| `status` | ENUM(ACTIVE, INACTIVE, ARCHIVED, LOCKED, SOFT_DELETED) | V1 | |
| `creator_user_id` | BIGINT FK | V1 | |
| `created_at`, `last_activity_at` | TIMESTAMP | V1 | |
| `deleted_at` | TIMESTAMP NULL | **V13** | soft delete tombstone |
| `locked_at` | TIMESTAMP NULL | **V19** | admin lock timestamp |
| `locked_reason` | TEXT | V19 | admin note |
| `orphan_at` | TIMESTAMP NULL | V1 | grace timer (Q-G) |

**State transitions**: ACTIVE ↔ INACTIVE (auto Q-H) → ARCHIVED (leader) | LOCKED (admin V19) | SOFT_DELETED (V13 deleted_at) → hard delete sau 7d.

### 3.2 GroupMember entity

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupMember.java:14-16`

```java
public enum GroupRole {
    LEADER, MOD, MEMBER
}
```

| Field | Type | Migration | Notes |
|---|---|---|---|
| `id` | BIGINT PK | V1 | |
| `group_id`, `user_id` | BIGINT FK | V1 | UNIQUE(group_id, user_id) |
| `role` | ENUM(LEADER, MOD, MEMBER) | V1 | default MEMBER (Q-D locked) |
| `status` | ENUM(ACTIVE, LEFT, KICKED, BANNED) | V1 | |
| `joined_at`, `promoted_at`, `left_at` | TIMESTAMP | V1 | |
| `promoted_by_user_id` | BIGINT FK | V1 | audit |
| `kick_reason` | TEXT | V1 | populated khi status=KICKED |
| `last_active_at` | TIMESTAMP | **V32** | for analytics + Inactive auto-detect |

### 3.3 GroupQuizSet entity (Q-O + Sprint 5)

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupQuizSet.java`

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id` | BIGINT FK | CASCADE delete |
| `creator_user_id` | BIGINT FK | LEADER/MOD only |
| `name` | VARCHAR(100) | required, 5-100 chars |
| `question_ids` | **JSON NOT NULL** | Q-O locked: JSON array, KHÔNG join table |
| `total_questions` | INT | derived from question_ids length |
| `language` | ENUM(VI, EN) | default VI |
| **Sprint 5 metadata fields:** | | |
| `description` | VARCHAR(500) NULL | Markdown supported, mô tả ngắn về quiz set |
| `cover_image_url` | VARCHAR(500) NULL | URL ảnh bìa, fallback emoji icon nếu null |
| `tags` | JSON NULL | Array of tag strings, max 5 tags |
| `cover_scripture` | VARCHAR(100) NULL | VD "Mathiơ 28", reference Kinh Thánh chính |
| `author_note` | VARCHAR(1000) NULL | Hướng dẫn cho người chơi |
| `difficulty` | ENUM(EASY, MEDIUM, HARD, MIXED) NULL | Auto-derived từ questions, có thể override |
| `estimated_duration_min` | INT NULL | Auto: totalQuestions × 30s / 60 |
| `suggested_mode` | VARCHAR(50) NULL | RoomMode enum value (default mode khi tạo live room) |
| `play_count` | INT NOT NULL DEFAULT 0 | Tăng async khi room ENDED |
| `average_rating` | DECIMAL(3,2) NULL | 1.00-5.00, từ player feedback |
| `total_ratings` | INT NOT NULL DEFAULT 0 | |
| `last_played_at` | TIMESTAMP NULL | Last room ENDED time |
| `publish_status` | ENUM(DRAFT, PUBLISHED, ARCHIVED, SOFT_DELETED) NOT NULL DEFAULT DRAFT | Workflow Sprint 5 (replace cũ ACTIVE/ARCHIVED/SOFT_DELETED) |
| `published_at` | TIMESTAMP NULL | Stamp khi publish |
| `folder_id` | BIGINT NULL | FK → group_quiz_set_folder, ON DELETE SET NULL |
| **Existing tombstones:** | | |
| `archived_at`, `deleted_at` | TIMESTAMP | |

**Q-O rationale**: Always need full question list khi serve quiz set → JSON simpler than JOIN, atomic update, no N+1.

**Sprint 5 status migration:** Existing rows tự động backfill `publish_status='PUBLISHED'`, `published_at=updated_at`. NULL metadata fields acceptable.

**Backward compat:** Code đọc quiz set vẫn work với fields mới NULL.

### 3.4 GroupAnnouncement entity

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupAnnouncement.java`

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id`, `author_user_id` | BIGINT FK | |
| `title` | VARCHAR(50) | |
| `content` | TEXT | markdown supported |
| `is_pinned` | BOOLEAN | max 3 pinned per group |
| `created_at` | TIMESTAMP | |

### 3.5 GroupKickLog + GroupReport (V41) — feature 14

**Files**:
- `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupKickLog.java`
- `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupReport.java`
- Migration: `V41__group_kick_log_and_reports.sql`

**GroupKickLog** — audit trail cho mọi kick action; cũng là source cho 7-day cooldown enforcement (Q-L).

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id`, `kicked_user_id`, `kicker_user_id` | BIGINT FK | |
| `reason` | TEXT | required |
| `kicked_at` | TIMESTAMP | |

Q-L cooldown query: `WHERE kicked_user_id = X AND group_id = Y AND kicked_at > NOW() - INTERVAL 7 DAY`.

**GroupReport** — member báo cáo group (Q-M).

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id`, `reporter_user_id` | BIGINT FK | |
| `reason` | ENUM(SPAM, INAPPROPRIATE, HARASSMENT, OTHER) | |
| `note` | TEXT | optional |
| `status` | ENUM(OPEN, REVIEWED, ACTIONED, DISMISSED) | default OPEN |
| `created_at` | TIMESTAMP | |

Admin queue: `WHERE status = 'OPEN' ORDER BY created_at`.

### 3.6 ScheduledQuiz + ScheduledQuizAttempt (V40) — feature 13

**Files**:
- `apps/api/src/main/java/com/biblequiz/modules/group/entity/ScheduledQuiz.java`
- `apps/api/src/main/java/com/biblequiz/modules/group/entity/ScheduledQuizAttempt.java`
- Service: `apps/api/src/main/java/com/biblequiz/modules/group/service/ScheduledQuizService.java`
- Cron: `apps/api/src/main/java/com/biblequiz/modules/group/service/ScheduledQuizScheduler.java`
- Migration: `V40__scheduled_quizzes.sql`

**ScheduledQuiz**:

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id`, `quiz_set_id`, `creator_user_id` | BIGINT FK | |
| `name`, `description` | VARCHAR / TEXT | |
| `deadline` | TIMESTAMP | required |
| `attempts_per_user` | INT | default 3 |
| `show_public_leaderboard` | BOOLEAN | default TRUE |
| `status` | ENUM(ACTIVE, ENDED, CANCELLED) | |
| `winner_user_id` | BIGINT FK NULL | populated by cron khi ENDED |

**ScheduledQuizAttempt**:

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `scheduled_quiz_id`, `user_id` | BIGINT FK | |
| `attempt_number` | INT | 1..attempts_per_user |
| `score` | INT | best per user used for leaderboard |
| `correct_count`, `total_time_ms` | INT / BIGINT | |
| `completed_at` | TIMESTAMP | |

Index: `(scheduled_quiz_id, user_id, score DESC)` cho fast leaderboard query.

### 3.7 GroupQuizSetMastery entity (Sprint 5) — Q-A safe

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupQuizSetMastery.java`
**Migration**: V51

Track personal mastery progress của user với 1 quiz set. **KHÔNG đóng góp Group Leaderboard** (Q-A locked vẫn intact). Đây là personal stats để member có incentive ôn tập.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `quiz_set_id` | BIGINT FK | CASCADE delete khi quiz set bị hard-delete |
| `user_id` | BIGINT FK | |
| `learned_question_ids` | JSON | Set of question IDs đã trả lời đúng ≥ 1 lần (không double-count) |
| `questions_learned` | INT NOT NULL DEFAULT 0 | Derived = `len(learned_question_ids)` |
| `total_attempts` | INT NOT NULL DEFAULT 0 | Số lần solo practice quiz set này |
| `best_score` | INT NOT NULL DEFAULT 0 | Best practice score |
| `best_accuracy` | DECIMAL(5,2) NULL | Best % accuracy |
| `last_practiced_at` | TIMESTAMP NULL | |
| `completed_mastery` | BOOLEAN NOT NULL DEFAULT FALSE | True khi `questions_learned >= total_questions` |
| `completed_mastery_at` | TIMESTAMP NULL | First time completed |
| `created_at`, `updated_at` | TIMESTAMP | |

**Constraints:**
- UNIQUE (`quiz_set_id`, `user_id`)
- INDEX `(user_id, completed_mastery)` cho personal achievements query

**Tracking logic** (`GroupQuizSetMasteryService.recordPracticeSession`):
1. Hook khi user complete 1 solo practice session từ Group Quiz Set (`QuizSessionService.completeSession`)
2. Union `learned_question_ids` với câu trả lời đúng trong session này
3. Update `questions_learned`, `total_attempts`, `best_score` (nếu cao hơn)
4. Check completed mastery: `if (learned_question_ids.size() >= quiz_set.total_questions)` → set `completed_mastery=true` + trigger achievement notification

**Q-A guard:** `recordPracticeSession` KHÔNG call `UserDailyProgressRepository.save()` cho group leaderboard purposes. Mastery chỉ track personal, độc lập với leaderboard.

**Personal Achievements** (defer Sprint 6 cho UI nhưng track ngay từ Sprint 5):
- 🏆 "Mastered: {QuizSetName}" — `completed_mastery=true` lần đầu
- 🔥 "Dedicated: {QuizSetName}" — `total_attempts >= 10`
- ⭐ "Perfect: {QuizSetName}" — `best_accuracy >= 100`

### 3.8 GroupQuizSetFolder entity (Sprint 5)

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupQuizSetFolder.java`
**Migration**: V52

Folders để group leader/mod organize quiz sets (vd "Bài giảng 2026", "Sinh hoạt thiếu nhi").

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `group_id` | BIGINT FK | CASCADE delete |
| `name` | VARCHAR(50) | required |
| `color` | VARCHAR(7) NULL | Hex color cho UI hint |
| `display_order` | INT NOT NULL DEFAULT 0 | Drag-and-drop reorder |
| `created_by_user_id` | BIGINT FK | |
| `created_at` | TIMESTAMP | |

**Constraints:**
- INDEX `(group_id, display_order)`
- `GroupQuizSet.folder_id` FK → này, ON DELETE SET NULL (xóa folder không xóa quiz sets)

**Permissions:**
- LEADER/MOD: tạo/sửa/xóa folder
- MEMBER: chỉ xem folder structure

---

## 4. Roles & Permissions

### 4.1 Leader 👑 (gold) — C6 visual

- Người tạo group; auto-promote khi `creator_user_id` join lần đầu.
- Visual: gold crown 👑 + gold name color.
- Quyền tối cao: edit group, lock, delete, kick, promote/demote mod.

### 4.2 Mod 🛡️ (blue) — C6 visual

- Co-helper được leader cấp quyền (Q-D locked, KHÔNG remove).
- Visual: blue shield 🛡️ + blue name color.
- Quyền tạo content: quiz set, live room, scheduled quiz, announcement.
- KHÔNG được: kick, lock, promote khác.

### 4.3 Member (plain) — C6 visual

- Default role khi join.
- Visual: không icon, name màu thường.
- Quyền: chơi activities, xem leaderboard, leave, report group.

### 4.4 Permission matrix

| Action | Leader 👑 | Mod 🛡️ | Member |
|---|---|---|---|
| **Group Management** | | | |
| Edit group info | ✅ | ❌ | ❌ |
| Toggle privacy | ✅ | ❌ | ❌ |
| Lock/unlock group | ✅ (admin lock V19 separate) | ❌ | ❌ |
| Soft delete group (V13) | ✅ | ❌ | ❌ |
| Invite via code | ✅ | ✅ | ❌ |
| Kick member (log to GroupKickLog) | ✅ | ❌ | ❌ |
| Promote member to mod | ✅ | ❌ | ❌ |
| Demote mod | ✅ | ❌ | ❌ |
| **Quiz Sets** | | | |
| Create quiz set | ✅ | ✅ | ❌ |
| Edit/delete own quiz set | ✅ | ✅ | ❌ |
| Edit/delete others' quiz set | ✅ | ❌ | ❌ |
| Archive quiz set | ✅ | ✅ | ❌ |
| **Live Rooms (Q-N)** | | | |
| Create live room (`POST /live-rooms`) | ✅ | ✅ | ❌ |
| Join live room | ✅ | ✅ | ✅ |
| Manual advance (Q-B) | ✅ (host) | ✅ (host) | ❌ |
| Force end room | ✅ (host) | ✅ (host) | ❌ |
| **Scheduled Quizzes** | | | |
| Create scheduled quiz | ✅ | ✅ | ❌ |
| Cancel before deadline | ✅ | ✅ (own) | ❌ |
| Attempt scheduled quiz | ✅ | ✅ | ✅ |
| **Communications** | | | |
| Post announcement | ✅ | ✅ | ❌ |
| Pin announcement | ✅ | ✅ (own) | ❌ |
| **Member actions** | | | |
| View leaderboard | ✅ | ✅ | ✅ |
| View member list | ✅ | ✅ | ✅ |
| Leave group | ❌ (must transfer/delete) | ✅ | ✅ |
| Report group (V41) | ❌ | ✅ | ✅ |

**Backend enforcement**: Mọi POST/PATCH/DELETE qua `@PreAuthorize` helper trong `ChurchGroupController.java`. Client check chỉ là UX hint.

---

## 5. Group Lifecycle

### 5.1 Create

```
POST /api/groups { name, description, privacy, welcomeMessage, avatar }
  ↓
Backend:
  - Check creator group count (Q-E gap — chưa enforce)
  - Generate unique 6-char code (A-Z 0-9, retry on collision)
  - Create ChurchGroup (status=ACTIVE)
  - Create GroupMember (role=LEADER, status=ACTIVE)
  - Set last_activity_at = NOW()
  ↓
Return group detail
```

### 5.2 Join

**Public**: `POST /api/groups/{id}/join` → check status=ACTIVE → check Q-J/Q-F limits → insert GroupMember.

**By code**: `POST /api/groups/join-by-code { code }` → lookup group → same checks → insert.

**Welcome flow (Q-I)**: push noti to leader/mod + banner 24h cho member mới + auto-send welcome_message.

### 5.3 Leave

`POST /api/groups/{id}/leave`:
- Member/Mod: status → LEFT, left_at = NOW(). Score history giữ với tag "(đã rời)".
- Leader: BLOCK với message "Bạn là leader cuối, hãy transfer hoặc delete group".
  - **v1.2 (current)**: KHÔNG có transfer ownership UI/endpoint → leader buộc phải `DELETE /api/groups/{id}` (soft delete). Members mất group → join group khác.
  - **Decision (Bui canonical 2026-05-09)**: Defer transfer-ownership đến v1.5 (đi kèm Multi-leader system trong [SPEC_ROADMAP.md](SPEC_ROADMAP.md) §2.1). Rationale: transfer ownership single-leader cần permission UI riêng; gộp với multi-leader rollout để 1 lần ship tránh re-design.
  - Workaround v1.2: leader đề bạt 1 MOD lên LEADER trước khi delete? **KHÔNG** — chỉ có 1 LEADER per group ở v1.2 (`leader_id` foreign key ChurchGroup, không phải role enum). MOD không thể "promote" thành LEADER.
  - **Hard fact**: muốn handover → leader đành delete + member mới tạo lại + invite cũ trở lại.

### 5.4 Kick (with V41 GroupKickLog)

`DELETE /api/groups/{id}/members/{userId} { reason }`:
1. Check caller is LEADER.
2. Update GroupMember status=KICKED, kick_reason=...
3. **Insert GroupKickLog** (audit trail).
4. Push noti to kicked user.
5. **Q-L**: future joins blocked qua GroupKickLog query (gap).

### 5.5 Lock (admin action V19)

`PATCH /api/admin/groups/{id}/lock { reason }`:
- Set status=LOCKED, locked_at=NOW(), locked_reason=reason.
- Member thấy banner đỏ "🔒 Nhóm bị khóa: [reason]".
- Read-only mode: không tạo activity, không post.
- Member có thể leave tự do.

### 5.6 Soft delete (V13 deleted_at)

`DELETE /api/groups/{id}`:
- Leader-only.
- Confirm modal với input tên group.
- Set status=SOFT_DELETED, **deleted_at=NOW()**, orphan_at=NOW().
- Push noti tất cả member.
- Cron daily: `WHERE deleted_at < NOW() - INTERVAL 7 DAY` → hard delete CASCADE.
- Restore qua email link trong 7d (Q-G).

---

## 6. Group Quiz Sets (Q-O + Sprint 5)

**Ownership**: thuộc group, không phải user. Tạo bởi LEADER/MOD, dùng được bởi tất cả members. MEMBER không tạo nhưng có thể practice solo + tham gia live rooms.

**Constraints (Sprint 5):**
- Max 20 active quiz sets per group (count = DRAFT + PUBLISHED + ARCHIVED, không tính SOFT_DELETED)
- Min 5, max 50 questions per set
- Q-O: `question_ids` JSON array (NOT join table). Đổi câu = update JSON atomic.
- Max 5 tags per quiz set

### 6.1 Lifecycle & Workflow (Sprint 5)

4 statuses thay cũ ACTIVE/ARCHIVED/SOFT_DELETED:

```
[DRAFT] ──publish──→ [PUBLISHED] ──archive──→ [ARCHIVED] ──delete──→ [SOFT_DELETED]
                          ↑                         │
                          └───────unarchive─────────┘
                                                                          │
                                                              30 days ────→ HARD DELETE
```

| Status | Visibility | Editable | Playable | Notes |
|---|---|---|---|---|
| **DRAFT** | Creator + LEADER/MOD | ✅ Yes | ❌ No | Đang xây, chưa publish. Min questions không enforced. |
| **PUBLISHED** | All group members | ⚠️ Warning if `play_count > 0` | ✅ Yes | Status chính thức. Members thấy trong list. |
| **ARCHIVED** | All group members (read-only) | ❌ No | ❌ No | Quiz cũ giữ lại reference. Không tạo room mới được. |
| **SOFT_DELETED** | Hidden từ tất cả non-admin | ❌ No | ❌ No | Pending hard delete sau 30 days |

**Transition rules:**
- DRAFT → PUBLISHED: cần ≥5 câu hỏi; auto-derive `difficulty` + `estimated_duration_min`; stamp `published_at`
- PUBLISHED → ARCHIVED: BLOCK nếu có `ScheduledQuiz` ACTIVE đang dùng quiz set này
- ARCHIVED → PUBLISHED: cho phép unarchive, reset `published_at` (giữ play_count)
- Any → SOFT_DELETED: chỉ creator hoặc LEADER, BLOCK nếu có active scheduled quiz
- SOFT_DELETED → HARD DELETE: scheduler 2am daily, sau 30 days

**Endpoints (Sprint 5):**
- `PATCH /api/groups/{id}/quiz-sets/{setId}/publish`
- `PATCH /api/groups/{id}/quiz-sets/{setId}/archive`
- `PATCH /api/groups/{id}/quiz-sets/{setId}/unarchive`
- `DELETE /api/groups/{id}/quiz-sets/{setId}` — soft delete

### 6.2 Multi-mode play (Sprint 5)

Quiz Set có thể chơi với **bất kỳ** trong 5 modes của SPEC_MULTIPLAYER:

| Mode | Use case | Constraint |
|---|---|---|
| **Speed Race** ⚡ | Vui nhộn, thiếu nhi, sinh hoạt | Không hạn chế |
| **Sequential** 📚 | Lớp học sâu, host dẫn dắt từng câu | Default cho group quiz |
| **Team vs Team** ⚔️ | 2 nhóm tế bào đối kháng | Cần ≥6 câu, số chẵn |
| **Battle Royale** 💀 | Event lớn, kịch tính | Cần ≥4 câu |
| **Sudden Death** 🥊 | Final showdown 1v1 | Cần ≥10 câu |

**Default mode logic:**
1. Nếu `quizSet.suggestedMode` set → dùng nó
2. Nếu null → fallback `GROUP_LIVE_SEQUENTIAL`
3. Leader có thể override khi tạo live room

**Validation in `ChurchGroupService.createLiveRoom`:**
- Battle Royale: `total_questions >= 4`
- Sudden Death: `total_questions >= 10`
- Team vs Team: `total_questions >= 6 && total_questions % 2 == 0`
- Khác: không hạn chế

**Sprint 4 integration:** Tất cả live rooms từ Quiz Set tự động dùng Quản trò mode (`hostPlaysGame=false`) — host điều phối, không chơi.

**Quick actions on Quiz Set card (added 2026-05-10):** Trong màn hình Quiz Set list ([apps/web/src/pages/group/QuizSetList.tsx](../../apps/web/src/pages/group/QuizSetList.tsx)), mỗi card `PUBLISHED` hiển thị 2 button shortcut ở footer:
- **👥 Chơi cùng** — mở `ModePickerModal` (5 multiplayer modes + scheduled). Visible cho mọi role. Picking mode → `POST /api/groups/{id}/live-rooms` → navigate `/room/{code}`.
- **📅 Đặt lịch** — navigate `/groups/{id}/scheduled-quizzes/new?quizSetId={setId}`. **Chỉ hiện cho LEADER/MOD** (member không thấy nút).

Card click area (ngoài 2 button) → navigate quiz set detail. Button click stops propagation. Card không hiện 2 button khi `publishStatus !== 'PUBLISHED'`. Solo Practice không có shortcut trên card (vẫn truy cập từ detail page) để giữ card gọn.

### 6.3 Personal Mastery (Sprint 5) — Q-A safe

**Tự ôn solo (member)**: vào Practice mode với câu hỏi từ quiz set.
- ✅ **Track personal mastery** (`group_quiz_set_mastery` table)
- ✅ **Update best_score, best_accuracy, total_attempts**
- ✅ **Trigger achievement** khi `completed_mastery=true`
- ❌ **KHÔNG tính XP** (Q-A locked)
- ❌ **KHÔNG vào group leaderboard** (Q-A locked)

UI hiển thị mastery progress trên detail page:
```
🎯 Tiến độ học của bạn
████████░░ 80%
Đã thuộc 12/15 câu · 4 lần ôn · Best 92%
```

**Mastery vs Group Leaderboard separation:**
- Mastery = personal stats (cá nhân)
- Group Leaderboard = group-play activity (Q-A 2026-05-09 locked)
- 2 systems hoàn toàn độc lập, KHÔNG share data

### 6.4 Content management (Sprint 5)

**Folders** (`group_quiz_set_folder` table):
- LEADER/MOD tạo folder để group quiz sets ("Bài giảng 2026", "Sinh hoạt thiếu nhi")
- Quiz set có thể NULL folder (uncategorized)
- Drag-and-drop reorder folders (Sprint 6)

**Search & filter** (Sprint 5):
- Search by name (LIKE query)
- Filter by `publish_status` (DRAFT/PUBLISHED/ARCHIVED)
- Filter by folder
- Sort: popular (play_count DESC) / recent (published_at DESC) / name (A-Z) / rating (avg_rating DESC)

**Clone** (Sprint 5):
- `POST /api/groups/{id}/quiz-sets/{setId}/clone` — duplicate quiz set với status=DRAFT
- Use case: copy template, modify cho mục đích khác

**Bulk actions** (defer Sprint 6): multi-select → archive/move folder/delete cùng lúc.

**Import/Export** (defer Sprint 6): JSON/CSV để backup hoặc share offline.

### 6.A Group AI Question Generation (BL-AD-7, 2026-05-12)

> **ĐÃ BỎ (13/10/2026, AIR — DECISIONS 2026-10-13):** không còn sinh câu hỏi bằng AI ở bất kỳ đâu. Phần dưới giữ làm lịch sử; mã, endpoint, cấu hình khóa AI đã gỡ. Câu đã có trong kho (kể cả nguồn `ai-generated`/`ai-group`/`AI`) giữ nguyên.

LEADER/MOD có thể dùng AI để tạo draft câu hỏi cho quiz set của nhóm.

**Endpoint:** `POST /api/groups/{id}/ai-generate` (`ChurchGroupController.java:932+`).

**Workflow:** Tích hợp trong Quiz Set Editor page (§6.B). Modal 2-tab cũ đã được thay thế — xem §6.B.

**Không có:**
- Model selector — group leader luôn dùng default provider (D3); selector chỉ admin thấy ở `/admin/ai-generator`.
- Admin review queue — drafts đi thẳng vào quiz set của nhóm (D4). Leader chịu trách nhiệm verify chất lượng.

**Quota:** Cùng pool 200/day shared globally với admin (D5; xem SPEC_ADMIN §7.4). Vượt → HTTP 429 với toast "Đã đạt giới hạn AI hôm nay. Vui lòng thử lại ngày mai."

**Permission:** Chỉ LEADER hoặc MOD của nhóm đó (`requireLeaderOrMod`). MEMBER → 403.

**Response:** `{ success: true, questions: [...], provider: "deepseek" }` (provider field surfaced cho debug/audit; FE không hiển thị).

### 6.B Quiz Set Editor Page (BL-AD-8, 2026-05-13)

Thay thế modal 2-tab "AI tạo / Tự soạn" cũ. Mọi việc create/edit câu hỏi đều thực hiện trên 1 trang editor thống nhất.

**Routes:**
- `/groups/{groupId}/quiz-sets/new` — create. Auto-tạo DRAFT trống rồi redirect.
- `/groups/{groupId}/quiz-sets/{setId}/edit` — edit existing.

**Permission:** LEADER/MOD của nhóm. MEMBER → 403.

**Layout (per mockup canonical `docs/mockups/quiz_set_editor_unified_page.html`):**
- Top bar: back · tên bộ · status badge (NHÁP/ĐÃ XUẤT BẢN, hiện "Đã lưu Ns trước") · pill AI quota · Lưu nháp · Xuất bản
- Metadata accordion: tên · sách (dropdown 66 books) · chapter range
- Body 2-col (260px sidebar | editor):
  - Sidebar: DistributionBar (dễ/TB/khó count) → question list (border-left 3px difficulty, ✓/⚠ status icon, ✨ AI / ✏️ manual source icon, "ĐANG SỬA" pill on active) → 2 buttons "⚡ AI tạo nháp" + "+ Thêm thủ công"
  - Editor: header (#N · difficulty segmented · AI viết lại / Copy / Delete) → textarea câu hỏi → 4 đáp án A/B/C/D (radio circle để pick correct, ANSWER_OPTION_COLORS canonical) → grid 2-col explanation + scripture ref input

**Mobile (per `quiz_set_editor_mobile.html`):** < 768px stack 1 cột. Metadata bar collapsed → button "Sửa" (deferred to dedicated sheet). Progress segments thay sidebar. Bottom: sticky 3-row action bar (prev/next · AI tạo nháp / Thêm tay · Xuất bản full-width).

**AI integration:**
- "⚡ AI tạo nháp" (sidebar): mở `AIGeneratePanel` với 3 steppers Dễ/TB/Khó (mỗi tier 0-15) + presets ("Đều nhau", "40/40/20"). Submit → `POST /quiz-sets/{setId}/ai-generate` (D4: auto-link vào set, source=`ai-group`).
- "AI viết lại" per câu: mở `AIRewriteModal` side-by-side old/new. Submit → `POST /quiz-sets/{setId}/questions/{qid}/ai-rewrite` (return draft WITHOUT save). User accept → frontend patches.
- KHÔNG có concept "AI mode" vs "Manual mode" — AI là tool button trong editor thống nhất.

**Workflow statuses (Sprint 5 reuse):**
- DRAFT: auto-save mỗi 30s + debounce 2s on field change; members không thấy
- PUBLISHED: members thấy + play được
- ARCHIVED: ẩn nhưng giữ kết quả cũ
- SOFT_DELETED: 30 ngày hard delete

**Auto-save:**
- Field change → debounce 2s → `PATCH /quiz-sets/{setId}/questions/{qid}` (per-question) hoặc `PATCH /quiz-sets/{setId}` (metadata)
- 30s interval → forced flush
- Question switch / tab close / route navigate → React Router blocker prompt nếu pending; force flush trước proceed

**Validation (block Publish via PublishConfirmModal):**
- Tên bộ ≥ 3 ký tự
- ≥ 5 câu hỏi (match BE `ChurchGroupService.publishQuizSet` rule)
- Mỗi câu valid: content ≥ 10 chars · 4 options ≥ 1 char · correct marked · explanation ≥ 20 chars

**Endpoints (BL-AD-8 Phase B):**
- `GET    /api/groups/{gid}/quiz-sets/{sid}/full` — fetch set + questions inline
- `POST   /api/groups/{gid}/quiz-sets/{sid}/questions` — add 1 câu
- `PATCH  /api/groups/{gid}/quiz-sets/{sid}/questions/{qid}` — partial update
- `DELETE /api/groups/{gid}/quiz-sets/{sid}/questions/{qid}` — remove + filter
- `POST   /api/groups/{gid}/quiz-sets/{sid}/questions/reorder` — overwrite order
- `POST   /api/groups/{gid}/quiz-sets/{sid}/ai-generate` — set-scoped (auto-link, source=`ai-group`)
- `POST   /api/groups/{gid}/quiz-sets/{sid}/questions/{qid}/ai-rewrite` — return draft, no save

**Removed from spec:**
- Modal "Tạo bộ câu hỏi" 2-tab "AI tạo / Tự soạn" — fully replaced. File `apps/web/src/components/group/CreateQuizSetModal.tsx` deleted.
- Metadata-only `QuizSetCreate.tsx` page — replaced bởi unified editor.

**Question.source convention:**
- `ai-group` — AI-generated trong group context (qua editor)
- `group-custom` — manual entry trong group context
- `ai-generated` — admin-curated từ AI tool (admin-only)
- `admin` — admin-seeded manually

### 6.5 Edge cases

- **Quiz set bị archive khi live room đang dùng** → tiếp tục bình thường (đã load vào memory)
- **Quiz set bị delete khi scheduled quiz đang chạy** → BLOCK delete với error message
- **Edit PUBLISHED quiz set có play_count > 0** → warning toast "Bộ này đã được chơi N lần, sửa có thể ảnh hưởng score lịch sử". Cho phép edit nhưng warn.
- **Mode validation fail** → error 400 với message rõ ("Battle Royale cần tối thiểu 4 câu hỏi")
- **Existing rows pre-Sprint 5** → backfill `publish_status='PUBLISHED'`, `published_at=updated_at`. NULL metadata fields acceptable, UI fallback to defaults.

---

## 7. Live Rooms (Q-N + Sprint 5 multi-mode)

> **BL-25 D4 demote (2026-06-21):** live "Chơi cùng nhau" is now a **secondary shortcut**, not the group's primary affordance — it overlapped with plain multiplayer and crowded out the group's reason to exist. The **Hành Trình Nhóm hero** (§19) owns the spotlight; the FE drops the emerald `highlight` on the leader's "Bắt đầu Live" quick-action (`QuickActionsPanel.tsx`). The live-room mechanics below are unchanged.

**Endpoint**: `/api/groups/{id}/live-rooms` (Q-N: rename từ `/live-quiz` đã ship, `ChurchGroupController.java:677,741`).

### 7.1 Create live room (LEADER/MOD only) — Sprint 5 multi-mode

```
POST /api/groups/{id}/live-rooms
Body: { 
  quizSetId, 
  name, 
  questionCount, 
  timePerQuestionSec, 
  maxPlayers,
  mode  // Sprint 5 NEW: optional, default = quizSet.suggestedMode hoặc GROUP_LIVE_SEQUENTIAL
}
  ↓
Backend (ChurchGroupController.java:670-735):
  - @PreAuthorize: LEADER or MOD
  - Validate quiz set thuộc group
  - Validate quiz set status = PUBLISHED (DRAFT/ARCHIVED reject)
  - Resolve mode: req.mode → quizSet.suggestedMode → GROUP_LIVE_SEQUENTIAL
  - Validate mode constraints (Sprint 5):
      * BATTLE_ROYALE: total_questions >= 4
      * SUDDEN_DEATH: total_questions >= 10
      * TEAM_VS_TEAM: total_questions >= 6 && even
  - Create RoomEntity (status=LOBBY, mode=resolved, hostPlaysGame=false)
  - Sprint 4: KHÔNG insert host as RoomPlayer (Quản trò mode)
  - Generate 6-char room code
  - Increment quizSet.play_count async
  ↓
Return { roomCode, roomId, mode }
Push notification → all group members (Live Call Banner)
```

**Concurrent rooms (Q-C)**: Mỗi click tạo room mới, KHÔNG dedup. 1 group có thể có nhiều rooms cùng lúc (vd: 2 nhóm tế bào con parallel).

### 7.2 List active live rooms

```
GET /api/groups/{id}/live-rooms
  ↓
Backend (ChurchGroupController.java:735-...):
  - Return rooms WHERE group_id = X AND status IN (LOBBY, IN_PROGRESS)
  ↓
FE: GroupDetail.tsx tab "Bộ câu hỏi" hiện inline banner
   (KHÔNG có route /live-rooms riêng — Q-N FE clarification)
```

### 7.3 Cleanup (cross-ref → SPEC_MULTIPLAYER.md §R1-R5)

Group live rooms tuân theo cleanup rules trong SPEC_MULTIPLAYER:
- R1: Idle lobby >10min → cancel
- R2: Stuck IN_PROGRESS >2h → force-end
- R3: ENDED >24h → purge (commit a1a8620)
- R4: Empty room → cancel ngay
- R5: RoomAbandonmentScheduler recovery (commit 7a43b0f)

---

## 8. Sequential mode (Q-B manual advance)

Live "Chơi cùng nhau" dùng **sequential format** (chờ tất cả trả lời mới sang câu kế).

**Q-B locked behavior**:
1. Host (leader/mod) bấm "Bắt đầu".
2. Câu 1 hiện đồng thời cho tất cả players.
3. Player chọn đáp án → submit (timer 20/30/45s).
4. **KHÔNG đổi answer sau submit** (anti-cheat).
5. Waiting strip "Chờ X người trả lời..." cho đến khi tất cả xong hoặc timeout.
6. Reveal đáp án + explanation + scriptureRef.
7. **Host bấm "Sang câu tiếp"** (manual advance, KHÔNG auto, KHÔNG pause config).
8. Member thấy waiting state "Đang chờ trưởng nhóm sang câu...".
9. Lặp đến hết quiz.

**Endpoint**: `POST /api/rooms/{roomCode}/advance` (host only).

**Disconnect handling**:
- Player disconnect: 60s grace, rejoin OK; ngoài grace → marked LEFT.
- Host disconnect: 60s grace; ngoài grace → broadcast `ROOM_ENDED` reason=`host_disconnected` (commit 5aef216).

**Scoring trong room**: 100 đ đúng + speed bonus max +50. Score này (sum across rooms) đóng góp Group Leaderboard (Q-A locked).

---

## 9. Scheduled Quizzes (V40) — feature 13

### 9.1 Create

```
POST /api/groups/{id}/scheduled-quiz
Body: {
  quizSetId, name, description,
  deadline (ISO timestamp),
  attemptsPerUser (1/3/unlimited, default 3),
  showPublicLeaderboard (bool)
}
  ↓
Backend (ScheduledQuizService.java):
  - @PreAuthorize: LEADER or MOD
  - Check active scheduled count < 3 per group
  - Validate deadline > NOW()
  - Insert ScheduledQuiz (status=ACTIVE)
  ↓
Push noti tất cả member: "Quiz tuần mới: '[name]' - hạn chót [date]"
```

**Constraint**: max 3 active scheduled quizzes per group. Vượt → block.

### 9.2 Attempt (with submit window)

```
POST /api/groups/{id}/scheduled-quiz/{quizId}/play
  ↓
Backend:
  - Check deadline > NOW()
  - Check user attempt count < attempts_per_user
  - Create QuizSession (mode=SCHEDULED) với câu hỏi từ quiz set
  - Return sessionId
  ↓
Member chơi như Practice mode
  ↓
Submit answer → score recorded
On complete: Insert ScheduledQuizAttempt { score, correct_count, total_time_ms, attempt_number }
  ↓
Best score per user used for leaderboard (max query)
```

### 9.3 Results & deadline cron

**ScheduledQuizScheduler** (cron mỗi phút):
```
WHERE deadline < NOW() AND status = 'ACTIVE'
  ↓
For each:
  - status → ENDED
  - Compute winner: MAX(score), tie-break MIN(total_time_ms)
  - Set winner_user_id
  - Auto-create GroupAnnouncement: "🏆 [Winner] đã thắng Quiz tuần '[name]' với X điểm!"
  - Push noti tất cả member
```

**Leaderboard endpoint**: `GET /api/groups/{id}/scheduled-quiz/{quizId}/leaderboard` → sorted by best score.

---

## 10. Group Leaderboard (RETIRED — Q-A sunset)

> **🪦 RETIRED (BL-16, 2026-06-22).** The group leaderboard was sunset in v1.4 (GD-1, 2026-05-10) and its social signal replaced by **Collective Growth (§18)** — an anti-leaderboard "grow together" metric that fits Tin Lành culture. FE callers were removed in GD-1; web + mobile now have **0 callers**. As of 2026-06-22 `GET /api/groups/{id}/leaderboard` returns **`410 Gone`** `{ success:false, code:"LEADERBOARD_DEPRECATED", message }` and `ChurchGroupService.getLeaderboard` was deleted. The §10.2–10.4 below are **historical** (kept for the Q-A rationale); they no longer describe shipped behaviour. **BL-2 / BL-12** (the never-built "filter leaderboard by source" fix) are **SUPERSEDED by BL-16** — the scoring drift is gone with the method.

### 10.1 Scope

**Members only**. Người không trong group không xuất hiện. Member LEFT/KICKED giữ history với tag "(đã rời)".

### 10.2 Score sources (Q-A locked + Sprint 5 Mastery clarification)

✅ **CÓ đóng góp**:
- Group live room scores (sum across all rooms member tham gia trong period).
- Scheduled quiz attempts (best score per quiz, sum across quizzes).

❌ **KHÔNG đóng góp**:
- Solo Practice mode (kể cả "Tự ôn solo" từ group quiz set).
- Ranked Mode (đã có global leaderboard riêng).
- Daily Challenge.
- **Personal Mastery progress (Sprint 5)** — `group_quiz_set_mastery` table KHÔNG join với leaderboard query. Mastery là personal stats, độc lập hoàn toàn.

**Sprint 5 emphasis:** Personal Mastery (§3.7, §6.3) cho phép member track tiến độ học mà không break Q-A. Mastery hiển thị trên Quiz Set detail page, **không** trên Group Leaderboard. 2 systems hoàn toàn separate.

### 10.3 Periods

3 tabs: Tuần (7d) / Tháng (30d) / Tất cả thời gian. Tự reset weekly/monthly. All-time không reset.

**Around-me pattern**: Top 3 + 2 trên + me + 2 dưới. "Xem tất cả" → full paginated.

### 10.4 Resolution: endpoint retired (BL-16)

**Was**: `ChurchGroupService.getLeaderboard` summed **all** `UserDailyProgress` (solo Practice/Ranked/Daily included) — a Q-A drift that never matched the group-play-only lock above.

**Resolution (BL-16, 2026-06-22)**: rather than building the "filter by source" machinery (BL-2: a `source` ENUM column on the hot `UserDailyProgress` table + migration + backfill), the dead endpoint was retired. With **0 callers** (web + mobile) and Collective Growth (§18) already carrying the social signal, `getLeaderboard` was deleted and the endpoint returns `410 Gone`. The drift is gone with the code; **BL-2 / BL-12 are SUPERSEDED**.

---

## 11. Group Analytics (leader-only) — feature 20

**Endpoint**: `GET /api/groups/{id}/stats` (LEADER only).
**FE**: `apps/web/src/pages/GroupAnalytics.tsx`.

**Engagement metrics**:
- Active members tuần / tháng (dùng `last_active_at` V32).
- Activity curve 30 ngày (line chart).
- Top 5 active members.
- Members chưa active 7+ ngày (warning section, để leader nhắc nhở).

**Content metrics**:
- Quiz sets used most.
- Average accuracy by quiz set.
- Difficulty distribution.

**Activity metrics**:
- Tổng số live rooms tổ chức.
- Tổng số scheduled quizzes hoàn thành.
- Average participation rate per activity.

---

## 12. Announcements

**Endpoint**: `POST /api/groups/{id}/announcements { content }` (LEADER/MOD, ≤500 ký tự).

**Behavior**:
- **In-app notification** tới mọi member (trừ tác giả) khi đăng — ✅ **BL-24** (2026-06-20): reuse `NotificationService`, type `group_announcement`; best-effort (noti lỗi KHÔNG chặn việc đăng). Push/FCM → defer Q-K.
- Auto-create khi scheduled quiz end (winner announcement) — ✅ shipped (`ScheduledQuizScheduler`).
- Hiện banner trên Group Detail header 7 ngày — ⬜ chưa ship.
- Pin: max 3 pinned, hiện đầu list — ⬜ chưa ship.

---

## 13. Reports (V41)

**Endpoint**: `POST /api/groups/{id}/report { reason, note }` (member/mod, KHÔNG cho leader self-report).

**Flow**:
```
Member → GroupDetail "..." menu → "Báo cáo nhóm"
  ↓
Modal chọn reason (SPAM, INAPPROPRIATE, HARASSMENT, OTHER) + note
  ↓
Insert GroupReport (status=OPEN)
  ↓
Admin queue: GET /api/admin/reports?status=OPEN
  ↓
Admin review → action (warn / lock V19 / soft-delete V13) → status=ACTIONED/DISMISSED
```

Cross-ref: SPEC_ADMIN.md §11 Report Moderation.

---

## 14. Streak (GroupStreakService)

**File**: `apps/api/src/main/java/com/biblequiz/modules/group/service/GroupStreakService.java`

**Concept**: Group streak = số ngày liên tiếp group có ít nhất 1 activity contribute leaderboard.

**Activity sources** (Q-A scope — chỉ count group-play):
- Live room kết thúc (`Room.status = ENDED` AND `room.group_id == group.id`)
- Scheduled quiz attempt completed (`ScheduledQuizAttempt.completedAt != null`)
- Solo Practice/Ranked/Daily Challenge KHÔNG count (per Q-A 2026-05-09 lock)

**Tracking** (canonical contract):
- Cron job hoặc event listener: sau mỗi activity → update `church_groups.last_activity_at = now`.
- Streak counter = số ngày liên tiếp có ≥ 1 activity. Nếu hôm nay không có activity AND yesterday có → streak = streak (chưa reset). Nếu cả today + yesterday đều không → reset 0.
- Hiển thị trong Group Detail header: "🔥 Group streak 12 ngày".

**Reset rule**: `(today - last_activity_at) > 1 day` → streak = 0 vào midnight UTC.

**Known Issue**: Algorithm chính xác trong `GroupStreakService` chưa verify deeply (Phase 1 audit không inspect deep). Spec mô tả intended contract; nếu code lệch → BACKLOG follow-up.

---

## 15. API Endpoints

### 15.1 Group CRUD

| Method | Path | Auth | Note |
|---|---|---|---|
| POST | `/api/groups` | User | create |
| GET | `/api/groups/{id}` | Member | detail (with userRole) |
| PATCH | `/api/groups/{id}` | Leader | update info |
| DELETE | `/api/groups/{id}` | Leader | soft delete (V13) |
| POST | `/api/groups/{id}/restore` | Leader | restore within 7d |
| GET | `/api/groups` | User | list user's groups |
| GET | `/api/groups/discover` | User | public discovery |

### 15.2 Membership

| Method | Path | Auth | Note |
|---|---|---|---|
| POST | `/api/groups/{id}/join` | User | join public |
| POST | `/api/groups/join-by-code` | User | `{ code }` |
| POST | `/api/groups/{id}/leave` | Member | |
| GET | `/api/groups/{id}/members` | Member | list |
| DELETE | `/api/groups/{id}/members/{userId}` | Leader | kick + GroupKickLog (V41) |

### 15.3 Mods (Q-D locked, KHÔNG remove)

| Method | Path | Auth | Note |
|---|---|---|---|
| GET | `/api/groups/{id}/mods` | Member | list mods |
| POST | `/api/groups/{id}/mods` | Leader | promote member |
| DELETE | `/api/groups/{id}/mods/{userId}` | Leader | demote |

### 15.4 Quiz Sets (+ Sprint 5)

| Method | Path | Auth | Note |
|---|---|---|---|
| GET | `/api/groups/{id}/quiz-sets` | Member | list (filter `status` + `folder` + `search` + `sort`) |
| POST | `/api/groups/{id}/quiz-sets` | Leader/Mod | create (default status=DRAFT) |
| PATCH | `/api/groups/{id}/quiz-sets/{setId}` | Leader/Mod own | update fields including metadata |
| DELETE | `/api/groups/{id}/quiz-sets/{setId}` | Leader/Mod | soft delete (30d retention) |
| **PATCH** | `/api/groups/{id}/quiz-sets/{setId}/publish` | Leader/Mod own | **Sprint 5** — DRAFT → PUBLISHED |
| **PATCH** | `/api/groups/{id}/quiz-sets/{setId}/archive` | Leader/Mod | PUBLISHED → ARCHIVED (block if scheduled active) |
| **PATCH** | `/api/groups/{id}/quiz-sets/{setId}/unarchive` | Leader/Mod | **Sprint 5** — ARCHIVED → PUBLISHED |
| **POST** | `/api/groups/{id}/quiz-sets/{setId}/clone` | Leader/Mod | **Sprint 5** — duplicate as DRAFT |
| POST | `/api/groups/{id}/quiz-sets/{setId}/play` | Member | solo practice (track Mastery, KHÔNG vào leaderboard) |
| **GET** | `/api/groups/{id}/quiz-sets/{setId}/my-mastery` | Member | **Sprint 5** — personal mastery |
| **GET** | `/api/groups/{id}/my-masteries` | Member | **Sprint 5** — all masteries trong group này |

**Folder endpoints (Sprint 5):**

| Method | Path | Auth | Note |
|---|---|---|---|
| GET | `/api/groups/{id}/quiz-set-folders` | Member | list folders trong group |
| POST | `/api/groups/{id}/quiz-set-folders` | Leader/Mod | create folder |
| PATCH | `/api/groups/{id}/quiz-set-folders/{folderId}` | Leader/Mod | rename / reorder |
| DELETE | `/api/groups/{id}/quiz-set-folders/{folderId}` | Leader/Mod | xóa (quiz sets đặt folder_id=NULL) |

### 15.5 Live Rooms (Q-N + Sprint 5 multi-mode)

| Method | Path | Auth | Note |
|---|---|---|---|
| POST | `/api/groups/{id}/live-rooms` | Leader/Mod | create với optional `mode` param (Sprint 5). Default = quizSet.suggestedMode hoặc GROUP_LIVE_SEQUENTIAL |
| GET | `/api/groups/{id}/live-rooms` | Member | list active (`ChurchGroupController.java:741`) |
| GET | `/api/rooms/{roomCode}` | User | room detail |
| POST | `/api/rooms/{roomCode}/join` | User | join lobby |
| POST | `/api/rooms/{roomCode}/leave` | Player | |
| POST | `/api/rooms/{roomCode}/start` | Host | |
| POST | `/api/rooms/{roomCode}/advance` | Host | Q-B manual advance (chỉ GROUP_LIVE_SEQUENTIAL) |
| POST | `/api/rooms/{roomCode}/end` | Host | force end |

**Sprint 4 + Sprint 5 integration:** Live rooms từ Group Quiz Set tự động dùng Quản trò mode (`hostPlaysGame=false`). Host (LEADER/MOD) chỉ điều phối, không trả lời câu hỏi. Sử dụng 4 host controls (Pause/Skip/Broadcast/End) từ SPEC_MULTIPLAYER §8.

### 15.6 Scheduled Quizzes (V40)

| Method | Path | Auth | Note |
|---|---|---|---|
| POST | `/api/groups/{id}/scheduled-quiz` | Leader/Mod | create |
| GET | `/api/groups/{id}/scheduled-quiz` | Member | list |
| GET | `/api/groups/{id}/scheduled-quiz/{quizId}` | Member | detail |
| DELETE | `/api/groups/{id}/scheduled-quiz/{quizId}` | Leader/Mod own | cancel |
| POST | `/api/groups/{id}/scheduled-quiz/{quizId}/play` | Member | start attempt |
| GET | `/api/groups/{id}/scheduled-quiz/{quizId}/leaderboard` | Member | best scores sorted |

### 15.7 Stats & Leaderboard

| Method | Path | Auth | Note |
|---|---|---|---|
| GET | `/api/groups/{id}/leaderboard?period=week\|month\|all` | Member | Q-A clarified (BACKLOG: query refactor) |
| GET | `/api/groups/{id}/leaderboard/around-me?period=...` | Member | top3 + ±2 |
| GET | `/api/groups/{id}/stats` | Leader | analytics |
| GET | `/api/groups/{id}/collective-growth` | Member | BL-23 §18 — anti-leaderboard collective metric (Q-A safe) |

### 15.8 Announcements

| Method | Path | Auth |
|---|---|---|
| POST | `/api/groups/{id}/announcements` | Leader/Mod |
| GET | `/api/groups/{id}/announcements` | Member |
| PATCH | `/api/groups/{id}/announcements/{annId}/pin` | Leader/Mod |
| DELETE | `/api/groups/{id}/announcements/{annId}` | Leader/Mod |

### 15.9 Reports (V41)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/groups/{id}/report` | Member/Mod |
| GET | `/api/admin/reports?status=OPEN` | Admin |
| PATCH | `/api/admin/reports/{reportId}` | Admin (action/dismiss) |

---

## 16. WebSocket events (cross-ref → SPEC_MULTIPLAYER.md)

Group live rooms dùng cùng STOMP topics với multiplayer modes. **Spec chi tiết → SPEC_MULTIPLAYER.md §WS**.

Tóm tắt events relevant cho group:

| Topic | Event | Trigger |
|---|---|---|
| `/topic/room/{roomId}` | PLAYER_JOINED | member join lobby |
| `/topic/room/{roomId}` | PLAYER_LEFT | leave / disconnect |
| `/topic/room/{roomId}` | ROOM_STARTED | host bấm "Bắt đầu" |
| `/topic/room/{roomId}` | QUESTION_REVEALED | reveal sau khi tất cả answer |
| `/topic/room/{roomId}` | QUESTION_ADVANCED | host Q-B manual advance |
| `/topic/room/{roomId}` | ROOM_ENDED | normal end / host_disconnected (commit 5aef216) |

---

## 17. Known Issues (link BACKLOG.md)

| ID | Issue | Severity | Status |
|---|---|---|---|
| **Q-A code drift** | `ChurchGroupService.java:227,511,518,523,572,578,582` sum tất cả UserDailyProgress thay vì group-play-only | **HIGH** | 🚧 BACKLOG.md "Refactor Group Leaderboard — Q-A compliance" |
| Q-E | Backend max-2-groups-owned chưa enforce | MEDIUM | 🚧 BACKLOG |
| Q-F | Backend max-5-groups-joined chưa enforce | MEDIUM | 🚧 BACKLOG |
| Q-J | 1-active-room-per-user chưa enforce | MEDIUM | 🚧 BACKLOG |
| Q-K | Push notifications (11 events) chưa implement | MEDIUM | 🚧 BACKLOG, incremental |
| Q-L | 7-day re-join cooldown sau kick chưa enforce (V41 GroupKickLog ready, query missing) | MEDIUM | 🚧 BACKLOG |
| GFA-17 | "Tự ôn solo" hiện tạo SPEED_RACE room (architectural mismatch) thay vì Practice session | LOW | 🚧 BACKLOG, defer |
| **~~QS-1~~** | ~~Quiz Set chỉ chơi được mode GROUP_SEQUENTIAL~~ | — | ✅ **CLOSED Sprint 5** — multi-mode play implemented (§6.2) |
| **QS-2** | Marketplace / Discovery / Cross-group share | LOW | ⏭️ DEFER v2.5 (cần moderation system) |
| **QS-3** | Versioning với parent reference cho clone | LOW | ⏭️ DEFER Sprint 6 |
| **QS-4** | Drag-and-drop folder reorder | LOW | ⏭️ DEFER Sprint 6 |
| **QS-5** | Bulk multi-select archive/move | LOW | ⏭️ DEFER Sprint 6 |
| **QS-6** | Import/Export JSON/CSV | LOW | ⏭️ DEFER Sprint 6 |
| **QS-7** | Cover image upload to CDN | LOW | ⏭️ DEFER Sprint 6 (Sprint 5 chỉ icon picker) |
| **QS-8** | Rating/review feedback từ players | LOW | ⏭️ DEFER Sprint 6 |
| **QS-9** | Unified "Group Quiz Event" concept (merge Scheduled + Live Room) | MEDIUM | ⏭️ DEFER Sprint 6 |
| **QS-10** | Personal Achievement notifications UI ("Đã thuộc Quiz Set X") | LOW | ⏭️ DEFER Sprint 6 (logic Sprint 5 ready) |

Chi tiết tracking + acceptance criteria → `BACKLOG.md`.

---

## 18. Collective Growth — "Cùng Nhau Thuộc Lời" (BL-23, shipped 2026-06-17)

**Mục đích.** Sau khi Group Leaderboard (Q-A) bị sunset (§10, v1.4 — "ranking sinh hoạt nhóm không hợp văn hóa Tin Lành"), Group thiếu một engagement hook. Collective Growth là **anti-leaderboard**: KHÔNG xếp hạng cá nhân, mà gộp tiến độ học của cả nhóm thành **một con số chung** — *"Nhóm đã cùng thuộc N câu Lời Chúa"* — để cả nhóm cùng nhìn về một đích ("cùng nhau lớn lên").

**Q-A relationship — SAFE.** Build trên `GroupQuizSetMastery` (§3.7, vốn Q-A safe — solo practice, KHÔNG vào leaderboard). Aggregate thành chỉ số **tập thể không-ranking** → KHÔNG tái sinh leaderboard đã bỏ, KHÔNG đọc/ghi `UserDailyProgress` hay `ChurchGroupService.getLeaderboard` (§10.4 / BL-16). Một structural guard test khoá invariant này (`GroupCollectiveGrowthServiceTest.qaGuard_noDailyProgressOrLeaderboardDependency`).

### 18.1 Metrics (v1)

| Field | Nguồn | Ý nghĩa |
|---|---|---|
| `totalLearned` | `SUM(questionsLearned)` qua mọi bộ PUBLISHED | Hero — "lượt câu cả nhóm đã thuộc" (đếm tiến tới cột mốc, KHÔNG phải phân số trên tổng câu) |
| `nextMilestone` / `milestoneFloor` / `milestonePct` | milestone band | Cột mốc kế + đáy band + % tiến độ trong band |
| `contributors` | `COUNT(DISTINCT userId)` | Số thành viên đã đóng góp |
| `memberCount` | `ChurchGroup.memberCount` | Mẫu số "X/Y thành viên" |
| `masteryCompletions` | `COUNT(completedMastery=true)` | Lượt thuộc trọn bộ |
| `perSet[]` | `GROUP BY` quiz set | Mỗi bộ PUBLISHED đã có người ôn: name, totalQuestions, participants, completions, avgMasteryPct |

Milestone band: `50 / 100 / 250 / 500 / 1000 / 2000 / 5000 / 10000`; vượt bảng → bước 5000. `avgMasteryPct = SUM(learned)/participants/totalQuestions` (cap 100).

### 18.2 Decisions (D1–D5, locked 2026-06-17 — DECISIONS.md)

| # | Quyết định | v1 | Defer v2 |
|---|---|---|---|
| D1 | Hero metric | SUM lượt thuộc | UNION distinct câu |
| D2 | Nguồn | chỉ mastery (solo practice) | + group-play (live room + scheduled) |
| D3 | Vị trí | hero card trong Activity tab | (tab riêng) |
| D4 | Group goal (leader đặt mục tiêu) | milestone tự động | leader-set goal + quest |
| D5 | Visibility | mọi member | — |

### 18.3 Implementation (CG-1..7)

- **BE:** `GroupQuizSetMasteryRepository.aggregateGrowthByGroupId` + `aggregatePerSetByGroupId` (theta-join mastery ↔ `GroupQuizSet`, PUBLISHED-scoped) → `GroupCollectiveGrowthService.getCollectiveGrowth` (hero + milestone + per-set, returns `Map<String,Object>`) → `ChurchGroupController` `GET /api/groups/{id}/collective-growth` (member-visible; non-member → 400 qua catch như `getGroupStreak`). **v1 KHÔNG cần Flyway migration** (read-only).
- **FE:** `useGroupCollectiveGrowth` (TanStack Query) + `CollectiveGrowthCard` (hero số + milestone bar + contributors/completions + per-set list; emerald GD-12; 3 states loading/error/empty) wired vào `GroupActivityTab` (sau LiveNowBanner, mọi member). i18n `groups.growth.*` (vi+en).
- **Tests:** `GroupCollectiveGrowthServiceTest` (7, gồm Q-A guard) · `ChurchGroupControllerTest` (member 200 / non-member 400) · `CollectiveGrowthCard.test.tsx` (4: loading/error/empty/success).

### 18.4 Deferred (v2)

UNION distinct-verse hero (D1) · group-play sources (D2) · leader-set group goal + quest (D4) · celebration/notification khi đạt milestone · mobile RN port (theo BL-11 pattern).

---

## 19. Hành Trình Nhóm (Group Journey) — BL-25 (shipped 2026-06-21)

> The async + persistent + leader-guided differentiator (Hướng A). The whole group walks through one book/topic across N **weeks** (chặng); each member learns at their own pace with a shared progress bar + a per-week checkpoint. Distinct from multiplayer (one match then gone): a durable, guided journey.

### 19.1 Model (V70)
- **GroupJourney** (`apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupJourney.java`): `id, groupId, title, description, status (DRAFT/ACTIVE/COMPLETED), createdBy, createdAt, startedAt, completedAt`.
- **GroupJourneyWeek** (`apps/api/src/main/java/com/biblequiz/modules/group/entity/GroupJourneyWeek.java`): `id, journeyId, weekNumber, title, quizSetId, scheduledQuizId (null → set when opened), status (LOCKED/OPEN/ENDED)`.
- Service `apps/api/src/main/java/com/biblequiz/modules/group/service/GroupJourneyService.java`; controller `apps/api/src/main/java/com/biblequiz/api/GroupJourneyController.java`; migration `apps/api/src/main/resources/db/migration/V70__group_journey.sql`.
- **No per-user progress table** (v1): progress is aggregated from `ScheduledQuizAttempt` (§3.6) via each week's `scheduledQuizId`. (Lesson from BL-23 Collective Growth: build only on a verified-live source, never a removed one — scheduled-quiz submit was re-verified live before build.)

### 19.2 Lifecycle
1. Leader/mod **creates** a journey (DRAFT) → **adds weeks** (each = a title + a `GroupQuizSet`) → **starts** it (DRAFT → ACTIVE; needs ≥ 1 week). Weeks can be removed while still LOCKED.
2. Leader **opens the next LOCKED week** (D1) with a deadline → delegates to `ScheduledQuizService.create` (§9.1): snapshots questions + notifies members (PN-1). The week pins the returned `scheduledQuizId`, status → OPEN. (Deadline = the ScheduledQuiz deadline.)
3. Members **do the week** = play its ScheduledQuiz (§9.2, full reuse of create/play/submit). "Done" = an attempt exists (D2 — score/% surfaced for encouragement, **not** a gate).
4. **Progress** (`getJourneyWithProgress`): overall **stage k/N** (weeks opened), per-week **X/Y done** + the viewer's personal done state; leader/mod additionally sees the **not-done roster** per open week.

### 19.3 Roles
- **Write** (create / edit / add+remove week / start / open-next): **LEADER/MOD only** → `IllegalArgumentException` → **403**.
- **Read** (list + progress): any **member** → non-member **400** (same convention as §14 streak / §18 growth).

### 19.4 API (`GroupJourneyController`)
| Method | Path | Who |
|---|---|---|
| POST | `/api/groups/{id}/journeys` | leader/mod |
| GET | `/api/groups/{id}/journeys` | member |
| GET | `/api/groups/{id}/journeys/{jid}` | member (with progress) |
| PATCH | `/api/groups/{id}/journeys/{jid}` | leader/mod |
| POST | `/api/groups/{id}/journeys/{jid}/weeks` | leader/mod |
| DELETE | `/api/groups/{id}/journeys/{jid}/weeks/{wid}` | leader/mod (LOCKED only) |
| POST | `/api/groups/{id}/journeys/{jid}/start` | leader/mod |
| POST | `/api/groups/{id}/journeys/{jid}/open-next` | leader/mod (body: `deadline`) |

### 19.5 FE
- **Hero** in the Activity tab (`JourneyHeroCard`) — the group's lead affordance (D3), placed above Collective Growth; live co-play demoted (§7, D4). Leader sees a "create" CTA when none exists; members see nothing until a journey is ACTIVE.
- `JourneyBuilder` (create + build weeks + start), `JourneyView` (progress bar + per-week "Làm chặng này" → ScheduledQuiz flow + leader open-next with deadline preset). i18n namespace `groupJourney` (vi/en).

### 19.6 Deferred → v2
Completion badge · journey templates ("Tân Ước 90 ngày") · auto weekly open · auto leader reminders · per-user UNION-distinct progress table (if score-weighting is ever needed).

---

## 20. Cross-references

| Spec | Sections relevant |
|---|---|
| **SPEC_USER_v3.1.md** | User entity, auth, profile (member relationship) |
| **SPEC_MULTIPLAYER.md** | §R1-R5 cleanup rules, §WS WebSocket events, sequential mode engine |
| **SPEC_ADMIN.md** | §11 Report moderation, group lock V19, force soft-delete V13 |
| **SPEC_ROADMAP.md** | Multi-leader system (deferred, KHÔNG include in v1.2 per Bui lock) |
| **AUDIT_SUMMARY.md** | Bui Q2 lock: Q-A group-play-only |
| **AUDIT_CONSTRAINTS.md** | §C8 Q-A...Q-O verification matrix |
| **BACKLOG.md** | All Q-* gaps + Q-A code drift refactor |

---

*Living spec — v1.2 reflects Bui 2026-05-09 Q-A clarification + V40/V41 entity additions.*
*Multi-leader system intentionally OMITTED → see SPEC_ROADMAP.md.*
*Next revision (v1.3) khi Q-A code refactor lands hoặc beta data trigger new locks.*
