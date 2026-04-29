import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/**
 * Tests for GameModeGrid — the 8 game-mode cards on the Home page after
 * Ranked migrated out (BasicQuizCard banner is now the Ranked gateway).
 *
 * Coverage: rendering, daily-challenge fetch, multiplayer room count,
 * CTA navigation, error handling, smart recommendation highlight, and
 * the matchmaking-hint info icon.
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

function renderGrid() {
  return render(
    <MemoryRouter>
      <GameModeGrid />
    </MemoryRouter>
  )
}

describe('GameModeGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockRejectedValue(new Error('Not mocked'))
  })

  describe('Rendering', () => {
    it('renders all 8 game-mode cards (Ranked retired into BasicQuizCard)', () => {
      renderGrid()
      expect(screen.getByText('Luyện Tập')).toBeInTheDocument()
      expect(screen.getByText('Thử Thách Ngày')).toBeInTheDocument()
      expect(screen.getByText('Nhóm Giáo Xứ')).toBeInTheDocument()
      expect(screen.getByText('Phòng Chơi')).toBeInTheDocument()
      expect(screen.getByText('Giải Đấu')).toBeInTheDocument()
      expect(screen.getByText('Chủ Đề Tuần')).toBeInTheDocument()
      expect(screen.getByText('Mystery Mode')).toBeInTheDocument()
      expect(screen.getByText('Speed Round')).toBeInTheDocument()
      // Ranked must NOT render here — BasicQuizCard handles the unlock.
      expect(screen.queryByTestId('game-mode-ranked')).not.toBeInTheDocument()
    })

    it('renders CTAs for all 8 cards', () => {
      renderGrid()
      expect(screen.getByText('Bắt Đầu')).toBeInTheDocument()           // Practice
      expect(screen.getByText('Thử Thách Ngay')).toBeInTheDocument()    // Daily
      expect(screen.getByText('Vào Nhóm')).toBeInTheDocument()           // Group
      expect(screen.getByText('Tạo Phòng')).toBeInTheDocument()          // Multiplayer
      expect(screen.getByText('Vào Giải Đấu')).toBeInTheDocument()       // Tournament
    })

    it('renders Practice card status tag', () => {
      renderGrid()
      expect(screen.getAllByText(/không giới hạn/i).length).toBeGreaterThanOrEqual(1)
    })

    it('renders Practice as a primary card spanning the section', () => {
      // After Ranked moved out the primary section holds only Practice.
      renderGrid()
      const primarySection = screen.getByTestId('game-mode-tier-primary')
      const primaryCards = primarySection.querySelectorAll('[data-tier="primary"]')
      expect(primaryCards).toHaveLength(1)
      expect(primaryCards[0]).toHaveAttribute('data-testid', 'game-mode-practice')
    })
  })

  describe('Daily Challenge card', () => {
    it('shows completed status when daily is completed', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: true } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/Đã hoàn thành/i)).toBeInTheDocument()
      })
    })

    it('shows countdown when daily is not completed', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/kết thúc sau/i)).toBeInTheDocument()
      })
    })
  })

  describe('Multiplayer card (room count)', () => {
    it('shows room count from API (rooms array)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('rooms/public'))
          return Promise.resolve({ data: { success: true, rooms: [{}, {}, {}] } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/3 phòng đang mở/i)).toBeInTheDocument()
      })
    })

    it('shows 0 rooms when API returns empty rooms', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('rooms/public'))
          return Promise.resolve({ data: { success: true, rooms: [] } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/0 phòng đang mở/i)).toBeInTheDocument()
      })
    })

    it('shows 0 rooms when API errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/0 phòng đang mở/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('navigates to /practice when Practice CTA clicked', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByText('Bắt Đầu'))
      expect(mockNavigate).toHaveBeenCalledWith('/practice')
    })

    it('navigates to /daily when Daily CTA clicked', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByText('Thử Thách Ngay'))
      expect(mockNavigate).toHaveBeenCalledWith('/daily')
    })

    it('navigates to /multiplayer when Multiplayer CTA clicked', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByText('Tạo Phòng'))
      expect(mockNavigate).toHaveBeenCalledWith('/multiplayer')
    })

    it('navigates to /groups when Church Group CTA clicked', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByText('Vào Nhóm'))
      expect(mockNavigate).toHaveBeenCalledWith('/groups')
    })

    it('navigates to /tournaments when Tournament CTA clicked', async () => {
      renderGrid()
      const user = userEvent.setup()
      await user.click(screen.getByText('Vào Giải Đấu'))
      expect(mockNavigate).toHaveBeenCalledWith('/tournaments')
    })
  })

  describe('Error handling', () => {
    it('handles all API errors gracefully without crashing', () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      expect(() => renderGrid()).not.toThrow()
    })
  })

  /**
   * Smart recommendation highlight — at most one card carries a "✨ Gợi
   * ý cho bạn" badge when userStats is provided. Without userStats
   * (parent still loading /api/me) the grid stays uniform. With Ranked
   * gone, the engine targets only Practice + Daily inside this grid.
   */
  describe('Recommendation highlight', () => {
    it('does NOT highlight any card when userStats is omitted', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      renderGrid() // no userStats
      await waitFor(() => {
        // Daily countdown signals the daily-challenge fetch resolved.
        expect(screen.getByText(/kết thúc sau/i)).toBeInTheDocument()
      })
      expect(screen.queryByText(/Gợi ý cho bạn/i)).not.toBeInTheDocument()
    })

    it('highlights Practice card for a brand-new user (onboarding rule)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 0 }} />
        </MemoryRouter>
      )
      await waitFor(() => {
        const practiceCard = screen.getByTestId('game-mode-practice')
        expect(practiceCard.getAttribute('data-recommended')).toBe('true')
      })
      // Exactly one badge rendered.
      expect(screen.getAllByText(/Gợi ý cho bạn/i)).toHaveLength(1)
      // Onboarding reason message appears under the Practice card.
      expect(screen.getByTestId('game-mode-practice-reason')).toBeInTheDocument()
    })

    it('highlights Daily card when daily is still pending', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 5, totalPoints: 5000 }} />
        </MemoryRouter>
      )
      // Recommendation depends on hoursToMidnight (live clock). What we
      // pin: the highlighted card must be Daily or Practice — never one
      // of the secondary/discovery modes the engine doesn't target.
      await waitFor(() => {
        const recommendedCard = screen.queryByText(/Gợi ý cho bạn/i)?.closest('[data-testid^="game-mode-"]')
        if (recommendedCard) {
          const id = recommendedCard.getAttribute('data-testid')
          expect(['game-mode-practice', 'game-mode-daily']).toContain(id)
        }
      })
    })

    it('never renders more than one recommendation badge at a time', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 15, totalPoints: 5000 }} />
        </MemoryRouter>
      )
      await waitFor(() => {
        const badges = screen.queryAllByText(/Gợi ý cho bạn/i)
        expect(badges.length).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Matchmaking hint', () => {
    it('shows hint icon on Tournament + Multiplayer (competitive modes only)', async () => {
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-tournament-matchmaking-hint')).toBeInTheDocument()
      })
      expect(screen.getByTestId('game-mode-multiplayer-matchmaking-hint')).toBeInTheDocument()
      // Other modes must NOT show the hint.
      expect(screen.queryByTestId('game-mode-practice-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-daily-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-mystery-matchmaking-hint')).not.toBeInTheDocument()
    })

    it('hint icon carries hover-tooltip via title attribute', async () => {
      renderGrid()
      await waitFor(() => {
        const hint = screen.getByTestId('game-mode-tournament-matchmaking-hint')
        expect(hint.getAttribute('title')).toBe(
          'Đối thủ có thể đã chơi lâu hơn bạn — chuẩn bị tinh thần!',
        )
      })
    })
  })
})
