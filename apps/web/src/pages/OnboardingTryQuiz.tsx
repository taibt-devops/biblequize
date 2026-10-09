import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore } from '../store/onboardingStore'
import { PlaceBackdrop, ScrollPanel } from '../components/lk/Place'
import { api } from '../api/client'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface SampleQuestion {
  id: string
  content: string
  options: string[]
  correctAnswer: number[]
  book: string
}

const FALLBACK_VI: SampleQuestion[] = [
  { id: 'f1', content: 'Sách đầu tiên trong Kinh Thánh là gì?', options: ['Sáng Thế Ký', 'Xuất Ai Cập Ký', 'Ma-thi-ơ', 'Thi Thiên'], correctAnswer: [0], book: 'Genesis' },
  { id: 'f2', content: 'Ai đã dẫn dân Y-sơ-ra-ên ra khỏi Ai Cập?', options: ['Áp-ra-ham', 'Đa-vít', 'Môi-se', 'Giô-suê'], correctAnswer: [2], book: 'Exodus' },
  { id: 'f3', content: 'Chúa Giê-su được sinh ra ở đâu?', options: ['Na-xa-rét', 'Giê-ru-sa-lem', 'Bết-lê-hem', 'Ca-bê-na-um'], correctAnswer: [2], book: 'Matthew' },
]
const FALLBACK_EN: SampleQuestion[] = [
  { id: 'f1', content: 'What is the first book in the Bible?', options: ['Genesis', 'Exodus', 'Matthew', 'Psalms'], correctAnswer: [0], book: 'Genesis' },
  { id: 'f2', content: 'Who led the Israelites out of Egypt?', options: ['Abraham', 'David', 'Moses', 'Joshua'], correctAnswer: [2], book: 'Exodus' },
  { id: 'f3', content: 'Where was Jesus born?', options: ['Nazareth', 'Jerusalem', 'Bethlehem', 'Capernaum'], correctAnswer: [2], book: 'Matthew' },
]

export default function OnboardingTryQuiz() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { setHasSeenOnboarding } = useOnboardingStore()

  const [questions, setQuestions] = useState<SampleQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [startTime] = useState(Date.now())
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    const lang = i18n.language === 'en' ? 'en' : 'vi'
    api.get(`/api/public/sample-questions?language=${lang}&count=3`)
      .then(res => setQuestions(res.data?.length >= 3 ? res.data : (lang === 'en' ? FALLBACK_EN : FALLBACK_VI)))
      .catch(() => setQuestions(lang === 'en' ? FALLBACK_EN : FALLBACK_VI))
      .finally(() => setLoading(false))
  }, [i18n.language])

  if (loading) {
    return (
      <div className="min-h-dvh bg-bq-paper flex items-center justify-center">
        <div className="animate-pulse text-bq-ink2">{t('common.loading')}</div>
      </div>
    )
  }

  const question = questions[currentQ]
  const totalTime = Math.round((Date.now() - startTime) / 1000)

  const handleSelect = (idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    if (question.correctAnswer.includes(idx)) setCorrect(c => c + 1)
    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1)
        setSelected(null)
      } else {
        setShowResult(true)
      }
    }, 800)
  }

  const goRegister = () => { setHasSeenOnboarding(true); navigate('/login') }
  const goSkip = () => { setHasSeenOnboarding(true); navigate('/') }

  /* ── Screen 6: Result ── */
  if (showResult) {
    const total = questions.length
    const wrong = total - correct
    const getMessage = () => {
      if (correct === total) return t('onboarding.tryMessagePerfect')
      if (correct >= 2) return t('onboarding.tryMessageGood')
      if (correct === 1) return t('onboarding.tryMessageStart')
      return t('onboarding.tryMessageEncourage')
    }

    return (
      <div data-testid="try-quiz-results" className="relative min-h-dvh flex flex-col">
        <PlaceBackdrop place="gate" veil="strong" />
        {/* Nav */}
        <nav className="flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50 bg-bq-white/95 border-b-[3px] border-bq-ink">
          <span className="inline-flex items-center gap-1.5 font-display text-[24px] font-extrabold text-bq-ink"><img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-8" />BibleQuiz</span>
          <div className="hidden md:flex gap-8">
            {[t('onboarding.tryNavHome'), t('onboarding.tryNavChallenge'), t('onboarding.tryNavCommunity')].map(l => (
              <span key={l} className="text-bq-ink2 text-sm">{l}</span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={goSkip} className="text-bq-ink2 hover:text-bq-amberd transition-colors text-sm">Skip</button>
          </div>
        </nav>

        {/* Main */}
        <main className="relative z-10 flex-grow flex items-center justify-center px-6 py-12 md:px-12">
          <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Score */}
            <div className="flex flex-col items-center md:items-start space-y-8">
              <div className="relative">
                <div className="absolute inset-0 bg-bq-action blur-3xl opacity-15 rounded-full" />
                <div className="relative">
                  <p data-testid="try-quiz-score" className="text-[120px] md:text-[160px] font-extrabold leading-none tracking-tighter font-display" style={{ color: '#1D2B22', textShadow: '0 0.06em 0 #FFC93C' }}>
                    {correct}/{total}
                  </p>
                  <div className="h-1.5 w-32 bg-bq-action rounded-full mt-2" />
                </div>
              </div>

              <div className="space-y-4 text-center md:text-left">
                <h2 className="text-4xl md:text-5xl font-bold text-bq-ink tracking-tight leading-tight font-display">{getMessage()}</h2>
                <p className="text-bq-ink2 text-lg max-w-md leading-relaxed">
                  {t('onboarding.trySignupHint')}
                </p>
              </div>

              {/* Community avatars */}
              <div className="pt-8 flex flex-col items-center md:items-start gap-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="inline-block h-10 w-10 rounded-full ring-2 ring-bq-paper bg-bq-inset flex items-center justify-center">
                      <span className="material-symbols-outlined text-bq-sapphire/70 text-lg" style={FILL_1}>person</span>
                    </div>
                  ))}
                  <div className="inline-block h-10 w-10 rounded-full ring-2 ring-bq-paper bg-bq-inset flex items-center justify-center">
                    <span className="text-xs font-bold text-bq-amberd">+2k</span>
                  </div>
                </div>
                <p
                  className="text-sm text-bq-ink2 [&_b]:text-bq-amberd [&_b]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: t('onboarding.tryCommunityJoin', { count: '2,405' }) }}
                />
              </div>
            </div>

            {/* Right: Stats + CTA card */}
            <div className="relative">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-bq-amber opacity-10 rounded-full blur-3xl" />
              <div className="relative bg-bq-white border border-bq-hair shadow-bq-soft p-5 sm:p-8 md:p-12 rounded-[2rem] flex flex-col space-y-10">
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="bg-bq-inset p-3 sm:p-5 rounded-2xl flex flex-col items-center space-y-2">
                    <span className="material-symbols-outlined text-bq-emerald" style={FILL_1}>check_circle</span>
                    <span className="text-2xl font-bold text-bq-ink">{t('onboarding.tryStatCorrect', { count: correct })}</span>
                  </div>
                  <div className="bg-bq-inset p-3 sm:p-5 rounded-2xl flex flex-col items-center space-y-2">
                    <span className="material-symbols-outlined text-bq-ruby">cancel</span>
                    <span className="text-2xl font-bold text-bq-ink">{t('onboarding.tryStatWrong', { count: wrong })}</span>
                  </div>
                  <div className="bg-bq-inset p-3 sm:p-5 rounded-2xl flex flex-col items-center space-y-2">
                    <span className="material-symbols-outlined text-bq-sapphire">timer</span>
                    <span className="text-2xl font-bold text-bq-ink">{totalTime}s</span>
                  </div>
                </div>

                {/* CTA */}
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-xl font-bold text-bq-ink">{t('onboarding.trySaveProgressTitle')}</p>
                    <p className="text-bq-ink2 text-sm mt-1">{t('onboarding.trySaveProgressDesc')}</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      data-testid="try-quiz-register-btn"
                      onClick={goRegister}
                      className="bg-bq-action text-bq-ink shadow-bq-action font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all active:scale-95"
                    >
                      {t('auth.loginWithGoogle')}
                    </button>
                    <button
                      onClick={goSkip}
                      className="text-bq-ink2 font-medium py-3 px-8 rounded-xl border border-bq-hair hover:bg-bq-inset transition-colors"
                    >
                      {t('onboarding.tryLater')}
                    </button>
                  </div>
                </div>

                {/* Trust badge */}
                <div className="flex items-center justify-center gap-2 text-[12.5px] text-bq-ink3 font-bold">
                  <span className="material-symbols-outlined text-[14px]">verified_user</span>
                  {t('onboarding.trySecurityNote')}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 bg-bq-white/90 border-t-[3px] border-bq-ink flex flex-col gap-3 sm:flex-row justify-between items-center px-6 md:px-12 py-8 w-full">
          <span className="text-bq-ink2 font-bold text-[14px]">© 2026 BibleQuiz</span>
          <div className="flex gap-8">
            <a href="/privacy" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Privacy</a>
            <a href="/terms" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Terms</a>
          </div>
        </footer>
      </div>
    )
  }

  /* ── Screen 5: Try Quiz ── */
  const pctComplete = Math.round(((currentQ + 1) / questions.length) * 100)
  const LETTERS = ['A', 'B', 'C', 'D']

  return (
    <div className="relative min-h-dvh flex flex-col">
      <PlaceBackdrop place="gate" veil="strong" />
      {/* Nav */}
      <nav className="flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50 bg-bq-white/95 border-b-[3px] border-bq-ink">
        <span className="inline-flex items-center gap-1.5 font-display text-[24px] font-extrabold text-bq-ink"><img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-8" />BibleQuiz</span>
        <div className="hidden md:flex items-center gap-8">
          {['Home', 'Quiz', 'Leaderboard'].map(l => (
            <span key={l} className="text-bq-ink2 text-sm">{l}</span>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={goSkip} className="text-bq-ink2 hover:text-bq-amberd transition-colors text-sm">Skip</button>
          <button onClick={goRegister} className="bg-bq-action text-bq-ink shadow-bq-action px-6 py-2 rounded-xl text-sm font-bold">Login</button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[720px] space-y-12">
          {/* Header + Progress */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <span className="inline-block mb-1.5 px-3 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold text-bq-ink">{t('onboarding.tryChallengeOfDay')}</span>
                <h2 className="text-3xl font-bold tracking-tight text-bq-ink font-display">{t('onboarding.tryQuestionOfTotal', { current: currentQ + 1, total: questions.length })}</h2>
              </div>
              <span className="text-bq-ink2 text-sm font-medium">{t('onboarding.tryPercentComplete', { percent: pctComplete })}</span>
            </div>
            <div className="h-4 w-full bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
              <div className="h-full bg-bq-amber border-r-2 border-bq-ink/40 transition-all duration-500" style={{ width: `${pctComplete}%` }} />
            </div>
          </div>

          {/* Question card */}
          <ScrollPanel bodyClassName="px-6 md:px-12 py-7 md:py-10 text-center">
            <span className="inline-flex items-center gap-1.5 mb-4 px-3 py-0.5 bg-bq-white border-2 border-bq-ink rounded-full text-[13px] font-extrabold">
              <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-4" />
              {question.book || t('onboarding.tryBookFallback')}
            </span>
            <p data-testid="try-quiz-question" className="m-0 font-read text-[22px] md:text-[28px] font-bold leading-snug text-bq-ink">{question.content}</p>
          </ScrollPanel>

          {/* Answer options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.options.map((opt, idx) => {
              // the quiz signboards (A coral, B sky, C gold, D sage); reveal = leaf ring / ruby ring
              const board = ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d'][idx % 4]
              const isRight = question.correctAnswer.includes(idx)
              let cls = `${board} shadow-bq-btn hover:brightness-105 active:translate-y-1 active:shadow-bq-btn-down`
              let mark: string = LETTERS[idx]
              if (selected !== null) {
                if (isRight) {
                  cls = `${board} shadow-bq-btn ring-4 ring-bq-emerald/50`
                  mark = '✓'
                } else if (idx === selected) {
                  cls = `${board} shadow-bq-btn ring-4 ring-bq-ruby/40`
                  mark = '✗'
                } else {
                  cls = `${board} opacity-50 saturate-[.65]`
                }
              }
              return (
                <button
                  key={idx}
                  data-testid={`try-quiz-option-${idx}`}
                  onClick={() => handleSelect(idx)}
                  disabled={selected !== null}
                  className={`flex items-center gap-3 md:gap-4 px-4 py-3 md:px-5 md:py-4 min-h-[60px] md:min-h-[78px] rounded-[18px] md:rounded-[20px] border-[3px] border-bq-ink transition-all text-left ${cls}`}
                >
                  <span className={`flex-shrink-0 w-9 h-9 md:w-11 md:h-11 grid place-items-center rounded-full border-[3px] border-bq-ink bg-bq-white font-extrabold text-[17px] md:text-[20px] ${
                    selected !== null && isRight ? 'text-bq-emerald' : selected === idx ? 'text-bq-ruby' : 'text-bq-ink'
                  }`}>
                    {mark}
                  </span>
                  <span className="text-[18px] md:text-[21px] font-bold leading-snug text-bq-ink">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Hints */}
          <div className="flex justify-center items-center gap-6 pt-4">
            <span className="flex items-center gap-2 text-bq-ink2 text-sm font-medium">
              <span className="material-symbols-outlined text-[20px]">lightbulb</span>
              {t('onboarding.tryHint5050')}
            </span>
            <div className="h-4 w-[1px] bg-bq-hair" />
            <span className="flex items-center gap-2 text-bq-ink2 text-sm font-medium">
              <span className="material-symbols-outlined text-[20px]">report</span>
              {t('onboarding.tryReportQuestion')}
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-bq-white/90 border-t-[3px] border-bq-ink py-8 flex flex-col gap-3 sm:flex-row justify-between items-center px-6 md:px-12 w-full mt-auto">
        <span className="text-bq-ink2 font-bold text-[14px]">© 2026 BibleQuiz</span>
        <div className="flex gap-8">
          <a href="/privacy" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Privacy</a>
          <a href="/terms" className="text-bq-ink2 text-sm hover:text-bq-amberd transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  )
}
