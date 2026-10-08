import { useTranslation } from 'react-i18next'

interface DailyStatsCardsProps {
  questionsAnswered: number
  questionsCap: number
  pointsToday: number
  /** Today − yesterday points. null when no yesterday baseline. */
  dailyDelta: number | null
  /** Points needed to reach top 100/50/10. null when already in or no
   *  active season. R10 may add pointsToTop100; until then we fall back
   *  to whichever lower top-N field is available. */
  pointsToTop100?: number | null
  pointsToTop50?: number | null
  pointsToTop10?: number | null
}

/**
 * Daily stats — 2 compact cards (questions + points-today) sized to fit
 * the 3-col row alongside RankedStreakCard. Renders as fragment so the
 * parent grid in Ranked.tsx controls layout. Anatomy per cell:
 *   icon (top-left)  |  big number (center)  |  uppercase label (bottom)
 *
 * Slimmer than the v1 design (which had progress bars + sub-hints inside
 * each cell) per user mockup 2026-05-20 — declutters the intro screen.
 * Delta / top-N hint text moved to tooltip on hover (title attr) so the
 * numbers stay surfaced but the row reads as one balanced stat strip.
 */
export default function DailyStatsCards({
  questionsAnswered,
  questionsCap,
  pointsToday,
  dailyDelta,
  pointsToTop100,
  pointsToTop50,
  pointsToTop10,
}: DailyStatsCardsProps) {
  const { t } = useTranslation()

  const topTarget =
    pointsToTop100 != null
      ? { points: pointsToTop100, rank: 100 }
      : pointsToTop50 != null
        ? { points: pointsToTop50, rank: 50 }
        : pointsToTop10 != null
          ? { points: pointsToTop10, rank: 10 }
          : null

  const deltaText = (() => {
    if (dailyDelta == null) return null
    if (dailyDelta > 0) return t('ranked.deltaYesterdayUp', { points: dailyDelta })
    if (dailyDelta < 0) return t('ranked.deltaYesterdayDown', { points: Math.abs(dailyDelta) })
    return t('ranked.deltaYesterdaySame')
  })()

  const pointsHint = topTarget
    ? t('ranked.pointsToTopHint', { points: topTarget.points, rank: topTarget.rank })
    : null

  return (
    <>
      {/* ── Questions counted ── */}
      <section
        data-testid="ranked-questions-card"
        className="rounded-2xl border border-secondary/15 p-3 md:p-4 flex flex-col items-center text-center"
        style={{ background: 'rgba(50,52,64,0.4)' }}
        title={t('ranked.questionsLeftToday', { count: Math.max(0, questionsCap - questionsAnswered) })}
      >
        <span className="material-symbols-outlined text-bq-amberd/80 text-base mb-1">quiz</span>
        <div className="flex items-baseline gap-1">
          <span
            data-testid="ranked-questions-counted"
            className="text-bq-amberd text-[22px] md:text-[24px] font-medium leading-none"
          >
            {questionsAnswered}
          </span>
          <span className="text-bq-ink2/45 text-[11px]">/{questionsCap}</span>
        </div>
        <span className="text-bq-ink2/55 text-[11.5px] md:text-[10px] mt-1.5">
          {t('ranked.questionsTodayShort')}
        </span>
      </section>

      {/* ── Points today ── */}
      <section
        data-testid="ranked-points-card"
        className="rounded-2xl border border-secondary/15 p-3 md:p-4 flex flex-col items-center text-center"
        style={{ background: 'rgba(50,52,64,0.4)' }}
        title={[deltaText, pointsHint].filter(Boolean).join(' • ') || undefined}
      >
        <span className="material-symbols-outlined text-bq-amberd/80 text-base mb-1">
          military_tech
        </span>
        <span
          data-testid="ranked-points-today"
          className="text-bq-amberd text-[22px] md:text-[24px] font-medium leading-none"
        >
          {pointsToday}
        </span>
        {deltaText ? (
          <span
            data-testid="ranked-points-delta"
            className="text-[11.5px] md:text-[10px] mt-1.5"
            style={{
              color:
                dailyDelta != null && dailyDelta > 0
                  ? '#4ade80'
                  : dailyDelta != null && dailyDelta < 0
                    ? '#fb923c'
                    : 'rgba(255,255,255,0.55)',
            }}
          >
            {t('ranked.pointsTodayShort')}
          </span>
        ) : (
          <span className="text-bq-ink2/55 text-[11.5px] md:text-[10px] mt-1.5">
            {t('ranked.pointsTodayShort')}
          </span>
        )}
      </section>
    </>
  )
}
