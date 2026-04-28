import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import ActivityFeed from '../ActivityFeed'

function renderFeed(props: { userCreatedAt?: string } = {}) {
  return render(
    <MemoryRouter>
      <ActivityFeed {...props} />
    </MemoryRouter>,
  )
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    i18n.changeLanguage('vi')
  })

  it('renders empty-state pioneer card with invite CTA to /groups', () => {
    renderFeed()
    expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument()
    expect(screen.getByText('Bạn là người tiên phong!')).toBeInTheDocument()
    const cta = screen.getByTestId('activity-empty-cta')
    expect(cta.tagName).toBe('A')
    expect(cta.getAttribute('href')).toBe('/groups')
  })

  it('shows the launch-week welcome banner when userCreatedAt is undefined', () => {
    // v1 default: when /api/me does not yet expose createdAt, every user
    // is treated as new — correct behavior for launch week.
    renderFeed()
    expect(screen.getByTestId('activity-system-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('activity-system-welcome').textContent)
      .toContain('Chào mừng đến BibleQuiz')
  })

  it('hides the welcome banner once the user is older than 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    renderFeed({ userCreatedAt: eightDaysAgo })
    expect(screen.queryByTestId('activity-system-welcome')).not.toBeInTheDocument()
    // Empty state still renders — feed remains backend-less in v1.
    expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument()
  })
})
