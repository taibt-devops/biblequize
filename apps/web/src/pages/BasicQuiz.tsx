import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }
const LETTERS = ['A', 'B', 'C', 'D']

/* ── Server contracts (mirror api/dto/basicquiz/*Response.java) ── */
interface BasicQuizQuestion {
  id: string
  content: string
  options: string[]
}

interface Review {
  questionId: string
  content: string
  options: string[]
  selectedOptions: number[]
  correctOptions: number[]
  explanation: string
  correct: boolean
}

interface BasicQuizResult {
  passed: boolean
  correctCount: number
  totalQuestions: number
  threshold: number
  attemptCount: number
  cooldownSeconds: number
  reviews: Review[]
}

type Phase = 'playing' | 'submitting' | 'result'

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds | 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ── Skeleton ── */
function QuizSkeleton() {
  return (
    <div data-testid="basic-quiz-skeleton" className="max-w-4xl mx-auto py-12 space-y-6 animate-pulse">
      <div className="h-3 w-full rounded-full bg-bq-inset" />
      <div className="h-32 rounded-2xl bg-bq-inset" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-bq-inset" />)}
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
    soundManager.play('buttonTap')
    haptic.select()
  }

  function goNext() {
    setCurrentIndex(i => Math.min(i + 1, totalQuestions - 1))
    soundManager.play('buttonTap')
    haptic.tap()
  }

  function goPrev() {
    setCurrentIndex(i => Math.max(0, i - 1))
    soundManager.play('buttonTap')
    haptic.tap()
  }

  async function submit() {
    if (!questions || !allAnswered) return
    setPhase('submitting')
    setSubmitError(null)
    soundManager.play('buttonTap')
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
      // Result feedback: perfect 10/10 → fanfare; pass → quiz-complete; fail → wrong-answer cue.
      if (r.passed && r.correctCount === r.totalQuestions) {
        soundManager.play('perfectScore')
        haptic.tierUp()
      } else if (r.passed) {
        soundManager.play('quizComplete')
        haptic.correct()
      } else {
        soundManager.play('wrongAnswer')
        haptic.wrong()
      }
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
        <span className="material-symbols-outlined text-5xl text-bq-ruby" style={FILL_1}>error</span>
        <h2 className="text-xl font-bold text-bq-ink">{t('basicQuiz.page.errorTitle')}</h2>
        <p className="text-sm text-bq-ink2">{t('basicQuiz.page.errorMessage')}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => refetch()}
            className="bg-bq-action text-bq-ink shadow-bq-action px-5 py-2.5 rounded-xl font-bold"
          >
            {t('basicQuiz.page.retryLoad')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-bq-white border border-bq-hair text-bq-ink px-5 py-2.5 rounded-xl font-bold"
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
    <div data-testid="basic-quiz-page" className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Header + progress */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl sm:text-2xl font-black text-bq-ink flex items-center gap-2">
            <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>menu_book</span>
            {t('basicQuiz.page.title')}
          </h1>
          <span data-testid="basic-quiz-counter" className="text-sm font-bold text-bq-ink2">
            {t('basicQuiz.page.counter', { current: currentIndex + 1, total: totalQuestions })}
          </span>
        </div>
        <div
          data-testid="basic-quiz-progress"
          aria-valuenow={currentIndex + 1}
          aria-valuemax={totalQuestions}
          role="progressbar"
          className="h-2 rounded-full bg-bq-inset overflow-hidden"
        >
          <div
            className="h-full bg-bq-action transition-all"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      {/* Question */}
      {currentQuestion && (
        <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 data-testid="basic-quiz-question" className="text-xl sm:text-2xl font-bold text-bq-ink">
            {currentQuestion.content}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      ? 'border-bq-amberd bg-bq-amber/10 shadow-bq-amb'
                      : 'border-bq-hair bg-bq-inset hover:bg-bq-white hover:border-bq-amberd/40')
                  }
                >
                  <span
                    className={
                      'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black ' +
                      (isSelected ? 'bg-bq-action text-bq-ink' : 'bg-bq-white text-bq-amberd')
                    }
                  >
                    {LETTERS[idx]}
                  </span>
                  <span className={'pt-1.5 text-base ' + (isSelected ? 'text-bq-amberd font-semibold' : 'text-bq-ink')}>
                    {option}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {submitError && (
        <div data-testid="basic-quiz-submit-error" className="rounded-xl border border-bq-ruby/30 bg-bq-ruby/10 p-4 text-sm text-bq-ruby">
          {submitError}
        </div>
      )}

      {/* Footer controls */}
      <footer className="flex items-center justify-between gap-3">
        <button
          data-testid="basic-quiz-prev"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-5 py-2.5 rounded-xl font-bold bg-bq-white border border-bq-hair text-bq-ink disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('basicQuiz.page.prev')}
        </button>
        {currentIndex < totalQuestions - 1 ? (
          <button
            data-testid="basic-quiz-next"
            onClick={goNext}
            disabled={answers[currentIndex] == null}
            className="bg-bq-action text-bq-ink shadow-bq-action px-6 py-2.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('basicQuiz.page.next')}
          </button>
        ) : (
          <button
            data-testid="basic-quiz-submit"
            onClick={submit}
            disabled={!allAnswered || phase === 'submitting'}
            className="bg-bq-action text-bq-ink shadow-bq-action px-6 py-2.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {phase === 'submitting' ? t('basicQuiz.page.submitting') : t('basicQuiz.page.submit')}
          </button>
        )}
      </footer>
    </div>
  )
}

/* ── Shared review list ── used by both Pass and Fail screens. */
function ReviewList({ reviews }: { reviews: Review[] }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-3">
      {reviews.map((r, idx) => {
        const correctIdx = r.correctOptions[0] ?? -1
        const selectedIdx = r.selectedOptions[0]
        return (
          <li
            key={r.questionId}
            data-testid={`basic-quiz-review-${idx}`}
            data-correct={r.correct ? 'true' : 'false'}
            className={
              'rounded-2xl border p-5 space-y-3 ' +
              (r.correct
                ? 'border-bq-emerald/20 bg-bq-emerald/5'
                : 'border-bq-ruby/20 bg-bq-inset')
            }
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-bq-ink flex-1">{r.content}</p>
              <span
                className={
                  'shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ' +
                  (r.correct
                    ? 'bg-bq-emerald/15 text-bq-emerald'
                    : 'bg-bq-ruby/15 text-bq-ruby')
                }
              >
                <span className="material-symbols-outlined text-sm" style={FILL_1}>
                  {r.correct ? 'check_circle' : 'cancel'}
                </span>
                {r.correct ? t('basicQuiz.page.reviewCorrectBadge') : t('basicQuiz.page.reviewWrongBadge')}
              </span>
            </div>

            {!r.correct && (
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-bq-ruby/30 bg-bq-ruby/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-bq-ruby font-bold mb-1">
                    {t('basicQuiz.page.failYourAnswer')}
                  </div>
                  <div className="text-bq-ink">
                    {selectedIdx != null && r.options[selectedIdx]
                      ? `${LETTERS[selectedIdx] ?? ''}. ${r.options[selectedIdx]}`
                      : t('basicQuiz.page.failSkipped')}
                  </div>
                </div>
                <div className="rounded-lg border border-bq-emerald/30 bg-bq-emerald/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-bq-emerald font-bold mb-1">
                    {t('basicQuiz.page.failCorrectAnswer')}
                  </div>
                  <div className="text-bq-ink">
                    {correctIdx >= 0 ? `${LETTERS[correctIdx] ?? ''}. ${r.options[correctIdx]}` : '—'}
                  </div>
                </div>
              </div>
            )}

            {r.correct && correctIdx >= 0 && (
              <div className="text-sm rounded-lg border border-bq-emerald/30 bg-bq-emerald/5 p-3">
                <div className="text-[10px] uppercase tracking-widest text-bq-emerald font-bold mb-1">
                  {t('basicQuiz.page.failCorrectAnswer')}
                </div>
                <div className="text-bq-ink">
                  {`${LETTERS[correctIdx] ?? ''}. ${r.options[correctIdx]}`}
                </div>
              </div>
            )}

            {r.explanation && (
              <p className="text-sm text-bq-ink2 flex gap-2">
                <span className="text-bq-amberd shrink-0">💡</span>
                <span>{r.explanation}</span>
              </p>
            )}
          </li>
        )
      })}
    </ul>
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
    <div data-testid="basic-quiz-result-pass" className="max-w-4xl mx-auto py-10 space-y-6">
      <header className="text-center space-y-4">
        <div className="text-7xl">🎉</div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-bq-ink">
            {t('basicQuiz.page.passTitle')}
          </h2>
          <p className="text-bq-ink2">
            {t('basicQuiz.page.passSubtitle', { correct: result.correctCount, total: result.totalQuestions })}
          </p>
        </div>
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 inline-flex items-center gap-3 mx-auto">
          <span className="material-symbols-outlined text-bq-amberd text-3xl" style={FILL_1}>verified</span>
          <span className="text-base font-bold text-bq-amberd">{t('basicQuiz.page.passUnlock')}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            data-testid="basic-quiz-pass-cta"
            onClick={onPlayRanked}
            className="bg-bq-action text-bq-ink shadow-bq-action px-6 py-3 rounded-xl font-bold"
          >
            <span className="material-symbols-outlined align-middle text-base mr-1" style={FILL_1}>play_arrow</span>
            {t('basicQuiz.page.passCta')}
          </button>
          <button
            onClick={onHome}
            className="bg-bq-white border border-bq-hair text-bq-ink px-6 py-3 rounded-xl font-bold"
          >
            {t('basicQuiz.page.backHome')}
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-bq-ink flex items-center gap-2">
          <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>menu_book</span>
          {t('basicQuiz.page.reviewAll')}
        </h3>
        <ReviewList reviews={result.reviews} />
      </section>
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
    <div data-testid="basic-quiz-result-fail" className="max-w-4xl mx-auto py-10 space-y-6">
      <header className="text-center space-y-3">
        <div className="text-6xl">😅</div>
        <h2 className="font-display text-2xl font-black text-bq-ink">
          {t('basicQuiz.page.failTitle', { correct: result.correctCount, total: result.totalQuestions })}
        </h2>
        <p className="text-bq-ink2">
          {t('basicQuiz.page.failSubtitle', { threshold: result.threshold })}
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-bq-ink flex items-center gap-2">
          <span className="material-symbols-outlined text-bq-amberd" style={FILL_1}>menu_book</span>
          {t('basicQuiz.page.reviewAll')}
        </h3>
        <ReviewList reviews={result.reviews} />
      </section>

      <footer className="rounded-2xl bg-bq-inset border border-bq-hair p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span data-testid="basic-quiz-fail-cooldown" className="text-sm text-bq-ink2 flex items-center gap-2">
          <span className="material-symbols-outlined text-bq-amberd">timer</span>
          {t('basicQuiz.page.cooldownMessage', { time: formatMmSs(cooldownLeft) })}
        </span>
        <button
          onClick={onHome}
          className="bg-bq-white border border-bq-hair text-bq-ink px-6 py-2.5 rounded-xl font-bold w-full sm:w-auto"
        >
          {t('basicQuiz.page.backHome')}
        </button>
      </footer>
    </div>
  )
}
