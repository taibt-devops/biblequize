import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '../../i18n'

import DailyVerseBanner from '../DailyVerseBanner'

beforeAll(() => {
  i18n.changeLanguage('vi')
})

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

  it('verse text uses italic typography', () => {
    render(<DailyVerseBanner />)
    const text = screen.getByTestId('home-daily-verse-text')
    // HR-5: serif dropped (mockup `.verse-text` is italic Be Vietnam Pro,
    // not Georgia). Italic + leading-relaxed is the new design contract.
    expect(text.className).toContain('italic')
  })

  // ── HR-5: glass-card upgrade ──────────────────────────────────

  it('renders the card title header (HR-5 glass-card)', () => {
    render(<DailyVerseBanner />)
    // i18n key used; assert via testid since text may be the raw key
    // when i18n hasn't fully resolved in isolated unit tests.
    expect(screen.getByTestId('home-daily-verse-title')).toBeInTheDocument()
  })
})
