import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMemoryVerse, deleteMemoryVerse, getMemoryDueCount, getPassage, listDueMemoryVerses,
  listMemoryVerses, reviewMemoryVerse, type ExerciseType, type MemoryVerseRef,
} from '../api/memorize'
import { queryKeys } from '../api/queryKeys'

/**
 * Memorize mode (SPEC_USER §5.1.1). Add/delete invalidate the whole `memorize`
 * domain so the list, review queue and due count always agree.
 */

export function useMemoryVerses(enabled = true) {
  return useQuery({ queryKey: queryKeys.memorize.list(), queryFn: listMemoryVerses, enabled })
}

/**
 * Review-session queue. Always fresh when a session opens; callers snapshot the
 * first result so a later refetch never reshuffles an in-progress session.
 */
export function useDueMemoryVerses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.memorize.due(),
    queryFn: listDueMemoryVerses,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })
}

export function useMemoryDueCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.memorize.dueCount(),
    queryFn: getMemoryDueCount,
    enabled,
    staleTime: 60_000,
  })
}

export function usePassage(book: string | undefined, chapter: number | undefined,
                           from: number | undefined, to: number | undefined) {
  const ready = !!book && !!chapter && !!from && !!to
  return useQuery({
    queryKey: queryKeys.memorize.passage(book ?? '', chapter ?? 0, from ?? 0, to ?? 0),
    queryFn: () => getPassage(book!, chapter!, from!, to!),
    enabled: ready,
    staleTime: Infinity, // Bible text never changes
    retry: false,
  })
}

function useInvalidateMemorize() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.memorize.all })
}

export function useAddMemoryVerse() {
  const invalidate = useInvalidateMemorize()
  return useMutation({ mutationFn: (ref: MemoryVerseRef) => addMemoryVerse(ref), onSuccess: invalidate })
}

export function useDeleteMemoryVerse() {
  const invalidate = useInvalidateMemorize()
  return useMutation({ mutationFn: (id: string) => deleteMemoryVerse(id), onSuccess: invalidate })
}

/**
 * Records a review result. Does NOT invalidate the in-session `due` queue (the
 * session advances itself); only refreshes the list and due count.
 */
export function useReviewMemoryVerse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; exerciseType: ExerciseType; passed: boolean }) =>
      reviewMemoryVerse(v.id, { exerciseType: v.exerciseType, passed: v.passed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memorize.list() })
      qc.invalidateQueries({ queryKey: queryKeys.memorize.dueCount() })
    },
  })
}
