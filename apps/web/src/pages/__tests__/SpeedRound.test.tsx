import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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

import SpeedRound from '../SpeedRound'

function renderSpeed() {
  return render(
    <MemoryRouter>
      <SpeedRound />
    </MemoryRouter>
  )
}

describe('SpeedRound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({
      data: { questions: [{ id: 'q1', content: 'Test Q', options: ['A', 'B'], correctAnswer: [0] }] },
    })
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() => renderSpeed()).not.toThrow()
    })

    it('renders page container with testid', () => {
      renderSpeed()
      expect(screen.getByTestId('speed-round-page')).toBeInTheDocument()
    })

    it('renders Speed Round title', () => {
      renderSpeed()
      expect(screen.getByText('Speed Round')).toBeInTheDocument()
    })

    it('renders speed description', () => {
      renderSpeed()
      expect(screen.getByText(/Nhanh như chớp/)).toBeInTheDocument()
    })

    it('shows question count stat', () => {
      renderSpeed()
      // "10" for question count and "câu hỏi" label
      expect(screen.getByText('câu hỏi')).toBeInTheDocument()
    })

    it('shows time per question stat', () => {
      renderSpeed()
      expect(screen.getByText('10s')).toBeInTheDocument()
      expect(screen.getByText('mỗi câu')).toBeInTheDocument()
    })

    it('does NOT show XP bonus stat (Option A: variety modes have no XP)', () => {
      // Per Bui decision 2026-05-02 — variety modes are "for fun, no XP".
      // Advertising 2x XP would mislead users since no scoring path applies it.
      renderSpeed()
      expect(screen.queryByTestId('speed-round-bonus-stat')).not.toBeInTheDocument()
      expect(screen.queryByText('XP bonus')).not.toBeInTheDocument()
    })

    it('shows difficulty info', () => {
      renderSpeed()
      expect(screen.getByText(/DỄ/)).toBeInTheDocument()
    })

    it('shows auto-advance rule', () => {
      renderSpeed()
      expect(screen.getByText(/Sai hoặc hết giờ/)).toBeInTheDocument()
    })
  })

  describe('Start quiz', () => {
    it('renders start button', () => {
      renderSpeed()
      expect(screen.getByTestId('speed-round-start-btn')).toBeInTheDocument()
    })

    it('clicking start calls API and navigates', async () => {
      renderSpeed()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('speed-round-start-btn'))
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/quiz/speed-round')
        expect(mockNavigate).toHaveBeenCalledWith('/quiz', {
          state: expect.objectContaining({
            mode: 'speed_round',
            showExplanation: false,
            timePerQuestion: 10,
          }),
        })
      })
    })

    it('disables button while starting', async () => {
      mockApiGet.mockImplementation(() => new Promise(() => {}))
      renderSpeed()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('speed-round-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('speed-round-start-btn')).toBeDisabled()
        expect(screen.getByTestId('speed-round-start-btn')).toHaveTextContent('...')
      })
    })

    it('re-enables button on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'))
      renderSpeed()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('speed-round-start-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('speed-round-start-btn')).not.toBeDisabled()
      })
    })

    it('does not navigate when API returns empty questions', async () => {
      mockApiGet.mockResolvedValue({ data: { questions: [] } })
      renderSpeed()
      const user = userEvent.setup()
      await user.click(screen.getByTestId('speed-round-start-btn'))
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
