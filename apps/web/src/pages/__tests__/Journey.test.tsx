import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k),
    i18n: { language: 'vi' },
  }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await (orig() as Promise<typeof import('react-router-dom')>)
  return { ...actual, useNavigate: () => navigateMock }
})

let queryResult: any
vi.mock('@tanstack/react-query', () => ({ useQuery: () => queryResult }))

import Journey from '../Journey'

const book = (order: number, name: string, status: string) => ({
  book: name, bookVi: name, order, testament: order <= 39 ? 'OLD' : 'NEW',
  totalQuestions: 10, masteredQuestions: status === 'COMPLETED' ? 10 : 3,
  masteryPercent: status === 'COMPLETED' ? 100 : 30, status,
})

beforeEach(() => {
  vi.clearAllMocks()
  queryResult = {
    isLoading: false, error: null,
    data: {
      summary: {
        totalBooks: 66, completedBooks: 1, inProgressBooks: 1, lockedBooks: 64,
        overallMasteryPercent: 2, oldTestamentCompleted: 1, newTestamentCompleted: 0, currentBook: 'Psalms',
      },
      books: [book(1, 'Genesis', 'COMPLETED'), book(19, 'Psalms', 'IN_PROGRESS'), book(43, 'John', 'NOT_STARTED')],
    },
  }
})

const render_ = () => render(<MemoryRouter><Journey /></MemoryRouter>)

describe('Journey page (8 lands)', () => {
  it('shows the map with the land of the current book highlighted', () => {
    render_()
    expect(screen.getByTestId('journey-map')).toBeInTheDocument()
    expect(screen.getByTestId('journey-region-poetry')).toHaveAttribute('data-current', 'true')
    expect(screen.getByTestId('journey-region-pentateuch')).toHaveTextContent('1/1')
  })

  it('groups books into their land inside the right testament', () => {
    render_()
    const ot = screen.getByTestId('journey-old-testament')
    expect(within(ot).getByTestId('journey-land-pentateuch')).toHaveTextContent('Genesis')
    expect(within(ot).getByTestId('journey-land-poetry')).toHaveTextContent('Psalms')
    const nt = screen.getByTestId('journey-new-testament')
    expect(within(nt).getByTestId('journey-land-gospels')).toHaveTextContent('John')
    expect(screen.getAllByTestId('journey-book-card')).toHaveLength(3)
  })

  it('opens practice for the clicked book', () => {
    render_()
    fireEvent.click(screen.getByTestId('journey-book-card-John'))
    expect(navigateMock).toHaveBeenCalledWith('/practice?book=John')
  })

  it("opens the current book's card; its CTA practices the book", () => {
    render_()
    expect(screen.getByTestId('journey-book-detail')).toHaveTextContent('Psalms')
    fireEvent.click(screen.getByTestId('journey-book-detail-cta'))
    expect(navigateMock).toHaveBeenCalledWith('/practice?book=Psalms')
  })

  it('opening another land puts its books on the map and opens its first book', () => {
    render_()
    expect(screen.getByTestId('journey-station-Psalms')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('journey-region-gospels'))
    expect(screen.getByTestId('journey-station-John')).toBeInTheDocument()
    expect(screen.queryByTestId('journey-station-Psalms')).not.toBeInTheDocument()
    expect(screen.getByTestId('journey-book-detail')).toHaveTextContent('John')
  })

  it('earns the first milestone badge after one conquered book', () => {
    render_()
    expect(screen.getByTestId('journey-badge-start')).toHaveAttribute('data-earned', 'true')
    expect(screen.getByTestId('journey-badge-ten')).not.toHaveAttribute('data-earned')
  })
})
