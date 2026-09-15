import { useState } from 'react'
import type { MemoryVerse } from '../api/memorize'
import { exerciseForLevel, seedFor, type ExerciseSpec } from '../utils/memorize/exercises'
import { useDueMemoryVerses, useReviewMemoryVerse } from './useMemoryVerses'

export type SessionPhase = 'context' | 'exercise' | 'result'
export type SessionStatus = 'loading' | 'error' | 'empty' | 'active' | 'done'

export interface ExerciseOutcome {
  passed: boolean
  mistakes: number
}

/**
 * Drives one Memorize review session (SPEC_USER §5.1.1):
 * context → exercise → result → next verse … → summary.
 * The due queue is snapshotted on first load; each result is POSTed once and
 * the session only advances after the server accepted it (retry on failure).
 */
export function useMemorizeSession() {
  const due = useDueMemoryVerses()
  const review = useReviewMemoryVerse()
  const [queue, setQueue] = useState<MemoryVerse[] | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<SessionPhase>('context')
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null)
  const [saved, setSaved] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [leveledUp, setLeveledUp] = useState(0)

  if (queue === null && due.data) setQueue(due.data)

  const current = queue?.[index]
  const exercise: ExerciseSpec | undefined = current ? exerciseForLevel(current.masteryLevel) : undefined

  let status: SessionStatus
  if (queue === null) status = due.isError ? 'error' : 'loading'
  else if (queue.length === 0) status = 'empty'
  else status = index >= queue.length ? 'done' : 'active'

  const submit = (result: ExerciseOutcome) => {
    if (!current || !exercise) return
    review.mutate(
      { id: current.id, exerciseType: exercise.type, passed: result.passed },
      {
        onSuccess: updated => {
          setSaved(true)
          setReviewed(n => n + 1)
          if (updated.masteryLevel > current.masteryLevel) setLeveledUp(n => n + 1)
        },
      },
    )
  }

  return {
    status,
    phase,
    current,
    exercise,
    seed: current ? seedFor(current.id, current.masteryLevel) : 0,
    outcome,
    position: { index: Math.min(index + 1, queue?.length ?? 0), total: queue?.length ?? 0 },
    saving: review.isPending,
    saveFailed: review.isError,
    canContinue: saved,
    summary: { reviewed, leveledUp },
    start: () => setPhase('exercise'),
    complete: (result: ExerciseOutcome) => {
      setOutcome(result)
      setPhase('result')
      submit(result)
    },
    retrySave: () => outcome && submit(outcome),
    next: () => {
      if (!saved) return
      setIndex(i => i + 1)
      setPhase('context')
      setOutcome(null)
      setSaved(false)
      review.reset()
    },
    reload: () => due.refetch(),
  }
}
