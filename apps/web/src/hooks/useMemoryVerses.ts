import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMemoryVerse, deleteMemoryVerse, getMemoryDueCount, getPassage, listDueMemoryVerses,
  listMemoryVerses, reviewMemoryVerse, type ExerciseType, type MemoryVerseRef,
} from '../api/memorize'
import { queryKeys } from '../api/queryKeys'

/**
 * Học Thuộc câu gốc (SPEC_USER §5.1.1). Mọi mutation invalidate cả domain
 * `memorize` — danh sách, hàng đợi ôn và số câu đến hạn luôn khớp nhau.
 */

export function useMemoryVerses(enabled = true) {
  return useQuery({ queryKey: queryKeys.memorize.list(), queryFn: listMemoryVerses, enabled })
}

/** Hàng đợi phiên ôn — không refetch tự động giữa phiên (câu vừa ôn xong sẽ rời hàng đợi). */
export function useDueMemoryVerses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.memorize.due(),
    queryFn: listDueMemoryVerses,
    enabled,
    staleTime: Infinity,
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
    staleTime: Infinity, // toàn văn không đổi
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
 * Ghi kết quả ôn. KHÔNG invalidate hàng đợi `due` giữa phiên (phiên tự tiến câu);
 * chỉ làm tươi danh sách + số đến hạn.
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
