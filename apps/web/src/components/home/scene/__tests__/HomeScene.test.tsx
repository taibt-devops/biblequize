import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeScene, { type HomeSceneProps } from '../HomeScene'
import { getDailyVerse } from '../../../../data/verses'

const base: HomeSceneProps = {
  greeting: 'Chào buổi sáng',
  userName: 'Tai Thanh',
  tierId: 2,
  tierLabel: 'Người Tìm Kiếm',
  nextTierLabel: 'Môn Đồ',
  progressPct: 32,
  points: 1590,
  nextMinPoints: 5000,
  pointsToNext: 3410,
  isNewUser: false,
  daily: { done: false, questionCount: 5, correct: 0, total: 5 },
  quests: [
    { description: 'Chơi 1 ván bất kỳ', progress: 1, target: 1, completed: true },
    { description: 'Trả lời đúng 5 câu khó', progress: 1, target: 5 },
    { description: 'Đạt 60+ điểm Đấu Hạng', progress: 0, target: 1 },
  ],
  journey: { book: 'Xuất Ê-díp-tô Ký', pct: 42 },
  rank: { rank: 14, points: 1020 },
  season: { name: 'Mùa Cảm Tạ', daysLeft: 24 },
  verseDue: 0,
}

const renderScene = (over: Partial<HomeSceneProps> = {}) =>
  render(<MemoryRouter><HomeScene {...base} {...over} /></MemoryRouter>)

afterEach(() => vi.useRealTimers())

describe('HomeScene (Lu Khach v4)', () => {
  it('paints the crossroads for the hour: day, sunset, night', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const [hour, file] of [[10, 'bq-home-bare.webp'], [18, 'bq-home-bare-sunset.webp'], [21, 'bq-home-bare-night.webp']] as const) {
      vi.setSystemTime(new Date(2026, 9, 8, hour))
      const { unmount } = renderScene()
      expect(screen.getByAltText(/Ngã ba làng quê/).getAttribute('src')).toContain(file)
      unmount()
    }
  })

  it('hangs the four ways to play on the signpost', () => {
    renderScene()
    expect(screen.getByTestId('home-mode-study')).toHaveAttribute('href', '/practice')
    expect(screen.getByTestId('home-mode-ranked')).toHaveAttribute('href', '/ranked')
    expect(screen.getByTestId('home-mode-rooms')).toHaveAttribute('href', '/multiplayer')
    expect(screen.getByTestId('home-mode-journey')).toHaveAttribute('href', '/journey')
  })

  it('the traveller says where a sign leads while it is hovered', () => {
    renderScene()
    expect(screen.getByText('Ồ, có thư cho mình kìa!')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByTestId('home-mode-ranked'))
    expect(screen.getByText('Đi Đấu Hạng nhé?')).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByTestId('home-mode-ranked'))
    expect(screen.getByText('Ồ, có thư cho mình kìa!')).toBeInTheDocument()
  })

  it('a lantern opens the quest list; Escape closes it', () => {
    renderScene()
    const lanterns = within(screen.getByTestId('home-daily-missions')).getAllByRole('button')
    expect(lanterns).toHaveLength(3)
    expect(lanterns[1]).toHaveAccessibleName('Trả lời đúng 5 câu khó: 1/5')
    fireEvent.click(lanterns[1])
    const dialog = screen.getByRole('dialog', { name: 'Nhiệm vụ hôm nay' })
    expect(dialog).toHaveTextContent('1/3 đèn đã thắp')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('the verse medal opens today\'s verse, with the due review when there is one', () => {
    renderScene({ verseDue: 2 })
    expect(screen.getByTestId('home-memory-due-card')).toHaveTextContent('2')
    fireEvent.click(screen.getByTestId('home-verse'))
    const dialog = screen.getByRole('dialog', { name: 'Câu gốc hôm nay' })
    expect(dialog).toHaveTextContent(getDailyVerse().text)
    expect(screen.getByTestId('home-memory-due-btn')).toHaveAttribute('href', '/practice/memorize/session')
  })

  it('once the challenge is done the dove rests on the post and the letter button goes away', () => {
    renderScene({ daily: { done: true, questionCount: 5, correct: 4, total: 5 } })
    const cta = screen.getByTestId('featured-daily-cta')
    expect(cta).toHaveAttribute('href', '/daily')
    expect(cta).toHaveTextContent('Xem lại')
    expect(cta).toHaveTextContent('4/5')
    expect(screen.queryByText('Mở thư hôm nay')).not.toBeInTheDocument()
    expect(screen.getByText('Hôm nay đi lối nào đây?')).toBeInTheDocument()
  })

  it('a brand-new player gets the tutorial hand and a hint instead of the letter button', () => {
    renderScene({ isNewUser: true })
    expect(screen.getByTestId('home-start-here')).toBeInTheDocument()
    expect(screen.getByText('Lần đầu à? Chạm vào một tấm biển gỗ để lên đường nhé!')).toBeInTheDocument()
    expect(screen.queryByText('Mở thư hôm nay')).not.toBeInTheDocument()
  })

  it('HUD badges: journey %, weekly rank, season days; no rank badge when the board is sparse', () => {
    const { unmount } = renderScene()
    expect(screen.getByRole('link', { name: /Hành trình/ })).toHaveTextContent('42%')
    expect(screen.getByTestId('home-weekly-leaderboard')).toHaveTextContent('#14')
    expect(screen.getByRole('link', { name: /^Mùa/ })).toHaveTextContent('24 ngày')
    unmount()
    renderScene({ rank: null, season: null })
    expect(screen.getByTestId('home-weekly-leaderboard')).not.toHaveTextContent('#')
    expect(screen.getByRole('link', { name: /^Mùa/ })).not.toHaveTextContent('ngày')
  })
})
