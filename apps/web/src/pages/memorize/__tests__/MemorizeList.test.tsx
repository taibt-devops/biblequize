import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemorizeList from '../MemorizeList'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()
vi.mock('../../../api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const BOOKS = [
  { id: '1', name: 'John', nameVi: 'Giăng', testament: 'NT', orderIndex: 43 },
  { id: '2', name: 'Psalms', nameVi: 'Thi Thiên', testament: 'OT', orderIndex: 19 },
]
const verse = (over: Record<string, unknown> = {}) => ({
  id: 'v1', book: 'John', chapter: 3, verseStart: 16, verseEnd: 17, text: 'fixture text',
  masteryLevel: 2, nextReviewAt: '2020-01-01T00:00:00', due: true, ...over,
})

function mockList(items: unknown[], dueCount = items.length) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/books') return Promise.resolve({ data: BOOKS })
    if (url === '/api/me/memory-verses') return Promise.resolve({ data: { items, dueCount } })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

beforeEach(() => vi.clearAllMocks())

describe('MemorizeList', () => {
  it('shows a loading skeleton first', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    const { container } = renderWithProviders(<MemorizeList />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders items with localized reference and due review button', async () => {
    mockList([verse()], 1)
    renderWithProviders(<MemorizeList />)
    expect(await screen.findByText('Giăng 3:16-17')).toBeInTheDocument()
    expect(screen.getAllByTestId('memorize-item')).toHaveLength(1)
    const review = screen.getByTestId('memorize-start-review-btn')
    expect(review).toHaveTextContent('Ôn 1 câu đến hạn')
    fireEvent.click(review)
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize/session')
  })

  it('disables review when nothing is due and shows next review days', async () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString()
    mockList([verse({ due: false, nextReviewAt: inThreeDays })], 0)
    renderWithProviders(<MemorizeList />)
    expect(await screen.findByText('Ôn lại sau 3 ngày')).toBeInTheDocument()
    expect(screen.getByTestId('memorize-start-review-btn')).toBeDisabled()
  })

  it('empty state offers suggestions that add a verse', async () => {
    mockList([])
    mockPost.mockResolvedValue({ data: verse() })
    renderWithProviders(<MemorizeList />)
    expect(await screen.findByTestId('memorize-empty')).toBeInTheDocument()
    const first = (await screen.findAllByTestId('memorize-suggestion'))[0]
    await waitFor(() => expect(first).toHaveTextContent('Giăng 3:16'))
    fireEvent.click(first)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses',
      { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }))
  })

  it('deletes only after confirmation', async () => {
    mockList([verse()])
    mockDelete.mockResolvedValue({})
    renderWithProviders(<MemorizeList />)
    fireEvent.click(await screen.findByTestId('memorize-item-delete'))
    expect(mockDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('memorize-item-delete-confirm'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/me/memory-verses/v1'))
  })

  it('shows an error with retry when loading fails', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/api/books' ? Promise.resolve({ data: BOOKS }) : Promise.reject(new Error('boom')))
    renderWithProviders(<MemorizeList />)
    expect(await screen.findByText('Không tải được danh sách câu gốc.')).toBeInTheDocument()
    mockList([verse()])
    fireEvent.click(screen.getByText('Thử lại'))
    expect(await screen.findByText('Giăng 3:16-17')).toBeInTheDocument()
  })

  it('navigates to the add screen', async () => {
    mockList([])
    renderWithProviders(<MemorizeList />)
    fireEvent.click(await screen.findByTestId('memorize-add-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize/add')
  })
})
