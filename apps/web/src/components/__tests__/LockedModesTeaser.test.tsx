import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import LockedModesTeaser from '../LockedModesTeaser'

function renderTeaser(props: { userTier: number; totalPoints: number }) {
  return render(
    <MemoryRouter>
      <LockedModesTeaser {...props} />
    </MemoryRouter>,
  )
}

describe('LockedModesTeaser', () => {
  beforeEach(() => {
    i18n.changeLanguage('vi')
  })

  it('renders all 5 locked mode names with lock overlays', () => {
    renderTeaser({ userTier: 1, totalPoints: 0 })
    // 5 mode names visible
    expect(screen.getByText('Thi Đấu Xếp Hạng')).toBeInTheDocument()
    expect(screen.getByText('Mystery Mode')).toBeInTheDocument()
    expect(screen.getByText('Speed Round')).toBeInTheDocument()
    expect(screen.getByText('Giải Đấu')).toBeInTheDocument()
    expect(screen.getByText('Phòng Chơi')).toBeInTheDocument()
    // Lock overlays present (one per mode)
    expect(screen.getByTestId('locked-mode-overlay-ranked')).toBeInTheDocument()
    expect(screen.getByTestId('locked-mode-overlay-mystery')).toBeInTheDocument()
    expect(screen.getByTestId('locked-mode-overlay-speed')).toBeInTheDocument()
    expect(screen.getByTestId('locked-mode-overlay-tournament')).toBeInTheDocument()
    expect(screen.getByTestId('locked-mode-overlay-multiplayer')).toBeInTheDocument()
  })

  it('applies blur(4px) to mode icons but keeps mode names sharp', () => {
    renderTeaser({ userTier: 1, totalPoints: 0 })
    const cell = screen.getByTestId('locked-mode-ranked')
    // Find the blurred icon span inside the cell
    const blurred = cell.querySelector('[style*="blur"]') as HTMLElement | null
    expect(blurred).not.toBeNull()
    expect(blurred!.style.filter).toContain('blur(4px)')
    // Mode name (text node "Thi Đấu Xếp Hạng") must be readable, no blur applied
    const nameEl = cell.querySelector('p')
    expect(nameEl).not.toBeNull()
    expect((nameEl as HTMLElement).style.filter).toBe('')
  })

  it('progress bar width matches XP gap from current to next tier', () => {
    // Tier 1 = 0..999 XP. At 250 XP, progressPct = round(250/1000 * 100) = 25
    renderTeaser({ userTier: 1, totalPoints: 250 })
    const bar = screen.getByTestId('locked-teaser-progress-bar') as HTMLElement
    expect(bar.style.width).toBe('25%')
    // Label shows "250 / 1,000 XP đến Người Tìm Kiếm"
    const label = screen.getByTestId('locked-teaser-progress-label')
    expect(label.textContent).toContain('250')
    expect(label.textContent).toContain('1,000')
    expect(label.textContent).toContain('Người Tìm Kiếm')
  })

  it('whole card is a link to /help#tiers', () => {
    renderTeaser({ userTier: 1, totalPoints: 0 })
    const card = screen.getByTestId('locked-modes-teaser')
    expect(card.tagName).toBe('A')
    expect(card.getAttribute('href')).toBe('/help#tiers')
  })

  it('returns null (renders nothing) when userTier >= 5', () => {
    const { container } = renderTeaser({ userTier: 5, totalPoints: 50_000 })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('locked-modes-teaser')).not.toBeInTheDocument()
  })
})
