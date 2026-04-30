import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.fn(() => ({ user: { name: 'Test', email: 't@t.com', currentStreak: 0 } }))
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}))

import StreakWidget from '../StreakWidget'

describe('StreakWidget', () => {
  function setStreak(streak: number | undefined) {
    mockUseAuth.mockReturnValue({
      user: streak === undefined ? null as any : { name: 'Test', email: 't@t.com', currentStreak: streak },
    })
  }

  it('streak = 0 → "Bắt đầu streak hôm nay!" caption', () => {
    setStreak(0)
    render(<StreakWidget />)
    expect(screen.getByTestId('streak-widget-count').textContent).toBe('0')
    expect(screen.getByTestId('streak-widget-caption')).toHaveTextContent('Bắt đầu streak hôm nay!')
  })

  it('streak = 5 (mid-range) → "Đừng dừng — chơi tiếp!" caption', () => {
    setStreak(5)
    render(<StreakWidget />)
    expect(screen.getByTestId('streak-widget-count').textContent).toBe('5')
    expect(screen.getByTestId('streak-widget-caption')).toHaveTextContent('Đừng dừng — chơi tiếp!')
  })

  it('streak = 7 (boundary, exactly threshold) → "Wow, 7 ngày! 🎉" caption', () => {
    // Boundary case — guards against off-by-one between < 7 vs ≤ 6.
    setStreak(7)
    render(<StreakWidget />)
    expect(screen.getByTestId('streak-widget-count').textContent).toBe('7')
    expect(screen.getByTestId('streak-widget-caption')).toHaveTextContent('Wow, 7 ngày! 🎉')
  })

  it('streak = 30 (well past threshold) → "Wow, 30 ngày! 🎉" caption', () => {
    setStreak(30)
    render(<StreakWidget />)
    expect(screen.getByTestId('streak-widget-count').textContent).toBe('30')
    expect(screen.getByTestId('streak-widget-caption')).toHaveTextContent('Wow, 30 ngày! 🎉')
  })

  it('user = null (logged out) → fallback streak = 0, no crash', () => {
    setStreak(undefined) // sets user to null
    expect(() => render(<StreakWidget />)).not.toThrow()
    expect(screen.getByTestId('streak-widget-count').textContent).toBe('0')
    expect(screen.getByTestId('streak-widget-caption')).toHaveTextContent('Bắt đầu streak hôm nay!')
  })
})
