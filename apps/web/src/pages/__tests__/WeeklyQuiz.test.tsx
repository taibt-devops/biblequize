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
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}))

import WeeklyQuiz from '../WeeklyQuiz'

const mockTheme = {
  themeName: 'Giao ước Cũ',
  themeNameEn: 'Old Covenant',
  books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua'],
  daysLeft: 3,
}

function renderWeekly() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WeeklyQuiz />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WeeklyQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/quiz/weekly/theme')) {
        return Promise.resolve({ data: mockTheme })
      }
      if (url.includes('/api/quiz/weekly')) {
        return Promise.resolve({
          data: { questions: [{ id: 'q1', content: 'Test Q', options: ['A', 'B'], correctAnswer: [0] }] },
        })
      }
      return Promise.reject(new Error('Unknown'))
    })
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() => renderWeekly()).not.toThrow()
    })

    it('renders page header with icon', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-page')).toBeInTheDocument()
      })
    })

    it('shows weekly quiz title', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      })
    })

    it('shows theme name after loading', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-theme-title')).toHaveTextContent('Giao ước Cũ')
      })
    })

    it('shows English theme name', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByText('Old Covenant')).toBeInTheDocument()
      })
    })

    it('shows book tags (max 5 + overflow)', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
        expect(screen.getByText('Exodus')).toBeInTheDocument()
        expect(screen.getByText('+1')).toBeInTheDocument()
      })
    })

    it('shows days remaining', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByText(/Còn 3 ngày/)).toBeInTheDocument()
      })
    })

    it('shows question count', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByText('10 câu hỏi')).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('shows loading spinner while fetching theme', () => {
      mockApiGet.mockImplementation(() => new Promise(() => {}))
      renderWeekly()
      const spinner = screen.getByTestId('weekly-loading')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Start quiz', () => {
    it('renders start button', async () => {
      renderWeekly()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).toBeInTheDocument()
      })
    })

    it('clicking start calls API and navigates to quiz', async () => {
      renderWeekly()
      const user = userEvent.setup()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('weekly-start-btn'))
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/quiz/weekly')
        expect(mockNavigate).toHaveBeenCalledWith('/quiz', {
          state: expect.objectContaining({ mode: 'weekly_quiz' }),
        })
      })
    })

    it('disables button while starting', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/quiz/weekly/theme')) return Promise.resolve({ data: mockTheme })
        // Never resolve quiz endpoint
        return new Promise(() => {})
      })
      renderWeekly()
      const user = userEvent.setup()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('weekly-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).toBeDisabled()
        expect(screen.getByTestId('weekly-start-btn')).toHaveTextContent('...')
      })
    })

    it('re-enables button on API error', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/quiz/weekly/theme')) return Promise.resolve({ data: mockTheme })
        return Promise.reject(new Error('Server error'))
      })
      renderWeekly()
      const user = userEvent.setup()
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('weekly-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('weekly-start-btn')).not.toBeDisabled()
      })
    })
  })
})
