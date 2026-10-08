import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setQuizLanguage, type QuizLanguage } from '../utils/quizLanguage'
import { PlaceBackdrop, Plaque, lkClass } from '../components/lk/Place'
import { useOnboardingStore } from '../store/onboardingStore'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }


export default function Onboarding() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { setHasSeenOnboarding, setLanguage } = useOnboardingStore()
  const [step, setStep] = useState(0) // 0=language, 1-3=slides

  const selectLanguage = (lang: QuizLanguage) => {
    setLanguage(lang)
    setQuizLanguage(lang)
    i18n.changeLanguage(lang)
    setStep(1)
  }

  const finish = () => {
    setHasSeenOnboarding(true)
    navigate('/onboarding/try')
  }

  const skip = () => {
    setHasSeenOnboarding(true)
    navigate('/login')
  }

  const nextSlide = () => {
    if (step < 3) setStep(step + 1)
    else finish()
  }

  /* ── Screen 1: Language Selection ── */
  if (step === 0) {
    return (
      <div className="relative min-h-dvh flex flex-col">
        <PlaceBackdrop place="gate" veil="mid" focus="50% 60%" />
        {/* Nav */}
        <nav className="relative z-10 flex justify-between items-center w-full px-8 py-4">
          <span className="inline-flex items-center gap-1.5 font-display text-[24px] font-extrabold text-bq-ink"><img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-8" />BibleQuiz</span>
          <div className="flex items-center gap-4">
            <button onClick={skip} className="px-3 py-1 rounded-full bg-bq-white/90 border-2 border-bq-ink text-[14px] font-bold text-bq-ink hover:bg-bq-cream">Skip</button>
            <button onClick={() => navigate('/login')} className="lk-btn !py-1.5 !px-5 text-bq-ink text-[15px]">Login</button>
          </div>
        </nav>

        {/* Main */}
        <main className="relative z-10 flex-grow flex items-center justify-center w-full px-4">
          <div className="max-w-[600px] w-full text-center space-y-12 py-12">
            {/* Header */}
            <div className="space-y-4">
              <Plaque className="text-[34px] md:text-[48px]">
                {t('onboarding.welcomeBilingual')}
              </Plaque>
              <p className="m-0 mx-auto w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[16px] text-bq-ink2">
                {t('onboarding.chooseLangBilingual')}
              </p>
            </div>

            {/* Language cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                data-testid="onboarding-lang-vi"
                onClick={() => selectLanguage('vi')}
                className="bg-bq-white border-[3px] border-bq-ink shadow-[0_6px_0_#1D2B22] p-8 rounded-bq group cursor-pointer hover:-translate-y-1 transition-transform flex flex-col items-center space-y-5"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-bq-ink shadow-[0_0_0_4px_#C68A4E,0_0_0_7px_#1D2B22]">
                  <img alt="Flag of Vietnam" className="w-full h-full object-cover" src="/images/lk/flag-vn.svg" />
                </div>
                <div className="space-y-2">
                  <p className="m-0 font-display text-[26px] font-extrabold text-bq-ink">{t('onboarding.langViName')}</p>
                  <p className="m-0 text-[14px] text-bq-ink2 font-bold">{t('onboarding.langViLocal')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-bq-amber border-2 border-bq-ink flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm" style={FILL_1}>chevron_right</span>
                </div>
              </button>

              <button
                data-testid="onboarding-lang-en"
                onClick={() => selectLanguage('en')}
                className="bg-bq-white border-[3px] border-bq-ink shadow-[0_6px_0_#1D2B22] p-8 rounded-bq group cursor-pointer hover:-translate-y-1 transition-transform flex flex-col items-center space-y-5"
              >
                {/* Globe icon (HR-12 2026-05-14) — replaces UK Union Jack
                    flag. English isn't a country-bound language; using a
                    globe matches the Google / Apple / Netflix convention
                    for language pickers. VN card keeps its flag because
                    Vietnamese is 99% bound to one country. */}
                <div
                  data-testid="onboarding-lang-en-icon"
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-bq-leaf border-[3px] border-bq-ink shadow-[0_0_0_4px_#C68A4E,0_0_0_7px_#1D2B22]"
                >
                  <svg
                    aria-label="Globe — international English"
                    role="img"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-10 h-10 text-bq-ink"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <p className="m-0 font-display text-[26px] font-extrabold text-bq-ink">{t('onboarding.langEnName')}</p>
                  <p className="m-0 text-[14px] text-bq-ink2 font-bold">{t('onboarding.langEnLocal')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-bq-amber border-2 border-bq-ink flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm" style={FILL_1}>chevron_right</span>
                </div>
              </button>
            </div>

            {/* Divider */}

          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 bg-bq-white/90 border-t-[3px] border-bq-ink py-5 w-full flex flex-col md:flex-row justify-between items-center gap-3 px-6 md:px-12 text-[14px] font-bold">
          <div className="text-bq-ink2">© 2026 BibleQuiz</div>
          <div className="flex gap-8">
            <a href="/privacy" className="text-bq-ink2 hover:text-bq-ink underline decoration-bq-amber decoration-2 underline-offset-2">Privacy Policy</a>
            <a href="/terms" className="text-bq-ink2 hover:text-bq-ink underline decoration-bq-amber decoration-2 underline-offset-2">Terms of Service</a>
            <a href="#" className="text-bq-ink2 hover:text-bq-ink underline decoration-bq-amber decoration-2 underline-offset-2">Help Center</a>
          </div>
        </footer>
      </div>
    )
  }

  /* ── Screens 2-4: Welcome Slides ── */
  return (
    <div className="relative min-h-dvh flex flex-col">
      <PlaceBackdrop place="gate" veil="strong" focus="50% 60%" />
      {/* Nav */}
      <nav className="flex justify-between items-center w-full px-6 md:px-8 py-3 fixed top-0 z-50 bg-bq-white/95 border-b-[3px] border-bq-ink">
        <span className="inline-flex items-center gap-1.5 font-display text-[24px] font-extrabold text-bq-ink"><img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-8" />BibleQuiz</span>
        <div className="flex items-center gap-4">
          <button onClick={skip} className="px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[14px] font-bold text-bq-ink hover:bg-bq-cream">Skip</button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex-grow flex items-center justify-center pt-24 pb-10 px-5 md:px-12">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-8 md:gap-12 items-center">
          {/* Left: Visual */}
          <SlideVisual step={step} />

          {/* Right: Content */}
          <div className="flex flex-col space-y-6 md:space-y-8 bg-bq-white/90 border-[3px] border-bq-ink rounded-bq shadow-bq-card p-6 md:p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold">{t('onboarding.stepIndicator')}</span>
              <span className="text-bq-ink2 font-extrabold text-[15px] tabular-nums">
                {t('onboarding.stepCounter', { current: String(step).padStart(2, '0'), total: '03' })}
              </span>
            </div>

            {/* Text */}
            <div className="space-y-6">
              <h2 className="m-0 text-[36px] md:text-[48px] font-extrabold text-bq-ink leading-[1.08] font-display">
                {step === 1 && t('onboarding.slide1Title')}
                {step === 2 && t('onboarding.slide2Title')}
                {step === 3 && (
                  <>{t('onboarding.slide3TitlePrefix')} <span className="text-bq-ink">{t('onboarding.slide3TitleAccent')}</span></>
                )}
              </h2>
              <p className="m-0 font-read text-bq-ink2 text-[17px] leading-relaxed max-w-md">
                {step === 1 && t('onboarding.slide1Desc')}
                {step === 2 && t('onboarding.slide2Desc')}
                {step === 3 && t('onboarding.slide3Desc')}
              </p>
            </div>

            {/* Dots */}
            <div className="flex items-center space-x-3">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-3.5 rounded-full border-2 border-bq-ink transition-all duration-300 ${
                    i === step ? 'w-12 bg-bq-amber' : i < step ? 'w-3.5 bg-bq-amber' : 'w-3.5 bg-bq-track'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                data-testid={step === 3 ? 'onboarding-start-btn' : 'onboarding-next-btn'}
                onClick={step === 3 ? finish : nextSlide}
                className="lk-btn text-bq-ink text-[17px]"
              >
                {step === 3 ? t('onboarding.start') : t('common.next')}
              </button>
              {step === 3 && (
                <button
                  onClick={skip}
                  className="lk-btn !bg-bq-white text-bq-ink text-[16px]"
                >
                  {t('onboarding.skip')}
                </button>
              )}
            </div>

            {/* Feature grid (slide 2 only) */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-4 mt-8">
                {['Multiplayer', 'Ranked', 'Groups', 'Tournament'].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="w-6 h-6 grid place-items-center rounded-full bg-bq-leaf border-2 border-bq-ink text-[12px] font-extrabold">✓</span>
                    <span className="text-[14px] font-bold text-bq-ink">{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Scripture quote (slide 3 only) */}
            {step === 3 && (
              <div className="flex items-start gap-3 p-4 bg-bq-cream rounded-2xl border-2 border-dashed border-bq-ink/40">
                <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-8" />
                <div>
                  <p className="m-0 font-read text-[15px] italic text-bq-ink2">
                    {t('onboarding.scriptureQuote')}
                  </p>
                  <span className="block mt-1 font-extrabold not-italic text-bq-ink text-[14px]">{t('onboarding.scriptureRef')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-bq-white/90 border-t-[3px] border-bq-ink flex flex-col gap-3 sm:flex-row justify-between items-center px-6 md:px-12 py-5 w-full">
        <span className="text-bq-ink2 font-bold text-[14px]">© 2026 BibleQuiz</span>
        <div className="flex gap-8">
          <a href="/privacy" className="text-bq-ink2 text-[14px] font-bold hover:text-bq-ink underline decoration-bq-amber decoration-2 underline-offset-2">Privacy</a>
          <a href="/terms" className="text-bq-ink2 text-[14px] font-bold hover:text-bq-ink underline decoration-bq-amber decoration-2 underline-offset-2">Terms</a>
        </div>
      </footer>
    </div>
  )
}

/* ── Slide Visuals: the traveller's world ── */
function SlideVisual({ step }: { step: number }) {
  const frame = 'w-full aspect-[4/3] object-cover rounded-bq border-[3px] border-bq-ink shadow-bq-card'
  if (step === 1) {
    // the traveller at the gate, lantern lit — the journey starts here
    return (
      <div className="relative">
        <img src="/images/lk/place-gate.webp" alt="" aria-hidden className={frame} style={{ objectPosition: '50% 65%' }} />
        <img src="/images/lk/hero-cheer.webp" alt="" aria-hidden className={`absolute right-[10%] bottom-[6%] h-[45%] ${lkClass.bob}`} />
      </div>
    )
  }
  if (step === 2) {
    // the village square in the evening — friends, rooms and groups
    return <img src="/images/lk/place-square.webp" alt="" aria-hidden className={frame} />
  }
  // step 3 — the map of the 66 books
  return (
    <div className="relative">
      <img src="/images/lk/bq-journey.webp" alt="" aria-hidden className={frame} />
      <img src="/images/lk/hero.webp" alt="" aria-hidden className={`absolute left-[12%] bottom-[10%] h-[34%] ${lkClass.bob}`} />
    </div>
  )
}
