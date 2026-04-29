import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Tests for BasicQuizCard — 4 states (first time / retry / cooldown /
 * passed) + CTA navigation. Mocks /api/basic-quiz/status.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

import BasicQuizCard from '../BasicQuizCard'

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BasicQuizCard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const baseStatus = {
  passed: false,
  passedAt: null,
  attemptCount: 0,
  cooldownRemainingSeconds: 0,
  totalQuestions: 10,
  threshold: 8,
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BasicQuizCard — 4 states', () => {
  it('State 1 (first time): shows "Bắt đầu Bài Giáo Lý" CTA when attempts=0', async () => {
    mockApiGet.mockResolvedValue({ data: { ...baseStatus } })

    renderCard()

    const card = await screen.findByTestId('basic-quiz-card')
    expect(card).toHaveAttribute('data-state', 'first')
    expect(screen.getByTestId('basic-quiz-card-cta')).toHaveTextContent(/bắt đầu bài giáo lý/i)
    // Subtitle reflects server-provided constants.
    expect(screen.getByText(/10 câu hỏi/i)).toBeInTheDocument()
    expect(screen.getByText(/đúng tối thiểu 8/i)).toBeInTheDocument()
    // Attempt counter is hidden on first time.
    expect(screen.queryByTestId('basic-quiz-attempts')).not.toBeInTheDocument()
  })

  it('State 2 (retry): shows "Làm lại bài" CTA when attempts>0 and no cooldown', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...baseStatus, attemptCount: 2, cooldownRemainingSeconds: 0 },
    })

    renderCard()

    const card = await screen.findByTestId('basic-quiz-card')
    expect(card).toHaveAttribute('data-state', 'retry')
    expect(screen.getByTestId('basic-quiz-card-cta')).toHaveTextContent(/làm lại bài/i)
    expect(screen.getByTestId('basic-quiz-attempts')).toHaveTextContent(/2 lần/i)
  })

  it('State 3 (cooldown): disables CTA and renders countdown when cooldownRemainingSeconds>0', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...baseStatus, attemptCount: 1, cooldownRemainingSeconds: 42 },
    })

    renderCard()

    const card = await screen.findByTestId('basic-quiz-card')
    expect(card).toHaveAttribute('data-state', 'cooldown')
    const cta = screen.getByTestId('basic-quiz-card-cta') as HTMLButtonElement
    expect(cta).toBeDisabled()
    expect(cta).toHaveTextContent(/00:42/)
    expect(screen.getByTestId('basic-quiz-cooldown')).toHaveTextContent(/00:42/)
  })

  it('State 4 (passed): shows ranked CTA + passed badge', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        ...baseStatus,
        passed: true,
        passedAt: '2026-04-29T10:00:00',
        attemptCount: 1,
      },
    })

    renderCard()

    const card = await screen.findByTestId('basic-quiz-card')
    expect(card).toHaveAttribute('data-state', 'passed')
    expect(screen.getByText(/đã hoàn thành bài giáo lý/i)).toBeInTheDocument()
    expect(screen.getByTestId('basic-quiz-card-cta')).toHaveTextContent(/bắt đầu ranked/i)
  })

  it('CTA navigates to /basic-quiz when not passed', async () => {
    mockApiGet.mockResolvedValue({ data: { ...baseStatus } })

    renderCard()
    const cta = await screen.findByTestId('basic-quiz-card-cta')
    await userEvent.click(cta)

    expect(mockNavigate).toHaveBeenCalledWith('/basic-quiz')
  })

  it('CTA navigates to /ranked when passed', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...baseStatus, passed: true, passedAt: '2026-04-29T10:00:00' },
    })

    renderCard()
    const cta = await screen.findByTestId('basic-quiz-card-cta')
    await userEvent.click(cta)

    expect(mockNavigate).toHaveBeenCalledWith('/ranked')
  })

  it('cooldown decrements every second', async () => {
    vi.useFakeTimers()
    mockApiGet.mockResolvedValue({
      data: { ...baseStatus, attemptCount: 1, cooldownRemainingSeconds: 5 },
    })

    renderCard()

    // First wait — let the query resolve via real microtasks.
    await vi.waitFor(() => {
      expect(screen.getByTestId('basic-quiz-cooldown')).toBeInTheDocument()
    })
    expect(screen.getByTestId('basic-quiz-cooldown')).toHaveTextContent(/00:05/)

    // Advance fake clock by 2s — local ticker should drop the display to 00:03.
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(screen.getByTestId('basic-quiz-cooldown')).toHaveTextContent(/00:03/)
  })

  it('renders skeleton while initial /status request is pending', () => {
    // Promise that never resolves keeps useQuery in loading state.
    mockApiGet.mockReturnValue(new Promise(() => {}))

    renderCard()

    expect(screen.getByTestId('basic-quiz-card-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('basic-quiz-card')).not.toBeInTheDocument()
  })
})
