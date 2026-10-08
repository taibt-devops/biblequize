import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import { Medal, PlaceBackdrop, Plaque, ScrollPanel, lkClass } from '../components/lk/Place'

const LETTERS = ['A', 'B', 'C', 'D']
// same colours as the quiz answer boards (C5): A coral, B sky, C gold, D sage
const BOARD = ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d']

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
    <div data-testid="basic-quiz-skeleton" className="relative max-w-4xl mx-auto py-8 space-y-6 animate-pulse">
      <PlaceBackdrop place="arena" veil="strong" />
      <div className="h-12 w-72 rounded-xl bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      <div className="h-36 rounded-bq bg-bq-inset/80 border-[3px] border-bq-ink/20" />
      <div className="grid md:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-[18px] bg-bq-inset/80 border-[3px] border-bq-ink/20" />)}
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
      <div data-testid="basic-quiz-error" className="relative max-w-md mx-auto py-14 px-4">
        <PlaceBackdrop place="arena" veil="strong" />
        <div className="p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card space-y-3">
          <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="mx-auto h-32" />
          <h2 className="m-0 font-display text-[22px] font-extrabold text-bq-ink">{t('basicQuiz.page.errorTitle')}</h2>
          <p className="m-0 font-read text-[15px] text-bq-ink2">{t('basicQuiz.page.errorMessage')}</p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <button onClick={() => refetch()} className="lk-btn text-bq-ink text-[16px]">
              {t('basicQuiz.page.retryLoad')}
            </button>
            <button onClick={() => navigate('/')} className="lk-btn !bg-bq-white text-bq-ink text-[16px]">
              {t('basicQuiz.page.backHome')}
            </button>
          </div>
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
    <div data-testid="basic-quiz-page" className="relative max-w-4xl mx-auto py-2 md:py-6 space-y-5">
      <PlaceBackdrop place="arena" veil="strong" />
      {/* title + counter, then one stone per question */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Plaque className="text-[24px] md:text-[32px]">
            <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-[1em]" />
            {t('basicQuiz.page.title')}
          </Plaque>
          <span data-testid="basic-quiz-counter" className="px-3.5 py-1 bg-bq-white border-[3px] border-bq-ink rounded-full text-[16px] font-extrabold tabular-nums shadow-[0_3px_0_#1D2B22]">
            {t('basicQuiz.page.counter', { current: currentIndex + 1, total: totalQuestions })}
          </span>
        </div>
        <div
          data-testid="basic-quiz-progress"
          aria-valuenow={currentIndex + 1}
          aria-valuemax={totalQuestions}
          role="progressbar"
          className="flex items-center gap-1.5 md:gap-2"
        >
          {questions.map((q, i) => (
            <span
              key={q.id}
              aria-hidden
              className={
                'flex-1 h-3.5 md:h-4 rounded-full border-2 border-bq-ink transition-colors ' +
                (i === currentIndex ? 'bg-bq-amber ring-2 ring-bq-ink ring-offset-2 ring-offset-bq-paper' : answers[i] != null ? 'bg-bq-amber' : 'bg-bq-track')
              }
            />
          ))}
        </div>
      </header>

      {/* question on the scroll, answers as the quiz signboards */}
      {currentQuestion && (
        <>
          <ScrollPanel bodyClassName="px-6 md:px-10 py-6 md:py-8 text-center">
            <h2 data-testid="basic-quiz-question" className="m-0 font-read text-[21px] md:text-[26px] font-bold leading-snug text-bq-ink">
              {currentQuestion.content}
            </h2>
          </ScrollPanel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = answers[currentIndex] === idx
              return (
                <button
                  key={idx}
                  data-testid={`basic-quiz-option-${idx}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  onClick={() => pickOption(idx)}
                  className={
                    'w-full flex items-center gap-3 md:gap-4 px-3.5 py-2.5 md:px-5 md:py-4 min-h-[58px] md:min-h-[78px] rounded-[18px] md:rounded-[20px] border-[3px] border-bq-ink text-left transition-all ' +
                    BOARD[idx % 4] + ' ' +
                    (isSelected
                      ? 'translate-y-1 shadow-bq-btn-down ring-[3px] ring-bq-ink ring-offset-2 ring-offset-bq-paper'
                      : 'shadow-bq-btn hover:brightness-105 active:translate-y-1 active:shadow-bq-btn-down')
                  }
                >
                  <span className={'shrink-0 w-9 h-9 md:w-11 md:h-11 grid place-items-center rounded-full border-[3px] border-bq-ink font-extrabold text-[17px] md:text-[20px] ' + (isSelected ? 'bg-bq-ink text-bq-amber' : 'bg-bq-white text-bq-ink')}>
                    {isSelected ? '✓' : LETTERS[idx]}
                  </span>
                  <span className="flex-1 text-[18px] md:text-[21px] font-bold leading-snug text-bq-ink">
                    {option}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {submitError && (
        <div data-testid="basic-quiz-submit-error" className="rounded-2xl border-[3px] border-bq-ruby bg-bq-white p-4 text-[15px] font-bold text-bq-ruby">
          {submitError}
        </div>
      )}

      {/* back / next / submit */}
      <footer className="flex items-center justify-between gap-3 pt-1">
        <button
          data-testid="basic-quiz-prev"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="lk-btn !bg-bq-white text-bq-ink text-[16px]"
        >
          ← {t('basicQuiz.page.prev')}
        </button>
        {currentIndex < totalQuestions - 1 ? (
          <button
            data-testid="basic-quiz-next"
            onClick={goNext}
            disabled={answers[currentIndex] == null}
            className="lk-btn text-bq-ink text-[16px]"
          >
            {t('basicQuiz.page.next')} →
          </button>
        ) : (
          <button
            data-testid="basic-quiz-submit"
            onClick={submit}
            disabled={!allAnswered || phase === 'submitting'}
            className="lk-btn lk-btn-2 text-bq-ink text-[17px]"
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
    <ul className="m-0 p-0 list-none space-y-3">
      {reviews.map((r, idx) => {
        const correctIdx = r.correctOptions[0] ?? -1
        const selectedIdx = r.selectedOptions[0]
        return (
          <li
            key={r.questionId}
            data-testid={`basic-quiz-review-${idx}`}
            data-correct={r.correct ? 'true' : 'false'}
            className="relative bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-bq-card overflow-hidden"
          >
            <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-2.5 border-r-[3px] border-bq-ink ${r.correct ? 'bg-bq-leaf' : 'bg-bq-ruby'}`} />
            <div className="pl-6 pr-4 py-4 md:pl-8 md:pr-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="m-0 flex-1 font-read text-[16px] font-bold text-bq-ink">{idx + 1}. {r.content}</p>
                <span
                  className={
                    'shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border-2 border-bq-ink text-[13px] font-extrabold ' +
                    (r.correct ? 'bg-bq-leaf text-bq-ink' : 'bg-bq-ruby text-bq-white')
                  }
                >
                  {r.correct ? '✓' : '✗'} {r.correct ? t('basicQuiz.page.reviewCorrectBadge') : t('basicQuiz.page.reviewWrongBadge')}
                </span>
              </div>

              <div className={`grid gap-2 text-[15px] ${r.correct ? '' : 'sm:grid-cols-2'}`}>
                {!r.correct && (
                  <div className="rounded-xl border-2 border-bq-ruby bg-bq-ruby/10 px-3 py-2">
                    <div className="text-[12.5px] font-extrabold text-bq-ruby">{t('basicQuiz.page.failYourAnswer')}</div>
                    <div className="font-bold text-bq-ink">
                      {selectedIdx != null && r.options[selectedIdx]
                        ? `${LETTERS[selectedIdx] ?? ''}. ${r.options[selectedIdx]}`
                        : t('basicQuiz.page.failSkipped')}
                    </div>
                  </div>
                )}
                {correctIdx >= 0 && (
                  <div className="rounded-xl border-2 border-bq-ink bg-bq-leaf/60 px-3 py-2">
                    <div className="text-[12.5px] font-extrabold text-bq-ink2">{t('basicQuiz.page.failCorrectAnswer')}</div>
                    <div className="font-bold text-bq-ink">{`${LETTERS[correctIdx] ?? ''}. ${r.options[correctIdx]}`}</div>
                  </div>
                )}
              </div>

              {r.explanation && (
                <p className="m-0 px-3 py-2 bg-bq-cream border-2 border-dashed border-bq-ink/40 rounded-xl font-read text-[14.5px] leading-relaxed text-bq-ink2">
                  {r.explanation}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Result screen — Pass: the arena gate opens ── */
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
    <div data-testid="basic-quiz-result-pass" className="relative max-w-3xl mx-auto py-4 md:py-8 space-y-7">
      <PlaceBackdrop place="arena" veil="mid" />
      <ScrollPanel bodyClassName="px-6 md:px-10 py-6 text-center">
        <img src="/images/lk/hero-cheer.webp" alt="" aria-hidden className={`mx-auto h-[110px] ${lkClass.bob}`} />
        <h2 className="m-0 mt-2 font-display text-[30px] md:text-[36px] font-extrabold text-bq-amberd">
          {t('basicQuiz.page.passTitle')}
        </h2>
        <p className="m-0 mt-1 font-read text-[15px] md:text-[16px] text-bq-ink2">
          {t('basicQuiz.page.passSubtitle', { correct: result.correctCount, total: result.totalQuestions })}
        </p>
        <div className="mt-5 inline-flex items-center gap-3 pl-2 pr-4 py-2 bg-bq-amber border-[3px] border-bq-ink rounded-full shadow-[0_4px_0_#1D2B22]">
          <Medal size={44}><img src="/images/lk/sword.webp" alt="" aria-hidden className="h-7" /></Medal>
          <span className="text-[16px] font-extrabold text-bq-ink">{t('basicQuiz.page.passUnlock')}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
          <button data-testid="basic-quiz-pass-cta" onClick={onPlayRanked} className="lk-btn text-bq-ink text-[17px]">
            <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />
            {t('basicQuiz.page.passCta')}
          </button>
          <button onClick={onHome} className="lk-btn !bg-bq-white text-bq-ink text-[16px]">
            {t('basicQuiz.page.backHome')}
          </button>
        </div>
      </ScrollPanel>

      <section className="space-y-3">
        <Plaque as="h3" className="text-[20px] md:text-[22px]">{t('basicQuiz.page.reviewAll')}</Plaque>
        <ReviewList reviews={result.reviews} />
      </section>
    </div>
  )
}

/* ── Result screen — Fail: rest, read the notes, come back after the cooldown ── */
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
    <div data-testid="basic-quiz-result-fail" className="relative max-w-3xl mx-auto py-4 md:py-8 space-y-7">
      <PlaceBackdrop place="arena" veil="strong" />
      <ScrollPanel bodyClassName="px-6 md:px-10 py-6 text-center">
        <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-[104px]" />
        <h2 className="m-0 mt-2 font-display text-[26px] md:text-[30px] font-extrabold text-bq-ink">
          {t('basicQuiz.page.failTitle', { correct: result.correctCount, total: result.totalQuestions })}
        </h2>
        <p className="m-0 mt-1 font-read text-[15px] md:text-[16px] text-bq-ink2">
          {t('basicQuiz.page.failSubtitle', { threshold: result.threshold })}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span data-testid="basic-quiz-fail-cooldown" className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-bq-cream border-2 border-bq-ink rounded-full text-[14px] font-extrabold tabular-nums">
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-5" />
            {t('basicQuiz.page.cooldownMessage', { time: formatMmSs(cooldownLeft) })}
          </span>
          <button onClick={onHome} className="lk-btn !bg-bq-white text-bq-ink text-[15px]">
            {t('basicQuiz.page.backHome')}
          </button>
        </div>
      </ScrollPanel>

      <section className="space-y-3">
        <Plaque as="h3" className="text-[20px] md:text-[22px]">{t('basicQuiz.page.reviewAll')}</Plaque>
        <ReviewList reviews={result.reviews} />
      </section>
    </div>
  )
}
