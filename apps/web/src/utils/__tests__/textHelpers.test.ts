import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { wrapProperNouns, formatVerseRef } from '../textHelpers'

/**
 * Render the result of wrapProperNouns into a fragment so we can run
 * DOM queries against it.
 */
function renderNouns(text: string) {
  return render(React.createElement(React.Fragment, null, wrapProperNouns(text)))
}

describe('wrapProperNouns', () => {
  describe('Hyphen-compound Bible names get wrapped', () => {
    it('wraps a 3-segment name like "Bên-gia-min"', () => {
      const { container } = renderNouns('Bên-gia-min')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Bên-gia-min')
    })

    it('wraps a 2-segment name like "Ra-chên"', () => {
      const { container } = renderNouns('Ra-chên')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Ra-chên')
    })

    it('wraps a name with diacritic capital like "Ép-ra-ta"', () => {
      const { container } = renderNouns('Ép-ra-ta')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Ép-ra-ta')
    })

    it('wraps multiple names in one sentence', () => {
      const { container } = renderNouns('Bà Ra-chên gặp Bên-gia-min ở Bết-lê-hem')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(3)
      expect(Array.from(spans).map(s => s.textContent)).toEqual([
        'Ra-chên',
        'Bên-gia-min',
        'Bết-lê-hem',
      ])
    })
  })

  describe('Strings that should NOT be wrapped', () => {
    it('leaves plain prose alone', () => {
      const { container } = renderNouns('Theo lời tiên tri của Đa-vít')
      // "Đa-vít" IS a hyphen-compound — we expect 1 wrap, not 0.
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Đa-vít')
    })

    it('does NOT wrap verse references with hyphenated numbers', () => {
      // "35:16-20" is digits, not letters → no wrap.
      const { container } = renderNouns('Theo Sáng 35:16-20')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(0)
      // Full text preserved
      expect(container.textContent).toBe('Theo Sáng 35:16-20')
    })

    it('does NOT wrap acronym-style hyphens like "T-shirt"', () => {
      // "T-shirt" — capital T then directly hyphen, no lowercase letters
      // between → fails the `[lowercase]+` part of the regex.
      const { container } = renderNouns('Wearing a T-shirt today')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(0)
    })

    it('does NOT wrap lowercase-start hyphenations like "ad-hoc"', () => {
      const { container } = renderNouns('An ad-hoc decision')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(0)
    })

    it('handles empty string by returning []', () => {
      expect(wrapProperNouns('')).toEqual([])
    })
  })

  describe('Edge cases', () => {
    it('preserves the full text when wrapping multiple nouns', () => {
      const input = 'Bà Ra-chên gặp Bên-gia-min'
      const { container } = renderNouns(input)
      // Concatenated text content must equal the original input.
      expect(container.textContent).toBe(input)
    })

    it('returns the proper noun as the first node when text starts with one', () => {
      // No leading text; the regex still splits and the first array
      // element is an empty string (renders as nothing) followed by the span.
      const { container } = renderNouns('Bên-gia-min là con trai cuối')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Bên-gia-min')
      expect(container.textContent).toBe('Bên-gia-min là con trai cuối')
    })

    it('handles a text ending with a proper noun', () => {
      const { container } = renderNouns('con trai cuối là Bên-gia-min')
      const spans = container.querySelectorAll('span.whitespace-nowrap')
      expect(spans).toHaveLength(1)
      expect(spans[0].textContent).toBe('Bên-gia-min')
    })
  })
})

describe('formatVerseRef', () => {
  it('book + chapter + verse range → full reference', () => {
    expect(formatVerseRef({
      book: 'Sáng Thế Ký', chapter: 35, verseStart: 16, verseEnd: 20,
    })).toBe('SÁNG THẾ KÝ 35:16-20')
  })

  it('book + chapter + single verse', () => {
    expect(formatVerseRef({
      book: 'Genesis', chapter: 1, verseStart: 1,
    })).toBe('GENESIS 1:1')
  })

  it('book + chapter, no verse', () => {
    expect(formatVerseRef({ book: 'Mác', chapter: 3 })).toBe('MÁC 3')
  })

  it('book only', () => {
    expect(formatVerseRef({ book: 'Ru-tơ' })).toBe('RU-TƠ')
  })

  it('verseStart === verseEnd is rendered as single verse (no "16-16")', () => {
    expect(formatVerseRef({
      book: 'Mác', chapter: 1, verseStart: 16, verseEnd: 16,
    })).toBe('MÁC 1:16')
  })

  it('verseEnd present without verseStart is treated as no-verse', () => {
    // Defensive: verseEnd alone is meaningless, drop it.
    expect(formatVerseRef({
      book: 'Mác', chapter: 5, verseEnd: 10,
    })).toBe('MÁC 5')
  })
})
