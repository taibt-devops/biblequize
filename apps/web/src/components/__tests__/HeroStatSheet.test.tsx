import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Tai', email: 'tai@test.com' } }),
}))

import HeroStatSheet from '../HeroStatSheet'

function renderHero() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <HeroStatSheet />
    </QueryClientProvider>
  )
}

describe('HeroStatSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders avatar emoji per tier (tier 1 → 🌱)', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 1, starIndex: 0, starProgressPercent: 0 } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 0, currentStreak: 0 } })
      return Promise.reject(new Error('Not mocked'))
    })

    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-hero-avatar').textContent).toBe('🌱')
    })
    expect(screen.getByTestId('home-tier-name').textContent).toBe('Tân Tín Hữu')
  })

  it('renders 3 stat cells (Streak / Điểm / Tier) with values', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 3, starIndex: 1, starProgressPercent: 0 } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 8200, currentStreak: 5 } })
      return Promise.reject(new Error('Not mocked'))
    })

    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-stat-streak').textContent).toContain('5')
      expect(screen.getByTestId('home-total-points').textContent).toContain('8.200')
      expect(screen.getByTestId('home-stat-tier').textContent).toBe('3')
    })
  })

  it('streak cell carries the .fire color modifier when streak > 0', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 1, starIndex: 0, starProgressPercent: 0 } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 100, currentStreak: 3 } })
      return Promise.reject(new Error('Not mocked'))
    })

    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-stat-streak').className).toContain('fire')
    })
  })

  it('renders 5-star sub-tier row from /tier-progress.starIndex', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 2, starIndex: 2, starProgressPercent: 0 } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 1500, currentStreak: 0 } })
      return Promise.reject(new Error('Not mocked'))
    })

    renderHero()

    await waitFor(() => {
      const stars = screen.getByTestId('home-hero-stars').textContent || ''
      expect(stars.split('★').length - 1).toBe(2)
      expect(stars.split('☆').length - 1).toBe(3)
    })
  })

  it('Tier 6 collapses progress section to a "max tier" line', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/me/tier-progress'))
        return Promise.resolve({ data: { tierLevel: 6, starIndex: 5, starProgressPercent: 100 } })
      if (url.includes('/api/me'))
        return Promise.resolve({ data: { totalPoints: 150000, currentStreak: 30 } })
      return Promise.reject(new Error('Not mocked'))
    })

    renderHero()

    await waitFor(() => {
      const msg = screen.getByTestId('home-max-tier-msg')
      expect(msg).toBeInTheDocument()
      expect(msg.textContent).toContain('👑')
    })
    // Progress bar / star row must NOT render at max tier.
    expect(document.querySelector('.hero-v3-progress-fill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('home-hero-stars')).not.toBeInTheDocument()
  })
})
