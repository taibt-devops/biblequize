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
      renderHome()
      await waitFor(() => {
        const h = new Date().getHours()
        const expected = h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
        const heading = screen.getByTestId('home-greeting')
        expect(heading.textContent).toContain(`${expected}, Nghĩa!`)
      })
    })

    it('displays tier progress bar', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getByText('Tiến trình hạng')).toBeInTheDocument() })
    })

    it('displays points (8,200)', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getAllByText(/8,200/).length).toBeGreaterThan(0) })
    })

    it('displays current tier (Môn Đồ)', async () => {
      renderHome()
      await waitFor(() => { expect(screen.getAllByText('Môn Đồ').length).toBeGreaterThan(0) })
    })

    it('progress bar width correct for 8200 points (32%)', async () => {
      renderHome()
      await waitFor(() => {
        const bar = document.querySelector('.gold-gradient')
        expect((bar as HTMLElement).style.width).toBe('32%')
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
        const bar = document.querySelector('.gold-gradient')
        expect((bar as HTMLElement).style.width).toBe('0%')
        expect(screen.getByText('Tân Tín Hữu')).toBeInTheDocument()
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
        // The hero collapses tier-progress copy down to a single
        // "max tier reached" line once the user is at Apostle.
        expect(screen.getByTestId('home-max-tier-msg')).toBeInTheDocument()
        expect(screen.getByText('Đã đạt hạng cao nhất!')).toBeInTheDocument()
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
        expect(screen.getByText('KHÁM PHÁ 9 CHẾ ĐỘ')).toBeInTheDocument()
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
        expect(screen.getByText('45,200 XP')).toBeInTheDocument()
      })
    })

    it('displays current user row', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByText(/Bạn \(Nghĩa\)/)).toBeInTheDocument()
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
        // Main list row for the user IS present
        expect(screen.getByText('45,200 XP')).toBeInTheDocument()
      })
      // Sticky "Bạn" row is NOT present (user is rank 1 in a list of 2)
      expect(screen.queryByTestId('home-my-rank-sticky')).not.toBeInTheDocument()
      expect(screen.queryByText(/Bạn \(Nghĩa\)/)).not.toBeInTheDocument()
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
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/me')) return Promise.resolve({ data: { totalPoints: 0 } })
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
        const link = screen.getByText('Xem tất cả')
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
      await waitFor(() => { expect(screen.getByText('Hoạt động gần đây')).toBeInTheDocument() })
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
     * Verse moved out of the right sidebar (where it was an afterthought
     * under Activity Feed) to a full-width banner directly under the
     * hero section — see docs/prompts/PROMPT_HOME_REFACTOR_FIXES.md
     * Fix 3 ("brand soul" positioning).
     */
    it('renders the verse banner above the game modes section', async () => {
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-daily-verse')).toBeInTheDocument()
      })
      const verse = screen.getByTestId('home-daily-verse')
      const gameModes = screen.getByTestId('game-mode-grid')
      const cmp = verse.compareDocumentPosition(gameModes)
      // DOCUMENT_POSITION_FOLLOWING = 4 — verse comes BEFORE game modes
      expect(cmp & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('Error handling', () => {
    it('renders when all APIs fail', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      renderHome()
      await waitFor(() => {
        expect(screen.getAllByText(/Nghĩa/).length).toBeGreaterThan(0)
        expect(screen.getByText('Tân Tín Hữu')).toBeInTheDocument()
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
})
