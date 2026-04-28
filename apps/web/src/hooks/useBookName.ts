import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface Book {
  id: string
  name: string
  nameVi: string
  testament: string
  orderIndex: number
}

/**
 * Lookup helper for translating a Bible book key (English, e.g. "Genesis",
 * "1 Corinthians") to its display name. Reuses the existing
 * {@code GET /api/books} endpoint and shares the {@code ['books']} query
 * cache with other consumers (e.g. Practice book picker), so calling this
 * hook multiple times across the tree triggers at most one network request.
 *
 * Returns a stable callback (memoised on the lookup map) so it is safe to
 * place in {@code useMemo} / {@code useEffect} dependency arrays without
 * causing re-runs on every render.
 *
 * Falls back to the English key when:
 *   - books haven't loaded yet (first render),
 *   - the requested language is "en",
 *   - the key is unknown (defensive — keeps UI readable).
 */
export function useBookName() {
  const { data: books = [] } = useQuery({
    queryKey: ['books'],
    queryFn: () => api.get('/api/books').then(r => r.data as Book[]),
    staleTime: Infinity,
  })

  const map = useMemo(
    () => new Map(books.map(b => [b.name, b.nameVi])),
    [books],
  )

  return useCallback(
    (bookKey: string, lang: 'vi' | 'en' = 'vi'): string =>
      lang === 'vi' ? map.get(bookKey) ?? bookKey : bookKey,
    [map],
  )
}
