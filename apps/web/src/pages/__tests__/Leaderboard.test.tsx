import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({ api: { get: (...a: any[]) => mockApiGet(...a) } }))

// authStore.User has NO `id` field in production (only name/email/avatar/role/currentStreak).
// Leaderboard now identifies current user via my-rank API response (userId field).
const authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test User', email: 'a@b.com' } }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => s ? s(authState) : authState,
  useAuth: () => authState,
}))

import Leaderboard from '../Leaderboard'

// ≥ SEED_THRESHOLD (10) entries so the board renders (below the threshold the
// page shows the LBF-11 low-data seed-state instead of the podium/list).
const MOCK_ENTRIES = [
  { userId: 'u2', name: 'Player 1', points: 15820, avatarUrl: null },
  { userId: 'u3', name: 'Player 2', points: 12450, avatarUrl: null },
  { userId: 'u4', name: 'Player 3', points: 11200, avatarUrl: null },
  { userId: 'u5', name: 'Player 4', points: 9840, avatarUrl: null },
  { userId: 'u1', name: 'Test User', points: 4520, avatarUrl: null },
  { userId: 'u6', name: 'Player 6', points: 4000, avatarUrl: null },
  { userId: 'u7', name: 'Player 7', points: 3500, avatarUrl: null },
  { userId: 'u8', name: 'Player 8', points: 3000, avatarUrl: null },
  { userId: 'u9', name: 'Player 9', points: 2500, avatarUrl: null },
  { userId: 'u10', name: 'Player 10', points: 2000, avatarUrl: null },
  { userId: 'u11', name: 'Player 11', points: 1500, avatarUrl: null },
  { userId: 'u12', name: 'Player 12', points: 1000, avatarUrl: null },
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

  it('LBF-9: renders 2 tab buttons — no Daily, no Mùa (season tab hidden for early launch)', () => {
    renderLeaderboard()
    // Daily tab REMOVED in LB-2 (decision 2026-05-01)
    expect(screen.queryByText('Hàng ngày')).not.toBeInTheDocument()
    // Competitive "Mùa" tab hidden in LBF-9 (decision 2026-06-18) — only
    // all-time + weekly remain. BE season endpoint stays dormant.
    expect(screen.queryByText('Mùa')).not.toBeInTheDocument()
    expect(screen.getByText('Hàng tuần')).toBeInTheDocument()
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
      expect(tier2Card.className).toContain('border-bq-amber')
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

  // LBF-9 (2026-06-18): season countdown header removed with the "Mùa" tab.

  it('LBF-11: shows seed-state (not a bare board) when no data', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: [] })
      if (url.includes('/my-rank')) return Promise.resolve({ data: null })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByTestId('leaderboard-seed-state')).toBeInTheDocument() })
    // No podium, no weak numbers
    expect(screen.queryByTestId('leaderboard-podium')).not.toBeInTheDocument()
  })

  it('LBF-11: shows seed-state when fewer than 10 players (né con số)', async () => {
    const FEW = MOCK_ENTRIES.slice(0, 5) // 5 players → below SEED_THRESHOLD
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 5, points: 4520 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: FEW })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 4520 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByTestId('leaderboard-seed-state')).toBeInTheDocument() })
    // Board hidden so the sparse 5-row list + any "0đ" never shows
    expect(screen.queryByTestId('leaderboard-podium')).not.toBeInTheDocument()
    expect(screen.queryByText('Player 1')).not.toBeInTheDocument()
  })

  it('LBF-11: shows the board (no seed-state) when 10+ players', async () => {
    renderLeaderboard() // default mock = 12 entries
    await waitFor(() => { expect(screen.getByTestId('leaderboard-podium')).toBeInTheDocument() })
    expect(screen.queryByTestId('leaderboard-seed-state')).not.toBeInTheDocument()
  })

  it('shows skeleton during loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderLeaderboard()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('LB-2.2: default tab fetches /leaderboard/all-time (Daily tab removed, default flipped to all-time 2026-05-23)', () => {
    renderLeaderboard()
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/leaderboard/all-time'))
    // Daily endpoint should NOT be called from /leaderboard page after Daily tab removal
    const dailyCalls = mockApiGet.mock.calls.filter((call) => String(call[0]).includes('/leaderboard/daily'))
    expect(dailyCalls).toHaveLength(0)
    // Weekly should also NOT be auto-fetched on first paint now that all-time is default
    const weeklyCalls = mockApiGet.mock.calls.filter((call) => String(call[0]).includes('/leaderboard/weekly'))
    expect(weeklyCalls).toHaveLength(0)
  })

  it('LB-2.2: tier section subtitle interpolates active season name', async () => {
    renderLeaderboard()
    await waitFor(() => {
      // Subtitle should mention active season name dynamically
      expect(screen.getByText(/Mùa Ngũ Tuần 2026/)).toBeInTheDocument()
    })
  })

  // LB-1.5 — Row enrichment per mockup
  it('LB-1.5: list rows show tier name below username', async () => {
    renderLeaderboard()
    // Player 4 (9840 pts) → tier 3 disciple "Môn Đồ"
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
    // Tier name appears in tier section + at least once in list rows (Player 4)
    expect(screen.getAllByText('Môn Đồ').length).toBeGreaterThanOrEqual(2)
  })

  // LBF-7 (2026-06-18): streak/trend rendering removed — BE never populated
  // these fields so the 🔥/▲▼ affordances never showed. Tests deleted with the UI.

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

  it('LB-1.4: podium #1 shows crown + gold podium block', async () => {
    renderLeaderboard()
    await waitFor(() => {
      const rank1 = screen.getByTestId('podium-rank-1')
      // Crown emoji present
      expect(rank1.textContent).toContain('👑')
      // Lu Khach: #1 stands on the gold block (was a gold glow)
      expect(rank1.innerHTML).toContain('bg-bq-amber')
      expect(screen.getByTestId('podium-rank-2').innerHTML).not.toContain('bg-bq-amber border-[3px]')
    })
  })

  // LBF-9 (2026-06-18): "Mùa" competitive tab hidden for early launch — the
  // season tab + its /leaderboard/season fetch test were removed. BE endpoint
  // stays dormant.

  // LBF-2 (2026-06-18): the "dedupes duplicate BE rows" test was removed with
  // the dead FE dedup guard — UNIQUE(user_id, date) + GROUP BY u.id make a
  // repeated userId impossible, so the test simulated a state the BE can't emit.

  it('LB-1.2: hides sticky my-rank row when current user IS in displayed list', async () => {
    // Test User (u1) is in MOCK_ENTRIES at idx 4 (rank 5) → no sticky needed
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 4')).toBeInTheDocument() })
    expect(screen.queryByTestId('leaderboard-my-rank-sticky')).not.toBeInTheDocument()
  })

  it('LB-1.2: shows sticky my-rank row when current user NOT in list', async () => {
    // 11 players, none of them the current user (u1) → board renders (≥10) and
    // the around-me sticky row appears for the off-board current user.
    const ENTRIES_WITHOUT_ME = MOCK_ENTRIES.filter((e) => e.userId !== 'u1')
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

  it('LBF-4: renders around-me window (neighbours + me) when user is off the top list', async () => {
    const AROUND = [
      { userId: 'u20', name: 'Above A', points: 900, rank: 45 },
      { userId: 'u21', name: 'Above B', points: 880, rank: 46 },
      { userId: 'u1', name: 'Test User', points: 850, rank: 47 },
      { userId: 'u22', name: 'Below A', points: 820, rank: 48 },
      { userId: 'u23', name: 'Below B', points: 800, rank: 49 },
    ]
    mockApiGet.mockImplementation((url: string) => {
      // around-me URL also contains '/leaderboard/', so match it FIRST
      if (url.includes('/around-me')) return Promise.resolve({ data: AROUND })
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 47, points: 850 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: MOCK_ENTRIES.filter((e) => e.userId !== 'u1') })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 850 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByTestId('leaderboard-around-me')).toBeInTheDocument() })
    // 5 neighbours above + below render (not just a lonely sticky row)
    expect(screen.getByText('Above A')).toBeInTheDocument()
    expect(screen.getByText('Below B')).toBeInTheDocument()
    // The current-user row inside the window keeps the sticky testid
    expect(screen.getByTestId('leaderboard-my-rank-sticky')).toBeInTheDocument()
  })

  it('sticky my-rank row renders current user avatar from authStore (sync after edit)', async () => {
    authState.user = { name: 'Test User', email: 'a@b.com', avatar: 'https://example.com/me.png' } as any
    // 11 players, none of them the current user (u1) → board renders (≥10) and
    // the around-me sticky row appears for the off-board current user.
    const ENTRIES_WITHOUT_ME = MOCK_ENTRIES.filter((e) => e.userId !== 'u1')
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/my-rank')) return Promise.resolve({ data: { userId: 'u1', name: 'Test User', rank: 23, points: 1131 } })
      if (url.includes('/leaderboard/')) return Promise.resolve({ data: ENTRIES_WITHOUT_ME })
      if (url.includes('/seasons')) return Promise.resolve({ data: null })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: { totalPoints: 1131 } })
      return Promise.reject(new Error('Not found'))
    })
    renderLeaderboard()
    const sticky = await screen.findByTestId('leaderboard-my-rank-sticky')
    const img = sticky.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/me.png')
    // Reset shared mock state for other tests.
    authState.user = { name: 'Test User', email: 'a@b.com' } as any
  })
})

describe('Leaderboard — guest (logged-out)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authState as any).isAuthenticated = false
    ;(authState as any).user = null
    mockApiGet.mockImplementation((url: string) => {
      // Guests read via the public endpoint only.
      if (url.includes('/api/public/leaderboard')) return Promise.resolve({ data: MOCK_ENTRIES })
      return Promise.reject(new Error('Not found'))
    })
  })

  afterEach(() => {
    // Restore shared authState for the other describe blocks.
    ;(authState as any).isAuthenticated = true
    ;(authState as any).user = { name: 'Test User', email: 'a@b.com' }
  })

  it('fetches the board from the public endpoint, not the authed one', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 1')).toBeInTheDocument() })
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/public/leaderboard'))
    const authedCalls = mockApiGet.mock.calls.filter((c) => /\/api\/leaderboard\//.test(String(c[0])))
    expect(authedCalls).toHaveLength(0)
  })

  it('does NOT call per-user endpoints (my-rank / tier-progress / seasons)', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 1')).toBeInTheDocument() })
    const perUser = mockApiGet.mock.calls.filter((c) => /my-rank|tier-progress|\/seasons/.test(String(c[0])))
    expect(perUser).toHaveLength(0)
  })

  it('shows a login CTA and no "current tier" highlight in the ladder', async () => {
    renderLeaderboard()
    await waitFor(() => { expect(screen.getByText('Player 1')).toBeInTheDocument() })
    expect(screen.getByTestId('leaderboard-guest-rank-cta')).toBeInTheDocument()
    // No tier card flagged as the guest's current tier.
    const tierSection = screen.getByTestId('leaderboard-tier-section')
    expect(tierSection.querySelector('.border-bq-amber')).toBeNull()
  })
})
