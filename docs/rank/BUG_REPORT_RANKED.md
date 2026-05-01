# Bug Report — Ranked Mode Dashboard (`/ranked`)

> **Source:** Visual review screenshot 2026-04-30
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Ranked.tsx` (web), `apps/mobile/src/screens/quiz/RankedScreen.tsx` (mobile)
> **Severity overview:** 3× P0 (data/logic bugs), 6× P1 (UX issues), 4× P2 (improvements), 3× P3 (polish)

> **Status (2026-05-01):** R1-R12 redesign sprint complete on
> `feat/ranked-redesign-v2`. 13/16 issues closed, 3 deferred (see
> table below). Implementation prompt:
> [PROMPT_RANKED_REDESIGN_V2.md](../prompts/PROMPT_RANKED_REDESIGN_V2.md).

## ✅ Status table (post-R12)

| ID | Status | Where fixed |
|---|---|---|
| RK-P0-1 | ✅ DONE | R1 — sidebar widgets become route-aware (`AppLayout.tsx`) |
| RK-P0-2 | ✅ DONE | R5 — `SeasonCard.tsx` replaces hardcoded position bar |
| RK-P0-3 | ✅ DONE | R6 — `CurrentBookCard.tsx` testament-anchored copy |
| RK-P1-1 | ✅ DONE | R2 — `TierProgressCard.tsx` uses `tier.colorHex` for pill |
| RK-P1-2 | ✅ DONE | R2 — single-gold tier progress bar |
| RK-P1-3 | ✅ DONE | R5 — Option C: 3-col Season card (rank/points/trend) |
| RK-P1-4 | ✅ DONE | R5 — explicit "Hạng mùa" label + percentile context |
| RK-P1-5 | ✅ DONE | R4 — `DailyStatsCards.tsx` 2 symmetric cards |
| RK-P1-6 | ✅ DONE | R6 — section-header link "Đổi sách" outside card body |
| RK-P2-1 | ⏭️ DEFER | Onboarding tutorial → post-launch enhancement |
| RK-P2-2 | ✅ DONE | R8 — `RankedActionFooter.tsx` 3 soft path links |
| RK-P2-3 | ✅ DONE | R7 — `RecentMatchesSection.tsx` + R10 BE mode filter |
| RK-P2-4 | ✅ DONE | R3 — `EnergyCard.tsx` 5 urgency states |
| RK-P3-1 | ✅ DONE | R2 — `RankedHeader.tsx` 22px medium |
| RK-P3-2 | ⏭️ DEFER | 2-countdown disambiguation — minor polish |
| RK-P3-3 | ✅ DONE | R1 — sidebar specific to `/ranked` (Goal/WinRate/WeekCombo) |

**Mobile responsive (R11):** applied via Tailwind `md:` breakpoints,
no separate mobile mockup file needed.

**Backend (R10):** added `seasonRank` / `seasonTotalPlayers` /
`seasonPoints` / `pointsToTop100` / `weekHighestCombo` to
`/api/me/ranked-status`; added `?mode=` filter to `/api/me/history`.
`seasonRankDelta` returns null per option C (snapshot infra deferred
to v1.1).

**Refactor (R9):** `Ranked.tsx` reduced from 698 → 161 LOC;
data-fetching extracted into `useRankedPage` hook,
skeleton into its own component. Per-component LOC all under 300.

---

## 🔴 P0 — Production Blockers

### RK-P0-1: Streak widget duplicate giữa sidebar và main content
**Severity:** Critical · **Type:** UX Bug · **Effort:** 15min

**Triệu chứng:**
Cùng 1 thông tin streak xuất hiện 2 lần trong cùng viewport:
- **Sidebar:** card "STREAK · 0 ngày liên tục · Bắt đầu streak hôm nay!"
- **Main content:** card "🔥 ĐANG CHÁY · 0 ngày · Bắt đầu streak hôm nay!"

**Vấn đề:**
- Lãng phí real estate
- User confused: "có 2 streak khác nhau?"
- Card "Đang Cháy" có border cam nổi bật → đáng giữ
- Sidebar widget redundant

**Đề xuất fix:**

**Option A (recommend):** Bỏ Streak widget khỏi sidebar Ranked page. Thay bằng widget context-specific:
- "Năng lượng hôm nay 100/100"
- "Daily ranked cap: 1/100 câu"
- Hoặc empty (cleaner)

**Option B:** Giữ sidebar, bỏ "Đang Cháy" trong main → mất visual identity của streak

**Files:**
- `apps/web/src/pages/Ranked.tsx`
- `apps/web/src/layouts/AppLayout.tsx` (nếu sidebar render conditional theo route)

**Acceptance:**
- [ ] Streak chỉ hiện 1 chỗ trong viewport Ranked dashboard
- [ ] Sidebar có content đặc thù cho Ranked (không generic)
- [ ] Mobile (nếu có sidebar tương tự) cũng được kiểm tra

---

### RK-P0-2: "BẠN Ở ĐÂY" marker hardcoded vị trí sai trên Mùa progress bar
**Severity:** Critical · **Type:** Data/Logic Bug · **Effort:** 1-2h

**Triệu chứng:**
Trên thanh "MÙA THI ĐẤU" có 4 markers ngang:
```
TOP 100 ──── TOP 50 ──── ▼ BẠN Ở ĐÂY ──── TOP 1
```
Vị trí "BẠN Ở ĐÂY" hiện ở **75-80% bar**, gần Top 1.

**Mâu thuẫn data:**
- User TAI THANH ở rank #3 mùa
- Có 81 điểm mùa
- Theo screenshot Leaderboard trước, TAI THANH thường ở rank thấp (#4-#5 daily)
- Vị trí "BẠN Ở ĐÂY" không khớp với rank thực

**Root cause hypothesis:**
1. Marker có position **hardcoded** (vd 75%) bất kể rank thực
2. Hoặc dùng formula sai: `position = rank / 100` thay vì `position = 1 - (rank - 1) / totalPlayers`
3. Hoặc placeholder data demo, chưa wire vào API

**Verification:**
```bash
# Tìm component render Mùa progress
grep -rn "BẠN Ở ĐÂY\|MÙA THI ĐẤU\|seasonRank\|seasonPosition" apps/web/src/pages/Ranked.tsx
grep -rn "TOP 100\|TOP 50\|TOP 1" apps/web/src --include="*.tsx"

# Check API response
curl "http://localhost:8080/api/me/ranked-status" | jq '.season'
# Expect: { rank: number, totalPlayers: number, points: number, ... }
```

**Fix:**
1. Identify component (likely `SeasonProgressBar.tsx` hoặc inline trong `Ranked.tsx`)
2. Compute position từ rank thực:
   ```ts
   const position = Math.max(0.05, Math.min(0.95, 1 - (rank - 1) / totalPlayers));
   // Hoặc dùng logarithmic scale nếu muốn tăng độ khó dần
   ```
3. Cân nhắc redesign vạch markers (xem RK-P1-3)

**Acceptance:**
- [ ] Marker "BẠN Ở ĐÂY" tính từ rank thật (qua API)
- [ ] Position phản ánh đúng tỷ lệ (rank #100 of 247 → ~60%, rank #3 of 247 → ~99%)
- [ ] Test với edge cases: rank #1 (top), rank cuối, totalPlayers < 4

---

### RK-P0-3: "Sách 2/66" vs "2% mastery" — math không khớp
**Severity:** High · **Type:** Copy/Logic Bug · **Effort:** 30min copy + verify logic

**Triệu chứng:**
Card book selector hiển thị:
- "Genesis · Sách 2/66"
- "Đang chinh phục — 2%"

**Mâu thuẫn:**
- Genesis là sách đầu tiên trong Kinh Thánh → đáng lẽ phải là "Sách 1/66"
- 2/66 = 3% (không phải 2%)
- Có thể "2/66" là **đếm số sách user đã chơi**, không phải position của Genesis trong canon

**Root cause hypothesis:**
- Logic backend đếm `userBooksPlayed` rồi format thành "2/66"
- Nhưng copy "Sách 2/66" dễ hiểu nhầm là "Genesis là sách thứ 2"

**Đề xuất fix:**

**Option A — Position trong canon:**
```
Genesis · Sách thứ 1 · 2% mastery
```
"2/66" được bỏ vì redundant (book list đã có order)

**Option B — Số sách đã chơi:**
```
Đã chinh phục 2/66 sách
Đang ở: Genesis (2% mastery)
```

**Option C — Hybrid:**
```
Genesis (1/66) · 2% mastery · Đã chơi 2 sách khác
```

**Files:**
- `apps/web/src/pages/Ranked.tsx` (component CurrentBookCard)
- Backend `BookProgressService.java` (verify logic count)

**Acceptance:**
- [ ] Copy không gây hiểu nhầm
- [ ] "Sách X/Y" ratio (nếu giữ) có math đúng
- [ ] Test với user đã chơi 0 / 1 / 5 / 66 sách

---

## 🟠 P1 — UX Issues

### RK-P1-1: Tier pill "TÂN TÍN HỮU" xám đậm gây cảm giác disabled
**Severity:** High · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
Pill "TÂN TÍN HỮU" có:
- Background: xám đậm (gần với disabled state)
- Text: trắng
- Border: không có

Trên dark navy bg, pill này gần như **invisible / disabled**. User mới có thể nghĩ tier badge bị khoá.

**Vấn đề brand:**
Tier 1 dù thấp nhất vẫn cần visual identity. Theo COLOR_AUDIT, Tier 1 = `#9ca3af` (gray-400) — đây là color đúng. Nhưng cách render với solid bg + white text trên dark navy → trông không chuẩn.

**Đề xuất fix:**

**Pattern Sacred Modernist:**
```css
.tier-pill-1 {
  background: rgba(156, 163, 175, 0.15);  /* gray bg 15% opacity */
  border: 0.5px solid rgba(156, 163, 175, 0.5);  /* gray border */
  color: #9ca3af;  /* gray text — không phải trắng */
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}
```

Tương tự cho 6 tiers, mỗi tier dùng color tương ứng (sau khi xong COLOR_FIXES Task 1).

**Files:**
- `apps/web/src/components/TierBadge.tsx`
- `apps/mobile/src/components/TierBadge.tsx`

**Acceptance:**
- [ ] Pill có visual identity rõ ràng (không nhầm với disabled)
- [ ] 6 tier colors khác biệt rõ trên dark bg
- [ ] Contrast đạt WCAG AA cho text trên pill bg

---

### RK-P1-2: Progress bar tier có 2 màu (gold + blue) gây lẫn semantic
**Severity:** Medium · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
Progress bar "Còn 919 điểm nữa lên Người Tìm Kiếm" có:
- Phần đã đạt: gold (8% của bar)
- Phần chưa đạt: **xanh dương đậm** (92% của bar)

**Vấn đề:**
- Xanh dương trên dark navy bg → **trông như đã filled** cả hai phần
- User có thể hiểu nhầm "đã 100% progress"
- Có khả năng phần xanh = "color của tier kế (Người Tìm Kiếm = blue)" — concept hay nhưng không truyền tải được

**Đề xuất fix:**

**Option A (recommend) — Sacred Modernist standard:**
```css
.tier-progress-track {
  background: rgba(255, 255, 255, 0.06);  /* neutral track */
}
.tier-progress-fill {
  background: #e8a832;  /* gold fill */
  width: 8.1%;
}
```

**Option B — Gradient hint tier kế tiếp:**
```css
.tier-progress-track {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.06) 0%,
    rgba(255,255,255,0.06) 92%,
    rgba(96,165,250,0.15) 92%,  /* hint blue ở cuối nơi đạt tier 2 */
    rgba(96,165,250,0.15) 100%
  );
}
```

Option B giữ concept "tier kế" nhưng subtle hơn — chỉ hint, không lấn át.

**Files:**
- `apps/web/src/components/TierProgressBar.tsx`

**Acceptance:**
- [ ] User không nhầm bar đã 100%
- [ ] Visual contrast giữa filled vs unfilled rõ ràng
- [ ] Progress 8.1% trông đúng 8.1%

---

### RK-P1-3: Mùa progress bar concept sai — không phản ánh độ khó
**Severity:** Medium · **Type:** Concept · **Effort:** 2-3h

**Triệu chứng:**
4 markers cách đều nhau trên bar:
```
[──── TOP 100 ──── TOP 50 ──── BẠN Ở ĐÂY ──── TOP 1 ────]
        25%          50%         75%           100%
```

**Vấn đề:**
- Từ Top 100 → Top 50 = 50 ranks distance
- Từ Top 50 → Top 1 = 49 ranks distance
- Cùng distance numerical NHƯNG độ khó **rất khác**:
  - Top 100 → Top 50 dễ (chăm chỉ là được)
  - Top 50 → Top 10 khó hơn (phải tốt)
  - Top 10 → Top 1 cực khó (phải xuất sắc)

Bar linear không phản ánh đúng challenge progression.

**Đề xuất fix:**

**Option A — Logarithmic scale:**
```ts
function rankToPosition(rank: number, total: number): number {
  if (rank > total) return 0;
  // Log scale: rank 1 = 100%, rank 10 = ~80%, rank 100 = ~50%, rank 1000 = ~25%
  return Math.max(0, 1 - Math.log10(rank) / Math.log10(total));
}
```

**Option B — Tier-based markers:**
```
[Tham gia ──── Top 50% ──── Top 10% ──── Top 1% ──── Top 1]
```
Markers theo % chứ không theo rank số. Visual position theo % thật.

**Option C — Simplify, bỏ progress bar:**
Thay bằng card đơn giản:
```
🏆 Mùa Xuân 2026
Bạn đang ở rank #3 trên 247 người chơi
Top 1.2% — Còn 47 ngày để giữ vững
```

**Đề xuất:** Option C cho phase này (đơn giản, đúng), Option A nâng cấp khi có nhiều user (1000+).

**Files:**
- `apps/web/src/components/SeasonProgressBar.tsx`

**Acceptance:**
- [ ] Visualization phản ánh đúng độ khó
- [ ] User hiểu được "tôi cần leo bao nhiêu"
- [ ] Test với rank #1, #50, #100, #246, #247

---

### RK-P1-4: Hạng "#3 · 81 đ mùa" thiếu context
**Severity:** Medium · **Type:** Copy · **Effort:** 15min

**Triệu chứng:**
Bên trái Mùa progress bar có "#3" (số to gold) + "81 đ mùa" (subtle).

**Vấn đề:**
- "#3" không nói rõ là hạng gì (daily? weekly? mùa? all-time?)
- "đ mùa" rút gọn quá → khó hiểu (điểm mùa? đồng mùa?)
- User có thể nhầm với rank trong screenshot Leaderboard daily (#4-#5)

**Đề xuất fix:**
```
Hạng #3 mùa
81 điểm
```

Hoặc inline: "Bạn đang ở **hạng #3** với 81 điểm mùa"

**Files:**
- `apps/web/src/pages/Ranked.tsx` (SeasonStanding component)

**Acceptance:**
- [ ] Label "Hạng #X" rõ ràng (không chỉ "#X")
- [ ] Đơn vị "điểm" full word (không rút gọn "đ")

---

### RK-P1-5: Stats "Câu hỏi đã trả lời" và "Điểm hôm nay" inconsistent styling
**Severity:** Medium · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
2 cards cùng pattern (label + big number):
- Card 1: "CÂU HỎI ĐÃ TRẢ LỜI" + "**1**/100" (số "1" gold) + "Còn 99 câu được tính rank" + thin progress bar
- Card 2: "ĐIỂM HÔM NAY" + "**0**" (số "0" xám) + không có sub-text

**Vấn đề inconsistency:**
- Số "1" gold prominent
- Số "0" xám muted
- Card 1 có progress bar + sub-text
- Card 2 trống ở dưới → empty space awkward

**Đề xuất fix:**

**Option A — Đồng bộ hoá:**
- Cả 2 dùng số gold (vì đều là user metric quan trọng)
- Cả 2 có sub-text:
  - "Câu hỏi": "Còn 99 câu được tính rank"
  - "Điểm hôm nay": "Cần 50 điểm để vào top 100" hoặc "Trung bình 8 điểm/câu"
- Cả 2 có progress bar (tỷ lệ với day cap hoặc target)

**Option B — Card 2 thành widget khác:**
- Thay "Điểm hôm nay" bằng "Accuracy hôm nay" (1/1 = 100%)
- Hoặc "Streak combo cao nhất hôm nay"

**Files:**
- `apps/web/src/pages/Ranked.tsx`
- `apps/web/src/components/StatCard.tsx` (nếu có)

**Acceptance:**
- [ ] 2 stats cards có visual hierarchy nhất quán
- [ ] Sub-text + progress bar (nếu có) đầy đủ ở cả 2

---

### RK-P1-6: Button "ĐỔI SÁCH →" positioning có thể bị tap nhầm
**Severity:** Low · **Type:** UX · **Effort:** 15min

**Triệu chứng:**
Card book selector có:
- Bên trái: "Genesis · Sách 2/66 · TỔNG HỢP" (clickable card?)
- Bên phải: button "ĐỔI SÁCH →" outline gold

**Vấn đề:**
- Cả card có thể clickable (mở book selector) HOẶC chỉ button mới clickable?
- Nếu cả card clickable, button thừa
- Nếu chỉ button, area của button khá nhỏ (font 10px)
- Trên mobile, ngón tay user có thể tap nhầm vào "TỔNG HỢP" pill

**Đề xuất fix:**

**Option A — Cả card clickable:**
- Bỏ button outline
- Thêm icon `→` ở góc phải card
- Cả card highlight on hover

**Option B — Tách rõ:**
- Card hiển thị info, không clickable
- Button "Đổi sách" thành text link dưới card: "[Đổi sang sách khác →]"

**Files:**
- `apps/web/src/pages/Ranked.tsx`

**Acceptance:**
- [ ] Tap area rõ ràng (cả card hoặc cả button)
- [ ] Mobile-friendly (44px+ tap target)

---

## 🟡 P2 — Improvements

### RK-P2-1: Thiếu "Rules of engagement" cho user mới
**Severity:** Low · **Type:** Onboarding · **Effort:** 2-3h

**Triệu chứng:**
Lần đầu vào Ranked, user mới không biết:
- Năng lượng làm gì? Sai mất bao nhiêu? (Theo SPEC: -5 energy mỗi câu sai)
- "100 câu" cap nghĩa là gì? (Daily cap)
- Mùa thi đấu là gì? Khác daily/weekly thế nào?
- Đổi sách → ảnh hưởng gì?

**Đề xuất:**

**Option A — Inline hints:**
- Tooltip ⓘ icon cạnh mỗi metric
- Hover/tap → mở popover giải thích

**Option B — First-time tutorial:**
- Lần đầu vào Ranked → 3-step tooltip walkthrough (giống onboarding home)
- Lưu flag `hasSeenRankedTutorial`

**Option C — Help link:**
- "Lần đầu vào Ranked? [Tìm hiểu cách chơi →]" link nhẹ dưới CTA
- Mở trang/modal giải thích

**Files:**
- `apps/web/src/pages/Ranked.tsx`
- New component: `RankedTutorial.tsx` hoặc `RankedHelpModal.tsx`

**Acceptance:**
- [ ] User mới có way to learn rules
- [ ] Không gây phiền cho user đã thuộc
- [ ] Mobile + web parity

---

### RK-P2-2: CTA chính có cinematic moment, nhưng không có "soft path"
**Severity:** Low · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
"VÀO THI ĐẤU NGAY" là CTA gold lớn. Nhưng nếu user **không sẵn sàng** (chỉ vào xem stats, hoặc energy thấp, hoặc tâm trạng không tốt), không có alternative action.

**Đề xuất:**
Thêm secondary actions mềm dưới hoặc cạnh CTA chính:

```
[VÀO THI ĐẤU NGAY]   ← primary
↓
[Luyện tập trước (Practice)] · [Xem rank chi tiết] · [Lịch sử trận]
                                                       (text links)
```

**Files:**
- `apps/web/src/pages/Ranked.tsx`

**Acceptance:**
- [ ] User có ít nhất 2 alternative actions ngoài CTA chính
- [ ] Soft paths không cạnh tranh visual với primary

---

### RK-P2-3: Thiếu Match history / Recent results
**Severity:** Medium · **Type:** Missing Feature · **Effort:** 3-4h

**Triệu chứng:**
Trang Ranked dashboard không có context lịch sử:
- Trận gần nhất user đã chơi?
- Win/lose pattern?
- Điểm cao nhất hôm nay?
- Streak combo cao nhất?

Hiện tại user vào Ranked như mỗi lần là **lần đầu** — không có momentum, không có "tôi đã làm gì gần đây".

**Đề xuất:**
Thêm 1 section nhỏ "Trận gần đây" với 3-5 mini cards:
```
Trận gần đây:
[✓ Genesis · 12 điểm · 4 phút trước]
[✗ Genesis · 3 điểm · 1 giờ trước]
[✓ Exodus · 18 điểm · hôm qua]
```

API có sẵn: `GET /api/me/history?mode=ranked&limit=5` (theo SPEC mục 17.3).

**Files:**
- `apps/web/src/pages/Ranked.tsx` (thêm section RecentMatches)
- `apps/web/src/components/MatchHistoryRow.tsx` (new component)

**Acceptance:**
- [ ] 3-5 trận gần nhất hiển thị
- [ ] Click row → review trận đó (POST /api/sessions/{id}/review)
- [ ] Empty state khi user chưa chơi trận nào

---

### RK-P2-4: Energy bar không có visual urgency state
**Severity:** Low · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
Energy bar hiện 100/100 → bar gold đẹp. Nhưng khi xuống 20/100 thì thế nào? Hiện tại UX không signal "low energy state".

**Đề xuất:**
States của energy bar:
| Energy | Color |
|---|---|
| 100-50 | Gold (`#e8a832`) |
| 50-20 | Yellow (`#eab308`) |
| 20-10 | Orange (`#ff8c42`) — warning |
| < 10 | Red (`#ef4444`) — critical |
| 0 | Gray + lock icon "Hết năng lượng" |

Thêm icon ⚠️ + animation pulse subtle khi < 20.

**Files:**
- `apps/web/src/components/EnergyBar.tsx`
- `apps/mobile/src/components/EnergyBar.tsx`

**Acceptance:**
- [ ] 5 states color khác biệt
- [ ] Animation chỉ kích hoạt khi < 20
- [ ] Mobile vibration (haptic) khi xuống state mới (optional)

---

## 🟢 P3 — Polish (defer)

### RK-P3-1: Title font "Thi Đấu Xếp Hạng" hơi to
**Severity:** Very Low · **Type:** Typography · **Effort:** 15min

Title `~28-32px` dominant so với content. Reduce xuống `22-24px` để hierarchy hài hoà.

---

### RK-P3-2: 2 countdown cùng format gây nhầm
**Severity:** Very Low · **Type:** Copy · **Effort:** 15min

"Phục hồi: 23:59:56" (energy) + "Đặt lại: 23:59:56" (mùa) cùng giá trị → user có thể nhầm.

**Đề xuất:** Thêm context:
- "Năng lượng phục hồi sau: 23:59:56"
- "Mùa kết thúc sau: 47 ngày 23:59:56"

---

### RK-P3-3: Sidebar lặp với Home
**Severity:** Very Low · **Type:** UX · **Effort:** 1-2h

Sidebar có Streak + Daily Mission — y hệt Home. Sidebar Ranked nên có content đặc thù:
- "Mục tiêu mùa: Top 50"
- "Win rate hôm nay"
- "Streak combo cao nhất tuần"

(Phụ thuộc RK-P0-1: sau khi bỏ Streak duplicate, sidebar có thể redesign luôn).

---

## 📊 Tổng kết

| Severity | Count | Total effort |
|---|---|---|
| 🔴 P0 (blocker) | 3 | 2-3h |
| 🟠 P1 (UX) | 6 | 5-7h |
| 🟡 P2 (improve) | 4 | 7-9h |
| 🟢 P3 (polish) | 3 | 2-3h |
| **Total** | **16** | **~16-22h** |

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — P0 fixes (2-3h)
1. **RK-P0-1** — Bỏ Streak duplicate (15min, nhanh nhất)
2. **RK-P0-3** — Sửa copy "Sách 2/66" (30min copy + verify)
3. **RK-P0-2** — Wire "BẠN Ở ĐÂY" theo rank thật (1-2h)

### Sprint 2 — P1 visual fixes (5-7h)
4. **RK-P1-1** — Tier pill styling (30min) — phụ thuộc COLOR_FIXES Task 1
5. **RK-P1-2** — Tier progress bar 1 màu (30min)
6. **RK-P1-4** — Label "Hạng #3" rõ ràng (15min)
7. **RK-P1-5** — 2 stats cards đồng bộ (30min)
8. **RK-P1-6** — Tap area "Đổi sách" (15min)
9. **RK-P1-3** — Redesign Mùa progress (2-3h, lớn nhất)

### Sprint 3 — P2 enhancements
10. **RK-P2-3** — Match history section (3-4h, impact cao)
11. **RK-P2-1** — Rules/help cho user mới (2-3h)
12. **RK-P2-4** — Energy bar urgency states (1h)
13. **RK-P2-2** — Soft path actions (1h)

### Backlog
14. Tất cả P3

---

## 🔗 Related artifacts

- `docs/COLOR_AUDIT.md` — RK-P1-1 phụ thuộc Task 1 sync tier colors
- `PROMPT_COLOR_FIXES.md` — Task 1 sync 6 tier colors
- `BUG_REPORT_LEADERBOARD.md` — pattern tương tự cho Leaderboard
- `SPEC_USER_v3.md` mục 4.4 (energy), mục 5.2 (Ranked Mode), mục 3.3 (season)
- API: `GET /api/me/ranked-status` — energy + daily progress
- API: `GET /api/me/history?mode=ranked` — RK-P2-3

---

## 🤔 Questions cần Bui quyết

1. **Mùa progress visualization** (RK-P1-3): Option A linear, B logarithmic, hay C bỏ bar dùng card đơn giản?
2. **CTA secondary** (RK-P2-2): có muốn thêm "Practice trước" link để user warm-up không, hay giữ Ranked là 1-CTA-only experience?
3. **Match history scope** (RK-P2-3): hiển thị 3 / 5 / 10 trận? Click row → review (free) hay hiện modal stats?
4. **Sprint order**: làm P0 ngay hay đợi xong COLOR_FIXES rồi gộp với P1-1?

---

## 📝 Cross-references với Leaderboard report

Issues tương đồng giữa Ranked và Leaderboard:
| Issue | Ranked | Leaderboard |
|---|---|---|
| Tier color không phân biệt | RK-P1-1 | LB-P0-4 |
| Sidebar redundant | RK-P0-1 + RK-P3-3 | LB-P3-1 |
| Visualization sai concept | RK-P1-3 (Mùa bar) | LB-P1-1 (Podium) |
| Copy thiếu context | RK-P1-4 (#3) | LB-P1-5 (tie-break) |
| User mới không có context | RK-P2-1 | LB-P2-2 (empty state) |

Có thể batch fix cùng nhau cho consistency.

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
