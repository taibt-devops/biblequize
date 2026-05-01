import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Sidebar-scoped query helper. JSDOM doesn't apply Tailwind responsive
 * classes (`hidden md:flex`, `md:hidden`), so both the desktop sidebar
 * and the MobileTopBar render simultaneously in tests — and both
 * mount their own `UserDropdown`. Scope every menu/toggle assertion to
 * the sidebar to avoid `Found multiple elements` errors.
 */
function inSidebar() {
  return within(screen.getByTestId('app-sidebar'))
}

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
  // StreakWidget reads via useAuth — same backing state.
  useAuth: () => authState,
}))

// Stub TanStack Query so DailyMissionWidget renders deterministically
// inside the layout. Default returns isLoading=true → widget shows the
// skeleton placeholder (no network, no error). Tests that need data
// override mockUseQuery per case.
const mockUseQuery = vi.fn(() => ({ data: undefined, isLoading: true, isError: false }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => mockUseQuery(opts),
}))

// Block axios from running inside the widget's queryFn even if it ever
// fires. Empty stub is safe because mockUseQuery returns synthetic state.
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

  it('renders the user dropdown trigger in the sidebar', () => {
    renderAppLayout()
    expect(inSidebar().getByTestId('user-dropdown-toggle')).toBeInTheDocument()
  })

  it('shows dropdown with logout when avatar is clicked', async () => {
    renderAppLayout()
    fireEvent.click(inSidebar().getByTestId('user-dropdown-toggle'))
    await waitFor(() => {
      expect(inSidebar().getByText('Đăng xuất')).toBeInTheDocument()
    })
  })

  it('shows profile and achievements links in dropdown', async () => {
    renderAppLayout()
    fireEvent.click(inSidebar().getByTestId('user-dropdown-toggle'))
    await waitFor(() => {
      expect(inSidebar().getByText('Hồ sơ')).toBeInTheDocument()
      expect(inSidebar().getByText('Thành tích')).toBeInTheDocument()
    })
  })

  it('calls logout and navigates to /landing when logout clicked', async () => {
    renderAppLayout()
    fireEvent.click(inSidebar().getByTestId('user-dropdown-toggle'))
    const logoutBtn = await inSidebar().findByTestId('user-dropdown-logout-btn')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/landing')
    })
  })

  it('shows loading state during logout', async () => {
    mockLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)))
    renderAppLayout()
    fireEvent.click(inSidebar().getByTestId('user-dropdown-toggle'))
    const logoutBtn = await inSidebar().findByTestId('user-dropdown-logout-btn')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(inSidebar().getByText('Đang đăng xuất...')).toBeInTheDocument()
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

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    expect(await inSidebar().findByTestId('user-dropdown-panel')).toBeInTheDocument()

    // Simulate a real pointer event on the document body
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(inSidebar().queryByTestId('user-dropdown-panel')).not.toBeInTheDocument()
    })
  })

  it('closes the dropdown when clicking outside the dropdown (regression guard)', async () => {
    renderAppLayout()

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    expect(await inSidebar().findByTestId('user-dropdown-panel')).toBeInTheDocument()

    // Click the sidebar header (outside the dropdown wrapper) — this
    // exercises the same outside-click guarantee the old top-header
    // version protected when the panel was anchored there.
    const sidebarHeader = screen.getByTestId('sidebar-header')
    fireEvent.mouseDown(sidebarHeader)

    await waitFor(() => {
      expect(inSidebar().queryByTestId('user-dropdown-panel')).not.toBeInTheDocument()
    })
  })

  it('closes the dropdown when pressing Escape', async () => {
    renderAppLayout()

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    expect(await inSidebar().findByTestId('user-dropdown-panel')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(inSidebar().queryByTestId('user-dropdown-panel')).not.toBeInTheDocument()
    })
  })

  it('keeps the dropdown open when clicking inside the menu container', async () => {
    renderAppLayout()

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    const dropdown = await inSidebar().findByTestId('user-dropdown-panel')
    expect(dropdown).toBeInTheDocument()

    // Click inside the dropdown — e.g. on the user's email text
    // (use first occurrence — email also rendered in MobileTopBar's
    // duplicate UserDropdown trigger card variant).
    const emails = screen.getAllByText('test@example.com')
    fireEvent.mouseDown(emails[0])

    // Should still be open
    expect(screen.getByTestId('user-dropdown-panel')).toBeInTheDocument()
  })

  it('toggles the dropdown when clicking the avatar button twice', async () => {
    renderAppLayout()

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
    fireEvent.click(toggle)
    expect(await inSidebar().findByTestId('user-dropdown-panel')).toBeInTheDocument()

    fireEvent.click(toggle)
    await waitFor(() => {
      expect(inSidebar().queryByTestId('user-dropdown-panel')).not.toBeInTheDocument()
    })
  })

  it('sets aria-expanded on the toggle to reflect open state', async () => {
    renderAppLayout()

    const toggle = inSidebar().getByTestId('user-dropdown-toggle')
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
    const toggle = inSidebar().getByTestId('user-dropdown-toggle')

    // Open → listeners added
    fireEvent.click(toggle)
    await inSidebar().findByTestId('user-dropdown-panel')
    const addedEvents = addSpy.mock.calls.map(c => c[0])
    expect(addedEvents).toEqual(expect.arrayContaining(['mousedown', 'touchstart', 'keydown']))

    // Close → listeners removed for same events
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(inSidebar().queryByTestId('user-dropdown-panel')).not.toBeInTheDocument()
    })
    const removedEvents = removeSpy.mock.calls.map(c => c[0])
    expect(removedEvents).toEqual(expect.arrayContaining(['mousedown', 'touchstart', 'keydown']))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

/**
 * C3 — Sidebar widgets (Streak + Daily Mission) integration.
 * Widgets are rendered inside the desktop <aside> only; logged-out users
 * and mobile users (whole sidebar `hidden md:flex`) never see them.
 */
describe('AppLayout — Sidebar widgets (C3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    mockLogout.mockResolvedValue(undefined)
    authState = {
      user: { name: 'Nguyễn Văn A', email: 'test@example.com', avatar: null, currentStreak: 7 },
      isAuthenticated: true,
      logout: mockLogout,
    }
  })

  it('logged-in user → sidebar-widgets block visible', () => {
    renderAppLayout()
    expect(screen.getByTestId('sidebar-widgets')).toBeInTheDocument()
    expect(screen.getByTestId('streak-widget')).toBeInTheDocument()
    // DailyMissionWidget is in skeleton state by default mock
    expect(screen.getByTestId('daily-mission-widget-skeleton')).toBeInTheDocument()
  })

  it('logged-out user (user=null) → sidebar-widgets block does NOT render', () => {
    authState = { user: null, isAuthenticated: false, logout: mockLogout }
    renderAppLayout()
    expect(screen.queryByTestId('sidebar-widgets')).toBeNull()
    expect(screen.queryByTestId('streak-widget')).toBeNull()
    expect(screen.queryByTestId('daily-mission-widget')).toBeNull()
    expect(screen.queryByTestId('daily-mission-widget-skeleton')).toBeNull()
  })

  it('mission data loaded → DailyMissionWidget renders (not skeleton)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        date: '2026-04-30',
        missions: [
          { slot: 1, type: 'x', description: 'a', progress: 5, target: 5, completed: true },
          { slot: 2, type: 'y', description: 'b', progress: 2, target: 5, completed: false },
          { slot: 3, type: 'z', description: 'c', progress: 0, target: 5, completed: false },
        ],
        allCompleted: false,
        bonusClaimed: false,
        bonusXp: 100,
      },
      isLoading: false,
      isError: false,
    })
    renderAppLayout()
    expect(screen.getByTestId('daily-mission-widget')).toBeInTheDocument()
    expect(screen.getByTestId('daily-mission-widget-progress')).toHaveTextContent('1/3')
    // Skeleton no longer in tree once data loaded
    expect(screen.queryByTestId('daily-mission-widget-skeleton')).toBeNull()
  })

  it('widgets do NOT leak into the mobile bottom nav', () => {
    renderAppLayout()
    // Find the mobile bottom <nav> by its md:hidden visibility class.
    // It's the only nav that has 'md:hidden' as a class.
    const bottomNav = document.querySelector('nav.md\\:hidden')
    expect(bottomNav).not.toBeNull()
    // The bottom nav must NOT contain any of the widget testids.
    expect(bottomNav!.querySelector('[data-testid="streak-widget"]')).toBeNull()
    expect(bottomNav!.querySelector('[data-testid="daily-mission-widget"]')).toBeNull()
    expect(bottomNav!.querySelector('[data-testid="sidebar-widgets"]')).toBeNull()
  })
})
