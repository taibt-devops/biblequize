import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import TierPerksTeaser from '../TierPerksTeaser'

function renderTeaser(props: { userTier: number; totalPoints: number }) {
  return render(
    <MemoryRouter>
      <TierPerksTeaser {...props} />
    </MemoryRouter>,
  )
}

describe('TierPerksTeaser', () => {
  beforeEach(() => {
    i18n.changeLanguage('vi')
  })

  it('renders perks of tier 2 when userTier=1 (next-tier preview)', () => {
    renderTeaser({ userTier: 1, totalPoints: 250 })
    expect(screen.getByTestId('tier-perks-teaser')).toBeInTheDocument()
    // T2 perks per data file: +10% XP + 22 energy/h
    expect(screen.getByTestId('tier-perk-xpBoost')).toBeInTheDocument()
    expect(screen.getByText(/\+10% XP/)).toBeInTheDocument()
    expect(screen.getByTestId('tier-perk-energyRegen')).toBeInTheDocument()
    expect(screen.getByText(/22 năng lượng/)).toBeInTheDocument()
    // Subtitle interpolates next tier name + threshold XP. The "1,000 XP"
    // string also appears in the progress-bar label below, so just assert
    // the tier name to disambiguate.
    expect(screen.getByText(/Người Tìm Kiếm/)).toBeInTheDocument()
    expect(screen.getAllByText(/1,000 XP/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders perks of tier 6 (max) when userTier=5', () => {
    renderTeaser({ userTier: 5, totalPoints: 60_000 })
    // T6 perks: ×2 XP max + 35 energy/h
    expect(screen.getByTestId('tier-perk-xpBoostMax')).toBeInTheDocument()
    expect(screen.getByText(/×2 XP/)).toBeInTheDocument()
    expect(screen.getByText(/35 năng lượng/)).toBeInTheDocument()
    // Streak freeze NOT in T6 perks (no upgrade past 3/week)
    expect(screen.queryByTestId('tier-perk-streakFreeze')).not.toBeInTheDocument()
  })

  it('returns null when userTier=6 (no next tier to preview)', () => {
    const { container } = renderTeaser({ userTier: 6, totalPoints: 150_000 })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('tier-perks-teaser')).not.toBeInTheDocument()
  })

  it('whole card is a link to /help#tiers', () => {
    renderTeaser({ userTier: 1, totalPoints: 0 })
    const card = screen.getByTestId('tier-perks-teaser')
    expect(card.tagName).toBe('A')
    expect(card.getAttribute('href')).toBe('/help#tiers')
  })

  it('progress bar width matches XP gap to next tier', () => {
    // Tier 1 = 0..999 XP. At 250 XP, progressPct = round(250/1000 * 100) = 25
    renderTeaser({ userTier: 1, totalPoints: 250 })
    const bar = screen.getByTestId('tier-perks-progress-bar') as HTMLElement
    expect(bar.style.width).toBe('25%')
  })
})
