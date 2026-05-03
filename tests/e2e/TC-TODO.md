# E2E Test Case TODO — Web User

> Gaps cần viết spec + Playwright code. Mobile + Admin scope đã ngoài file này.
> Cập nhật mỗi khi 1 TC chuyển từ ⬜ → 🔄 → ✅.
> Source of truth coverage hiện tại: [INDEX.md](INDEX.md). File này list **gaps** chưa được INDEX track.

Legend: ⬜ todo · 🔄 in progress · ✅ done · ⏭️ deferred · ❌ blocked

---

## Sprint 1 — Visible feature gaps (HIGH priority)

> Ưu tiên cao nhất: feature đã chạy trên prod nhưng không có TC nào → rủi ro regression.

### W-M16 — Achievements
- **Route**: `/achievements`
- **Source**: [Achievements.tsx](../../apps/web/src/pages/Achievements.tsx)
- **API**: `GET /api/achievements`
- **Status**: ⬜ chưa có spec, chưa có code

| TC ID | Level | Description | Status |
|---|---|---|---|
| W-M16-L1-001 | smoke | Page render dung cho user đã login | ⬜ |
| W-M16-L1-002 | smoke | List achievements hiển thị (locked + unlocked) | ⬜ |
| W-M16-L1-003 | smoke | Progress bar mỗi achievement render đúng % | ⬜ |
| W-M16-L1-004 | smoke | Filter by category (badges/streaks/social/...) work | ⬜ |
| W-M16-L1-005 | smoke | Click achievement → modal/detail mở | ⬜ |
| W-M16-L2-001 | happy | Unlocked achievement có icon + glow gold | ⬜ |
| W-M16-L2-002 | happy | Locked achievement greyscale + tooltip "Cần X" | ⬜ |
| W-M16-L2-003 | happy | Filter category kết hợp với search | ⬜ |
| W-M16-L2-004 | happy | Empty state khi user chưa unlock gì | ⬜ |
| W-M16-L2-005 | happy | Responsive mobile viewport (375px) | ⬜ |

**Effort**: ~10 TC, ~0.5 ngày spec + code.

---

### W-M17 — Leaderboard
- **Route**: `/leaderboard`
- **Source**: [Leaderboard.tsx](../../apps/web/src/pages/Leaderboard.tsx)
- **API**: `GET /api/leaderboard?period={daily,weekly,monthly,all_time}`
- **Status**: ⬜ chưa có spec, chưa có code

| TC ID | Level | Description | Status |
|---|---|---|---|
| W-M17-L1-001 | smoke | Page render dung cho guest (public) | ⬜ |
| W-M17-L1-002 | smoke | Top 10 users hiển thị với rank, name, points | ⬜ |
| W-M17-L1-003 | smoke | Period tabs (daily/weekly/monthly/all-time) clickable | ⬜ |
| W-M17-L1-004 | smoke | Click user row → profile (nếu enabled) hoặc no-op | ⬜ |
| W-M17-L1-005 | smoke | Current user position highlighted (nếu logged in) | ⬜ |
| W-M17-L2-001 | happy | Switch period → list refetch + render khác | ⬜ |
| W-M17-L2-002 | happy | Top 3 có medal icon (gold/silver/bronze) | ⬜ |
| W-M17-L2-003 | happy | Pagination/scroll xem rank 11+ | ⬜ |
| W-M17-L2-004 | happy | Empty state khi period không có data | ⬜ |
| W-M17-L2-005 | happy | API 500 error → fallback UI + retry button | ⬜ |

**Effort**: ~10 TC, ~0.5 ngày.

---

## Sprint 2 — Feature edge gaps (MEDIUM priority)

### W-M18 — Basic Quiz (mode riêng, không phải Practice)
- **Route**: `/basic-quiz`
- **Source**: [BasicQuiz.tsx](../../apps/web/src/pages/BasicQuiz.tsx)
- **API**: BE riêng (`/api/basic-quiz/*` — confirmed via DTO mirror)
- **Status**: ⬜ chưa có module riêng — đề xuất tách W-M18

| TC ID | Level | Description | Status |
|---|---|---|---|
| W-M18-L1-001 | smoke | Page render dung — start screen với CTA | ⬜ |
| W-M18-L1-002 | smoke | Click start → quiz session bắt đầu, Q1 hiển thị | ⬜ |
| W-M18-L1-003 | smoke | Answer A/B/C/D → submit → next question | ⬜ |
| W-M18-L1-004 | smoke | Hoàn thành → results screen hiển thị score | ⬜ |
| W-M18-L1-005 | smoke | Wrong answers section hiển thị explanation | ⬜ |
| W-M18-L2-001 | happy | Answer hết 1 lượt → có "Try again" CTA | ⬜ |
| W-M18-L2-002 | happy | Submit answer khi chưa chọn → button disabled | ⬜ |
| W-M18-L2-003 | happy | Score >= pass threshold → unlock next mode/feature | ⬜ |
| W-M18-L2-004 | happy | Reload mid-quiz → state restore hoặc reset cleanly | ⬜ |

**Effort**: ~9 TC, ~0.5 ngày. **Cần clarify**: BasicQuiz có liên quan unlock Ranked không? (giống flow `basic_quiz_passed` ở User entity)

---

### W-M03 bổ sung — Lifelines (Hint)
- **API**: `POST /api/sessions/{id}/lifeline/hint`, `GET /api/sessions/{id}/lifeline/status`
- **Status**: ⬜ append vào [W-M03 spec](playwright/specs/smoke/W-M03-practice-mode.md) + [happy-path](playwright/specs/happy-path/W-M03-practice-mode.md)

| TC ID | Level | Description | Status |
|---|---|---|---|
| W-M03-L1-009 | smoke | Hint button visible khi quota > 0 | ⬜ |
| W-M03-L1-010 | smoke | Click hint → 1 wrong option bị eliminate (greyed) | ⬜ |
| W-M03-L2-014 | happy | Quota giảm sau mỗi hint, button disable khi = 0 | ⬜ |
| W-M03-L2-015 | happy | Hint state persist trong cùng question, reset câu kế | ⬜ |

**Effort**: ~4 TC, ~0.25 ngày.

---

### W-M01 bổ sung — Register flow (email/password)
- **Route**: `/register`
- **Source**: [Register.tsx](../../apps/web/src/pages/Register.tsx)
- **Status**: ⬜ append vào W-M01 (đang focus OAuth)

| TC ID | Level | Description | Status |
|---|---|---|---|
| W-M01-L1-010 | smoke | Register page render — email, password, confirm fields | ⬜ |
| W-M01-L2-009 | happy | Submit valid → redirect /onboarding hoặc / | ⬜ |
| W-M01-L2-010 | happy | Submit duplicate email → error message | ⬜ |
| W-M01-L2-011 | happy | Password mismatch → inline validation | ⬜ |

**Effort**: ~4 TC, ~0.25 ngày.

---

## Sprint 3 — Phase 5 (DEFERRED)

### W-M06 bổ sung — Multiplayer gameplay (WebSocket)
- **Source**: [RoomQuiz.tsx](../../apps/web/src/pages/RoomQuiz.tsx)
- **Hooks**: [useStomp.ts](../../apps/web/src/hooks/useStomp.ts)
- **Status**: ⏭️ Phase 5 chưa start — cần multi-browser context infra

Yêu cầu spec/code phức tạp — defer cho đến khi có infrastructure ready (>=2 Playwright contexts join cùng room, sync answer/score qua STOMP). Khoảng ~15 TC.

---

## Sprint 4 — Backend-blocked

### W-M11-L2-012 — xpMultiplier validation
- **Status**: ❌ blocked — server-side chưa apply multiplier (Critical finding #3 trong INDEX)
- **Action**: chờ BE fix → unskip test trong [W-M11-variety.spec.ts](../../apps/web/tests/e2e/happy-path/web-user/W-M11-variety.spec.ts)

---

## L3 Edge cases — DEFER

Tầng L3 hoàn toàn trống. Đề xuất viết khi có trigger:
- Incident report production → root cause → viết L3 reproduce
- Security review flag specific endpoint → L3 fuzzing
- Customer support ticket lặp lại → L3 reproducer

Không nên viết L3 prematurely (dễ thành flaky test).

---

## Tổng quan progress

| Sprint | Module | TC count | Effort | Status |
|---|---|---|---|---|
| 1 | W-M16 Achievements | 10 | 0.5 ngày | ⬜ |
| 1 | W-M17 Leaderboard | 10 | 0.5 ngày | ⬜ |
| 2 | W-M18 Basic Quiz | 9 | 0.5 ngày | ⬜ |
| 2 | W-M03 Lifelines | 4 | 0.25 ngày | ⬜ |
| 2 | W-M01 Register | 4 | 0.25 ngày | ⬜ |
| 3 | W-M06 WS gameplay | ~15 | TBD | ⏭️ |
| 4 | W-M11 xpMultiplier | 1 | unskip | ❌ |

**Sprint 1+2 total**: 37 TC mới, ~2 ngày.

## Workflow per TC (E2E Test Gate)

Theo [CLAUDE.md](../../CLAUDE.md):
1. Viết markdown spec trong `playwright/specs/{smoke|happy-path}/W-Mxx-*.md` theo [TEMPLATE.md](TEMPLATE.md)
2. Viết Playwright code trong `apps/web/tests/e2e/{smoke|happy-path}/web-user/W-Mxx-*.spec.ts` theo [PLAYWRIGHT_CODE_CONVENTIONS.md](../../apps/web/PLAYWRIGHT_CODE_CONVENTIONS.md)
3. Chạy: `npx playwright test tests/e2e/smoke/web-user/W-Mxx-*.spec.ts`
4. Verify pass → cập nhật INDEX.md và TC-TODO.md (đánh ✅)
5. Commit `test: W-Mxx Lx-xxx — <description>`
