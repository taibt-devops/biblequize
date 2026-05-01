import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Substitute simple {{var}} placeholders so the rendered subtitle
    // matches what users see in production.
    t: (key: string, opts?: Record<string, any>) => {
      const dict: Record<string, string> = {
        'home.journey.title': '🗺 Hành trình 66 sách',
        'home.journey.subtitleStart': 'Bắt đầu hành trình từ Genesis',
        'home.journey.subtitleOT':
          'Đang ở {{book}} · Ma-thi-ơ và Khải Huyền đang đợi bạn',
        'home.journey.subtitleNT': 'Đang ở {{book}} · Còn {{count}} sách Tân Ước',
        'home.journey.subtitleDone': 'Bạn đã chinh phục toàn bộ Kinh Thánh! 👑',
        'home.journey.otLabel': 'Cựu Ước (39)',
        'home.journey.ntLabel': 'Tân Ước (27)',
      }
      let template = dict[key] ?? key
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          template = template.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v))
        }
      }
      return template
    },
    i18n: { language: 'vi' },
  }),
}))

import BibleJourneyCard from '../BibleJourneyCard'

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BibleJourneyCard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const summary = (overrides: Partial<{
  completedBooks: number
  oldTestamentCompleted: number
  newTestamentCompleted: number
  currentBook: string | null
}> = {}) => ({
  data: {
    summary: {
      totalBooks: 66,
      completedBooks: overrides.completedBooks ?? 0,
      inProgressBooks: 1,
      lockedBooks: 65,
      overallMasteryPercent: 0,
      oldTestamentCompleted: overrides.oldTestamentCompleted ?? 0,
      newTestamentCompleted: overrides.newTestamentCompleted ?? 0,
      currentBook: overrides.currentBook ?? null,
    },
    books: [],
  },
})

describe('BibleJourneyCard (H6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    const { container } = renderCard()
    expect(container.innerHTML).toBe('')
  })

  it('renders "Bắt đầu hành trình từ Genesis" when not started', async () => {
    mockApiGet.mockResolvedValue(summary({ currentBook: null, completedBooks: 0 }))
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-subtitle').textContent).toBe(
        'Bắt đầu hành trình từ Genesis',
      )
    })
    expect(screen.getByTestId('bible-journey-count').textContent).toContain('0')
  })

  it('renders OT-phase subtitle when current book is in Old Testament', async () => {
    // Backend returns books array with testament info — H6 picks the
    // current book's entry to decide OT vs NT phase.
    mockApiGet.mockResolvedValue({
      data: {
        summary: {
          totalBooks: 66,
          completedBooks: 5,
          oldTestamentCompleted: 5,
          newTestamentCompleted: 0,
          currentBook: 'Genesis',
        },
        books: [{ book: 'Genesis', testament: 'OLD' }],
      },
    })
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-subtitle').textContent).toContain('Genesis')
    })
    expect(screen.getByTestId('bible-journey-subtitle').textContent).toContain(
      'Ma-thi-ơ',
    )
  })

  it('renders NT-phase subtitle with remaining count', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        summary: {
          totalBooks: 66,
          completedBooks: 45,
          oldTestamentCompleted: 39,
          newTestamentCompleted: 6,
          currentBook: 'Matthew',
        },
        books: [{ book: 'Matthew', testament: 'NEW' }],
      },
    })
    renderCard()
    await waitFor(() => {
      const sub = screen.getByTestId('bible-journey-subtitle').textContent ?? ''
      expect(sub).toContain('Matthew')
      // 27 NT total − 6 done = 21 remaining.
      expect(sub).toContain('21')
    })
  })

  it('renders all-done celebration when 66/66 complete', async () => {
    mockApiGet.mockResolvedValue(
      summary({
        completedBooks: 66,
        oldTestamentCompleted: 39,
        newTestamentCompleted: 27,
        currentBook: null,
      }),
    )
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-subtitle').textContent).toContain('👑')
    })
  })

  it('split bar fills are sized by OT/NT percentages', async () => {
    mockApiGet.mockResolvedValue(
      summary({
        completedBooks: 10,
        oldTestamentCompleted: 13, // 33% of 39
        newTestamentCompleted: 0,
      }),
    )
    renderCard()
    await waitFor(() => {
      const ot = screen.getByTestId('bible-journey-ot-fill') as HTMLElement
      // 13 / 39 = 33.33% — assert the rounded prefix.
      expect(ot.style.width).toMatch(/^33\./)
    })
    const nt = screen.getByTestId('bible-journey-nt-fill') as HTMLElement
    expect(nt.style.width).toBe('0%')
  })

  it('whole card is a Link to /journey', async () => {
    mockApiGet.mockResolvedValue(summary())
    renderCard()
    await waitFor(() => {
      const card = screen.getByTestId('bible-journey-card')
      expect(card.getAttribute('href')).toBe('/journey')
    })
  })
})
