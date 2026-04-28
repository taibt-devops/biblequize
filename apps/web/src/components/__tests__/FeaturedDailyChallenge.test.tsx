import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

vi.mock('../../hooks/useBookName', () => ({
  useBookName: () => (key: string, lang: 'vi' | 'en' = 'vi') => {
    if (lang === 'en') return key
    const map: Record<string, string> = {
      Genesis: 'Sáng Thế Ký',
      Exodus: 'Xuất Ê-díp-tô Ký',
      Psalms: 'Thi Thiên',
      John: 'Giăng',
      Revelation: 'Khải Huyền',
    }
    return map[key] ?? key
  },
}))

import FeaturedDailyChallenge from '../FeaturedDailyChallenge'

function renderComponent() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FeaturedDailyChallenge />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sampleResponse = (overrides: Partial<{ alreadyCompleted: boolean; books: string[] }> = {}) => ({
  date: '2026-04-29',
  alreadyCompleted: overrides.alreadyCompleted ?? false,
  totalQuestions: 5,
  questions: (overrides.books ?? ['Genesis', 'Exodus', 'Psalms', 'John', 'Revelation']).map(
    (book, i) => ({ id: `q${i}`, book, chapter: 1 }),
  ),
})

describe('FeaturedDailyChallenge', () => {
  beforeEach(() => {
    // Pin Date for deterministic countdown — but keep real setInterval/setTimeout
    // so TanStack Query and waitFor() resolve normally. The "ticks every second"
    // test below opts into full fake timers locally.
    vi.setSystemTime(new Date('2026-04-29T10:00:00Z'))
    vi.clearAllMocks()
    i18n.changeLanguage('vi')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders skeleton while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderComponent()
    expect(screen.getByTestId('featured-daily-loading')).toBeInTheDocument()
  })

  it('renders error fallback + retry button when fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Thử Thách Hôm Nay — 5 câu mỗi ngày')).toBeInTheDocument()
    expect(screen.getByTestId('featured-daily-retry')).toBeInTheDocument()
  })

  it('renders single-book tagline when all 5 questions share one book', async () => {
    mockApiGet.mockResolvedValue({ data: sampleResponse({ books: ['Genesis', 'Genesis', 'Genesis', 'Genesis', 'Genesis'] }) })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-tagline')).toBeInTheDocument()
    })
    expect(screen.getByTestId('featured-daily-tagline').textContent).toBe('Khám phá Sáng Thế Ký hôm nay')
    // Single-book tagline: book list NOT rendered (it would just duplicate)
    expect(screen.queryByTestId('featured-daily-booklist')).not.toBeInTheDocument()
  })

  it('renders many-books tagline + book list for 5 unique books', async () => {
    mockApiGet.mockResolvedValue({ data: sampleResponse() })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-tagline')).toBeInTheDocument()
    })
    expect(screen.getByTestId('featured-daily-tagline').textContent).toContain('Hành trình qua 5 sách')
    expect(screen.getByTestId('featured-daily-booklist').textContent).toBe(
      'Sáng Thế Ký • Xuất Ê-díp-tô Ký • Thi Thiên • Giăng • Khải Huyền',
    )
  })

  it('renders completed state when user already finished today', async () => {
    mockApiGet.mockResolvedValue({ data: sampleResponse({ alreadyCompleted: true }) })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-completed')).toBeInTheDocument()
    })
    // CTA + countdown should NOT render in completed state
    expect(screen.queryByTestId('featured-daily-cta')).not.toBeInTheDocument()
    expect(screen.queryByTestId('featured-daily-countdown')).not.toBeInTheDocument()
  })

  it('formats countdown HH:MM:SS to next UTC midnight', async () => {
    // Time fixed at 10:00:00 UTC → next midnight = 14h00m00s away
    mockApiGet.mockResolvedValue({ data: sampleResponse() })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-countdown')).toBeInTheDocument()
    })
    expect(screen.getByTestId('featured-daily-countdown').textContent).toContain('14:00:00')
  })

  it('countdown ticks every second', async () => {
    // Fake timers from the start with shouldAdvanceTime so the TanStack
    // Query resolution still flushes. Once the countdown is on screen we
    // hand-advance Date + setInterval together to verify the tick.
    vi.useFakeTimers({ now: new Date('2026-04-29T10:00:00Z'), shouldAdvanceTime: true })
    mockApiGet.mockResolvedValue({ data: sampleResponse() })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-countdown')).toBeInTheDocument()
    })
    const initial = screen.getByTestId('featured-daily-countdown').textContent

    vi.setSystemTime(new Date('2026-04-29T10:00:01Z'))
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    const after = screen.getByTestId('featured-daily-countdown').textContent
    expect(after).not.toBe(initial)
    // shouldAdvanceTime in waitFor adds ~1s of jitter — assert the format is
    // valid HH:MM:SS and the value strictly decreased (countdown direction).
    expect(after).toMatch(/13:59:5\d/)
  })

  it('CTA links to /daily route', async () => {
    mockApiGet.mockResolvedValue({ data: sampleResponse() })
    renderComponent()
    await waitFor(() => {
      expect(screen.getByTestId('featured-daily-cta')).toBeInTheDocument()
    })
    const cta = screen.getByTestId('featured-daily-cta')
    expect(cta.getAttribute('href')).toBe('/daily')
  })
})
