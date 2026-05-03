# Bug Report — Quiz Screen (`/quiz/:sessionId`)

> **Source:** Visual review screenshot 2026-04-30 (Ranked single-player session)
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Quiz.tsx` (web), `apps/mobile/src/screens/quiz/QuizScreen.tsx` (mobile), `apps/web/src/pages/RoomQuiz.tsx` (multiplayer variant)
> **Decision chốt:** **Answer Color Mapping apply cho TẤT CẢ modes** (Practice / Ranked / Daily / Multiplayer)
> **Severity overview:** 3× P0 (UX critical), 4× P1 (issues), 4× P2 (improvements), 2× P3 (polish)

---

## 🎯 Tóm tắt

Quiz screen là màn hình quan trọng nhất của BibleQuiz — user dành nhiều thời gian nhất ở đây. Implementation hiện tại đã có structure đúng (câu hỏi prominent, 4 đáp án 2x2, top stats), nhưng có 3 issues critical về UX cần fix:

1. **Answer Color Mapping thiếu** — 4 đáp án cùng màu xám, không có muscle memory
2. **Câu hỏi text bị break xấu** — "Bên-gia-min" wrap giữa từ
3. **Timer thiếu visual urgency states** — không có ring countdown + color escalation

Sau khi fix 3 P0 này, Quiz screen sẽ đạt UX standard của Kahoot/Quizizz tier.

---

## 🎨 Decision đã chốt: Answer Color Mapping cho TẤT CẢ modes

**Rationale:**
- Consistency UX cross modes (user không phải học pattern khác nhau)
- Muscle memory phát triển nhanh hơn (xuất hiện ở mọi quiz)
- Ngôn ngữ chung trong group play ("ai chọn Vàng?")
- Tốc độ recognition tăng — quan trọng cho timer-based modes
- Aligned với DESIGN_TOKENS.md đã có 4 Game Mode Accent colors sẵn

**Color mapping (từ DESIGN_TOKENS.md):**

| Vị trí | Tên | Hex | Semantic |
|---|---|---|---|
| **A** (top-left) | Coral | `#E8826A` | Cảm xúc ấm |
| **B** (top-right) | Sky | `#6AB8E8` | Tin cậy, calm |
| **C** (bottom-left) | Gold | `#E8C76A` | Năng lượng, joy |
| **D** (bottom-right) | Sage | `#7AB87A` | Bình an, growth |

**Quy tắc apply:**
- Vị trí **luôn cố định** — A top-left, B top-right, C bottom-left, D bottom-right
- Khi shuffle đáp án (chống cheat) → shuffle **content** chứ không shuffle **vị trí màu**
- True/False questions: chỉ 2 đáp án → A (Coral) + B (Sage) — bỏ Sky + Gold

**Apply cho:**
- ✅ Practice mode
- ✅ Ranked mode
- ✅ Daily Challenge
- ✅ Multiplayer (Speed Race / Battle Royale / Team vs Team / Sudden Death)
- ✅ Variety modes (Mystery, Speed Round, Weekly Themed)

---

## 🔴 P0 — Critical UX Issues

### QZ-P0-1: Answer Color Mapping chưa implement
**Severity:** Critical · **Type:** UX · **Effort:** 2-3h

**Triệu chứng:**
4 cards đáp án (A/B/C/D) **cùng background xám** (`surface-container-highest`), cùng style, cùng letter box style. Khác biệt duy nhất là chữ cái và content text.

**Vấn đề:**
- Mất 1-2s đọc text trước khi tap (vs muscle memory color)
- Không có "ngôn ngữ chung" cho group play
- Speed Race timer 15s → mất 1s = -6% accuracy
- True/False questions không phân biệt được "Đúng" vs "Sai" về visual

**Fix:**

**1. Thêm 4 color tokens vào Tailwind:**
```js
// apps/web/tailwind.config.js — theme.extend.colors
answer: {
  a: '#E8826A',  // Coral
  b: '#6AB8E8',  // Sky
  c: '#E8C76A',  // Gold (warmer than primary gold)
  d: '#7AB87A',  // Sage
}
```

**2. Update AnswerButton component:**
```tsx
// apps/web/src/components/quiz/AnswerButton.tsx
const ANSWER_COLORS = ['answer-a', 'answer-b', 'answer-c', 'answer-d'] as const;

interface Props {
  index: 0 | 1 | 2 | 3;
  letter: 'A' | 'B' | 'C' | 'D';
  text: string;
  state: 'default' | 'selected' | 'correct' | 'wrong' | 'disabled';
  onClick: () => void;
}

function AnswerButton({ index, letter, text, state, onClick }: Props) {
  const color = ANSWER_COLORS[index];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg transition-all',
        'border bg-opacity-10 hover:bg-opacity-20',
        // Default state
        state === 'default' && `border-${color}/30 bg-${color}/8 hover:bg-${color}/15`,
        // Selected (waiting for reveal)
        state === 'selected' && `border-${color} bg-${color}/20 ring-2 ring-${color}/40`,
        // Correct reveal
        state === 'correct' && `border-success bg-success/20 ring-2 ring-success/50`,
        // Wrong reveal
        state === 'wrong' && `border-error bg-error/15 opacity-60`,
        // Disabled (after answer, not chosen)
        state === 'disabled' && `border-${color}/15 bg-${color}/5 opacity-40`,
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-md flex items-center justify-center font-medium',
        `bg-${color}/20 text-${color}`,
      )}>
        {letter}
      </div>
      <span className="text-on-surface text-left">{text}</span>
    </button>
  );
}
```

**3. True/False handling:**
Khi `questionType === 'true_false'`:
- Đáp án "Đúng" → vị trí A → color Coral
- Đáp án "Sai" → vị trí B → color Sky
- Bỏ vị trí C + D (chỉ render 2 buttons)

**4. Mobile parity:**
Sync `apps/mobile/src/screens/quiz/QuizScreen.tsx` với cùng pattern. Tokens cũng cần sync vào `apps/mobile/src/theme/colors.ts`.

**Files affected:**
- `apps/web/tailwind.config.js` (add 4 tokens)
- `apps/web/src/theme/colors.ts` hoặc `tokens.ts` (nếu có)
- `apps/web/src/components/quiz/AnswerButton.tsx` (component chính)
- `apps/web/src/pages/Quiz.tsx` (use new component)
- `apps/web/src/pages/RoomQuiz.tsx` (multiplayer variant)
- `apps/mobile/src/theme/colors.ts` (sync)
- `apps/mobile/src/screens/quiz/QuizScreen.tsx` (mobile)
- `apps/web/docs/designs/DESIGN_TOKENS.md` (cập nhật spec)

**Acceptance:**
- [ ] 4 đáp án có 4 màu khác biệt rõ
- [ ] Vị trí cố định (A top-left, không bao giờ đổi)
- [ ] States: default / selected / correct / wrong / disabled khác biệt visual
- [ ] True/False render 2 buttons (Coral + Sage)
- [ ] Web ↔ Mobile parity
- [ ] WCAG AA contrast cho text trên mỗi color
- [ ] Test với colorblind simulator (deuteranopia, protanopia)
- [ ] Screen reader đọc đúng letter + text
- [ ] Commit: `feat(quiz): Answer Color Mapping cho A/B/C/D (QZ-P0-1)`

---

### QZ-P0-2: Câu hỏi text bị break xấu
**Severity:** Critical · **Type:** Typography · **Effort:** 30min

**Triệu chứng:**
Câu hỏi "Theo Sáng 35:16-20, Ra-chên qua đời ở đâu khi đang sinh con trai cuối cùng (Bên-gia-min)?" bị break:

```
Theo Sáng 35:16-20, Ra-chên qua đời ở
đâu khi đang sinh con trai cuối cùng (Bên-
gia-min)?
```

**Vấn đề:**
- "Bên-gia-min" bị tách giữa: "Bên-" / "gia-min)" — reading flow bị cắt nghiêm trọng
- Tên riêng người trong Kinh Thánh phải atomic
- "ở đâu" tách dòng — mất nhịp đọc

**Fix:**

**1. CSS modern text-wrap:**
```css
.question-text {
  text-wrap: pretty;  /* Hoặc 'balance' cho line balance đẹp */
  hyphens: manual;     /* Disable auto-hyphenation */
}
```

**2. Wrap proper nouns trong span nowrap:**
Backend hoặc frontend pre-process text để wrap tên riêng:
```tsx
// Util function
function wrapProperNouns(text: string): React.ReactNode[] {
  // Vietnamese Bible name pattern: chữ hoa + có dấu "-"
  const PROPER_NOUN_REGEX = /([A-ZĐÁẢÀẠÃÉẾỀỂỄỆÌÍỊỈĨÒÓỎỌÕÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦỤŨƯỪỨỬỮỰỲÝỶỴỸ][a-zđáảàạãéẽẻẹèêếềểễệìíịỉĩòóỏọõôồốổỗộơờớởỡợùúủụũưừứửữựỳýỷỵỹ]+(?:-[A-ZĐa-zđ\u00C0-\u017F]+)+)/g;

  return text.split(PROPER_NOUN_REGEX).map((part, i) => {
    if (i % 2 === 1) {
      return <span key={i} className="whitespace-nowrap">{part}</span>;
    }
    return part;
  });
}
```

Áp dụng:
```tsx
<h2 className="question-text">{wrapProperNouns(question.content)}</h2>
```

**3. Container max-width:**
```tsx
<div className="max-w-[600px] mx-auto">
  {/* question */}
</div>
```

Tránh text quá rộng khó đọc trên desktop wide.

**4. Dynamic font size cho câu dài:**
```tsx
const fontSize = question.content.length > 120 ? 'text-2xl' : 'text-3xl';
```

**Files affected:**
- `apps/web/src/components/quiz/QuestionDisplay.tsx`
- `apps/web/src/utils/textHelpers.ts` (new — wrapProperNouns)
- `apps/web/src/global.css` (text-wrap CSS)
- Mobile equivalent

**Acceptance:**
- [ ] Tên riêng (Bên-gia-min, Ra-chên, Ép-ra-ta...) không bao giờ break giữa
- [ ] Verse reference (35:16-20) không break giữa số
- [ ] Câu hỏi dài < 80 ký tự dùng font 32px
- [ ] Câu hỏi 80-150 ký tự dùng font 26-28px
- [ ] Câu hỏi > 150 ký tự dùng font 22-24px
- [ ] Test với 10 câu hỏi sample (ngắn, vừa, dài, có dấu, có ngoặc)
- [ ] Mobile responsive

---

### QZ-P0-3: Timer thiếu visual urgency states
**Severity:** Critical · **Type:** UX · **Effort:** 2h

**Triệu chứng:**
Timer hiện "27" giây trong vòng tròn gold. Nhưng:
- **Không thấy progress ring** giảm dần (chỉ số, không thấy ring fill animate)
- Khi xuống 5s, 3s → không có color change visible trong screenshot
- Không có sound + haptic feedback theo SPEC_USER_v3 mục 8

**Fix:**

**1. SVG circle countdown ring:**
```tsx
// apps/web/src/components/quiz/CircularTimer.tsx
function CircularTimer({ secondsLeft, totalSeconds }: Props) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / totalSeconds;
  const offset = circumference * (1 - progress);

  // Color states
  const getColor = (s: number) => {
    if (s > 10) return '#e8a832';  // gold
    if (s > 5) return '#eab308';   // yellow
    if (s > 3) return '#ff8c42';   // orange
    return '#ef4444';              // red
  };

  const color = getColor(secondsLeft);

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        {/* Track */}
        <circle
          cx="32" cy="32" r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress */}
        <circle
          cx="32" cy="32" r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-1000 linear',
            secondsLeft <= 3 && 'animate-pulse',
          )}
        />
      </svg>
      <div className={cn(
        'absolute inset-0 flex items-center justify-center font-medium',
        secondsLeft > 5 ? 'text-xl' : 'text-2xl',
      )} style={{ color }}>
        {secondsLeft}
      </div>
    </div>
  );
}
```

**2. Sound + haptic feedback:**
```tsx
useEffect(() => {
  if (secondsLeft === 5) {
    soundManager.play('timerWarning');
    haptics.warning();
  }
  if (secondsLeft === 3) {
    soundManager.play('timerCritical');
    haptics.critical();
  }
  if (secondsLeft <= 3 && secondsLeft > 0) {
    soundManager.play('timerTick');
  }
}, [secondsLeft]);
```

**3. Container animation khi <3s:**
```tsx
<div className={cn(
  'quiz-container',
  secondsLeft <= 3 && 'animate-screen-flash-red',
)}>
```

CSS:
```css
@keyframes screen-flash-red {
  0%, 100% { background: var(--color-background); }
  50% { background: rgba(239, 68, 68, 0.05); }
}
```

**Files affected:**
- `apps/web/src/components/quiz/CircularTimer.tsx` (rewrite)
- `apps/web/src/services/soundManager.ts` (đã có theo TODO.md SF-1)
- `apps/web/src/utils/haptics.ts` (đã có SF-2)
- `apps/web/src/global.css` (add flash animation)
- Mobile equivalent

**Acceptance:**
- [ ] Ring giảm dần smooth theo thời gian (transition 1s linear)
- [ ] 4 color states: gold (>10s) → yellow (10-5s) → orange (5-3s) → red (<3s)
- [ ] Pulse animation khi <3s
- [ ] Sound effects: warning (5s), critical (3s), tick (last 3s)
- [ ] Haptic feedback (mobile)
- [ ] Screen flash subtle khi <3s
- [ ] Test với 30s, 20s, 15s, 10s timer durations

---

## 🟠 P1 — UX Issues

### QZ-P1-1: Letter labels A/B/C/D quá dominant
**Severity:** Medium · **Type:** Visual hierarchy · **Effort:** 30min

**Triệu chứng:**
Letter box A/B/C/D chiếm chỗ ~50px vuông với font lớn gold. Trong khi content text bên cạnh ~16-18px → letter dominant hơn content.

**Vấn đề:**
- User read order: letter (A) → content — letter không có meaning, chỉ là reference
- Đáng lẽ content nổi bật hơn letter

**Fix:**
- Letter box giảm size: 48px → 36px
- Letter font giảm: 24px → 18px
- Hoặc dùng letter outline thay filled
- Letter color giữ tier color (tăng contrast với content trắng)

Sau khi apply Answer Color Mapping (QZ-P0-1), letter sẽ là tint của color → vẫn rõ nhưng không lấn át content.

**Acceptance:**
- [ ] Content text nổi bật hơn letter label
- [ ] Letter vẫn đủ rõ để reference

---

### QZ-P1-2: Energy display ambiguous (số "0" cạnh lightning)
**Severity:** Medium · **Type:** Copy · **Effort:** 15min

**Triệu chứng:**
Top right hiện 5 bars gold + lightning icon ⚡ + số "0".

**Vấn đề:**
- 5 bars = 100 energy current?
- "0" = năng lượng vừa mất hay XP gained?
- Không có context

**Fix:**

**Option A:** Số "0" = XP gained turn này
```
⚡ +0 XP        ← lightning + XP gained
[━━━━━] 100/100 ← energy bars + count
```

**Option B:** Tách biệt energy + XP
```
NĂNG LƯỢNG       ĐIỂM HÔM NAY
[━━━━━] 100      0
```

**Recommend Option A** — compact, dùng được trong header.

**Acceptance:**
- [ ] User scan 1s biết energy = X, XP = Y
- [ ] Không nhầm 2 metrics

---

### QZ-P1-3: Combo "x0" hiển thị awkward
**Severity:** Medium · **Type:** UX · **Effort:** 15min

**Triệu chứng:**
"COMBO CHUỖI ★ x0" hiển thị từ câu đầu khi user chưa có combo.

**Vấn đề:**
- "x0" không có nghĩa (không phải multiplier)
- Hiển thị empty state không cần thiết

**Fix:**
- Combo = 0 (chưa có): **ẩn widget** hoàn toàn
- Combo = 1: hiện "Bắt đầu combo!" subtle
- Combo ≥ 2: hiện "x2", "x3" + animation pulse
- Combo ≥ 5: special celebration (sound + haptic)

**Acceptance:**
- [ ] Không hiện "x0" cho user mới
- [ ] Combo xuất hiện smooth khi đạt 2+
- [ ] Animation tier-based (x5 > x3 > x2)

---

### QZ-P1-4: Verse reference + tên riêng không có visual hint
**Severity:** Medium · **Type:** Typography · **Effort:** 30min

**Triệu chứng:**
Câu hỏi có nhiều info quan trọng:
- "Theo Sáng 35:16-20" — verse reference
- "(Bên-gia-min)" — gợi ý tên người

Nhưng tất cả render plain text, không highlight.

**Fix:**

**Verse reference:**
```tsx
<span className="text-secondary font-medium">Sáng 35:16-20</span>
```

**Tên người trong ngoặc:**
```tsx
<em className="text-on-surface/80">(Bên-gia-min)</em>
```

Backend nên tag những elements này trong question text (vd `<verse>Sáng 35:16-20</verse>` markup) để frontend parse + style.

**Acceptance:**
- [ ] Verse reference highlight subtle (color tier secondary)
- [ ] Tên riêng italic
- [ ] Số trong câu (35:16-20) bold
- [ ] Reading hierarchy rõ

---

## 🟡 P2 — Improvements

### QZ-P2-1: Progress bar 1/10 quá mảnh + thiếu milestone celebration
**Severity:** Low · **Type:** Polish · **Effort:** 30min

**Triệu chứng:**
Top progress bar 1/10 = 10% width gold rất nhỏ. Bar mảnh, không có visual khi đạt milestone.

**Fix:**
- Bar dày hơn: 3px → 5px
- Milestone flash khi đạt 25%, 50%, 75%, 100%
- Số "1/10" có thể dùng dạng "câu 1 / 10" rõ hơn

**Acceptance:**
- [ ] Progress bar visible hơn
- [ ] Milestone celebrate (gentle flash + sound)

---

### QZ-P2-2: "Gợi ý (0)" copy unclear
**Severity:** Low · **Type:** Copy · **Effort:** 15min

**Triệu chứng:**
Footer "💡 GỢI Ý (0)" — số 0 trong ngoặc gây nhầm.

**Fix:**

| Trạng thái | Copy | Visual |
|---|---|---|
| Disabled (Daily/Multiplayer) | "💡 Không có gợi ý" | Dim, tooltip giải thích |
| Available, free | "💡 Gợi ý" | Normal |
| Available, costs energy | "💡 Gợi ý — 10⚡" | Show cost |
| Already used | "💡 Đã dùng" | Dim |

**Acceptance:**
- [ ] Copy rõ purpose của hint
- [ ] Cost nếu có hiện rõ

---

### QZ-P2-3: "Bỏ qua" button không có confirmation lần đầu
**Severity:** Low · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
Button "BỎ QUA" → user có thể skip ngay không hỏi.

**Vấn đề:**
- Lần đầu skip: user không biết hậu quả (combo break? energy cost?)
- Sau khi skip không revert được

**Fix:**
Lần đầu user tap "Bỏ qua":
```
┌────────────────────────────┐
│ Bỏ qua câu này sẽ:         │
│ ❌ Phá vỡ combo hiện tại    │
│ ⚡ Không tốn năng lượng    │
│ 📊 Không tính accuracy     │
│                            │
│ ☐ Không hỏi lại            │
│                            │
│ [Quay lại]  [Bỏ qua]       │
└────────────────────────────┘
```

Lưu flag `hasConfirmedSkipRules` trong storage. Sau lần đầu → skip ngay.

**Acceptance:**
- [ ] Lần đầu skip → modal confirm
- [ ] User check "Không hỏi lại" → flag saved
- [ ] Subsequent skips không hỏi

---

### QZ-P2-4: Background flat — thiếu depth
**Severity:** Very Low · **Type:** Visual · **Effort:** 30min (optional)

**Triệu chứng:**
Background uniform `#11131e`. Không có gradient, không depth.

**Fix (optional):**
- Subtle radial gradient từ center (lighter) ra rìa (darker) → focus mắt
- Hoặc subtle pattern (cross/dove icons opacity 2%) Bible-themed
- Hoặc giữ flat (Sacred Modernist purity)

**Recommend:** Radial gradient subtle, tăng focus.

```css
.quiz-screen {
  background: radial-gradient(
    ellipse at center,
    rgba(50, 52, 64, 0.3) 0%,
    rgba(17, 19, 30, 1) 70%
  );
}
```

**Acceptance:**
- [ ] Không phá Sacred Modernist tone
- [ ] Focus mắt vào câu hỏi tự nhiên hơn

---

## 🟢 P3 — Nice to have

### QZ-P3-1: Thiếu accuracy tracker trong session
**Severity:** Very Low · **Type:** Missing · **Effort:** 1h

**Triệu chứng:**
Top stats không hiện "X correct / Y attempted" trong session. User chỉ thấy 1/10 (current position) nhưng không biết accuracy.

**Fix:**
Top stats thêm sau câu đầu tiên:
```
✓ 5 đúng / 7 đã trả lời (71%)
```

Hoặc tooltip on progress bar hover.

**Acceptance:**
- [ ] Accuracy real-time visible
- [ ] Không lấn át timer (less prominent)

---

### QZ-P3-2: Bookmark button thiếu trên Quiz screen
**Severity:** Very Low · **Type:** Missing feature · **Effort:** 30min

**Triệu chứng:**
SPEC_USER_v3 mục 4.5: "[🔖 Đánh dấu ôn lại]" trong reveal panel sau khi answer. Nhưng bookmark button có thể nên xuất hiện **trước khi answer** để bookmark câu khó (đã thấy nhưng chưa biết đáp).

**Fix:**
- Top right corner Quiz screen: 🔖 icon
- Tap → bookmark câu hiện tại
- Toast: "Đã đánh dấu ôn lại"
- API: `POST /api/me/bookmarks { questionId }`

**Acceptance:**
- [ ] Bookmark icon visible mọi lúc
- [ ] Tap state visual rõ (filled vs outline)
- [ ] Confirmation toast subtle

---

## 📊 Tổng kết

| Severity | Count | Total effort |
|---|---|---|
| 🔴 P0 (critical) | 3 | 5-6h |
| 🟠 P1 (UX) | 4 | 1.5-2h |
| 🟡 P2 (improve) | 4 | 2-3h |
| 🟢 P3 (polish) | 2 | 1.5h |
| **Total** | **13** | **~10-13h** |

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — Critical UX [5-6h]
1. **QZ-P0-1** — Answer Color Mapping (2-3h, lớn nhất, impact cao nhất)
2. **QZ-P0-2** — Câu hỏi text wrap fix (30min, nhanh + impact rõ)
3. **QZ-P0-3** — Timer ring + urgency states (2h, gameplay critical)

### Sprint 2 — Quick wins [2h]
4. **QZ-P1-1** — Letter labels giảm dominant (30min) — sau Sprint 1
5. **QZ-P1-2** — Energy display rõ (15min)
6. **QZ-P1-3** — Combo hide khi 0 (15min)
7. **QZ-P1-4** — Verse reference highlight (30min)

### Sprint 3 — Polish [3h]
8. **QZ-P2-1** — Progress bar milestone (30min)
9. **QZ-P2-2** — Hint button copy (15min)
10. **QZ-P2-3** — Skip confirm modal (1h)
11. **QZ-P2-4** — Background gradient (30min, optional)

### Backlog
12. P3 (accuracy tracker, bookmark) — defer

---

## 🔗 Related artifacts

- `BUG_REPORT_HOME_POST_IMPL.md` — bug report Home
- `BUG_REPORT_LEADERBOARD.md` — bug report Leaderboard
- `BUG_REPORT_RANKED.md` — bug report Ranked
- `docs/COLOR_AUDIT.md` — color audit
- `PROMPT_COLOR_FIXES.md` — color fixes 5 tasks
- `apps/web/docs/designs/DESIGN_TOKENS.md` — Game Mode Accent palette (4 colors used)
- `SPEC_USER_v3.md` mục 4.5 (wrong answer explanations), mục 8 (sound + haptics)

---

## 🤔 Questions cần Bui quyết

1. **Energy display** (QZ-P1-2): Option A (compact, ⚡ + bars) hay Option B (tách 2 widgets)?
2. **Background gradient** (QZ-P2-4): radial subtle hay giữ flat?
3. **Bookmark position** (QZ-P3-2): top right corner Quiz screen hay chỉ trong reveal panel?
4. **Sprint order**: làm Sprint 1 ngay hay đợi xong PROMPT_COLOR_FIXES (sync tier colors trước)?

---

## 📝 Cross-references với các bug reports khác

Issues tương đồng giữa Quiz và các trang khác:
| Issue | Quiz | Other reports |
|---|---|---|
| Color tokens missing | QZ-P0-1 | COLOR_AUDIT, COLOR_FIXES |
| Mobile parity | QZ-P0-1 | All reports |
| Sound + haptic | QZ-P0-3 | TODO.md SF-1 SF-2 |

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
