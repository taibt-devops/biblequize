import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setQuizLanguage, type QuizLanguage } from '../utils/quizLanguage'
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
      <div className="bq-lightwell min-h-dvh bg-bq-paper flex flex-col">
        {/* Nav */}
        <nav className="relative z-10 flex justify-between items-center w-full px-8 py-4">
          <span className="text-xl font-bold text-bq-amberd uppercase tracking-[0.05em] font-display">BibleQuiz</span>
          <div className="flex items-center gap-4">
            <button onClick={skip} className="text-bq-ink2 hover:text-bq-amberd transition-colors text-sm">Skip</button>
            <button onClick={() => navigate('/login')} className="bg-bq-action text-bq-ink shadow-bq-action px-6 py-2 rounded-xl text-sm font-bold">Login</button>
          </div>
        </nav>

        {/* Main */}
        <main className="relative z-10 flex-grow flex items-center justify-center w-full px-4">
          <div className="max-w-[600px] w-full text-center space-y-12 py-12">
            {/* Header */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight font-display" style={{ background: 'linear-gradient(90deg, #2D46C8 0%, #0E8A6B 34%, #F59E0B 64%, #E0354B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('onboarding.welcomeBilingual')}
              </h1>
              <p className="text-bq-ink2 text-lg tracking-wide">
                {t('onboarding.chooseLangBilingual')}
              </p>
            </div>

            {/* Language cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                data-testid="onboarding-lang-vi"
                onClick={() => selectLanguage('vi')}
                className="bg-bq-white border border-bq-hair shadow-bq-soft p-10 rounded-xl group cursor-pointer hover:border-bq-sapphire/50 hover:shadow-bq-sap transition-all duration-500 flex flex-col items-center space-y-6"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-bq-soft group-hover:scale-110 transition-transform duration-500 ring-2 ring-bq-sapphire/20">
                  <img alt="Flag of Vietnam" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDihXdQrvykTTGHwD-v83EmOX7ysb4sPtX03DQ0GEmYXstxBuN1PEvvQmshz36350XSESu4pN4GoHz8wwx4dHdaCs75JLnRauirsUXGlPyGCvvXV06Q4DNfwEFEf4y6qwBzKBV92HK0r-OLee6Gz0ouKdFRCMhKuUhvlKH6xQ8Fx9WHNmd_VbsRwiXJP38Co8QxRLguFU2gX29lFzh9Pc0_-zdKBTecRG6bludlvacDG7qlGsEHR3mm2Mv8pAj7judp4MpjC4N7n3c" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-bq-ink">{t('onboarding.langViName')}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-bq-sapphire/70 font-semibold">{t('onboarding.langViLocal')}</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-bq-sapphire/30 flex items-center justify-center group-hover:bg-bq-sapphire group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm" style={FILL_1}>chevron_right</span>
                </div>
              </button>

              <button
                data-testid="onboarding-lang-en"
                onClick={() => selectLanguage('en')}
                className="bg-bq-white border border-bq-hair shadow-bq-soft p-10 rounded-xl group cursor-pointer hover:border-bq-emerald/50 hover:shadow-bq-eme transition-all duration-500 flex flex-col items-center space-y-6"
              >
                {/* Globe icon (HR-12 2026-05-14) — replaces UK Union Jack
                    flag. English isn't a country-bound language; using a
                    globe matches the Google / Apple / Netflix convention
                    for language pickers. VN card keeps its flag because
                    Vietnamese is 99% bound to one country. */}
                <div
                  data-testid="onboarding-lang-en-icon"
                  className="flex h-20 w-20 items-center justify-center rounded-full ring-2 ring-bq-emerald/20 shadow-bq-soft group-hover:scale-110 transition-transform duration-500 border border-bq-emerald/25 bg-gradient-to-br from-bq-emerald/15 to-bq-emerald/5"
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
                    className="w-10 h-10 text-bq-emerald"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-bq-ink">{t('onboarding.langEnName')}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-bq-emerald/70 font-semibold">{t('onboarding.langEnLocal')}</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-bq-emerald/30 flex items-center justify-center group-hover:bg-bq-emerald group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm" style={FILL_1}>chevron_right</span>
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="pt-8 flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-bq-hair" />
              <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>auto_stories</span>
              <div className="h-[1px] w-12 bg-bq-hair" />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 bg-bq-paper border-t border-bq-hair py-8 w-full flex flex-col md:flex-row justify-between items-center px-12 text-sm tracking-wide">
          <div className="text-bq-amberd/70 mb-4 md:mb-0">© 2024 BibleQuiz. The Sacred Path.</div>
          <div className="flex gap-8">
            <a href="/privacy" className="text-bq-ink2 hover:text-bq-amberd underline decoration-bq-amber/30 transition-all duration-300">Privacy Policy</a>
            <a href="/terms" className="text-bq-ink2 hover:text-bq-amberd underline decoration-bq-amber/30 transition-all duration-300">Terms of Service</a>
            <a href="#" className="text-bq-ink2 hover:text-bq-amberd underline decoration-bq-amber/30 transition-all duration-300">Help Center</a>
          </div>
        </footer>
      </div>
    )
  }

  /* ── Screens 2-4: Welcome Slides ── */
  return (
    <div className="bq-lightwell min-h-dvh bg-bq-paper flex flex-col">
      {/* Nav */}
      <nav className="flex justify-between items-center w-full px-8 py-4 fixed top-0 z-50 bg-bq-paper">
        <span className="text-xl font-bold text-bq-amberd uppercase tracking-[0.05em] font-display">BibleQuiz</span>
        <div className="flex items-center gap-4">
          <button onClick={skip} className="text-bq-ink2 hover:text-bq-amberd transition-colors text-sm">Skip</button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex-grow flex items-center justify-center pt-16 px-6 md:px-12">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-12 md:min-h-[700px] items-center">
          {/* Left: Visual */}
          <SlideVisual step={step} />

          {/* Right: Content */}
          <div className="flex flex-col space-y-10 md:pl-8">
            {/* Step indicator */}
            <div className="flex flex-col space-y-2">
              <span className="text-bq-amberd font-bold tracking-[0.2em] text-sm uppercase">{t('onboarding.stepIndicator')}</span>
              <span className="text-bq-ink2 font-medium text-lg tracking-widest">
                {t('onboarding.stepCounter', { current: String(step).padStart(2, '0'), total: '03' })}
              </span>
            </div>

            {/* Text */}
            <div className="space-y-6">
              <h2 className="text-5xl md:text-6xl font-bold text-bq-ink leading-[1.1] tracking-tight font-display">
                {step === 1 && <>{t('onboarding.slide1Title').replace('BibleQuiz', '')}<span className="text-bq-amberd">BibleQuiz</span></>}
                {step === 2 && t('onboarding.slide2Title')}
                {step === 3 && (
                  <>{t('onboarding.slide3TitlePrefix')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-bq-amber to-bq-amberd">{t('onboarding.slide3TitleAccent')}</span></>
                )}
              </h2>
              <p className="text-bq-ink2 text-lg leading-relaxed max-w-md">
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
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-10 bg-bq-action shadow-bq-action' : 'w-2 bg-bq-inset'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                data-testid={step === 3 ? 'onboarding-start-btn' : 'onboarding-next-btn'}
                onClick={step === 3 ? finish : nextSlide}
                className="bg-bq-action text-bq-ink px-10 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-bq-action active:scale-95"
              >
                {step === 3 ? t('onboarding.start') : t('common.next')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              {step === 3 && (
                <button
                  onClick={skip}
                  className="px-8 py-4 rounded-xl font-bold text-bq-ink2 hover:text-bq-amberd transition-colors border border-bq-hair"
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
                    <span className="material-symbols-outlined text-sm text-bq-emerald">check_circle</span>
                    <span className="text-xs uppercase tracking-widest text-bq-ink2">{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Scripture quote (slide 3 only) */}
            {step === 3 && (
              <div className="flex items-start gap-4 p-4 bg-bq-inset rounded-lg border-l-4 border-bq-amber mt-4">
                <span className="material-symbols-outlined text-bq-amberd opacity-60">format_quote</span>
                <div>
                  <p className="text-sm italic text-bq-ink2">
                    {t('onboarding.scriptureQuote')}
                  </p>
                  <span className="block mt-1 font-semibold not-italic text-bq-amberd text-sm">{t('onboarding.scriptureRef')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-bq-paper border-t border-bq-hair flex flex-col gap-3 sm:flex-row justify-between items-center px-6 md:px-12 py-8 w-full">
        <span className="text-bq-amberd font-semibold text-sm">© 2024 BibleQuiz. The Sacred Path.</span>
        <div className="flex gap-8">
          <a href="/privacy" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Privacy</a>
          <a href="/terms" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  )
}

/* ── Slide Visuals ── */
function SlideVisual({ step }: { step: number }) {
  const { t } = useTranslation()
  const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

  if (step === 1) {
    // Spark of Light — large flare icon with glow
    return (
      <div className="relative flex items-center justify-center group h-full">
        <div className="absolute inset-0 bg-bq-amber/10 rounded-full blur-[120px] scale-75" />
        <div className="absolute inset-0 bg-bq-white rounded-full opacity-40 border border-bq-hair shadow-bq-soft" />
        <div className="relative z-10 flex items-center justify-center">
          <div className="absolute w-64 h-64 bg-bq-amber/25 rounded-full blur-3xl" />
          <span className="material-symbols-outlined text-bq-amberd drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]" style={{ ...FILL_1, fontSize: '180px' }}>flare</span>
          <span className="material-symbols-outlined absolute top-0 -right-8 text-4xl text-bq-ruby opacity-80" style={FILL_1}>star</span>
          <span className="material-symbols-outlined absolute bottom-12 -left-4 text-3xl text-bq-sapphire opacity-70" style={FILL_1}>auto_awesome</span>
        </div>
      </div>
    )
  }

  if (step === 2) {
    // Together in Faith — avatar grid with animated circles
    const AVATAR_TINT = ['text-bq-sapphire', 'text-bq-emerald', 'text-bq-amberd', 'text-bq-ruby']
    return (
      <div className="h-full flex flex-col justify-center items-center relative group">
        <div className="absolute inset-0 rounded-full blur-[100px] opacity-30" style={{ boxShadow: '0 0 60px -15px rgba(45,70,200,0.15)' }} />
        <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center">
          <div className="absolute w-full h-full border border-bq-hair rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute w-3/4 h-3/4 border border-bq-hair rounded-full animate-pulse" style={{ animationDuration: '6s' }} />
          {/* Avatar grid */}
          <div className="grid grid-cols-2 gap-8 relative z-10">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`p-6 bg-bq-white rounded-full border border-bq-hair shadow-bq-soft ${i % 2 === 0 ? 'mt-12' : '-mt-12'}`}>
                <div className="w-24 h-24 rounded-full bg-bq-inset flex items-center justify-center">
                  <span className={`material-symbols-outlined text-4xl ${AVATAR_TINT[i]}`} style={FILL_1}>
                    {['person', 'group', 'church', 'diversity_3'][i]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Online badge */}
        <div className="absolute bottom-10 right-10 bg-bq-white px-4 py-2 rounded-xl border border-bq-hair shadow-bq-soft flex items-center gap-2">
          <span className="material-symbols-outlined text-bq-emerald" style={FILL_1}>group</span>
          <span className="text-sm font-medium tracking-wide text-bq-ink2">4 Players Online</span>
        </div>
      </div>
    )
  }

  // step === 3: Journey trail
  const BOOK_ICONS = ['menu_book', 'auto_stories', 'history_edu', 'verified', 'import_contacts', 'star', 'book_2', 'bookmark', 'local_library', 'school', 'menu_book', 'auto_stories']
  return (
    <div className="relative bg-bq-inset flex items-center justify-center overflow-hidden rounded-2xl" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}>
      {/* Winding path SVG */}
      <svg className="absolute inset-0 opacity-20 w-full h-full" viewBox="0 0 400 1000" fill="none">
        <path d="M200,0 Q350,150 200,300 T200,600 T200,900" stroke="#F59E0B" strokeDasharray="10 10" strokeWidth="2" />
      </svg>

      <div className="relative w-full max-w-2xl px-4 py-10 sm:px-12 sm:py-24 grid grid-cols-4 sm:grid-cols-6 gap-6 justify-items-center">
        {BOOK_ICONS.map((icon, i) => (
          <div
            key={i}
            className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-all ${
              i < 2
                ? 'bg-bq-amber/20 border-bq-amber shadow-bq-flame'
                : i < 5
                  ? 'bg-bq-white border-bq-amber/30 shadow-bq-soft opacity-90'
                  : 'bg-bq-white border-bq-hair opacity-40'
            }`}
          >
            <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>{icon}</span>
          </div>
        ))}

        {/* Journey progress card */}
        <div className="col-span-4 sm:col-span-6 bg-bq-white p-6 rounded-xl border border-bq-hair shadow-bq-soft mt-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-bq-amber/10 rounded-lg">
              <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>map</span>
            </div>
            <div>
              <p className="text-bq-ink font-semibold">{t('onboarding.journeyProgressTitle')}</p>
              <p className="text-xs text-bq-ink2">{t('onboarding.journeyProgressDetail')}</p>
            </div>
          </div>
          <div className="w-full h-2 bg-bq-inset rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-bq-amber to-bq-amberd w-1/4 rounded-full" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 opacity-15 blur-2xl rounded-full bg-bq-amber" />
    </div>
  )
}
