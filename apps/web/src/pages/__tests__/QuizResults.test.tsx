import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
// Book names are localized through /api/books (react-query); keep the English keys here.
vi.mock('../../hooks/useBookName', () => ({ useBookName: () => (k: string) => k }))

import QuizResults from '../QuizResults'

const baseStats = {
  totalScore: 150,
  correctAnswers: 8,
  totalQuestions: 10,
  accuracy: 80,
  averageTime: 5000,
  totalTime: 50000,
  difficultyBreakdown: {
    easy: { correct: 3, total: 4, score: 40 },
    medium: { correct: 3, total: 3, score: 60 },
    hard: { correct: 2, total: 3, score: 50 },
  },
  timePerQuestion: [4000, 5000, 3000, 6000, 4000, 5000, 7000, 3000, 5000, 8000],
  questions: [
    { id: '1', book: 'Genesis', chapter: 1, difficulty: 'easy' as const, type: 'mcq', content: 'Q1', options: ['A','B','C','D'], correctAnswer: [0], explanation: 'E1' },
    { id: '2', book: 'Genesis', chapter: 2, difficulty: 'easy' as const, type: 'mcq', content: 'Q2', options: ['A','B','C','D'], correctAnswer: [1], explanation: 'E2' },
  ],
  userAnswers: [0, 1],
  questionScores: [20, 20],
}

const mockPlayAgain = vi.fn()
const mockBackToHome = vi.fn()

function renderResults(overrides: Partial<typeof baseStats> = {}) {
  return render(
    <MemoryRouter>
      <QuizResults stats={{ ...baseStats, ...overrides } as any} onPlayAgain={mockPlayAgain} onBackToHome={mockBackToHome} />
    </MemoryRouter>
  )
}

describe('QuizResults', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders hero block with emoji + tone message', () => {
    renderResults({ correctAnswers: 9, totalQuestions: 10 })
    expect(screen.getByTestId('quiz-results-hero')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-results-grade')).toHaveTextContent('Xuất sắc!')
  })

  it('shows "Tốt lắm!" tone for 70-89%', () => {
    renderResults({ correctAnswers: 7, totalQuestions: 10 })
    expect(screen.getByText('Tốt lắm!')).toBeInTheDocument()
  })

  it('shows "Khá hơn rồi!" tone for 50-69%', () => {
    renderResults({ correctAnswers: 5, totalQuestions: 10 })
    expect(screen.getByText('Khá hơn rồi!')).toBeInTheDocument()
  })

  it('shows "Đang học hỏi nhé!" tone for 30-49%', () => {
    renderResults({ correctAnswers: 3, totalQuestions: 10 })
    expect(screen.getByText('Đang học hỏi nhé!')).toBeInTheDocument()
  })

  it('renders correct/total in score stat', () => {
    renderResults()
    const score = screen.getByTestId('quiz-results-score')
    expect(score.textContent).toContain('8')
    expect(score.textContent).toContain('/10')
  })

  it('renders accuracy percent', () => {
    renderResults()
    expect(screen.getByTestId('quiz-results-accuracy')).toHaveTextContent('80%')
  })

  it('renders total score slot in hero block (even without bonuses)', () => {
    renderResults({ totalScore: 150 })
    expect(screen.getByTestId('quiz-results-total-score')).toBeInTheDocument()
  })

  it('does NOT render score breakdown when there are no bonuses', () => {
    renderResults()
    expect(screen.queryByTestId('quiz-results-breakdown')).not.toBeInTheDocument()
  })

  it('renders score breakdown when speed/combo bonuses are present', () => {
    renderResults({ baseScore: 100, speedBonus: 30, comboBonus: 20, comboMultiplier: 1.5, totalScore: 150 } as any)
    expect(screen.getByTestId('quiz-results-breakdown')).toBeInTheDocument()
    expect(screen.getByText(/Bonus tốc độ/)).toBeInTheDocument()
  })

  it('renders difficulty breakdown for single-book quiz', () => {
    renderResults()
    expect(screen.getByText('Phân tích theo độ khó')).toBeInTheDocument()
    expect(screen.getAllByText('Dễ').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trung bình').length).toBeGreaterThan(0)
    expect(screen.getByText('TB')).toBeInTheDocument()
    expect(screen.getAllByText('Khó').length).toBeGreaterThan(0)
  })

  it('renders strongest/weakest analysis for multi-book quiz', () => {
    renderResults({
      questions: [
        { id: '1', book: 'Genesis', chapter: 1, difficulty: 'easy' as const, type: 'mcq', content: 'Q1', options: ['A','B','C','D'], correctAnswer: [0], explanation: 'E1' },
        { id: '2', book: 'Exodus', chapter: 2, difficulty: 'easy' as const, type: 'mcq', content: 'Q2', options: ['A','B','C','D'], correctAnswer: [1], explanation: 'E2' },
      ],
    } as any)
    expect(screen.getByText(/Mạnh nhất/)).toBeInTheDocument()
  })

  it('renders 3 action buttons with correct hierarchy', () => {
    renderResults({ correctAnswers: 9, totalQuestions: 10 })
    expect(screen.getByTestId('quiz-results-review-btn')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-results-play-btn')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-results-home-btn')).toBeInTheDocument()
  })

  it('primary CTA always shows "Chơi lại sách này" regardless of score', () => {
    renderResults({ correctAnswers: 9, totalQuestions: 10 })
    expect(screen.getByTestId('quiz-results-play-btn')).toHaveTextContent('Chơi lại sách này')
    renderResults({ correctAnswers: 3, totalQuestions: 10 })
    expect(screen.getAllByTestId('quiz-results-play-btn')[0]).toHaveTextContent('Chơi lại sách này')
  })

  it('triggers confetti when score ≥ 70%', async () => {
    const confetti = (await import('canvas-confetti')).default as ReturnType<typeof vi.fn>
    confetti.mockClear()
    renderResults({ correctAnswers: 9, totalQuestions: 10 })
    expect(confetti).toHaveBeenCalled()
  })

  it('does NOT trigger confetti when score < 70%', async () => {
    const confetti = (await import('canvas-confetti')).default as ReturnType<typeof vi.fn>
    confetti.mockClear()
    renderResults({ correctAnswers: 3, totalQuestions: 10 })
    expect(confetti).not.toHaveBeenCalled()
  })

  it('"Xem lại bài" navigates to /review', async () => {
    renderResults()
    await userEvent.setup().click(screen.getByTestId('quiz-results-review-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/review', expect.anything())
  })

  it('primary CTA calls onPlayAgain', async () => {
    renderResults()
    await userEvent.setup().click(screen.getByTestId('quiz-results-play-btn'))
    expect(mockPlayAgain).toHaveBeenCalled()
  })

  it('"Về trang chủ" calls onBackToHome', async () => {
    renderResults()
    await userEvent.setup().click(screen.getByTestId('quiz-results-home-btn'))
    expect(mockBackToHome).toHaveBeenCalled()
  })

  it('shows error state when stats is null', () => {
    render(<MemoryRouter><QuizResults stats={null as any} onPlayAgain={mockPlayAgain} onBackToHome={mockBackToHome} /></MemoryRouter>)
    expect(screen.getByText('Không có dữ liệu kết quả')).toBeInTheDocument()
  })
})
