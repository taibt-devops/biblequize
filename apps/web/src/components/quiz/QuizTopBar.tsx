import { useTranslation } from 'react-i18next'

interface QuizTopBarProps {
  onQuit: () => void
  modeLabel: string
  bookLabel: string
  /** 1-based index of the question on screen. */
  current: number
  total: number
  /** Energy 0-100; null hides the chip (Practice has no energy). */
  energy: number | null
  energyRaw?: number | null
  score: number
}

const DOT_LIMIT = 20

/**
 * Floating chip row over the painted meadow (LKF-4, Lu Khach mockup):
 * quit · mode + book · progress (one dot per question, the traveller stands on
 * the current one) · energy · score. Phones keep quit · progress bar · energy.
 */
export default function QuizTopBar({ onQuit, modeLabel, bookLabel, current, total, energy, energyRaw, score }: QuizTopBarProps) {
  const { t } = useTranslation()
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  const left = Math.max(0, total - current)
  const useDots = total > 1 && total <= DOT_LIMIT
  const chip = 'bg-bq-white border-[3px] border-bq-ink'

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <button
        type="button"
        onClick={onQuit}
        aria-label={t('quiz.lk.quit')}
        className={`${chip} shrink-0 w-11 h-11 md:w-12 md:h-12 grid place-items-center rounded-[14px] md:rounded-2xl shadow-[0_5px_0_#1D2B22] active:translate-y-1 active:shadow-[0_1px_0_#1D2B22] transition-transform`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="#1D2B22" strokeWidth="3.2" strokeLinecap="round" /></svg>
      </button>

      <div className={`${chip} hidden md:block shrink-0 max-w-[240px] px-4 py-1 rounded-2xl`}>
        <div className="text-[14px] font-bold text-bq-ink3 leading-tight">{modeLabel}</div>
        <div className="text-[18px] font-extrabold leading-tight truncate">{bookLabel}</div>
      </div>

      <div className={`${chip} flex-1 min-w-0 px-3 md:px-4 py-1 md:py-2 rounded-[14px] md:rounded-2xl`}>
        <div className="relative z-10 flex justify-between gap-2 text-[14px] md:text-[15px] font-extrabold leading-tight">
          <span data-testid="quiz-progress" className="whitespace-nowrap bg-bq-white rounded pr-1">{t('quiz.lk.questionOf', { current, total })}</span>
          <span className="text-bq-ink3 truncate bg-bq-white rounded pl-1">
            <span className="md:hidden">{bookLabel}</span>
            <span className="hidden md:inline">{t('quiz.lk.left', { count: left })}</span>
          </span>
        </div>

        {/* Phones (and long quizzes): a gold bar */}
        <div className={`${useDots ? 'md:hidden' : ''} relative h-[10px] md:h-[14px] mt-1 mb-0.5 bg-bq-track border-2 border-bq-ink rounded-full`}>
          <div className="h-full bg-bq-amber rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
          <img src="/images/lk/hero.webp" alt="" aria-hidden className="hidden md:block absolute bottom-[3px] h-9 -translate-x-1/2 transition-[left] duration-500" style={{ left: `${pct}%` }} />
        </div>

        {/* Desktop, up to 20 questions: one dot per question, the traveller on the current one */}
        {useDots && (
          <div className="hidden md:flex relative items-center justify-between h-[26px] mt-0.5">
            <div aria-hidden className="absolute inset-x-0 top-[11px] h-1 bg-bq-hair rounded-sm" />
            <div aria-hidden className="absolute left-0 top-[11px] h-1 bg-bq-ink rounded-sm transition-[width] duration-500" style={{ width: `${((current - 1) / (total - 1)) * 100}%` }} />
            {Array.from({ length: total }, (_, i) => {
              const here = i === current - 1
              return (
                <span
                  key={i}
                  className={`relative box-border rounded-full border-2 border-bq-ink ${here ? 'w-[22px] h-[22px] bg-bq-white' : 'w-4 h-4'} ${i < current - 1 ? 'bg-bq-amber' : here ? '' : 'bg-bq-track'}`}
                >
                  {here && (
                    <img
                      src="/images/lk/hero.webp"
                      alt={t('quiz.lk.youAreAt', { current })}
                      className="absolute left-1/2 bottom-4 h-[42px] -translate-x-1/2 motion-safe:animate-bob"
                    />
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {energy != null && (
        <span
          data-testid="quiz-energy-bar"
          data-energy={energyRaw ?? ''}
          className={`${chip} shrink-0 flex items-center gap-1 md:gap-1.5 pl-1.5 md:pl-2 pr-2.5 md:pr-3.5 py-1 rounded-[14px] md:rounded-full font-extrabold text-[16px] md:text-[18px] tabular-nums`}
        >
          <img src="/images/lk/heart.webp" alt="" aria-hidden className="h-5 md:h-[26px]" />
          {Math.round(energy)}
        </span>
      )}

      <span data-testid="quiz-score" className={`${chip} hidden md:flex shrink-0 items-center gap-1.5 pl-2 pr-3.5 py-1 rounded-full font-extrabold text-[18px] tabular-nums`}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#FFC93C" stroke="#1D2B22" strokeWidth="2" strokeLinejoin="round" /></svg>
        {score.toLocaleString('vi-VN')}
      </span>
    </div>
  )
}
