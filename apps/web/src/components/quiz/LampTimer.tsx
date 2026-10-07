import { useTranslation } from 'react-i18next'

interface LampTimerProps {
  secondsLeft: number
  totalSeconds: number
  testId?: string
}

/**
 * "Lamp oil" countdown on the quiz scroll (LKF-4, Lu Khach mockup): the
 * lantern's oil bar burns down with the time left, turns ember under a third
 * and ruby for the last 5 seconds; the lantern goes dark at 0.
 */
export default function LampTimer({ secondsLeft, totalSeconds, testId = 'quiz-timer' }: LampTimerProps) {
  const { t } = useTranslation()
  const secs = Math.max(0, Math.ceil(secondsLeft))
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100)) : 0
  const critical = secs <= 5
  const low = pct <= 33
  const fill = critical ? 'bg-bq-ruby' : low ? 'bg-bq-ember' : 'bg-bq-amber'

  return (
    <div
      data-testid={testId}
      data-seconds={secs}
      className="flex items-center gap-1.5 md:gap-2.5 flex-1 min-w-0 max-w-[340px]"
    >
      <img
        src={secs > 0 ? '/images/lk/lantern-on.webp' : '/images/lk/lantern-off.webp'}
        alt=""
        aria-hidden
        className={`h-7 md:h-10 shrink-0 ${critical && secs > 0 ? 'motion-safe:animate-pulse' : ''}`}
      />
      <div className="flex-1 min-w-0 max-w-[110px] md:max-w-none">
        <div className="hidden md:block text-[14px] font-bold text-bq-ink3 leading-tight">{t('quiz.lk.lamp')}</div>
        <div
          role="progressbar"
          aria-label={t('quiz.lk.lampAria', { count: secs })}
          aria-valuenow={secs}
          aria-valuemin={0}
          aria-valuemax={totalSeconds}
          className="h-[11px] md:h-[14px] bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden"
        >
          <div className={`h-full ${fill} transition-[width] duration-1000 ease-linear`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`shrink-0 font-extrabold text-[15px] md:text-[20px] tabular-nums ${critical ? 'text-bq-ruby' : ''}`}>{secs}s</span>
    </div>
  )
}
