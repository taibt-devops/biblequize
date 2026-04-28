import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import EmptyLeaderboardCTA from '../EmptyLeaderboardCTA'

function renderCTA() {
  return render(
    <MemoryRouter>
      <EmptyLeaderboardCTA />
    </MemoryRouter>,
  )
}

describe('EmptyLeaderboardCTA', () => {
  beforeEach(() => {
    i18n.changeLanguage('vi')
  })

  it('renders title + body + CTA copy from i18n', () => {
    renderCTA()
    expect(screen.getByTestId('empty-leaderboard-cta')).toBeInTheDocument()
    expect(screen.getByText('Bạn chưa có trên bảng xếp hạng')).toBeInTheDocument()
    expect(screen.getByText('Chơi 5 câu để bắt đầu xuất hiện')).toBeInTheDocument()
  })

  it('CTA button is a Link to /practice', () => {
    renderCTA()
    const cta = screen.getByTestId('empty-leaderboard-cta-button')
    expect(cta.tagName).toBe('A')
    expect(cta.getAttribute('href')).toBe('/practice')
  })
})
