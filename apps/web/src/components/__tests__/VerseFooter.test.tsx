import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import VerseFooter from '../VerseFooter'

describe('VerseFooter (HR-8)', () => {
  it('renders verse text in Cormorant Garamond italic (font-verse class)', () => {
    render(
      <VerseFooter
        verse={{ text: 'Test verse content', ref: 'Test 1:1' }}
      />
    )
    const text = screen.getByTestId('verse-footer-text')
    expect(text).toHaveTextContent('Test verse content')
    expect(text.className).toContain('font-verse')
    expect(text.className).toContain('italic')
  })

  it('does NOT apply the .hr-verse-text drop-cap class (removed 2026-05-20 — broke center alignment)', () => {
    render(
      <VerseFooter
        verse={{ text: 'Khởi đầu là Lời', ref: 'Giăng 1:1' }}
      />
    )
    expect(screen.getByTestId('verse-footer-text').className).not.toContain('hr-verse-text')
  })

  it('cite renders reference + default BTTHĐ 2011 source with em-dashes', () => {
    render(
      <VerseFooter
        verse={{ text: 'x', ref: 'Hê-bơ-rơ 13:5' }}
      />
    )
    const cite = screen.getByTestId('verse-footer-cite')
    expect(cite).toHaveTextContent('Hê-bơ-rơ 13:5')
    expect(cite).toHaveTextContent('BTTHĐ 2011')
    expect(cite.className).not.toContain('uppercase')
  })

  it('cite contains em-dashes', () => {
    render(<VerseFooter verse={{ text: 'x', ref: 'Test 1:1' }} />)
    const cite = screen.getByTestId('verse-footer-cite')
    expect(cite.textContent).toMatch(/—/)
  })

  it('falls back to getDailyVerse() when no verse prop is provided', () => {
    render(<VerseFooter />)
    const text = screen.getByTestId('verse-footer-text')
    // Daily verse is deterministic from data/verses.ts; just verify
    // some content rendered.
    expect(text.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  it('renders ornament SVG between the two divider lines', () => {
    render(<VerseFooter verse={{ text: 'x', ref: 'Test 1:1' }} />)
    const ornament = screen.getByTestId('verse-footer-ornament')
    expect(ornament.querySelector('svg')).not.toBeNull()
  })
})
