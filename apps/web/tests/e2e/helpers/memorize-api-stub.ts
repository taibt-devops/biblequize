/**
 * Stateful stub for the Memorize API (SPEC_USER §27.20) used by W-M19 happy-path.
 *
 * The E2E database has no Bible text yet (bible_verses import is gated on the
 * BTTHD 2011 source file), so these flows stub `/api/me/memory-verses*` and
 * `/api/bible/passage`. Verse text is synthetic ("v16a v16b ...") — never real
 * scripture — which also makes exercise answers predictable.
 */

import type { Page, Route } from '@playwright/test'

export interface StubVerse {
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

/** Six tokens per verse: v16a v16b v16c v16d v16e v16f. */
export function fakeVerseText(verse: number): string {
  return ['a', 'b', 'c', 'd', 'e', 'f'].map(s => `v${verse}${s}`).join(' ')
}

export function fakeRangeText(from: number, to: number): string {
  const parts: string[] = []
  for (let v = from; v <= to; v++) parts.push(fakeVerseText(v))
  return parts.join(' ')
}

export class MemorizeApiStub {
  verses: StubVerse[] = []
  reviews: { id: string; exerciseType: string; passed: boolean }[] = []
  passageStatus = 200
  private seq = 0

  addVerse(partial: Partial<StubVerse> & Pick<StubVerse, 'book' | 'chapter' | 'verseStart' | 'verseEnd'>): StubVerse {
    const verse: StubVerse = {
      id: partial.id ?? `stub-${++this.seq}`,
      text: fakeRangeText(partial.verseStart, partial.verseEnd),
      masteryLevel: 0,
      nextReviewAt: new Date(Date.now() - 60_000).toISOString(),
      due: true,
      ...partial,
    }
    this.verses.push(verse)
    return verse
  }

  async install(page: Page): Promise<void> {
    await page.route(/\/api\/(me\/memory-verses|bible\/passage)/, route => this.handle(route))
  }

  private json(route: Route, status: number, body?: unknown) {
    return route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) })
  }

  private async handle(route: Route) {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^.*\/api\//, '/api/')
    const method = req.method()

    if (path === '/api/bible/passage') {
      if (this.passageStatus !== 200) return this.json(route, this.passageStatus, { success: false, message: 'stub' })
      const from = Number(url.searchParams.get('from'))
      const to = Number(url.searchParams.get('to'))
      const verses = []
      for (let v = Math.max(1, from); v <= to; v++) verses.push({ verse: v, text: fakeVerseText(v) })
      return this.json(route, 200, {
        version: 'BTT1926', book: url.searchParams.get('book'), chapter: Number(url.searchParams.get('chapter')), verses,
      })
    }

    const due = () => this.verses.filter(v => v.due)
    if (path === '/api/me/memory-verses/due-count') return this.json(route, 200, { dueCount: due().length })
    if (path === '/api/me/memory-verses/due') return this.json(route, 200, { items: due().slice(0, 10) })
    if (path === '/api/me/memory-verses' && method === 'GET') {
      return this.json(route, 200, { items: this.verses, dueCount: due().length })
    }
    if (path === '/api/me/memory-verses' && method === 'POST') {
      const body = req.postDataJSON() as Pick<StubVerse, 'book' | 'chapter' | 'verseStart' | 'verseEnd'>
      const exists = this.verses.some(v => v.book === body.book && v.chapter === body.chapter
        && v.verseStart === body.verseStart && v.verseEnd === body.verseEnd)
      if (exists) return this.json(route, 409, { success: false, message: 'Đoạn này đã có trong danh sách' })
      return this.json(route, 201, this.addVerse(body))
    }

    const review = path.match(/^\/api\/me\/memory-verses\/([^/]+)\/review$/)
    if (review && method === 'POST') {
      const body = req.postDataJSON() as { exerciseType: string; passed: boolean }
      this.reviews.push({ id: review[1], ...body })
      const verse = this.verses.find(v => v.id === review[1])!
      verse.masteryLevel = body.passed ? Math.min(5, verse.masteryLevel + 1) : Math.max(0, verse.masteryLevel - 1)
      verse.due = !body.passed
      return this.json(route, 200, verse)
    }

    const del = path.match(/^\/api\/me\/memory-verses\/([^/]+)$/)
    if (del && method === 'DELETE') {
      this.verses = this.verses.filter(v => v.id !== del[1])
      return route.fulfill({ status: 204 })
    }
    return route.continue()
  }
}
