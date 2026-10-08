import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
const mockLocation = { state: null as any }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useLocation: () => mockLocation }
})

const mockApiPost = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}))

import Review from '../Review'

const mockStats = {
  correctAnswers: 2,
  totalQuestions: 3,
  totalTime: 154000,
  sessionId: 'sess-1',
  questions: [
    { id: 'q1', book: 'Genesis', chapter: 1, difficulty: 'easy', content: 'Ai tạo nên trời đất?', options: ['Chúa', 'Người', 'Thiên nhiên', 'Không ai'], correctAnswer: [0], explanation: 'Đức Chúa Trời dựng nên trời và đất.', contextNote: 'Sáng Thế Ký 1:1' },
    { id: 'q2', book: 'Exodus', chapter: 3, difficulty: 'medium', content: 'Núi nào?', options: ['Si-na-i', 'Hô-rếp', 'Carmel', 'Tabor'], correctAnswer: [1], explanation: 'Núi Hô-rếp.', contextNote: null },
    { id: 'q3', book: 'Genesis', chapter: 2, difficulty: 'hard', content: 'Câu 3?', options: ['A', 'B', 'C', 'D'], correctAnswer: [2], explanation: 'Đáp án C.', contextNote: 'Bối cảnh lịch sử' },
  ],
  userAnswers: [0, 0, 2],
}

function renderReview(stats = mockStats) {
  mockLocation.state = { stats }
  return render(<MemoryRouter><Review /></MemoryRouter>)
}

describe('Review Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiPost.mockResolvedValue({ data: { sessionId: 'new-sess' } })
  })

  it('renders header with score summary', () => {
    renderReview()
    expect(screen.getByText('Xem lại bài làm')).toBeInTheDocument()
    expect(screen.getByText(/2\/3 đúng/)).toBeInTheDocument()
  })

  it('renders all question cards', () => {
    renderReview()
    expect(screen.getByText('Câu 01')).toBeInTheDocument()
    expect(screen.getByText('Câu 02')).toBeInTheDocument()
    expect(screen.getByText('Câu 03')).toBeInTheDocument()
  })

  it('shows correct answer with green indicator', () => {
    renderReview()
    const badges = screen.getAllByText('Câu trả lời của bạn')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows "Đáp án đúng" for wrong question', () => {
    renderReview()
    expect(screen.getAllByText('Đáp án đúng').length).toBeGreaterThan(0)
  })

  it('shows explanation for each question', () => {
    renderReview()
    expect(screen.getByText('Đức Chúa Trời dựng nên trời và đất.')).toBeInTheDocument()
    expect(screen.getByText('Núi Hô-rếp.')).toBeInTheDocument()
  })

  it('shows contextNote when available', () => {
    renderReview()
    expect(screen.getByText('Sáng Thế Ký 1:1')).toBeInTheDocument()
    expect(screen.getByText('Bối cảnh lịch sử')).toBeInTheDocument()
  })

  it('renders filter tabs with counts', () => {
    renderReview()
    expect(screen.getByText('Tất cả (3)')).toBeInTheDocument()
    expect(screen.getByText('Câu sai (1)')).toBeInTheDocument()
    expect(screen.getByText('Câu đúng (2)')).toBeInTheDocument()
  })

  it('filter "Câu sai" shows only wrong', async () => {
    renderReview()
    await userEvent.setup().click(screen.getByText('Câu sai (1)'))
    expect(screen.getByText('Câu 02')).toBeInTheDocument()
    expect(screen.queryByText('Câu 01')).not.toBeInTheDocument()
  })

  it('filter "Câu đúng" shows only correct', async () => {
    renderReview()
    await userEvent.setup().click(screen.getByText('Câu đúng (2)'))
    expect(screen.getByText('Câu 01')).toBeInTheDocument()
    expect(screen.queryByText('Câu 02')).not.toBeInTheDocument()
  })

  it('bookmark toggle calls API', async () => {
    renderReview()
    const stars = screen.getAllByRole('button', { name: 'Đánh dấu câu này' })
    await userEvent.setup().click(stars[0])
    expect(stars[0]).toHaveAttribute('aria-pressed', 'true')
    expect(mockApiPost).toHaveBeenCalledWith('/api/me/bookmarks', { questionId: 'q1' })
  })

  it('retry button calls API', async () => {
    renderReview()
    await userEvent.setup().click(screen.getByText(/Làm lại câu sai/))
    expect(mockApiPost).toHaveBeenCalledWith('/api/sessions/sess-1/retry')
  })

  it('shows empty state when no stats', () => {
    mockLocation.state = null
    render(<MemoryRouter><Review /></MemoryRouter>)
    expect(screen.getByText('Không có dữ liệu để xem lại')).toBeInTheDocument()
  })

  it('does NOT contain neon-* classes', () => {
    renderReview()
    expect(document.body.innerHTML).not.toContain('neon-')
  })

  it('shows difficulty badges', () => {
    renderReview()
    expect(screen.getByText('Dễ')).toBeInTheDocument()
    expect(screen.getByText('Trung bình')).toBeInTheDocument()
    expect(screen.getByText('Khó')).toBeInTheDocument()
  })
})
