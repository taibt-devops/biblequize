import { describe, it, expect } from 'vitest'
import {
  BIBLE_BOOKS_EN, BIBLE_BOOKS_VI, BIBLE_VERSES, getVerseCount, localizeBibleBook, normalizeBibleBookVi,
} from '../bibleData'

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

// 2026-10-09: VN book names follow RVV11; names saved before keep resolving.
describe('bibleData book names', () => {
  it('lists 66 RVV11 names aligned with the English keys', () => {
    expect(BIBLE_BOOKS_VI).toHaveLength(66)
    expect(BIBLE_BOOKS_EN).toHaveLength(66)
    expect(new Set(BIBLE_BOOKS_VI).size).toBe(66)
    expect(BIBLE_BOOKS_VI[1]).toBe('Xuất Ai Cập Ký')
    expect(BIBLE_BOOKS_VI[18]).toBe('Thi Thiên')
    expect(BIBLE_BOOKS_VI[43]).toBe('Công Vụ Các Sứ Đồ')
  })

  it('maps names saved before the switch to their RVV11 form', () => {
    expect(normalizeBibleBookVi('Xuất Ê-díp-tô Ký')).toBe('Xuất Ai Cập Ký')
    expect(normalizeBibleBookVi('Dân-số Ký')).toBe('Dân Số Ký')
    expect(normalizeBibleBookVi('Thi-thiên')).toBe('Thi Thiên')
    expect(normalizeBibleBookVi('Gióp')).toBe('Gióp')
    expect(localizeBibleBook('Phục Truyền', 'vi')).toBe('Phục Truyền Luật Lệ Ký')
    expect(localizeBibleBook('Công Vụ', 'en')).toBe('Acts')
    expect(localizeBibleBook('Xuất Ai Cập Ký', 'en')).toBe('Exodus')
    expect(localizeBibleBook('Không có', 'en')).toBe('Không có')
  })
})
