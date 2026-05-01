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
}

const SAMPLE_LEADERBOARD = [
  { rank: 1, userId: 'u1', name: 'Lê Minh', avatarUrl: null, points: 15800 },
  { rank: 2, userId: 'u2', name: 'Trần An', avatarUrl: null, points: 12400 },
  { rank: 3, userId: 'u3', name: 'Phạm Hùng', avatarUrl: null, points: 10100 },
  { rank: 4, userId: 'u4', name: 'Nguyễn Thu', avatarUrl: null, points: 8920 },
]

const SAMPLE_ANNOUNCEMENTS = [
  {
    id: 'a1',
    author: 'Quản trị viên',
    title: 'Cuộc thi tuần 42',
    body: 'Chuẩn bị cho chủ đề mới.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    isNew: true,
  },
]

describe('Groups Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders without crashing', () => {
    expect(() => renderGroups()).not.toThrow()
  })

  it('shows no-group view when user has no saved group', () => {
    renderGroups()
    expect(screen.getByTestId('no-group')).toBeTruthy()
    expect(screen.getByText('Bạn chưa tham gia nhóm nào')).toBeTruthy()
  })

  it('shows create and join buttons in no-group view', () => {
    renderGroups()
    expect(screen.getByText('Tạo Nhóm')).toBeTruthy()
    expect(screen.getByText('Tìm Nhóm')).toBeTruthy()
  })

  it('shows loading skeleton when user has a group', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Test' }]))
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderGroups()
    expect(screen.getByTestId('groups-skeleton')).toBeTruthy()
  })

  it('renders group overview when user has a saved group', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Test' }]))
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: SAMPLE_LEADERBOARD } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: SAMPLE_ANNOUNCEMENTS, total: SAMPLE_ANNOUNCEMENTS.length, hasMore: false } } })
      return Promise.resolve({ data: SAMPLE_GROUP })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Hội Thánh Tin Lành')).toBeTruthy()
    })
  })

  it('renders leaderboard from API', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Test' }]))
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: SAMPLE_LEADERBOARD } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: [], total: 0, hasMore: false } } })
      return Promise.resolve({ data: SAMPLE_GROUP })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Lê Minh')).toBeTruthy()
    })
    expect(screen.getByText('Trần An')).toBeTruthy()
    expect(screen.getByText('Phạm Hùng')).toBeTruthy()
  })

  it('renders announcements from API', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Test' }]))
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/leaderboard')) return Promise.resolve({ data: { success: true, leaderboard: [] } })
      if (url.includes('/announcements')) return Promise.resolve({ data: { success: true, data: { items: SAMPLE_ANNOUNCEMENTS, total: SAMPLE_ANNOUNCEMENTS.length, hasMore: false } } })
      return Promise.resolve({ data: SAMPLE_GROUP })
    })
    renderGroups()
    await waitFor(() => {
      expect(screen.getByText('Cuộc thi tuần 42')).toBeTruthy()
    })
  })

  it('shows error state when group fetch fails', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'g1', name: 'Test' }]))
    mockGet.mockRejectedValue(new Error('Not found'))
    renderGroups()
    await waitFor(() => {
      expect(screen.getByTestId('group-error')).toBeTruthy()
    })
    expect(screen.getByText('Không thể tải thông tin nhóm')).toBeTruthy()
  })

  it('returns null when not authenticated', () => {
    authState = { isAuthenticated: false, isLoading: false, user: null as any }
    const { container } = renderGroups()
    expect(container.innerHTML).toBe('')
    authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
  })
})
