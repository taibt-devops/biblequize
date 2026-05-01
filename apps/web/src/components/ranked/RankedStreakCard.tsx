import { useTranslation } from 'react-i18next'

interface RankedStreakCardProps {
  streak: number
}

/**
 * Streak card on /ranked — second slot in the 1.5fr / 1fr top row.
 * Mockup pattern (line 102-114): orange-tinted bg, 🔥 + label + big
 * number + motivational sub-text mentioning the 7-day "Diligent"
 * badge.
 *
 * Note: this card lives in the main content area so the streak signal
 * is always visible to the user — sidebar widgets on /ranked dropped
 * the generic StreakWidget per RK-P0-1 (which would have duplicated
 * with this card).
 */
export default function RankedStreakCard({ streak }: RankedStreakCardProps) {
  const { t } = useTranslation()

  return (
    <section
      data-testid="ranked-streak-card"
      className="rounded-2xl border p-4 md:p-5 flex flex-col"
      style={{
        background: 'rgba(255,140,66,0.06)',
        borderColor: 'rgba(255,140,66,0.3)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🔥</span>
        <span
          className="text-[11px] font-medium tracking-wider uppercase"
          style={{ color: 'rgba(255,140,66,0.8)' }}
        >
          {t('ranked.streakHeader')}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span
          data-testid="ranked-streak-count"
          className="text-[32px] font-medium leading-none"
          style={{ color: '#ff8c42' }}
        >
          {streak}
        </span>
        <span className="text-on-surface-variant/50 text-[12px]">
          {t('ranked.streakDays', { count: streak }).replace(/^\d+\s*/, '')}
        </span>
      </div>

      <p
        className="text-[11px] leading-snug"
        style={{ color: 'rgba(255,140,66,0.7)' }}
      >
        {streak > 0
          ? t('ranked.streakKeepGoing')
          : t('ranked.streakBadgeHint')}
      </p>
    </section>
  )
}
