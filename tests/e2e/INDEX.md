# E2E Specs — Master Tracking Index

> Cập nhật sau mỗi phase. Legend: ⬜ not started · 🔄 in progress · ✅ done · ⏭️ deferred · ❌ blocked

---

## Web User (Playwright) — prefix `W-`

| Module | Route(s) | L1 Smoke | L2 Happy | L3 Edge | Notes |
|--------|---------|----------|----------|---------|-------|
| W-M01 Auth & Onboarding | `/login`, `/onboarding`, `/onboarding/try`, `/auth/callback` | ✅ 9/9 | ✅ 8/8 | — | Phase 4a done |
| W-M02 Home & Profile | `/`, `/profile` | ✅ 9/9 | ✅ 8/8 | — | Phase 4a done |
| W-M03 Practice Mode | `/practice`, `/quiz`, `/review` | ✅ 8/8 | ✅ 16/16 | — | Phase 4a done · +3 TC for redesign (time slider, chapter/verse, retry-wrong) |
| W-M04 Ranked Mode | `/ranked` | ✅ 7/7 | ✅ 14/14 | — | Phase 4a done · all unblocked |
| W-M05 Daily Challenge | `/daily` | ✅ 5/5 | ✅ 12/12 | — | Phase 4a done · unblocked via /complete endpoint |
| W-M06 Multiplayer (Lobby only) | `/rooms`, `/multiplayer`, `/room/create`, `/room/join`, `/room/:id/lobby` | ✅ 6/6 (+3 redesign skipped pending API setup: L1-008/009/010) | ✅ 7/7 | — | Phase 4a done · 2026-05-07 lobby redesign adds 3 smoke TCs · Gameplay ⏭️ WebSocket phase |
| W-M07 Tournaments | `/tournaments`, `/tournaments/:id`, `/tournaments/:id/match/:matchId` | ✅ 6/6 | ✅ 6/6 | — | Phase 4a done |
| W-M08 Bible Journey Map | `/journey` | ✅ 4/4 | ✅ 6/6 | — | Phase 4a done |
| W-M09 Church Groups | `/groups`, `/groups/:id`, `/groups/:id/analytics` | ✅ 5/5 | ✅ 12/12 | — | Phase 4a done |
| W-M10 Tier Progression | `/` (tier display), `/profile`, `/cosmetics` | ✅ 8/8 | ✅ 17/17 | — | Phase 4a done · all unblocked |
| W-M11 Variety Modes | `/weekly-quiz`, `/mystery-mode`, `/speed-round` | ✅ 6/6 | ✅ 12/12 | — | Phase 4a done · xpMultiplier gap |
| W-M12 Notifications | AppLayout notification bell | ✅ 3/3 | ✅ 2/2 | — | Phase 4a done · panel ⏭️ NOT IMPL |
| W-M13 i18n | Cross-cutting | ✅ 4/4 | ✅ 5/5 | — | Phase 4a done |
| W-M14 | — | ⏭️ skip | ⏭️ skip | — | Mobile-specific |
| W-M15 Cross-cutting | Error boundary, offline, loading | ✅ 5/5 | ✅ 6/6 | — | Phase 4a done |
| W-M19 Memorize (Học Thuộc) | `/practice/memorize`, `/practice/memorize/add`, `/practice/memorize/session`, `/` (due card) | 🔄 0/3 | 🔄 0/7 | — | 2026-09-15 spec + code viết trước UI (HT-12); L2 stub API vì DB E2E chưa có toàn văn |

---

## Web Admin (Playwright) — prefix `A-`

| Module | Route | L1 Smoke | L2 Happy | L3 Edge | Notes |
|--------|-------|----------|----------|---------|-------|
| A-M01 Dashboard | `/admin` | ✅ 4/4 | ✅ 5/5 | — | Phase 4b done |
| A-M02 Users Management | `/admin/users` | ✅ 4/4 | ✅ 8/8 | — | Phase 4b done |
| A-M03 Questions CRUD | `/admin/questions` | ✅ 4/4 | ✅ 11/11 | — | Phase 4b done (combined w/ A-M04) |
| A-M04 Duplicate Detection | `/admin/questions` (inline) | ✅ 1/1 | ✅ 2/2 | — | Phase 4b done · in A-M03-M04 file |
| A-M05 AI Question Generator | `/admin/ai-generator` | ✅ 4/4 | ✅ 6/6 | — | Phase 4b done |
| A-M06 Review Queue | `/admin/review-queue` | ✅ 4/4 | ✅ 8/8 | — | Phase 4b done |
| A-M07 Feedback & Moderation | `/admin/feedback` | ✅ 4/4 | ✅ 6/6 | — | Phase 4b done |
| A-M08 Seasons & Rankings | `/admin/rankings` | ✅ 4/4 | ✅ 8/8 | — | Phase 4b done |
| A-M09 Events & Tournaments | `/admin/events` | ✅ 4/4 | ✅ 4/4 | — | Phase 4b done · create ⏭️ NOT IMPL |
| A-M10 Church Groups Admin | `/admin/groups` | ✅ 4/4 | ✅ 6/6 | — | Phase 4b done |
| A-M11 Notifications Broadcast | `/admin/notifications` | ✅ 2/2 | ✅ 2/2 | — | Phase 4b done · send ⏭️ NOT IMPL |
| A-M12 Configuration | `/admin/config` | ✅ 2/2 | ✅ 2/2 | — | Phase 4b done · save ⏭️ NOT IMPL |
| A-M13 Export Center | `/admin/export` | ✅ 2/2 | ✅ 2/2 | — | Phase 4b done · all exports ⏭️ NOT IMPL |
| A-M14 Question Quality | `/admin/question-quality` | ✅ 2/2 | ✅ 2/2 | — | Phase 4b done · quality score static |

---

## Mobile App (Maestro) — prefix `APP-`

| Module | Screens | L1 Smoke | L2 Happy | Notes |
|--------|---------|----------|----------|-------|
| APP-M01 Auth & Onboarding | SplashScreen, LanguageSelection, WelcomeSlides, TryQuiz | ✅ 5/5 | ✅ 5/5 | Phase 4c done |
| APP-M02 Home & Profile | HomeScreen, ProfileScreen | ✅ 4/4 | ✅ 6/6 | Phase 4c done |
| APP-M03 Practice Mode | PracticeSelectScreen, QuizScreen, QuizResultsScreen, QuizReviewScreen | ✅ 4/4 | ✅ 8/8 | Phase 4c done |
| APP-M04 Ranked Mode | RankedScreen, QuizScreen | ✅ 3/3 | ✅ 8/8 | Phase 4c done · seed-points used |
| APP-M05 Daily Challenge | DailyChallengeScreen | ✅ 4/4 | ✅ 6/6 | Phase 4c done · /complete used |
| APP-M06 Multiplayer (Lobby) | MultiplayerLobbyScreen, CreateRoomScreen, RoomWaitingScreen | ✅ 4/4 | ✅ 4/4 | Phase 4c done · gameplay ⏭️ Phase 5 |
| APP-M07 Social / Groups | GroupsListScreen, GroupJoinScreen, GroupCreateScreen, GroupDetailScreen | ✅ 4/4 | ✅ 6/6 | Phase 4c done |
| APP-M08 Journey Map | JourneyMapScreen | ✅ 4/4 | ✅ 4/4 | Phase 4c done |
| APP-M09 Achievements | AchievementsScreen | ✅ 4/4 | ✅ 4/4 | Phase 4c done |
| APP-M10 Settings | SettingsScreen | ✅ 5/5 | ✅ 5/5 | Phase 4c done · delete needs ephemeral user |

> **No admin screens on mobile** — confirmed by codebase scan.

---

## Phase Progress

| Phase | Status | Commit |
|-------|--------|--------|
| Phase 0 — Framework Setup | ✅ done | f9b140e, 8e32255 |
| Phase 1 — L1 Smoke Web User core (M01/02/03/04/10) | ✅ done | 7a3100e |
| Phase 2 — L1 Smoke Web User rest + Admin | ✅ done | (commit pending) |
| Phase 3 — Mobile Maestro Smoke | ✅ done | (commit pending) |
| Phase 4a — L2 Happy Path Web User | ✅ done | 86329bb |
| Phase 4a Blocker fixes | ✅ done | 6f839ff, 3ad2542, e3d8e5c |
| Phase 4b — L2 Happy Path Web Admin | ✅ done | 129fd72 |
| Phase 4c — L2 Happy Path Mobile | ✅ done | (commit pending) |
| Phase 5 — WebSocket Multiplayer gameplay | ⬜ | — |
| **Phase 6 — Playwright Code Conversion (Web)** | **✅ done** | **4f73e1d → 569ea0b** |

### Phase 6 — Playwright Code Conversion Stats
- Bootstrap: playwright.config.ts, 6 infrastructure files, 9 Page Object Models
- Phase 1 (L1 Smoke User Core): 41 tests, 5 files (W-M01/02/03/04/10)
- Phase 2 (L1 Smoke Rest + Admin): 89 tests, 19 files (W-M05-15 + A-M01-14)
- Phase 3 (L2 Happy Path User): 129 tests, 14 files (W-M01-15)
- Phase 4 (L2 Happy Path Admin): 72 tests, 10 files (A-M01-14)
- **Total: 331 Playwright test cases in 48 .spec.ts files**
- Skipped: ~40 tests (NOT IMPLEMENTED / BLOCKED / seed-data required)
- Cleanup: 6 waitForTimeout violations replaced with expect.poll/waitForLoadState
- Unit tests unaffected: 736/736 pass

---

## Stats

| Metric | Value |
|--------|-------|
| Total spec files created | 67 (Phase 1: 5 + Phase 2: 18 + Phase 3: 10 + Phase 4a: 14 + Phase 4b: 10 + Phase 4c: 10) |
| Total test cases written | **427** (L1: 171 + L2: 256) |
| L1 breakdown | Web User 85 + Web Admin 45 + Mobile 41 = **171** |
| L2 Web User breakdown | 8+8+13+14+12+7+6+6+12+17+12+2+5+6 = **128 cases** |
| L2 Web Admin breakdown | 5+8+11+2+6+8+6+8+4+6+2+2+2+2 = **72 cases** |
| L2 Mobile breakdown | 5+6+8+8+6+4+6+4+4+5 = **56 cases** |
| Total [NEEDS TESTID] | ~330 elements (~245 L1 + ~85 new L2) |
| Total [NOT IMPLEMENTED/BLOCKED] | ~16 (Phase 4a blockers FIXED: seed-points endpoint + daily /complete endpoint unblocked ~8 tests. Remaining: xpMultiplier, OAuth auto, DELETE test user, abandon session helper, plus L1 carry-over) |
| Total [DEFERRED - WEBSOCKET] | 4 (Web + Mobile multiplayer gameplay, ready/join sync) |

---

## Phase 4a — L2 Happy Path Web User — Detailed Stats

### Cases per module
| Module | L1 | L2 | L2 P0 | L2 P1 | L2 P2 | Blocked |
|--------|----|----|-------|-------|-------|---------|
| W-M01 Auth | 9 | 8 | 6 | 2 | 0 | 1 (OAuth) |
| W-M02 Home/Profile | 9 | 8 | 2 | 5 | 1 | 0 |
| W-M03 Practice | 8 | 13 | 4 | 7 | 2 | 0 |
| W-M04 Ranked | 7 | 14 | 8 | 6 | 0 | 1 (seed-points) |
| W-M05 Daily | 5 | 12 | 5 | 7 | 0 | 3-4 (markCompleted) |
| W-M06 Multiplayer | 6 | 7 | 3 | 4 | 0 | (gameplay deferred) |
| W-M07 Tournaments | 6 | 6 | 2 | 3 | 1 | 0 |
| W-M08 Journey | 4 | 6 | 2 | 4 | 0 | 0 |
| W-M09 Groups | 5 | 12 | 4 | 8 | 0 | 0 |
| W-M10 Tier Progression | 8 | 17 | 5 | 11 | 0 | 4 (seed-points) |
| W-M11 Variety | 6 | 12 | 4 | 7 | 1 | 1 (date mock) |
| W-M12 Notifications | 3 | 2 | 0 | 2 | 0 | 0 |
| W-M13 i18n | 4 | 5 | 3 | 2 | 0 | 0 |
| W-M15 Cross-cutting | 5 | 6 | 2 | 3 | 1 | 0 |
| **Total** | **85** | **128** | **50** | **71** | **6** | **~10** |

### Runtime estimates Phase 4a
- **Serial total**: ~7.5 min (sum of per-module estimates)
- **Parallel-safe cases**: ~35/128 (27% — read-only tests)
- **With 4 workers**: ~3-4 min estimated

### Critical findings (gaps found while writing Phase 4a)
1. ~~**SetStateRequest missing `pointsCounted`**~~ → ✅ FIXED (commit 6f839ff): `POST /api/admin/test/users/{id}/seed-points` wipes UDP history + inserts fresh row with exact totalPoints. Unblocks W-M04-L2-013 + W-M10-L2-002/003/004/005.
2. ~~**DailyChallengeService.markCompleted not wired**~~ → ✅ FIXED (commit 3ad2542): `POST /api/daily-challenge/complete { score, correctCount }` calls markCompleted, idempotent same-day. Unblocks W-M05-L2-006/007/008/012.
3. **`xpMultiplier` from variety endpoints NOT applied server-side** — W-M11-L2-012 designed to expose this gap. Still open.
4. **Practice mode scoring formula khác Ranked** — critical invariant: practice KHÔNG cộng `User.totalPoints`. Documented, not a bug.
5. **`UserTierService.getTotalPoints()` là DERIVED** (SUM of UserDailyProgress.pointsCounted) — documented architecture, seed-points works around it.
