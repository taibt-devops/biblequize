import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Tests for GameModeGrid — Option Y 2-tier layout.
 * Featured section (2 cards): Practice + Ranked.
 * Secondary section (6 cards): Group, Multiplayer, Tournament, Weekly,
 * Mystery, Speed. Daily migrated to the FeaturedDailyChallenge banner
 * above the grid; not rendered here.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

import GameModeGrid from '../GameModeGrid'

function renderGrid(props: Parameters<typeof GameModeGrid>[0] = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GameModeGrid {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Default mock: daily-challenge says NOT completed; basic-quiz status
 *  says NOT passed, no cooldown (State B for Ranked). Tests can override. */
function defaultApiMock() {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/api/daily-challenge')) {
      return Promise.resolve({ data: { alreadyCompleted: false } })
    }
    if (url.includes('/api/basic-quiz/status')) {
      return Promise.resolve({
        data: {
          passed: false,
          cooldownRemainingSeconds: 0,
          attemptCount: 0,
          totalQuestions: 10,
          threshold: 8,
        },
      })
    }
    return Promise.reject(new Error('Not mocked: ' + url))
  })
}

describe('GameModeGrid (Option Y)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultApiMock()
  })

  describe('Featured section (Practice + Ranked)', () => {
    it('renders Practice featured card', async () => {
      renderGrid()
      expect(screen.getByTestId('featured-card-practice')).toBeInTheDocument()
      expect(screen.getByTestId('featured-card-practice-cta')).toBeInTheDocument()
    })

    it('renders Ranked featured card', async () => {
      renderGrid()
      expect(screen.getByTestId('featured-card-ranked')).toBeInTheDocument()
    })

    it('Practice CTA navigates to /practice', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('featured-card-practice-cta'))
      expect(mockNavigate).toHaveBeenCalledWith('/practice')
    })
  })

  describe('Ranked featured card states', () => {
    it('State A — passed: badge "Đã mở khóa" + CTA navigates to /ranked', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: true, cooldownRemainingSeconds: 0, attemptCount: 1,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        return Promise.reject(new Error('Not mocked'))
      })
      renderGrid()
      const status = await screen.findByTestId('ranked-featured-status')
      expect(status).toHaveAttribute('data-state', 'passed')

      const user = userEvent.setup()
      await user.click(screen.getByTestId('featured-card-ranked-cta'))
      expect(mockNavigate).toHaveBeenCalledWith('/ranked')
    })

    it('State B — needs catechism: hint label + CTA navigates to /basic-quiz', async () => {
      renderGrid()
      const status = await screen.findByTestId('ranked-featured-status')
      expect(status).toHaveAttribute('data-state', 'needs-quiz')
      expect(status.textContent).toMatch(/Bài Giáo Lý/)

      const user = userEvent.setup()
      await user.click(screen.getByTestId('featured-card-ranked-cta'))
      expect(mockNavigate).toHaveBeenCalledWith('/basic-quiz')
    })

    it('State C — cooldown: status panel + CTA disabled', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 42, attemptCount: 1,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        return Promise.reject(new Error('Not mocked'))
      })
      renderGrid()
      const status = await screen.findByTestId('ranked-featured-status')
      expect(status).toHaveAttribute('data-state', 'cooldown')
      expect(screen.getByTestId('ranked-featured-cooldown').textContent).toContain('00:42')
      const cta = screen.getByTestId('featured-card-ranked-cta') as HTMLButtonElement
      expect(cta).toBeDisabled()
    })
  })

  describe('Secondary section (6 cards)', () => {
    it('renders all 6 compact cards', async () => {
      renderGrid()
      expect(screen.getByTestId('compact-card-group')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-multiplayer')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-tournament')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-weekly')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-mystery')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-speed')).toBeInTheDocument()
    })

    it('does NOT render Daily card (migrated to FeaturedDailyChallenge banner)', async () => {
      renderGrid()
      expect(screen.queryByTestId('compact-card-daily')).not.toBeInTheDocument()
    })

    it('renders compact subtitles (max 4 words)', async () => {
      renderGrid()
      expect(screen.getByText('Hội thánh')).toBeInTheDocument()        // group
      expect(screen.getByText('2-20 người')).toBeInTheDocument()        // multiplayer
      expect(screen.getByText('Bracket 1v1')).toBeInTheDocument()       // tournament
      expect(screen.getByText('Chủ đề tuần')).toBeInTheDocument()       // weekly
      expect(screen.getByText('Random hoàn toàn')).toBeInTheDocument()  // mystery
      expect(screen.getByText('10 câu × 10s')).toBeInTheDocument()      // speed
    })

    it('compact card click navigates to its route', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('compact-card-tournament'))
      expect(mockNavigate).toHaveBeenCalledWith('/tournaments')
    })

    it('matchmaking-hint icon shown on Tournament + Multiplayer only', async () => {
      renderGrid()
      expect(screen.getByTestId('compact-card-tournament-matchmaking-hint')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-multiplayer-matchmaking-hint')).toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-group-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-weekly-matchmaking-hint')).not.toBeInTheDocument()
    })
  })

  describe('Recommendation highlight', () => {
    it('does NOT highlight any card when userStats is omitted', async () => {
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('featured-card-practice')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('featured-card-practice-badge')).not.toBeInTheDocument()
      expect(screen.queryByTestId('featured-card-ranked-badge')).not.toBeInTheDocument()
    })

    it('highlights Practice card for a brand-new user (onboarding rule)', async () => {
      renderGrid({ userStats: { currentStreak: 0, totalPoints: 0 } })
      await waitFor(() => {
        const practiceCard = screen.getByTestId('featured-card-practice')
        expect(practiceCard.getAttribute('data-recommended')).toBe('true')
      })
    })
  })
})
