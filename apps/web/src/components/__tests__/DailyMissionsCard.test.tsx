import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
}))

import DailyMissionsCard from '../DailyMissionsCard'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const mockMissions = {
  date: '2026-04-07',
  missions: [
    { slot: 1, type: 'answer_correct', description: 'Trả lời đúng 3 câu', progress: 2, target: 3, completed: false },
    { slot: 2, type: 'complete_daily_challenge', description: 'Hoàn thành thử thách hàng ngày', progress: 1, target: 1, completed: true },
    { slot: 3, type: 'answer_combo', description: 'Trả lời 3 câu liên tiếp đúng', progress: 0, target: 3, completed: false },
  ],
  allCompleted: false,
  bonusClaimed: false,
  bonusXp: 50,
}

describe('DailyMissionsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders mission descriptions', async () => {
    mockApiGet.mockResolvedValue({ data: mockMissions })
    render(<DailyMissionsCard />, { wrapper })
    await vi.waitFor(() => {
      expect(screen.getByText('Trả lời đúng 3 câu')).toBeInTheDocument()
      expect(screen.getByText('Hoàn thành thử thách hàng ngày')).toBeInTheDocument()
    })
  })

  it('shows progress count', async () => {
    mockApiGet.mockResolvedValue({ data: mockMissions })
    render(<DailyMissionsCard />, { wrapper })
    await vi.waitFor(() => {
      expect(screen.getByText('1/3')).toBeInTheDocument() // completed count
      expect(screen.getByText('2/3')).toBeInTheDocument() // mission 1 progress
    })
  })

  it('shows bonus when all completed', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        ...mockMissions,
        allCompleted: true,
        bonusClaimed: true,
        missions: mockMissions.missions.map(m => ({ ...m, completed: true })),
      },
    })
    render(<DailyMissionsCard />, { wrapper })
    await vi.waitFor(() => {
      expect(screen.getByText(/\+50 XP/)).toBeInTheDocument()
    })
  })

  it('renders nothing when loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DailyMissionsCard />, { wrapper })
    expect(container.innerHTML).toBe('')
  })

  it('does not crash on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Network'))
    const { container } = render(<DailyMissionsCard />, { wrapper })
    await new Promise(r => setTimeout(r, 100))
    expect(container.innerHTML).toBe('')
  })
})
