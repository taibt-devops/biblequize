import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import DailyVerseBanner from '../DailyVerseBanner'

describe('DailyVerseBanner', () => {
  it('renders the home-daily-verse section with text + reference', () => {
    render(<DailyVerseBanner />)
    const section = screen.getByTestId('home-daily-verse')
    expect(section).toBeInTheDocument()
    // Verse text wraps in curly quotes; reference is uppercase tracked.
    expect(screen.getByTestId('home-daily-verse-text').textContent?.length).toBeGreaterThan(10)
    expect(screen.getByTestId('home-daily-verse-ref').textContent?.length).toBeGreaterThan(0)
  })

  it('reference begins with the em-dash separator (mockup style)', () => {
    // H8 dropped the ornamental ✦ divider in favour of a minimal,
    // typography-only footer (mockup line 308-311). Reference is
    // prefixed with "— " so eyes can scan from quote → attribution.
    render(<DailyVerseBanner />)
    const ref = screen.getByTestId('home-daily-verse-ref').textContent ?? ''
    expect(ref.startsWith('—')).toBe(true)
  })

  it('verse text uses italic serif typography', () => {
    render(<DailyVerseBanner />)
    const text = screen.getByTestId('home-daily-verse-text')
    // Tailwind utility classes are still on the element in JSDOM —
    // assert the design-token contract (italic serif font) didn't drift.
    expect(text.className).toContain('italic')
    expect(text.className).toContain('font-serif')
  })
})
