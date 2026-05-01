import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
  },
}))

import MysteryMode from '../MysteryMode'

function renderMystery() {
  return render(
    <MemoryRouter>
      <MysteryMode />
    </MemoryRouter>
  )
}

describe('MysteryMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiPost.mockResolvedValue({
      data: { questions: [{ id: 'q1', content: 'Test Q', options: ['A', 'B'], correctAnswer: [0] }] },
    })
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() => renderMystery()).not.toThrow()
    })

    it('renders page container with testid', () => {
      renderMystery()
      expect(screen.getByTestId('mystery-page')).toBeInTheDocument()
    })

    it('renders Mystery Mode title', () => {
      renderMystery()
      expect(screen.getByText('Mystery Mode')).toBeInTheDocument()
    })

    it('renders mystery description', () => {
      renderMystery()
      expect(screen.getByText(/không biết gì về quiz/)).toBeInTheDocument()
    })

    it('shows mystery placeholders (???)', () => {
      renderMystery()
      const questionMarks = screen.getAllByText('???')
      expect(questionMarks.length).toBe(3) // Book, Difficulty, Topic
    })

    it('does NOT show XP multiplier badge (Option A: variety modes have no XP)', () => {
      // Per Bui decision 2026-05-02 — variety modes are "for fun, no XP".
      // Advertising 1.5x XP would mislead users since no scoring path applies it.
      renderMystery()
      expect(screen.queryByTestId('mystery-multiplier-badge')).not.toBeInTheDocument()
      expect(screen.queryByText('1.5x XP')).not.toBeInTheDocument()
    })

    it('shows time limit', () => {
      renderMystery()
      expect(screen.getByText('25s')).toBeInTheDocument()
    })

    it('shows question count', () => {
      renderMystery()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('shows info labels (no Bonus label — XP badge removed)', () => {
      renderMystery()
      // Bonus label removed alongside the misleading 1.5x XP badge.
      expect(screen.queryByText('Bonus')).not.toBeInTheDocument()
      expect(screen.getByText(/Thời gian/)).toBeInTheDocument()
      expect(screen.getByText(/Câu hỏi/)).toBeInTheDocument()
    })
  })

  describe('Start quiz', () => {
    it('renders start button', () => {
      renderMystery()
      expect(screen.getByTestId('mystery-start-btn')).toBeInTheDocument()
    })

    it('clicking start calls API and navigates', async () => {
      renderMystery()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('mystery-start-btn'))
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/quiz/mystery')
        expect(mockNavigate).toHaveBeenCalledWith('/quiz', {
          state: expect.objectContaining({ mode: 'mystery_mode', showExplanation: true }),
        })
      })
    })

    it('disables button while starting', async () => {
      mockApiPost.mockImplementation(() => new Promise(() => {}))
      renderMystery()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('mystery-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('mystery-start-btn')).toBeDisabled()
        expect(screen.getByTestId('mystery-start-btn')).toHaveTextContent('...')
      })
    })

    it('re-enables button on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Server error'))
      renderMystery()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('mystery-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('mystery-start-btn')).not.toBeDisabled()
      })
    })

    it('does not navigate when API returns empty questions', async () => {
      mockApiPost.mockResolvedValue({ data: { questions: [] } })
      renderMystery()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('mystery-start-btn'))
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
