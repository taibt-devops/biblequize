import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

let authState = {
  isAuthenticated: true,
  isLoading: false,
  user: { name: 'Test', email: 'a@b.com' },
}
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => (s ? s(authState) : authState),
  useAuth: () => authState,
}))

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}))

import Groups from '../Groups'

const STORAGE_KEY = 'biblequiz_my_groups'

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderGroups() {
  const client = createClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Groups />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE_GROUP = {
  id: 'g1',
  name: 'Hội Thánh Tin Lành',
  code: 'ABC123',
  memberCount: 42,
  totalPoints: 15800,
  location: 'TP. Hồ Chí Minh',
  isPublic: true,
}

// Backend returns `score` (not `points`) — see ChurchGroupService.getLeaderboard
const SAMPLE_LEADERBOARD = [
  { rank: 1, userId: 'u1', name: 'Lê Minh', avatarUrl: null, score: 15800, role: 'LEADER' },
  { rank: 2, userId: 'u2', name: 'Trần An', avatarUrl: null, score: 12400, role: 'MEMBER' },
  { rank: 3, userId: 'u3', name: 'Phạm Hùng', avatarUrl: null, score: 10100, role: 'MEMBER' },
  { rank: 4, userId: 'u4', name: 'Nguyễn Thu', avatarUrl: null, score: 8920, role: 'MEMBER' },
]

const SAMPLE_ANNOUNCEMENTS = [
  {
    id: 'a1',
    author: 'Quản trị viên',
    authorRole: 'LEADER',
    body: 'Chuẩn bị cho chủ đề mới.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

const NO_GROUP_RESPONSE = { hasGroup: false }
const HAS_GROUP_RESPONSE = { hasGroup: true, groupId: 'g1', groupName: 'Hội Thánh Tin Lành', memberCount: 42, role: 'MEMBER' }

describe('Groups Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders without crashing', () => {
    mockGet.mockResolvedValue({ data: NO_GROUP_RESPONSE })
    expect(() => renderGroups()).not.toThrow()
  })

  it('shows no-group view when API returns hasGroup: false', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: NO_GROUP_RESPONSE })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('no-group')).toBeTruthy()
    })
    expect(screen.getByText('Tham gia nhóm hội thánh')).toBeTruthy()
  })

  it('shows create and join CTAs in no-group view', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: NO_GROUP_RESPONSE })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('groups-create-btn')).toBeTruthy()
      expect(screen.getByTestId('groups-join-btn')).toBeTruthy()
    })
  })

  it('clears stale localStorage when API says hasGroup: false', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'stale', name: 'Stale' }]))
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: NO_GROUP_RESPONSE })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('no-group')).toBeTruthy()
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('renders group overview when API returns hasGroup: true', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: SAMPLE_LEADERBOARD } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: SAMPLE_ANNOUNCEMENTS, total: SAMPLE_ANNOUNCEMENTS.length, hasMore: false } } })
      return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getAllByText('Hội Thánh Tin Lành').length).toBeGreaterThan(0)
    })
  })

  it('renders podium top-3 from API leaderboard (uses score field)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: SAMPLE_LEADERBOARD } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
      return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Lê Minh')).toBeTruthy()
    })
    expect(screen.getByText('Trần An')).toBeTruthy()
    expect(screen.getByText('Phạm Hùng')).toBeTruthy()
    // Score formatted (not literal "undefined")
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('renders announcements body from API', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: [] } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: SAMPLE_ANNOUNCEMENTS, total: SAMPLE_ANNOUNCEMENTS.length, hasMore: false } } })
      return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Chuẩn bị cho chủ đề mới.')).toBeTruthy()
    })
  })

  it('shows error state when group fetch fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      return Promise.reject(new Error('Not found'))
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('group-error')).toBeTruthy()
    })
    expect(screen.getByText('Không thể tải thông tin nhóm')).toBeTruthy()
  })

  it('renders fallback name when group.name is empty', async () => {
    const emptyNameGroup = { ...SAMPLE_GROUP, name: '' }
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: { ...HAS_GROUP_RESPONSE, groupName: '' } })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: [] } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
      return Promise.resolve({ data: { success: true, group: emptyNameGroup } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Nhóm chưa đặt tên')).toBeTruthy()
    })
  })

  it('renders podium empty slots when leaderboard has < 3 members', async () => {
    const partialLeaderboard = [SAMPLE_LEADERBOARD[0]]
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: partialLeaderboard } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
      return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Lê Minh')).toBeTruthy()
    })
    // 2 empty slots should render with "Còn trống" label
    const emptyLabels = screen.getAllByText('Còn trống')
    expect(emptyLabels.length).toBe(2)
  })

  it('returns null when not authenticated', () => {
    authState = { isAuthenticated: false, isLoading: false, user: null as any }
    const { container } = renderGroups()
    expect(container.innerHTML).toBe('')
    authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
  })
})

/* ── Analytics inline preview ── */

const LEADER_GROUP_RESPONSE = { hasGroup: true, groupId: 'g1', groupName: 'Hội Thánh Tin Lành', memberCount: 42, role: 'LEADER' }

const SAMPLE_ANALYTICS = {
  totalMembers: 10,
  activeToday: 3,
  activeWeek: 7,
  inactiveCount: 3,
  avgScore: 412,
  accuracy: 73,
  totalQuizzes: 8,
  totalPointsWeek: 2884,
  totalQuestionsWeek: 70,
  weeklyActivity: [
    { date: '2026-04-27', activeCount: 4 },
    { date: '2026-04-28', activeCount: 6 },
    { date: '2026-04-29', activeCount: 5 },
    { date: '2026-04-30', activeCount: 3 },
    { date: '2026-05-01', activeCount: 7 },
    { date: '2026-05-02', activeCount: 6 },
    { date: '2026-05-03', activeCount: 3 },
  ],
  topContributors: [],
}

function mockLeaderApis(analyticsOverride?: Partial<typeof SAMPLE_ANALYTICS>) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/api/groups/me')) return Promise.resolve({ data: LEADER_GROUP_RESPONSE })
    if (url.includes('/analytics')) return Promise.resolve({ data: { success: true, analytics: { ...SAMPLE_ANALYTICS, ...analyticsOverride } } })
    if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: [] } })
    if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
    if (url.includes('/quiz-sets')) return Promise.resolve({ data: { quizSets: [] } })
    return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
  })
}

describe('Groups Page — analytics inline preview (leader)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders analytics section when role is LEADER', async () => {
    mockLeaderApis()
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('analytics-inline')).toBeInTheDocument()
    })
  })

  it('does not render analytics section when role is MEMBER', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/me')) return Promise.resolve({ data: HAS_GROUP_RESPONSE })
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: [] } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
      if (url.includes('/quiz-sets')) return Promise.resolve({ data: { quizSets: [] } })
      return Promise.resolve({ data: { success: true, group: SAMPLE_GROUP } })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('group-overview')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('analytics-inline')).not.toBeInTheDocument()
  })

  it('shows KPI values from analytics API response', async () => {
    mockLeaderApis()
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('7/10')).toBeInTheDocument()  // activeWeek/totalMembers
      expect(screen.getByText('412')).toBeInTheDocument()   // avgScore
      expect(screen.getByText('73%')).toBeInTheDocument()   // accuracy
    })
  })

  it('shows inactive alert when inactiveCount > 0', async () => {
    mockLeaderApis()
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText(/3 thành viên không hoạt động/)).toBeInTheDocument()
    })
  })

  it('hides inactive alert when inactiveCount is 0', async () => {
    mockLeaderApis({ inactiveCount: 0 })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('analytics-inline')).toBeInTheDocument()
    })
    expect(screen.queryByText(/thành viên không hoạt động/)).not.toBeInTheDocument()
  })

  it('renders view-full-analytics link to /groups/g1/analytics', async () => {
    mockLeaderApis()
    renderGroups()
    await waitFor(() => {
      const link = screen.getByText('Xem phân tích đầy đủ →')
      expect(link.closest('a')?.getAttribute('href')).toBe('/groups/g1/analytics')
    })
  })

  it('renders weekly activity chart label when data is loaded', async () => {
    mockLeaderApis()
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Số người học mỗi ngày')).toBeInTheDocument()
    })
  })
})
