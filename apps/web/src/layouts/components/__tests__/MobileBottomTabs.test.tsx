import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let authState: any = {}
vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: (state: any) => any) => (selector ? selector(authState) : authState),
  useAuth: () => authState,
}))

import MobileBottomTabs from '../MobileBottomTabs'

function renderTabs() {
  return render(
    <MemoryRouter initialEntries={['/leaderboard']}>
      <MobileBottomTabs />
    </MemoryRouter>
  )
}

describe('MobileBottomTabs — auth-aware tabs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows all tabs when authenticated', () => {
    authState = { isAuthenticated: true }
    renderTabs()
    expect(screen.getByTestId('mobile-tab-home')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-leaderboard')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-groups')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-journey')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-profile')).toBeInTheDocument()
  })

  it('hides auth-only tabs (journey / groups / profile) for guests', () => {
    authState = { isAuthenticated: false }
    renderTabs()
    expect(screen.getByTestId('mobile-tab-home')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-leaderboard')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-tab-groups')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-tab-journey')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-tab-profile')).not.toBeInTheDocument()
  })
})
