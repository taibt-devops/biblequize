import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Test', email: 'test@test.com' } }),
  useAuth: () => ({ user: { name: 'Test', email: 'test@test.com' } }),
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
      expect(screen.getByText('Hôm Nay')).toBeInTheDocument()
    })
  })

  it('displays current book Ma-thi-ơ', async () => {
    renderRanked()
    await waitFor(() => {
      expect(screen.getByText('Ma-thi-ơ')).toBeInTheDocument()
      expect(screen.getByText('Trung bình')).toBeInTheDocument()
    })
  })

  it('displays rank #42', async () => {
    renderRanked()
    await waitFor(() => {
      const ranks = screen.getAllByText('#42')
      expect(ranks.length).toBeGreaterThan(0)
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
})
