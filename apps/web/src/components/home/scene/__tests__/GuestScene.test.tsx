import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

let nativeApp = false
vi.mock('../../../../platform/capacitor', () => ({ isCapacitor: () => nativeApp }))

import GuestScene, { GUEST_LOCKED } from '../GuestScene'

const renderScene = () => render(<MemoryRouter><GuestScene /></MemoryRouter>)

// jsdom's location cannot be assigned, so swap it for a writable stand-in per test.
const realLocation = window.location
beforeEach(() => {
  vi.clearAllMocks()
  nativeApp = false
  Object.defineProperty(window, 'location', { configurable: true, value: { href: 'https://forbible.org/' } })
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

describe('GuestScene: the crossroads for visitors', () => {
  it('opens with one headline, a short intro and the way in', () => {
    renderScene()
    const card = screen.getByTestId('guest-welcome')
    expect(within(card).getByRole('heading', { level: 1 })).toHaveTextContent('Trắc nghiệm Kinh Thánh, chơi như một chuyến phiêu lưu')
    expect(card).toHaveTextContent('Mỗi ngày chim bồ câu mang tới 5 câu hỏi.')
    expect(within(card).getByTestId('guest-google')).toHaveTextContent('Tiếp tục với Google')
    expect(within(card).getByTestId('guest-try')).toHaveAttribute('href', '/daily')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('Google goes straight to the OAuth2 flow on the web', () => {
    renderScene()
    fireEvent.click(screen.getByTestId('guest-google'))
    expect(window.location.href).toBe('/oauth2/authorization/google')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('the mobile app signs in natively on /login instead', () => {
    nativeApp = true
    renderScene()
    fireEvent.click(screen.getByTestId('guest-google'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
    expect(window.location.href).toBe('https://forbible.org/')
  })

  it('Practice stays open; Ranked, Rooms and Journey carry a padlock', () => {
    renderScene()
    const practice = screen.getByTestId('home-mode-study')
    expect(practice).toHaveAttribute('href', '/practice')
    expect(practice).not.toHaveAttribute('data-locked')
    for (const mode of GUEST_LOCKED) {
      const board = screen.getByTestId(`home-mode-${mode}`)
      expect(board).toHaveAttribute('data-locked', 'true')
      expect(within(board).getByTestId('sign-lock')).toBeInTheDocument()
    }
    // Links stay real for crawlers and new tabs.
    expect(screen.getByTestId('home-mode-ranked')).toHaveAttribute('href', '/ranked')
    expect(screen.getByTestId('home-mode-ranked')).toHaveAccessibleName('Đấu Hạng (cần đăng nhập)')
  })

  it('a locked board opens the sign-in card instead of leaving the page', () => {
    renderScene()
    expect(screen.queryByTestId('guest-gate')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('home-mode-ranked'))
    const gate = screen.getByTestId('guest-gate')
    expect(gate).toHaveAttribute('data-reason', 'ranked')
    expect(gate).toHaveTextContent('Đăng nhập để lưu điểm, lên bậc')
    expect(screen.getByTestId('guest-gate-google')).toBeInTheDocument()
    expect(screen.getByTestId('guest-gate-email')).toHaveAttribute('href', '/login')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByTestId('guest-gate')).not.toBeInTheDocument()
  })

  it('each locked board says what an account adds', () => {
    renderScene()
    for (const [mode, text] of [['rooms', 'mở phòng và thi cùng bạn bè'], ['journey', 'sưu tầm đủ 66 sách']] as const) {
      fireEvent.click(screen.getByTestId(`home-mode-${mode}`))
      expect(screen.getByTestId('guest-gate')).toHaveTextContent(text)
      fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    }
  })

  it('the quest lanterns are dark and ask to sign in', () => {
    renderScene()
    const lanterns = within(screen.getByTestId('home-daily-missions')).getAllByRole('button')
    expect(lanterns).toHaveLength(3)
    expect(lanterns[0]).toHaveAccessibleName('Nhiệm vụ mỗi ngày: đăng nhập để thắp đèn')
    fireEvent.click(lanterns[0])
    expect(screen.getByTestId('guest-gate')).toHaveAttribute('data-reason', 'quests')
  })

  it("today's letter is open to visitors and counts questions, not XP", () => {
    renderScene()
    expect(screen.getByText('Chào bạn! Có thư cho bạn kìa.')).toBeInTheDocument()
    const cta = screen.getByTestId('featured-daily-cta')
    expect(cta).toHaveAttribute('href', '/daily')
    expect(cta).toHaveTextContent('5 câu')
    expect(cta).not.toHaveTextContent('XP')
    expect(screen.getByTestId('home-daily')).toHaveAccessibleName('Thử thách hôm nay: 5 câu, chơi được khi chưa đăng nhập')
  })

  it('the traveller invites a sign-in while a locked board is hovered', () => {
    renderScene()
    fireEvent.mouseEnter(screen.getByTestId('home-mode-journey'))
    expect(screen.getByText('Hành Trình cần đăng nhập nhé!')).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByTestId('home-mode-journey'))
    fireEvent.mouseEnter(screen.getByTestId('home-mode-study'))
    expect(screen.getByText('Đi Luyện Tập nhé?')).toBeInTheDocument()
  })

  it('links to the introduction, the ranking and the small print', () => {
    renderScene()
    expect(screen.getByTestId('guest-about')).toHaveAttribute('href', '/gioi-thieu')
    expect(screen.getByTestId('guest-ranking')).toHaveAttribute('href', '/leaderboard')
    for (const href of ['/cau-do-kinh-thanh', '/help', '/privacy', '/terms']) {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull()
    }
  })
})
