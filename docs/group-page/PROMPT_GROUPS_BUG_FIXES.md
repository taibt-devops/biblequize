# PROMPT: Fix Groups Page Critical Bugs (v2 — verified against codebase)

> **Source:** Visual review screenshot 2026-04-30 — sau khi đối chiếu source code thật
> **Scope:** Fix 5 bug critical, KHÔNG redesign UI. Dashboard rebuild ở sprint riêng (`PROMPT_GROUPS_DASHBOARD_SPRINT.md`).
> **Effort:** ~2h total
> **Branch:** `fix/groups-critical-bugs`
> **Pre-read bắt buộc:** `CLAUDE.md` section "Think Before Code" + "Known Issues" + "E2E Test Gate"

---

## 📌 Files thực tế bị ảnh hưởng (đã verify)

| File | Vai trò | LOC |
|---|---|---|
| `apps/web/src/pages/Groups.tsx` | Entry page `/groups` — render NoGroupView hoặc GroupOverview | ~600 |
| `apps/web/src/pages/GroupDetail.tsx` | Page `/groups/:id` — full group page với 4 tabs | ~700+ |
| `apps/api/src/main/java/com/biblequiz/api/ChurchGroupController.java` | REST controller | — |
| `apps/api/src/main/java/com/biblequiz/modules/group/service/ChurchGroupService.java` | Business logic | — |

> ⚠️ Components KHÔNG nằm trong `components/groups/` — directory này không tồn tại. Tất cả render inline trong 2 page files trên. **Không tạo subdirectory mới** trong sprint này (sẽ tách ở Dashboard sprint).

---

## 🐛 5 bugs với root cause đã verify

| # | Bug | File | Root cause thật | Severity |
|---|---|---|---|---|
| 1 | "UNDEFINED" subtitle (or "undefined" text) trong leaderboard | `Groups.tsx` | Field name mismatch: FE đọc `member.points`, BE trả `member.score` | P0 |
| 2 | "0 THÀNH VIÊN" mâu thuẫn với leaderboard có 2 user | `ChurchGroupService.java` + FE fallback | `ChurchGroup.memberCount` lưu trong DB out-of-sync với actual `GroupMember` rows | P0 |
| 3 | Group name không hiển thị (render trống) | `Groups.tsx` line 205 | Render `{group.name}` không fallback. Nếu API trả empty/null name → blank `<h1>` | P0 |
| 4 | Podium chỉ render 2 cards khi nhóm có 2 thành viên | `Groups.tsx` line 254-313 | Conditional `{top3.length > 1}` và `{top3.length > 2}` — slot 3 không render khi không có data, không có empty state | P1 |
| 5 | Layout mâu thuẫn: header "no group" nhưng leaderboard có data | `Groups.tsx` line 421-422 | `myGroupId` đọc từ `localStorage` key `biblequiz_my_groups`, KHÔNG gọi `GET /api/groups/me`. localStorage có thể stale (user rời nhóm trên thiết bị khác, hoặc clear cache). | P1 |

---

## 🚨 Trước khi code (BẮT BUỘC theo CLAUDE.md)

```
BƯỚC 1 — Đọc TODO.md hiện tại. Nếu có task dở → hoàn thành trước.
BƯỚC 2 — Đọc Groups.tsx + GroupDetail.tsx + ChurchGroupController.java + ChurchGroupService.java.
         Verify field names trong response trước khi sửa.
BƯỚC 3 — Ghi 5 task vào TODO.md theo format CLAUDE.md (Status / File / Test / Checklist / Commit).
BƯỚC 4 — E2E Test Gate:
         • Đọc tests/e2e/INDEX.md → có module W-M cho Groups page chưa?
         • Đọc tests/e2e/playwright/specs/{smoke,happy-path}/ → có TC cho Groups?
         • Nếu CHƯA CÓ TC → viết spec markdown TRƯỚC, sau đó Playwright code, rồi mới fix bug.
         • Nếu CÓ TC → bug fix phải có ít nhất 1 test green sau khi fix.
BƯỚC 5 — Baseline test count:
         cd apps/web && npx vitest run | tail -5
         (ghi nhận số test pass — nếu < baseline sau khi xong thì revert)
```

---

## Task 1 — Fix "UNDEFINED" subtitle (P0, 25min)

**Root cause đã verify:** `apps/web/src/pages/Groups.tsx:22-28` khai báo:

```ts
interface LeaderboardMember {
  rank: number; userId: string; name: string;
  avatarUrl?: string; points: number;   // ← SAI
}
```

Backend `ChurchGroupService.getLeaderboard()` trả `entry.put("score", score)` — KHÔNG phải `points`. Khi render `formatPoints(top3[1].points)` ở line 270/290/310, `points === undefined` → `formatPoints` ở line 63-67 fail check `n >= 10000` rồi return `String(undefined)` = literal "undefined".

### Fix

1. Sửa interface ở `Groups.tsx`:
   ```ts
   interface LeaderboardMember {
     rank: number; userId: string; name: string;
     avatarUrl?: string;
     score: number;          // đổi từ points → score
     role?: string;          // BE cũng trả role, có thể dùng cho leader badge
     questionsAnswered?: number;
   }
   ```

2. Update mọi reference `.points` → `.score` trong [Groups.tsx:270, 290, 310, 337](apps/web/src/pages/Groups.tsx#L270).

3. Verify `GroupDetail.tsx` đã đúng (line 26-33 đã có `score: number`) → không cần sửa.

4. Defensive: thêm fallback trong `formatPoints` cho number undefined/null:
   ```ts
   function formatPoints(n: number | undefined | null): string {
     if (n == null || Number.isNaN(n)) return '0';
     // ... rest unchanged
   }
   ```

### Acceptance

- [ ] Không còn render literal "undefined" anywhere trong leaderboard
- [ ] Score hiển thị đúng (số điểm tuần) cho rank 1/2/3 + rest
- [ ] `formatPoints(undefined)` không crash, trả `'0'`
- [ ] Test `Groups.test.tsx` thêm case: leaderboard với member.score = 0 / undefined / large number → không có chuỗi "undefined" trong DOM
- [ ] Tầng 1 + Tầng 3 test pass
- [ ] Commit: `fix(groups): correct points→score field mismatch in leaderboard`

---

## Task 2 — Fix member count out-of-sync (P0, 35min)

**Root cause đã verify:** `ChurchGroup` entity có field `memberCount` lưu trong DB. Service tăng/giảm thủ công khi join/leave/kick. Nhưng có nhiều đường dẫn không update field này (vd legacy data, group import từ seed, race condition concurrent join). Khi `getGroupDetails` trả `memberCount` từ field cached → sai. Trong khi đó leaderboard query trực tiếp `groupMemberRepository.findByGroupId` → trả đúng số rows.

### Fix (backend là proper solution, FE là fallback)

**Option chọn: backend recompute on read.**

1. Sửa `ChurchGroupService.getGroupDetails()`:
   ```java
   int actualCount = groupMemberRepository.countByGroupId(groupId);
   if (actualCount != group.getMemberCount()) {
       group.setMemberCount(actualCount);
       churchGroupRepository.save(group);
   }
   result.put("memberCount", actualCount);
   ```

2. Tương tự cho `getMyGroup()` line 146 — dùng `countByGroupId` thay vì `group.getMemberCount()`.

3. **FE fallback** (defensive, để tránh regression nếu BE chưa deploy): trong `Groups.tsx` GroupOverview, ưu tiên `members.length` nếu có:
   ```ts
   // Nếu BE bổ sung members[] vào response (đã có trong getGroupDetails)
   const memberCount = group.members?.length ?? group.memberCount ?? 0;
   ```
   Update interface `GroupInfo` để có optional `members?: Array<{userId: string; ...}>`.

4. **Verify khi test:** sau fix, group test với 2 thành viên thật phải hiện "2 THÀNH VIÊN" cả ở header `Groups.tsx` line 211 và ở `GroupDetail.tsx` stats bar.

### Acceptance

- [ ] BE: `countByGroupId` query thay vì cached field cho mọi GET endpoint trả memberCount
- [ ] BE: unit test cho `getGroupDetails` verify count match `groupMemberRepository.findByGroupId().size()`
- [ ] FE: render đúng count trong cả 2 page (Groups + GroupDetail)
- [ ] FE test: mock API trả `memberCount: 0` nhưng `members.length === 2` → vẫn render "2 thành viên" (fallback work)
- [ ] Tầng 1 + Tầng 3 test pass (FE + BE)
- [ ] Commit: `fix(groups): recompute memberCount from actual rows + FE fallback`

> 💡 Optional improvement — defer FOLLOWUPS.md: thêm scheduled job recompute memberCount cho mọi group nightly để self-heal.

---

## Task 3 — Group name fallback + verify display (P0, 15min)

### Investigation trước khi fix

```
1. Reproduce screenshot scenario:
   • Verify trong DB: group hiện tại có name = NULL hoặc "" không?
   • SELECT id, name FROM church_groups WHERE id = '<screenshot_group_id>';

2. Nếu name có data → bug là CSS overlap (banner gradient che heading).
   Inspect dev tools → check z-index của <h1> trong header.

3. Nếu name NULL/"" → BE bug. Kiểm tra createGroup validate (đã có:
   if (name == null || name.isBlank()) return badRequest()) → nhưng group cũ có thể đã insert qua seed.
```

### Fix (cover cả 2 trường hợp)

1. **FE defensive render** trong `Groups.tsx:205` và `GroupDetail.tsx:353`:
   ```tsx
   <h1>{group.name?.trim() || t('groups.untitledGroup')}</h1>
   ```
   Thêm i18n key `groups.untitledGroup`: "Nhóm chưa đặt tên" (vi) / "Untitled Group" (en).

2. **CSS check** trong `Groups.tsx:182` header:
   - Verify `<h1>` có `relative z-10` để không bị gradient overlay che (line 191-192).
   - Hiện tại đã có `relative z-10` trên container → OK, nhưng nếu vẫn invisible → đổi text color contrast tăng.

3. **BE guard** (nếu Task 2 phát hiện corrupted data): trong `getGroupDetails`, nếu `group.getName()` blank → log warning + return placeholder name.

### Acceptance

- [ ] `Groups.tsx` + `GroupDetail.tsx` đều có fallback i18n cho name
- [ ] Test case: mock group `{name: ''}` → render fallback string, KHÔNG render `<h1></h1>` empty
- [ ] Test case: mock group `{name: 'Hội Thánh Tin Lành'}` → render đúng
- [ ] i18n validator pass: `cd apps/web && npm run validate:i18n`
- [ ] Tầng 1 + Tầng 3 test pass
- [ ] Commit: `fix(groups): fallback i18n key for empty group name`

---

## Task 4 — Podium 3-slot pattern (P1, 30min)

**Root cause đã verify:** `Groups.tsx:254-313` render podium với:
- Rank 1 luôn render (center, line 274-292)
- Rank 2 conditional `{top3.length > 1}` (line 254-272)
- Rank 3 conditional `{top3.length > 2}` (line 295-312)

→ Khi group có 2 thành viên (top3.length === 2): slot 3 không có placeholder → grid 3 cột bị lệch.

### Fix

1. Trong `Groups.tsx` GroupOverview, thay thế 3 conditional blocks bằng pattern fixed 3-slot:

   ```tsx
   const slots = [
     top3[1] ?? null,  // left = rank 2
     top3[0] ?? null,  // center = rank 1
     top3[2] ?? null,  // right = rank 3
   ];

   <div className="grid grid-cols-3 gap-6 mb-12 items-end">
     <PodiumSlot member={slots[0]} rank={2} />
     <PodiumSlot member={slots[1]} rank={1} elevated />
     <PodiumSlot member={slots[2]} rank={3} />
   </div>
   ```

2. Thêm helper component `PodiumSlot` (inline trong Groups.tsx, không tạo file mới — theo constraint sprint):
   - Khi `member` có data → render avatar + name + score (như hiện tại)
   - Khi `member === null` → render empty placeholder:
     ```tsx
     <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col items-center text-center border-b-4 border-secondary/10 border-dashed opacity-60">
       <div className="w-16 h-16 rounded-full border-2 border-dashed border-on-surface-variant/30 flex items-center justify-center mb-4">
         <span className="material-symbols-outlined text-on-surface-variant/40">person_add</span>
       </div>
       <p className="text-xs text-on-surface-variant">{t('groups.podiumEmptySlot')}</p>
     </div>
     ```

3. Style classes giữ nguyên existing (`bg-surface-container-low`, `border-secondary/10`, etc.) — KHÔNG thêm token mới (CLAUDE.md design system rule).

4. Thêm i18n key: `groups.podiumEmptySlot`: "Còn trống" (vi) / "Empty slot" (en).

### Acceptance

- [ ] 0 thành viên → 3 empty slots
- [ ] 1 thành viên → rank 1 center + 2 empty slots
- [ ] 2 thành viên → rank 1 + rank 2 + 1 empty slot (rank 3)
- [ ] 3+ thành viên → 3 slots full như hiện tại
- [ ] Mobile responsive: grid 3 cols compact ở 320px, không overflow
- [ ] i18n validator pass
- [ ] Snapshot test update (nếu có) match new structure
- [ ] Tầng 1 + Tầng 3 test pass
- [ ] Commit: `fix(groups): podium always renders 3 slots with empty state`

---

## Task 5 — Sync myGroupId với backend (P1, 25min)

**Root cause đã verify:** `Groups.tsx:421-422` đọc `myGroupId` từ `localStorage[biblequiz_my_groups]`. localStorage được set/update tại:
- `Groups.tsx:436, 462` (sau create/join)
- `GroupDetail.tsx:138` (sau load group detail)
- `GroupDetail.tsx:244` (sau leave group → `removeSavedGroup`)

→ Stale state: user rời nhóm trên thiết bị khác, hoặc clear localStorage, hoặc backend xóa group → localStorage còn entry nhưng group thật không còn / user không còn membership.

### Fix

1. **Source of truth = backend.** Đổi `Groups.tsx` dùng `useQuery` gọi `GET /api/groups/me`:

   ```tsx
   const { data: myGroupRes, isLoading } = useQuery<{ hasGroup: boolean; groupId?: string; groupName?: string }>({
     queryKey: ['my-group'],
     queryFn: () => api.get('/api/groups/me').then(r => r.data),
     enabled: isAuthenticated,
     staleTime: 30_000,  // 30s — không cần refetch quá thường
   });

   const myGroupId = myGroupRes?.hasGroup ? myGroupRes.groupId : null;
   ```

2. **localStorage giữ làm cache** (cho offline-friendly init, không phải source of truth):
   - Đọc localStorage làm initial state placeholder
   - Sau khi `useQuery` resolve → reconcile: nếu `myGroupRes.hasGroup === false` mà localStorage có entry → clear localStorage
   - Nếu `hasGroup === true` mà localStorage không có → save vào localStorage

3. **Loading state:** khi `isLoading === true` → render `<GroupSkeleton />`, không render NoGroupView prematurely.

4. **Error handling:** nếu API fail (401/500) → fallback về localStorage để không crash, nhưng show toast warning một lần.

5. Cập nhật `localStorage keys` table trong CLAUDE.md (nếu có thay đổi semantics: từ "source of truth" → "cache").

### Acceptance

- [ ] Page render đúng theo backend state, KHÔNG dựa vào localStorage stale
- [ ] User rời nhóm trên device A → mở device B → trang `/groups` show NoGroupView (không show overview của group cũ)
- [ ] Loading state hiện skeleton, không nháy giữa NoGroupView và GroupOverview
- [ ] localStorage tự động clear khi backend báo `hasGroup: false`
- [ ] Test: mock `/api/groups/me` trả `{hasGroup: false}` + localStorage có entry → render NoGroupView + localStorage cleared
- [ ] Test: mock `/api/groups/me` trả `{hasGroup: true, groupId: 'xxx'}` → render GroupOverview với groupId đúng
- [ ] E2E test mới (W-M{xx}-L1-00x): user joins group → reload page → still in overview (consistency check)
- [ ] Tầng 1 + Tầng 2 (file nhạy cảm — chạm authStore không, chạm api/client.ts không) + Tầng 3 test pass
- [ ] Commit: `fix(groups): use /api/groups/me as source of truth, localStorage as cache`

---

## ✅ Final regression (Tầng 3 BẮT BUỘC trước commit cuối)

```bash
# 1. FE unit
cd apps/web && npx vitest run | tail -5
# Expect: số test ≥ baseline (ghi ở Bước 5 pre-flight)

# 2. FE i18n validator
cd apps/web && npm run validate:i18n
# Expect: ≤ baseline hardcoded count (currently 116)

# 3. FE build
cd apps/web && npm run build

# 4. FE e2e (W-M groups module)
cd apps/web && npx playwright test tests/e2e/smoke/web-user/W-M*group*.spec.ts
cd apps/web && npx playwright test tests/e2e/happy-path/web-user/W-M*group*.spec.ts

# 5. BE
cd apps/api && ./mvnw test -Dtest="com.biblequiz.api.ChurchGroupControllerTest,com.biblequiz.modules.group.**"

# 6. Visual smoke (manual) — 3 scenarios
# A. Fresh user (no group): Groups page → NoGroupView, không có literal "undefined" anywhere
# B. User in group with 2 members: header "2 thành viên" + group name visible + podium 3 slots (1 empty)
# C. User in group with 5+ members: full podium + rest list + score numbers correct
```

---

## ⚠️ Constraints (theo CLAUDE.md)

- **5 commits riêng biệt** (1 task = 1 commit), KHÔNG gộp.
- **Không tạo subdirectory `components/groups/`** trong sprint này — defer sang dashboard sprint.
- **Không thêm dependency mới** — bug fix only.
- **Không refactor ngoài scope.** Phát hiện issue khác → ghi `docs/FOLLOWUPS.md`.
- **Không skip 3 tầng test** trước commit.
- **Web-only.** Mobile (`apps/mobile/src/screens/groups/`) là follow-up commit riêng.
- **Files nhạy cảm bị chạm:** `Groups.tsx` (page top-level), `localStorage` semantics → BẮT BUỘC chạy Full Regression NGAY sau Task 5.

---

## 🤔 Nếu gặp blocker

| Blocker | Action |
|---|---|
| BE không deploy được kịp Task 2 | FE fallback `members?.length` work standalone — commit FE trước, BE follow-up |
| Group seed có name NULL → existing test fail | Update SQL seed để set default name, hoặc skip test với note FOLLOWUPS |
| `/api/groups/me` trả 401 cho unauthenticated user | OK — `enabled: isAuthenticated` đã guard. Test với cả 2 state |
| Snapshot test fail do podium structure đổi | Update snapshot — visual change đúng intention |
| E2E TC chưa có cho Groups module | Viết spec markdown TRƯỚC theo `tests/e2e/TEMPLATE.md`, rồi Playwright code, rồi fix bug |

---

## 📋 Files manifest

**Modify (FE):**
- `apps/web/src/pages/Groups.tsx` — Tasks 1, 3, 4, 5
- `apps/web/src/pages/GroupDetail.tsx` — Task 3 (fallback name)
- `apps/web/src/locales/{vi,en}/translation.json` — i18n keys mới (Tasks 3, 4)

**Modify (BE):**
- `apps/api/src/main/java/com/biblequiz/modules/group/service/ChurchGroupService.java` — Task 2

**New (E2E):**
- `apps/web/tests/e2e/playwright/specs/{smoke,happy-path}/W-M{xx}-groups-page.md` — TC spec (nếu chưa có)
- `apps/web/tests/e2e/{smoke,happy-path}/web-user/W-M{xx}-groups-page.spec.ts` — Playwright code

**Update docs:**
- `TODO.md` — 5 task entries
- `tests/e2e/TC-TODO.md` — TC ID tracking
- `docs/FOLLOWUPS.md` — issues phát hiện ngoài scope
- `CLAUDE.md` localStorage table — nếu Task 5 đổi semantics

---

## 🎯 Definition of Done (CLAUDE.md compliance)

- [ ] 5 commits pushed lên `fix/groups-critical-bugs`
- [ ] Tầng 1 + 2 + 3 test pass — số test ≥ baseline
- [ ] i18n validator: hardcoded count ≤ 116
- [ ] BE test pass: `com.biblequiz.modules.group.**`
- [ ] E2E test pass: W-M groups module
- [ ] Manual smoke 3 scenarios green
- [ ] TODO.md update với commit hash mỗi task
- [ ] FOLLOWUPS.md cập nhật nếu có issue khác phát hiện
- [ ] DECISIONS.md ghi nhận: "localStorage là cache, /api/groups/me là source of truth" (kỹ thuật decision)
- [ ] Mobile sync ghi vào FOLLOWUPS.md cho next sprint

---

*Rewrite 2026-05-02 — verified against Groups.tsx, GroupDetail.tsx, ChurchGroupController, ChurchGroupService. Field-name mismatch (`points` vs `score`) là root cause "undefined" bug — không phải tier name fallback như prompt v1 đoán.*
