import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'

/**
 * "/" is one screen for everyone, inside AppLayout (2026-10-09): Home for signed-in players,
 * the guest crossroads (GuestHome) for visitors. Nothing renders until the auth check is done,
 * so a player never sees the guest home flash.
 */

let authState = { isAuthenticated: false, isLoading: false, user: null as any }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (state: any) => any) => (selector ? selector(authState) : authState),
}))

vi.mock('../../layouts/AppLayout', () => ({
  default: () => <div data-testid="app-layout"><Outlet /></div>,
}))
vi.mock('../Home', () => ({
  default: () => <div data-testid="home-page">Home Dashboard</div>,
}))
vi.mock('../GuestHome', () => ({
  default: () => <div data-testid="guest-home">Guest crossroads</div>,
}))

import { HomeShell, HomeIndex } from '../HomeEntry'

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<HomeShell />}>
          <Route path="/" element={<HomeIndex />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('"/" routing for visitors and players', () => {
  beforeEach(() => {
    authState = { isAuthenticated: false, isLoading: false, user: null }
  })

  it('shows the guest crossroads inside AppLayout when NOT signed in', async () => {
    renderApp('/')
    await waitFor(() => expect(screen.getByTestId('guest-home')).toBeInTheDocument())
    expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('shows Home inside AppLayout when signed in', async () => {
    authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'test@test.com' } }
    renderApp('/')
    await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument())
    expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    expect(screen.queryByTestId('guest-home')).not.toBeInTheDocument()
  })

  it('renders nothing while the auth check is running', () => {
    authState = { isAuthenticated: false, isLoading: true, user: null }
    renderApp('/')
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument()
    expect(screen.queryByTestId('guest-home')).not.toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })
})
