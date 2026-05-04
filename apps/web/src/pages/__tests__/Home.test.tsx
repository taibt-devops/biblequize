import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../components/GameModeGrid', () => ({
  default: () => <div data-testid="game-mode-grid">GameModeGrid</div>,
}))

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

const mockUser = { name: 'Nghĩa', email: 'nghia@test.com' }
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

vi.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({ hasDoneTutorial: true, setHasDoneTutorial: vi.fn() }),
}))

import Home from '../Home'

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><Home /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Home Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/quiz/daily-bonus'))
        return Promise.resolve({ data: { hasBonus: false } })
      if (url.includes('/api/me/comeback-status'))
        return Promise.resolve({ data: { daysSinceLastPlay: 0, rewardTier: 'NONE', claimed: false, reward: null } })
      if (url.includes('/api/me/daily-missions'))
        return Promise.resolve({ data: { date: '2026-04-07', missions: [
          { slot: 1, type: 'answer_correct', description: 'Trả lời đúng 3 câu', progress: 1, target: 3, completed: false },
          { slot: 2, type: 'complete_daily_challenge', description: 'Hoàn thành thử thách', progress: 0, target: 1, completed: false },
          { slot: 3, type: 'answer_combo', description: 'Combo 5', progress: 0, target: 1, completed: false },
        ], allCompleted: false, bonusClaimed: false, bonusXp: 50 } })
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 3, tierName: 'Môn Đồ', totalPoints: 8200, nextTierPoints: 15000, tierProgressPercent: 32.0, starIndex: 1, starXp: 7000, nextStarXp: 9000, starProgressPercent: 60.0, milestone: null } })
      if (url.includes('/api/me/journey'))
        return Promise.resolve({ data: { summary: { totalBooks: 66, completedBooks: 0, inProgressBooks: 1, lockedBooks: 65, overallMasteryPercent: 0, currentBook: null }, books: [] } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 8200 } })
      if (url.includes('my-rank'))
        return Promise.resolve({ data: { rank: 85, points: 8200 } })
      if (url.includes('/api/leaderboard'))
        return Promise.resolve({ data: [
          { userId: '1', name: 'Trần Thùy Linh', points: 45200, questions: 120 },
          { userId: '2', name: 'Lê Quốc Anh', points: 42850, questions: 95 },
        ] })
      return Promise.reject(new Error('Not found'))
    })
  })

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getAllByText(/Nghĩa/).length).toBeGreaterThan(0)
      })
    })

    it('shows skeleton during loading', () => {
      mockApiGet.mockReturnValue(new Promise(() => {}))
      renderHome()
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('has max-w-7xl container', async () => {
      renderHome()
      await waitFor(() => { expect(document.querySelector('.max-w-7xl')).toBeInTheDocument() })
    })
  })

  describe('Greeting & Tier', () => {
    it('displays time-based greeting with user name', async () => {
      // HR-1: GreetingCard splits greeting + name into separate testids.
      renderHome()
      await waitFor(() => {
        const h = new Date().getHours()
        const expected = h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
        expect(screen.getByTestId('home-greeting-meta').textContent).toContain(expected)
        expect(screen.getByTestId('home-greeting-name').textContent).toBe('Nghĩa')
      })
    })

    it('displays tier progress bar with milestones', async () => {
      // HR-1: segmented bar with 5 milestone dots replaces the 5-star UI.
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-greeting-progress-fill')).toBeInTheDocument()
        expect(screen.getByTestId('home-greeting-milestone-0')).toBeInTheDocument()
      })
    })

    it('displays points (8,200)', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getAllByText(/8,200/).length).toBeGreaterThan(0) })
    })

    it('displays current tier (Môn Đồ) in progress label', async () => {
      renderHome()
      // HR-1: tier name appears inside greeting tier-label "current → next".
      await waitFor(() => {
        expect(screen.getByTestId('home-greeting-tier-label').textContent).toContain('Môn Đồ')
      })
    })

    it('progress bar width correct for 8200 points (32%)', async () => {
      renderHome()
      await waitFor(() => {
        const bar = screen.getByTestId('home-greeting-progress-fill')
        // 8200 in tier 3 (5000-14999): (8200-5000)/(15000-5000) = 32%
        expect(bar.style.width).toBe('32%')
      })
    })

    it('handles 0 points gracefully', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 0 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        return Promise.reject(new Error('Not found'))
      })
      renderHome()
      await waitFor(() => {
        const bar = screen.getByTestId('home-greeting-progress-fill')
        expect(bar.style.width).toBe('0%')
        expect(screen.getByTestId('home-greeting-tier-label').textContent).toContain('Tân Tín Hữu')
      })
    })

    it('shows max tier state', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 150000 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        return Promise.reject(new Error('Not found'))
      })
      renderHome()
      await waitFor(() => {
        const msg = screen.getByTestId('home-greeting-max-tier')
        expect(msg).toBeInTheDocument()
        expect(msg.textContent).toContain('Đã đạt hạng cao nhất!')
      })
    })
  })

  describe('GameModeGrid', () => {
    it('renders GameModeGrid', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getByTestId('game-mode-grid')).toBeInTheDocument() })
    })

    it('displays section header', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByText('Chế độ chơi')).toBeInTheDocument()
        expect(screen.getByText('KHÁM PHÁ 8 CHẾ ĐỘ')).toBeInTheDocument()
      })
    })
  })

  describe('Leaderboard', () => {
    it('displays section', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getByText('Bảng Xếp Hạng')).toBeInTheDocument() })
    })

    it('displays period tabs', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByText('Hàng ngày')).toBeInTheDocument()
        expect(screen.getByText('Hàng tuần')).toBeInTheDocument()
      })
    })

    it('displays entries with correct points field', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByText('Trần Thùy Linh')).toBeInTheDocument()
        // H7 redesign drops the "XP" suffix on each row — the column
        // header / footer carries the unit, the rows just show counts.
        expect(screen.getByText('45,200')).toBeInTheDocument()
      })
    })

    it('displays current user row', async () => {
      renderHome()
      await waitFor(() => {
        // H7: name comes first, "(bạn)" is the suffix per mockup.
        expect(screen.getByText(/Nghĩa \(bạn\)/)).toBeInTheDocument()
        expect(screen.getByText('#85')).toBeInTheDocument()
      })
    })

    /**
     * Regression (2026-04-19): when the current user's rank falls within
     * the displayed top-N window, they already appear in the main list —
     * rendering the sticky "Bạn" row is duplication. Only show sticky
     * row for around-me use case (rank BEYOND the visible window).
     */
    it('does NOT render sticky "Bạn" row when user is already in the top list', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-missions/today'))
          return Promise.resolve({ data: { missions: [], allCompleted: false } })
        if (url.includes('/api/me/tier-progress'))
          return Promise.resolve({ data: { totalPoints: 45200 } })
        if (url.includes('/api/me/journey'))
          return Promise.resolve({ data: { summary: {}, books: [] } })
        if (url.includes('/api/me'))
          return Promise.resolve({ data: { totalPoints: 45200 } })
        if (url.includes('my-rank'))
          return Promise.resolve({ data: { rank: 1, points: 45200 } })
        if (url.includes('/api/leaderboard'))
          return Promise.resolve({ data: [
            { userId: '1', name: 'Nghĩa', points: 45200, questions: 120 },
            { userId: '2', name: 'Lê Quốc Anh', points: 42850, questions: 95 },
          ] })
        return Promise.reject(new Error('Not found'))
      })
      renderHome()

      await waitFor(() => {
        // Main list row for the user IS present (H7 drops "XP" suffix).
        expect(screen.getByText('45,200')).toBeInTheDocument()
      })
      // Sticky "Bạn" row is NOT present (user is rank 1 in a list of 2)
      expect(screen.queryByTestId('home-my-rank-sticky')).not.toBeInTheDocument()
      expect(screen.queryByText(/Nghĩa \(bạn\)/)).not.toBeInTheDocument()
    })

    it('renders sticky "Bạn" row when user is OUTSIDE the top list', async () => {
      // Default mockApiGet (from beforeEach) has myRank=85 with 2 items in list
      // → sticky must render (around-me pattern).
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-my-rank-sticky')).toBeInTheDocument()
      })
    })

    it('shows action-oriented empty state with Practice CTA', async () => {
      // HR-6: leaderboard is hidden for new users (totalPoints<1000), so
      // pass a non-new user with an empty leaderboard array to exercise
      // the empty-state branch.
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 8200 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        return Promise.reject(new Error('Not found'))
      })
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('empty-leaderboard-cta')).toBeInTheDocument()
      })
      const cta = screen.getByTestId('empty-leaderboard-cta-button')
      expect(cta.getAttribute('href')).toBe('/practice')
    })

    it('has "Xem tất cả" link', async () => {
      renderHome()
      await waitFor(() => {
        // H7 footer renders "Xem tất cả →" with the trailing arrow.
        const link = screen.getByText(/Xem tất cả/)
        expect(link.closest('a')).toHaveAttribute('href', '/leaderboard')
      })
    })

    it('switching tab triggers refetch with new period', async () => {
      renderHome()
      const user = userEvent.setup()
      await waitFor(() => { expect(screen.getByText('Bảng Xếp Hạng')).toBeInTheDocument() })
      await user.click(screen.getByText('Hàng tuần'))
      await waitFor(() => {
        const calls = mockApiGet.mock.calls.filter((c: any) => c[0].includes('leaderboard'))
        expect(calls.some((c: any) => c[0].includes('/weekly'))).toBe(true)
      })
    })

    it('shows opacity-50 during fetching', async () => {
      // Initial render fetches; opacity is tested by the transition class existing
      renderHome()
      await waitFor(() => {
        const container = document.querySelector('.transition-opacity')
        expect(container).toBeInTheDocument()
      })
    })
  })

  describe('Activity Feed', () => {
    it('displays section title', async () => {
      renderHome()
      // H7 shortened the title to "Hoạt động" with "Trong hội thánh"
      // as a separate subtitle.
      await waitFor(() => { expect(screen.getByText('Hoạt động')).toBeInTheDocument() })
    })

    /**
     * Step 4 of the Home refactor: hardcoded dummy rows ("Nguyễn A vừa
     * đạt Hiền Triết" etc.) were visibly fake at launch (no users, no
     * activity yet). Replaced with the empty-state pioneer card.
     */
    it('renders empty-state pioneer card instead of dummy data', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument()
      })
      expect(screen.queryByText('Nguyễn A')).not.toBeInTheDocument()
      expect(screen.queryByText('Minh Tâm')).not.toBeInTheDocument()
      expect(screen.queryByText('Hùng Dũng')).not.toBeInTheDocument()
    })
  })

  describe('Daily Verse', () => {
    it('displays a scripture verse banner with reference', async () => {
      renderHome()
      await waitFor(() => {
        const verseSection = screen.getByTestId('home-daily-verse')
        expect(verseSection).toBeInTheDocument()
        // Verse rotates daily — just verify a verse element has content
        expect(verseSection.textContent).toMatch(/\w+/)
      })
    })

    /**
     * HR-5: verse moves from page footer into a 2-col Verse + Journey
     * grid placed AFTER game modes + daily missions but BEFORE the
     * leaderboard. Mockup `.grid-1-1` puts spiritual content above
     * comparison-heavy leaderboard.
     */
    it('renders the verse card after game modes and before the leaderboard', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-daily-verse')).toBeInTheDocument()
      })
      const verse = screen.getByTestId('home-daily-verse')
      const gameModes = screen.getByTestId('game-mode-grid')
      const leaderboard = screen.getByTestId('home-leaderboard')
      // verse comes AFTER game modes
      expect(gameModes.compareDocumentPosition(verse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // verse comes BEFORE leaderboard
      expect(verse.compareDocumentPosition(leaderboard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('verse and journey share the 2-col grid', async () => {
      renderHome()
      await waitFor(() => {
        // Both children render asynchronously (journey gates on /api/me/journey).
        expect(screen.getByTestId('bible-journey-card')).toBeInTheDocument()
      })
      const grid = screen.getByTestId('home-verse-journey')
      expect(grid.contains(screen.getByTestId('home-daily-verse'))).toBe(true)
      expect(grid.contains(screen.getByTestId('bible-journey-card'))).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('renders when all APIs fail', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      renderHome()
      await waitFor(() => {
        expect(screen.getAllByText(/Nghĩa/).length).toBeGreaterThan(0)
        expect(screen.getByTestId('home-greeting-tier-label').textContent).toContain('Tân Tín Hữu')
      })
    })

    it('no undefined/null in UI', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me')) return Promise.resolve({ data: {} })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: {} })
        return Promise.reject(new Error('Not found'))
      })
      renderHome()
      await waitFor(() => {
        expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/null/i)).not.toBeInTheDocument()
      })
    })
  })

  // ── HR-6: state-aware rendering (new vs active user) ───────────

  describe('HR-6 state-aware', () => {
    function setupNewUser() {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me/tier-progress'))
          return Promise.resolve({ data: { tierLevel: 1, totalPoints: 200, starIndex: 0, starXp: 0, nextStarXp: 200 } })
        if (url.includes('/api/me/journey'))
          return Promise.resolve({ data: { summary: { totalBooks: 66, completedBooks: 0, oldTestamentCompleted: 0, newTestamentCompleted: 0, currentBook: null }, books: [] } })
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 200, currentStreak: 0 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        if (url.includes('my-rank')) return Promise.resolve({ data: null })
        return Promise.resolve({ data: {} })
      })
    }

    it('renders MotivationCard for new user (totalPoints<1000)', async () => {
      setupNewUser()
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('motivation-card')).toBeInTheDocument()
      })
    })

    it('hides Daily Missions for new user', async () => {
      setupNewUser()
      renderHome()
      // Wait for some other element to settle so render is past initial loading.
      await waitFor(() => {
        expect(screen.getByTestId('motivation-card')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('home-daily-missions')).not.toBeInTheDocument()
    })

    it('hides Leaderboard + Activity for new user', async () => {
      setupNewUser()
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('motivation-card')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('home-leaderboard')).not.toBeInTheDocument()
    })

    it('shows Daily Missions + Leaderboard for active user (totalPoints≥1000)', async () => {
      // Default beforeEach mock has totalPoints=8200
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-daily-missions')).toBeInTheDocument()
        expect(screen.getByTestId('home-leaderboard')).toBeInTheDocument()
      })
      // MotivationCard should NOT render for active users.
      expect(screen.queryByTestId('motivation-card')).not.toBeInTheDocument()
    })

    it('boundary: totalPoints=999 still shows MotivationCard, hides Missions', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me/tier-progress'))
          return Promise.resolve({ data: { tierLevel: 1, totalPoints: 999, starIndex: 4, starXp: 800, nextStarXp: 1000 } })
        if (url.includes('/api/me/journey'))
          return Promise.resolve({ data: { summary: { totalBooks: 66, completedBooks: 0, oldTestamentCompleted: 0, newTestamentCompleted: 0, currentBook: null }, books: [] } })
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 999 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        return Promise.resolve({ data: {} })
      })
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('motivation-card')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('home-daily-missions')).not.toBeInTheDocument()
    })

    it('boundary: totalPoints=1000 hides MotivationCard, shows Missions', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me/tier-progress'))
          return Promise.resolve({ data: { tierLevel: 2, totalPoints: 1000, starIndex: 0, starXp: 1000, nextStarXp: 1800 } })
        if (url.includes('/api/me/journey'))
          return Promise.resolve({ data: { summary: { totalBooks: 66, completedBooks: 0, oldTestamentCompleted: 0, newTestamentCompleted: 0, currentBook: null }, books: [] } })
        if (url.includes('/api/me/daily-missions'))
          return Promise.resolve({ data: { date: '2026-05-05', missions: [], allCompleted: false, bonusClaimed: false, bonusXp: 50 } })
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 1000 } })
        if (url.includes('/api/leaderboard')) return Promise.resolve({ data: [] })
        return Promise.resolve({ data: {} })
      })
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-daily-missions')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('motivation-card')).not.toBeInTheDocument()
    })
  })
})
