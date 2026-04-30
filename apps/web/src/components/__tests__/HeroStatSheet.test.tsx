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

interface ApiMockOpts {
  totalPoints?: number
  currentStreak?: number
  tierLevel?: number
  starIndex?: number
  starProgressPercent?: number
  starXp?: number
  nextStarXp?: number
  currentBook?: string | null
  questionsCounted?: number
}

function setupApiMock(opts: ApiMockOpts = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/api/me/tier-progress')) {
      return Promise.resolve({
        data: {
          tierLevel: opts.tierLevel ?? 1,
          starIndex: opts.starIndex ?? 0,
          starProgressPercent: opts.starProgressPercent ?? 0,
          starXp: opts.starXp ?? 0,
          nextStarXp: opts.nextStarXp ?? 200,
        },
      })
    }
    if (url.includes('/api/me/ranked-status')) {
      return Promise.resolve({
        data: {
          currentBook: opts.currentBook === undefined ? 'Genesis' : opts.currentBook,
          questionsCounted: opts.questionsCounted ?? 0,
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

function renderHero() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <HeroStatSheet />
    </QueryClientProvider>
  )
}

describe('HeroStatSheet (V4 Sacred Modernist v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Greeting + name + tier pill ───────────────────────────────────

  it('renders user name + tier pill with tier name and inline color', async () => {
    setupApiMock({ tierLevel: 1, totalPoints: 81 })
    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-user-name').textContent).toBe('Tai')
    })
    const pill = screen.getByTestId('home-tier-pill')
    expect(pill.textContent).toBe('Tân Tín Hữu')
    // Tier 1 colorHex from data/tiers.ts is #919098 — assert inline style applied.
    expect(pill.getAttribute('style')).toMatch(/background:\s*(rgb\(145,\s*144,\s*152\)|#919098)/i)
  })

  it('greeting line is rendered (uppercase via Tailwind)', async () => {
    setupApiMock()
    renderHero()
    await waitFor(() => {
      const greeting = screen.getByTestId('home-greeting')
      expect(greeting.textContent).toMatch(/Chào buổi/i)
      expect(greeting.className).toContain('uppercase')
    })
  })

  // ── 5-star sub-tier row + caption ─────────────────────────────────

  it('renders 5-star sub-tier row from /tier-progress.starIndex', async () => {
    setupApiMock({ tierLevel: 2, starIndex: 2, totalPoints: 1500 })
    renderHero()

    await waitFor(() => {
      const stars = screen.getByTestId('home-hero-stars').textContent || ''
      expect(stars.split('★').length - 1).toBe(2)
      expect(stars.split('☆').length - 1).toBe(3)
    })
  })

  it('caption shows "{points} / {window} XP đến sao kế" using actual star window', async () => {
    // Tier 2 user: starXp window = nextStarXp - starXp. Mock 800 wide window
    // (matches backend STAR_XP[2] = 800), user is 320 XP into the star.
    setupApiMock({
      tierLevel: 2,
      totalPoints: 1320,
      starIndex: 0,
      starXp: 1000,
      nextStarXp: 1800,
    })
    renderHero()

    await waitFor(() => {
      const caption = screen.getByTestId('home-hero-stars-caption')
      expect(caption.textContent).toContain('320')
      expect(caption.textContent).toContain('800')
    })
  })

  // ── Tier 6 max-tier branch ─────────────────────────────────────────

  it('Tier 6 hides progress + stars and shows max-tier line', async () => {
    setupApiMock({
      tierLevel: 6,
      starIndex: 5,
      starProgressPercent: 100,
      totalPoints: 150_000,
      currentStreak: 30,
    })
    renderHero()

    await waitFor(() => {
      const msg = screen.getByTestId('home-max-tier-msg')
      expect(msg).toBeInTheDocument()
      expect(msg.textContent).toContain('👑')
    })
    expect(screen.queryByTestId('home-hero-stars')).not.toBeInTheDocument()
    expect(screen.queryByTestId('home-hero-progress-fill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('home-hero-footer')).not.toBeInTheDocument()
  })

  // ── Desktop footer ────────────────────────────────────────────────

  it('desktop footer shows currentBook from /ranked-status', async () => {
    setupApiMock({ currentBook: 'Matthew', questionsCounted: 7 })
    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-hero-current-book').textContent).toContain('Matthew')
    })
    expect(screen.getByTestId('home-hero-questions-today').textContent).toContain('7')
  })

  it('desktop footer hides currentBook span when currentBook is null', async () => {
    setupApiMock({ currentBook: null, questionsCounted: 0 })
    renderHero()

    // Wait for ranked-status to settle (questions-today proves the query resolved).
    await waitFor(() => {
      expect(screen.getByTestId('home-hero-questions-today')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('home-hero-current-book')).not.toBeInTheDocument()
  })

  // ── Mobile stat boxes ─────────────────────────────────────────────

  it('renders mobile streak + today stat boxes (sidebar hidden on mobile)', async () => {
    setupApiMock({ currentStreak: 5, questionsCounted: 12 })
    renderHero()

    await waitFor(() => {
      expect(screen.getByTestId('home-mobile-streak').textContent).toContain('5')
    })
    expect(screen.getByTestId('home-mobile-today').textContent).toContain('12')
  })
})
