// Memorize mode ("Hoc Thuoc") — API adapter (SPEC_USER §5.1.1, §27.20).

import { api } from './client'

export interface MemoryVerse {
  id: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  text: string
  masteryLevel: number
  nextReviewAt: string
  due: boolean
}

/** One verse, or a block the translation prints as one ("17-18": verse 17, verseEnd 18). */
export interface VerseNumber {
  verse: number
  verseEnd?: number | null
}

export interface PassageVerse extends VerseNumber {
  text: string
}

/** Last verse a row covers. */
export const lastVerse = (v: VerseNumber): number => v.verseEnd ?? v.verse

/** "17" or "17-18". */
export const verseLabel = (v: VerseNumber): string =>
  v.verseEnd && v.verseEnd !== v.verse ? `${v.verse}-${v.verseEnd}` : String(v.verse)

export interface Passage {
  version: string
  book: string
  chapter: number
  verses: PassageVerse[]
}

export interface MemoryVerseRef {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
}

export type ExerciseType = 'order' | 'cloze'

const BASE = '/api/me/memory-verses'

export async function listMemoryVerses(): Promise<{ items: MemoryVerse[]; dueCount: number }> {
  const res = await api.get(BASE)
  return res.data
}

export async function listDueMemoryVerses(): Promise<MemoryVerse[]> {
  const res = await api.get(`${BASE}/due`)
  return res.data.items
}

export async function getMemoryDueCount(): Promise<number> {
  const res = await api.get(`${BASE}/due-count`)
  return res.data.dueCount
}

export async function addMemoryVerse(ref: MemoryVerseRef): Promise<MemoryVerse> {
  const res = await api.post(BASE, ref)
  return res.data
}

export async function deleteMemoryVerse(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function reviewMemoryVerse(
  id: string, body: { exerciseType: ExerciseType; passed: boolean },
): Promise<MemoryVerse> {
  const res = await api.post(`${BASE}/${id}/review`, body)
  return res.data
}

export async function getPassage(book: string, chapter: number, from: number, to: number): Promise<Passage> {
  const res = await api.get('/api/bible/passage', { params: { book, chapter, from, to } })
  return res.data
}

/** Verses (and merged blocks) of a chapter, numbered as the active translation prints them. */
export async function getChapterVerses(book: string, chapter: number): Promise<VerseNumber[]> {
  const res = await api.get('/api/bible/verses', { params: { book, chapter } })
  return res.data
}

/** Public: whether Bible text is imported — gates the Memorize entry point. */
export async function getBibleStatus(): Promise<{ version: string; available: boolean }> {
  const res = await api.get('/api/public/bible/status')
  return res.data
}
