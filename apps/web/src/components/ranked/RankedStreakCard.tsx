import { useTranslation } from 'react-i18next'

interface RankedStreakCardProps {
  streak: number
}

/**
 * Streak card — compact stat tile sized to fit the 3-col row alongside
 * Questions + Points (mockup 2026-05-20). Anatomy: 🔥 icon top-center,
 * big orange number, uppercase label "NGÀY STREAK". The longer
 * motivational copy (kept-going / badge hint) moved to `title` so the
 * encouragement is still there on hover without bloating the tile.
 */
export default function RankedStreakCard({ streak }: RankedStreakCardProps) {
  const { t } = useTranslation()
  const hint = streak > 0 ? t('ranked.streakKeepGoing') : t('ranked.streakBadgeHint')

  return (
    <section
      data-testid="ranked-streak-card"
      className="rounded-2xl border p-3 md:p-4 flex flex-col items-center text-center"
      style={{
        background: 'rgba(255,140,66,0.06)',
        borderColor: 'rgba(255,140,66,0.3)',
      }}
      title={hint}
    >
      <span className="text-base mb-1">🔥</span>
      <span
        data-testid="ranked-streak-count"
        className="text-[22px] md:text-[24px] font-medium leading-none"
        style={{ color: '#ff8c42' }}
      >
        {streak}
      </span>
      <span
        className="text-[11.5px] md:text-[10px] mt-1.5"
        style={{ color: 'rgba(255,140,66,0.8)' }}
      >
        {t('ranked.streakHeader')}
      </span>
    </section>
  )
}
