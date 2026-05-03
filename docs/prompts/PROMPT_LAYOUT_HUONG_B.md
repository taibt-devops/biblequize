# PROMPT: Refactor AppLayout — Hướng B (bỏ top bar desktop)

> **Issue ID:** HM-P0-1 trong `BUG_REPORT_HOME_POST_IMPL.md`
> **Decision:** Bui đã chọn **Hướng B** — bỏ top bar trên desktop, giữ trên mobile
> **Effort estimate:** 4-6h (revised từ 2-3h gốc — xem audit 2026-05-01 bên dưới)
> **Type:** Architecture refactor
> **Risk:** Medium (ảnh hưởng mọi page dùng AppLayout)

---

## 🔄 Audit 2026-05-01 (sau khi H1-H8 ship)

Prompt này viết 2026-04-30, cần update các điểm sau trước khi execute:

| Item | Original | Audit findings |
|------|----------|----------------|
| Test baseline | "387 passed" | **Actual: 1054 pass / 1 pre-existing fail** sau H1-H8 |
| DECISIONS.md path | `docs/DECISIONS.md` | **Actual: `DECISIONS.md` ở root project** (không phải /docs/) |
| Avatar dropdown items | 4 items (Profile/Settings/Lang/Logout) | **Current AppLayout có 5 items** (Profile/Achievements/Help/Lang/Logout). `/settings` route chưa tồn tại — nếu giữ Settings cần tạo route mới |
| Notification panel | Prompt assume "có thể chưa có" | **Header.tsx orphan đã có** ở `apps/web/src/components/Header.tsx` — chỉ test files import, KHÔNG mount production. Logic notification (timeAgo + fetch + mark-read) đã polished — **REUSE thay vì build mới** |
| `useMediaQuery` hook | "có thể đã có" | **KHÔNG tồn tại**. Prompt assume đúng — cần tạo. NHƯNG current AppLayout dùng pure Tailwind `hidden md:flex` (CSS-only, no FOUC). Cân nhắc giữ Tailwind approach thay vì JS-based `useMediaQuery` |

### Phương án đề xuất sau audit

| Phương án | Effort | UI quality | Code quality | Verdict |
|-----------|--------|------------|--------------|---------|
| **A. Theo prompt nguyên** (6 commits, 5 new files, build từ scratch) | 5-6h | Khá (mất polish vì không reuse Header.tsx) | Tốt (component separation) | OK nhưng phí logic Header.tsx |
| **B. Minimum-touch** (modify AppLayout inline 1-2 commits) | 2-3h | Khá (chưa polish notification) | Kém (AppLayout > 300 LOC vi phạm CLAUDE.md) | Nhanh nhưng nợ kỹ thuật |
| **C. Hybrid (recommend)** — extract 2 components reuse Header.tsx logic + minimum-touch AppLayout (3-4 commits) | 3-4h | **Tốt nhất** (reuse polished notification panel) | Tốt (component separation đúng mức) | **Best UI / effort ratio** |

**Khuyến nghị: Phương án C** — đem lại UI tốt nhất vì reuse được:
- Header.tsx's notification dropdown với timeAgo + mark-as-read (đã polished)
- Click-outside handler patterns (đã tested via Header.test.tsx)
- i18n keys `header.time.*` (đã có)

Nếu chọn C: tasks bên dưới sẽ thay đổi như sau:
- Task 2 → **extract 2 components** từ Header.tsx: `NotificationBell.tsx` + `UserDropdown.tsx` (thay vì viết mới SidebarHeader + SidebarUserCard)
- Task 3 → **reuse 2 components** trong MobileTopBar
- Task 4 → AppLayout refactor inline (giữ Tailwind responsive, KHÔNG cần useMediaQuery)
- Task 5+6 → giữ nguyên

---

## Quyết định đã chốt (KHÔNG hỏi lại Bui)

1. **Logo "Bible Quiz"** chỉ hiển thị 1 lần per viewport:
   - Desktop: trong sidebar header (trên user card)
   - Mobile: trong mobile top bar
2. **Notification bell**:
   - Desktop: cạnh logo trong sidebar header (Option A) — `[Bible Quiz]  [🔔]`
   - Mobile: cạnh avatar trong mobile top bar
3. **Avatar dropdown menu** (cả desktop + mobile):
   - 👤 Hồ sơ → `/profile`
   - ⚙️ Cài đặt → `/settings`
   - 🌐 Ngôn ngữ → toggle VI/EN inline (không navigate)
   - 🚪 Đăng xuất → call `authStore.logout()` + navigate `/login`

> **⚠️ Audit 2026-05-01:** Current AppLayout dropdown có **5 items** (Profile / Achievements / Help / Lang toggle / Logout). Prompt's 4 items **drops Achievements + Help, adds Settings** (route chưa tồn tại). Trước khi execute, decide:
> - Option 3a: giữ 5 items hiện tại (skip Settings)
> - Option 3b: thay đổi thành 4 items per prompt (cần tạo `/settings` page mới — out of scope refactor)
> - Option 3c: 6 items (5 hiện tại + Settings) — không recommend, dropdown quá dày

---

## Context

### Files hiện tại sẽ bị ảnh hưởng

```bash
# Audit trước khi bắt đầu
grep -rn "AppLayout" apps/web/src --include="*.tsx" -l
# Expect: AppLayout.tsx + tất cả pages dùng nó (Home, Leaderboard, Ranked, ...)
```

### Mockup reference

**Desktop (sau refactor):**
```
┌─ Sidebar (240px) ──┐  ┌─ Main content ──────────────────┐
│ Bible Quiz    🔔 3 │  │ CHÀO BUỔI SÁNG                  │
│                    │  │ TAI THANH                        │
├────────────────────┤  │ ★★★★★ ...                        │
│ [T] TAI THANH   ▼ │ ←│                                  │
│     Tân Tín Hữu    │  │ THỬ THÁCH HÔM NAY ...           │
├────────────────────┤  │                                  │
│ 🏠 Trang chủ      │  │ ...                              │
│ 📊 Xếp hạng       │  │                                  │
│ 👥 Nhóm           │  │                                  │
│ 👤 Cá nhân        │  │                                  │
├────────────────────┤  │                                  │
│ 🔥 Streak 0 ngày   │  │                                  │
│ 📋 Nhiệm vụ 0/3   │  │                                  │
└────────────────────┘  └──────────────────────────────────┘
```
(Avatar dropdown ▼ mở khi click avatar)

**Mobile (giữ nguyên top bar + thêm bell):**
```
┌─ Top bar sticky (44px) ──────────────┐
│ Bible Quiz          🔔 3      [T] ▼ │
└──────────────────────────────────────┘
┌─ Main content ────────────────────────┐
│ CHÀO BUỔI SÁNG                        │
│ TAI THANH                             │
│ ...                                   │
└───────────────────────────────────────┘
┌─ Bottom tabs sticky (60px) ──────────┐
│ 🏠      📊       👥        👤        │
│ TRANG  XẾP HẠNG  NHÓM     CÁ NHÂN   │
└──────────────────────────────────────┘
```

---

## Tasks (chia commits)

### ⚠️ Trước khi bắt đầu

```bash
# 1. Verify clean working dir
git status  # phải clean

# 2. Tạo branch riêng cho refactor
git checkout -b refactor/applayout-huong-b

# 3. Baseline test count
cd apps/web && npx vitest run | tail -5
# Ghi nhận số test pass — Actual baseline 2026-05-01: 1054 pass / 1 pre-existing fail (BasicQuizCard cooldown timer flaky)
```

---

### Task 1 — Audit hiện tại + tạo skeleton components

**Mục tiêu:** Hiểu code hiện tại + chuẩn bị components mới mà chưa modify gì.

**Steps:**

1. **Đọc AppLayout.tsx hiện tại:**
   ```bash
   cat apps/web/src/layouts/AppLayout.tsx
   ```
   Note lại:
   - Cấu trúc top bar (logo + avatar)
   - Cấu trúc sidebar
   - Responsive breakpoints
   - Có dùng `useMediaQuery` chưa? (có thể đã có hook)

2. **Tìm hook `useMediaQuery` hoặc tương đương:**
   ```bash
   grep -rn "useMediaQuery\|useBreakpoint\|window.matchMedia" apps/web/src/hooks --include="*.ts" --include="*.tsx"
   ```
   - Nếu CÓ: dùng hook hiện tại
   - Nếu KHÔNG: tạo mới `apps/web/src/hooks/useMediaQuery.ts`

3. **Tạo skeleton 4 components mới (CHƯA wire vào AppLayout):**
   - `apps/web/src/layouts/components/SidebarHeader.tsx` — logo + bell desktop
   - `apps/web/src/layouts/components/SidebarUserCard.tsx` — avatar + tên + tier + dropdown
   - `apps/web/src/layouts/components/MobileTopBar.tsx` — logo + bell + avatar mobile
   - `apps/web/src/layouts/components/MobileBottomTabs.tsx` — 4 tabs mobile

4. **Mỗi component:**
   - Empty placeholder return JSX cơ bản (1-2 dòng)
   - Export default
   - Type definitions cho props (nếu có)
   - **Không wire vào AppLayout** — chỉ tạo files

**Acceptance:**
- [ ] 4 component files tồn tại
- [ ] `useMediaQuery` hook available
- [ ] Build pass: `npm run build`
- [ ] Tests pass (baseline 387)
- [ ] Commit: `chore(layout): scaffold components for AppLayout refactor (Hướng B)`

---

### Task 2 — Implement SidebarHeader + SidebarUserCard

**Mục tiêu:** 2 components ở top sidebar (logo + bell, user card với dropdown).

> **🔄 Audit 2026-05-01 — REUSE Header.tsx orphan:** [`apps/web/src/components/Header.tsx`](../../apps/web/src/components/Header.tsx) đã tồn tại với polished logic:
> - `timeAgo()` formatter (line 9-20) sử dụng i18n `header.time.*` keys
> - `fetchNotifications()` (line 48-56) — call `/api/notifications?unread=true&limit=10`
> - Notification panel dropdown với mark-as-read + mark-all-read (line 67-76)
> - Click-outside handler shared cho user dropdown + notification panel (line 36-46)
>
> **Header.tsx chỉ được test files import** (Header.test.tsx + language-switch.test.tsx) — không mount production. Nên trong Task 2:
> 1. Đọc Header.tsx kỹ trước khi viết SidebarHeader/SidebarUserCard
> 2. **Extract logic notification + dropdown thành 2 components dùng chung:**
>    - `apps/web/src/layouts/components/NotificationBell.tsx` (logic từ Header.tsx line 30-76)
>    - `apps/web/src/layouts/components/UserDropdown.tsx` (logic từ Header.tsx user dropdown)
> 3. SidebarHeader compose `<Logo /> <NotificationBell />`
> 4. SidebarUserCard compose `<Avatar /> <Username /> <UserDropdown />`
> 5. Sau khi extract OK → **delete Header.tsx + 2 test files orphan** (cleanup task 6)
>
> Effort tiết kiệm: ~1.5h vì notification logic + click-outside đã production-ready.

**Files:**
- `apps/web/src/layouts/components/SidebarHeader.tsx`
- `apps/web/src/layouts/components/SidebarUserCard.tsx`
- `apps/web/src/layouts/components/NotificationBell.tsx` *(extracted from Header.tsx)*
- `apps/web/src/layouts/components/UserDropdown.tsx` *(extracted from Header.tsx)*

**SidebarHeader.tsx — chi tiết:**

```tsx
// Layout:
// ┌─────────────────────────┐
// │ Bible Quiz       🔔 3   │
// └─────────────────────────┘
//
// - Logo "Bible Quiz" gold (text, không phải image)
// - Bell icon góc phải
// - Badge số notifications (nếu > 0)
// - Click bell → open notification panel hoặc navigate /notifications
// - Padding 12-16px, border-bottom 0.5px subtle
```

**Yêu cầu:**
- Logo dùng class `text-secondary` (gold) + `font-semibold`
- Bell icon: dùng Material Symbols Outlined `notifications` hoặc lucide-react `Bell`
- Badge count: chỉ hiện nếu > 0, position absolute top-right của bell
- Click bell → behavior tùy thuộc notification system hiện có:
  ```bash
  grep -rn "notifications\|NotificationPanel" apps/web/src --include="*.tsx" -l
  ```
  Nếu có panel component → toggle. Nếu không → navigate `/notifications`.

**SidebarUserCard.tsx — chi tiết:**

```tsx
// Layout (collapsed):
// ┌─────────────────────────┐
// │ [T] TAI THANH       ▼   │
// │     Tân Tín Hữu         │
// └─────────────────────────┘
//
// Click → mở dropdown:
// ┌─────────────────────────┐
// │ 👤 Hồ sơ                 │
// │ ⚙️ Cài đặt              │
// │ 🌐 Tiếng Việt   ▼ EN   │
// │ ─────────────────────── │
// │ 🚪 Đăng xuất             │
// └─────────────────────────┘
```

**Yêu cầu:**
- Dùng existing user data từ `authStore` (hoặc `useUser` hook nếu có)
- Avatar: tier color background + initial chữ cái đầu tên
- Tier badge subtitle: tier color text
- Dropdown:
  - Click outside → đóng (dùng `useRef` + `useEffect` listener, hoặc Radix UI Popover nếu đã có)
  - Items: 4 items như đã chốt
  - Ngôn ngữ item: inline toggle (current language hiển thị, click → switch)
  - Logout: confirm modal hoặc direct? → **direct logout** (đơn giản)

**Logout logic:**
```bash
# Tìm auth logout function hiện tại
grep -rn "logout\|signOut" apps/web/src/store --include="*.ts"
```
Reuse existing logout, không tự implement.

**Language toggle:**
```bash
# Tìm i18n hook hiện tại
grep -rn "i18n\|useTranslation\|changeLanguage" apps/web/src --include="*.tsx" -l
```
Reuse `i18n.changeLanguage('vi'|'en')`.

**Acceptance:**
- [ ] SidebarHeader render logo + bell + badge correctly
- [ ] Bell click → notification action work (panel toggle hoặc navigate)
- [ ] SidebarUserCard render avatar + name + tier
- [ ] Avatar tier color đúng (dùng tier hex từ `tier-{N}` token)
- [ ] Dropdown mở/đóng đúng
- [ ] 4 dropdown items work (Profile navigate, Settings navigate, Language toggle, Logout)
- [ ] Click outside dropdown → close
- [ ] Build pass + tests pass
- [ ] Commit: `feat(layout): SidebarHeader + SidebarUserCard with dropdown`

---

### Task 3 — Implement MobileTopBar + MobileBottomTabs

**Mục tiêu:** 2 components cho mobile (top bar + bottom tabs).

**Files:**
- `apps/web/src/layouts/components/MobileTopBar.tsx`
- `apps/web/src/layouts/components/MobileBottomTabs.tsx`

**MobileTopBar.tsx — chi tiết:**

```tsx
// Layout (44px height, sticky top, z-index 10):
// ┌──────────────────────────────────┐
// │ Bible Quiz      🔔 3      [T] ▼ │
// └──────────────────────────────────┘
//
// - Logo gold trái
// - Bell icon + badge giữa-phải
// - Avatar + dropdown phải
// - Border-bottom 0.5px
// - Background: bg-background (giống main)
```

**Yêu cầu:**
- Reuse logic từ SidebarHeader cho bell + dropdown từ SidebarUserCard (DRY)
- Position: `sticky top-0 z-10`
- Padding: `px-4 py-3` (12px vertical = 44px total với content)
- Border-bottom: `border-b border-border-tertiary/30`
- Hide trên desktop: `md:hidden` (Tailwind breakpoint)

**MobileBottomTabs.tsx — chi tiết:**

```tsx
// Layout (60-64px height, sticky bottom, z-index 10):
// ┌──────────────────────────────────┐
// │ 🏠       📊        👥        👤  │
// │ Trang   Xếp hạng  Nhóm    Cá nhân│
// └──────────────────────────────────┘
//
// - 4 tabs equal-width grid
// - Icon trên + label dưới (vertical stack)
// - Active tab: gold color + slight bg highlight
// - Inactive: muted gray
// - Border-top 0.5px
// - Hide trên desktop: md:hidden
```

**Yêu cầu:**
- Tabs definition (TypeScript const):
  ```ts
  const TABS = [
    { id: 'home', icon: 'Home', label: 'Trang', path: '/' },
    { id: 'leaderboard', icon: 'BarChart3', label: 'Xếp hạng', path: '/leaderboard' },
    { id: 'groups', icon: 'Users', label: 'Nhóm', path: '/groups' },
    { id: 'profile', icon: 'User', label: 'Cá nhân', path: '/profile' },
  ];
  ```
- Labels rút gọn (đáp ứng HM-MB-2):
  - "TRANG CHỦ" → "Trang"
  - "XẾP HẠNG" → "Xếp hạng" (giữ vì chỉ 8 ký tự không 2 từ)
  - "NHÓM" → "Nhóm"
  - "CÁ NHÂN" → "Cá nhân"
- Active state: dùng `useLocation()` từ react-router để check current path
- Tap target: min 44px height (iOS HIG)
- Icons: lucide-react (đã có trong stack)

**Acceptance:**
- [ ] MobileTopBar render đúng 3 elements (logo + bell + avatar dropdown)
- [ ] MobileBottomTabs render 4 tabs với active state đúng
- [ ] Bell + avatar dropdown tái sử dụng logic từ Task 2 (không duplicate code)
- [ ] Test trên 320px viewport: labels không wrap
- [ ] Test trên 768px viewport: cả 2 components ẩn (`md:hidden`)
- [ ] Build pass + tests pass
- [ ] Commit: `feat(layout): MobileTopBar + MobileBottomTabs`

---

### Task 4 — Refactor AppLayout với responsive logic

**Mục tiêu:** Thay AppLayout cũ bằng version mới — desktop dùng sidebar full, mobile dùng top bar + bottom tabs.

**File:** `apps/web/src/layouts/AppLayout.tsx`

**Cấu trúc mới:**

```tsx
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SidebarHeader from './components/SidebarHeader';
import SidebarUserCard from './components/SidebarUserCard';
import MobileTopBar from './components/MobileTopBar';
import MobileBottomTabs from './components/MobileBottomTabs';

function AppLayout({ children }: PropsWithChildren) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileTopBar />}

      <div className="flex">
        {!isMobile && (
          <aside className="w-[240px] flex-shrink-0 border-r border-border-tertiary/20 ...">
            <SidebarHeader />
            <SidebarUserCard />
            <SidebarNav />  {/* Existing nav, có thể đã có trong AppLayout cũ */}
            <SidebarFooter />  {/* Streak + Daily Mission widgets, existing */}
          </aside>
        )}

        <main className={cn(
          'flex-1',
          isMobile ? 'pt-[44px] pb-[64px]' : 'pl-0',
        )}>
          {children}
        </main>
      </div>

      {isMobile && <MobileBottomTabs />}
    </div>
  );
}
```

**Yêu cầu cụ thể:**

1. **Bỏ hoàn toàn top bar cũ** (logo + avatar trên đầu trang)
2. **Sidebar nav**: giữ nguyên existing logic (4 nav items + active state)
3. **Sidebar footer widgets**: giữ Streak + Daily Mission như hiện tại
4. **Main content padding**:
   - Desktop: không cần padding-top (sidebar đứng cạnh)
   - Mobile: `pt-[44px]` cho top bar + `pb-[64px]` cho bottom tabs
5. **No scroll lock** — main scroll naturally, top bar sticky, bottom tabs sticky

**Edge cases cần handle:**

- **Loading state khi check `useMediaQuery`**: ban đầu return `false` → flash desktop layout. Mitigate bằng:
  ```ts
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // Render skeleton hoặc null khi isMobile === null
  ```
  Hoặc dùng SSR-safe approach với CSS-only `hidden md:block` thay vì JS check.

- **Test plan:**
  - Tab through layout → no broken focus
  - Resize browser từ desktop → mobile và ngược lại → layout switch smoothly
  - Refresh tại mỗi viewport → render đúng từ đầu

**Acceptance:**
- [ ] Desktop (≥768px): KHÔNG có top bar, sidebar có logo + bell + user card + nav + footer
- [ ] Mobile (<768px): CÓ top bar (logo + bell + avatar) + bottom tabs
- [ ] Resize transitions smooth, không flash
- [ ] User identity hiển thị 1 lần per viewport
- [ ] Logo "Bible Quiz" hiển thị 1 lần per viewport
- [ ] Notification bell accessible từ cả 2 viewport
- [ ] Tất cả existing pages render OK trong layout mới
- [ ] Build pass: `cd apps/web && npm run build`
- [ ] Tests pass (≥387 baseline)
- [ ] Commit: `refactor(layout): AppLayout responsive — bỏ top bar desktop, mobile có top bar + bottom tabs (HM-P0-1)`

---

### Task 5 — Visual regression test

**Mục tiêu:** Đảm bảo không break visual hiện có ở các pages chính.

**Manual smoke test (5 pages):**

| Page | Desktop check | Mobile check |
|---|---|---|
| `/` (Home) | Hero + sections render đúng, không khoảng trắng | Top bar + content + bottom tabs đầy đủ |
| `/leaderboard` | Podium + list render | Tabs scrollable, list scroll |
| `/ranked` | Stats + CTA "Vào trận" | CTA full-width, scroll OK |
| `/profile` | Avatar + tier + stats | Layout stack vertical |
| `/groups` | List groups | List + empty state |

**Cho mỗi page, check:**
- [ ] Layout không vỡ
- [ ] Content không bị cut off bởi sticky bars
- [ ] Click navigation → đúng page
- [ ] Scroll smooth
- [ ] Active state nav/tabs đúng

**Test viewports:**
- 320px (iPhone SE)
- 375px (iPhone 12)
- 768px (iPad portrait — boundary)
- 1024px (iPad landscape)
- 1440px (laptop)

**Test 2 dark/light mode** (nếu Bui có):
- Sacred Modernist hiện chỉ dark → skip

**Acceptance:**
- [ ] 5 pages × 5 viewports = 25 visual checks pass
- [ ] Không có console error
- [ ] Notification bell click work ở cả 2 viewports
- [ ] Avatar dropdown work ở cả 2 viewports
- [ ] Document findings nếu có bug nhỏ → ghi vào `docs/FOLLOWUPS.md`

---

### Task 6 — Cleanup + final regression

**Mục tiêu:** Xoá code top bar cũ, ensure clean state.

**Steps:**

1. **Tìm code top bar cũ còn sót:**
   ```bash
   grep -rn "TopBar\|HeaderBar" apps/web/src --include="*.tsx"
   # Nếu có components top bar cũ chưa dùng → xoá
   ```

2. **Tìm dead imports trong AppLayout:**
   ```bash
   grep -n "import" apps/web/src/layouts/AppLayout.tsx
   # Xoá imports không dùng (vd: avatar lib cũ chỉ dùng cho top bar)
   ```

3. **Run full regression:**
   ```bash
   # Web
   cd apps/web
   npm run build  # pass
   npx vitest run  # tests pass

   # Mobile (nếu mobile app cũng dùng AppLayout — likely không)
   cd ../mobile
   npx tsc --noEmit  # pass
   ```

4. **Update docs:**
   - Append vào `DECISIONS.md` *(root project — KHÔNG phải `docs/DECISIONS.md`, đã verify 2026-05-01)*:
     ```md
     ## 2026-04-30: AppLayout responsive (Hướng B)

     Bỏ top bar trên desktop, sidebar có đầy đủ identity (logo + user + nav + footer).
     Mobile giữ top bar + thêm bottom tabs.

     Lý do: 3 lần duplicate user identity (top bar avatar + sidebar avatar + hero name)
     trên desktop. Top bar chỉ có 2 elements và trống 95% width.

     Issue: HM-P0-1 trong BUG_REPORT_HOME_POST_IMPL.md
     Commits: refactor/applayout-huong-b branch
     ```

   - Update `BUG_REPORT_HOME_POST_IMPL.md`:
     - Mark HM-P0-1 status: ✅ DONE
     - Mark HM-P2-1 status: ✅ Resolved by HM-P0-1

**Acceptance:**
- [ ] Không còn dead code top bar cũ
- [ ] No unused imports
- [ ] Full regression pass
- [ ] DECISIONS.md updated
- [ ] BUG_REPORT updated với status DONE
- [ ] Commit: `chore(layout): cleanup + docs after AppLayout refactor`

---

## Final regression (sau cả 6 tasks)

```bash
# Tổng test count
cd apps/web && npx vitest run | tail -5
# Phải >= baseline (387)

# Visual smoke test thủ công 5 pages × 5 viewports

# Merge branch
git checkout main
git merge refactor/applayout-huong-b
git push origin main
```

---

## ⚠️ Constraints

- **Mỗi task = 1 commit riêng** (6 commits total). KHÔNG gộp.
- **Sau mỗi task: build + test pass** trước khi commit.
- **Không refactor ngoài scope** của AppLayout. Nếu thấy issue khác (vd Home component có bug), ghi vào `docs/FOLLOWUPS.md`.
- **Không thêm package mới** trừ khi cần thiết (notification panel có thể cần Radix UI Popover nếu chưa có — verify trước).
- **Không đụng backend.**
- **Không đụng mobile app** (`apps/mobile/`) — task này chỉ web.
- **Visual regression**: nếu phát hiện bất kỳ page nào break visual sau refactor → DỪNG, fix riêng task đó.

---

## Definition of Done (toàn bộ HM-P0-1)

- [ ] 6 commits pushed lên branch `refactor/applayout-huong-b`
- [ ] Desktop ≥768px: KHÔNG có top bar, sidebar đầy đủ (logo + bell + user card + dropdown + nav + footer widgets)
- [ ] Mobile <768px: CÓ top bar sticky (logo + bell + avatar dropdown) + bottom tabs sticky (4 items)
- [ ] User identity = 1 lần per viewport
- [ ] Logo "Bible Quiz" = 1 lần per viewport
- [ ] Notification bell accessible từ cả 2 viewport
- [ ] Avatar dropdown = 4 items (Profile / Settings / Language toggle / Logout) work
- [ ] 5 pages chính (Home, Leaderboard, Ranked, Profile, Groups) render OK ở 5 viewports
- [ ] Tests pass ≥387 baseline
- [ ] Build pass: `npm run build`
- [ ] DECISIONS.md updated
- [ ] BUG_REPORT_HOME_POST_IMPL.md đánh dấu HM-P0-1 = DONE

---

## 🤔 Nếu gặp blocker

| Blocker | Action |
|---|---|
| `useMediaQuery` không có sẵn | Tạo mới `apps/web/src/hooks/useMediaQuery.ts` (đơn giản: `window.matchMedia` + listener) |
| Dropdown component không có | Implement bằng React state + click outside listener (không cần lib) |
| Notification panel chưa có | Bell click → navigate `/notifications` (route có thể cần tạo) |
| Visual break ở 1 page sau refactor | Ghi vào FOLLOWUPS.md, không block commit task này |
| Test fail mass | Rollback task đó, debug riêng. KHÔNG force commit. |
| Mobile bottom tabs đè lên content | Tăng `pb-[64px]` cho main content, hoặc `safe-area-inset-bottom` cho iOS |

---

## Files manifest (kết quả cuối cùng — sau audit 2026-05-01)

**Tạo mới (4-6 tùy phương án):**
- `apps/web/src/layouts/components/SidebarHeader.tsx`
- `apps/web/src/layouts/components/SidebarUserCard.tsx`
- `apps/web/src/layouts/components/MobileTopBar.tsx`
- `apps/web/src/layouts/components/MobileBottomTabs.tsx`
- *Phương án C:* `apps/web/src/layouts/components/NotificationBell.tsx` *(extract từ Header.tsx)*
- *Phương án C:* `apps/web/src/layouts/components/UserDropdown.tsx` *(extract từ Header.tsx)*
- `apps/web/src/hooks/useMediaQuery.ts` *(chỉ nếu Tailwind responsive không đủ — recommend skip, dùng `hidden md:flex` / `md:hidden`)*

**Modify (1):**
- `apps/web/src/layouts/AppLayout.tsx` (major refactor)

**Delete (3 sau khi extract — phương án C):**
- `apps/web/src/components/Header.tsx` *(orphan, logic đã extract sang NotificationBell + UserDropdown)*
- `apps/web/src/components/Header.module.css` *(theo Header.tsx)*
- `apps/web/src/components/__tests__/Header.test.tsx` *(test file của orphan)*
- *(Cẩn thận: `i18n/__tests__/language-switch.test.tsx` cũng import Header → cần update test này hoặc thay bằng UserDropdown)*

**Update docs (2):**
- `DECISIONS.md` *(root, append entry)*
- `BUG_REPORT_HOME_POST_IMPL.md` *(mark HM-P0-1 DONE)*

---

*Generated 2026-04-30 — Sau khi Bui chốt 3 decisions: logo trong sidebar, bell Option A (sidebar header), avatar dropdown 4 items.*
