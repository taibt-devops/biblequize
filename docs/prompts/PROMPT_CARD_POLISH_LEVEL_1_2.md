# Card Polish Level 1+2 — Texture, Depth, SVG Icons

**Decision**: Upgrade card visual polish từ minimalist → "decorated minimalism". Giữ structure hiện tại, thêm depth + warmth + premium icons.

**2 Levels:**
- **Level 1 — Texture & Depth**: Subtle gradients, inner highlights, ambient glows trên cards
- **Level 2 — Icon Upgrade**: Thay emoji bằng Lucide SVG icons với gold gradient styling

**KHÔNG làm trong PR này**: Bible-themed decorative elements (Level 3), animations cầu kỳ (Level 4) — defer v1.1.

**Cost ước tính**: 4-5 giờ. Mỗi step = 1 commit riêng.

**Lưu ý**: Đây là **visual polish**, không thay đổi logic/structure. Mỗi step phải verify visually không break layout.

---

## Step 0 — Verify trước khi code

Trả lời trong reply đầu tiên:

1. **Lucide icons trong project**:
   - Đã có `lucide-react` dependency chưa? Version nào?
   - Cách import hiện tại: `import { Icon } from 'lucide-react'`?
   - Existing components dùng emoji icons → list ra để biết scope

2. **CSS approach**:
   - Project dùng Tailwind utilities hay styled-components?
   - Custom CSS classes cho cards ở đâu? (likely Tailwind config + inline classes)
   - Có CSS variables cho colors không? (vd `--gold-primary`, `--card-bg`)

3. **Emoji audit**:
   - Liệt kê tất cả emoji trong cards (Featured Daily, Practice, Ranked, 6 secondary cards)
   - Group nào core (Practice, Ranked) cần SVG, group nào secondary có thể giữ emoji

4. **Performance baseline**:
   - Build size hiện tại?
   - Lucide tree-shaking work chưa? (chỉ import icons cần thiết, không bundle full library)

KHÔNG bắt đầu Step 1 cho đến khi có findings.

---

## Step 1 — Level 1: Texture & Depth cho Featured cards

### Mục tiêu

Featured Daily Challenge banner + Practice/Ranked core cards trông "warm" và có "depth", không còn flat.

### Featured Daily Challenge banner

**Trước**:
```css
background: rgba(40, 42, 52, 0.6);
border: 1px solid rgba(212, 175, 55, 0.2);
```

**Sau**:
```css
background: linear-gradient(
  135deg,
  rgba(45, 35, 20, 0.85) 0%,        /* warm dark */
  rgba(30, 28, 25, 0.7) 50%,
  rgba(40, 32, 18, 0.85) 100%       /* warm dark */
);
border: 1px solid rgba(212, 175, 55, 0.25);
box-shadow: 
  inset 0 1px 0 rgba(255, 220, 100, 0.08),    /* inner gold highlight top */
  0 8px 32px rgba(0, 0, 0, 0.4),              /* depth shadow */
  0 0 0 1px rgba(212, 175, 55, 0.05);         /* subtle gold halo */
position: relative;
overflow: hidden;
```

**Decorative ambient glow** (pseudo-element):
```css
.featured-daily::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -100px;
  width: 300px;
  height: 300px;
  background: radial-gradient(
    circle,
    rgba(212, 175, 55, 0.08) 0%,
    transparent 60%
  );
  pointer-events: none;
}
```

**Hiệu quả**: Banner có warm gold ambient → match Bible study mood (candlelight, ancient scroll feeling).

### Practice featured card

```css
.featured-card-practice {
  background: linear-gradient(
    135deg,
    rgba(35, 32, 28, 0.85) 0%,         /* warm brown-gold */
    rgba(28, 26, 24, 0.7) 100%
  );
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow: 
    inset 0 1px 0 rgba(255, 240, 200, 0.05),
    0 4px 24px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

/* Subtle warm glow ở góc trên-trái */
.featured-card-practice::before {
  content: '';
  position: absolute;
  top: -60px;
  left: -60px;
  width: 200px;
  height: 200px;
  background: radial-gradient(
    circle,
    rgba(212, 175, 55, 0.06) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.featured-card-practice:hover {
  border-color: rgba(212, 175, 55, 0.35);
  transform: translateY(-2px);
  transition: all 0.3s ease;
}
```

### Ranked featured card

```css
.featured-card-ranked {
  background: linear-gradient(
    135deg,
    rgba(40, 30, 25, 0.85) 0%,         /* slightly warmer than Practice */
    rgba(30, 25, 22, 0.7) 100%
  );
  border: 1px solid rgba(212, 175, 55, 0.25);  /* slightly stronger border */
  box-shadow: 
    inset 0 1px 0 rgba(255, 240, 200, 0.06),
    0 4px 28px rgba(0, 0, 0, 0.35),
    0 0 24px rgba(212, 175, 55, 0.04);          /* subtle outer glow */
  position: relative;
  overflow: hidden;
}

/* Achievement-themed glow ở góc trên-phải */
.featured-card-ranked::before {
  content: '';
  position: absolute;
  top: -80px;
  right: -80px;
  width: 240px;
  height: 240px;
  background: radial-gradient(
    circle,
    rgba(212, 175, 55, 0.1) 0%,
    transparent 65%
  );
  pointer-events: none;
}

.featured-card-ranked:hover {
  border-color: rgba(212, 175, 55, 0.45);
  transform: translateY(-2px);
  transition: all 0.3s ease;
}
```

**Khác biệt giữa Practice và Ranked**:
- Practice: warm gold cool (learning vibe)
- Ranked: warmer, slight glow stronger (achievement vibe)
- Ranked border opacity 0.25 vs Practice 0.18 → Ranked có presence mạnh hơn nhẹ

### Secondary cards (Light touch)

KHÔNG cần ambient glow phức tạp. Chỉ subtle gradient + hover:

```css
.compact-card {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 2px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.compact-card:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
  border-color: rgba(212, 175, 55, 0.25);
  transform: translateY(-1px);
}
```

### Implementation notes

- **Tailwind hay custom CSS?** Nếu dùng Tailwind, có thể dùng arbitrary values: `bg-[linear-gradient(135deg,...)]`. Hoặc tạo custom CSS class trong global.css. Đề xuất: Custom CSS class cho cards (sẽ dùng nhiều lần, dễ maintain).

- **CSS variables**: Add vào `globals.css` hoặc `theme/colors.css`:
  ```css
  :root {
    --card-warm-from: rgba(35, 32, 28, 0.85);
    --card-warm-to: rgba(28, 26, 24, 0.7);
    --gold-glow: rgba(212, 175, 55, 0.06);
    --gold-border-subtle: rgba(212, 175, 55, 0.18);
    --gold-border-medium: rgba(212, 175, 55, 0.25);
    --gold-border-strong: rgba(212, 175, 55, 0.35);
  }
  ```

### Acceptance criteria

- Featured Daily banner có warm gradient + ambient glow
- Practice card warm tone, subtle glow góc trên-trái
- Ranked card warm tone (warmer hơn Practice), glow góc trên-phải, slight outer glow
- Secondary cards có subtle gradient + hover effect
- KHÔNG có visual glitches (overflow, broken layout)
- KHÔNG add background patterns/images (đã bỏ ở step trước, không reintroduce)
- Mobile responsive vẫn OK

### Cost: 1.5-2h

### Commit
- `feat(home): texture + depth for featured cards (Level 1 polish)`

---

## Step 2 — Level 2: SVG Icons cho Featured cards

### Mục tiêu

Thay emoji icons bằng Lucide SVG icons với gold styling cho **Featured cards** (Daily banner, Practice, Ranked). Secondary cards có thể giữ emoji (acceptable cho compact size).

### Icon mapping

| Card | Emoji cũ | Lucide SVG mới | Size |
|---|---|---|---|
| Featured Daily | 📅 | `Calendar` hoặc `BookOpen` | 32px |
| Daily completed | ✅ | `CheckCircle2` | 28px |
| Practice featured | 📖 | `BookOpen` | 48px |
| Ranked featured | 🎯 | `Trophy` hoặc `Medal` | 48px |
| Ranked unlocked badge | ✓ | `BadgeCheck` | 20px |
| Ranked locked badge | 📖 | `Lock` (with subtle "open" feel) | 20px |

**Đề xuất cuối cho core cards**:
- Practice: `BookOpen` từ Lucide (clean, professional)
- Ranked: `Trophy` từ Lucide (achievement-themed)

### Icon styling — Gold gradient SVG

```tsx
import { BookOpen, Trophy, BadgeCheck } from 'lucide-react'

function GoldIcon({ Icon, size = 48 }: { Icon: LucideIcon; size?: number }) {
  return (
    <div className="relative inline-block">
      {/* Subtle gold glow behind icon */}
      <div 
        className="absolute inset-0 blur-xl opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)'
        }}
      />
      
      {/* Icon with gold gradient stroke */}
      <Icon 
        size={size}
        strokeWidth={1.5}
        className="relative"
        style={{
          stroke: 'url(#gold-gradient)',
        }}
      />
      
      {/* SVG gradient definition (only need once per page) */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f4d36e" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#b8941f" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
```

### Usage trong Featured cards

**Practice card**:
```tsx
<div className="featured-card-practice">
  <GoldIcon Icon={BookOpen} size={48} />
  <h2>LUYỆN TẬP</h2>
  <p>Học không áp lực, không giới hạn thời gian.</p>
  <button className="gold-cta">▶ Bắt đầu</button>
</div>
```

**Ranked card** (state-based icons):
```tsx
<div className="featured-card-ranked">
  <GoldIcon Icon={Trophy} size={48} />
  <h2>THI ĐẤU RANKED</h2>
  <p>Tranh tài trực tiếp, kiếm điểm rank lớn.</p>
  
  {basicQuizPassed ? (
    <>
      <div className="status-badge">
        <BadgeCheck size={20} stroke="#d4af37" />
        <span>Đã mở khóa</span>
      </div>
      <div className="energy-display">
        <ZapIcon size={16} />
        <span>100/100 năng lượng</span>
      </div>
      <button className="gold-cta">▶ Bắt đầu Ranked</button>
    </>
  ) : (
    <>
      <div className="locked-hint">
        <BookIcon size={20} stroke="#d4af37" />
        <span>Cần hoàn thành Bài Giáo Lý (10 câu)</span>
      </div>
      <button className="gold-cta">▶ Làm bài giáo lý ngay</button>
      <p className="hint-time">⏱ Chỉ mất 5 phút</p>
    </>
  )}
</div>
```

### Featured Daily banner icons

```tsx
<div className="featured-daily">
  <div className="header-row">
    <Calendar size={28} stroke="#d4af37" />
    <span className="label">THỬ THÁCH HÔM NAY</span>
  </div>
  
  <h1>🌍 Hành trình qua 5 sách</h1>
  {/* Vẫn giữ 🌍 emoji ở đây vì là decorative, không phải icon UI */}
  
  <p className="books">A-mốt • 2 Giăng • Ê-sai • 1 Cô-rinh-tô • Châm Ngôn</p>
  <p className="meta">5 câu • 5 phút • +50 XP</p>
  
  <div className="countdown">
    <Clock size={16} stroke="#d4af37" opacity={0.7} />
    <span>Thử thách mới sau 19:30:38</span>
  </div>
  
  <button className="gold-cta-big">
    <Play size={20} fill="currentColor" />
    BẮT ĐẦU HÔM NAY
  </button>
</div>
```

### Daily completed state

```tsx
<div className="featured-daily-completed">
  <div className="header-row">
    <CheckCircle2 size={28} stroke="#22c55e" /> {/* green for completion */}
    <span className="label">ĐÃ HOÀN THÀNH HÔM NAY</span>
  </div>
  
  <h1>🎉 Bạn đúng 4/5 câu hôm nay!</h1>
  <p className="theme-label">Hôm nay: Hành trình qua 5 sách</p>
  <p className="xp-earned">+50 XP đã nhận</p>
  
  <div className="countdown">
    <Clock size={16} stroke="#d4af37" opacity={0.7} />
    <span>Thử thách mới sau 19:30:38</span>
  </div>
  
  <button className="outline-cta">
    <BookIcon size={18} />
    Xem lại bài làm
  </button>
</div>
```

### Secondary cards (giữ emoji)

KHÔNG đổi emoji của 6 secondary cards. Lý do:
- Compact size 100px → emoji 24-28px là đủ presence
- Mỗi card có color accent khác (Mystery hồng, Speed cam) → emoji + color = visual variety
- Cost lớn (6 cards × time để chọn icon) cho ROI thấp

Giữ:
- Group: 👥 (hoặc Lucide `Users` nếu muốn consistency)
- Multiplayer: 🎮
- Tournament: 🏆
- Weekly: 📅 hoặc 🗓️ (đổi để tránh trùng Daily)
- Mystery: 🎲
- Speed: ⚡

**Đề xuất cuối**: Giữ emoji tất cả secondary cards. Chỉ Featured cards dùng SVG.

### Performance check

- Lucide tree-shaking: chỉ import icons cần thiết
- Bundle size impact: ~5-10KB (chấp nhận được)
- Verify build size không tăng > 20KB

### Acceptance criteria

- Featured Daily banner: SVG `Calendar`, `Clock`, `Play`, `CheckCircle2` icons với gold gradient stroke
- Practice card: SVG `BookOpen` icon 48px gold gradient
- Ranked card: SVG `Trophy` icon 48px gold gradient + state-based small icons
- Secondary cards: giữ emoji
- Build size không tăng đáng kể (< 20KB)
- KHÔNG có icon broken hoặc misalignment

### Cost: 2-2.5h

### Commit
- `feat(home): SVG icons with gold gradient for featured cards (Level 2 polish)`

---

## Step 3 — Hover & Interaction polish

### Mục tiêu

Featured cards có hover effect smooth, professional. Không cầu kỳ, chỉ subtle elevation + glow enhance.

### CSS

```css
.featured-card-practice,
.featured-card-ranked {
  transition: 
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  cursor: pointer;
}

.featured-card-practice:hover,
.featured-card-ranked:hover {
  transform: translateY(-3px);
  box-shadow: 
    inset 0 1px 0 rgba(255, 240, 200, 0.08),
    0 8px 36px rgba(0, 0, 0, 0.4),
    0 0 32px rgba(212, 175, 55, 0.08);
}

/* Icon subtle scale on card hover */
.featured-card-practice:hover .gold-icon,
.featured-card-ranked:hover .gold-icon {
  transform: scale(1.05);
  transition: transform 0.3s ease;
}

/* CTA button hover - keep gold gradient */
.gold-cta:hover {
  background: linear-gradient(
    90deg,
    #f4d36e 0%,
    #ffe080 50%,
    #f4d36e 100%
  );
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
}
```

### Compact cards hover

```css
.compact-card {
  transition: all 0.2s ease;
}

.compact-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 55, 0.3);
  background: rgba(255, 255, 255, 0.05);
}
```

### Acceptance criteria

- Hover effects smooth, không jarring
- Không lag trên low-end devices
- Mobile: hover states không apply (touch only)
- Click feedback rõ ràng (active state)

### Cost: 30-45 phút

### Commit
- `feat(home): hover & interaction polish for cards`

---

## Step 4 — Verify visual quality + responsive

### Manual visual review

Sau khi xong Step 1-3, screenshot Home và verify:

**Desktop view**:
- [ ] Featured Daily banner có warm glow rõ ràng
- [ ] Practice + Ranked cards có depth, không còn flat
- [ ] SVG icons crisp, gold gradient render đúng
- [ ] Hover states smooth
- [ ] Visual hierarchy: Daily > Practice/Ranked > Secondary vẫn đúng

**Mobile view (< 768px)**:
- [ ] Cards stack vertical đúng
- [ ] Icons không bị stretch/distort
- [ ] Glow effects không cause horizontal overflow
- [ ] Touch targets >= 44px

**Tablet view (768-1023px)**:
- [ ] Layout transition smooth
- [ ] Practice + Ranked side-by-side OK

**Performance check**:
- [ ] Lighthouse Performance score >= 85
- [ ] No layout shift (CLS = 0)
- [ ] Initial paint nhanh

### Cost: 30 phút

### Commit
- `chore: visual QA after card polish Level 1+2`

---

## Step 5 — Full regression

### Checklist

- [ ] `npm run build` pass (0 errors)
- [ ] FE tests pass
- [ ] No console errors
- [ ] Manual smoke test all flows
- [ ] Bundle size acceptable (< 5% increase)
- [ ] Lighthouse score không giảm đáng kể

### Commit
- `chore: regression after card polish`

---

## Workflow Order

```
Step 0: Verify              — KHÔNG commit
Step 1: Texture & Depth     — 1 commit
Step 2: SVG Icons           — 1 commit
Step 3: Hover & Interaction — 1 commit
Step 4: Visual QA           — 1 commit
Step 5: Regression          — 1 commit
```

5 commits, mỗi commit revertable.

---

## Files dự kiến đụng tới

### Frontend
- **Sửa**:
  - `apps/web/src/components/FeaturedDailyChallenge.tsx`
  - `apps/web/src/components/FeaturedCard.tsx` (Practice + Ranked)
  - `apps/web/src/components/CompactCard.tsx` (subtle hover only)
  - `apps/web/src/styles/globals.css` (CSS variables + card classes)
  - `apps/web/src/components/icons/GoldIcon.tsx` (mới, helper component)

### Backend
- KHÔNG đổi

---

## Definition of Done

✅ Featured cards có warm gradient + depth + ambient glow  
✅ Featured cards có SVG icons gold gradient (KHÔNG còn emoji)  
✅ Hover effects smooth, professional  
✅ Practice card distinct với Ranked (cool warm vs achievement warm)  
✅ Daily banner có warm presence  
✅ Secondary cards có subtle gradient + hover (giữ emoji)  
✅ Bundle size tăng < 20KB  
✅ Mobile responsive OK  
✅ Performance không giảm đáng kể  
✅ Visual: cards "premium", không còn "minimalist cheap"  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên:

1. **Step 0 findings**: Lucide đã install? CSS approach (Tailwind/styled)? Emoji audit list?

2. **Icon choice cho Ranked**: 
   - `Trophy` (cup with handles)
   - `Medal` (round medal with ribbon)
   - `Award` (rosette style)
   - **Đề xuất**: Trophy — universal achievement icon, dễ recognize

3. **CSS variables location**: 
   - Add vào `globals.css` chung hay tạo file mới `theme/cards.css`?
   - **Đề xuất**: Add vào existing `globals.css` (ít file hơn, easier maintenance)

Sau khi confirm 3 câu → bắt đầu Step 1.

---

## Reminder cuối

- **Đây là VISUAL POLISH**, không phải structural change. KHÔNG đổi component structure, KHÔNG đổi logic.
- **"Decorated minimalism" balance**: Cards trông warm, có depth, nhưng KHÔNG cluttered.
- **Subtle is key**: Glow opacity 0.05-0.1, không 0.3-0.5. User cảm nhận được "warmth" mà không thấy "decorative noise".
- **Mobile first check**: Effects không được break mobile layout. Test mỗi step.
- **Performance ý thức**: Pseudo-elements + transitions OK, không add heavy SVG patterns.
- Mục tiêu: Cards trông "premium app" thay vì "MVP demo".
