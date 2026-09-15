import { describe, it, expect } from 'vitest'
import { BIBLE_VERSES, getVerseCount } from '../bibleData'

// BT-3a (2026-09-15): mirrors BibleStructure.java; four books had wrong verse counts (31,152).
describe('bibleData verse counts', () => {
  it('match standard Protestant versification (31,102 verses, 66 books)', () => {
    expect(Object.keys(BIBLE_VERSES)).toHaveLength(66)
    const total = Object.values(BIBLE_VERSES).flat().reduce((a, b) => a + b, 0)
    expect(total).toBe(31102)
  })

  it('fixes the previously wrong chapters', () => {
    expect(getVerseCount('Leviticus', 19)).toBe(37)
    expect(getVerseCount('Ecclesiastes', 5)).toBe(20)
    expect(getVerseCount('Isaiah', 53)).toBe(12)
    expect(getVerseCount('Ephesians', 5)).toBe(33)
  })
})
