// Memorize mode — display helpers for the review schedule (SPEC_USER §5.1.1).

import { lastVerse, verseLabel, type VerseNumber } from '../../api/memorize'

export const MAX_MASTERY_LEVEL = 5

/** Whole days until the next review (0 when due or due later today). */
export function daysUntilReview(nextReviewAt: string, now: Date = new Date()): number {
  const ms = new Date(nextReviewAt).getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000)
}

/** "John 3:16" or "John 3:16-17" using an already-localised book name. */
export function formatReference(bookName: string, chapter: number, verseStart: number, verseEnd: number): string {
  return `${bookName} ${chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`
}

/** Max verses in one memorize passage (server enforces the same limit). */
export const MAX_PASSAGE_VERSES = 5

/** Allowed "to" verses for a start verse: start … min(start + 4, last verse of chapter). */
export function verseEndOptions(verseStart: number, verseCount: number): number[] {
  if (verseStart < 1 || verseStart > verseCount) return []
  const last = Math.min(verseStart + MAX_PASSAGE_VERSES - 1, verseCount)
  return Array.from({ length: last - verseStart + 1 }, (_, i) => verseStart + i)
}

/**
 * "To" choices for a start verse, from the verses the translation has: each verse or merged block from
 * the start on, while the passage stays contiguous (a verse the translation leaves out ends it) and
 * within MAX_PASSAGE_VERSES. Value = the last verse covered; label = "18" or "17-18".
 */
export function rangeEndOptions(verses: VerseNumber[], verseStart: number): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = []
  let next = verseStart
  for (const v of verses) {
    if (v.verse < verseStart) continue
    if (v.verse !== next || lastVerse(v) - verseStart + 1 > MAX_PASSAGE_VERSES) break
    out.push({ value: lastVerse(v), label: verseLabel(v) })
    next = lastVerse(v) + 1
  }
  return out
}

/** Starter suggestions shown on an empty list — references only, text comes from the API. */
export const SUGGESTED_VERSES = [
  { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
  { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1 },
  { book: 'Philippians', chapter: 4, verseStart: 13, verseEnd: 13 },
  { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 28 },
  { book: 'Proverbs', chapter: 3, verseStart: 5, verseEnd: 6 },
] as const
