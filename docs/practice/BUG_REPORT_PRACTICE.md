# Bug Report — Practice Mode Dashboard (`/practice`)

> **Source:** Visual review screenshot 2026-04-30
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Practice.tsx` (web), `apps/mobile/src/screens/quiz/PracticeScreen.tsx` (mobile)
> **Implementation rate:** ~90% (page implement tốt nhất so với 4 reports trước)
> **Severity overview:** 1× P0 (data verify), 5× P1 (UX), 4× P2 (improvements), 3× P3 (polish)

---

## 🎯 Tóm tắt Implementation Status

**Practice page là page implement TỐT NHẤT em đã review** trong các screenshots. Layout rõ ràng, hierarchy đúng, content rich, có nhiều "đặc thù Practice" mà các trang khác không có (Mẹo học tập, Phiên gần đây, Làm lại câu sai feature surface-level).

**So sánh:**

| Trang | Implementation | Issues |
|---|---|---|
| Home | 80-85% | 17 |
| Leaderboard | ~70% | 14 |
| Ranked | ~75% | 16 |
| Quiz | ~75% | 13 |
| **Practice** | **~90%** | **13** (đa số P1-P2 polish) |

Issues đa số là **polish + minor UX** — không có architectural problems lớn.

**Gì đã làm tốt:**
- Hero header với badge + title highlight + tagline 3 nhịp Sacred Modernist tone
- Config panel layout 2 cột logical (input options trái, modifiers phải)
- Smart CTA với 3 metrics inline (10 câu · ~4 phút · 66 sách)
- "Làm lại câu sai" feature visible (retry mode surface-level)
- "Phiên gần đây" với 3 mini cards momentum
- "Mẹo học tập" educational footer
- "Quay lại trang chủ" soft escape route
- Empty state copy cho dropdown sách rõ ràng

---

## 🔴 P0 — Critical (data verify)

### PR-P0-1: "Phiên gần đây" có data dates nghi ngờ
**Severity:** Critical (nếu là production data) · **Type:** Data/Logic · **Effort:** 1-2h

**Triệu chứng:**
3 cards "Phiên gần đây" hiển thị dates **28/03/2026, 27/03/2026, 26/03/2026** — nhưng hôm nay là **30/04/2026** (cuối tháng 4).

→ 3 sessions cách hôm nay **30+ ngày** mà vẫn được gọi "Phiên gần đây" — **misleading copy**.

**Hai khả năng:**

**1. Test data hardcoded** — nếu vậy:
- Verify component không hardcode dates
- Mock data với realistic timestamps relative to current date

**2. Production data thật** — nếu vậy:
- User TAI THANH đã không vào Practice 30+ ngày
- "Phiên gần đây" với dates 30+ ngày là technically correct nhưng UX sai

**Verification:**
```bash
# Check component logic
grep -rn "recentSessions\|phiên gần đây\|RecentSessionsCard" apps/web/src --include="*.tsx"

# Check API
curl "http://localhost:8080/api/me/history?mode=practice&limit=3" | jq '.[].createdAt'
# Expect: thực sự là dates gần đây
```

**Fix:**

**1. Relative time display:**
```tsx
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} tuần trước`;
  return `${Math.floor(diffDay / 30)} tháng trước`;
}
```

**2. Threshold cảnh báo nếu sessions cũ:**
- Sessions > 14 ngày: thêm CTA "Bắt đầu phiên mới" thay vì khuyến khích revisit
- Empty state nếu không có sessions nào trong 90 ngày

**3. Sub-section title context:**
- Nếu sessions tất cả < 7 ngày: "Phiên gần đây"
- Nếu sessions cũ: "Lịch sử luyện tập"

**Files affected:**
- `apps/web/src/pages/Practice.tsx` (RecentSessionsCard component)
- `apps/web/src/utils/dateHelpers.ts` (new — formatRelativeTime)

**Acceptance:**
- [ ] Verify: data trong screenshot là test data hay production?
- [ ] Nếu test data: replace với realistic timestamps
- [ ] Implement relative time format
- [ ] Test với 5 cases: vừa xong, 30 phút, hôm qua, 3 ngày, 30 ngày
- [ ] Sessions > 14 ngày → CTA encourage new session

---

## 🟠 P1 — UX Issues

### PR-P1-1: VI/EN toggle trông giống 2 buttons độc lập
**Severity:** High · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
Language toggle "NGÔN NGỮ CÂU HỎI":
- VI: gold filled, active
- EN: dark filled, inactive

**Vấn đề:**
- Trông giống **2 buttons độc lập** thay vì **1 toggle 2 states**
- User mới có thể tap EN tưởng "thêm tiếng Anh" thay vì "switch sang tiếng Anh"
- Spacing giữa 2 buttons quá lớn (không liền nhau như segmented control)

**Đề xuất fix:**

**Option A (recommend) — Segmented control liền nhau:**
```tsx
<div className="inline-flex bg-surface-container rounded-lg p-1">
  <button
    onClick={() => setLanguage('vi')}
    className={cn(
      'px-4 py-2 rounded-md text-sm font-medium transition-all',
      language === 'vi' 
        ? 'bg-secondary text-on-secondary' 
        : 'text-on-surface/60 hover:text-on-surface'
    )}
  >
    Tiếng Việt
  </button>
  <button
    onClick={() => setLanguage('en')}
    className={cn(
      'px-4 py-2 rounded-md text-sm font-medium transition-all',
      language === 'en' 
        ? 'bg-secondary text-on-secondary' 
        : 'text-on-surface/60 hover:text-on-surface'
    )}
  >
    English
  </button>
</div>
```

**Option B — iOS-style pill toggle:**
1 pill duy nhất, slider giữa VI/EN với smooth transition.

**Option C — Dropdown:**
```
[Ngôn ngữ: Tiếng Việt ▼]
```

**Recommend Option A** — match pattern "Số câu hỏi 5/10/20/50" phía dưới (cùng style segmented).

**Files affected:**
- `apps/web/src/pages/Practice.tsx` (LanguageToggle hoặc inline)

**Acceptance:**
- [ ] Toggle visually clear là 1 control 2 states
- [ ] Active state rõ ràng (không nhầm với inactive button)
- [ ] Match segmented style với "Số câu hỏi"
- [ ] Mobile-friendly tap target

---

### PR-P1-2: 4 buttons "Số câu hỏi" có size khác nhau khi active
**Severity:** Medium · **Type:** Visual · **Effort:** 15min

**Triệu chứng:**
4 buttons trong "Số câu hỏi":
- 5, 20, 50: dark filled, font ~16px, padding standard
- 10 (active): gold filled, font ~32px (lớn gấp 2), padding rộng hơn

**Vấn đề:**
- Active button có **width khác** inactive → grid 4 cột bị lệch
- Font size jump 16→32px quá lớn, visually disruptive
- Khi switch active state, các buttons nhảy width
- Pattern không nhất quán với standard segmented control

**Đề xuất fix:**

```tsx
const COUNTS = [5, 10, 20, 50];

<div className="grid grid-cols-4 gap-2">
  {COUNTS.map(count => (
    <button
      key={count}
      onClick={() => setQuestionCount(count)}
      className={cn(
        'h-12 rounded-lg font-medium text-base transition-all',
        questionCount === count
          ? 'bg-secondary text-on-secondary ring-2 ring-secondary/40'
          : 'bg-surface-container text-on-surface/70 hover:text-on-surface'
      )}
    >
      {count}
    </button>
  ))}
</div>
```

**Yêu cầu:**
- 4 buttons cùng width (`grid-cols-4`)
- Cùng padding/font-size
- Active state: background change + optional ring glow (KHÔNG thay đổi font-size)

**Acceptance:**
- [ ] 4 buttons cùng kích thước
- [ ] Switch active không gây layout shift
- [ ] Active state visually clear nhưng không lấn át

---

### PR-P1-3: 4 buttons "Độ khó" thiếu color differentiation
**Severity:** Medium · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
4 difficulty buttons:
- Tất cả: 🔺 (gold icon, active)
- Dễ: 😊 (green icon)
- Trung bình: ⚡ (yellow icon)
- Khó: 🔥 (red icon)

Icons có color, nhưng **buttons background đều dark uniform** → user scan không lập tức nhận ra "Khó" vs "Dễ".

**Đề xuất fix:**

```tsx
const DIFFICULTIES = [
  { id: 'all', label: 'Tất cả', icon: 'category', color: 'secondary' },
  { id: 'easy', label: 'Dễ', icon: 'sentiment_satisfied', color: 'success' },
  { id: 'medium', label: 'Trung bình', icon: 'speed', color: 'warning' },
  { id: 'hard', label: 'Khó', icon: 'local_fire_department', color: 'error' },
];

{DIFFICULTIES.map(diff => {
  const isActive = difficulty === diff.id;
  return (
    <button
      key={diff.id}
      onClick={() => setDifficulty(diff.id)}
      className={cn(
        'p-4 rounded-lg flex items-center gap-3 transition-all border',
        isActive
          ? `bg-${diff.color}/15 border-${diff.color}/50 ring-2 ring-${diff.color}/30`
          : `bg-${diff.color}/8 border-${diff.color}/20 hover:bg-${diff.color}/12`
      )}
    >
      <span className={`material-symbols-outlined text-${diff.color}`}>
        {diff.icon}
      </span>
      <span className="text-on-surface font-medium">{diff.label}</span>
    </button>
  );
})}
```

**Yêu cầu:**
- Inactive: bg subtle với color theo difficulty
- Active: bg đầy hơn + ring glow + border đậm hơn
- Pattern leveraging color cho fast scanning (giống Answer Color Mapping trong Quiz)

**Files affected:**
- `apps/web/src/pages/Practice.tsx` (DifficultySelector hoặc inline)

**Acceptance:**
- [ ] User scan 1s biết tier nào là Easy/Medium/Hard
- [ ] Active state visual rõ
- [ ] WCAG AA contrast cho text trên mỗi color
- [ ] Test với colorblind simulator

---

### PR-P1-4: Toggle "Hiển thị giải thích" position gây layout chênh
**Severity:** Medium · **Type:** Layout · **Effort:** 15min

**Triệu chứng:**
Layout 2 cột:
- **Cột trái:** Ngôn ngữ + Sách + Số câu (3 sections, cao)
- **Cột phải:** Độ khó (4 buttons) + Toggle "Hiển thị giải thích" (1 toggle, ngắn)

→ Cột phải cao **chỉ ~50% cột trái** → layout không cân đối, có khoảng trắng lớn ở cột phải.

**Đề xuất fix:**

**Option A (recommend) — Move toggle xuống full-width row:**
```tsx
<div className="grid grid-cols-2 gap-6">
  {/* Cột trái */}
  <div>
    <LanguageSelector />
    <BookSelector />
    <QuestionCountSelector />
  </div>
  {/* Cột phải */}
  <div>
    <DifficultySelector />
  </div>
</div>

{/* Full-width row */}
<div className="border-t border-border-tertiary/20 pt-4 mt-4">
  <ExplanationToggle />
</div>
```

**Option B — Thêm options khác vào cột phải để cân:**
- "Time per question override" (slider)
- "Sound on/off" toggle
- "Smart selection" toggle

**Recommend Option A** — Practice không cần thêm options phức tạp, full-width row sạch hơn.

**Files affected:**
- `apps/web/src/pages/Practice.tsx`

**Acceptance:**
- [ ] 2 cột cân đối chiều cao (hoặc gần bằng)
- [ ] Toggle vẫn visible prominent
- [ ] Mobile responsive (stack vertical)

---

### PR-P1-5: Title "Luyện **Tập**" highlight inconsistent
**Severity:** Low · **Type:** Typography · **Effort:** 5min decision + 15min apply

**Triệu chứng:**
Title "Luyện Tập":
- "Luyện" — white
- "Tập" — gold (highlight)

**Vấn đề:**
- Highlight 1 từ trong title không có pattern rõ
- Tại sao "Tập" gold mà không phải "Luyện"?
- Pattern này có dùng cho titles khác không? Em không thấy trong Ranked / Daily.

**3 Options:**

**Option A:** Bỏ highlight, title plain white
- Simpler, không cần explain pattern
- Match với Ranked title (plain "Thi đấu Xếp hạng")

**Option B:** Apply pattern systematically — luôn highlight từ cuối
- "Thi đấu **Ranked**"
- "Thử thách **Hôm nay**"
- "Luyện **Tập**"

**Option C:** Highlight verb thay vì noun
- "**Luyện** Tập" (action focus)
- "**Thi đấu** Xếp hạng"

**Recommend Option A** — đơn giản nhất, không cần commit pattern across pages.

**Files affected:**
- `apps/web/src/pages/Practice.tsx` (title element)
- (Nếu Option B) Ranked.tsx, DailyChallenge.tsx

**Acceptance:**
- [ ] Decision documented trong DECISIONS.md
- [ ] Apply nhất quán nếu Option B

---

## 🟡 P2 — Improvements

### PR-P2-1: Dropdown sách thiếu search/filter cho 66 sách
**Severity:** Medium · **Type:** UX · **Effort:** 1-2h

**Triệu chứng:**
"SÁCH KINH THÁNH" dropdown placeholder "Tất cả các sách". Khi open → list 66 sách scrollable.

**Vấn đề:**
- 66 items khó scan, dễ miss
- User muốn chọn "Rô-ma" phải scroll qua 44 sách Cựu Ước
- Không có search/typeahead
- Mobile particularly painful

**Đề xuất options:**

**Option A — Search input on top:**
```
┌────────────────────────────┐
│ 🔍 Tìm sách...             │
├────────────────────────────┤
│ Cựu Ước (39 sách)          │
│   Sáng Thế Ký              │
│   Xuất Hành                │
│   ...                      │
│ Tân Ước (27 sách)          │
│   Ma-thi-ơ                 │
│   ...                      │
└────────────────────────────┘
```

**Option B — Group selector 2-step:**
1. Chọn group (Cựu Ước / Tân Ước / Phúc Âm / Thư Tín)
2. Chọn sách trong group

**Option C — Recent + popular sách:**
- "Đã chơi gần đây": Genesis, Matthew, Romans
- "Phổ biến": Psalms, John, Romans
- "Tất cả 66 sách": (collapse/scroll)

**Recommend:** Option A (search) cho phase này, Option C cho v2.0.

**Files affected:**
- `apps/web/src/pages/Practice.tsx` (BookSelector)
- Tạo mới: `apps/web/src/components/practice/BookSearchableSelect.tsx`

**Acceptance:**
- [ ] Search filter case-insensitive
- [ ] Vietnamese name + English name đều search được
- [ ] Group divider Cựu Ước / Tân Ước rõ
- [ ] Keyboard navigation (arrow up/down + enter)
- [ ] Mobile-friendly modal variant

---

### PR-P2-2: 3 metric icons cuối CTA positioning lạc lõng
**Severity:** Low · **Type:** Layout · **Effort:** 15min

**Triệu chứng:**
Cuối config panel có 3 metrics inline với CTA:
- ❓ 10 CÂU HỎI
- ⏱ ~4 PHÚT
- 📚 66 SÁCH

3 metrics nằm bên trái CTA "BẮT ĐẦU LUYỆN TẬP" cùng row → reading flow gãy.

**Đề xuất fix:**

**Option A (recommend) — Move xuống dưới CTA:**
```tsx
<div className="text-center mt-3 text-on-surface/55 text-xs">
  10 câu hỏi · ~4 phút · từ 66 sách
</div>
```

Pattern nhất quán với Ranked sticky CTA sub-text.

**Option B — Move lên top panel:**
```
LUYỆN TẬP
10 câu · ~4 phút · 66 sách
[config options]
[CTA]
```

**Option C — Bỏ luôn:**
3 metrics đã được implied trong config (count + difficulty + book selector).

**Recommend Option A.**

**Acceptance:**
- [ ] Reading flow tự nhiên: config → CTA → meta
- [ ] Metrics vẫn visible nhưng không lấn át CTA

---

### PR-P2-3: "Phiên gần đây" cards thiếu actions / hover state
**Severity:** Medium · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
3 cards "Phiên gần đây" hiển thị data nhưng:
- Click card → navigate đâu? Không có visual cue
- Không có button "Chơi lại với cùng config"
- Không có "Xem chi tiết"

**Đề xuất:**

Mỗi card:
- Click whole card → navigate review session (`/sessions/{id}/review`)
- Hover state (desktop): bg lighter + cursor pointer
- Active state: scale 0.98 khi tap (mobile feedback)

Optional: 2 actions split:
```
┌──────────────────────────────┐
│ 28/03/2026          80%      │
│ Ma-thi-ơ                     │
│ ████████░░ 8/10              │
│ ────────────────────────     │
│ [Xem chi tiết]  [Chơi lại]   │
└──────────────────────────────┘
```

Hoặc keep simple — cả card click → review.

**Files affected:**
- `apps/web/src/components/practice/RecentSessionCard.tsx` (nếu component riêng)

**Acceptance:**
- [ ] Card có cursor: pointer + hover state
- [ ] Click navigate đúng review URL
- [ ] Mobile: tap feedback (scale animation)

---

### PR-P2-4: "66/66 sách" badge ý nghĩa không rõ
**Severity:** Low · **Type:** Copy · **Effort:** 10min

**Triệu chứng:**
Header "📚 SÁCH KINH THÁNH" có "66/66 sách" subtle bên phải.

**Câu hỏi:**
- "66/66" nghĩa là gì?
- "User đã chinh phục 66/66 sách"?
- "Có 66/66 sách available trong system"?
- User mới (chưa chơi sách nào) sẽ thấy "0/66" → demotivating?

**Verify:**
```bash
grep -n "66/66\|booksCompleted\|totalBooks" apps/web/src/pages/Practice.tsx
```

**Fix:**

**Option A — Nếu là progress:**
```
SÁCH KINH THÁNH                       Đã chinh phục 0/66
```

**Option B — Nếu là count available:**
```
SÁCH KINH THÁNH                       Có 66 sách
```
(Bỏ "/" để không gây nhầm với progress)

**Option C — Bỏ luôn:**
Info này đã có trong Bible Journey Map ở Home → không cần duplicate ở Practice.

**Recommend Option C** — Practice page focus vào config, không cần journey progress.

**Acceptance:**
- [ ] Copy không gây nhầm
- [ ] Hoặc bỏ hoàn toàn nếu redundant

---

## 🟢 P3 — Polish (defer)

### PR-P3-1: Empty state "Phiên gần đây" cho user mới
**Severity:** Very Low · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
Nếu user mới chưa có session nào → "Phiên gần đây" hiển thị gì?

Khả năng:
- Section ẩn hoàn toàn (UI clean)
- Empty state với CTA

**Đề xuất:**

```tsx
{recentSessions.length === 0 ? (
  <EmptyState
    icon="🌱"
    title="Bạn chưa có phiên luyện tập nào"
    description="Bắt đầu phiên đầu tiên ngay phía trên ↑"
  />
) : (
  <RecentSessionsList sessions={recentSessions} />
)}
```

**Files:**
- `apps/web/src/pages/Practice.tsx`

**Acceptance:**
- [ ] User mới có hint encouraging (không silent empty)
- [ ] CTA mềm dẫn lên config panel

---

### PR-P3-2: "Mẹo học tập" có thể rotate daily
**Severity:** Very Low · **Type:** Content · **Effort:** 1h

**Triệu chứng:**
"Ôn tập đều đặn mỗi ngày giúp ghi nhớ lâu hơn." — chỉ 1 tip cố định?

User vào Practice 30 ngày liên tiếp đọc cùng tip → bored.

**Đề xuất:**

Pool 8-10 tips, rotate daily với deterministic seed:

```tsx
const LEARNING_TIPS = [
  'Ôn tập đều đặn mỗi ngày giúp ghi nhớ lâu hơn',
  'Câu sai là cơ hội học. Hãy đọc kỹ giải thích!',
  'Tập trung vào 1 sách/lần để hiểu sâu hơn',
  'Đặt mục tiêu nhỏ: 10 câu/ngày trong 30 ngày',
  'Chia sẻ tiến độ với hội thánh để có động lực',
  'Ôn lại câu sai trước khi học câu mới',
  'Đọc verse reference đầy đủ để hiểu context',
  'Spaced repetition: ôn câu cũ sau 1, 3, 7, 14 ngày',
  '"Hãy hết lòng tin cậy Đức Giê-hô-va" - Châm Ngôn 3:5',
  'Học cùng anh chị em vui hơn học một mình',
];

function getDailyTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return LEARNING_TIPS[dayOfYear % LEARNING_TIPS.length];
}
```

Hoặc API: `GET /api/learning-tips/today` (deterministic theo dayOfYear).

**Files:**
- `apps/web/src/data/learningTips.ts` (new)
- `apps/web/src/pages/Practice.tsx`

**Acceptance:**
- [ ] Tip rotate mỗi ngày
- [ ] Cùng tip cho mọi user trong 1 ngày (consistency)
- [ ] Pool ≥ 8 tips

---

### PR-P3-3: "Quay lại trang chủ" link có thể tích hợp breadcrumb
**Severity:** Very Low · **Type:** Navigation · **Effort:** 30min

**Triệu chứng:**
"← Quay lại trang chủ" ở cuối page hiện cô đơn.

**Đề xuất (optional):**

**Option A:** Breadcrumb top:
```
Trang chủ > Luyện tập
```

**Option B:** Back button trong header:
```
[←] Luyện tập                            [🔔]
```

**Option C:** Giữ nguyên (current) — link cuối page hoạt động OK cho user scroll xong.

**Recommend Option C** — không cần change, đây là polish optional.

---

## 📊 Tổng kết

| Severity | Count | Total effort |
|---|---|---|
| 🔴 P0 (data) | 1 | 1-2h |
| 🟠 P1 (UX) | 5 | 1.5-2h |
| 🟡 P2 (improve) | 4 | 2-3h |
| 🟢 P3 (polish) | 3 | 1.5-2h |
| **Total** | **13** | **~6-9h** |

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — P0 verify [1-2h]
1. **PR-P0-1** — Verify "Phiên gần đây" data + implement relative time format

### Sprint 2 — P1 quick wins [1.5-2h]
2. **PR-P1-1** — VI/EN segmented control (30min)
3. **PR-P1-2** — Số câu hỏi buttons cùng size (15min)
4. **PR-P1-4** — Toggle "Hiển thị giải thích" full-width row (15min)
5. **PR-P1-5** — Title highlight decision + apply (15min)
6. **PR-P1-3** — Difficulty buttons color differentiation (30min)

### Sprint 3 — P2 enhancements [2-3h]
7. **PR-P2-1** — Searchable book dropdown (1-2h, lớn nhất impact)
8. **PR-P2-3** — Recent sessions card actions (30min)
9. **PR-P2-2** — CTA metrics positioning (15min)
10. **PR-P2-4** — "66/66" badge clarify hoặc bỏ (10min)

### Backlog
11. P3 (empty state, rotate tips, breadcrumb) — defer

---

## 🔗 Related artifacts

- `BUG_REPORT_HOME_POST_IMPL.md`
- `BUG_REPORT_LEADERBOARD.md`
- `BUG_REPORT_RANKED.md`
- `BUG_REPORT_QUIZ.md`
- `docs/COLOR_AUDIT.md` — PR-P1-3 difficulty colors có thể leverage success/warning/error tokens existing
- `SPEC_USER_v3.md` mục 5.1 (Practice Mode) + mục 7 (Smart Question Selection)

---

## 🤔 Questions cần Bui quyết

1. **Title highlight pattern** (PR-P1-5): Option A (bỏ), B (systematic), C (verb-focus)?
2. **Book selector pattern** (PR-P2-1): Option A (search) ngay hay defer Option C (recent+popular)?
3. **66/66 badge** (PR-P2-4): Bỏ hay clarify ý nghĩa?
4. **"Phiên gần đây" data**: là test data hay production data thực? (Verify trước khi fix)
5. **Sprint priority**: Sprint 1 (P0) vs Sprint 2 (P1 batch quick wins) — làm cái nào trước?

---

## 📝 Cross-references với các bug reports khác

Issues tương đồng giữa Practice và các trang khác:

| Issue type | Practice | Other reports |
|---|---|---|
| Sub-tier copy / counter ambiguous | PR-P2-4 (66/66) | HM-P1-2 (0/200) |
| Tier color leveraging | PR-P1-3 (difficulty) | QZ-P0-1 (answers), tier colors |
| Sidebar lặp với Home | (giữ nguyên) | RK-P3-3, LB-P3-1 |
| Recent items cards | PR-P2-3 | RK-P2-3 (match history) |
| Time format | PR-P0-1 (relative) | All reports nên consider |

Có thể batch fix cùng sprint cho consistency.

---

## 📊 So sánh implementation tổng

| Trang | Implementation | P0 issues | P1 issues | Total | Notable |
|---|---|---|---|---|---|
| Home | 80-85% | 1 | 5 | 17 | Live data thiếu |
| Leaderboard | ~70% | 4 | 5 | 14 | i18n bug critical |
| Ranked | ~75% | 3 | 6 | 16 | CTA position |
| Quiz | ~75% | 3 | 4 | 13 | Color mapping |
| **Practice** | **~90%** | **1** | **5** | **13** | **Best so far, polish-focused** |

Practice tiến bộ nhất về implementation quality. Có thể dùng làm **reference page** cho các page khác refactor.

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
