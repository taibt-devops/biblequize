import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => mockUseQuery(opts),
}))

vi.mock('../../api/client', () => ({
  api: { get: vi.fn() },
}))

import DailyMissionWidget from '../DailyMissionWidget'

function renderWidget() {
  return render(
    <MemoryRouter>
      <DailyMissionWidget />
    </MemoryRouter>,
  )
}

function makeMissions(completedCount: number, total: number) {
  return Array.from({ length: total }, (_, i) => ({
    slot: i + 1,
    type: 'answer_correct',
    description: `Mission ${i + 1}`,
    progress: i < completedCount ? 5 : 0,
    target: 5,
    completed: i < completedCount,
  }))
}

describe('DailyMissionWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loading state → renders skeleton (no crash)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderWidget()
    expect(screen.getByTestId('daily-mission-widget-skeleton')).toBeInTheDocument()
    // The real widget testid is NOT rendered while loading
    expect(screen.queryByTestId('daily-mission-widget')).toBeNull()
  })

  it('error state → returns null (component does not render)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    const { container } = renderWidget()
    expect(container.firstChild).toBeNull()
  })

  it('empty missions array → returns null', () => {
    mockUseQuery.mockReturnValue({
      data: { date: '2026-04-30', missions: [], allCompleted: false, bonusClaimed: false, bonusXp: 0 },
      isLoading: false,
      isError: false,
    })
    const { container } = renderWidget()
    expect(container.firstChild).toBeNull()
  })

  it('0/3 missions → "0/3" + bar 0% + caption "Bắt đầu..."', () => {
    mockUseQuery.mockReturnValue({
      data: { date: '2026-04-30', missions: makeMissions(0, 3), allCompleted: false, bonusClaimed: false, bonusXp: 100 },
      isLoading: false,
      isError: false,
    })
    renderWidget()
    expect(screen.getByTestId('daily-mission-widget-progress')).toHaveTextContent('0/3')
    const bar = screen.getByTestId('daily-mission-widget-bar') as HTMLElement
    expect(bar.style.width).toBe('0%')
    expect(screen.getByTestId('daily-mission-widget-caption')).toHaveTextContent('Bắt đầu nhiệm vụ ngày')
  })

  it('2/3 missions → "2/3" + bar 67% + caption "Tiếp tục — còn 1 nhiệm vụ"', () => {
    mockUseQuery.mockReturnValue({
      data: { date: '2026-04-30', missions: makeMissions(2, 3), allCompleted: false, bonusClaimed: false, bonusXp: 100 },
      isLoading: false,
      isError: false,
    })
    renderWidget()
    expect(screen.getByTestId('daily-mission-widget-progress')).toHaveTextContent('2/3')
    const bar = screen.getByTestId('daily-mission-widget-bar') as HTMLElement
    // round(2/3 * 100) = 67
    expect(bar.style.width).toBe('67%')
    expect(screen.getByTestId('daily-mission-widget-caption')).toHaveTextContent('Tiếp tục — còn 1 nhiệm vụ')
  })

  it('3/3 missions → bar 100% + gold caption "Tất cả nhiệm vụ hoàn thành! 🎉"', () => {
    mockUseQuery.mockReturnValue({
      data: { date: '2026-04-30', missions: makeMissions(3, 3), allCompleted: true, bonusClaimed: false, bonusXp: 100 },
      isLoading: false,
      isError: false,
    })
    renderWidget()
    expect(screen.getByTestId('daily-mission-widget-progress')).toHaveTextContent('3/3')
    const bar = screen.getByTestId('daily-mission-widget-bar') as HTMLElement
    expect(bar.style.width).toBe('100%')
    const caption = screen.getByTestId('daily-mission-widget-caption')
    expect(caption).toHaveTextContent('Tất cả nhiệm vụ hoàn thành! 🎉')
    // happy-dom preserves the literal hex color
    expect(caption.style.color.toLowerCase()).toBe('#e8a832')
  })

  it('clicking widget navigates to / (Home, where full DailyMissionsCard lives)', async () => {
    mockUseQuery.mockReturnValue({
      data: { date: '2026-04-30', missions: makeMissions(1, 3), allCompleted: false, bonusClaimed: false, bonusXp: 100 },
      isLoading: false,
      isError: false,
    })
    renderWidget()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('daily-mission-widget'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
