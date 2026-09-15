import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useAddMemoryVerse, useMemoryDueCount, useMemoryVerses, usePassage, useReviewMemoryVerse,
} from '../useMemoryVerses'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: vi.fn(),
  },
}))

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useMemoryVerses', () => {
  it('loads list with dueCount', async () => {
    mockGet.mockResolvedValue({ data: { items: [{ id: 'v1' }], dueCount: 1 } })
    const { result } = renderHook(() => useMemoryVerses(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/api/me/memory-verses')
    expect(result.current.data).toEqual({ items: [{ id: 'v1' }], dueCount: 1 })
  })

  it('due count does not fetch when disabled (guest)', () => {
    renderHook(() => useMemoryDueCount(false), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('usePassage waits for a complete reference, then passes params', async () => {
    mockGet.mockResolvedValue({ data: { verses: [] } })
    const { rerender } = renderHook(
      ({ to }: { to?: number }) => usePassage('John', 3, 16, to), { wrapper, initialProps: {} },
    )
    expect(mockGet).not.toHaveBeenCalled()
    rerender({ to: 18 })
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/bible/passage', {
      params: { book: 'John', chapter: 3, from: 16, to: 18 },
    }))
  })

  it('add invalidates the whole memorize domain', async () => {
    mockPost.mockResolvedValue({ data: { id: 'v2' } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAddMemoryVerse(), { wrapper })
    await act(() => result.current.mutateAsync({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }))
    expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses',
      { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['memorize'] })
  })

  it('review posts result and does not invalidate the in-session due queue', async () => {
    mockPost.mockResolvedValue({ data: { id: 'v1', masteryLevel: 1 } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReviewMemoryVerse(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 'v1', exerciseType: 'order', passed: true }))
    expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses/v1/review', { exerciseType: 'order', passed: true })
    const keys = spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
    expect(keys).toContainEqual(['memorize', 'list'])
    expect(keys).toContainEqual(['memorize', 'due-count'])
    expect(keys).not.toContainEqual(['memorize', 'due'])
    expect(keys).not.toContainEqual(['memorize'])
  })
})
