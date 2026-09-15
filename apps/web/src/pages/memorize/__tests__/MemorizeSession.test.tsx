import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemorizeSession from '../MemorizeSession'
import { chunkPhrases, tokenize } from '../../../utils/memorize/exercises'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../../api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

// Synthetic text — not scripture.
const TEXT = 'p1 p2 p3 p4 p5 p6'
const item = (masteryLevel: number) => ({
  id: 'v1', book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, text: TEXT,
  masteryLevel, nextReviewAt: '2020-01-01T00:00:00', due: true,
})

function mockApi(items: unknown[], passageOk = true) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/books') return Promise.resolve({ data: [{ id: '1', name: 'John', nameVi: 'Giăng', testament: 'NT', orderIndex: 43 }] })
    if (url === '/api/me/memory-verses/due') return Promise.resolve({ data: { items } })
    if (url === '/api/bible/passage') {
      return passageOk
        ? Promise.resolve({ data: { version: 'BTT1926', book: 'John', chapter: 3,
            verses: [{ verse: 15, text: 'ctx before' }, { verse: 16, text: TEXT }, { verse: 17, text: 'ctx after' }] } })
        : Promise.reject({ response: { status: 404 } })
    }
    return Promise.reject(new Error(url))
  })
}

beforeEach(() => vi.clearAllMocks())

describe('MemorizeSession', () => {
  it('shows the empty state when nothing is due', async () => {
    mockApi([])
    renderWithProviders(<MemorizeSession />)
    expect(await screen.findByText('Không có câu nào cần ôn')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Về danh sách'))
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize')
  })

  it('shows context with surrounding verses, then the order exercise for level 0', async () => {
    mockApi([item(0)])
    renderWithProviders(<MemorizeSession />)
    const context = await screen.findByTestId('memorize-context')
    expect(await screen.findByText('ctx before')).toBeInTheDocument()
    expect(context).toHaveTextContent('Giăng 3:16')
    expect(screen.getByText('Câu 1/1')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('memorize-context-start'))
    expect(screen.getByTestId('memorize-order-exercise')).toBeInTheDocument()
  })

  it('falls back to the verse text when the context passage is unavailable', async () => {
    mockApi([item(0)], false)
    renderWithProviders(<MemorizeSession />)
    const context = await screen.findByTestId('memorize-context')
    await waitFor(() => expect(context).toHaveTextContent(TEXT))
  })

  it('completes an exercise, saves the result and ends with the summary', async () => {
    mockApi([item(0)])
    mockPost.mockResolvedValue({ data: { ...item(1), due: false } })
    renderWithProviders(<MemorizeSession />)
    fireEvent.click(await screen.findByTestId('memorize-context-start'))
    for (const chunk of chunkPhrases(tokenize(TEXT), 3)) {
      fireEvent.click(screen.getAllByTestId('memorize-order-chunk').find(b => b.textContent === chunk)!)
    }
    const result = screen.getByTestId('memorize-result')
    expect(result).toHaveAttribute('data-passed', 'true')
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses/v1/review',
      { exerciseType: 'order', passed: true }))
    const next = screen.getByTestId('memorize-next-btn')
    await waitFor(() => expect(next).toBeEnabled())
    expect(next).toHaveTextContent('Xem tổng kết')
    fireEvent.click(next)
    const summary = screen.getByTestId('memorize-summary')
    expect(summary).toHaveTextContent('Bạn đã ôn 1 câu.')
    expect(summary).toHaveTextContent('1 câu lên mức thuộc mới.')
  })

  it('uses the cloze exercise from level 2', async () => {
    mockApi([item(2)])
    renderWithProviders(<MemorizeSession />)
    fireEvent.click(await screen.findByTestId('memorize-context-start'))
    expect(screen.getByTestId('memorize-cloze-exercise')).toBeInTheDocument()
  })

  it('shows an error with retry when the queue fails to load', async () => {
    mockGet.mockImplementation((url: string) =>
      url === '/api/books' ? Promise.resolve({ data: [] }) : Promise.reject(new Error('boom')))
    renderWithProviders(<MemorizeSession />)
    expect(await screen.findByText('Không tải được phiên ôn.')).toBeInTheDocument()
    mockApi([])
    fireEvent.click(screen.getByText('Thử lại'))
    expect(await screen.findByText('Không có câu nào cần ôn')).toBeInTheDocument()
  })
})
