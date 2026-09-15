// Memorize mode — display helpers for the review schedule (SPEC_USER §5.1.1).

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

/** Starter suggestions shown on an empty list — references only, text comes from the API. */
export const SUGGESTED_VERSES = [
  { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
  { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1 },
  { book: 'Philippians', chapter: 4, verseStart: 13, verseEnd: 13 },
  { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 28 },
  { book: 'Proverbs', chapter: 3, verseStart: 5, verseEnd: 6 },
] as const
