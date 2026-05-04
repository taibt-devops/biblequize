import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Tai Thanh', email: 'tai@test.com' } }),
}))

import GreetingCard from '../GreetingCard'

interface MockOpts {
  totalPoints?: number
  currentStreak?: number
  starIndex?: number
  energy?: number
  seasonPoints?: number
  userName?: string | null
}

function setupApi(opts: MockOpts = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/api/me/tier-progress')) {
      return Promise.resolve({
        data: {
          tierLevel: 1,
          starIndex: opts.starIndex ?? 0,
          starProgressPercent: 0,
          starXp: 0,
          nextStarXp: 200,
        },
      })
    }
    if (url.includes('/api/me/ranked-status')) {
      return Promise.resolve({
        data: {
          energy: opts.energy ?? 100,
          seasonPoints: opts.seasonPoints ?? 0,
        },
      })
    }
    if (url.includes('/api/me')) {
      return Promise.resolve({
        data: {
          totalPoints: opts.totalPoints ?? 0,
          currentStreak: opts.currentStreak ?? 0,
        },
      })
    }
    return Promise.reject(new Error('Not mocked: ' + url))
  })
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <GreetingCard />
    </QueryClientProvider>
  )
}

describe('GreetingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Anchor "now" at 2026-05-05 14:00 (afternoon) so greeting is deterministic
    vi.setSystemTime(new Date('2026-05-05T14:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders avatar with first letter of user name', async () => {
    setupApi()
    renderCard()
    expect(await screen.findByTestId('home-greeting-avatar')).toHaveTextContent('T')
  })

  it('renders user name', async () => {
    setupApi()
    renderCard()
    expect(await screen.findByTestId('home-greeting-name')).toHaveTextContent('Tai Thanh')
  })

  it('renders afternoon greeting at 14:00', async () => {
    setupApi()
    renderCard()
    expect(await screen.findByTestId('home-greeting-meta')).toHaveTextContent(/chiều|afternoon/i)
  })

  it('renders morning greeting before noon', async () => {
    vi.setSystemTime(new Date('2026-05-05T08:00:00'))
    setupApi()
    renderCard()
    expect(await screen.findByTestId('home-greeting-meta')).toHaveTextContent(/sáng|morning/i)
  })

  it('renders evening greeting after 18:00', async () => {
    vi.setSystemTime(new Date('2026-05-05T20:00:00'))
    setupApi()
    renderCard()
    expect(await screen.findByTestId('home-greeting-meta')).toHaveTextContent(/tối|evening/i)
  })

  it('shows tier badge emoji for current tier (Tier 1 = 🌱)', async () => {
    setupApi({ totalPoints: 0 })
    renderCard()
    expect(await screen.findByTestId('home-greeting-tier-badge')).toHaveTextContent('🌱')
  })

  it('shows tier progress label "current → next"', async () => {
    setupApi({ totalPoints: 500 })
    renderCard()
    const label = await screen.findByTestId('home-greeting-tier-label')
    expect(label).toHaveTextContent(/Tân Tín Hữu|New Believer/i)
    expect(label).toHaveTextContent(/Người Tìm Kiếm|Seeker/i)
  })

  it('renders progress bar fill width matching tier progress (50% at 500 pts in tier 1)', async () => {
    setupApi({ totalPoints: 500 })
    renderCard()
    const fill = await screen.findByTestId('home-greeting-progress-fill')
    expect(fill.style.width).toBe('50%')
  })

  it('shows XP / next-tier-min in progress label', async () => {
    setupApi({ totalPoints: 500 })
    renderCard()
    expect(await screen.findByTestId('home-greeting-progress-pct')).toHaveTextContent(/500.*1,000/)
  })

  it('reaches all 5 milestones when starIndex = 5', async () => {
    setupApi({ starIndex: 5 })
    renderCard()
    await waitFor(() => screen.getByTestId('home-greeting-milestone-0'))
    for (let i = 0; i < 5; i++) {
      const dot = screen.getByTestId(`home-greeting-milestone-${i}`)
      expect(dot.className).toContain('bg-white')
    }
  })

  it('clamps milestones to 5 even if BE returns 99', async () => {
    setupApi({ starIndex: 99 })
    renderCard()
    await waitFor(() => screen.getByTestId('home-greeting-milestone-4'))
    // No crash, all 5 dots reached
    expect(screen.getByTestId('home-greeting-milestone-4').className).toContain('bg-white')
  })

  it('shows max-tier message when totalPoints ≥ 100,000', async () => {
    setupApi({ totalPoints: 100_000 })
    renderCard()
    expect(await screen.findByTestId('home-greeting-max-tier')).toBeInTheDocument()
    // Progress bar should NOT be rendered at max tier
    expect(screen.queryByTestId('home-greeting-progress-bar')).not.toBeInTheDocument()
  })

  it('renders 3 inline stats: streak / energy / season points', async () => {
    setupApi({ currentStreak: 12, energy: 85, seasonPoints: 847 })
    renderCard()
    expect(await screen.findByTestId('home-greeting-stat-streak')).toHaveTextContent('12')
    expect(screen.getByTestId('home-greeting-stat-energy')).toHaveTextContent('85')
    expect(screen.getByTestId('home-greeting-stat-season')).toHaveTextContent('847')
  })

  it('falls back to 0 for stats when API returns undefined', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/ranked-status')) return Promise.resolve({ data: {} })
      if (url.includes('/api/me/tier-progress')) return Promise.resolve({ data: {} })
      if (url.includes('/api/me')) return Promise.resolve({ data: {} })
      return Promise.reject(new Error('not mocked'))
    })
    renderCard()
    expect(await screen.findByTestId('home-greeting-stat-streak')).toHaveTextContent('0')
    // energy falls back to 100 (full energy default), season to 0
    expect(screen.getByTestId('home-greeting-stat-season')).toHaveTextContent('0')
  })

  it('formats large numbers with thousands separator', async () => {
    setupApi({ seasonPoints: 12345 })
    renderCard()
    expect(await screen.findByTestId('home-greeting-stat-season')).toHaveTextContent('12,345')
  })
})
