import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSetHasSeenOnboarding = vi.fn()
vi.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    setHasSeenOnboarding: mockSetHasSeenOnboarding,
  }),
}))

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}))

import OnboardingTryQuiz from '../OnboardingTryQuiz'

function renderTryQuiz() {
  return render(
    <MemoryRouter>
      <OnboardingTryQuiz />
    </MemoryRouter>
  )
}

describe('OnboardingTryQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: API fails, so fallback questions are used
    mockApiGet.mockRejectedValue(new Error('Not available'))
  })

  describe('Loading state', () => {
    it('shows loading indicator while fetching questions', () => {
      mockApiGet.mockImplementation(() => new Promise(() => {})) // never resolves
      renderTryQuiz()
      const loading = document.querySelector('.animate-pulse')
      expect(loading).toBeInTheDocument()
    })
  })

  describe('Quiz rendering', () => {
    it('renders question content after loading', async () => {
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText('Sách đầu tiên trong Kinh Thánh là gì?')).toBeInTheDocument()
      })
    })

    it('renders question 1 of 3 indicator', async () => {
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText(/Câu 1 \/ 3/)).toBeInTheDocument()
      })
    })

    it('renders 4 answer options', async () => {
      renderTryQuiz()
      await waitFor(() => {
        // Fallback VI question 1 options
        expect(screen.getByText('Sáng Thế Ký')).toBeInTheDocument()
        expect(screen.getByText('Xuất Ai Cập Ký')).toBeInTheDocument()
        expect(screen.getByText('Ma-thi-ơ')).toBeInTheDocument()
        expect(screen.getByText('Thi Thiên')).toBeInTheDocument()
      })
    })

    it('renders Skip button in nav', async () => {
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument()
      })
    })

    it('renders Login button in nav', async () => {
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument()
      })
    })

    it('renders progress bar', async () => {
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText(/Hoàn thành/)).toBeInTheDocument()
      })
    })
  })

  describe('Quiz interaction', () => {
    it('selecting correct answer highlights green', async () => {
      renderTryQuiz()
      const user = userEvent.setup()
      await waitFor(() => {
        expect(screen.getByText('Sáng Thế Ký')).toBeInTheDocument()
      })
      // Correct answer for Q1 is index 0 = "Sáng Thế Ký"
      await user.click(screen.getByText('Sáng Thế Ký').closest('button')!)
      // After selection, the correct answer should have emerald (success) styling
      const btn = screen.getByText('Sáng Thế Ký').closest('button')!
      expect(btn.className).toContain('emerald')
    })

    it('selecting wrong answer highlights red for selected and green for correct', async () => {
      renderTryQuiz()
      const user = userEvent.setup()
      await waitFor(() => {
        expect(screen.getByText('Xuất Ai Cập Ký')).toBeInTheDocument()
      })
      // Wrong answer for Q1 is index 1 = "Xuất Ai Cập Ký"
      await user.click(screen.getByText('Xuất Ai Cập Ký').closest('button')!)
      const wrongBtn = screen.getByText('Xuất Ai Cập Ký').closest('button')!
      expect(wrongBtn.className).toContain('ruby')
      // Correct answer should be emerald (success)
      const correctBtn = screen.getByText('Sáng Thế Ký').closest('button')!
      expect(correctBtn.className).toContain('emerald')
    })

    it('advances to next question after selecting answer', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderTryQuiz()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await waitFor(() => {
        expect(screen.getByText(/Câu 1 \/ 3/)).toBeInTheDocument()
      })
      await user.click(screen.getByText('Sáng Thế Ký').closest('button')!)

      // Advance timer for the 800ms setTimeout
      vi.advanceTimersByTime(900)

      await waitFor(() => {
        expect(screen.getByText(/Câu 2 \/ 3/)).toBeInTheDocument()
      })
      vi.useRealTimers()
    })

    it('shows result screen after answering all questions', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderTryQuiz()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await waitFor(() => {
        expect(screen.getByText(/Câu 1 \/ 3/)).toBeInTheDocument()
      })

      // Answer Q1
      await user.click(screen.getByText('Sáng Thế Ký').closest('button')!)
      vi.advanceTimersByTime(900)
      await waitFor(() => { expect(screen.getByText(/Câu 2 \/ 3/)).toBeInTheDocument() })

      // Answer Q2
      await user.click(screen.getByText('Môi-se').closest('button')!)
      vi.advanceTimersByTime(900)
      await waitFor(() => { expect(screen.getByText(/Câu 3 \/ 3/)).toBeInTheDocument() })

      // Answer Q3
      await user.click(screen.getByText('Bết-lê-hem').closest('button')!)
      vi.advanceTimersByTime(900)

      // Should show result screen
      await waitFor(() => {
        expect(screen.getByText(/3\/3/)).toBeInTheDocument()
      })
      vi.useRealTimers()
    })
  })

  describe('Result screen', () => {
    async function goToResult() {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderTryQuiz()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await waitFor(() => { expect(screen.getByText(/Câu 1 \/ 3/)).toBeInTheDocument() })

      await user.click(screen.getByText('Sáng Thế Ký').closest('button')!)
      vi.advanceTimersByTime(900)
      await waitFor(() => { expect(screen.getByText(/Câu 2 \/ 3/)).toBeInTheDocument() })

      await user.click(screen.getByText('Môi-se').closest('button')!)
      vi.advanceTimersByTime(900)
      await waitFor(() => { expect(screen.getByText(/Câu 3 \/ 3/)).toBeInTheDocument() })

      await user.click(screen.getByText('Bết-lê-hem').closest('button')!)
      vi.advanceTimersByTime(900)

      await waitFor(() => { expect(screen.getByText(/3\/3/)).toBeInTheDocument() })
      vi.useRealTimers()
      return user
    }

    it('shows score on result screen', async () => {
      await goToResult()
      expect(screen.getByText(/3\/3/)).toBeInTheDocument()
    })

    it('shows register CTA on result screen', async () => {
      await goToResult()
      expect(screen.getByText(/Lưu lại tiến trình/)).toBeInTheDocument()
    })

    it('Skip on result navigates to home', async () => {
      await goToResult()
      const user = userEvent.setup()
      await user.click(screen.getByText('Skip'))
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true)
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('API integration', () => {
    it('uses API questions when available', async () => {
      mockApiGet.mockResolvedValue({
        data: [
          { id: 'q1', content: 'API Question 1', options: ['A', 'B', 'C', 'D'], correctAnswer: [0], book: 'Genesis' },
          { id: 'q2', content: 'API Question 2', options: ['A', 'B', 'C', 'D'], correctAnswer: [1], book: 'Exodus' },
          { id: 'q3', content: 'API Question 3', options: ['A', 'B', 'C', 'D'], correctAnswer: [2], book: 'Matthew' },
        ],
      })
      renderTryQuiz()
      await waitFor(() => {
        expect(screen.getByText('API Question 1')).toBeInTheDocument()
      })
    })

    it('falls back to hardcoded questions on API failure', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'))
      renderTryQuiz()
      await waitFor(() => {
        // Fallback VI Q1
        expect(screen.getByText('Sách đầu tiên trong Kinh Thánh là gì?')).toBeInTheDocument()
      })
    })
  })
})
