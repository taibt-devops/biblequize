# Implement Home Design — Variation 3 (Stat Sheet)

**Decision**: Implement Home page theo design Variation 3 từ HTML design studio. V3 = "Sacred Modernist Gaming" — RPG-style hero stat sheet + warm gradient cards + ornamental verse dividers.

**Reference design file**: `docs/designs/home-design-studio.html`

**CRITICAL**: Đọc tất cả CSS classes prefix `.v3-*` trong file reference. Đó là source of truth cho design. KHÔNG suy diễn từ description — mở file ra đọc CSS thực tế.

**Cost ước tính**: 6-8 giờ. Mỗi step = 1 commit riêng để rollback dễ.

---

## V3 Design Summary

Đây là tóm tắt high-level. Detail CSS values lấy từ file HTML reference.

### Hero Stat Sheet
- Layout: Avatar (80px circular, gold ring) | Stats grid (3 columns: Streak/Điểm/Tier) + progress bar
- Background: `linear-gradient(135deg, rgba(45,35,20,0.85), rgba(28,25,22,0.7))`
- Border: 1px gold subtle
- Ambient glow: radial gold ở góc trên-phải
- Stat cells: vertical dividers giữa, label uppercase tracked, value 22px Sora bold

### Daily Verse Banner
- Centered text, italic serif (Crimson Pro)
- Ornamental dividers `━━ ✦ ━━` trên dưới
- Reference uppercase tracked gold

### Featured Daily Challenge
- Warm gold gradient background + ambient glow top-right
- Header với calendar icon + label uppercase
- Title 26px Sora bold, books list gold accent
- Meta + countdown
- CTA full-width gold gradient với hover transform

### Featured Cards (Practice + Ranked)
- Practice: warm gradient cooler, glow top-left
- Ranked: warmer gradient, glow top-right, slightly stronger border + outer glow
- Icon trong rounded box với subtle gold tint
- Title 22px Sora bold uppercase
- Hover: translateY(-3px) + border brighten

### Secondary Grid (6 cards 3x2)
- Subtle white tint background gradient
- Border subtle, hover: gold brighten + lift
- Compact (~100px height)
- Icon emoji + title + 4-word subtitle

### "Khám Phá Thêm" Divider
- Horizontal lines fading + center text uppercase tracked gold

---

## Step 0 — Verify trước khi code

Trả lời trong reply đầu tiên:

1. **Read reference file**:
   - Mở `apps/web/docs/designs/home-design-studio.html`
   - Confirm đã đọc tất cả `.v3-*` CSS classes
   - List ra những CSS values quan trọng (colors, gradients, shadows) sẽ port sang React

2. **Project conventions**:
   - CSS approach: Tailwind utilities, CSS modules, hay styled components?
   - Component structure: functional với hooks?
   - Existing fonts: project đã import Sora và Crimson Pro chưa? Nếu chưa, add vào đâu?

3. **Existing components**:
   - File path Hero hiện tại
   - File path FeaturedDailyChallenge hiện tại
   - File path GameModeGrid hiện tại
   - File path DailyVerse hiện tại

4. **Lucide icons**:
   - Đã install `lucide-react` chưa?
   - V3 design dùng emoji cho hầu hết icons (📖 🏆 👥 🎮 🏆 🗓️ 🎲 ⚡ 🌱)
   - Có muốn upgrade một số icons (📖 → BookOpen, 🏆 → Trophy) hay giữ emoji match V3?
   - **Đề xuất**: Giữ emoji exactly match V3. SVG icon upgrade defer v1.5.

KHÔNG bắt đầu Step 1 cho đến khi có findings.

---

## Step 1 — Setup design tokens + fonts

### 1.1 Import fonts

Nếu chưa import, add vào `apps/web/index.html` hoặc `globals.css`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;1,400;1,500&display=swap" rel="stylesheet">
```

### 1.2 CSS Variables

Add vào `apps/web/src/styles/globals.css`:

```css
:root {
  /* Backgrounds */
  --bg-deep: #0F1117;
  --bg-card-warm-from: rgba(45, 35, 20, 0.85);
  --bg-card-warm-to: rgba(28, 25, 22, 0.7);
  --bg-card-practice-from: rgba(35, 32, 28, 0.85);
  --bg-card-practice-to: rgba(28, 26, 24, 0.7);
  --bg-card-ranked-from: rgba(40, 30, 25, 0.85);
  --bg-card-ranked-to: rgba(30, 25, 22, 0.7);
  --bg-secondary-card-from: rgba(255, 255, 255, 0.04);
  --bg-secondary-card-to: rgba(255, 255, 255, 0.02);
  --bg-secondary-card-hover-from: rgba(255, 255, 255, 0.06);
  --bg-secondary-card-hover-to: rgba(255, 255, 255, 0.03);
  
  /* Gold palette */
  --gold-primary: #D4AF37;
  --gold-bright: #F4D36E;
  --gold-deep: #8B6914;
  --gold-gradient: linear-gradient(135deg, #F4D36E 0%, #D4AF37 50%, #8B6914 100%);
  
  /* Borders */
  --border-subtle: rgba(212, 175, 55, 0.18);
  --border-medium: rgba(212, 175, 55, 0.25);
  --border-strong: rgba(212, 175, 55, 0.4);
  --border-divider: rgba(212, 175, 55, 0.15);
  
  /* Glows */
  --glow-subtle: rgba(212, 175, 55, 0.06);
  --glow-medium: rgba(212, 175, 55, 0.08);
  --glow-strong: rgba(212, 175, 55, 0.1);
  
  /* Text */
  --text-primary: #F5F0E8;
  --text-muted: #A89F8E;
  --text-dim: #6B6358;
  --text-gold: #D4AF37;
  
  /* Inset highlights */
  --inset-highlight: inset 0 1px 0 rgba(255, 220, 100, 0.08);
  --inset-highlight-soft: inset 0 1px 0 rgba(255, 240, 200, 0.05);
  --inset-highlight-strong: inset 0 1px 0 rgba(255, 240, 200, 0.06);
  
  /* Shadows */
  --shadow-card-base: 0 4px 24px rgba(0, 0, 0, 0.3);
  --shadow-card-strong: 0 8px 32px rgba(0, 0, 0, 0.4);
  --shadow-ranked-glow: 0 0 24px rgba(212, 175, 55, 0.04);
}
```

### 1.3 Tailwind config (nếu dùng Tailwind)

Add custom utilities vào `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        serif: ['Crimson Pro', 'serif'],
      },
      colors: {
        gold: {
          primary: '#D4AF37',
          bright: '#F4D36E',
          deep: '#8B6914',
        },
      },
    },
  },
}
```

### Acceptance criteria

- Fonts loaded (verify trong DevTools Network tab)
- CSS variables accessible globally
- No build errors

### Cost: 30 phút

### Commit
- `feat(design): V3 design tokens + Sora + Crimson Pro fonts`

---

## Step 2 — Hero Stat Sheet

### Component: `apps/web/src/components/HeroStatSheet.tsx`

Reference HTML reference: classes `.v3-hero`, `.v3-avatar`, `.v3-content`, `.v3-greeting`, `.v3-tier-label`, `.v3-divider-line`, `.v3-stats-grid`, `.v3-stat-cell`, `.v3-stat-label`, `.v3-stat-value`, `.v3-progress-bar`, `.v3-progress-fill`, `.v3-progress-label`.

### Component skeleton

```tsx
import { useUser } from '@/hooks/useUser'
import { getTierFromPoints } from '@/data/tiers'
import { getTimeOfDayGreeting } from '@/utils/greeting'
import { getTierAvatarEmoji } from '@/utils/tierAvatar'

export function HeroStatSheet() {
  const { user } = useUser()
  if (!user) return <HeroStatSheetSkeleton />
  
  const tier = getTierFromPoints(user.totalPoints)
  const greeting = getTimeOfDayGreeting()
  const tierProgress = (user.totalPoints / tier.nextThreshold) * 100
  const remainingPoints = tier.nextThreshold - user.totalPoints
  const subTierStars = calculateSubTierStars(user.totalPoints, tier)
  
  return (
    <div className="hero-stat-sheet">
      {/* Avatar */}
      <div className="hero-avatar">
        {getTierAvatarEmoji(tier.level)}
      </div>
      
      {/* Content */}
      <div className="hero-content">
        <h1 className="hero-greeting">
          {greeting}, {user.name.toUpperCase()}!
        </h1>
        <div className="hero-tier-label">
          {tier.nameVi} • Tier {tier.level}
        </div>
        
        <div className="hero-divider-line" />
        
        {/* Stats grid */}
        <div className="hero-stats-grid">
          <StatCell 
            label="Streak"
            value={`${user.currentStreak} ngày`}
            isFire={user.currentStreak > 0}
          />
          <StatCell 
            label="Điểm"
            value={user.totalPoints.toLocaleString('vi-VN')}
          />
          <StatCell 
            label="Tier"
            value={tier.level.toString()}
          />
        </div>
        
        {/* Progress bar */}
        <div className="hero-progress-bar">
          <div 
            className="hero-progress-fill" 
            style={{ width: `${tierProgress}%` }}
          />
        </div>
        <div className="hero-progress-label">
          {renderStars(subTierStars)} &nbsp; 
          Còn {remainingPoints.toLocaleString('vi-VN')} điểm đến {tier.nextTierName}
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value, isFire = false }: StatCellProps) {
  return (
    <div className="hero-stat-cell">
      <div className="hero-stat-label">{label}</div>
      <div className={`hero-stat-value ${isFire ? 'fire' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function renderStars(filled: number) {
  return [...Array(5)].map((_, i) => i < filled ? '★' : '☆').join(' ')
}
```

### Helper functions

`apps/web/src/utils/greeting.ts`:
```typescript
export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}
```

`apps/web/src/utils/tierAvatar.ts`:
```typescript
export function getTierAvatarEmoji(tierLevel: number): string {
  const tierEmojis: Record<number, string> = {
    1: '🌱', // Tân Tín Hữu — seedling (growth start)
    2: '🌅', // Người Tìm Kiếm — dawn (seeking light)
    3: '🪔', // Ngọn Đèn — lamp (illuminated)
    4: '🔥', // Ngọn Lửa — flame (passionate)
    5: '⭐', // Ngôi Sao — star (shining bright)
    6: '👑', // Vinh Quang — crown (glorified)
  }
  return tierEmojis[tierLevel] || '🌱'
}
```

### CSS classes (port từ V3 reference)

Lấy exact từ file `home-design-studio.html` các classes `.v3-hero`, `.v3-avatar`, etc. và rename thành `.hero-stat-sheet`, `.hero-avatar`, etc. trong project.

**Quan trọng**: 
- Background gradient EXACT từ V3
- Ambient glow pseudo-element `::before` EXACT từ V3
- Avatar `box-shadow` với gold glow + inset
- Stats grid với vertical dividers giữa cells

### Tier 6 edge case

```tsx
{tier.level === 6 ? (
  <div className="hero-max-tier-message">
    👑 Bạn đã đạt tier cao nhất!
  </div>
) : (
  <>
    <div className="hero-progress-bar">...</div>
    <div className="hero-progress-label">...</div>
  </>
)}
```

### Mobile responsive

```css
@media (max-width: 640px) {
  .hero-stat-sheet {
    padding: 16px 18px;
    gap: 16px;
  }
  
  .hero-avatar {
    width: 60px;
    height: 60px;
    font-size: 28px;
  }
  
  .hero-greeting {
    font-size: 16px;
  }
  
  .hero-tier-label {
    font-size: 11px;
  }
  
  .hero-stat-label {
    font-size: 9px;
  }
  
  .hero-stat-value {
    font-size: 18px;
  }
}
```

### Acceptance criteria

- Hero render đúng layout 2 cột (avatar | content)
- 3 stat cells với vertical dividers
- Streak có fire color khi > 0
- Progress bar gold gradient với glow shadow
- Stars row hiển thị đúng sub-tier progress
- Tier 6: hide progress, show "Bạn đã đạt tier cao nhất!"
- Mobile responsive: avatar 60px, stats smaller
- Tests (5): render basic, fire streak, tier 6, mobile, stat values format

### Cost: 1.5-2h

### Commit
- `feat(home): HeroStatSheet component (V3 design)`

---

## Step 3 — Daily Verse Banner

### Component: `apps/web/src/components/DailyVerseBanner.tsx`

Reference: classes `.v3-verse`, `.v3-verse-divider`, `.v3-verse-divider-line`, `.v3-verse-divider-ornament`, `.v3-verse-text`, `.v3-verse-ref`.

### Component skeleton

```tsx
import { useDailyVerse } from '@/hooks/useDailyVerse'

export function DailyVerseBanner() {
  const verse = useDailyVerse() // Returns { text, reference }
  
  return (
    <div className="daily-verse">
      <VerseDivider />
      <p className="daily-verse-text">"{verse.text}"</p>
      <p className="daily-verse-ref">{verse.reference}</p>
      <VerseDivider />
    </div>
  )
}

function VerseDivider() {
  return (
    <div className="daily-verse-divider">
      <span className="daily-verse-divider-line" />
      <span className="daily-verse-divider-ornament">✦</span>
      <span className="daily-verse-divider-line right" />
    </div>
  )
}
```

### CSS (port từ V3)

Lấy exact từ V3 reference. Quan trọng:
- Italic Crimson Pro serif cho verse text
- Letter-spacing 2px cho reference uppercase
- Linear gradient cho divider lines (transparent → gold → transparent)
- Center alignment

### Mobile responsive

Divider lines ngắn hơn trên mobile:
```css
@media (max-width: 640px) {
  .daily-verse-divider-line {
    flex: 0 0 40px;
  }
  
  .daily-verse-text {
    font-size: 16px;
  }
}
```

### Acceptance criteria

- Verse centered text
- Ornamental dividers trên dưới với ✦
- Italic serif font cho verse
- Uppercase tracked reference gold
- Mobile: shorter dividers, smaller font
- Tests (3): render basic, mobile responsive, verse rotation work

### Cost: 30-45 phút

### Commit
- `feat(home): DailyVerseBanner with ornamental dividers (V3 design)`

---

## Step 4 — Featured Daily Challenge (V3 styling)

### File: `apps/web/src/components/FeaturedDailyChallenge.tsx`

Reference: classes `.v3-daily`, `.v3-daily-header`, `.v3-daily-icon`, `.v3-daily-label`, `.v3-daily-title`, `.v3-daily-books`, `.v3-daily-meta`, `.v3-daily-countdown`, `.v3-cta-big`.

### Visual specs (port từ V3)

- Background: warm gold gradient `linear-gradient(135deg, rgba(45,35,20,0.85), rgba(30,28,25,0.7))`
- Border: 1px medium gold
- Inset highlight + outer shadow
- Pseudo-element ambient glow top-right (300px radial)
- Header: calendar icon gold + uppercase label
- Title: 26px Sora bold (giữ emoji 🌍 nếu có)
- Books list: gold accent
- Meta + countdown muted text
- CTA: full-width gold gradient với hover translateY(-2px)

### State variants (giữ nguyên logic hiện tại)

- State A: Active (chưa làm hôm nay) - như V3
- State B: Completed - Update thêm V3 styling, giữ logic completed banner

### Acceptance criteria

- Background warm gradient + ambient glow
- Header với icon + label uppercase
- Title 26px Sora bold
- CTA gold gradient hover smooth
- 2 states render đúng

### Cost: 1-1.5h

### Commit
- `feat(home): FeaturedDailyChallenge V3 styling`

---

## Step 5 — Featured Cards (Practice + Ranked)

### File: `apps/web/src/components/FeaturedCard.tsx`

Reference: classes `.v3-card`, `.v3-card.ranked`, `.v3-card-content`, `.v3-card-icon-wrap`, `.v3-card-icon`, `.v3-card-title`, `.v3-card-desc`, `.v3-card-status`, `.v3-card-cta`.

### Component skeleton

```tsx
interface FeaturedCardProps {
  variant: 'practice' | 'ranked'
  onClick: () => void
  // ... other props for state
}

export function FeaturedCard({ variant, onClick, ...props }: FeaturedCardProps) {
  return (
    <div className={`featured-card featured-card-${variant}`} onClick={onClick}>
      <div className="featured-card-content">
        <div className="featured-card-icon-wrap">
          <span className="featured-card-icon">
            {variant === 'practice' ? '📖' : '🏆'}
          </span>
        </div>
        <h3 className="featured-card-title">
          {variant === 'practice' ? 'LUYỆN TẬP' : 'THI ĐẤU RANKED'}
        </h3>
        <p className="featured-card-desc">
          {variant === 'practice' 
            ? 'Học không áp lực, không giới hạn thời gian.' 
            : 'Tranh tài trực tiếp, kiếm điểm rank lớn.'}
        </p>
        
        {variant === 'ranked' ? (
          <RankedCardStatus {...props} />
        ) : (
          <div className="featured-card-status">Sẵn sàng thách thức?</div>
        )}
        
        <button className="featured-card-cta">
          {/* CTA varies based on state */}
        </button>
      </div>
    </div>
  )
}
```

### Differences Practice vs Ranked

**Practice card**:
- Background gradient: cooler warm
- Ambient glow: top-left
- Border: subtle (0.18 opacity)
- Icon: 📖 trong rounded box subtle gold tint

**Ranked card** (`.featured-card.ranked`):
- Background gradient: slightly warmer
- Ambient glow: top-right, larger (240px), more opacity (0.1)
- Border: medium (0.25 opacity)
- Outer glow: 0 0 24px rgba(212,175,55,0.04)
- Icon: 🏆 trong rounded box stronger gold tint, more glow

### Ranked card states (preserve existing logic)

State A (passed Bible Basics):
```
✓ Đã mở khóa · ⚡ 100/100 năng lượng
[▶ Bắt đầu Ranked]
```

State B (chưa pass):
```
📖 Cần hoàn thành Bài Giáo Lý (10 câu)
[▶ Làm bài giáo lý ngay]
⏱ Chỉ mất 5 phút
```

State C (cooldown):
```
📖 Bài Giáo Lý — Lần thử: 2
⏱ Thử lại sau 0:42
[⏳ Đang chờ... (0:42)] (disabled)
```

### Hover effect

```css
.featured-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  /* Ranked có hover stronger */
}

.featured-card-ranked:hover {
  border-color: rgba(212, 175, 55, 0.45);
}
```

### Acceptance criteria

- Practice card: warm cool tone, glow top-left
- Ranked card: warmer tone, glow top-right, slight outer glow
- Title 22px Sora bold uppercase
- Hover translateY(-3px) smooth
- Ranked 3 states render đúng
- Mobile: stack vertical

### Cost: 1.5-2h

### Commit
- `feat(home): FeaturedCard Practice + Ranked V3 styling`

---

## Step 6 — Secondary Grid (6 compact cards)

### File: `apps/web/src/components/CompactCard.tsx` (hoặc update GameModeGrid)

Reference: classes `.v3-secondary`, `.v3-sec-icon`, `.v3-sec-title`, `.v3-sec-sub`.

### Component

```tsx
interface CompactCardProps {
  icon: string  // emoji
  title: string
  subtitle: string
  onClick: () => void
}

export function CompactCard({ icon, title, subtitle, onClick }: CompactCardProps) {
  return (
    <div className="compact-card" onClick={onClick}>
      <div className="compact-card-icon">{icon}</div>
      <div className="compact-card-title">{title}</div>
      <div className="compact-card-subtitle">{subtitle}</div>
    </div>
  )
}
```

### Visual specs

- Background gradient: subtle white tint
- Border: subtle white 0.06 opacity
- Inset highlight + base shadow
- Hover: brighten + translateY(-1px) + gold border
- Icon 26px emoji
- Title 15px font-weight 600
- Subtitle 11px muted, letter-spacing 0.5px

### Layout

```css
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .secondary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 6 cards content

```tsx
const SECONDARY_MODES = [
  { id: 'group', icon: '👥', title: 'Nhóm Giáo Xứ', subtitle: 'Hội thánh', route: '/groups' },
  { id: 'multiplayer', icon: '🎮', title: 'Phòng Chơi', subtitle: '2-20 người', route: '/multiplayer' },
  { id: 'tournament', icon: '🏆', title: 'Giải Đấu', subtitle: 'Bracket 1v1', route: '/tournaments' },
  { id: 'weekly', icon: '🗓️', title: 'Chủ Đề Tuần', subtitle: 'Chủ đề tuần', route: '/weekly' },
  { id: 'mystery', icon: '🎲', title: 'Mystery Mode', subtitle: 'Random hoàn toàn', route: '/mystery' },
  { id: 'speed', icon: '⚡', title: 'Speed Round', subtitle: '10 câu × 10s', route: '/speed' },
]
```

### Acceptance criteria

- 6 cards 3x2 grid (desktop) hoặc 2x3 (mobile)
- Subtle gradient + hover brighten
- Click navigate đúng route
- Tests (3): render 6 cards, click navigate, mobile responsive

### Cost: 30-45 phút

### Commit
- `feat(home): CompactCard secondary modes V3 styling`

---

## Step 7 — "Khám Phá Thêm" Divider + Section Layout

### Section divider

```tsx
function ExploreMoreDivider() {
  return (
    <div className="section-divider">
      <span className="section-divider-line" />
      <span className="section-divider-text">Khám Phá Thêm</span>
      <span className="section-divider-line right" />
    </div>
  )
}
```

CSS (port từ V3):
- Flex layout với gradient lines hai bên
- Center text 11px uppercase letter-spacing 2px gold

### Update Home.tsx layout

```tsx
export function Home() {
  return (
    <div className="home-page">
      <HeroStatSheet />
      <DailyVerseBanner />
      <FeaturedDailyChallenge />
      
      <h2 className="section-label">Chế độ chơi</h2>
      
      <div className="featured-grid">
        <FeaturedCard variant="practice" onClick={() => navigate('/practice')} />
        <FeaturedCard variant="ranked" onClick={handleRankedClick} />
      </div>
      
      <ExploreMoreDivider />
      
      <div className="secondary-grid">
        {SECONDARY_MODES.map(mode => (
          <CompactCard key={mode.id} {...mode} />
        ))}
      </div>
      
      {/* Existing components below */}
      <DailyMissions />
      <BibleJourney />
      <TierPerksTeaser />
      <Leaderboard />
      <ActivityFeed />
    </div>
  )
}
```

### Section label

```css
.section-label {
  font-size: 16px;
  font-weight: 600;
  font-family: 'Sora', sans-serif;
  margin: 24px 0 12px;
}
```

### Acceptance criteria

- Layout đúng order theo V3
- Section labels đúng font (Sora)
- Featured grid 2 columns desktop, 1 column mobile
- Secondary grid 3 columns desktop, 2 columns mobile
- Tests update Home.test.tsx: render new structure

### Cost: 45 phút

### Commit
- `feat(home): integrate V3 components into Home layout`

---

## Step 8 — Visual QA + Compare

### Manual visual review

Sau Steps 1-7, screenshot Home và compare với reference V3:

**Side-by-side check**:
1. Mở `apps/web/docs/designs/home-design-studio.html` chọn V3
2. Mở app local Home page
3. So sánh từng element:
   - [ ] Hero layout match (avatar size, stats 3 columns, divider)
   - [ ] Hero gradient + glow tone đúng (warm gold ambient)
   - [ ] Verse dividers ✦ ornament đúng
   - [ ] Daily challenge gradient + glow đúng
   - [ ] Practice/Ranked cards: differentiation rõ (Ranked warmer + stronger glow)
   - [ ] Hover effects smooth
   - [ ] Compact cards: subtle but clear

**Mobile check**:
- [ ] Hero compact mode đúng
- [ ] Featured cards stack vertical
- [ ] Secondary grid 2 columns
- [ ] No overflow horizontal

**Performance**:
- [ ] Build size tăng < 30KB (fonts là main cost)
- [ ] Lighthouse score >= 85

### Cost: 45 phút - 1h

### Commit
- `chore: visual QA after V3 implementation`

---

## Step 9 — Full regression

### Checklist

- [ ] `npm run build` pass (0 errors)
- [ ] FE tests pass (>= baseline + ~15 new)
- [ ] BE tests pass (no backend changes, just verify nothing broke)
- [ ] Manual smoke test all flows:
  - Login → Home render đúng V3
  - Click Practice card → /practice
  - Click Ranked card (3 states test)
  - Click Daily Challenge CTA → /daily
  - Click each compact card → đúng route
- [ ] No console errors
- [ ] i18n validator pass
- [ ] Mobile responsive (test 375px, 768px, 1024px viewports)

### Commit
- `chore: regression after V3 design implementation`

---

## Workflow Order

```
Step 0: Verify             — KHÔNG commit
Step 1: Design tokens      — 1 commit
Step 2: Hero Stat Sheet    — 1 commit
Step 3: Verse Banner       — 1 commit
Step 4: Featured Daily     — 1 commit
Step 5: Featured Cards     — 1 commit
Step 6: Secondary Grid     — 1 commit
Step 7: Layout integration — 1 commit
Step 8: Visual QA          — 1 commit
Step 9: Regression         — 1 commit
```

9 commits, mỗi commit revertable.

**Sau Step 7, screenshot Home gửi tôi review trước khi qua Step 8-9.** Đây là checkpoint quan trọng — nếu visual không match V3, fix sớm thay vì làm xong rồi redo.

---

## Files dự kiến đụng tới

### Frontend
- **Mới**:
  - `apps/web/src/components/HeroStatSheet.tsx`
  - `apps/web/src/components/DailyVerseBanner.tsx`
  - `apps/web/src/components/FeaturedCard.tsx`
  - `apps/web/src/components/CompactCard.tsx`
  - `apps/web/src/components/ExploreMoreDivider.tsx`
  - `apps/web/src/utils/greeting.ts`
  - `apps/web/src/utils/tierAvatar.ts`
  - Tests cho 5 components mới
- **Sửa**:
  - `apps/web/src/components/FeaturedDailyChallenge.tsx` (V3 styling)
  - `apps/web/src/components/GameModeGrid.tsx` (refactor sang 2-tier với new components)
  - `apps/web/src/pages/Home.tsx` (layout reordering)
  - `apps/web/src/styles/globals.css` (CSS variables + classes)
  - `apps/web/index.html` hoặc font loader (Sora + Crimson Pro)
  - `apps/web/tailwind.config.js` (nếu dùng)
- **Tests update**:
  - `Home.test.tsx`
  - Existing component tests if structure changes
- **Reference (read-only)**:
  - `apps/web/docs/designs/home-design-studio.html`

### Backend
- KHÔNG đổi

### Mobile
- TÁCH PR sau

---

## Definition of Done

✅ V3 design reference file copied vào `apps/web/docs/designs/`  
✅ Sora + Crimson Pro fonts loaded  
✅ CSS variables setup theo V3 reference  
✅ HeroStatSheet với avatar + 3 stats grid + tier progress  
✅ DailyVerseBanner với ornamental dividers ✦  
✅ FeaturedDailyChallenge V3 styling (warm gradient + glow)  
✅ FeaturedCard Practice + Ranked với differentiation tone  
✅ CompactCard 6 cards 3x2 grid  
✅ "Khám Phá Thêm" divider  
✅ Home layout đúng order theo V3  
✅ Mobile responsive đúng  
✅ Hover effects smooth  
✅ Tests + i18n validator pass  
✅ Visual side-by-side match V3 reference  
✅ KHÔNG đổi spec (tier names, mode names, business logic)  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên:

1. **Step 0 findings**: 
   - Đã đọc V3 CSS từ reference file?
   - Project CSS approach?
   - Existing components paths?
   - Lucide installed?

2. **Icon strategy**: Giữ emoji (match V3) hay upgrade SVG cho Practice/Ranked icons?
   - **Đề xuất**: Giữ emoji match V3. SVG upgrade defer v1.5.

3. **Tier 6 max state**: Hero hiển thị gì khi user max tier?
   - **Đề xuất**: "👑 Bạn đã đạt tier cao nhất!" thay vì progress bar

Sau khi confirm 3 câu → bắt đầu Step 1.

---

## Reminder cuối

- **Reference file `home-design-studio.html` là source of truth** — đọc CSS thực tế, không suy diễn từ description
- **V3 = Sacred Modernist Gaming** — premium nhưng reverent, KHÔNG over-the-top gaming
- **KHÔNG đổi spec**: tier names (Tân Tín Hữu...), mode names (Luyện Tập...), business logic
- **Subtle is key**: Glows opacity 0.06-0.1, không 0.3
- **Side-by-side compare** trong Step 8 là critical — đảm bảo match design
- Mục tiêu cuối: Home page **looks exactly like V3** trong design studio HTML
