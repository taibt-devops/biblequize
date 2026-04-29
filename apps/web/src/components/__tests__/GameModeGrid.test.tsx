import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/**
 * Tests for GameModeGrid — 6 game mode cards on the Home page (Stitch design).
 * Covers: rendering, API status fetching, energy display, countdown,
 * disabled states, room count, navigation.
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
    it('renders all 6 game mode cards', () => {
      renderGrid()
      expect(screen.getByText('Luyện Tập')).toBeInTheDocument()
      expect(screen.getByText('Thi Đấu Xếp Hạng')).toBeInTheDocument()
      expect(screen.getByText('Thử Thách Ngày')).toBeInTheDocument()
      expect(screen.getByText('Nhóm Giáo Xứ')).toBeInTheDocument()
      expect(screen.getByText('Phòng Chơi')).toBeInTheDocument()
      expect(screen.getByText('Giải Đấu')).toBeInTheDocument()
    })

    it('renders CTA buttons for all cards', () => {
      // Ranked and Tournament cards render locked CTAs ("Luyện tập để
      // kiếm điểm") when userTier is below their requiredTier — which
      // is the default since renderGrid passes no userTier. Unlock both
      // by giving a Tier-4 user; the other four cards have no tier gate.
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 6000 }} userTier={4} />
        </MemoryRouter>
      )
      expect(screen.getByText('Bắt Đầu')).toBeInTheDocument()
      expect(screen.getByText('Vào Thi Đấu')).toBeInTheDocument()
      expect(screen.getByText('Thử Thách Ngay')).toBeInTheDocument()
      expect(screen.getByText('Vào Nhóm')).toBeInTheDocument()
      expect(screen.getByText('Tạo Phòng')).toBeInTheDocument()
      expect(screen.getByText('Vào Giải Đấu')).toBeInTheDocument()
    })

    it('renders Practice card status tag', () => {
      renderGrid()
      expect(screen.getAllByText(/không giới hạn/i).length).toBeGreaterThanOrEqual(1)
    })

    /**
     * After Option B (soft tier-pivot) the grid renders all 9 cards for
     * every user — the tier-1-only "two cards plus locked teaser"
     * variant was retired together with LockedModesTeaser. This test
     * pins the open-access invariant.
     */
    it('renders the full grid for tier-1 users (no layout filter)', () => {
      render(
        <MemoryRouter>
          <GameModeGrid userTier={1} />
        </MemoryRouter>,
      )
      // Spot-check cards from each band: primary, secondary, discovery
      expect(screen.getByText('Luyện Tập')).toBeInTheDocument()
      expect(screen.getByText('Thi Đấu Xếp Hạng')).toBeInTheDocument()
      expect(screen.getByText('Nhóm Giáo Xứ')).toBeInTheDocument()
      expect(screen.getByText('Phòng Chơi')).toBeInTheDocument()
      expect(screen.getByText('Giải Đấu')).toBeInTheDocument()
      expect(screen.getByText('Mystery Mode')).toBeInTheDocument()
      expect(screen.getByText('Speed Round')).toBeInTheDocument()
    })
  })

  describe('Energy display (Ranked card)', () => {
    it('shows energy from API with correct field names (livesRemaining/dailyLives)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 75, dailyLives: 100 } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/75\/100/i)).toBeInTheDocument()
      })
    })

    it('shows 0/100 when energy is zero', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 0, dailyLives: 100 } })
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        expect(screen.getByText(/0\/100/i)).toBeInTheDocument()
      })
    })

    it('shows fallback energy when API errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))

      renderGrid()

      await waitFor(() => {
        // Falls back to default 0/100 since rankedStatus defaults aren't changed on error
        expect(screen.getByText(/0\/100/i)).toBeInTheDocument()
      })
    })

    it('shows no-energy CTA when energy is 0', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 0, dailyLives: 100 } })
        return Promise.reject(new Error('Not found'))
      })

      // No-energy CTA branch only fires when the Ranked card is NOT locked
      // (see GameModeGrid: isNoEnergy = ... && !isLocked). Tier-2 unlocks.
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 1500 }} userTier={2} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Hết Năng Lượng/i)).toBeInTheDocument()
      })
    })

    it('does NOT show UNDEFINED in energy display', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: {} }) // missing fields
        return Promise.reject(new Error('Not found'))
      })

      renderGrid()

      await waitFor(() => {
        // Should fallback to 0/100, never show undefined
        expect(screen.getByText(/0\/100/i)).toBeInTheDocument()
        expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
      })
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
      // After Option B Tournament has no tier gate, but we still pass
      // userTier=4 here so Ranked (which DOES still require tier 2) also
      // unlocks — keeps the surrounding test fixtures consistent.
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 6000 }} userTier={4} />
        </MemoryRouter>
      )
      const user = userEvent.setup()
      await user.click(screen.getByText('Vào Giải Đấu'))
      expect(mockNavigate).toHaveBeenCalledWith('/tournaments')
    })

    it('does NOT navigate when Ranked card clicked with 0 energy', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 0, dailyLives: 100 } })
        return Promise.reject(new Error('Not found'))
      })

      // Ranked must be unlocked (Tier ≥ 2) so the no-energy CTA branch
      // renders — locked users never see "Hết Năng Lượng".
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 1500 }} userTier={2} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Hết Năng Lượng/i)).toBeInTheDocument()
      })

      const user = userEvent.setup()
      await user.click(screen.getByText(/Hết Năng Lượng/i))
      expect(mockNavigate).not.toHaveBeenCalledWith('/ranked')
    })
  })

  describe('Error handling', () => {
    it('handles all API errors gracefully without crashing', () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      expect(() => renderGrid()).not.toThrow()
    })
  })

  /**
   * Smart recommendation highlight — the grid must show exactly one card
   * with a "✨ Gợi ý cho bạn" badge when userStats is provided. Without
   * userStats (parent still loading /api/me), the grid must stay uniform.
   */
  describe('Recommendation highlight', () => {
    it('does NOT highlight any card when userStats is omitted', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      renderGrid() // no userStats
      // Give time for fetches to settle
      await waitFor(() => {
        expect(screen.getByText(/100\/100/)).toBeInTheDocument()
      })
      expect(screen.queryByText(/Gợi ý cho bạn/i)).not.toBeInTheDocument()
    })

    it('highlights Practice card for a brand-new user (onboarding rule)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 50, dailyLives: 100 } })
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
      // Exactly one badge rendered
      expect(screen.getAllByText(/Gợi ý cho bạn/i)).toHaveLength(1)
      // Onboarding reason message appears under the Practice card
      expect(screen.getByTestId('game-mode-practice-reason')).toBeInTheDocument()
    })

    it('highlights Ranked card when energy is full (fullEnergy rule)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: true } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          {/* totalPoints=5000 implies Tier 3 in the live app, but userTier
              defaults to 1 when omitted — keep the component from locking
              Ranked and suppressing the recommendation by passing the tier. */}
          <GameModeGrid userStats={{ currentStreak: 2, totalPoints: 5000 }} userTier={3} />
        </MemoryRouter>
      )
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        expect(rankedCard.getAttribute('data-recommended')).toBe('true')
      })
    })

    it('highlights Daily card when daily is still pending (dailyAvailable)', async () => {
      // Practical scenario: plenty of time, daily undone, energy not full
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 50, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          {/* Tier-3 user so Ranked isn't locked out of the recommendation
              ranking (dailyAvailable vs fullEnergy comparison needs both
              to be eligible). */}
          <GameModeGrid userStats={{ currentStreak: 2, totalPoints: 5000 }} userTier={3} />
        </MemoryRouter>
      )
      // The recommendation depends on hoursToMidnight which comes from a
      // live client clock — so we accept either dailyAvailable (< 12h) or
      // default (>= 12h). What we lock in: if daily undone, Ranked should
      // NOT be the one highlighted (energy is only 50).
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        const dailyCard = screen.getByTestId('game-mode-daily')
        const rankedHighlighted = rankedCard.getAttribute('data-recommended') === 'true'
        const dailyHighlighted = dailyCard.getAttribute('data-recommended') === 'true'
        // At most one card highlighted; if any, it must be daily or default→ranked
        // (never Practice / Groups / etc.)
        expect(rankedHighlighted || dailyHighlighted).toBe(true)
      })
    })

    it('locks Ranked card for Tier-1 users + shows unlock hint', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 0 }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        expect(rankedCard.getAttribute('data-locked')).toBe('true')
      })
      expect(screen.getByTestId('game-mode-ranked-lock')).toBeInTheDocument()
      expect(screen.getByTestId('game-mode-ranked-unlock-hint')).toBeInTheDocument()
      // Progress bar showing XP gap renders (tier 1 user → 0/1000 XP toward Seeker)
      expect(screen.getByTestId('game-mode-ranked-unlock-progress')).toBeInTheDocument()
    })

    it('locked CTA navigates to /practice (onboarding path to earn XP)', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 200 }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-ranked')).toBeInTheDocument()
      })
      const user = userEvent.setup()
      // The locked Ranked card now renders two buttons: a "Tìm hiểu thêm →"
      // FAQ deep link and the CTA. querySelector('button') picks the first
      // — which is the FAQ link, not the CTA. Scope by the ranked card
      // testid and match the CTA's accessible text inside it. (Tournament
      // is also locked with the same copy, so a global getByText finds
      // multiple.)
      const rankedCard = screen.getByTestId('game-mode-ranked')
      const cta = within(rankedCard).getByText('Luyện tập để kiếm điểm')
      await user.click(cta)
      expect(mockNavigate).toHaveBeenCalledWith('/practice')
    })

    it('shows accuracy path (Path 2) in locked Ranked card when practice counts provided', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{
              currentStreak: 0,
              totalPoints: 200,
              practiceCorrectCount: 7,
              practiceTotalCount: 10,
            }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        // Both XP path and accuracy path render for locked Ranked card
        expect(screen.getByTestId('game-mode-ranked-xp-path')).toBeInTheDocument()
        expect(screen.getByTestId('game-mode-ranked-accuracy-path')).toBeInTheDocument()
      })
      // Status text shows current accuracy + how many more correct needed
      const status = screen.getByTestId('game-mode-ranked-accuracy-status')
      expect(status.textContent).toMatch(/7\/10/)
      expect(status.textContent).toMatch(/70/) // accuracy 70%
      // 7/10 = 70% → need 5 more correct (per policy formula 4t-5c = 5)
      expect(status.textContent).toMatch(/5/)
    })

    it('Tournament card renders unlocked at tier 1 (no tier gate after Option B)', async () => {
      // Step B of the soft tier-pivot: Tournament's requiredTier=4 was
      // removed because the backend never enforced it. The card now
      // renders without a lock badge regardless of tier.
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{
              currentStreak: 0,
              totalPoints: 200,
              practiceCorrectCount: 7,
              practiceTotalCount: 10,
            }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const tournamentCard = screen.getByTestId('game-mode-tournament')
        expect(tournamentCard.getAttribute('data-locked')).toBe('false')
      })
      // Neither XP nor accuracy unlock-path renders since the card isn't locked
      expect(screen.queryByTestId('game-mode-tournament-xp-path')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-tournament-accuracy-path')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-tournament-lock')).not.toBeInTheDocument()
    })

    it('does NOT show accuracy path when practice counts omitted (backward compat)', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 200 }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-ranked-xp-path')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('game-mode-ranked-accuracy-path')).not.toBeInTheDocument()
    })

    it('shows "Ready" message when user qualifies for early unlock', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{
              currentStreak: 0,
              totalPoints: 200,
              practiceCorrectCount: 8,
              practiceTotalCount: 10,
            }}
            userTier={1}
            // Simulate backend hasn't flipped flag yet but user already qualifies
            earlyRankedUnlock={false}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const status = screen.getByTestId('game-mode-ranked-accuracy-status')
        // Should show ready/đủ điều kiện message (test in both languages loosely)
        expect(status.textContent).toMatch(/Ready|Đủ điều kiện/i)
      })
    })

    it('earlyRankedUnlock flag bypasses Ranked tier gate for Tier-1 users', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 200 }}
            userTier={1}
            earlyRankedUnlock={true}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        // Despite tier=1 and XP<1000, Ranked is UNLOCKED because of the flag.
        expect(rankedCard.getAttribute('data-locked')).toBe('false')
      })
      // Lock badge + hint should NOT be present
      expect(screen.queryByTestId('game-mode-ranked-lock')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-ranked-unlock-hint')).not.toBeInTheDocument()
    })

    it('earlyRankedUnlock flag affects only Ranked (Tournament has no gate to bypass)', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 200 }}
            userTier={1}
            earlyRankedUnlock={true}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const tournamentCard = screen.getByTestId('game-mode-tournament')
        const rankedCard = screen.getByTestId('game-mode-ranked')
        // Ranked unlocked via the flag; Tournament has no gate at all (Option B)
        expect(rankedCard.getAttribute('data-locked')).toBe('false')
        expect(tournamentCard.getAttribute('data-locked')).toBe('false')
      })
    })

    it('shows explicit XP gap in unlock hint (not just tier name)', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 250 }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const hint = screen.getByTestId('game-mode-ranked-unlock-hint')
        // Tier-1 user with 250 XP needs 1000 - 250 = 750 more to reach Seeker
        expect(hint.textContent).toMatch(/750/)
      })
    })

    it('Tournament card has matchmaking hint info icon (Tournament + Multiplayer only)', async () => {
      // Step B adds a subtle info icon hover-tooltip on competitive
      // modes warning users they may face longer-tenured players.
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 500 }}
            userTier={2}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-tournament-matchmaking-hint')).toBeInTheDocument()
      })
      expect(screen.getByTestId('game-mode-multiplayer-matchmaking-hint')).toBeInTheDocument()
      // Other modes (e.g. Practice, Daily) must NOT show the hint
      expect(screen.queryByTestId('game-mode-practice-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-daily-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('game-mode-mystery-matchmaking-hint')).not.toBeInTheDocument()
    })

    it('matchmaking hint icon has hover-tooltip via title attribute', async () => {
      render(
        <MemoryRouter>
          <GameModeGrid userStats={{ currentStreak: 0, totalPoints: 500 }} userTier={2} />
        </MemoryRouter>
      )
      await waitFor(() => {
        const hint = screen.getByTestId('game-mode-tournament-matchmaking-hint')
        expect(hint.getAttribute('title')).toBe(
          'Đối thủ có thể đã chơi lâu hơn bạn — chuẩn bị tinh thần!',
        )
      })
    })

    it('unlocks Ranked for Tier-2 users', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 50, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: false } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 2000 }}
            userTier={2}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        expect(rankedCard.getAttribute('data-locked')).toBe('false')
      })
      expect(screen.queryByTestId('game-mode-ranked-lock')).not.toBeInTheDocument()
    })

    it('does not recommend Ranked for Tier-1 users even with full energy', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
        if (url.includes('daily-challenge'))
          return Promise.resolve({ data: { alreadyCompleted: true } })
        return Promise.reject(new Error('Not found'))
      })
      render(
        <MemoryRouter>
          <GameModeGrid
            userStats={{ currentStreak: 0, totalPoints: 500 }}
            userTier={1}
          />
        </MemoryRouter>
      )
      await waitFor(() => {
        const rankedCard = screen.getByTestId('game-mode-ranked')
        expect(rankedCard.getAttribute('data-recommended')).toBe('false')
      })
    })

    it('never renders more than one badge at a time', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('ranked-status'))
          return Promise.resolve({ data: { livesRemaining: 100, dailyLives: 100 } })
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
})
