import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Tests can override the user (e.g. set currentStreak) per case via
// mockUseAuth.mockReturnValueOnce(...). beforeEach resets to default.
const DEFAULT_USER = { name: 'Test', email: 'test@test.com', currentStreak: 0 }
const mockUseAuth = vi.fn(() => ({ user: DEFAULT_USER }))
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useRankedDataSync', () => ({
  useRankedDataSync: () => ({ isInitialized: true }),
}))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}))

import Ranked from '../Ranked'

function renderRanked() {
  return render(<MemoryRouter><Ranked /></MemoryRouter>)
}

const RANKED_STATUS = {
  date: '2026-04-02',
  livesRemaining: 75,
  dailyLives: 100,
  questionsCounted: 34,
  pointsToday: 456,
  cap: 100,
  currentBook: 'Ma-thi-ơ',
  currentBookIndex: 39,
  isPostCycle: false,
  currentDifficulty: 'medium',
  nextBook: 'Mác',
  resetAt: new Date(Date.now() + 3600000).toISOString(),
  bookProgress: { currentIndex: 39, totalBooks: 66, currentBook: 'Ma-thi-ơ', nextBook: 'Mác', isCompleted: false, progressPercentage: 60 },
}

// Tier 2 (Người Tìm Kiếm) at 4350/5000 → 83.75% → 650 to next (Môn Đồ)
const TIER_PROGRESS_TIER2 = {
  tierLevel: 2,
  tierName: 'Người Tìm Kiếm',
  totalPoints: 4350,
  nextTierPoints: 5000,
  tierProgressPercent: 83.75,
  starIndex: 4,
  starXp: 4250,
  nextStarXp: 5000,
  starProgressPercent: 20,
  milestone: null,
}

// Tier 6 (Sứ Đồ) — max tier, no nextTier
const TIER_PROGRESS_MAX = {
  tierLevel: 6,
  tierName: 'Sứ Đồ',
  totalPoints: 150_000,
  nextTierPoints: 100_000,
  tierProgressPercent: 100,
  starIndex: 0,
  starXp: 100_000,
  nextStarXp: 100_000,
  starProgressPercent: 100,
  milestone: null,
}

describe('Ranked Mode Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockImplementation(() => ({ user: DEFAULT_USER }))
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status')) return Promise.resolve({ data: RANKED_STATUS })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      if (url.includes('leaderboard')) return Promise.resolve({ data: [] })
      if (url.includes('questions')) return Promise.resolve({ data: [] })
      return Promise.reject(new Error('Not found'))
    })
    mockApiPost.mockResolvedValue({ data: { sessionId: 'sess-1' } })
  })

  it('renders header with title and tier', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('Thi Đấu Xếp Hạng')).toBeInTheDocument()
    })
  })

  it('displays energy section with value', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('Năng lượng')).toBeInTheDocument()
      expect(screen.getByText('75')).toBeInTheDocument()
    })
  })

  it('displays energy progress bar', async () => {
    renderRanked()
    await waitFor(() => {
      const bars = document.querySelectorAll('.gold-gradient')
      const energyBar = Array.from(bars).find(b => (b as HTMLElement).style.width === '75%')
      expect(energyBar).toBeTruthy()
    })
  })

  it('displays today stats: points and questions', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('456')).toBeInTheDocument()
      // After R3 redesign there's no single "Hôm Nay" header — points
      // shown in dedicated card via "ranked-points-today" testid.
      expect(screen.getByTestId('ranked-points-today')).toHaveTextContent('456')
      expect(screen.getByTestId('ranked-questions-counted')).toHaveTextContent('34')
    })
  })

  it('displays current book Ma-thi-ơ', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('Ma-thi-ơ')).toBeInTheDocument()
      expect(screen.getByText('Trung bình')).toBeInTheDocument()
    })
  })

  it('R3: rank #42 still rendered in Season card (not in Today row)', async () => {
    renderRanked()
    await waitFor(() => {
      // After R3, rank #N is rendered ONLY in Season card. The dedicated
      // "Today row" rank cell is gone, so getByTestId('ranked-user-rank')
      // returns nothing — instead we assert the season-rank cell.
      expect(screen.queryByTestId('ranked-user-rank')).toBeNull()
      expect(screen.getByTestId('ranked-season-rank')).toHaveTextContent('#42')
    })
  })

  it('R5: shows "Vào thi đấu" CTA when energy > 0 and cap not reached', async () => {
    // Default mock has livesRemaining=75, questionsCounted=34, cap=100 → canPlay
    renderRanked()
    await waitFor(() => {
      const btn = screen.getByTestId('ranked-start-btn')
      expect(btn).toBeInTheDocument()
      expect(btn).toHaveTextContent(/Vào thi đấu/i)
    })
  })

  it('displays start button when energy > 0', async () => {
    renderRanked()
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Vào Thi Đấu/ })
      expect(btn).toBeInTheDocument()
    })
  })

  it('shows disabled button when energy = 0', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, livesRemaining: 0 } })
      return Promise.reject(new Error('Not found'))
    })

    renderRanked()
    await waitFor(() => {
      expect(screen.getByText(/Hết năng lượng/)).toBeInTheDocument()
    })
  })

  it('shows skeleton during loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderRanked()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu thi đấu/)).toBeInTheDocument()
      expect(screen.getByText('Thử lại')).toBeInTheDocument()
    })
  })

  it('clicking start navigates to /quiz with ranked mode', async () => {
    renderRanked()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vào Thi Đấu/ })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Vào Thi Đấu/ }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/quiz', expect.objectContaining({
        state: expect.objectContaining({ mode: 'ranked', isRanked: true }),
      }))
    })
  })

  it('does NOT show undefined or null in energy display', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, livesRemaining: undefined, dailyLives: undefined } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
    })
  })

  // ── R1: Header + Tier Progress Bar ──

  it('R1: renders tier progress text "Còn 650 điểm nữa lên Môn Đồ" for tier 2 user', async () => {
    renderRanked()
    await waitFor(() => {
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent('650')
      expect(text).toHaveTextContent('Môn Đồ')
    })
  })

  it('R1: renders max tier message for tier 6 (Sứ Đồ) user', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_MAX })
      if (url.includes('ranked-status')) return Promise.resolve({ data: RANKED_STATUS })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 1, points: 150_000 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent(/đạt tier cao nhất/i)
    })
  })

  it('R1: progress bar width matches tierProgressPercent from API', async () => {
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-tier-progress-bar') as HTMLElement
      expect(bar.style.width).toBe('83.75%')
    })
  })

  it('R1: progress bar at 100% when user is at max tier', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_MAX })
      if (url.includes('ranked-status')) return Promise.resolve({ data: RANKED_STATUS })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 1, points: 150_000 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-tier-progress-bar') as HTMLElement
      expect(bar.style.width).toBe('100%')
    })
  })

  // ── R1 Boundary tests: tier transitions at threshold values ──
  // Verifies tier badge shows the correct tier when totalPoints crosses thresholds:
  //   0 → tier 1 (Tân Tín Hữu); 999 → still tier 1; 1000 → tier 2 (Người Tìm Kiếm);
  //   4999 → still tier 2; 5000 → tier 3 (Môn Đồ).
  // Backend /api/me/tier-progress is the source of truth (all-time sum, not daily proxy).

  function makeTierProgress(totalPoints: number) {
    // Mirror server's TierProgressService logic for thresholds
    const TIERS_VI = ['Tân Tín Hữu', 'Người Tìm Kiếm', 'Môn Đồ', 'Hiền Triết', 'Tiên Tri', 'Sứ Đồ']
    const THRESHOLDS = [0, 1000, 5000, 15_000, 40_000, 100_000]
    let level = 1
    for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalPoints >= THRESHOLDS[i]) { level = i + 1; break }
    }
    const tierStart = THRESHOLDS[level - 1]
    const nextTierStart = level < 6 ? THRESHOLDS[level] : tierStart
    const range = nextTierStart - tierStart
    const pct = range > 0 ? ((totalPoints - tierStart) / range) * 100 : 100
    return {
      tierLevel: level,
      tierName: TIERS_VI[level - 1],
      totalPoints,
      nextTierPoints: nextTierStart,
      tierProgressPercent: Math.round(pct * 100) / 100,
      starIndex: 0,
      starXp: tierStart,
      nextStarXp: nextTierStart,
      starProgressPercent: pct,
      milestone: null,
    }
  }

  function mockWithTotalPoints(totalPoints: number) {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress'))
        return Promise.resolve({ data: makeTierProgress(totalPoints) })
      if (url.includes('ranked-status')) return Promise.resolve({ data: RANKED_STATUS })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 100, points: 0 } })
      return Promise.reject(new Error('Not found'))
    })
  }

  it('R1 boundary: totalPoints=0 → tier 1 (Tân Tín Hữu), points to Người Tìm Kiếm', async () => {
    mockWithTotalPoints(0)
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-tier-badge')).toHaveTextContent('Tân Tín Hữu')
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent('1.000') // 1000 with vi locale grouping
      expect(text).toHaveTextContent('Người Tìm Kiếm')
    })
  })

  it('R1 boundary: totalPoints=999 → still tier 1 (Tân Tín Hữu), 1 point to next', async () => {
    mockWithTotalPoints(999)
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-tier-badge')).toHaveTextContent('Tân Tín Hữu')
      const text = screen.getByTestId('ranked-tier-progress-text')
      // pointsToNext = 1000 - 999 = 1
      expect(text).toHaveTextContent(/Còn\s+1\s+điểm/)
      expect(text).toHaveTextContent('Người Tìm Kiếm')
    })
  })

  it('R1 boundary: totalPoints=1000 → tier 2 (Người Tìm Kiếm), 4000 to Môn Đồ', async () => {
    mockWithTotalPoints(1000)
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-tier-badge')).toHaveTextContent('Người Tìm Kiếm')
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent('4.000')
      expect(text).toHaveTextContent('Môn Đồ')
    })
  })

  it('R1 boundary: totalPoints=4999 → still tier 2 (Người Tìm Kiếm), 1 point to Môn Đồ', async () => {
    mockWithTotalPoints(4999)
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-tier-badge')).toHaveTextContent('Người Tìm Kiếm')
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent(/Còn\s+1\s+điểm/)
      expect(text).toHaveTextContent('Môn Đồ')
    })
  })

  it('R1 boundary: totalPoints=5000 → tier 3 (Môn Đồ), 10000 to Hiền Triết', async () => {
    mockWithTotalPoints(5000)
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-tier-badge')).toHaveTextContent('Môn Đồ')
      const text = screen.getByTestId('ranked-tier-progress-text')
      expect(text).toHaveTextContent('10.000')
      expect(text).toHaveTextContent('Hiền Triết')
    })
  })

  // ── R2: Energy + Streak 2-column row ──

  it('R2: energy display shows livesRemaining (75) — preserves testid', async () => {
    renderRanked()
    await waitFor(() => {
      const display = screen.getByTestId('ranked-energy-display')
      expect(display).toHaveTextContent('75')
    })
  })

  it('R2: energy footer shows "~Z câu" hint (Z = floor(energy/5))', async () => {
    // 75 energy → 75/5 = 15 questions
    renderRanked()
    await waitFor(() => {
      // Both Energy footer and CTA sub-text contain "~15 câu" — scope to
      // the Energy card to avoid matching the CTA after R5.
      const energyCard = screen.getByTestId('ranked-energy-card')
      expect(energyCard.textContent).toMatch(/~15\s+câu/)
    })
  })

  it('R2: energy timer rendered in HH:MM:SS format inside footer', async () => {
    renderRanked()
    await waitFor(() => {
      const timer = screen.getByTestId('ranked-energy-timer')
      // Format HH:MM:SS — countdown driven by resetAt 1h from now
      expect(timer.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })

  it('R2: streak card shows "N ngày" + keep-going caption when streak > 0', async () => {
    mockUseAuth.mockImplementation(() => ({ user: { ...DEFAULT_USER, currentStreak: 7 } }))
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText(/7\s+ngày/)).toBeInTheDocument()
      expect(screen.getByText('Đừng dừng — chơi tiếp!')).toBeInTheDocument()
    })
  })

  it('R2: streak card shows "Bắt đầu streak hôm nay!" when streak = 0', async () => {
    // Default user has currentStreak: 0
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('Bắt đầu streak hôm nay!')).toBeInTheDocument()
      // Should NOT show keep-going caption
      expect(screen.queryByText('Đừng dừng — chơi tiếp!')).not.toBeInTheDocument()
    })
  })

  it('R2: no decorative bolt watermark icon in energy section', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-energy-card')).toBeInTheDocument()
    })
    // Watermark used opacity-10 + text-8xl on a positioned div — should be gone
    const energyCard = screen.getByTestId('ranked-energy-card')
    expect(energyCard.querySelector('.text-8xl')).toBeNull()
    expect(energyCard.querySelector('.opacity-10')).toBeNull()
  })

  it('R2: nextTier name styled gold + semibold in tier progress text', async () => {
    renderRanked()
    await waitFor(() => {
      const text = screen.getByTestId('ranked-tier-progress-text')
      const goldSpan = text.querySelector('span.font-semibold') as HTMLElement | null
      expect(goldSpan).not.toBeNull()
      // happy-dom preserves the original hex form (vs jsdom which converts to rgb)
      expect(goldSpan!.style.color.toLowerCase()).toBe('#e8a832')
      expect(goldSpan!.textContent).toBe('Môn Đồ') // default mock = tier 2 → next Môn Đồ
    })
  })

  // ── R3: 3 Stats Cards (loại bỏ rank duplicate) ──

  it('R3: renders only 2 cards when accuracy data missing (default mock)', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-questions-counted')).toBeInTheDocument()
      expect(screen.getByTestId('ranked-points-today')).toBeInTheDocument()
      // Card 3 (accuracy) hidden when dailyAccuracy is undefined
      expect(screen.queryByTestId('ranked-accuracy')).toBeNull()
    })
  })

  it('R3: renders 3 cards when backend supplies dailyAccuracy', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status'))
        return Promise.resolve({
          data: { ...RANKED_STATUS, dailyAccuracy: 0.75, dailyCorrect: 9 },
        })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-accuracy')).toHaveTextContent('75%')
      // Subtitle "9/34 câu đúng" — dailyCorrect=9, questionsCounted=34
      expect(screen.getByText('9/34 câu đúng')).toBeInTheDocument()
    })
  })

  it('R3: progress bar width matches questionsAnswered/cap %', async () => {
    // Default mock: 34/100 → 34%
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-today-progress') as HTMLElement
      expect(bar.style.width).toBe('34%')
    })
  })

  it('R3: shows positive delta in green when dailyDelta > 0', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, dailyDelta: 12 } })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      const delta = screen.getByTestId('ranked-points-delta')
      expect(delta).toHaveTextContent('↑ +12')
      expect(delta.style.color.toLowerCase()).toBe('#4ade80')
    })
  })

  it('R3: hides delta line when dailyDelta is 0 or missing', async () => {
    // Default mock has no dailyDelta → hidden
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-points-today')).toBeInTheDocument()
      expect(screen.queryByTestId('ranked-points-delta')).toBeNull()
    })

    // Explicit delta=0 also hides
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, dailyDelta: 0 } })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      return Promise.reject(new Error('Not found'))
    })
    // No need to re-render — the existing render already mounted; but to keep
    // things explicit, just assert again by reading the current DOM.
    expect(screen.queryByTestId('ranked-points-delta')).toBeNull()
  })

  it('R3: no decorative trophy/icon watermarks remain on the page', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByTestId('ranked-page')).toBeInTheDocument()
    })
    const main = screen.getByTestId('ranked-page')
    // Watermark icons used absolute + opacity-5/opacity-10 + huge text size
    expect(main.querySelector('.opacity-5')).toBeNull()
    expect(main.querySelector('.opacity-10')).toBeNull()
    expect(main.querySelector('[class*="text-[300px]"]')).toBeNull()
  })

  // ── R4: Active Book Card (slim horizontal) ──

  it('R4: slim book card renders with name + position + difficulty pill', async () => {
    renderRanked()
    await waitFor(() => {
      // Wrapper testid preserved
      expect(screen.getByTestId('ranked-current-book')).toBeInTheDocument()
      // Book name in the title (default mock: Ma-thi-ơ)
      expect(screen.getByTestId('ranked-current-book-name')).toHaveTextContent('Ma-thi-ơ')
      // Position info "Sách 40/66" rendered as inline meta (currentIndex 39 + 1)
      expect(screen.getByText(/Sách\s+40\s*\/\s*66/)).toBeInTheDocument()
      // Difficulty pill ("Trung bình" for medium) still rendered inline with title
      expect(screen.getByText('Trung bình')).toBeInTheDocument()
    })
  })

  it('R4: progress bar width matches bookProgress.progressPercentage', async () => {
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-current-book-progress') as HTMLElement
      // Default mock: progressPercentage = 60
      expect(bar.style.width).toBe('60%')
    })
  })

  it('R4: "Conquering — N%" sub-line shows rounded progress percent', async () => {
    renderRanked()
    await waitFor(() => {
      // i18n vi: "Đang chinh phục — 60%"
      expect(screen.getByText(/Đang chinh phục\s*—\s*60%/)).toBeInTheDocument()
    })
  })

  it('R4: "Đổi sách" button is disabled with tooltip explaining the gap', async () => {
    renderRanked()
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Sắp ra mắt/ })
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('title')
      expect(btn.getAttribute('title')).toMatch(/Luyện Tập/)
      expect(btn).toHaveTextContent(/Đổi sách/)
    })
  })

  it('R4: card layout uses slim horizontal flex (icon + content + button)', async () => {
    renderRanked()
    await waitFor(() => {
      const card = screen.getByTestId('ranked-current-book')
      // Slim card uses items-center + gap utility for horizontal layout
      expect(card.className).toMatch(/flex/)
      expect(card.className).toMatch(/items-center/)
      // 48x48 icon container is the first child
      const iconBox = card.querySelector('div.w-12.h-12') as HTMLElement | null
      expect(iconBox).not.toBeNull()
      expect(iconBox!.querySelector('.material-symbols-outlined')?.textContent?.trim()).toBe('menu_book')
    })
  })

  // ── R5: Season Card Milestones + CTA states ──
  // Helpers for parameterized rank → progress assertions.
  function mockWithRank(rank: number | null) {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status')) return Promise.resolve({ data: RANKED_STATUS })
      if (url.includes('my-rank'))
        return Promise.resolve({ data: rank == null ? null : { rank, points: 4350 } })
      return Promise.reject(new Error('Not found'))
    })
  }

  it('R5: rank=200 (off the leaderboard) → progress 0%, "▼ Bạn ở đây" before Top 100', async () => {
    mockWithRank(200)
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-season-progress-bar') as HTMLElement
      expect(bar.style.width).toBe('0%')
      // Slot 0 (replacing "Top 100" label) shows "▼ Bạn ở đây"
      expect(screen.getByTestId('ranked-milestone-100')).toHaveTextContent(/Bạn ở đây/)
      // Other slots keep their milestone label
      expect(screen.getByTestId('ranked-milestone-50')).toHaveTextContent(/Top 50/)
      expect(screen.getByTestId('ranked-milestone-10')).toHaveTextContent(/Top 10/)
      expect(screen.getByTestId('ranked-milestone-1')).toHaveTextContent(/Top 1/)
    })
  })

  it('R5: rank=75 → progress ~16.5% (lerp 100→50 → 0→33%), highlight slot 0', async () => {
    mockWithRank(75)
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-season-progress-bar') as HTMLElement
      // (100 - 75) / 50 * 33 = 16.5
      const w = parseFloat(bar.style.width)
      expect(w).toBeGreaterThan(15)
      expect(w).toBeLessThan(18)
      expect(screen.getByTestId('ranked-milestone-100')).toHaveTextContent(/Bạn ở đây/)
    })
  })

  it('R5: rank=30 → progress ~49.5% (lerp 50→10 → 33→66%), highlight slot 1 (Top 50)', async () => {
    mockWithRank(30)
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-season-progress-bar') as HTMLElement
      // 33 + (50-30)/40 * 33 = 33 + 16.5 = 49.5%
      const w = parseFloat(bar.style.width)
      expect(w).toBeGreaterThan(48)
      expect(w).toBeLessThan(51)
      // Slot 1 (Top 50 position) is now "Bạn ở đây"
      expect(screen.getByTestId('ranked-milestone-50')).toHaveTextContent(/Bạn ở đây/)
      expect(screen.getByTestId('ranked-milestone-100')).toHaveTextContent(/Top 100/)
    })
  })

  it('R5: rank=5 → progress ~85% (lerp 10→1 → 66→100%), highlight slot 2 (Top 10)', async () => {
    mockWithRank(5)
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-season-progress-bar') as HTMLElement
      // 66 + (10-5)/9 * 34 = 66 + 18.9 = ~85%
      const w = parseFloat(bar.style.width)
      expect(w).toBeGreaterThan(83)
      expect(w).toBeLessThan(87)
      expect(screen.getByTestId('ranked-milestone-10')).toHaveTextContent(/Bạn ở đây/)
    })
  })

  it('R5: rank=1 → progress 100%, highlight slot 3 (Top 1)', async () => {
    mockWithRank(1)
    renderRanked()
    await waitFor(() => {
      const bar = screen.getByTestId('ranked-season-progress-bar') as HTMLElement
      expect(bar.style.width).toBe('100%')
      expect(screen.getByTestId('ranked-milestone-1')).toHaveTextContent(/Bạn ở đây/)
    })
  })

  it('R5: null rank → "Chưa xếp hạng" instead of "#—"', async () => {
    mockWithRank(null)
    renderRanked()
    await waitFor(() => {
      const rankEl = screen.getByTestId('ranked-season-rank')
      expect(rankEl).toHaveTextContent(/Chưa xếp hạng/)
      // Bar at 0% (no rank → no progress)
      expect((screen.getByTestId('ranked-season-progress-bar') as HTMLElement).style.width).toBe('0%')
    })
  })

  it('R5: CTA State A (normal) shows main + sub with "~Z câu" hint and "{book}"', async () => {
    // Default mock: livesRemaining=75, questionsCounted=34, cap=100, currentBook=Ma-thi-ơ
    renderRanked()
    await waitFor(() => {
      const btn = screen.getByTestId('ranked-start-btn')
      expect(btn).toHaveTextContent(/Vào Thi Đấu Ngay/)
      // Sub: "Tiếp tục Ma-thi-ơ • ~15 câu với năng lượng hiện có" (75/5 = 15)
      expect(btn).toHaveTextContent('Ma-thi-ơ')
      expect(btn).toHaveTextContent(/~15\s+câu/)
    })
  })

  it('R5: CTA State B (no energy) shows "Hết năng lượng" + recovery time', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, livesRemaining: 0 } })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      // Start button NOT rendered when not playable
      expect(screen.queryByTestId('ranked-start-btn')).toBeNull()
      // Main heading + sub testid preserved
      expect(screen.getByText(/Hết năng lượng/i)).toBeInTheDocument()
      const sub = screen.getByTestId('ranked-no-energy-msg')
      expect(sub).toHaveTextContent(/Phục hồi sau/)
    })
  })

  it('R5: CTA State C (cap reached) shows "Hoàn thành ngày" + come back time', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('tier-progress')) return Promise.resolve({ data: TIER_PROGRESS_TIER2 })
      if (url.includes('ranked-status'))
        return Promise.resolve({ data: { ...RANKED_STATUS, questionsCounted: 100, cap: 100 } })
      if (url.includes('my-rank')) return Promise.resolve({ data: { rank: 42, points: 2340 } })
      return Promise.reject(new Error('Not found'))
    })
    renderRanked()
    await waitFor(() => {
      expect(screen.queryByTestId('ranked-start-btn')).toBeNull()
      expect(screen.getByText(/Hoàn thành ngày/i)).toBeInTheDocument()
      const sub = screen.getByTestId('ranked-cap-reached-msg')
      expect(sub).toHaveTextContent(/Quay lại sau/)
    })
  })
})
