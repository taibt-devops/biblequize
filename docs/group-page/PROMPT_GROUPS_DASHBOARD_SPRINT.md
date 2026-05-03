# PROMPT: Groups Dashboard Implementation Sprint (v2 — verified against codebase)

> **Pre-requirement:** ✅ 5 critical bugs fixed via `PROMPT_GROUPS_BUG_FIXES.md` (merged)
> **Scope:** Mở rộng dashboard cho 4 scenarios — KHÔNG rewrite from scratch.
> **Architecture reality:** 3 page files đã tồn tại — extend chúng, không tạo mới.
> **Effort estimate:** 12-18h (chia 4 phases, mỗi phase độc lập commit-được)
> **Branch chiến lược:** mỗi phase 1 branch riêng, merge tuần tự (không bundle)
> **Pre-read bắt buộc:** `CLAUDE.md` ("Think Before Code", "E2E Test Gate", "Stitch workflow")

---

## 🗺️ Architecture reality (đã verify trong codebase)

### Files đã tồn tại — CẤM tạo lại

| File | Route | Trạng thái |
|---|---|---|
| `apps/web/src/pages/Groups.tsx` | `/groups` | Entry: NoGroupView (chưa có nhóm) ↔ GroupOverview (đã có nhóm). Sau bug fix sprint → đọc state từ `/api/groups/me`. |
| `apps/web/src/pages/GroupDetail.tsx` | `/groups/:id` | Full page với **4 tabs**: leaderboard, members, announcements, quiz-sets. Đã có invite/leave/edit modal. |
| `apps/web/src/pages/GroupAnalytics.tsx` | `/groups/:id/analytics` | **Đã có** chart, KPI, top contributors. **CẢ 3 data sources mock** (top contributors hardcode line 15-21, weekly chart hardcode line 34-42, fields `totalQuizzes/avgScore` BE chưa trả) |
| `apps/api/.../ChurchGroupController.java` | API | Đã có endpoints: create, join, leave, get, leaderboard, analytics, quiz-sets, announcements, kick, update, delete |
| `apps/api/.../ChurchGroupService.java` | Logic | `getAnalytics()` chỉ trả `{totalMembers, activeToday}` — thiếu nhiều field FE expect |

### Routes đã được wire trong `main.tsx` — KHÔNG thêm route mới trừ khi cần thiết

### Component directory `apps/web/src/components/groups/` **CHƯA TỒN TẠI**
> Quyết định: Sprint này tạo directory + tách components KHI VÀ CHỈ KHI 1 component được reuse ≥ 2 places. Inline-first.

---

## ⚠️ 4 scenarios — match với 3 pages đã có

| Scenario | Page | Trạng thái hiện tại | Sprint sẽ làm |
|---|---|---|---|
| **1. Empty state** (chưa có nhóm) | `Groups.tsx` (NoGroupView) | Có button create/join + i18n. Thiếu: featured groups, benefits highlight | Phase 1 |
| **2. Member dashboard** | `Groups.tsx` (GroupOverview) | Có hero + leaderboard + announcements. Thiếu: link tới full GroupDetail rõ ràng | Phase 2 |
| **3. Leader dashboard** | `GroupDetail.tsx` + `GroupAnalytics.tsx` | Có tabs đầy đủ + analytics page. **Mock data 3 chỗ trong GroupAnalytics** | Phase 3 |
| **4. Member list expanded** | `GroupDetail.tsx` tab `members` | Đã có list. Thiếu: search, filter chips, sort, pagination | Phase 4 |

---

## 🚧 Phase 0 — Backend prep (BLOCKING, làm TRƯỚC mọi phase FE)

> Phase này **bắt buộc xong trước Phase 3**. Phase 1, 2, 4 có thể parallel với Phase 0.

### 0.1 — `/api/groups/public` (cho Phase 1 FeaturedGroups)

**Tạo mới:**

```java
// ChurchGroupController.java
@GetMapping("/public")
public ResponseEntity<?> listPublicGroups(
    @RequestParam(defaultValue = "10") int limit,
    @RequestParam(defaultValue = "false") boolean featured) {
    // ChurchGroupService.listPublicGroups(limit, featured)
    //   → query: WHERE isPublic = true AND deletedAt IS NULL
    //     ORDER BY featured ? activityScore : memberCount DESC
    //     LIMIT :limit
    //   → return [{id, name, memberCount, location, avatarUrl, weeklyActiveStreak?}]
}
```

**Featured ranking:** đơn giản — `memberCount * 0.3 + activeMembersThisWeek * 0.7`. Cache 1h (`@Cacheable`).

**Acceptance:**
- [ ] Trả ≤ `limit` groups, chỉ public + not deleted
- [ ] Featured = true → sort by activity blend; false → sort by createdAt DESC
- [ ] Test: 0/1/100 public groups → render đúng
- [ ] Commit: `feat(api): GET /api/groups/public for featured/public group discovery`

### 0.2 — Mở rộng `/api/groups/{id}/analytics`

`getAnalytics()` hiện chỉ trả `{totalMembers, activeToday}`. Frontend `GroupAnalytics.tsx` đọc 4 fields:
- `totalMembers` ✅
- `activeToday` ✅
- `totalQuizzes` ❌ chưa có
- `avgScore` ❌ chưa có

**Mở rộng response:**

```java
result.put("totalMembers", totalMembers);
result.put("activeToday", activeToday);
result.put("totalQuizzes", totalQuizzes);     // count distinct sessions trong 7 ngày
result.put("avgScore", avgScore);              // weighted average accuracy
result.put("weeklyActivity", weeklyActivity); // List<{date, activeCount}> 7 ngày gần nhất
result.put("topContributors", top);            // List<{userId, name, avatarUrl, score}> top 5
```

`weeklyActivity` + `topContributors` thay 2 mock arrays trong frontend.

**Acceptance:**
- [ ] BE test: response có đủ 6 keys, không null
- [ ] BE test: weeklyActivity luôn 7 entries (fill 0 cho ngày không có activity)
- [ ] Frontend i18n key `groupAnalytics.noData` vẫn work khi tất cả 0
- [ ] Commit: `feat(api): expand group analytics with weeklyActivity + topContributors`

### 0.3 — `/api/groups/{id}/members` riêng (cho Phase 4 list expanded)

Hiện tại `GET /api/groups/{id}` trả members nested trong response. Cho list expanded cần endpoint riêng có pagination + search + filter.

```java
@GetMapping("/{id}/members")
public ResponseEntity<?> listMembers(
    @PathVariable String id,
    @RequestParam(required = false) String search,    // tên (case-insensitive contains)
    @RequestParam(defaultValue = "score") String sort,  // score | tier | activity | joined
    @RequestParam(defaultValue = "desc") String order,
    @RequestParam(required = false) String filter,    // null | leader | mod | inactive
    @RequestParam(defaultValue = "20") int limit,
    @RequestParam(required = false) String cursor) {
    // return { items: [...], nextCursor: "...", total: N }
}
```

**Inactive filter:** member có `lastActiveAt < now() - 7 days`. Cần thêm field `last_active_at` trong `group_members` (Flyway migration mới `V{n}__add_last_active_to_group_members.sql`).

**Acceptance:**
- [ ] Migration chạy clean trên DB trống
- [ ] `lastActiveAt` được update mỗi khi user submit quiz answer (trigger từ AnswerService — coordinate riêng)
- [ ] Test: search "Tai" trong group có 5 user → return chỉ matches
- [ ] Test: filter=inactive → chỉ user > 7d không active
- [ ] Test: pagination cursor → trả đúng 20 + nextCursor null khi hết
- [ ] Commit: `feat(api): paginated/filtered members endpoint + lastActiveAt`

### 0.4 — `/api/groups/{id}/members/{userId}/role` (promote/demote)

Đã có `kickMember`. Thêm:

```java
@PatchMapping("/{id}/members/{userId}/role")
public ResponseEntity<?> changeRole(
    @PathVariable String id, @PathVariable String userId,
    @RequestBody Map<String,String> body, Principal principal) {
    String role = body.get("role"); // "MEMBER" | "MOD"
    // chỉ leader được đổi role; cấm leader self-demote
}
```

**Acceptance:**
- [ ] Chỉ LEADER mới được call (other → 403)
- [ ] Cannot demote self
- [ ] Cannot change role của LEADER khác (chỉ có 1 leader, không transfer trong sprint này)
- [ ] Test BE
- [ ] Commit: `feat(api): change group member role (promote/demote)`

### 0.5 — `last_active_at` trigger từ quiz answer

Coordinate với quiz module. Trong `AnswerService` (hoặc tương đương), sau khi save answer → update `GroupMember.lastActiveAt = now()` cho mọi group user thuộc về.

**Defer-able** nếu rủi ro lớn → implement Phase 4 với cột mặc định `joinedAt` làm proxy (kèm note FOLLOWUPS).

---

## 🎨 Phase 0.5 — Stitch design check (TRƯỚC mọi work UI)

Theo CLAUDE.md "Workflow khi sync Stitch design":

```
1. MCP query Stitch project (ID 5341030797678838526) cho:
   • "Groups empty state" / "Khám phá nhóm"
   • "Group dashboard member"
   • "Group dashboard leader"
   • "Group members list"
2. Save HTML files vào docs/designs/stitch/ nếu chưa có
3. Liệt kê sections (DIFF table) — code hiện tại vs Stitch
4. Nếu Stitch KHÔNG có design → tự thiết kế match design tokens (.glass-card, gold-gradient, etc.)
   KHÔNG hardcode color hoặc tạo CSS utility mới
```

**Acceptance:**
- [ ] HTML files saved (hoặc note "Stitch không có design này, tự follow tokens")
- [ ] DIFF table cho mỗi scenario ghi vào `docs/group-page/STITCH_DIFF.md`
- [ ] Commit: `docs(groups): Stitch design audit + DIFF for 4 scenarios`

---

## Phase 1 — Empty state enhancement (~3h, 4 commits)

**File:** `apps/web/src/pages/Groups.tsx` → mở rộng `NoGroupView` component (line 91-132).

### Task 1.1 — Refactor NoGroupView thành 3-section layout (45min)

Hiện tại NoGroupView chỉ icon + 2 button. Mở rộng:

```
┌─────────────────────────────────┐
│  Hero: icon + title + CTAs      │  ← giữ existing
├─────────────────────────────────┤
│  Benefits grid (3 cards)        │  ← mới
├─────────────────────────────────┤
│  Featured public groups list    │  ← mới (cần Phase 0.1)
└─────────────────────────────────┘
```

**Implementation:**
- Mở rộng inline trong Groups.tsx (không tạo subdirectory)
- Tổng LOC mới ≤ 80
- Reuse design tokens: `.glass-card`, `.gold-gradient`, surface-container colors
- 3 i18n key mới: `groups.benefit{1,2,3}.title` + `description`

**Acceptance:**
- [ ] Layout responsive 320/375/768/1024
- [ ] Existing CTAs work (create/join modals)
- [ ] Test snapshot update
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): expand NoGroupView with benefits section`

### Task 1.2 — FeaturedGroupsList component (45min)

**Phụ thuộc Phase 0.1.** Nếu BE chưa xong → skip task này, defer đến khi merge.

```tsx
// inline trong Groups.tsx
function FeaturedGroupsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-groups', 'featured'],
    queryFn: () => api.get('/api/groups/public?featured=true&limit=3').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton />;
  if (!data?.groups?.length) return null; // graceful empty
  return <div>...</div>;
}
```

**Acceptance:**
- [ ] Skeleton state, empty state, error state đều handled (3 page states theo CLAUDE.md FE rule)
- [ ] Click "Tham gia" trên group row → trigger join modal với code prefilled
- [ ] Test với 0/1/3 groups
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): featured public groups in empty state`

### Task 1.3 — Benefits grid (30min)

3 cards: BXH riêng / Quiz set hội thánh / Streak nhóm. Static content, dùng i18n.

**Acceptance:**
- [ ] Responsive (3 cols desktop, 1 col mobile, không 3 cols compact ép vỡ)
- [ ] i18n validator pass
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): benefits grid in empty state`

### Task 1.4 — JoinByCodeModal kiểm tra existing (15min)

Modal join đã có ở `Groups.tsx:550-592`. **Verify** logic + style match design tokens. Không tạo lại.

**Acceptance:**
- [ ] Pass — chỉ note vào commit
- [ ] Commit: `chore(groups): verify existing join modal aligns with Phase 1 spec`

---

## Phase 2 — Member dashboard polish (~2h, 3 commits)

**File:** `apps/web/src/pages/Groups.tsx` `GroupOverview` component (line 136-396) — đã đầy đủ structure sau bug fix sprint. Phase này tinh chỉnh:

### Task 2.1 — Link "Xem chi tiết nhóm →" tới GroupDetail (30min)

Hiện tại Groups.tsx GroupOverview render summary. User cần biết có thể click qua `/groups/:id` để xem full tabs.

```tsx
// Trong header card hoặc bottom CTA
<Link to={`/groups/${group.id}`} className="...">
  {t('groups.viewFullGroup')} →
</Link>
```

**Acceptance:**
- [ ] CTA visible, navigate đúng
- [ ] i18n key mới
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): link from overview to full group page`

### Task 2.2 — "Xem tất cả X thành viên" link tới members tab (30min)

Sau podium + rest list. Link target `/groups/:id?tab=members`. Cần `GroupDetail.tsx` đọc query param `tab` để mở đúng tab khi mount.

```tsx
// GroupDetail.tsx
const [searchParams] = useSearchParams();
const initialTab = (searchParams.get('tab') as TabKey) ?? 'leaderboard';
const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
```

**Acceptance:**
- [ ] Click "Xem tất cả X thành viên" → mở `/groups/:id?tab=members` → land trên tab members
- [ ] Direct link hoạt động (paste URL với `?tab=announcements` → mở tab đó)
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): deep-link to specific tab via ?tab= query param`

### Task 2.3 — Loading skeleton match final shape (30min)

`GroupSkeleton` ở line 71-87 đã có nhưng shape không match GroupOverview. Đối chiếu lại để no layout shift khi data load.

**Acceptance:**
- [ ] Skeleton dimensions ≈ actual rendered dimensions
- [ ] No CLS (cumulative layout shift) measurable
- [ ] Tầng 1+3 test pass
- [ ] Commit: `fix(groups): skeleton matches actual overview shape`

---

## Phase 3 — Leader dashboard fixes (~3h, 5 commits)

**File chính:** `apps/web/src/pages/GroupAnalytics.tsx` (đã tồn tại nhưng có 3 mock).
**Phụ thuộc:** Phase 0.2 (mở rộng analytics endpoint).

### Task 3.1 — Replace mock weekly chart (45min)

Hiện tại `WEEKLY_CHART_DATA` hardcode line 34-42. Phụ thuộc Phase 0.2 trả `weeklyActivity`.

```tsx
const weeklyData = (analytics?.weeklyActivity ?? []).map(d => ({
  label: formatDayShort(d.date),  // T2/T3/T4/...
  height: `${(d.activeCount / maxCount) * 100}%`,
  opacity: ...,
  tooltip: t('groupAnalytics.memberTooltip', { count: d.activeCount }),
}));
```

**Acceptance:**
- [ ] Chart render từ real data
- [ ] Empty data (group mới, chưa ai active) → skeleton hoặc message "Chưa đủ dữ liệu"
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): replace mock weekly chart with real analytics`

### Task 3.2 — Replace mock top contributors (30min)

Hiện tại `MOCK_TOP_CONTRIBUTORS` line 15-21. Thay bằng `analytics.topContributors`.

**Acceptance:**
- [ ] Render từ real data; null/empty → render placeholder "Chưa có dữ liệu"
- [ ] Avatar fallback (icon person) khi `avatarUrl` null
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): replace mock top contributors with real data`

### Task 3.3 — Inactive members alert (45min)

Sau Phase 0.3 có filter inactive. Thêm card alert trong GroupAnalytics:

```tsx
// Card warning
<div>
  <span>{inactiveCount} {t('groupAnalytics.inactiveMembers')}</span>
  <Link to={`/groups/${id}?tab=members&filter=inactive`}>
    {t('groupAnalytics.viewInactiveList')} →
  </Link>
</div>
```

**Phụ thuộc Phase 4** (filter chip trên members tab).

**Acceptance:**
- [ ] Render khi `inactiveCount > 0` (lấy từ analytics response — cần Phase 0.2 mở rộng thêm field này)
- [ ] Hide khi `inactiveCount === 0`
- [ ] Click → navigate + auto-apply filter trên members tab
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): inactive members alert with filter deep-link`

### Task 3.4 — Quick actions panel (45min)

Add panel ở `GroupDetail.tsx` (trong tab leaderboard hoặc header) chỉ leader thấy. 4 actions:

1. 📚 Tạo quiz set → modal hoặc navigate `/groups/:id/quiz-sets/create`
2. 📢 Đăng thông báo → navigate to announcements tab + scroll to compose
3. 🏆 Tổ chức giải đấu → navigate `/tournaments/create?groupId=...` (verify route exists)
4. 👥 Quản lý thành viên → navigate members tab

**Acceptance:**
- [ ] Chỉ render khi `isLeader === true`
- [ ] Mỗi action work (verify navigate/modal đúng)
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): leader quick actions panel`

### Task 3.5 — Rename `totalQuizzes` → matching backend response (15min)

Sau Phase 0.2 BE trả đúng field `totalQuizzes`. Verify FE label "TOTAL XP" line 125 hiện sai (label nói XP nhưng field là quizzes count) — fix label hoặc fix BE field name. Quyết định ghi vào DECISIONS.md.

**Acceptance:**
- [ ] Label match field semantic
- [ ] i18n key đúng
- [ ] Tầng 1+3 test pass
- [ ] Commit: `fix(groups): align analytics label with backend field semantics`

---

## Phase 4 — Members tab expanded (~3h, 4 commits)

**File:** `apps/web/src/pages/GroupDetail.tsx` tab `members`.
**Phụ thuộc:** Phase 0.3 (paginated members endpoint), Phase 0.4 (role change endpoint).

### Task 4.1 — Search input + debounce (45min)

```tsx
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);
const { data } = useQuery({
  queryKey: ['group-members', groupId, debouncedSearch, sort, filter],
  queryFn: () => api.get(`/api/groups/${groupId}/members`, { params: { search: debouncedSearch, sort, filter, limit: 20 } }),
});
```

**Acceptance:**
- [ ] 300ms debounce, không call API mỗi keystroke
- [ ] Empty search → list full
- [ ] No results → render "Không tìm thấy thành viên nào"
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): search members in group detail tab`

### Task 4.2 — Filter chips + sort tabs (45min)

Chips: Tất cả · 👑 Leader · 🛡️ Mod · 💤 Inactive
Sort tabs: Theo điểm · Theo tier · Hoạt động · Ngày tham gia

**Acceptance:**
- [ ] Click chip → re-query với filter param
- [ ] Counts hiển thị đúng (lấy từ response `total` per filter)
- [ ] Active chip highlight gold (theo design tokens)
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): filter chips + sort options for members tab`

### Task 4.3 — Cursor pagination (45min)

```tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['group-members', ...],
  queryFn: ({ pageParam }) => api.get(..., { params: { cursor: pageParam, limit: 20 } }),
  getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
});
```

CTA "Hiện 20 thành viên tiếp theo →" trigger `fetchNextPage`.

**Acceptance:**
- [ ] Initial load 20 entries
- [ ] Click load more → append 20 (no replace)
- [ ] `hasNextPage === false` → ẩn button + show "Đã hiển thị tất cả N thành viên"
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): cursor-based pagination for members list`

### Task 4.4 — Leader role actions (45min)

Trong row member, leader thấy dropdown:
- Promote to mod (nếu role=member)
- Demote to member (nếu role=mod)
- Send reminder (cho inactive)
- Remove from group (existing kick)

Phụ thuộc Phase 0.4.

**Acceptance:**
- [ ] Chỉ render dropdown nếu currentUser là leader
- [ ] Cannot promote/demote leader (button disabled)
- [ ] Confirmation dialog trước khi remove
- [ ] Tầng 1+3 test pass
- [ ] Commit: `feat(groups): leader role management actions per member row`

---

## ✋ Defer khỏi sprint này (KHÔNG làm)

Prompt v1 list nhiều thứ — tách ra sprint sau:

| Item | Lý do defer |
|---|---|
| Sidebar widgets page-specific (group streak, group rank, tournament upcoming) | Cần investigate AppLayout pattern trước. Open-ended → riêng sprint. |
| Dedicated `/groups/:id/members` page | Members tab trong GroupDetail.tsx đã đủ — duplicate page là over-engineering. |
| Featured groups algorithm phức tạp (recency × accuracy × growth) | MVP dùng `memberCount + activeWeek`, optimize sau. |
| Mobile sync (`apps/mobile/src/screens/groups/`) | Sprint riêng; CLAUDE.md "Không sửa code module khác". |
| Tournament upcoming widget | Cần biết có Tournament feature ready chưa — verify trước. |
| Verse format detection trong announcements | Nice-to-have, defer. |
| Component subdirectory `components/groups/` | Tạo khi component được reuse ≥ 2 places — Phase 1-4 không trigger điều này. |

---

## ✅ Final regression (sau mỗi phase, KHÔNG đợi cuối sprint)

```bash
# Sau mỗi phase merge:
cd apps/web && npm run validate:i18n      # i18n validator
cd apps/web && npx vitest run | tail -5   # FE unit (≥ baseline)
cd apps/web && npm run build              # build
cd apps/web && npx playwright test tests/e2e/{smoke,happy-path}/web-user/W-M*group*.spec.ts
cd apps/api && ./mvnw test -Dtest="com.biblequiz.modules.group.**,com.biblequiz.api.ChurchGroupController*"
```

**Chỉ merge phase tiếp theo nếu phase trước Tầng 3 ALL GREEN.**

---

## ⚠️ Constraints

- **Mỗi task ≤ 100 LOC, mỗi phase 3-5 commits.** KHÔNG bundle.
- **Phase 0 (BE) phải xong trước Phase 1.2, 3.x, 4.x.** Phase 1.1, 1.3, 2.x có thể parallel với Phase 0.
- **Không tạo `components/groups/` directory** trừ khi component reuse ≥ 2 places.
- **Không thêm dependency mới.** Chart đã dùng inline SVG — KHÔNG install recharts/chartjs.
- **Không pixel-perfect Stitch trừ khi có HTML reference.** Phase 0.5 là output-or-skip.
- **Web-only.** Mobile sync là sprint khác.
- **CLAUDE.md "Workflow khi sync Stitch"** áp dụng cho Phase 1.1 nếu Stitch có design.

---

## 🤔 Nếu gặp blocker

| Blocker | Action |
|---|---|
| BE Phase 0 chưa xong, FE đang chờ | Mock data trong FE với feature flag `VITE_USE_MOCK_GROUPS=true`, document trong FOLLOWUPS. NEVER ship mock to prod. |
| Stitch không có design cho scenario | Tự design follow tokens, ghi DECISIONS.md "scenario X follows tokens, no Stitch reference" |
| Tournament feature chưa ready cho quick action | Disable button + tooltip "Coming soon", Task 3.4 acceptance soften |
| `lastActiveAt` trigger từ AnswerService phức tạp | Defer Phase 0.5, dùng `joinedAt` làm proxy → ghi FOLLOWUPS |
| Test e2e flake | KHÔNG skip test — investigate root cause (race condition? animation timing?). Dùng `expect().toBeVisible()` thay `waitForTimeout`. |
| Cursor pagination overflow context window khi test | Mock API trả page nhỏ trong test, không e2e với 200 members |

---

## 🔄 Backend coordination tickets (output cho BE team)

Tổng hợp ở `docs/BACKEND_FOLLOWUPS.md`:

```md
## Groups Dashboard — Required BE work (blocking FE Phase 1, 3, 4)

### Phase 0 deliverables (priority desc)
- [ ] Phase 0.1: GET /api/groups/public — featured + sort
- [ ] Phase 0.2: Expand GET /api/groups/{id}/analytics with weeklyActivity, topContributors, totalQuizzes, avgScore
- [ ] Phase 0.3: GET /api/groups/{id}/members with search/sort/filter/cursor pagination
- [ ] Phase 0.4: PATCH /api/groups/{id}/members/{userId}/role (promote/demote)
- [ ] Phase 0.5: AnswerService updates GroupMember.lastActiveAt on submit

### Migration scripts
- [ ] V{n}__add_last_active_to_group_members.sql — add `last_active_at TIMESTAMP NULL`
- [ ] Backfill lastActiveAt = joinedAt cho existing members

### Caching
- [ ] @Cacheable cho /api/groups/public (TTL 1h)
- [ ] @Cacheable cho /api/groups/{id}/analytics (TTL 5min)
```

---

## 📋 Files manifest

**Modify (FE):**
- `apps/web/src/pages/Groups.tsx` — Phase 1, 2
- `apps/web/src/pages/GroupDetail.tsx` — Phase 2.2, 3.4, 4.1-4.4
- `apps/web/src/pages/GroupAnalytics.tsx` — Phase 3.1, 3.2, 3.3, 3.5
- `apps/web/src/locales/{vi,en}/translation.json` — i18n keys mới

**Modify (BE):**
- `apps/api/.../ChurchGroupController.java` — Phase 0.1, 0.3, 0.4
- `apps/api/.../ChurchGroupService.java` — Phase 0.1, 0.2, 0.3, 0.4
- `apps/api/.../GroupMember.java` entity — Phase 0.5 add lastActiveAt
- `apps/api/.../db/migration/V{n}__add_last_active_to_group_members.sql` — Phase 0.5

**New (E2E):**
- `tests/e2e/playwright/specs/{smoke,happy-path}/W-M{xx}-groups-*.md` — TC specs cho 4 scenarios
- `tests/e2e/{smoke,happy-path}/web-user/W-M{xx}-groups-*.spec.ts` — Playwright code

**New (docs):**
- `docs/group-page/STITCH_DIFF.md` — Phase 0.5 audit
- `docs/BACKEND_FOLLOWUPS.md` — BE coordination
- `docs/FOLLOWUPS.md` — defer items + mocks ghi nhận

---

## 🎯 Definition of Done

Per phase:
- [ ] Phase BE (0): all 5 sub-tasks merged, BE test ≥ baseline
- [ ] Phase 1: empty state đẹp, featured groups hoạt động, benefits visible
- [ ] Phase 2: navigation overview ↔ detail mượt, deep-link tab work
- [ ] Phase 3: GroupAnalytics 0% mock data, leader quick actions live
- [ ] Phase 4: members search/filter/sort/pagination + role actions work

Cuối sprint:
- [ ] All commits pushed (≈ 20 commits across 5 phases)
- [ ] All E2E green cho W-M groups module
- [ ] No mock data trong production code (search `MOCK_` regex → 0 matches in src)
- [ ] BACKEND_FOLLOWUPS.md zero pending tickets cho phase đã merge
- [ ] Mobile sync ghi vào FOLLOWUPS.md cho sprint sau
- [ ] DECISIONS.md ghi: "GroupAnalytics: replaced mocks with backend; chart library = inline SVG (no dep added)"
- [ ] CLAUDE.md "API Endpoints Map" cập nhật với endpoints Phase 0 mới

---

*Rewrite 2026-05-02 — verified Groups.tsx (entry), GroupDetail.tsx (4 tabs), GroupAnalytics.tsx (3 mocks), ChurchGroupController + ChurchGroupService. Architecture: extend 3 existing pages, KHÔNG tạo dashboard mới from scratch. Backend Phase 0 là blocking critical path.*
