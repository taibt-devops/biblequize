import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

const mockUser = { name: 'Nghĩa', email: 'nghia@test.com' }
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

vi.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({ hasSeenOnboarding: true, setHasSeenOnboarding: vi.fn() }),
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

interface MockOpts {
  totalPoints?: number
  currentStreak?: number
  dailyDone?: boolean
  /** LBF-11: fewer than 10 weekly players → Home shows the low-data message. */
  lowWeekly?: boolean
  /** HT-20: memory verses due for review. */
  memoryDue?: number
}

function setupApi(opts: MockOpts = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/api/me/memory-verses/due-count'))
      return Promise.resolve({ data: { dueCount: opts.memoryDue ?? 0 } })
    if (url.includes('/api/quiz/daily-bonus'))
      return Promise.resolve({ data: { hasBonus: false } })
    if (url.includes('/api/me/comeback-status'))
      return Promise.resolve({ data: { daysSinceLastPlay: 0, rewardTier: 'NONE', claimed: false, reward: null } })
    if (url.includes('/api/me/daily-missions'))
      return Promise.resolve({
        data: {
          date: '2026-05-13',
          missions: [
            { slot: 1, description: 'Chơi 1 ván bất kỳ', progress: 1, target: 1, completed: true },
            { slot: 2, description: 'Trả lời đúng 5 câu khó', progress: 1, target: 5, completed: false },
            { slot: 3, description: 'Đạt 60+ điểm Đấu Hạng', progress: 0, target: 1, completed: false },
          ],
        },
      })
    if (url.includes('/api/me/tier-progress'))
      return Promise.resolve({
        data: { tierLevel: opts.totalPoints && opts.totalPoints >= 5000 ? 3 : 1, totalPoints: opts.totalPoints ?? 8200 },
      })
    if (url.includes('/api/me/ranked-status'))
      return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100, seasonPoints: 0 } })
    if (url.includes('/api/seasons/active'))
      return Promise.resolve({ data: { active: false } })
    if (url.includes('/api/leaderboard/weekly/my-rank'))
      return Promise.resolve({ data: { rank: 4, total: 7, userId: 'me' } })
    if (url.includes('/api/leaderboard/weekly'))
      // ≥ SEED_THRESHOLD (10) entries so the Home weekly card renders the board
      // (below the threshold it shows the LBF-11 low-data encouraging message).
      return Promise.resolve({
        data: opts.lowWeekly ? [
          { userId: 'm', name: 'Minh Anh', points: 1240 },
          { userId: 'k', name: 'Khôi Nguyên', points: 1080 },
          { userId: 'me', name: 'Tai Thanh', points: 820 },
        ] : [
          { userId: 'm', name: 'Minh Anh', points: 1240 },
          { userId: 'k', name: 'Khôi Nguyên', points: 1080 },
          { userId: 'me', name: 'Tai Thanh', points: 820 },
          { userId: 'p4', name: 'Player 4', points: 700 },
          { userId: 'p5', name: 'Player 5', points: 600 },
          { userId: 'p6', name: 'Player 6', points: 500 },
          { userId: 'p7', name: 'Player 7', points: 400 },
          { userId: 'p8', name: 'Player 8', points: 300 },
          { userId: 'p9', name: 'Player 9', points: 200 },
          { userId: 'p10', name: 'Player 10', points: 100 },
        ],
      })
    if (url.includes('/api/daily-challenge/result'))
      return Promise.resolve({ data: { correctCount: 4, totalQuestions: 5, xpEarned: 50 } })
    if (url.includes('/api/daily-challenge'))
      return Promise.resolve({ data: { alreadyCompleted: !!opts.dailyDone, totalQuestions: 5 } })
    if (url.includes('/api/me'))
      return Promise.resolve({ data: { totalPoints: opts.totalPoints ?? 8200, currentStreak: opts.currentStreak ?? 0 } })
    return Promise.resolve({ data: {} })
  })
}

describe('Home Dashboard (Khung Sáng IA)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupApi()
  })

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument())
    })

    it('shows skeleton during initial load', () => {
      mockApiGet.mockReturnValue(new Promise(() => {}))
      renderHome()
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('renders the game scene full width, with the panorama painting on wide screens (LKF-3)', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-scene')).toBeInTheDocument())
      const wide = document.querySelector('source[media="(min-width: 768px)"]')
      expect(wide?.getAttribute('srcset')).toContain('bq-home-wide')
    })

    it('renders the verse lightwell', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-verse')).toBeInTheDocument())
    })

    it('HT-20: shows the memory-verse due card only when verses are due', async () => {
      setupApi({ memoryDue: 2 })
      const { unmount } = renderHome()
      expect(await screen.findByTestId('home-memory-due-card')).toHaveTextContent('2')
      unmount()

      setupApi({ memoryDue: 0 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-verse')).toBeInTheDocument())
      expect(screen.queryByTestId('home-memory-due-card')).not.toBeInTheDocument()
    })
  })

  describe('Hero', () => {
    it('displays the user name', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-greeting-name')).toHaveTextContent('Nghĩa'))
    })

    it('displays tier label "Môn Đồ" for 8200 pts', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-greeting-tier-label')).toHaveTextContent('Môn Đồ'))
    })

    it('displays max-tier message at 100k+ pts', async () => {
      setupApi({ totalPoints: 100_000 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-greeting-max-tier')).toBeInTheDocument())
    })
  })

  describe('Daily card', () => {
    it('State A (not done): the dove brings a letter, the bubble offers "Mở thư hôm nay"', async () => {
      setupApi({ dailyDone: false, totalPoints: 8200 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-daily')).toBeInTheDocument())
      expect(screen.getByTestId('featured-daily-cta')).toHaveTextContent('Mở thư hôm nay')
      expect(screen.getByTestId('featured-daily-cta')).toHaveAttribute('href', '/daily')
    })

    it('State B (done): CTA switches to "Xem lại"', async () => {
      setupApi({ dailyDone: true, totalPoints: 8200 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('featured-daily-cta')).toHaveTextContent('Xem lại'))
    })
  })

  describe('Quests + mode cards', () => {
    it('renders today\'s quests (home-daily-missions) with mission rows', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-daily-missions')).toBeInTheDocument())
      expect(screen.getByText('Chơi 1 ván bất kỳ')).toBeInTheDocument()
    })

    it('renders "Chế độ chơi chính" with study/ranked/rooms cards', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByText('Chế độ chơi chính')).toBeInTheDocument())
      expect(screen.getByTestId('home-modes-grid')).toBeInTheDocument()
      expect(screen.getByTestId('home-mode-study')).toBeInTheDocument()
      expect(screen.getByTestId('home-mode-ranked')).toBeInTheDocument()
      expect(screen.getByTestId('home-mode-rooms')).toBeInTheDocument()
    })

    it('shows the weekly rank on the Xếp hạng medal and links to the full board', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-weekly-leaderboard')).toHaveTextContent('#4'))
      expect(screen.getByTestId('home-weekly-leaderboard')).toHaveAttribute('href', '/leaderboard')
    })

    it('LBF-11: hides the sparse board + weak #rank when < 10 weekly players', async () => {
      setupApi({ lowWeekly: true })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-weekly-leaderboard')).toBeInTheDocument())
      const lb = screen.getByTestId('home-weekly-leaderboard')
      // No rank badge on the medal (and no names on Home at all)
      expect(lb).not.toHaveTextContent('#4')
      expect(lb).not.toHaveTextContent('Minh Anh')
      // The weak "Hạng tuần #4" / ranked "#4" numbers must not surface
      expect(screen.queryByText(/Hạng tuần/)).not.toBeInTheDocument()
    })
  })

  describe('Dropped sections (Khung Sáng IA simplification)', () => {
    it('does NOT render the old variety / explore / group / journey sections', async () => {
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument())
      expect(screen.queryByText('Chế độ đa dạng')).not.toBeInTheDocument()
      expect(screen.queryByText('Khám phá thêm')).not.toBeInTheDocument()
      expect(screen.queryByText('Thi đấu cộng đồng')).not.toBeInTheDocument()
      expect(screen.queryByTestId('home-journey')).not.toBeInTheDocument()
    })
  })

  describe('Empty-state for new users (HO-1)', () => {
    it('shows "Bắt đầu từ đây" cue for a brand-new user', async () => {
      setupApi({ totalPoints: 0, dailyDone: false, currentStreak: 0 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-start-here')).toBeInTheDocument())
      expect(screen.getByTestId('home-daily-missions')).toBeInTheDocument()
    })

    it('does NOT show the cue once the user has XP', async () => {
      setupApi({ totalPoints: 200, dailyDone: false, currentStreak: 0 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-modes-grid')).toBeInTheDocument())
      expect(screen.queryByTestId('home-start-here')).not.toBeInTheDocument()
    })

    it('does NOT show the cue when streak > 0 even at 0 XP', async () => {
      setupApi({ totalPoints: 0, dailyDone: false, currentStreak: 3 })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-modes-grid')).toBeInTheDocument())
      expect(screen.queryByTestId('home-start-here')).not.toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('renders hero with name + tier fallback when all APIs return empty', async () => {
      mockApiGet.mockResolvedValue({ data: {} })
      renderHome()
      await waitFor(() => {
        expect(screen.getByTestId('home-greeting-name')).toHaveTextContent('Nghĩa')
        expect(screen.getByTestId('home-greeting-tier-label').textContent).toContain('Tân Tín Hữu')
      })
    })

    it('no undefined/null leaks into UI when API returns empty data', async () => {
      mockApiGet.mockResolvedValue({ data: {} })
      renderHome()
      await waitFor(() => {
        expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/null/i)).not.toBeInTheDocument()
      })
    })
  })
})
