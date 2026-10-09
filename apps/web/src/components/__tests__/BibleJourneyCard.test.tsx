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
    t: (key: string, opts?: Record<string, unknown>) => {
      const dict: Record<string, string> = {
        'home.journey.title': 'Hành trình 66 sách',
        'home.journeyExtra.subUnlock':
          'Sưu tầm theo thứ tự nào cũng được · Thuộc 80% mỗi sách là chinh phục xong',
        'home.journeyExtra.metaCountSuffix': '/ {{total}} sách',
        'home.journeyExtra.metaCurrent': 'Đang ở {{book}}',
        'home.journeyExtra.testamentOld': 'Cựu Ước',
        'home.journeyExtra.testamentNew': 'Tân Ước',
        'home.journeyExtra.statusInProgress': 'Đang chinh phục · {{pct}}%',
        'home.journeyExtra.statusDone': 'Hoàn thành · {{pct}}%',
        'home.journeyExtra.statusLocked': 'Khóa',
        'home.journeyExtra.overflowLabel': '+ {{remaining}} sách',
        'home.journeyExtra.overflowSub': 'Còn lại trong hành trình',
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

function makeBook(
  order: number,
  bookVi: string,
  status: 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED',
  masteryPercent = 0,
) {
  return {
    book: bookVi.replace(/\s+/g, ''),
    bookVi,
    order,
    testament: 'OLD',
    totalQuestions: 100,
    masteredQuestions: Math.round(masteryPercent),
    masteryPercent,
    status,
  }
}

const journey = (
  books: ReturnType<typeof makeBook>[],
  overrides: Partial<{ completedBooks: number; currentBook: string | null }> = {},
) => ({
  data: {
    summary: {
      totalBooks: 66,
      completedBooks: overrides.completedBooks ?? 0,
      inProgressBooks: 1,
      lockedBooks: 65,
      overallMasteryPercent: 0,
      oldTestamentCompleted: 0,
      newTestamentCompleted: 0,
      currentBook:
        overrides.currentBook ??
        books.find(b => b.status === 'IN_PROGRESS')?.book ??
        null,
    },
    books,
  },
})

describe('BibleJourneyCard (Modern Spiritual)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    const { container } = renderCard()
    expect(container.innerHTML).toBe('')
  })

  it('renders title + meta with current book name', async () => {
    mockApiGet.mockResolvedValue(
      journey([makeBook(1, 'Sáng Thế Ký', 'IN_PROGRESS', 5)]),
    )
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-title')).toHaveTextContent(
        'Hành trình 66 sách',
      )
    })
    const meta = screen.getByTestId('bible-journey-meta')
    expect(meta).toHaveTextContent('0')
    expect(meta).toHaveTextContent('66 sách')
    expect(screen.getByTestId('bible-journey-current')).toHaveTextContent(
      'Sáng Thế Ký',
    )
  })

  it('omits "Đang ở X" when there is no current book', async () => {
    mockApiGet.mockResolvedValue(journey([], { currentBook: null }))
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-meta')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('bible-journey-current')).not.toBeInTheDocument()
  })

  it('renders the static collection-rule sub line', async () => {
    mockApiGet.mockResolvedValue(journey([]))
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-sub').textContent).toContain(
        'Thuộc 80%',
      )
    })
  })

  it('renders one chip per book up to the visible window (6) plus an overflow chip', async () => {
    const books = [
      makeBook(1, 'Sáng Thế Ký', 'IN_PROGRESS', 5),
      makeBook(2, 'Xuất Hành', 'LOCKED'),
      makeBook(3, 'Lê-vi Ký', 'LOCKED'),
      makeBook(4, 'Dân Số Ký', 'LOCKED'),
      makeBook(5, 'Phục Truyền Luật Lệ Ký', 'LOCKED'),
      makeBook(6, 'Giô-suê', 'LOCKED'),
      makeBook(7, 'Các Quan Xét', 'LOCKED'),
      makeBook(8, 'Ru-tơ', 'LOCKED'),
    ]
    mockApiGet.mockResolvedValue(journey(books))
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-chips')).toBeInTheDocument()
    })
    // First 6 chips rendered
    expect(screen.getByTestId('bible-journey-chip-SángThếKý')).toBeInTheDocument()
    expect(screen.getByTestId('bible-journey-chip-Giô-suê')).toBeInTheDocument()
    // Beyond-window chip not rendered
    expect(screen.queryByTestId('bible-journey-chip-Ru-tơ')).not.toBeInTheDocument()
    // Overflow chip "+ 2 sách"
    const overflow = screen.getByTestId('bible-journey-overflow')
    expect(overflow).toHaveTextContent('+ 2 sách')
  })

  it('does NOT render an overflow chip when total <= visible window', async () => {
    const books = [
      makeBook(1, 'Sáng Thế Ký', 'IN_PROGRESS', 10),
      makeBook(2, 'Xuất Hành', 'LOCKED'),
    ]
    mockApiGet.mockResolvedValue(journey(books))
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-chips')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('bible-journey-overflow')).not.toBeInTheDocument()
  })

  it('current chip uses gold treatment + progress fill at masteryPercent', async () => {
    mockApiGet.mockResolvedValue(
      journey([makeBook(1, 'Sáng Thế Ký', 'IN_PROGRESS', 25)]),
    )
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-chip-SángThếKý')).toBeInTheDocument()
    })
    const chip = screen.getByTestId('bible-journey-chip-SángThếKý')
    expect(chip.getAttribute('data-status')).toBe('IN_PROGRESS')
    const fill = screen.getByTestId('bible-journey-chip-fill-SángThếKý')
    expect(fill.getAttribute('style') ?? '').toContain('width: 25%')
  })

  it('locked chip is dim and has data-status=LOCKED', async () => {
    mockApiGet.mockResolvedValue(
      journey([
        makeBook(1, 'Sáng Thế Ký', 'IN_PROGRESS', 5),
        makeBook(2, 'Xuất Hành', 'LOCKED'),
      ]),
    )
    renderCard()
    await waitFor(() => {
      expect(screen.getByTestId('bible-journey-chip-XuấtHành')).toBeInTheDocument()
    })
    const chip = screen.getByTestId('bible-journey-chip-XuấtHành')
    expect(chip.getAttribute('data-status')).toBe('LOCKED')
    expect(chip.className).toContain('opacity-70')
    // No fill bar for locked chips.
    expect(screen.queryByTestId('bible-journey-chip-fill-XuấtHành')).not.toBeInTheDocument()
  })

  it('whole card is a Link to /journey', async () => {
    mockApiGet.mockResolvedValue(journey([]))
    renderCard()
    await waitFor(() => {
      const card = screen.getByTestId('bible-journey-card')
      expect(card.getAttribute('href')).toBe('/journey')
    })
  })
})
