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
 * Daily stats 2-col grid (mockup line 118-150) — replaces the
 * previous 3-card row that mixed Questions / Points / Accuracy with
 * inconsistent styling (RK-P1-5: Card 1 had progress bar + sub-text,
 * Card 2 just a number with awkward empty bottom). Accuracy moved to
 * sidebar `WinRateWidget` in R1, so this row is now exactly two
 * symmetric cards: questions · points-today.
 *
 * Both cards now share the same anatomy:
 *   header: label (left) + meta (right)
 *   number: big gold value + optional unit
 *   bar:    thin coloured fill
 *   sub:    actionable hint (questions left / points to top-N)
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

  const questionsLeft = Math.max(0, questionsCap - questionsAnswered)
  const questionsPct = questionsCap > 0 ? (questionsAnswered / questionsCap) * 100 : 0

  // Pick the most achievable top-N target the user hasn't yet hit.
  // R10 will fill pointsToTop100 directly; until then prefer
  // pointsToTop100 → pointsToTop50 → pointsToTop10.
  const topTarget =
    pointsToTop100 != null
      ? { points: pointsToTop100, rank: 100 }
      : pointsToTop50 != null
        ? { points: pointsToTop50, rank: 50 }
        : pointsToTop10 != null
          ? { points: pointsToTop10, rank: 10 }
          : null

  // Points bar fill — visualise progress toward the top target if we
  // have one, else fall back to a flat 24% (matches mockup) so the
  // card doesn't look broken with an empty bar.
  const pointsBarPct = topTarget
    ? Math.min(100, (pointsToday / (pointsToday + topTarget.points)) * 100)
    : Math.min(100, pointsToday > 0 ? 24 : 0)

  const deltaText = (() => {
    if (dailyDelta == null) return null
    if (dailyDelta > 0) return t('ranked.deltaYesterdayUp', { points: dailyDelta })
    if (dailyDelta < 0)
      return t('ranked.deltaYesterdayDown', { points: Math.abs(dailyDelta) })
    return t('ranked.deltaYesterdaySame')
  })()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* ── Card 1: questions counted ── */}
      <section
        data-testid="ranked-questions-card"
        className="rounded-2xl border border-secondary/15 p-4 md:p-5"
        style={{ background: 'rgba(50,52,64,0.4)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant/60 text-[11px] tracking-wider">
            {t('ranked.questionsCountedLabel')}
          </span>
          <span className="text-on-surface-variant/45 text-[11px]">
            {t('ranked.capPerDay', { count: questionsCap })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-3">
          <span
            data-testid="ranked-questions-counted"
            className="text-[28px] font-medium leading-none text-secondary"
          >
            {questionsAnswered}
          </span>
          <span className="text-on-surface-variant/40 text-[13px]">/{questionsCap}</span>
        </div>
        <div className="bg-white/[0.06] rounded-[3px] h-[5px] overflow-hidden mb-1.5">
          <div
            data-testid="ranked-today-progress"
            className="h-full rounded-[3px] bg-secondary transition-[width] duration-500"
            style={{ width: `${questionsPct}%` }}
          />
        </div>
        <p className="text-on-surface-variant/45 text-[10px]">
          {t('ranked.questionsLeftToday', { count: questionsLeft })}
        </p>
      </section>

      {/* ── Card 2: points today + delta ── */}
      <section
        data-testid="ranked-points-card"
        className="rounded-2xl border border-secondary/15 p-4 md:p-5"
        style={{ background: 'rgba(50,52,64,0.4)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant/60 text-[11px] tracking-wider">
            {t('ranked.pointsTodayLabel')}
          </span>
          {deltaText && (
            <span
              data-testid="ranked-points-delta"
              className="text-[11px] font-medium"
              style={{
                color:
                  dailyDelta != null && dailyDelta > 0
                    ? '#4ade80'
                    : dailyDelta != null && dailyDelta < 0
                      ? '#fb923c'
                      : 'rgba(255,255,255,0.45)',
              }}
            >
              {deltaText}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 mb-3">
          <span
            data-testid="ranked-points-today"
            className="text-[28px] font-medium leading-none text-secondary"
          >
            {pointsToday}
          </span>
          <span className="text-on-surface-variant/50 text-[12px]">
            {t('ranked.points')}
          </span>
        </div>
        <div className="bg-white/[0.06] rounded-[3px] h-[5px] overflow-hidden mb-1.5">
          <div
            className="h-full rounded-[3px] transition-[width] duration-500"
            style={{
              width: `${pointsBarPct}%`,
              background: 'linear-gradient(90deg, #e8a832, #4a9eff)',
            }}
          />
        </div>
        {topTarget ? (
          <p className="text-on-surface-variant/45 text-[10px]">
            {t('ranked.pointsToTopHint', {
              points: topTarget.points,
              rank: topTarget.rank,
            })}
          </p>
        ) : (
          <p className="text-on-surface-variant/35 text-[10px] italic">&nbsp;</p>
        )}
      </section>
    </div>
  )
}
