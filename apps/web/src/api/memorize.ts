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

export interface PassageVerse {
  verse: number
  text: string
}

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
