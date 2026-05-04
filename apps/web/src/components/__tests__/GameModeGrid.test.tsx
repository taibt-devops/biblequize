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

    it('Practice card uses blue theme (HR-4b: arrow-link CTA)', async () => {
      // HR-4b moves Practice/Ranked to the mockup .mode-card layout —
      // the whole card is the click target, the CTA is now a text+arrow
      // affordance. Theme color lives in the arrow text (#60a5fa) and
      // the card's data-theme attribute.
      renderGrid()
      const card = screen.getByTestId('featured-card-practice')
      expect(card).toHaveAttribute('data-theme', 'blue')
      const cta = screen.getByTestId('featured-card-practice-cta')
      expect(cta.className).toContain('#60a5fa')
      expect(cta.className).not.toContain('gold-gradient')
    })

    it('Ranked card uses gold theme on arrow CTA (regression guard)', async () => {
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
      const card = await screen.findByTestId('featured-card-ranked')
      expect(card).toHaveAttribute('data-theme', 'gold')
      const cta = await screen.findByTestId('featured-card-ranked-cta')
      // HR-4b: CTA is now a text+arrow link colored via tokens.arrowText.
      expect(cta.className).toContain('text-secondary')
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
      // HR-4b: disabled state is on the parent card (whole card is the
      // click target); the arrow CTA is just a visual span inside it.
      const card = screen.getByTestId('featured-card-ranked') as HTMLButtonElement
      expect(card).toBeDisabled()
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
      // HR-4: tournament is tier-locked < 15000 XP. Pass userStats above
      // the threshold so the click handler is wired.
      renderGrid({ userStats: { totalPoints: 50000, currentStreak: 5 } })
      const user = userEvent.setup()
      await user.click(screen.getByTestId('compact-card-tournament'))
      expect(mockNavigate).toHaveBeenCalledWith('/tournaments')
    })

    it('matchmaking-hint icon shown on Tournament + Multiplayer only', async () => {
      // HR-4: matchmaking-hint replaced by lock-chip when locked. Use
      // unlocked stats here.
      renderGrid({ userStats: { totalPoints: 50000, currentStreak: 5 } })
      expect(screen.getByTestId('compact-card-tournament-matchmaking-hint')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-multiplayer-matchmaking-hint')).toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-group-matchmaking-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-weekly-matchmaking-hint')).not.toBeInTheDocument()
    })

    // ── H4: themed cards + live data hints ────────────────────────────

    it('each compact card carries its mockup theme color (inline bg)', async () => {
      // Spot-check 3 of 6 cards — full audit lives in COMPACT_CARDS.
      // Group = #4a9eff (74,158,255), mystery = #d4537e (212,83,126),
      // speed = #ff8c42 (255,140,66).
      renderGrid()
      const group = screen.getByTestId('compact-card-group')
      expect(group.getAttribute('style')).toMatch(/74\s*,\s*158\s*,\s*255/)
      const mystery = screen.getByTestId('compact-card-mystery')
      expect(mystery.getAttribute('style')).toMatch(/212\s*,\s*83\s*,\s*126/)
      const speed = screen.getByTestId('compact-card-speed')
      expect(speed.getAttribute('style')).toMatch(/255\s*,\s*140\s*,\s*66/)
    })

    it('mystery + speed render NO XP hint (HR-4b fix: variety = for fun, no XP)', async () => {
      // DECISIONS.md 2026-05-02 — Mystery/Speed grant no XP and don't
      // affect leaderboard. The earlier "+50% XP" / "+100% XP" labels
      // were misleading and have been removed; subtitle is the only
      // descriptive text these cards carry.
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-mystery')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('compact-card-mystery-hint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-speed-hint')).not.toBeInTheDocument()
    })

    it('multiplayer renders live "{N} phòng đang mở" when /api/rooms/public has data', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/rooms/public')) {
          return Promise.resolve({ data: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] })
        }
        if (url.includes('/api/quiz/weekly/theme')) {
          return Promise.resolve({ data: { themeName: 'Phép lạ Chúa Giê-su' } })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-multiplayer-hint').textContent).toContain('3')
      })
      expect(screen.getByTestId('compact-card-weekly-hint').textContent).toContain('Phép lạ')
    })

    it('group hint shows "Trong {name}" when /api/groups/me returns hasGroup=true', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/groups/me')) {
          return Promise.resolve({ data: { hasGroup: true, groupName: 'Hội Thánh Phước Lành', memberCount: 12 } })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-group-hint').textContent).toContain('Hội Thánh Phước Lành')
      })
    })

    it('group hint shows "Bạn chưa có nhóm" when /api/groups/me returns hasGroup=false', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/groups/me')) {
          return Promise.resolve({ data: { hasGroup: false } })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-group-hint').textContent).toMatch(/chưa có nhóm/i)
      })
    })

    it('tournament hint shows count when /api/tournaments/upcoming has lobby items', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/tournaments/upcoming')) {
          return Promise.resolve({ data: { count: 2, next: { id: 't1', name: 'Spring Cup' } } })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      // HR-4: tournament locked < 15000 XP — use stats above threshold.
      renderGrid({ userStats: { totalPoints: 50000, currentStreak: 5 } })
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-tournament-hint').textContent).toContain('2')
      })
    })

    it('tournament hint hides when count is 0', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/tournaments/upcoming')) {
          return Promise.resolve({ data: { count: 0, next: null } })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      renderGrid()
      // HR-4b: mystery-hint removed (no XP for variety modes). Wait
      // for the card itself to confirm the grid mounted.
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-mystery')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('compact-card-tournament-hint')).not.toBeInTheDocument()
    })

    it('multiplayer hint hides when rooms endpoint returns empty', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/daily-challenge')) {
          return Promise.resolve({ data: { alreadyCompleted: false } })
        }
        if (url.includes('/api/basic-quiz/status')) {
          return Promise.resolve({
            data: { passed: false, cooldownRemainingSeconds: 0, attemptCount: 0,
                    totalQuestions: 10, threshold: 8 },
          })
        }
        if (url.includes('/api/rooms/public')) {
          return Promise.resolve({ data: [] })
        }
        return Promise.reject(new Error('Not mocked: ' + url))
      })
      renderGrid()
      // HR-4b: mystery-hint removed. Wait for the multiplayer card
      // itself to assert mount, then probe for the absent hint.
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-multiplayer')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('compact-card-multiplayer-hint')).not.toBeInTheDocument()
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

  // ── HR-4: 3-section split + tier-locked overlays ────────────────

  describe('HR-4 sections', () => {
    it('renders Primary section header "Chế độ chơi chính" (HR-4b)', async () => {
      renderGrid()
      await waitFor(() => {
        expect(screen.getByText('Chế độ chơi chính')).toBeInTheDocument()
      })
    })

    it('renders Variety section header + 3 variety cards', async () => {
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-tier-variety')).toBeInTheDocument()
      })
      expect(screen.getByTestId('compact-card-weekly')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-mystery')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-speed')).toBeInTheDocument()
    })

    it('renders Group section with Group + Multiplayer + Tournament', async () => {
      renderGrid()
      await waitFor(() => {
        expect(screen.getByTestId('game-mode-tier-group')).toBeInTheDocument()
      })
      expect(screen.getByTestId('compact-card-group')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-multiplayer')).toBeInTheDocument()
      expect(screen.getByTestId('compact-card-tournament')).toBeInTheDocument()
    })

    it('locks Tournament for new user; Multiplayer stays unlocked (Bui 2026-05-05)', async () => {
      renderGrid({ userStats: { currentStreak: 0, totalPoints: 0 } })
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-tournament-lock-chip')).toBeInTheDocument()
      })
      expect(screen.getByTestId('compact-card-tournament-lock-reason').textContent)
        .toMatch(/Hiền Triết/)
      // Multiplayer is open to everyone — anyone can join a room.
      expect(screen.queryByTestId('compact-card-multiplayer-lock-chip')).not.toBeInTheDocument()
    })

    it('Multiplayer click navigates to /multiplayer at any tier', async () => {
      renderGrid({ userStats: { currentStreak: 0, totalPoints: 0 } })
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-multiplayer')).toBeInTheDocument()
      })
      const user = userEvent.setup()
      await user.click(screen.getByTestId('compact-card-multiplayer'))
      expect(mockNavigate).toHaveBeenCalledWith('/multiplayer')
    })

    it('Variety modes are NEVER locked even at 0 XP', async () => {
      renderGrid({ userStats: { currentStreak: 0, totalPoints: 0 } })
      await waitFor(() => {
        expect(screen.getByTestId('compact-card-weekly')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('compact-card-weekly-lock-chip')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-mystery-lock-chip')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compact-card-speed-lock-chip')).not.toBeInTheDocument()
    })
  })
})
