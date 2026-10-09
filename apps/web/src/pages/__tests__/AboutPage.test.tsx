import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let authState = { isAuthenticated: false, isLoading: false, user: null as any }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => selector ? selector(authState) : authState,
}))

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({ api: { get: (...a: any[]) => mockApiGet(...a) } }))

import AboutPage from '../AboutPage'

function renderLanding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// /gioi-thieu: the long-form introduction that used to be the guest home "/".
describe('AboutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState = { isAuthenticated: false, isLoading: false, user: null }
    // Default: public board empty → preview shows the curated fallback.
    mockApiGet.mockResolvedValue({ data: [] })
  })

  it('renders hero section with headline', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Trắc nghiệm Kinh Thánh|Bible quizzes/i)
  })

  it('renders CTA button', () => {
    renderLanding()
    expect(screen.getByText(/Chơi Thử Ngay|Try Now/i)).toBeInTheDocument()
  })

  it('opens on the village gate painting and loads no external placeholder images', () => {
    renderLanding()
    expect(document.querySelector('img[src="/images/lk/place-gate.webp"]')).not.toBeNull()
    expect(document.querySelector('img[src*="googleusercontent"]')).toBeNull()
  })

  it('renders features grid section', () => {
    renderLanding()
    expect(screen.getByText(/6 Chế Độ Chơi|6 Game Modes/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Nhóm Hội Thánh|Church Groups/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders leaderboard preview section', () => {
    renderLanding()
    expect(screen.getByText(/Bảng Xếp Hạng Toàn Quốc|National Leaderboard/i)).toBeInTheDocument()
  })

  it('nav "Xếp hạng" scrolls in-page (anchor #leaderboard), not a route to /leaderboard', () => {
    renderLanding()
    const anchor = document.querySelector('a[href="#leaderboard"]')
    expect(anchor).not.toBeNull()
    // The preview section is the scroll target.
    expect(document.getElementById('leaderboard')).not.toBeNull()
  })

  it('nav highlights "Giới thiệu" at the top of the page, and "Trang chủ" leads back to the crossroads "/"', () => {
    renderLanding()
    const about = document.querySelector('a[href="#features"]')
    const board = document.querySelector('a[href="#leaderboard"]')
    expect(about?.className).toContain('border-bq-amber')
    expect(board?.className).not.toContain('border-bq-amber')
    expect(screen.getByRole('link', { name: /Trang chủ|Home/ })).toHaveAttribute('href', '/')
  })

  it('nav "Giới thiệu" scrolls in-page to the features section (#features)', () => {
    renderLanding()
    expect(document.querySelector('a[href="#features"]')).not.toBeNull()
    expect(document.getElementById('features')).not.toBeNull()
  })

  it('preview "full board" CTA funnels guests to /login (not the bare guest /leaderboard)', () => {
    renderLanding()
    expect(screen.getByText(/Đăng nhập để xem bảng đầy đủ|Log in to see the full board/i)).toBeInTheDocument()
    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull()
  })

  it('preview shows live board data from the public endpoint when available', async () => {
    mockApiGet.mockResolvedValue({ data: [
      { userId: 'u1', name: 'Sống Động', points: 99999, avatarUrl: null },
    ] })
    renderLanding()
    await waitFor(() => { expect(screen.getByText('Sống Động')).toBeInTheDocument() })
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/public/leaderboard'))
    // Hardcoded sample name should NOT appear once live data is present.
    expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument()
  })

  it('renders daily verse section', () => {
    renderLanding()
    expect(screen.getByText(/Lời Chúa là ngọn đèn/i)).toBeInTheDocument()
  })

  it('renders footer with BibleQuiz branding', () => {
    renderLanding()
    const footerBrand = screen.getAllByText('BibleQuiz')
    expect(footerBrand.length).toBeGreaterThanOrEqual(1)
  })

  it('renders navigation with auth links', () => {
    renderLanding()
    // Auth text varies by language (Đăng nhập / Log In)
    expect(screen.getAllByText(/Đăng nhập|Log In/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Đăng ký|Register/i).length).toBeGreaterThanOrEqual(1)
  })

  it('stays open for signed-in players (no redirect to /)', () => {
    authState = {
      isAuthenticated: true,
      isLoading: false,
      user: { name: 'Test', email: 'test@test.com' },
    }
    renderLanding()
    expect(screen.getByTestId('about-page')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('opens for visitors too', () => {
    authState = { isAuthenticated: false, isLoading: false, user: null }
    renderLanding()
    expect(screen.getByTestId('about-page')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
