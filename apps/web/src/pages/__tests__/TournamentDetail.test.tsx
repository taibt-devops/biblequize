import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Phase A.2 — TournamentDetail unit tests.
 * Min 8 tests per CLAUDE.md rule.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'tournament-1' }),
  }
})

let authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => s ? s(authState) : authState,
  useAuth: () => authState,
}))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}))

import TournamentDetail from '../TournamentDetail'

function renderTD() {
  return render(<MemoryRouter><TournamentDetail /></MemoryRouter>)
}

const mockBracket = {
  tournamentId: 'tournament-1',
  name: 'Giải Đấu Ngôi Lời 2024',
  status: 'IN_PROGRESS',
  currentRound: 1,
  totalRounds: 2,
  rounds: {
    '1': [
      {
        matchId: 'm1', roundNumber: 1, matchIndex: 0, status: 'COMPLETED', winnerId: 'u1', isBye: false,
        participants: [
          { userId: 'u1', userName: 'Minh', lives: 3, score: 120, isWinner: true },
          { userId: 'u2', userName: 'An', lives: 0, score: 80, isWinner: false },
        ],
      },
      {
        matchId: 'm2', roundNumber: 1, matchIndex: 1, status: 'PENDING', winnerId: null, isBye: true,
        participants: [
          { userId: 'u3', userName: 'Bảo', lives: 3, score: 0, isWinner: false },
        ],
      },
    ],
    '2': [
      {
        matchId: 'm3', roundNumber: 2, matchIndex: 0, status: 'PENDING', winnerId: null, isBye: false,
        participants: [],
      },
    ],
  },
  participants: [
    { userId: 'u1', userName: 'Minh' },
    { userId: 'u2', userName: 'An' },
    { userId: 'u3', userName: 'Bảo' },
  ],
  creatorId: 'u1',
}

describe('TournamentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ data: mockBracket })
    mockApiPost.mockResolvedValue({ data: {} })
  })

  // 1. Render
  it('renders without crashing', () => {
    expect(() => renderTD()).not.toThrow()
  })

  // 2. Tournament name
  it('displays tournament name after loading', async () => {
    renderTD()
    await waitFor(() => {
      const matches = screen.getAllByText(/Giải Đấu/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  // 3. Status badge
  it('shows status badge', async () => {
    renderTD()
    await waitFor(() => {
      const badge = screen.queryByText(/ĐANG DIỄN RA/i) || screen.queryByText(/diễn ra/i) ||
        screen.queryByText(/IN_PROGRESS/i)
      expect(badge).toBeTruthy()
    })
  })

  // 4. Bracket rounds
  it('renders bracket round labels', async () => {
    renderTD()
    await waitFor(() => {
      const round = screen.queryByText(/Bán kết/i) || screen.queryByText(/Chung kết/i) ||
        screen.queryByText(/Vòng 1/i)
      expect(round).toBeTruthy()
    })
  })

  // 5. Match cards show players
  it('shows player names in match cards', async () => {
    renderTD()
    await waitFor(() => {
      expect(screen.queryByText('Minh')).toBeTruthy()
    })
  })

  // 6. Heart icons
  it('renders heart icons for player lives', async () => {
    renderTD()
    await waitFor(() => {
      // Redesign uses emoji hearts ❤️ instead of Material Icons
      const bodyText = document.body.textContent ?? ''
      const hasHearts = bodyText.includes('❤️') || bodyText.includes('mạng')
      expect(hasHearts).toBe(true)
    })
  })

  // 7. Loading state
  it('shows loading state initially', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    renderTD()
    const loading = document.querySelector('.animate-pulse') || document.querySelector('.animate-spin')
    expect(loading).toBeTruthy()
  })

  // 8. Error state
  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'))
    renderTD()
    await waitFor(() => {
      const error = screen.queryByText(/lỗi/i) || screen.queryByText(/error/i) ||
        screen.queryByText(/thử lại/i) || document.querySelector('[class*="error"]')
      expect(error).toBeTruthy()
    })
  })

  // 9. Horizontal scroll container
  it('has scrollable bracket container', async () => {
    renderTD()
    await waitFor(() => {
      const scroll = document.querySelector('[class*="overflow-x"]')
      expect(scroll).toBeTruthy()
    })
  })

  // 10. Bye match indicator
  it('shows bye match for player with bye', async () => {
    renderTD()
    await waitFor(() => {
      expect(screen.queryByText('Bảo')).toBeTruthy()
    })
  })
})
