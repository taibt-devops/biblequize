import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

interface QuizFeedbackProps {
  isCorrect: boolean
  /** Server score not back yet (ranked): show "scoring…" instead of "+0". */
  pending: boolean
  points: number
  combo: number
  correctLetter: string
  correctText: string
  explanation?: string | null
  verseRef?: string | null
  isLast: boolean
  onNext: () => void
  onBookmark?: () => void
}

/**
 * Answer feedback (LKF-4, Lu Khach mockup): the traveller cheers or waits,
 * verdict + reward on one line, the explanation always visible, "Câu tiếp
 * theo" on the right. Desktop: a card under the answers. Phones: a sheet
 * pinned to the bottom of the screen.
 */
const QuizFeedback = forwardRef<HTMLElement, QuizFeedbackProps>(function QuizFeedback(p, ref) {
  const { t } = useTranslation()
  const reward = p.isCorrect
    ? (p.pending ? t('quiz.calculatingPoints') : t('quiz.lk.points', { points: p.points }) + (p.combo >= 2 ? t('quiz.lk.comboSuffix', { count: p.combo }) : ''))
    : t('quiz.lk.correctIs', { letter: p.correctLetter, answer: p.correctText })

  return (
    <section
      ref={ref}
      data-testid="quiz-answer-feedback"
      aria-live="polite"
      className="fixed md:relative inset-x-0 bottom-0 z-50 md:z-auto px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] md:px-6 md:py-4 bg-bq-white border-t-[3px] md:border-[3px] border-bq-ink rounded-t-[26px] md:rounded-bq shadow-[0_-6px_0_rgba(29,43,34,.25)] md:shadow-bq-card animate-slide-up"
    >
      <img
        src={p.isCorrect ? '/images/lk/hero-cheer.webp' : '/images/lk/hero.webp'}
        alt=""
        aria-hidden
        className="absolute left-3.5 -top-11 h-[118px] md:left-[22px] md:top-auto md:bottom-1.5 md:h-[150px]"
      />
      <div className="md:flex md:items-center md:gap-6">
        <div className="pl-[104px] md:pl-[128px] flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
            <span className={`text-[26px] md:text-[30px] font-extrabold leading-none ${p.isCorrect ? 'text-bq-emerald' : 'text-bq-ruby'}`}>
              {p.isCorrect ? t('quiz.lk.right') : t('quiz.lk.wrong')}
            </span>
            <span data-testid="quiz-score-delta" className="text-[16px] md:text-[19px] font-extrabold">{reward}</span>
          </div>
          {p.explanation && (
            <p data-testid="quiz-explanation" className="mt-1 font-read text-[13px] md:text-[15px] leading-relaxed text-bq-ink2 max-h-[84px] md:max-h-none overflow-y-auto">
              {p.explanation}
              {p.verseRef && <span className="font-semibold text-bq-amberd"> ({p.verseRef})</span>}
            </p>
          )}
          {!p.isCorrect && p.onBookmark && (
            <button type="button" onClick={p.onBookmark} className="mt-1 text-[13px] font-bold text-bq-amberd underline underline-offset-2 hover:text-bq-ink">
              {t('quiz.lk.bookmark')}
            </button>
          )}
        </div>
        <button
          type="button"
          data-testid="quiz-next-btn"
          onClick={p.onNext}
          className="mt-3 md:mt-0 w-full md:w-auto shrink-0 px-7 py-2.5 md:py-3 bg-bq-amber border-[3px] border-bq-ink rounded-bq-btn shadow-[0_6px_0_#1D2B22] font-extrabold text-[20px] md:text-[22px] whitespace-nowrap active:translate-y-1 active:shadow-[0_2px_0_#1D2B22] transition-transform"
        >
          {p.isLast ? t('quiz.lk.results') : t('quiz.lk.next')}
        </button>
      </div>
    </section>
  )
})

export default QuizFeedback
