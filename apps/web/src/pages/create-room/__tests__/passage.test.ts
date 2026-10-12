import { describe, it, expect } from 'vitest'
import { formatPassage, parsePassageParam } from '../passage'

/** PCV-24 — "?passage=Genesis:27-28,Psalms:7" từ app Đọc hằng ngày (cùng luật kiểm với máy chủ). */
describe('parsePassageParam', () => {
  it('đọc nhiều đoạn, một chương hoặc một khoảng', () => {
    expect(parsePassageParam('Genesis:27-28,Psalms:7')).toEqual([
      { book: 'Genesis', fromChapter: 27, toChapter: 28 },
      { book: 'Psalms', fromChapter: 7, toChapter: 7 },
    ])
  })

  it('tên sách có số và dấu cách, chữ thường, khoảng ngược', () => {
    expect(parsePassageParam('1 Samuel:4-3, song of songs:2')).toEqual([
      { book: '1 Samuel', fromChapter: 3, toChapter: 4 },
      { book: 'Song of Songs', fromChapter: 2, toChapter: 2 },
    ])
  })

  it('bỏ sách lạ, chương ngoài sách, đoạn trùng; kẹp chương vào sách', () => {
    expect(parsePassageParam('Atlantis:1,Genesis:60,Obadiah:1-9,Obadiah:1,Genesis')).toEqual([
      { book: 'Obadiah', fromChapter: 1, toChapter: 1 },
    ])
    expect(parsePassageParam(null)).toEqual([])
    expect(parsePassageParam('')).toEqual([])
  })

  it('tối đa 10 đoạn', () => {
    const many = Array.from({ length: 14 }, (_, i) => `Psalms:${i + 1}`).join(',')
    expect(parsePassageParam(many)).toHaveLength(10)
  })
})

describe('formatPassage', () => {
  it('ghép tên sách hiển thị + chương', () => {
    const vi: Record<string, string> = { Genesis: 'Sáng Thế Ký', Psalms: 'Thi Thiên' }
    expect(formatPassage(parsePassageParam('Genesis:27-28,Psalms:7'), b => vi[b] ?? b)).toBe('Sáng Thế Ký 27–28, Thi Thiên 7')
  })
})
