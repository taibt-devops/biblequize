import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }
const LETTERS = ['A', 'B', 'C', 'D']

/* ── Server contracts (mirror api/dto/basicquiz/*Response.java) ── */
interface BasicQuizQuestion {
  id: string
  content: string
  options: string[]
}

interface WrongAnswer {
  questionId: string
  content: string
  options: string[]
  selectedOptions: number[]
  correctOptions: number[]
  explanation: string
}

interface BasicQuizResult {
  passed: boolean
  correctCount: number
  totalQuestions: number
  threshold: number
  attemptCount: number
  cooldownSeconds: number
  wrongAnswers: WrongAnswer[]
}

type Phase = 'playing' | 'submitting' | 'result'

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds | 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ── Skeleton ── */
function QuizSkeleton() {
  return (
    <div data-testid="basic-quiz-skeleton" className="max-w-3xl mx-auto py-12 space-y-6 animate-pulse">
      <div className="h-3 w-full rounded-full bg-surface-container" />
      <div className="h-32 rounded-2xl bg-surface-container" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container" />)}
      </div>
    </div>
  )
}

/* ── Main ── */
export default function BasicQuiz() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const language = getQuizLanguage()

  // Load 10 questions once on mount. Server shuffles, so we don't need to.
  const { data: questions, isLoading, isError, refetch } = useQuery<BasicQuizQuestion[]>({
    queryKey: ['basic-quiz-questions', language],
    queryFn: () => api.get(`/api/basic-quiz/questions?language=${language}`).then(r => r.data),
    staleTime: 0, // always refetch on mount so a retry sees a freshly-shuffled order
    gcTime: 0,
  })

  const [phase, setPhase] = useState<Phase>('playing')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Array<number | null>>([])
  const [result, setResult] = useState<BasicQuizResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Init answers array when questions arrive (length matches server set).
  useEffect(() => {
    if (questions && questions.length > 0 && answers.length === 0) {
      setAnswers(new Array(questions.length).fill(null))
    }
  }, [questions, answers.length])

  // Live cooldown countdown for the fail screen.
  const [cooldownLeft, setCooldownLeft] = useState(0)
  useEffect(() => {
    if (cooldownLeft <= 0) return
    const id = window.setInterval(() => setCooldownLeft(prev => Math.max(0, prev - 1)), 1_000)
    return () => window.clearInterval(id)
  }, [cooldownLeft])

  const totalQuestions = questions?.length ?? 0
  const currentQuestion = questions?.[currentIndex]
  const allAnswered = useMemo(
    () => answers.length === totalQuestions && totalQuestions > 0 && answers.every(a => a !== null),
    [answers, totalQuestions]
  )

  function pickOption(idx: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[currentIndex] = idx
      return next
    })
  }

  function goNext() {
    setCurrentIndex(i => Math.min(i + 1, totalQuestions - 1))
  }

  function goPrev() {
    setCurrentIndex(i => Math.max(0, i - 1))
  }

  async function submit() {
    if (!questions || !allAnswered) return
    setPhase('submitting')
    setSubmitError(null)
    try {
      const payload = {
        language,
        answers: questions.map((q, i) => ({
          questionId: q.id,
          selectedOptions: answers[i] != null ? [answers[i] as number] : [],
        })),
      }
      const res = await api.post('/api/basic-quiz/submit', payload)
      const r = res.data as BasicQuizResult
      setResult(r)
      setCooldownLeft(r.cooldownSeconds)
      // Invalidate the Home card so its state-machine reflects the new attempt.
      queryClient.invalidateQueries({ queryKey: ['basic-quiz-status'] })
      setPhase('result')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'submit failed'
      setSubmitError(msg)
      setPhase('playing')
    }
  }

  // ── Loading / error gates ──
  if (isLoading || (!questions && !isError)) return <QuizSkeleton />

  if (isError || !questions || questions.length === 0) {
    return (
      <div data-testid="basic-quiz-error" className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-error" style={FILL_1}>error</span>
        <h2 className="text-xl font-bold text-on-surface">{t('basicQuiz.page.errorTitle')}</h2>
        <p className="text-sm text-on-surface-variant">{t('basicQuiz.page.errorMessage')}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => refetch()}
            className="gold-gradient text-on-secondary px-5 py-2.5 rounded-xl font-bold"
          >
            {t('basicQuiz.page.retryLoad')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-surface-container-highest text-on-surface px-5 py-2.5 rounded-xl font-bold"
          >
            {t('basicQuiz.page.backHome')}
          </button>
        </div>
      </div>
    )
  }

  // ── Result phase ──
  if (phase === 'result' && result) {
    return result.passed ? (
      <PassScreen result={result} onPlayRanked={() => navigate('/ranked')} onHome={() => navigate('/')} />
    ) : (
      <FailScreen
        result={result}
        cooldownLeft={cooldownLeft}
        onHome={() => navigate('/')}
      />
    )
  }

  // ── Playing phase ──
  return (
    <div data-testid="basic-quiz-page" className="max-w-3xl mx-auto py-8 space-y-6">
      {/* Header + progress */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" style={FILL_1}>menu_book</span>
            {t('basicQuiz.page.title')}
          </h1>
          <span data-testid="basic-quiz-counter" className="text-sm font-bold text-on-surface-variant">
            {t('basicQuiz.page.counter', { current: currentIndex + 1, total: totalQuestions })}
          </span>
        </div>
        <div
          data-testid="basic-quiz-progress"
          aria-valuenow={currentIndex + 1}
          aria-valuemax={totalQuestions}
          role="progressbar"
          className="h-2 rounded-full bg-surface-container overflow-hidden"
        >
          <div
            className="h-full gold-gradient transition-all"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      {/* Question */}
      {currentQuestion && (
        <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 data-testid="basic-quiz-question" className="text-xl sm:text-2xl font-bold text-on-surface">
            {currentQuestion.content}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = answers[currentIndex] === idx
              return (
                <button
                  key={idx}
                  data-testid={`basic-quiz-option-${idx}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => pickOption(idx)}
                  className={
                    'w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left active:scale-[0.99] ' +
                    (isSelected
                      ? 'border-secondary bg-secondary/10 gold-glow'
                      : 'border-outline-variant/20 bg-surface-container hover:bg-surface-container-high hover:border-outline-variant/40')
                  }
                >
                  <span
                    className={
                      'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black ' +
                      (isSelected ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-secondary')
                    }
                  >
                    {LETTERS[idx]}
                  </span>
                  <span className={'pt-1.5 text-base ' + (isSelected ? 'text-secondary font-semibold' : 'text-on-surface')}>
                    {option}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {submitError && (
        <div data-testid="basic-quiz-submit-error" className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">
          {submitError}
        </div>
      )}

      {/* Footer controls */}
      <footer className="flex items-center justify-between gap-3">
        <button
          data-testid="basic-quiz-prev"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-5 py-2.5 rounded-xl font-bold bg-surface-container-highest text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('basicQuiz.page.prev')}
        </button>
        {currentIndex < totalQuestions - 1 ? (
          <button
            data-testid="basic-quiz-next"
            onClick={goNext}
            disabled={answers[currentIndex] == null}
            className="gold-gradient text-on-secondary px-6 py-2.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('basicQuiz.page.next')}
          </button>
        ) : (
          <button
            data-testid="basic-quiz-submit"
            onClick={submit}
            disabled={!allAnswered || phase === 'submitting'}
            className="gold-gradient text-on-secondary px-6 py-2.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {phase === 'submitting' ? t('basicQuiz.page.submitting') : t('basicQuiz.page.submit')}
          </button>
        )}
      </footer>
    </div>
  )
}

/* ── Result screen — Pass ── */
function PassScreen({
  result,
  onPlayRanked,
  onHome,
}: {
  result: BasicQuizResult
  onPlayRanked: () => void
  onHome: () => void
}) {
  const { t } = useTranslation()
  return (
    <div data-testid="basic-quiz-result-pass" className="max-w-2xl mx-auto py-12 text-center space-y-6">
      <div className="text-7xl">🎉</div>
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-on-surface">
          {t('basicQuiz.page.passTitle')}
        </h2>
        <p className="text-on-surface-variant">
          {t('basicQuiz.page.passSubtitle', { correct: result.correctCount, total: result.totalQuestions })}
        </p>
      </div>
      <div className="glass-card rounded-2xl p-6 inline-flex items-center gap-3 mx-auto">
        <span className="material-symbols-outlined text-secondary text-3xl" style={FILL_1}>verified</span>
        <span className="text-base font-bold text-secondary">{t('basicQuiz.page.passUnlock')}</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button
          data-testid="basic-quiz-pass-cta"
          onClick={onPlayRanked}
          className="gold-gradient text-on-secondary px-6 py-3 rounded-xl font-bold"
        >
          <span className="material-symbols-outlined align-middle text-base mr-1" style={FILL_1}>play_arrow</span>
          {t('basicQuiz.page.passCta')}
        </button>
        <button
          onClick={onHome}
          className="bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl font-bold"
        >
          {t('basicQuiz.page.backHome')}
        </button>
      </div>
    </div>
  )
}

/* ── Result screen — Fail with review ── */
function FailScreen({
  result,
  cooldownLeft,
  onHome,
}: {
  result: BasicQuizResult
  cooldownLeft: number
  onHome: () => void
}) {
  const { t } = useTranslation()
  return (
    <div data-testid="basic-quiz-result-fail" className="max-w-3xl mx-auto py-10 space-y-6">
      <header className="text-center space-y-3">
        <div className="text-6xl">😅</div>
        <h2 className="text-2xl font-black text-on-surface">
          {t('basicQuiz.page.failTitle', { correct: result.correctCount, total: result.totalQuestions })}
        </h2>
        <p className="text-on-surface-variant">
          {t('basicQuiz.page.failSubtitle', { threshold: result.threshold })}
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary" style={FILL_1}>menu_book</span>
          {t('basicQuiz.page.failReview')}
        </h3>
        <ul className="space-y-3">
          {result.wrongAnswers.map((w, idx) => {
            const correctIdx = w.correctOptions[0] ?? -1
            const selectedIdx = w.selectedOptions[0]
            return (
              <li
                key={w.questionId}
                data-testid={`basic-quiz-wrong-${idx}`}
                className="rounded-2xl border border-error/20 bg-surface-container p-5 space-y-3"
              >
                <p className="font-semibold text-on-surface">{w.content}</p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-error/30 bg-error/5 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-error font-bold mb-1">
                      {t('basicQuiz.page.failYourAnswer')}
                    </div>
                    <div className="text-on-surface">
                      {selectedIdx != null && w.options[selectedIdx]
                        ? `${LETTERS[selectedIdx] ?? ''}. ${w.options[selectedIdx]}`
                        : t('basicQuiz.page.failSkipped')}
                    </div>
                  </div>
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-green-400 font-bold mb-1">
                      {t('basicQuiz.page.failCorrectAnswer')}
                    </div>
                    <div className="text-on-surface">
                      {correctIdx >= 0 ? `${LETTERS[correctIdx] ?? ''}. ${w.options[correctIdx]}` : '—'}
                    </div>
                  </div>
                </div>
                {w.explanation && (
                  <p className="text-sm text-on-surface-variant flex gap-2">
                    <span className="text-secondary shrink-0">💡</span>
                    <span>{w.explanation}</span>
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="rounded-2xl bg-surface-container p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span data-testid="basic-quiz-fail-cooldown" className="text-sm text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">timer</span>
          {t('basicQuiz.page.cooldownMessage', { time: formatMmSs(cooldownLeft) })}
        </span>
        <button
          onClick={onHome}
          className="bg-surface-container-highest text-on-surface px-6 py-2.5 rounded-xl font-bold w-full sm:w-auto"
        >
          {t('basicQuiz.page.backHome')}
        </button>
      </footer>
    </div>
  )
}
