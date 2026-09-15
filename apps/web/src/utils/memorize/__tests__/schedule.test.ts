import { describe, it, expect } from 'vitest'
import { daysUntilReview, formatReference, SUGGESTED_VERSES } from '../schedule'
import { getVerseCount } from '../../../data/bibleData'

describe('daysUntilReview', () => {
  const now = new Date('2026-09-15T08:00:00Z')

  it('is 0 when due or overdue', () => {
    expect(daysUntilReview('2026-09-15T08:00:00Z', now)).toBe(0)
    expect(daysUntilReview('2026-09-01T00:00:00Z', now)).toBe(0)
  })

  it('floors whole days ahead', () => {
    expect(daysUntilReview('2026-09-15T20:00:00Z', now)).toBe(0)
    expect(daysUntilReview('2026-09-16T09:00:00Z', now)).toBe(1)
    expect(daysUntilReview('2026-10-15T08:00:00Z', now)).toBe(30)
  })
})

describe('formatReference', () => {
  it('shows a single verse or a range', () => {
    expect(formatReference('Giăng', 3, 16, 16)).toBe('Giăng 3:16')
    expect(formatReference('Châm Ngôn', 3, 5, 6)).toBe('Châm Ngôn 3:5-6')
  })
})

describe('SUGGESTED_VERSES', () => {
  it('are valid references of at most 5 verses', () => {
    for (const s of SUGGESTED_VERSES) {
      expect(s.verseEnd).toBeLessThanOrEqual(getVerseCount(s.book, s.chapter))
      expect(s.verseEnd - s.verseStart).toBeLessThanOrEqual(4)
    }
  })
})
