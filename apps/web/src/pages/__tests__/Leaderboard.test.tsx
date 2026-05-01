import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({ api: { get: (...a: any[]) => mockApiGet(...a) } }))

// authStore.User has NO `id` field in production (only name/email/avatar/role/currentStreak).
// Leaderboard now identifies current user via my-rank API response (userId field).
let authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test User', email: 'a@b.com' } }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => s ? s(authState) : authState,
  useAuth: () => authState,
}))

import Leaderboard from '../Leaderboard'

const MOCK_ENTRIES = [
  { userId: 'u2', name: 'Player 1', points: 15820, avatarUrl: null },
  { userId: 'u3', name: 'Player 2', points: 12450, avatarUrl: null },
  { userId: 'u4', name: 'Player 3', points: 11200, avatarUrl: null },
  { userId: 'u5', name: 'Player 4', points: 9840, avatarUrl: null },
  { userId: 'u1', name: 'Test User', points: 4520, avatarUrl: null },
]

function renderLeaderboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><Leaderboard /></MemoryRouter></QueryClientProvider>)
}

describe('Leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      // my-rank includes userId so FE can identify current user in list
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 5, points: 4520 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: MOCK_ENTRIES })
      if (url.includes('/seasons/active')) return Promise.resolve({ data: {
        active: true,
        id: 'season-2026-q2',
        name: 'Mùa Ngũ Tuần 2026',
        startDate: '2026-04-01',
        endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      } })
      // Test User has 4520 points → tier "seeker" (1,000-4,999 range)
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 4520 } })
      return Promise.reject(new Error('Not found'))
    })
  })

  it('renders page title', async () => {
    renderLeaderboard()
    expect(screen.getByText(/Bảng Xếp Hạng/i)).toBeInTheDocument()
  })

  it('renders top 3 podium from API', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 1')).toBeInTheDocument() })
    expect(screen.getByText('Player 2')).toBeInTheDocument()
    expect(screen.getByText('Player 3')).toBeInTheDocument()
  })

  it('renders leaderboard entries from API', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
  })

  it('highlights current user', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getAllByText('Bạn').length).toBeGreaterThan(0) })
  })

  it('LB-2.2: renders 3 tab buttons — no Daily, dynamic Mùa label', async () => {
    renderLeaderboard()
    // Daily tab REMOVED in LB-2 (decision 2026-05-01)
    expect(screen.queryByText('Hàng ngày')).not.toBeInTheDocument()
    expect(screen.getByText('Hàng tuần')).toBeInTheDocument()
    // Tab "Mùa" label is dynamic — uses active season name uppercased
    await waitFor(() => {
      expect(screen.getByText('MÙA NGŨ TUẦN 2026')).toBeInTheDocument()
    })
    expect(screen.getByText('Tất cả')).toBeInTheDocument()
  })

  it('renders tier info section with 6 religious tiers', async () => {
    renderLeaderboard()
    expect(screen.getByText(/Xếp Hạng Mùa/i)).toBeInTheDocument()
    // 6 religious tier names render (decision A 2026-05-01)
    await waitFor(() => { expect(screen.getByText('Tân Tín Hữu')).toBeInTheDocument() })
    expect(screen.getByText('Người Tìm Kiếm')).toBeInTheDocument()
    expect(screen.getByText('Môn Đồ')).toBeInTheDocument()
    expect(screen.getByText('Hiền Triết')).toBeInTheDocument()
    expect(screen.getByText('Tiên Tri')).toBeInTheDocument()
    expect(screen.getByText('Sứ Đồ')).toBeInTheDocument()
    // No raw i18n key visible (LB-P0-1 fixed)
    expect(screen.queryByText('leaderboard.tierGold')).not.toBeInTheDocument()
    expect(screen.queryByText('leaderboard.tierSilver')).not.toBeInTheDocument()
  })

  it('highlights current user tier in tier section (BẠN badge)', async () => {
    renderLeaderboard()
    // Test User has 4,520 pts → tier 2 (seeker, 1,000-4,999)
    await waitFor(() => {
      const tier2Card = screen.getByTestId('leaderboard-tier-card-2')
      expect(tier2Card.className).toContain('border-secondary')
      // "Bạn" badge appears inside tier-2 card AND in list (current user row), so >= 1 expected
      expect(tier2Card.textContent).toContain('Bạn')
    })
  })

  it('renders tier section subtitle with season reward explanation', async () => {
    renderLeaderboard()
    await waitFor(() => {
      // Subtitle now interpolates active season name dynamically (LB-2.2)
      expect(screen.getByText(/Vinh Quang Mùa Ngũ Tuần 2026/i)).toBeInTheDocument()
    })
  })

  it('renders season countdown', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText(/Mùa kết thúc sau/i)).toBeInTheDocument() })
  })

  it('shows empty state when no data', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: [] })
      if (url.includes('/my-rank')) return Promise.resolve({ data: null })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText(/Chưa có dữ liệu/)).toBeInTheDocument() })
  })

  it('shows skeleton during loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderLeaderboard()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('LB-2.2: default tab fetches /leaderboard/weekly (Daily tab removed)', () => {
    renderLeaderboard()
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/leaderboard/weekly'))
    // Daily endpoint should NOT be called from /leaderboard page after Daily tab removal
    const dailyCalls = mockApiGet.mock.calls.filter((call) => String(call[0]).includes('/leaderboard/daily'))
    expect(dailyCalls).toHaveLength(0)
  })

  it('LB-2.2: tier section subtitle interpolates active season name', async () => {
    renderLeaderboard()
    await waitFor(() => {
      // Subtitle should mention active season name dynamically
      expect(screen.getByText(/Mùa Ngũ Tuần 2026/)).toBeInTheDocument()
    })
  })

  it('LB-2.2: tab "Mùa" falls back to generic "Mùa" when no active season (regression guard)', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 5, points: 4520 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: MOCK_ENTRIES })
      // Simulate no active season (BE returns active: false)
      if (url.includes('/seasons/active')) return Promise.resolve({ data: { active: false } })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 4520 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    // Tab label should be generic "Mùa" (uppercased by CSS), NOT outdated "Mùa Xuân"
    await waitFor(() => { expect(screen.getByText('Mùa')).toBeInTheDocument() })
    expect(screen.queryByText(/Mùa Xuân/)).not.toBeInTheDocument()
  })

  // LB-1.5 — Row enrichment per mockup
  it('LB-1.5: list rows show tier name below username', async () => {
    renderLeaderboard()
    // Player 4 (9840 pts) → tier 3 disciple "Môn Đồ"
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
    // Tier name appears in tier section + at least once in list rows (Player 4)
    expect(screen.getAllByText('Môn Đồ').length).toBeGreaterThanOrEqual(2)
  })

  it('LB-1.5: list row shows streak when entry.streak > 0', async () => {
    const ENTRIES_WITH_STREAK = [
      { userId: 'u2', name: 'Player A', points: 15820, avatarUrl: null, streak: 7 },
      { userId: 'u3', name: 'Player B', points: 12450, avatarUrl: null, streak: 0 }, // no streak
      { userId: 'u4', name: 'Player C', points: 11200, avatarUrl: null }, // missing field
      { userId: 'u5', name: 'Player D', points: 9840, avatarUrl: null, streak: 12 },
    ]
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 99 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: ENTRIES_WITH_STREAK })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 100 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player D')).toBeInTheDocument() })
    // Player D has streak 12 → fire emoji
    expect(screen.getByText(/🔥 12/)).toBeInTheDocument()
    // Player B has streak 0 → no fire emoji for them
    expect(screen.queryByText(/🔥 0/)).not.toBeInTheDocument()
  })

  it('LB-1.5: list row shows trend ▲▼ when entry.trend non-zero', async () => {
    // 3 podium entries + 4 list rows so trends render below podium (LeaderboardListRow)
    const ENTRIES_WITH_TREND = [
      { userId: 'u_top1', name: 'Top 1', points: 50000, avatarUrl: null },
      { userId: 'u_top2', name: 'Top 2', points: 40000, avatarUrl: null },
      { userId: 'u_top3', name: 'Top 3', points: 30000, avatarUrl: null },
      { userId: 'u2', name: 'Player A', points: 15820, avatarUrl: null, trend: 3 },
      { userId: 'u3', name: 'Player B', points: 12450, avatarUrl: null, trend: -1 },
      { userId: 'u4', name: 'Player C', points: 11200, avatarUrl: null, trend: 0 },
      { userId: 'u5', name: 'Player D', points: 9840, avatarUrl: null },
    ]
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 99 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: ENTRIES_WITH_TREND })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 100 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player D')).toBeInTheDocument() })
    // Player A: ▲ 3
    expect(screen.getByText(/▲ 3/)).toBeInTheDocument()
    // Player B: ▼ 1
    expect(screen.getByText(/▼ 1/)).toBeInTheDocument()
  })

  // LB-1.4 — Podium redesign per mockup
  it('LB-1.4: podium renders 3 ranks with Arabic numerals (no La Mã)', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByTestId('podium-rank-1')).toBeInTheDocument() })
    expect(screen.getByTestId('podium-rank-2')).toBeInTheDocument()
    expect(screen.getByTestId('podium-rank-3')).toBeInTheDocument()
    // No La Mã numerals
    const podium = screen.getByTestId('leaderboard-podium')
    expect(podium.textContent).not.toMatch(/\bI\b|\bII\b|\bIII\b/)
  })

  it('LB-1.4: podium #1 shows crown + gold glow', async () => {
    renderLeaderboard()
    await waitFor(() => {
      const rank1 = screen.getByTestId('podium-rank-1')
      // Crown emoji present
      expect(rank1.textContent).toContain('👑')
      // Gold glow class on avatar wrapper
      expect(rank1.innerHTML).toContain('rgba(232,168,50,0.4)')
    })
  })

  it('LB-1.3 + LB-2.2: clicking Season tab (dynamic name) fetches /api/leaderboard/season', async () => {
    renderLeaderboard()
    // Tab label is dynamic from active season — wait for it to render
    await waitFor(() => { expect(screen.getByText('MÙA NGŨ TUẦN 2026')).toBeInTheDocument() })
    fireEvent.click(screen.getByText('MÙA NGŨ TUẦN 2026'))
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/leaderboard/season'))
    })
  })

  // LB-1.2 — duplicate row prevention (regression guard)
  it('LB-1.2: dedupes user appearing twice in BE response', async () => {
    const DUPLICATE_ENTRIES = [
      { userId: 'u2', name: 'Player 1', points: 15820, avatarUrl: null },
      { userId: 'u3', name: 'Player 2', points: 12450, avatarUrl: null },
      { userId: 'u1', name: 'Test User', points: 4520, avatarUrl: null }, // duplicate #1
      { userId: 'u1', name: 'Test User', points: 4520, avatarUrl: null }, // duplicate #2
      { userId: 'u4', name: 'Player 3', points: 3000, avatarUrl: null },
    ]
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 3, points: 4520 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: DUPLICATE_ENTRIES })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 4520 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 3')).toBeInTheDocument() })
    // Test User name should appear exactly once (FE defensive dedup)
    expect(screen.getAllByText('Test User')).toHaveLength(1)
  })

  it('LB-1.2: hides sticky my-rank row when current user IS in displayed list', async () => {
    // Test User (u1) is in MOCK_ENTRIES at idx 4 (rank 5) → no sticky needed
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
    expect(screen.queryByTestId('leaderboard-my-rank-sticky')).not.toBeInTheDocument()
  })

  it('LB-1.2: shows sticky my-rank row when current user NOT in list', async () => {
    const ENTRIES_WITHOUT_ME = [
      { userId: 'u2', name: 'Player 1', points: 15820, avatarUrl: null },
      { userId: 'u3', name: 'Player 2', points: 12450, avatarUrl: null },
      { userId: 'u4', name: 'Player 3', points: 11200, avatarUrl: null },
      { userId: 'u5', name: 'Player 4', points: 9840, avatarUrl: null },
    ]
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 50, points: 100 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: ENTRIES_WITHOUT_ME })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 100 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
    expect(screen.getByTestId('leaderboard-my-rank-sticky')).toBeInTheDocument()
  })
})
