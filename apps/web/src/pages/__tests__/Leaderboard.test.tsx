import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
      if (url.includes('/seasons/active')) return Promise.resolve({ data: { endAt: new Date(Date.now() + 3 * 86400000).toISOString() } })
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

  it('renders 4 tab buttons (LB-1.3)', () => {
    renderLeaderboard()
    expect(screen.getByText('Hàng ngày')).toBeInTheDocument()
    expect(screen.getByText('Hàng tuần')).toBeInTheDocument()
    expect(screen.getByText('Mùa Xuân')).toBeInTheDocument()
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
      expect(screen.getByText(/Vinh Quang Mùa Xuân 2026/i)).toBeInTheDocument()
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

  it('calls API with correct period', () => {
    renderLeaderboard()
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/leaderboard/daily'))
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

  it('LB-1.3: clicking Season tab fetches /api/leaderboard/season', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    renderLeaderboard()
    await userEvent.setup().click(screen.getByText('Mùa Xuân'))
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
