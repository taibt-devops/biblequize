import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Unit tests for Login Page (Stitch design).
 * Tests: rendering, OAuth button, email form, validation, auth redirect.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useSearchParams: () => [new URLSearchParams(), vi.fn()] }
})

let authState = { isAuthenticated: false, isLoading: false, user: null as any }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => selector ? selector(authState) : authState,
  useAuth: () => authState,
}))

import Login from '../Login'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState = { isAuthenticated: false, isLoading: false, user: null }
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderLogin()
      expect(screen.getByText(/Chào mừng trở lại/i)).toBeInTheDocument()
    })

    it('renders Google OAuth button', () => {
      renderLogin()
      expect(screen.getByText(/Google/i)).toBeInTheDocument()
    })

    it('hides the email/password form by default — only Google is offered', () => {
      renderLogin()
      expect(document.querySelector('input[type="email"]')).not.toBeInTheDocument()
      expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument()
      expect(screen.queryByText(/Đăng ký ngay/i)).not.toBeInTheDocument()
      expect(screen.getByTestId('login-other-methods-btn')).toHaveTextContent('Đăng nhập bằng cách khác')
    })

    it('shows the email/password form and the register link after "Đăng nhập bằng cách khác"', () => {
      renderLogin()
      fireEvent.click(screen.getByTestId('login-other-methods-btn'))
      expect(document.querySelector('input[type="email"]')).toBeInTheDocument()
      expect(document.querySelector('input[type="password"]')).toBeInTheDocument()
      expect(screen.getByText(/Đăng ký ngay/i)).toBeInTheDocument()
      expect(screen.queryByTestId('login-other-methods-btn')).not.toBeInTheDocument()
    })

    it('renders BibleQuiz branding', () => {
      renderLogin()
      const brand = screen.getAllByText(/Bible/i)
      expect(brand.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Auth redirect', () => {
    it('redirects to / when already authenticated', () => {
      authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
      renderLogin()
      expect(mockNavigate).toHaveBeenCalledWith('/', expect.anything())
    })

    it('does NOT redirect when not authenticated', () => {
      authState = { isAuthenticated: false, isLoading: false, user: null }
      renderLogin()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Guest mode', () => {
    it('renders guest play link', () => {
      renderLogin()
      const guestLink = screen.getByText(/không cần đăng nhập/i) || screen.getByText(/chơi thử/i)
      expect(guestLink).toBeInTheDocument()
    })
  })
})
