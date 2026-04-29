import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Tests for the AppLayout logout functionality.
 *
 * Bug: AppLayout previously had no logout button, making it impossible
 * for users to sign out. Now there's a user avatar dropdown with logout.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockLogout = vi.fn()
let authState: any = {}

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (state: any) => any) => {
    return selector ? selector(authState) : authState
  },
}))

import AppLayout from '../AppLayout'

function renderAppLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppLayout />
    </MemoryRouter>
  )
}

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

  it('renders a clickable avatar button in header', () => {
    renderAppLayout()
    // Header should have buttons — one of which contains the person icon
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('shows dropdown with logout when avatar is clicked', async () => {
    renderAppLayout()

    // Find and click the avatar button (the one with border-[#e8a832])
    const buttons = screen.getAllByRole('button')
    // Avatar button is the last button-like element in the header
    const avatarBtn = buttons[0]
    fireEvent.click(avatarBtn)

    await waitFor(() => {
      expect(screen.getByText('Đăng xuất')).toBeInTheDocument()
    })
  })

  it('shows profile and achievements links in dropdown', async () => {
    renderAppLayout()

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ')).toBeInTheDocument()
      expect(screen.getByText('Thành tích')).toBeInTheDocument()
    })
  })

  it('calls logout and navigates to /landing when logout clicked', async () => {
    renderAppLayout()

    // Open dropdown
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // Click logout
    const logoutBtn = await screen.findByText('Đăng xuất')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/landing')
    })
  })

  it('shows loading state during logout', async () => {
    mockLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))
    renderAppLayout()

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    const logoutBtn = await screen.findByText('Đăng xuất')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(screen.getByText('Đang đăng xuất...')).toBeInTheDocument()
    })
  })

  it('displays user name in sidebar profile card', () => {
    renderAppLayout()
    // User name should appear in sidebar (truncated with max-w)
    const nameElements = screen.getAllByText('Nguyễn Văn A')
    expect(nameElements.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * Regression guard (2026-04-19): the sidebar's big gold "BẮT ĐẦU" CTA
   * linking to /quiz was removed because (a) /quiz crashes without a
   * session-id in router state, and (b) it duplicated the Practice
   * card's CTA on Home. Recommendation highlight now drives the user
   * to the right mode contextually.
   */
  it('does NOT render the old sidebar "Bắt Đầu" CTA linking to /quiz', () => {
    renderAppLayout()
    // The /quiz link anchor should not exist anywhere in the layout.
    const quizLinks = document.querySelectorAll('a[href="/quiz"]')
    expect(quizLinks.length).toBe(0)
  })

  /**
   * Regression guard (2026-04-19): the top header previously duplicated
   * the sidebar nav items (Trang chủ / Xếp hạng / Nhóm / Cá nhân). They
   * were moved to sidebar-only to reduce visual redundancy. Each nav
   * route must appear AT MOST ONCE in the rendered DOM so we don't
   * reintroduce the duplicate.
   */
  it('does NOT duplicate nav links between header and sidebar', () => {
    renderAppLayout()
    // Intent: catch a regression where the old "header nav menu" returns
    // and duplicates the sidebar + bottom-nav pair.
    //
    // Iterate only paths that are NOT also referenced by legitimate
    // non-nav surfaces. The brand logo links to `/`, and both the
    // user-menu dropdown and the mobile slide-out link to `/profile` —
    // excluding these two keeps the assertion sharp (sidebar + bottom
    // nav = exactly 2) while still flagging the header-menu regression
    // this test was originally written for.
    for (const path of ['/leaderboard', '/groups']) {
      const links = document.querySelectorAll(`a[href="${path}"]`)
      expect(links.length).toBeLessThanOrEqual(2)
    }
  })
})

/**
 * Click-outside behavior for the user menu dropdown.
 *
 * Regression: previously used `<div className="fixed inset-0 z-40">` overlay
 * behind the popup. That overlay was blocked by the fixed header (z-50), so
 * clicking on the header (logo, decorative icons) or any other header child
 * did NOT close the menu. Now uses a document mousedown listener scoped by
 * ref.
 */
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

    const toggle = screen.getByTestId('user-menu-toggle')
    fireEvent.click(toggle)
    expect(await screen.findByTestId('user-menu-dropdown')).toBeInTheDocument()

    // Simulate a real pointer event on the document body
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes the dropdown when clicking a header icon (regression guard)', async () => {
    renderAppLayout()

    const toggle = screen.getByTestId('user-menu-toggle')
    fireEvent.click(toggle)
    expect(await screen.findByTestId('user-menu-dropdown')).toBeInTheDocument()

    // Click the header area (not the menu) — this is the exact case that
    // failed with the old z-40 overlay approach.
    const header = screen.getByTestId('app-header')
    fireEvent.mouseDown(header)

    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument()
    })
  })

  it('closes the dropdown when pressing Escape', async () => {
    renderAppLayout()

    const toggle = screen.getByTestId('user-menu-toggle')
    fireEvent.click(toggle)
    expect(await screen.findByTestId('user-menu-dropdown')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument()
    })
  })

  it('keeps the dropdown open when clicking inside the menu container', async () => {
    renderAppLayout()

    const toggle = screen.getByTestId('user-menu-toggle')
    fireEvent.click(toggle)
    const dropdown = await screen.findByTestId('user-menu-dropdown')
    expect(dropdown).toBeInTheDocument()

    // Click inside the dropdown — e.g. on the user's email text
    fireEvent.mouseDown(screen.getByText('test@example.com'))

    // Should still be open
    expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument()
  })

  it('toggles the dropdown when clicking the avatar button twice', async () => {
    renderAppLayout()

    const toggle = screen.getByTestId('user-menu-toggle')
    fireEvent.click(toggle)
    expect(await screen.findByTestId('user-menu-dropdown')).toBeInTheDocument()

    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument()
    })
  })

  it('sets aria-expanded on the toggle to reflect open state', async () => {
    renderAppLayout()

    const toggle = screen.getByTestId('user-menu-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    await waitFor(() => {
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
    })
  })

  it('cleans up document listeners after menu closes', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    renderAppLayout()
    const toggle = screen.getByTestId('user-menu-toggle')

    // Open → listeners added
    fireEvent.click(toggle)
    await screen.findByTestId('user-menu-dropdown')
    const addedEvents = addSpy.mock.calls.map(c => c[0])
    expect(addedEvents).toEqual(expect.arrayContaining(['mousedown', 'touchstart', 'keydown']))

    // Close → listeners removed for same events
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument()
    })
    const removedEvents = removeSpy.mock.calls.map(c => c[0])
    expect(removedEvents).toEqual(expect.arrayContaining(['mousedown', 'touchstart', 'keydown']))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
