import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

const LEADER_GROUP = {
  id: 'g1',
  name: 'FMC Đà Nẵng',
  description: 'Hội Thánh Methodist Đà Nẵng',
  code: 'NVH0S9',
  isPublic: true,
  role: 'LEADER',
  memberCount: 12,
  avgScore: 189,
  accuracy: 41,
  activeWeek: 8,
  lastActivityAt: new Date().toISOString(),
  myWeekPoints: 200,
  myRank: 1,
}

const MEMBER_GROUP = {
  id: 'g2',
  name: 'SV Tin Lành Hà Nội',
  description: 'Nhóm sinh viên',
  code: 'XYZ987',
  isPublic: true,
  role: 'MEMBER',
  memberCount: 47,
  avgScore: 324,
  accuracy: 68,
  activeWeek: 30,
  lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  myWeekPoints: 100,
  myRank: 12,
}

const PUBLIC_GROUPS = [
  { id: 'p1', name: 'FMC Sài Gòn', description: 'HT Methodist SG', memberCount: 124, code: 'PUB001' },
  { id: 'p2', name: 'Học Tân Ước', description: '27 sách', memberCount: 89, code: 'PUB002' },
]

describe('Groups Page (multi-group index)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
  })

  it('renders without crashing', () => {
    mockGet.mockResolvedValue({ data: { success: true, groups: [] } })
    expect(() => renderGroups()).not.toThrow()
  })

  it('shows empty state when user has no groups', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('no-group')).toBeInTheDocument()
    })
    expect(screen.getByTestId('groups-empty-create-btn')).toBeInTheDocument()
    expect(screen.getByTestId('groups-empty-join-btn')).toBeInTheDocument()
  })

  it('clears stale localStorage when user has no groups', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'stale', name: 'Stale' }]))
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('no-group')).toBeInTheDocument()
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('renders group cards when user has groups (multi)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP, MEMBER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getAllByTestId('group-card').length).toBe(2)
    })
    expect(screen.getByText('FMC Đà Nẵng')).toBeInTheDocument()
    expect(screen.getByText('SV Tin Lành Hà Nội')).toBeInTheDocument()
  })

  it('shows leader role badge on leader card', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Trưởng')).toBeInTheDocument()
    })
  })

  it('shows group code on leader card footer (not member rank)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('NVH0S9')).toBeInTheDocument()
    })
  })

  it('shows my rank on member card footer (not group code)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [MEMBER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText(/Hạng #12/)).toBeInTheDocument()
    })
    // Member card should NOT show the group code
    expect(screen.queryByText('XYZ987')).not.toBeInTheDocument()
  })

  it('renders 3 stats per card (members / avg score / accuracy)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()  // memberCount
    })
    expect(screen.getByText('189')).toBeInTheDocument()  // avgScore
    expect(screen.getByText('41%')).toBeInTheDocument()  // accuracy
  })

  it('always shows the Quick Join Bar (even when has groups)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('groups-quick-join')).toBeInTheDocument()
    })
    expect(screen.getByTestId('groups-quick-join-input')).toBeInTheDocument()
    expect(screen.getByTestId('groups-quick-join-submit')).toBeInTheDocument()
  })

  it('renders public discovery section when public groups available', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: PUBLIC_GROUPS } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('public-groups-section')).toBeInTheDocument()
    })
    expect(screen.getByText('FMC Sài Gòn')).toBeInTheDocument()
    expect(screen.getByText('Học Tân Ước')).toBeInTheDocument()
  })

  it('hides public section entirely when no public groups', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getAllByTestId('group-card').length).toBe(1)
    })
    expect(screen.queryByTestId('public-groups-section')).not.toBeInTheDocument()
  })

  it('quick-join submit triggers POST /api/groups/join with uppercased code', async () => {
    const user = userEvent.setup()
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    mockPost.mockResolvedValue({ data: { success: true, data: { groupId: 'g1' } } })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('groups-quick-join-input')).toBeInTheDocument()
    })
    const input = screen.getByTestId('groups-quick-join-input') as HTMLInputElement
    await user.type(input, 'abc123')
    await user.click(screen.getByTestId('groups-quick-join-submit'))
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/groups/join', { code: 'ABC123' })
    })
  })

  it('FAB visible when has groups (mobile create entry-point)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/groups/mine')) return Promise.resolve({ data: { success: true, groups: [LEADER_GROUP] } })
      if (url.includes('/api/groups/public')) return Promise.resolve({ data: { success: true, groups: [] } })
      return Promise.resolve({ data: {} })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('groups-fab-create')).toBeInTheDocument()
    })
  })

  it('returns null when not authenticated', () => {
    authState = { isAuthenticated: false, isLoading: false, user: null as any }
    const { container } = renderGroups()
    expect(container.innerHTML).toBe('')
  })
})
