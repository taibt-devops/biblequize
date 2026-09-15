import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMemorizeSession } from '../useMemorizeSession'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

const verse = (id: string, masteryLevel: number) => ({
  id, book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, text: 'fixture',
  masteryLevel, nextReviewAt: '2020-01-01T00:00:00', due: true,
})

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

async function started(items: unknown[]) {
  mockGet.mockResolvedValue({ data: { items } })
  const hook = renderHook(() => useMemorizeSession(), { wrapper })
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

describe('useMemorizeSession', () => {
  it('reports empty when nothing is due', async () => {
    const { result } = await started([])
    expect(result.current.status).toBe('empty')
  })

  it('reports error when the queue cannot load', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMemorizeSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('walks context → exercise → result and picks the exercise by level', async () => {
    const { result } = await started([verse('a', 0), verse('b', 3)])
    expect(result.current.status).toBe('active')
    expect(result.current.phase).toBe('context')
    expect(result.current.exercise).toEqual({ type: 'order', chunkSize: 3 })
    expect(result.current.position).toEqual({ index: 1, total: 2 })

    act(() => result.current.start())
    expect(result.current.phase).toBe('exercise')

    mockPost.mockResolvedValue({ data: { ...verse('a', 1), due: false } })
    act(() => result.current.complete({ passed: true, mistakes: 0 }))
    expect(result.current.phase).toBe('result')
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/me/memory-verses/a/review', { exerciseType: 'order', passed: true }))
    await waitFor(() => expect(result.current.canContinue).toBe(true))

    act(() => result.current.next())
    expect(result.current.current?.id).toBe('b')
    expect(result.current.exercise).toEqual({ type: 'cloze', ratio: 0.5 })
    expect(result.current.phase).toBe('context')
  })

  it('ends with a summary counting reviews and level-ups', async () => {
    const { result } = await started([verse('a', 2), verse('b', 2)])
    mockPost
      .mockResolvedValueOnce({ data: verse('a', 3) })
      .mockResolvedValueOnce({ data: verse('b', 1) })

    for (let i = 0; i < 2; i++) {
      act(() => result.current.start())
      act(() => result.current.complete({ passed: i === 0, mistakes: i * 3 }))
      await waitFor(() => expect(result.current.canContinue).toBe(true))
      act(() => result.current.next())
    }
    expect(result.current.status).toBe('done')
    expect(result.current.summary).toEqual({ reviewed: 2, leveledUp: 1 })
  })

  it('does not advance until the result is saved, and can retry a failed save', async () => {
    const { result } = await started([verse('a', 0)])
    mockPost.mockRejectedValueOnce(new Error('offline'))
    act(() => result.current.start())
    act(() => result.current.complete({ passed: false, mistakes: 2 }))
    await waitFor(() => expect(result.current.saveFailed).toBe(true))

    act(() => result.current.next())
    expect(result.current.status).toBe('active')

    mockPost.mockResolvedValueOnce({ data: verse('a', 0) })
    act(() => { result.current.retrySave() })
    await waitFor(() => expect(result.current.canContinue).toBe(true))
    expect(mockPost).toHaveBeenLastCalledWith('/api/me/memory-verses/a/review', { exerciseType: 'order', passed: false })
  })
})
