// PCV-24 — "Ôn phần đọc hôm nay": app Đọc hằng ngày mở /room/create?passage=Genesis:27-28,Psalms:7.
// Cùng luật kiểm với máy chủ (PassageScope.java): sách trong 66 sách (tên chuẩn tiếng Anh), chương kẹp
// vào sách, khoảng ngược thì đảo, đoạn trùng thì bỏ, tối đa 10 đoạn.
import { BIBLE_BOOKS_EN, getChapterCount } from '../../data/bibleData'

export interface PassageSegment {
  book: string
  fromChapter: number
  toChapter: number
}

export const MAX_PASSAGE_SEGMENTS = 10

const PART = /^\s*(.+?)\s*:\s*(\d+)\s*(?:-\s*(\d+))?\s*$/

export function parsePassageParam(raw: string | null | undefined): PassageSegment[] {
  if (!raw) return []
  const out: PassageSegment[] = []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    if (out.length >= MAX_PASSAGE_SEGMENTS) break
    const m = PART.exec(part)
    if (!m) continue
    const book = canonicalBook(m[1])
    if (!book) continue
    const max = getChapterCount(book)
    const a = Number(m[2])
    const b = m[3] ? Number(m[3]) : a
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    if (to < 1 || from > max) continue
    const seg = { book, fromChapter: Math.max(1, from), toChapter: Math.min(max, to) }
    const key = `${seg.book}:${seg.fromChapter}-${seg.toChapter}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(seg)
  }
  return out
}

function canonicalBook(name: string): string | null {
  const lower = name.trim().toLowerCase()
  return BIBLE_BOOKS_EN.find(b => b.toLowerCase() === lower) ?? null
}

/** "Sáng Thế Ký 27–28, Thi Thiên 7" — tên sách theo ngôn ngữ đang dùng. */
export function formatPassage(segments: PassageSegment[], bookName: (book: string) => string): string {
  return segments
    .map(s => `${bookName(s.book)} ${s.fromChapter === s.toChapter ? s.fromChapter : `${s.fromChapter}–${s.toChapter}`}`)
    .join(', ')
}
