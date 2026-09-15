import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}))

// Auth state is toggled per-test. Default = logged in (authed path: POST
// /api/sessions). Guest tests flip this to false to exercise the local
// no-session path (GET /api/questions).
let mockIsAuthenticated = true
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const state = { isAuthenticated: mockIsAuthenticated, user: null, isLoading: false, isAdmin: false }
    return selector ? selector(state) : state
  },
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}))

import Practice from '../Practice'

function renderPractice() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Practice />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Practice Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = true
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/books' || url.endsWith('/books'))
        return Promise.resolve({ data: [
          { id: '1', name: 'Genesis', nameVi: 'Sáng Thế Ký', testament: 'OT', orderIndex: 1 },
          { id: '2', name: 'Matthew', nameVi: 'Ma-thi-ơ', testament: 'NT', orderIndex: 40 },
        ] })
      if (url.includes('/practice/recent')) return Promise.resolve({ data: [] })
      if (url.includes('/wrong-questions/count')) return Promise.resolve({ data: { count: 0 } })
      return Promise.reject(new Error('Not found'))
    })
    mockApiPost.mockResolvedValue({ data: { sessionId: 'sess-1', questions: [] } })
  })

  it('renders page title', () => {
    renderPractice()
    expect(screen.getByText(/Luyện/)).toBeInTheDocument()
    expect(screen.getByText(/Tập/)).toBeInTheDocument()
  })

  it('HT-19: shows the Memorize entry card (SPEC_USER §5.1.1)', () => {
    renderPractice()
    expect(screen.getByTestId('memorize-entry-card')).toHaveTextContent('Học Thuộc câu gốc')
  })

  it('renders difficulty options (Dễ, TB, Khó, Hỗn hợp equivalent)', () => {
    renderPractice()
    expect(screen.getByText('Dễ')).toBeInTheDocument()
    expect(screen.getByText('Trung bình')).toBeInTheDocument()
    expect(screen.getByText('Khó')).toBeInTheDocument()
  })

  it('renders question count section', () => {
    renderPractice()
    expect(screen.getByText('Số câu hỏi')).toBeInTheDocument()
  })

  it('renders show explanation toggle', () => {
    renderPractice()
    expect(screen.getByText('Hiển thị giải thích')).toBeInTheDocument()
  })

  it('renders start CTA button after books load', async () => {
    renderPractice()
    await waitFor(() => {
      expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument()
    })
  })

  it('hides retry-wrong banner when no wrong questions', async () => {
    renderPractice()
    // wrongCount is 0 in default mock → banner should not render
    await waitFor(() => expect(screen.queryByTestId('practice-retry-wrong')).not.toBeInTheDocument())
  })

  it('shows retry-wrong banner with count when API returns >0', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/books' || url.endsWith('/books'))
        return Promise.resolve({ data: [] })
      if (url.includes('/practice/recent')) return Promise.resolve({ data: [] })
      if (url.includes('/wrong-questions/count')) return Promise.resolve({ data: { count: 7 } })
      return Promise.reject(new Error('Not found'))
    })
    renderPractice()
    await waitFor(() => {
      expect(screen.getByTestId('practice-retry-wrong')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
    })
  })

  it('hides recent sessions when API returns empty list', async () => {
    renderPractice()
    await waitFor(() => expect(screen.queryByText('Phiên gần đây')).not.toBeInTheDocument())
  })

  it('renders recent sessions when API returns sessions', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/books' || url.endsWith('/books'))
        return Promise.resolve({ data: [] })
      if (url.includes('/practice/recent')) return Promise.resolve({ data: [
        { sessionId: 's1', createdAt: new Date().toISOString(), status: 'completed',
          totalQuestions: 10, correctAnswers: 8, accuracy: 80, book: 'Genesis' },
      ] })
      if (url.includes('/wrong-questions/count')) return Promise.resolve({ data: { count: 0 } })
      return Promise.reject(new Error('Not found'))
    })
    renderPractice()
    await waitFor(() => {
      expect(screen.getByText('Phiên gần đây')).toBeInTheDocument()
      expect(screen.getByText('Genesis')).toBeInTheDocument()
      expect(screen.getByText('80%')).toBeInTheDocument()
    })
  })

  it('clicking difficulty option updates selection', async () => {
    renderPractice()
    const user = userEvent.setup()
    await user.click(screen.getByText('Khó'))
    // The "Khó" button should now be active (has check_circle icon)
    const hardBtn = screen.getByText('Khó').closest('button')
    expect(hardBtn?.className).toContain('ring-bq-sapphire')
  })

  it('clicking start calls API and navigates', async () => {
    renderPractice()
    const user = userEvent.setup()
    // Wait for books to load so button is enabled
    await waitFor(() => {
      expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Bắt Đầu Luyện Tập/).closest('button')!)
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        mode: 'practice',
      }))
    })
  })

  it('shows error message when API fails', async () => {
    mockApiPost.mockRejectedValue(new Error('Server error'))
    renderPractice()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Bắt Đầu Luyện Tập/).closest('button')!)
    await waitFor(() => {
      expect(screen.getByText(/Không tạo được phiên luyện tập/)).toBeInTheDocument()
    })
  })

  it('has back link to home', () => {
    renderPractice()
    const backLink = screen.getByText('Quay lại trang chủ')
    expect(backLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders time-per-question slider with default 30s', () => {
    renderPractice()
    const slider = screen.getByTestId('practice-time-slider') as HTMLInputElement
    expect(slider).toBeInTheDocument()
    expect(slider.value).toBe('30')
    expect(slider.min).toBe('5')
    expect(slider.max).toBe('120')
  })

  it('start payload includes timePerQuestion and skips chapter/verse when unset', async () => {
    renderPractice()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument())
    await user.click(screen.getByText(/Bắt Đầu Luyện Tập/).closest('button')!)
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        mode: 'practice',
        timePerQuestion: 30,
      }))
    })
    const payload = mockApiPost.mock.calls[0][1]
    expect(payload.chapterFrom).toBeUndefined()
    expect(payload.verseFrom).toBeUndefined()
  })

  it('chapter inputs disabled until a book is selected', () => {
    renderPractice()
    const chFrom = screen.getByTestId('practice-chapter-from') as HTMLInputElement
    expect(chFrom).toBeDisabled()
  })

  it('verse inputs disabled when no single chapter selected', () => {
    renderPractice()
    const vFrom = screen.getByTestId('practice-verse-from') as HTMLInputElement
    expect(vFrom).toBeDisabled()
  })

  // ── Guest (logged-out) local practice — SPEC_USER §5.1 "guest có thể chơi" ──
  const SAMPLE_Q = {
    id: 'q1', book: 'Genesis', chapter: 1, difficulty: 'easy',
    type: 'multiple_choice_single', content: 'Câu hỏi?',
    options: ['A', 'B', 'C', 'D'], correctAnswer: [0], explanation: '',
  }

  function mockGuestApi(questions: any[]) {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/books' || url.endsWith('/books'))
        return Promise.resolve({ data: [
          { id: '1', name: 'Genesis', nameVi: 'Sáng Thế Ký', testament: 'OT', orderIndex: 1 },
        ] })
      if (url === '/api/questions') return Promise.resolve({ data: questions })
      return Promise.reject(new Error('Not found'))
    })
  }

  it('guest starts a local no-session quiz via /api/questions (not POST /api/sessions)', async () => {
    mockIsAuthenticated = false
    mockGuestApi([SAMPLE_Q])
    renderPractice()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument())
    await user.click(screen.getByText(/Bắt Đầu Luyện Tập/).closest('button')!)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/questions', expect.objectContaining({
        params: expect.objectContaining({ limit: 10 }),
      }))
    })
    // No server session is created for guests
    expect(mockApiPost).not.toHaveBeenCalledWith('/api/sessions', expect.anything())
    // Navigates to /quiz with questions but NO sessionId (Quiz.tsx local mode)
    const navCall = mockNavigate.mock.calls.find((c: any[]) => c[0] === '/quiz')
    expect(navCall).toBeTruthy()
    expect(navCall![1].state.mode).toBe('practice')
    expect(navCall![1].state.questions).toHaveLength(1)
    expect(navCall![1].state.sessionId).toBeUndefined()
  })

  it('guest does not fire logged-in-only history queries (practice/recent + wrong-count)', async () => {
    mockIsAuthenticated = false
    mockGuestApi([SAMPLE_Q])
    renderPractice()
    await waitFor(() => expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument())
    expect(mockApiGet).not.toHaveBeenCalledWith('/api/sessions/practice/recent', expect.anything())
    expect(mockApiGet).not.toHaveBeenCalledWith('/api/sessions/practice/wrong-questions/count')
  })

  it('guest shows error when no questions match the filters', async () => {
    mockIsAuthenticated = false
    mockGuestApi([])
    renderPractice()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByText(/Bắt Đầu Luyện Tập/)).toBeInTheDocument())
    await user.click(screen.getByText(/Bắt Đầu Luyện Tập/).closest('button')!)
    await waitFor(() => {
      expect(screen.getByText(/Không tạo được phiên luyện tập/)).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/quiz', expect.anything())
  })
})
