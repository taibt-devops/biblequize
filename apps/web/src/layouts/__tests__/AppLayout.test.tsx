import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockLogout = vi.fn()
let authState: any = {}

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (state: any) => any) => (selector ? selector(authState) : authState),
  useAuth: () => authState,
}))

const mockUseQuery = vi.fn(() => ({ data: undefined, isLoading: true, isError: false }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => mockUseQuery(opts),
}))

vi.mock('../../api/client', () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: {} })) },
}))

import AppLayout from '../AppLayout'

function renderAppLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppLayout />
    </MemoryRouter>
  )
}

describe('AppLayout — TopNav shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    authState = {
      user: { name: 'Nguyễn Văn A', email: 'test@example.com', avatar: null },
      isAuthenticated: true,
      logout: mockLogout,
    }
  })

  it('renders the sticky top navigation bar', () => {
    renderAppLayout()
    expect(screen.getByTestId('app-topnav')).toBeInTheDocument()
  })

  it('renders the user dropdown trigger in the top nav', () => {
    renderAppLayout()
    expect(screen.getByTestId('user-dropdown-toggle')).toBeInTheDocument()
  })

  it('does NOT render per-user stats in the top nav (they live in the Home hero)', () => {
    renderAppLayout()
    expect(screen.queryByTestId('topnav-stats')).not.toBeInTheDocument()
  })
})

describe('AppLayout — Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    authState = {
      user: { name: 'Nguyễn Văn A', email: 'test@example.com', avatar: null },
      isAuthenticated: true,
      logout: mockLogout,
    }
  })

  it('shows dropdown with logout when avatar is clicked', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    await waitFor(() => expect(screen.getByText('Đăng xuất')).toBeInTheDocument())
  })

  it('shows profile and achievements links in dropdown', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    await waitFor(() => {
      expect(screen.getByText('Hồ sơ')).toBeInTheDocument()
      expect(screen.getByText('Thành tích')).toBeInTheDocument()
    })
  })

  it('calls logout and navigates to / (the guest crossroads) when logout clicked', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    const logoutBtn = await screen.findByTestId('user-dropdown-logout-btn')
    fireEvent.click(logoutBtn)
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows loading state during logout', async () => {
    mockLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    const logoutBtn = await screen.findByTestId('user-dropdown-logout-btn')
    fireEvent.click(logoutBtn)
    await waitFor(() => expect(screen.getByText('Đang đăng xuất...')).toBeInTheDocument())
  })

  it('does NOT render the old "Bắt Đầu" CTA linking to /quiz', () => {
    renderAppLayout()
    expect(document.querySelectorAll('a[href="/quiz"]').length).toBe(0)
  })

  // Each nav route appears at most twice (top nav + mobile bottom tabs).
  it('does NOT over-duplicate nav links', () => {
    renderAppLayout()
    for (const path of ['/leaderboard', '/groups']) {
      expect(document.querySelectorAll(`a[href="${path}"]`).length).toBeLessThanOrEqual(2)
    }
  })
})

describe('AppLayout — Guest (logged-out) chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Guest: route public (vd /leaderboard) render AppLayout không có user.
    authState = { user: null, isAuthenticated: false, logout: mockLogout }
  })

  it('shows a "Đăng nhập" CTA instead of the user dropdown', () => {
    renderAppLayout()
    expect(screen.getByTestId('topnav-login-link')).toBeInTheDocument()
    expect(screen.queryByTestId('user-dropdown-toggle')).not.toBeInTheDocument()
  })

  it('does NOT render the notification bell for guests', () => {
    renderAppLayout()
    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument()
  })

  it('hides auth-only nav links (Nhóm / Phòng Chơi / Cá nhân) in the top nav', () => {
    renderAppLayout()
    const topnav = screen.getByTestId('app-topnav')
    for (const path of ['/groups', '/multiplayer', '/profile']) {
      expect(topnav.querySelectorAll(`a[href="${path}"]`).length).toBe(0)
    }
  })

  it('keeps public nav links (Trang chủ + Xếp hạng) for guests', () => {
    renderAppLayout()
    const topnav = screen.getByTestId('app-topnav')
    expect(topnav.querySelectorAll('a[href="/leaderboard"]').length).toBe(1)
  })
})

describe('AppLayout — User menu click-outside', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    authState = {
      user: { name: 'Nguyễn Văn A', email: 'test@example.com', avatar: null },
      isAuthenticated: true,
      logout: mockLogout,
    }
  })

  it('closes the dropdown when clicking outside the menu (body click)', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    expect(await screen.findByTestId('user-dropdown-panel')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByTestId('user-dropdown-panel')).not.toBeInTheDocument())
  })

  it('closes the dropdown when clicking the nav bar (outside the dropdown)', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    expect(await screen.findByTestId('user-dropdown-panel')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('app-topnav'))
    await waitFor(() => expect(screen.queryByTestId('user-dropdown-panel')).not.toBeInTheDocument())
  })

  it('closes the dropdown when pressing Escape', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    expect(await screen.findByTestId('user-dropdown-panel')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('user-dropdown-panel')).not.toBeInTheDocument())
  })

  it('keeps the dropdown open when clicking inside the menu container', async () => {
    renderAppLayout()
    fireEvent.click(screen.getByTestId('user-dropdown-toggle'))
    const dropdown = await screen.findByTestId('user-dropdown-panel')
    expect(dropdown).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('test@example.com'))
    expect(screen.getByTestId('user-dropdown-panel')).toBeInTheDocument()
  })

  it('toggles the dropdown when clicking the avatar button twice', async () => {
    renderAppLayout()
    const toggle = screen.getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    expect(await screen.findByTestId('user-dropdown-panel')).toBeInTheDocument()
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.queryByTestId('user-dropdown-panel')).not.toBeInTheDocument())
  })

  it('sets aria-expanded on the toggle to reflect open state', async () => {
    renderAppLayout()
    const toggle = screen.getByTestId('user-dropdown-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('true'))
  })
})
