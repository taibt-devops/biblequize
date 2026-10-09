import { describe, it, expect } from 'vitest'
import { daysUntilReview, formatReference, rangeEndOptions, SUGGESTED_VERSES, verseEndOptions } from '../schedule'

describe('rangeEndOptions', () => {
  const plain = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ verse: from + i }))

  it('allows up to 5 consecutive verses, clamped to the chapter end', () => {
    expect(rangeEndOptions(plain(1, 36), 16).map(o => o.value)).toEqual([16, 17, 18, 19, 20])
    expect(rangeEndOptions(plain(1, 25), 24).map(o => o.value)).toEqual([24, 25])
  })

  it('treats a merged block as one choice and counts all its verses', () => {
    const verses = [{ verse: 15 }, { verse: 16 }, { verse: 17, verseEnd: 18 }, { verse: 19 }, { verse: 20 }]
    expect(rangeEndOptions(verses, 16)).toEqual([
      { value: 16, label: '16' }, { value: 18, label: '17-18' }, { value: 19, label: '19' }, { value: 20, label: '20' }])
    expect(rangeEndOptions(verses, 17)[0]).toEqual({ value: 18, label: '17-18' })
  })

  it('stops at a verse the translation leaves out', () => {
    expect(rangeEndOptions([{ verse: 20 }, { verse: 22 }, { verse: 23 }], 20)).toEqual([{ value: 20, label: '20' }])
  })
})

describe('verseEndOptions', () => {
  it('allows up to 5 consecutive verses, clamped to the chapter end', () => {
    expect(verseEndOptions(16, 36)).toEqual([16, 17, 18, 19, 20])
    expect(verseEndOptions(24, 25)).toEqual([24, 25])
  })

  it('is empty for an invalid start', () => {
    expect(verseEndOptions(0, 10)).toEqual([])
    expect(verseEndOptions(11, 10)).toEqual([])
  })
})
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
