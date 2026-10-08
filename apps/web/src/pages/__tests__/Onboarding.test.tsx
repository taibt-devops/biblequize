import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSetHasSeenOnboarding = vi.fn()
const mockSetLanguage = vi.fn()
vi.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    setHasSeenOnboarding: mockSetHasSeenOnboarding,
    setLanguage: mockSetLanguage,
  }),
}))

vi.mock('../../utils/quizLanguage', () => ({
  setQuizLanguage: vi.fn(),
}))

import Onboarding from '../Onboarding'

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>
  )
}

describe('Onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Language Selection (step 0)', () => {
    it('renders the welcome heading', () => {
      renderOnboarding()
      expect(screen.getByText(/Chào mừng/)).toBeInTheDocument()
    })

    it('renders Vietnamese language option', () => {
      renderOnboarding()
      expect(screen.getByText('Tiếng Việt')).toBeInTheDocument()
    })

    it('renders English language option', () => {
      renderOnboarding()
      expect(screen.getByText('English')).toBeInTheDocument()
    })

    /**
     * HR-12 (2026-05-14): English isn't a country-bound language —
     * 70%+ of speakers live outside the UK. Replace the Union Jack
     * flag with a globe icon, matching the Google / Apple / Netflix
     * convention. VN card keeps its flag image.
     */
    it('EN language card uses a globe icon, not the UK flag', () => {
      renderOnboarding()
      const enCard = screen.getByTestId('onboarding-lang-en')
      const iconWrap = screen.getByTestId('onboarding-lang-en-icon')
      // Globe SVG present
      expect(iconWrap.querySelector('svg circle')).not.toBeNull()
      // No UK flag image left behind
      expect(enCard.querySelector('img[alt*="United Kingdom" i]')).toBeNull()
      expect(enCard.querySelector('img[alt*="UK" i]')).toBeNull()
    })

    it('VN language card keeps its country flag image', () => {
      renderOnboarding()
      const viCard = screen.getByTestId('onboarding-lang-vi')
      expect(viCard.querySelector('img[alt*="Vietnam" i]')).not.toBeNull()
    })

    it('renders Skip button on language screen', () => {
      renderOnboarding()
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })

    it('renders Login button on language screen', () => {
      renderOnboarding()
      expect(screen.getByText('Login')).toBeInTheDocument()
    })

    it('renders footer with copyright', () => {
      renderOnboarding()
      expect(screen.getByText(/© 2026 BibleQuiz/)).toBeInTheDocument()
    })

    it('clicking Vietnamese advances to slide 1', async () => {
      renderOnboarding()
      const user = userEvent.setup()
      await user.click(screen.getByText('Tiếng Việt'))
      // After clicking, should see step indicator "01 / 03"
      expect(screen.getByText('01 / 03')).toBeInTheDocument()
    })

    it('clicking English advances to slide 1', async () => {
      renderOnboarding()
      const user = userEvent.setup()
      await user.click(screen.getByText('English'))
      expect(mockSetLanguage).toHaveBeenCalledWith('en')
      expect(screen.getByText('01 / 03')).toBeInTheDocument()
    })

    it('Skip navigates to /login and marks onboarding seen', async () => {
      renderOnboarding()
      const user = userEvent.setup()
      await user.click(screen.getByText('Skip'))
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true)
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    it('Login button navigates to /login', async () => {
      renderOnboarding()
      const user = userEvent.setup()
      await user.click(screen.getByText('Login'))
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  describe('Slide Navigation (steps 1-3)', () => {
    async function goToSlide1() {
      renderOnboarding()
      const user = userEvent.setup()
      await user.click(screen.getByText('Tiếng Việt'))
      return user
    }

    it('slide 1 shows step indicator 01 / 03', async () => {
      await goToSlide1()
      expect(screen.getByText('01 / 03')).toBeInTheDocument()
    })

    it('slide 1 has a Next button', async () => {
      await goToSlide1()
      // The next button text comes from translation key 'common.next'
      const nextBtn = screen.getByRole('button', { name: /Tiếp|Next|arrow_forward/i })
      expect(nextBtn).toBeInTheDocument()
    })

    it('clicking Next advances from slide 1 to slide 2', async () => {
      const user = await goToSlide1()
      // Find the primary CTA button (gold-gradient)
      await user.click(screen.getByTestId('onboarding-next-btn'))
      expect(screen.getByText('02 / 03')).toBeInTheDocument()
    })

    it('slide 2 shows feature grid (Multiplayer, Ranked, Groups, Tournament)', async () => {
      const user = await goToSlide1()
      await user.click(screen.getByTestId('onboarding-next-btn'))
      expect(screen.getByText('Multiplayer')).toBeInTheDocument()
      expect(screen.getByText('Ranked')).toBeInTheDocument()
      expect(screen.getByText('Groups')).toBeInTheDocument()
      expect(screen.getByText('Tournament')).toBeInTheDocument()
    })

    it('slide 3 shows scripture quote and start button', async () => {
      const user = await goToSlide1()
      // Navigate to slide 2
      await user.click(screen.getByTestId('onboarding-next-btn'))
      // Navigate to slide 3
      await user.click(screen.getByTestId('onboarding-next-btn'))
      expect(screen.getByText('03 / 03')).toBeInTheDocument()
      expect(screen.getByText(/Thi Thiên 119:105/)).toBeInTheDocument()
    })

    it('slide 3 finish navigates to /onboarding/try', async () => {
      const user = await goToSlide1()
      // Navigate to slide 3
      await user.click(screen.getByTestId('onboarding-next-btn'))
      await user.click(screen.getByTestId('onboarding-next-btn'))
      // Now click the start/finish button on slide 3
      await user.click(screen.getByTestId('onboarding-start-btn'))
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true)
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/try')
    })

    it('Skip on slides navigates to /login', async () => {
      const user = await goToSlide1()
      await user.click(screen.getByText('Skip'))
      expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true)
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    it('renders dot indicators showing current slide', async () => {
      await goToSlide1()
      // 3 dot indicators should exist
      const dots = document.querySelectorAll('.rounded-full.transition-all')
      // the active stone is the wide gold one
      const activeDot = document.querySelector('.bg-bq-amber.w-12.rounded-full')
      expect(activeDot).toBeInTheDocument()
    })
  })
})
