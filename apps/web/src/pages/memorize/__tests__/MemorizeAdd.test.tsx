import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemorizeAdd from '../MemorizeAdd'

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

const BOOKS = [
  { id: '2', name: 'Psalms', nameVi: 'Thi Thiên', testament: 'OT', orderIndex: 19 },
  { id: '1', name: 'John', nameVi: 'Giăng', testament: 'NT', orderIndex: 43 },
]

const plainChapter = (n: number) => Array.from({ length: n }, (_, i) => ({ verse: i + 1, verseEnd: null }))

let passageFails = false
let chapterVerses: { verse: number; verseEnd: number | null }[] = plainChapter(36)
beforeEach(() => {
  vi.clearAllMocks()
  passageFails = false
  chapterVerses = plainChapter(36)
  mockGet.mockImplementation((url: string, config?: { params: { from: number; to: number } }) => {
    if (url === '/api/books') return Promise.resolve({ data: BOOKS })
    if (url === '/api/bible/verses') return Promise.resolve({ data: chapterVerses })
    if (url === '/api/bible/passage') {
      if (passageFails) return Promise.reject({ response: { status: 404 } })
      const { from, to } = config!.params
      const verses = Array.from({ length: to - from + 1 }, (_, i) => ({ verse: from + i, text: `fixture ${from + i}` }))
      return Promise.resolve({ data: { version: 'RVV11', book: 'John', chapter: 3, verses } })
    }
    return Promise.reject(new Error(url))
  })
})

const select = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } })
const optionsOf = (id: string) =>
  Array.from((screen.getByTestId(id) as HTMLSelectElement).options).slice(1).map(o => ({ value: o.value, label: o.text }))

async function pickJohn3from(from: string) {
  renderWithProviders(<MemorizeAdd />)
  await screen.findByRole('option', { name: 'Giăng' })
  select('memorize-add-book', 'John')
  select('memorize-add-chapter', '3')
  // verse choices come from GET /api/bible/verses
  await waitFor(() => expect(optionsOf('memorize-add-verse-from').length).toBeGreaterThan(0))
  select('memorize-add-verse-from', from)
}

async function pickJohn316to(to: string) {
  await pickJohn3from('16')
  select('memorize-add-verse-to', to)
}

describe('MemorizeAdd', () => {
  it('lists books in canonical order and locks later pickers until earlier ones are chosen', async () => {
    renderWithProviders(<MemorizeAdd />)
    await screen.findByRole('option', { name: 'Giăng' })
    const names = Array.from((screen.getByTestId('memorize-add-book') as HTMLSelectElement).options).map(o => o.text)
    expect(names.slice(1)).toEqual(['Thi Thiên', 'Giăng'])
    expect(screen.getByTestId('memorize-add-chapter')).toBeDisabled()
    expect(screen.getByTestId('memorize-add-verse-from')).toBeDisabled()
    expect(screen.getByTestId('memorize-add-submit')).toBeDisabled()
  })

  it('limits the range to 5 verses and previews the passage', async () => {
    await pickJohn316to('17')
    const toOptions = Array.from((screen.getByTestId('memorize-add-verse-to') as HTMLSelectElement).options).map(o => o.value)
    expect(toOptions.slice(1)).toEqual(['16', '17', '18', '19', '20'])
    expect(await screen.findByTestId('memorize-add-preview')).toHaveTextContent('fixture 16')
    expect(screen.getByTestId('memorize-add-preview')).toHaveTextContent('fixture 17')
    expect(screen.getByTestId('memorize-add-submit')).toBeEnabled()
  })

  it('adds the passage and returns to the list', async () => {
    mockPost.mockResolvedValue({ data: { id: 'v1' } })
    await pickJohn316to('17')
    await screen.findByTestId('memorize-add-preview')
    fireEvent.click(screen.getByTestId('memorize-add-submit'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses',
      { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize'))
  })

  it('shows the duplicate message on 409', async () => {
    mockPost.mockRejectedValue({ response: { status: 409 } })
    await pickJohn316to('16')
    await screen.findByTestId('memorize-add-preview')
    fireEvent.click(screen.getByTestId('memorize-add-submit'))
    expect(await screen.findByTestId('memorize-add-error')).toHaveTextContent('Đoạn này đã có trong danh sách.')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('offers the verses the translation has: merged blocks as one choice, stopping at a left-out verse', async () => {
    chapterVerses = [{ verse: 15, verseEnd: null }, { verse: 16, verseEnd: null }, { verse: 17, verseEnd: 18 },
      { verse: 20, verseEnd: null }, { verse: 21, verseEnd: null }]
    await pickJohn3from('16')
    expect(optionsOf('memorize-add-verse-from').map(o => o.label)).toEqual(['15', '16', '17-18', '20', '21'])
    // 19 is not in the translation: a passage from 16 ends at the 17-18 block
    expect(optionsOf('memorize-add-verse-to')).toEqual([{ value: '16', label: '16' }, { value: '18', label: '17-18' }])
  })

  it('picking a merged block as start selects the whole block', async () => {
    chapterVerses = [{ verse: 16, verseEnd: null }, { verse: 17, verseEnd: 18 }, { verse: 19, verseEnd: null }]
    await pickJohn3from('17')
    expect((screen.getByTestId('memorize-add-verse-to') as HTMLSelectElement).value).toBe('18')
  })

  it('blocks adding when the passage has no text', async () => {
    passageFails = true
    await pickJohn316to('16')
    expect(await screen.findByTestId('memorize-add-no-text')).toBeInTheDocument()
    expect(screen.getByTestId('memorize-add-submit')).toBeDisabled()
  })
})
