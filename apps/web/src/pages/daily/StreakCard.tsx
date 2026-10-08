import { useTranslation } from 'react-i18next'

interface StreakCardProps {
  currentStreak: number
  last7Days: { label: string; date: string; isToday: boolean; completed: boolean }[]
  /** Per-tier streak-freeze allowance (1 = T1-T2, 2 = T3-T4, 3 = T5-T6).
   *  Decision 2026-05-19 (option B): we surface only the per-week benefit
   *  count and drop the "used/total" framing because the BE entity is a
   *  Boolean (`User.streakFreezeUsedThisWeek`) so it can't truthfully
   *  represent partial-use for tiers with allowance > 1. */
  freezesPerWeek?: number
}

const MILESTONES = [7, 14, 30, 60, 100, 365]

/**
 * Streak on /daily (LKF-10): the lantern that stays lit (bigger from 7 days), the next milestone,
 * a row of 7 day lanterns (lit = done, dashed = today still open) and the weekly freezes.
 */
export function StreakCard({ currentStreak, last7Days, freezesPerWeek = 1 }: StreakCardProps) {
  const { t } = useTranslation()
  // a 1-day streak must not own the biggest graphic on the page (DC-4)
  const isHighStreak = currentStreak >= 7

  const nextMilestone = MILESTONES.find((m) => m > currentStreak)
  const caption =
    currentStreak === 0
      ? t('daily.streakFresh')
      : nextMilestone
        ? t('daily.streakNextMilestone', { count: nextMilestone - currentStreak, milestone: nextMilestone })
        : t('daily.streakLegendary', { count: currentStreak })

  return (
    <div
      data-testid="daily-streak-display"
      className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-5"
    >
      <div className="font-display text-[19px] font-extrabold text-bq-ink">{t('daily.streakTitle')}</div>
      <div className="flex items-center justify-center gap-4 pt-3 pb-1">
        <img
          src={currentStreak > 0 ? '/images/lk/lantern-on.webp' : '/images/lk/lantern-off.webp'}
          alt=""
          aria-hidden
          className={isHighStreak ? 'h-[72px]' : 'h-[56px]'}
        />
        <div className="text-left">
          <div className={`font-display font-extrabold leading-none text-bq-ink ${isHighStreak ? 'text-[48px]' : 'text-[40px]'}`}>{currentStreak}</div>
          <div className="text-[13px] font-bold text-bq-ink2 mt-1">{t('daily.streakDaysLine')}</div>
        </div>
      </div>
      <div className="font-read text-[14px] text-center text-bq-ink2 mb-1">{caption}</div>

      {/* the last 7 days as small lanterns: lit = done, dashed = today still open */}
      <div className="flex justify-around gap-1.5 mt-4">
        {last7Days.map((d) => {
          const cls = d.completed
            ? 'bg-bq-amber border-bq-ink text-bq-ink'
            : d.isToday
              ? 'bg-bq-cream border-dashed border-bq-ink text-bq-ink'
              : 'bg-bq-paper border-bq-ink/25 text-bq-ink3'
          // always show the day label: done / missed / today read by fill + border, not hidden text
          return (
            <div
              key={d.date}
              className={`w-11 h-11 rounded-full border-[3px] grid place-items-center text-[12px] font-extrabold flex-shrink-0 ${cls}`}
            >
              {d.label}
            </div>
          )
        })}
      </div>

      <div className="mt-4 px-3 py-2 bg-bq-sapphire/10 border-2 border-bq-ink rounded-full flex items-center justify-between text-[13.5px]">
        <span className="font-bold text-bq-ink flex items-center gap-1.5">
          <span aria-hidden className="text-bq-sapphire">❄</span>
          {t('daily.freezeIndicator')}
        </span>
        <span className="text-bq-ink font-extrabold">
          {t('daily.freezePerWeek', { count: freezesPerWeek })}
        </span>
      </div>
    </div>
  )
}
