# Profile Page — Bug Report & Redesign Plan

> Ngày tạo: 2026-05-03  
> File liên quan: `apps/web/src/pages/Profile.tsx`  
> Stitch reference: `docs/designs/stitch/mobile/profile-own.html` (outdated — chỉ tham khảo)

---

## Phần 1 — Lỗi tính năng (Functional Bugs)

### BUG-1 · "Edit Profile" button không hoạt động [HIGH]
- **Vị trí**: `Profile.tsx` line 238
- **Hiện tại**: `<button>` không có `onClick`, không điều hướng đi đâu
- **Fix**: Navigate đến `/settings` hoặc mở Settings Modal (xem Redesign Phần 2)

### BUG-2 · "Share" button không hoạt động [HIGH]
- **Vị trí**: `Profile.tsx` line 241
- **Hiện tại**: Icon button rỗng, không có handler
- **Fix**: Mở share sheet (Web Share API) hoặc copy link profile

### BUG-3 · "View All" badges dùng `href="#"` [MEDIUM]
- **Vị trí**: `Profile.tsx` line 364
- **Hiện tại**: `<a href="#">` — link chết, không navigate
- **Fix**: Đổi thành `<Link to="/achievements">` từ react-router-dom

### BUG-4 · Heatmap grid quá thưa [MEDIUM]
- **Vị trí**: `Profile.tsx` line 62–63, CSS class `streak-grid` (20 cột)
- **Hiện tại**: 80 cells / 20 cột = 4 hàng — trông rất thưa, không đủ context
- **Fix**: Đổi sang 84 cells (12 tuần × 7 ngày), dùng CSS grid 12 cột thay `streak-grid`

### BUG-5 · PrestigeSection không có loading/error state [LOW]
- **Vị trí**: `Profile.tsx` line 523 (`if (!data) return null`)
- **Hiện tại**: Trả về `null` cả khi đang loading lẫn khi API lỗi — user không biết section tồn tại
- **Fix**: Thêm skeleton riêng cho Prestige, hoặc check `isLoading` vs `!data`

### BUG-6 · `correctRate` tính sai nếu history bị phân trang [LOW]
- **Vị trí**: `Profile.tsx` line 179
- **Hiện tại**: Tính từ `history` (local array) — nếu API trả về paginated (10 records), tỉ lệ đúng chỉ phản ánh 10 buổi gần nhất
- **Fix**: Backend cần trả về `overallAccuracy` trong `/api/me` hoặc dùng `/api/me/stats` endpoint riêng

---

## Phần 2 — Redesign UI

### Nguyên tắc
- Mobile-first, design tokens giữ nguyên (`#11131e`, `#e8a832`, Be Vietnam Pro)
- Stitch design chỉ dùng làm tham khảo cấu trúc, không copy pixel-perfect
- Mục tiêu: giảm ~40% chiều cao trang, loại bỏ visual noise, tách settings ra riêng

---

### Section 1 — Hero (thay thế hoàn toàn)

**Hiện tại**: Avatar hình chữ nhật góc dưới-trái trong landscape banner → trông lạc lõng  
**Mới**:
```
┌────────────────────────────────────┐
│  ←  Hồ sơ                      ⚙️  │  ← sticky header
├────────────────────────────────────┤
│                                    │
│     [gradient bg from-primary-     │
│      container/40 to-surface]      │
│                                    │
│        ┌──────────────┐            │
│        │ gold ring    │            │  ← w-[120px] rounded-full
│        │  [avatar]    │            │     border gradient secondary→tertiary
│        └──────────────┘            │     gold-glow shadow
│                                    │
│         Nguyễn Minh                │  ← text-2xl font-bold
│        🔥 Ngọn Lửa                 │  ← tier badge, text-secondary
└────────────────────────────────────┘
```
- Avatar: `w-[120px] h-[120px] rounded-full` với outer ring `p-[3px] bg-gradient-to-tr from-secondary to-tertiary gold-glow`
- Icon ⚙️ ở header right → mở **Settings Modal**
- Bỏ Edit Profile + Share button khỏi hero (chuyển vào settings)

---

### Section 2 — Stats Row (compact glassmorphism)

**Hiện tại**: Bento grid 5 cards lớn (`p-8`, `rounded-3xl`) chiếm ~300px chiều cao  
**Mới**: 1 row 3 cột glassmorphism, ~80px chiều cao
```
┌────────────┬────────────┬────────────┐
│ Tổng điểm  │  Chuỗi  🔥 │  Số buổi   │
│   2,450    │    12 ngày │    148     │
└────────────┴────────────┴────────────┘
```
- Class: `glass-panel rounded-2xl p-5 grid grid-cols-3`
- Divider: `border-x border-outline-variant/20` ở cột giữa
- Text: label `text-[10px] uppercase tracking-widest`, value `text-xl font-black`

---

### Section 3 — Tier Progress Card (compact)

**Hiện tại**: Card `p-10` với nhiều padding thừa, phần "unlocked tier" icons chưa có data thật  
**Mới**: Card `p-5 rounded-xl`
```
┌─────────────────────────────────────┐
│ 🔥 Ngọn Lửa        Đến Ngôi Sao 72%│
│ ████████████░░░░░░░░░░░░░░░░░░░░░░  │
│     Còn 1,250 XP để thăng cấp       │
└─────────────────────────────────────┘
```
- Bỏ phần "unlocked tier" icons (chưa có data thật, placeholder gây confusion)
- Progress bar giữ nguyên `gold-gradient`
- XP remaining: `text-secondary font-bold`

---

### Section 4 — Badges (horizontal scroll)

**Hiện tại**: Grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`, badge `p-8` rất to  
**Mới**: Horizontal scroll row, badge nhỏ gọn
```
[🏅 Nhà Thông] [📖 Đọc Giả] [🏆 Vô Địch] [⭐ Kỷ Lục] →
  Thái          Chăm Chỉ    (locked)      (locked)
```
- Container: `flex gap-4 overflow-x-auto pb-2 hide-scrollbar px-0`
- Badge item: `flex-shrink-0 w-24 flex flex-col items-center`
- Badge icon: `w-16 h-16 rounded-2xl bg-surface-container-high border border-secondary/20`
- Locked: `opacity-40 grayscale` như hiện tại

---

### Section 5 — Heatmap (fix grid)

**Hiện tại**: `streak-grid` (20 cột) × 80 cells = 4 hàng thưa  
**Mới**: 12 cột × 7 hàng = 84 cells (12 tuần đầy đủ)
```css
/* Thay streak-grid bằng inline style hoặc class mới */
grid-template-columns: repeat(12, minmax(0, 1fr))
```
- Legend đổi vị trí: từ trên trái → dưới phải, nhỏ hơn (`text-[8px]`)
- Format: `Ít [░▒▓█] Nhiều`
- Cells: 84 cells, colors giữ nguyên logic hiện tại nhưng scale thành 4 levels

---

### Section 6 — Stats Detail Card (mới — thay thế quickStats grid)

**Hiện tại**: Không có  
**Mới**: Collapsible accordion card
```
┌─────────────────────────────────────┐
│ Chỉ số chi tiết              ▼      │
├─────────────────────────────────────┤
│ Độ chính xác              78%       │
│ Chuỗi dài nhất            45 ngày  │
│ Tham gia từ               01/01/26  │
│ Số câu đúng               1,234    │
└─────────────────────────────────────┘
```
- State: `useState(false)` cho expand/collapse
- Data lấy từ `profile` đã có: `longestStreak`, `createdAt`, tính từ history

---

### Section 7 — Settings Modal (tách khỏi Profile)

**Hiện tại**: Sound/Haptics + Prestige + Delete Account dump thẳng vào cuối trang  
**Mới**: Modal mở từ icon ⚙️ ở header

```
┌─────────────────────────────────────┐
│ Cài đặt                          ✕  │
├─────────────────────────────────────┤
│ 🔊 Âm thanh & Rung                  │
│    [toggle sound] [volume slider]   │
│    [toggle haptics]                 │
├─────────────────────────────────────┤
│ 🎖️  Prestige                         │
│    [progress / eligible button]     │
├─────────────────────────────────────┤
│ ⚠️  Xóa tài khoản                   │  ← danger zone
└─────────────────────────────────────┘
```
- Modal: `fixed inset-0 z-50 flex items-end` (bottom sheet style trên mobile)
- Bottom sheet: `glass-card rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto`

---

## Phần 3 — Thứ tự implement (TODO)

```
Task 1: Fix BUG-3 — đổi "View All" href="#" → Link to="/achievements"
Task 2: Fix BUG-4 — fix heatmap 84 cells / 12 cột
Task 3: Redesign Hero Section (centered avatar + gold ring)
Task 4: Redesign Stats Row (glassmorphism 3 cột)
Task 5: Redesign Tier Progress (compact card)
Task 6: Redesign Badges (horizontal scroll)
Task 7: Thêm Stats Detail Card (collapsible)
Task 8: Tách Settings Modal (Sound/Haptics + Prestige + Delete Account)
Task 9: Fix BUG-1/BUG-2 — Edit/Share buttons trong Settings Modal
Task 10: Fix BUG-5/BUG-6 — PrestigeSection loading state + correctRate
Task 11: Unit tests update (Profile.test.tsx)
Task 12: Full regression
```

---

## Phần 4 — Không thay đổi

- `WeaknessWidget` — giữ nguyên vị trí, không sửa
- Business logic: `buildHeatmapCells`, `getTierByPoints`, `getNextTier` — giữ nguyên
- API calls — giữ nguyên tất cả
- `DeleteAccountSection` logic — giữ nguyên, chỉ move vào Settings Modal
- `SoundHapticsSettings` logic — giữ nguyên, chỉ move vào Settings Modal
- `PrestigeSection` logic — giữ nguyên, chỉ move vào Settings Modal
