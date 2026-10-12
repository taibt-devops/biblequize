import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Unit tests for AuthCallback page.
 * Tests: loading state, code exchange, login, navigation, error handling.
 */

const mockNavigate = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  }
})

const mockLogin = vi.fn()
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const state = { login: mockLogin, isAuthenticated: false, user: null }
    return selector ? selector(state) : state
  },
  useAuth: () => ({ login: mockLogin, isAuthenticated: false, user: null }),
}))

const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
  },
}))

import AuthCallback from '../AuthCallback'

function renderAuthCallback() {
  return render(
    <MemoryRouter>
      <AuthCallback />
    </MemoryRouter>
  )
}

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSearchParams = new URLSearchParams()
    mockApiPost.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders loading spinner when processing', () => {
    // No code param, but the spinner shows initially before the effect runs
    mockSearchParams = new URLSearchParams('code=test123')
    mockApiPost.mockReturnValue(new Promise(() => {})) // never resolves
    renderAuthCallback()

    expect(screen.getByText('Đang xử lý...')).toBeInTheDocument()
  })

  it('with code param calls api.post to exchange', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockResolvedValue({
      data: {
        accessToken: 'token123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        role: 'USER',
      },
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/auth/exchange', { code: 'abc123' })
    })
  })

  it('exchange success calls login() with tokens and user data', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockResolvedValue({
      data: {
        accessToken: 'token123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://avatar.url',
        role: 'ADMIN',
      },
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        accessToken: 'token123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://avatar.url',
        role: 'ADMIN',
      })
    })
  })

  it('exchange success navigates to /', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockResolvedValue({
      data: {
        accessToken: 'token123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        role: 'USER',
      },
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    }, { timeout: 2000 })
  })

  it('PCV-24: có trang cần quay lại (nhớ trước khi sang Google) thì về đúng trang đó', async () => {
    vi.useRealTimers()
    sessionStorage.setItem('bq.returnPath', JSON.stringify({ path: '/room/create?passage=Genesis:27-28', at: Date.now() }))
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockResolvedValue({
      data: { accessToken: 'token123', name: 'Test User', email: 'test@example.com', avatar: null, role: 'USER' },
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/room/create?passage=Genesis:27-28')
    }, { timeout: 2000 })
    expect(sessionStorage.getItem('bq.returnPath')).toBeNull()
  })

  it('no code param shows error', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams()

    renderAuthCallback()

    await waitFor(() => {
      expect(screen.getByText('No authentication code received')).toBeInTheDocument()
    })
  })

  it('errorParam in URL shows OAuth error', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('error=access_denied')

    renderAuthCallback()

    await waitFor(() => {
      expect(screen.getByText('OAuth error: access_denied')).toBeInTheDocument()
    })
  })

  it('API exchange failure shows error message', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockRejectedValue({
      response: { data: { message: 'Invalid code' } },
      message: 'Request failed',
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(screen.getByText(/Lỗi xác thực.*Invalid code/)).toBeInTheDocument()
    })
  })

  it('shows success message after login', async () => {
    vi.useRealTimers()
    mockSearchParams = new URLSearchParams('code=abc123')
    mockApiPost.mockResolvedValue({
      data: {
        accessToken: 'token123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        role: 'USER',
      },
    })

    renderAuthCallback()

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập thành công!')).toBeInTheDocument()
    })
  })
})
