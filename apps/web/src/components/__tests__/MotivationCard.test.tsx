import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'

import MotivationCard from '../MotivationCard'

function renderCard() {
  return render(
    <MemoryRouter>
      <MotivationCard />
    </MemoryRouter>
  )
}

describe('MotivationCard', () => {
  beforeEach(() => {
    i18n.changeLanguage('vi')
  })

  it('renders the card container', () => {
    renderCard()
    expect(screen.getByTestId('motivation-card')).toBeInTheDocument()
  })

  it('renders the tips icon', () => {
    renderCard()
    const icon = screen.getByTestId('motivation-card-icon')
    expect(icon).toBeInTheDocument()
    expect(icon.textContent).toContain('tips_and_updates')
  })

  it('renders the step badge "Bước 1"', () => {
    renderCard()
    expect(screen.getByTestId('motivation-card-step').textContent).toBe('Bước 1')
  })

  it('renders the localized title', () => {
    renderCard()
    expect(screen.getByTestId('motivation-card-title').textContent).toContain(
      'Hoàn thành thử thách hôm nay',
    )
  })

  it('renders the description', () => {
    renderCard()
    expect(screen.getByTestId('motivation-card-desc').textContent).toMatch(/Daily Challenge|Nhiệm vụ/)
  })

  it('renders CTA linking to /daily', () => {
    renderCard()
    const cta = screen.getByTestId('motivation-card-cta')
    expect(cta).toBeInTheDocument()
    expect(cta.getAttribute('href')).toBe('/daily')
  })

  it('CTA contains "Bắt đầu" label', () => {
    renderCard()
    expect(screen.getByTestId('motivation-card-cta').textContent).toContain('Bắt đầu')
  })

  it('switches to English copy when i18n language is en', () => {
    i18n.changeLanguage('en')
    renderCard()
    expect(screen.getByTestId('motivation-card-step').textContent).toBe('Step 1')
    expect(screen.getByTestId('motivation-card-title').textContent).toContain("Complete today's challenge")
    expect(screen.getByTestId('motivation-card-cta').textContent).toContain('Start')
  })

  it('CTA is a link element (a tag, not a button)', () => {
    renderCard()
    const cta = screen.getByTestId('motivation-card-cta')
    expect(cta.tagName).toBe('A')
  })
})
