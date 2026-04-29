import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Tests for BasicQuiz page (route: /basic-quiz). Covers:
 *  - render question + options on load
 *  - answer all 10 → submit pass → CTA navigates to /ranked
 *  - answer all 10 → submit fail → review screen with wrong-answer entries
 *  - error path (BE returns failure) → error UI with Retry
 *  - prev/next navigation between questions
 *  - submit disabled until all 10 answered
 */

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

vi.mock('../../utils/quizLanguage', () => ({
  getQuizLanguage: () => 'vi',
}))

import BasicQuiz from '../BasicQuiz'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BasicQuiz />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const TEN_QUESTIONS = Array.from({ length: 10 }).map((_, i) => ({
  id: `q-${i}`,
  content: `Câu hỏi số ${i + 1}`,
  options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockApiGet.mockResolvedValue({ data: TEN_QUESTIONS })
})

describe('BasicQuiz page — playing phase', () => {
  it('renders question 1/10 + 4 options after loading', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByTestId('basic-quiz-page')).toBeInTheDocument())
    expect(screen.getByTestId('basic-quiz-question')).toHaveTextContent('Câu hỏi số 1')
    expect(screen.getByTestId('basic-quiz-counter')).toHaveTextContent(/1\s*\/\s*10/)
    // 4 option buttons rendered as basic-quiz-option-{0..3}.
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`basic-quiz-option-${i}`)).toBeInTheDocument()
    }
  })

  it('Submit button is disabled until all 10 answered', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByTestId('basic-quiz-page')).toBeInTheDocument())

    // Walk to the last question without answering anything by repeatedly
    // selecting then advancing. Stop one question short.
    for (let i = 0; i < 9; i++) {
      await user.click(screen.getByTestId('basic-quiz-option-0'))
      await user.click(screen.getByTestId('basic-quiz-next'))
    }

    // On the last question, no answer picked yet → Submit is disabled.
    expect(screen.getByTestId('basic-quiz-counter')).toHaveTextContent(/10\s*\/\s*10/)
    const submit = screen.getByTestId('basic-quiz-submit') as HTMLButtonElement
    expect(submit).toBeDisabled()

    // Pick an answer for q10 → submit becomes enabled.
    await user.click(screen.getByTestId('basic-quiz-option-1'))
    expect(submit).not.toBeDisabled()
  })

  it('Prev/Next walk through questions and preserve picked answer', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => expect(screen.getByTestId('basic-quiz-page')).toBeInTheDocument())

    await user.click(screen.getByTestId('basic-quiz-option-2'))
    expect(screen.getByTestId('basic-quiz-option-2')).toHaveAttribute('data-selected', 'true')

    await user.click(screen.getByTestId('basic-quiz-next'))
    expect(screen.getByTestId('basic-quiz-counter')).toHaveTextContent(/2\s*\/\s*10/)
    // Q2 has no selection yet.
    expect(screen.getByTestId('basic-quiz-option-2')).toHaveAttribute('data-selected', 'false')

    await user.click(screen.getByTestId('basic-quiz-prev'))
    expect(screen.getByTestId('basic-quiz-counter')).toHaveTextContent(/1\s*\/\s*10/)
    // Q1 selection persists.
    expect(screen.getByTestId('basic-quiz-option-2')).toHaveAttribute('data-selected', 'true')
  })
})

describe('BasicQuiz page — submit + result', () => {
  async function answerAllAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByTestId('basic-quiz-page')).toBeInTheDocument())
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByTestId('basic-quiz-option-0'))
      if (i < 9) await user.click(screen.getByTestId('basic-quiz-next'))
    }
    await user.click(screen.getByTestId('basic-quiz-submit'))
  }

  it('renders pass screen + CTA navigates to /ranked', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        passed: true,
        correctCount: 10,
        totalQuestions: 10,
        threshold: 8,
        attemptCount: 1,
        cooldownSeconds: 0,
        wrongAnswers: [],
      },
    })
    const user = userEvent.setup()
    renderPage()
    await answerAllAndSubmit(user)

    await waitFor(() => expect(screen.getByTestId('basic-quiz-result-pass')).toBeInTheDocument())
    expect(screen.getByText(/đã mở khóa.*thi đấu xếp hạng/i)).toBeInTheDocument()

    await user.click(screen.getByTestId('basic-quiz-pass-cta'))
    expect(mockNavigate).toHaveBeenCalledWith('/ranked')
  })

  it('renders fail screen with review entries + cooldown', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        passed: false,
        correctCount: 5,
        totalQuestions: 10,
        threshold: 8,
        attemptCount: 1,
        cooldownSeconds: 60,
        wrongAnswers: [
          {
            questionId: 'q-3',
            content: 'Câu hỏi số 4',
            options: ['A3', 'B3', 'C3', 'D3'],
            selectedOptions: [0],
            correctOptions: [2],
            explanation: 'Giải thích chi tiết câu 4',
          },
          {
            questionId: 'q-7',
            content: 'Câu hỏi số 8',
            options: ['A7', 'B7', 'C7', 'D7'],
            selectedOptions: [0],
            correctOptions: [1],
            explanation: 'Giải thích chi tiết câu 8',
          },
        ],
      },
    })

    const user = userEvent.setup()
    renderPage()
    await answerAllAndSubmit(user)

    await waitFor(() => expect(screen.getByTestId('basic-quiz-result-fail')).toBeInTheDocument())
    expect(screen.getByText(/5\s*\/\s*10/)).toBeInTheDocument()
    expect(screen.getByText(/giải thích chi tiết câu 4/i)).toBeInTheDocument()
    expect(screen.getByText(/giải thích chi tiết câu 8/i)).toBeInTheDocument()
    expect(screen.getByTestId('basic-quiz-fail-cooldown')).toHaveTextContent(/01:00/)
  })
})

describe('BasicQuiz page — error', () => {
  it('renders error UI with Retry when /questions fails', async () => {
    mockApiGet.mockRejectedValue(new Error('boom'))

    renderPage()

    await waitFor(() => expect(screen.getByTestId('basic-quiz-error')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument()
  })
})
