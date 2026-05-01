import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

interface ActiveSeasonResponse {
  active: boolean
  id?: string
  name?: string
  startDate?: string
  endDate?: string
}

interface MyRankResponse {
  userId?: string
  rank?: number
  points?: number
  /** R10 will populate; not in BE response yet. When available, we
   *  render "Top {percentile}%" alongside the rank. */
  totalPlayers?: number
}

const CHAMPIONSHIP_THRESHOLD = 1000

function daysUntil(endDateIso?: string | null): number | null {
  if (!endDateIso) return null
  const end = new Date(endDateIso)
  if (Number.isNaN(end.getTime())) return null
  const now = new Date()
  const ms = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Season card on /ranked — replaces the previous
 * "you-are-here" position bar with markers (RK-P0-2 hardcoded
 * position, RK-P1-3 linear scale doesn't reflect difficulty
 * progression). The card surfaces three glanceable stats:
 *   - season rank (with optional percentile when totalPlayers known)
 *   - season points (and "to championship" target)
 *   - trend column (placeholder until R10 BE adds seasonRankDelta)
 *
 * Data flow: GET /api/seasons/active → GET /api/seasons/{id}/my-rank.
 * Both fail silently — empty state renders a "no active season" line
 * so the section never disappears mid-page.
 */
export default function SeasonCard() {
  const { t } = useTranslation()

  const { data: activeSeason } = useQuery<ActiveSeasonResponse>({
    queryKey: ['active-season'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const seasonId = activeSeason?.active ? activeSeason.id : null
  const seasonName = activeSeason?.active ? activeSeason.name : null

  const { data: myRank } = useQuery<MyRankResponse | null>({
    queryKey: ['season-my-rank', seasonId],
    queryFn: () => api.get(`/api/seasons/${seasonId}/my-rank`).then(r => r.data),
    staleTime: 60_000,
    enabled: !!seasonId,
  })

  if (!activeSeason?.active) {
    return (
      <section
        data-testid="ranked-season-card"
        data-state="no-active-season"
        className="rounded-2xl border p-4 md:p-5 text-center"
        style={{
          background:
            'linear-gradient(135deg, rgba(74,158,255,0.06), rgba(168,85,247,0.06))',
          borderColor: 'rgba(74,158,255,0.2)',
        }}
      >
        <p className="text-on-surface-variant/55 text-[12px]">
          {t('ranked.seasonNoActive')}
        </p>
      </section>
    )
  }

  const rank = myRank?.rank ?? null
  const totalPlayers = myRank?.totalPlayers ?? null
  const seasonPoints = myRank?.points ?? 0
  const days = daysUntil(activeSeason.endDate)
  const pointsToChamp = Math.max(0, CHAMPIONSHIP_THRESHOLD - seasonPoints)
  const percentile = rank != null && totalPlayers != null && totalPlayers > 0
    ? Math.max(0.1, ((1 - (rank - 1) / totalPlayers) * 100))
    : null

  return (
    <section
      data-testid="ranked-season-card"
      data-state="active"
      className="rounded-2xl border p-4 md:p-5"
      style={{
        background:
          'linear-gradient(135deg, rgba(74,158,255,0.06), rgba(168,85,247,0.06))',
        borderColor: 'rgba(74,158,255,0.2)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏆</span>
          <span className="text-on-surface text-[14px] font-medium">{seasonName}</span>
        </div>
        {days != null && (
          <span
            data-testid="ranked-season-end"
            className="text-on-surface-variant/50 text-[11px]"
          >
            {t('ranked.seasonEndsIn', { days })}
          </span>
        )}
      </div>
      <p className="text-on-surface-variant/55 text-[11px] mb-3.5">
        {t('ranked.seasonRewardHint', { name: seasonName })}
      </p>

      <div className="flex items-center gap-4 mb-3">
        {/* Rank column */}
        <div className="min-w-[88px]">
          <div className="text-on-surface-variant/50 text-[10px] tracking-wider mb-0.5">
            {t('ranked.seasonRankLabel')}
          </div>
          {rank != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span
                  data-testid="ranked-season-rank"
                  className="text-secondary text-[26px] font-medium leading-none"
                >
                  #{rank}
                </span>
                {totalPlayers != null && (
                  <span className="text-on-surface-variant/50 text-[11px]">
                    {t('ranked.seasonRankSlash', { total: totalPlayers })}
                  </span>
                )}
              </div>
              {percentile != null && (
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(74,158,255,0.7)' }}>
                  {t('ranked.seasonRankPercentile', { percent: percentile.toFixed(1) })}
                </div>
              )}
            </>
          ) : (
            <div
              data-testid="ranked-season-rank"
              className="text-on-surface-variant/60 text-[14px] font-medium"
            >
              {t('ranked.unranked')}
            </div>
          )}
        </div>

        {/* Points column */}
        <div className="flex-1 pl-4 border-l border-white/[0.08]">
          <div className="text-on-surface-variant/50 text-[10px] tracking-wider mb-0.5">
            {t('ranked.seasonPointsBigLabel')}
          </div>
          <div
            data-testid="ranked-season-points"
            className="text-on-surface text-[22px] font-medium leading-none"
          >
            {seasonPoints}
          </div>
          {pointsToChamp > 0 && (
            <div className="text-on-surface-variant/45 text-[10px] mt-0.5">
              {t('ranked.seasonPointsToChamp', { points: pointsToChamp.toLocaleString('vi-VN') })}
            </div>
          )}
        </div>

        {/* Trend column — placeholder until R10 BE adds seasonRankDelta */}
        <div className="pl-4 border-l border-white/[0.08]">
          <div className="text-on-surface-variant/50 text-[10px] tracking-wider mb-0.5">
            {t('ranked.seasonTrendLabel')}
          </div>
          <div
            data-testid="ranked-season-trend"
            className="text-on-surface-variant/40 text-[22px] font-medium leading-none"
          >
            {t('ranked.seasonNoTrend')}
          </div>
        </div>
      </div>

      <Link
        to="/leaderboard?period=season"
        data-testid="ranked-season-leaderboard-link"
        className="text-secondary text-[11px] hover:underline"
      >
        {t('ranked.seasonViewLeaderboard')}
      </Link>
    </section>
  )
}
