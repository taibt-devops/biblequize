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

  it('renders the ornamental ✦ divider', () => {
    render(<DailyVerseBanner />)
    expect(screen.getByText('✦')).toBeInTheDocument()
    // Two divider lines flanking the ornament.
    expect(document.querySelectorAll('.daily-verse-v3-divider-line')).toHaveLength(2)
  })

  it('uses the V3 namespaced classes (verifies CSS hookup)', () => {
    render(<DailyVerseBanner />)
    expect(document.querySelector('.daily-verse-v3')).toBeInTheDocument()
    expect(document.querySelector('.daily-verse-v3-text')).toBeInTheDocument()
    expect(document.querySelector('.daily-verse-v3-ref')).toBeInTheDocument()
  })
})
