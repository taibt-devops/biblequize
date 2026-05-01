import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface ActiveSeasonResponse {
  active: boolean
  id?: string
  name?: string
}

interface MyRankResponse {
  userId?: string
  rank?: number
  points?: number
}

/**
 * Auto-derive the next-tier season goal from the user's current rank.
 * Top 1 stays the apex aspiration; otherwise we step the user up to
 * the next round milestone (10 / 50 / 100). When rank > 100 we keep
 * the goal at Top 100 — the most achievable next milestone.
 */
function deriveGoal(rank: number | null): string {
  if (rank == null || rank > 100) return 'Top 100'
  if (rank > 50) return 'Top 50'
  if (rank > 10) return 'Top 10'
  return 'Top 1'
}

/**
 * Sidebar widget — only mounted on /ranked routes by AppLayout. Shows
 * the user's auto-derived season goal (Top 1/10/50/100) plus current
 * season rank as a stretch reminder. Fires two cheap requests at
 * mount: /api/seasons/active to find the live season, then
 * /seasons/{id}/my-rank for the user's standing. Both queries fail
 * silently — the widget renders a "no rank yet" sub-line rather than
 * disappearing, so the slot in the sidebar stays consistent for new
 * users.
 *
 * R10 will likely consolidate these two requests into seasonRank +
 * seasonTotalPlayers fields on /api/me/ranked-status; until then the
 * 2-call pattern keeps R1 independent of BE work.
 */
export default function SeasonGoalWidget() {
  const { t } = useTranslation()

  const { data: activeSeason } = useQuery<ActiveSeasonResponse>({
    queryKey: ['active-season'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const seasonId = activeSeason?.active ? activeSeason.id : null

  const { data: myRank } = useQuery<MyRankResponse | null>({
    queryKey: ['season-my-rank', seasonId],
    queryFn: () => api.get(`/api/seasons/${seasonId}/my-rank`).then(r => r.data),
    staleTime: 60_000,
    enabled: !!seasonId,
  })

  const rank = myRank?.rank ?? null
  const goal = deriveGoal(rank)

  return (
    <div
      data-testid="season-goal-widget"
      className="rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(232,168,50,0.06)',
        border: '1px solid rgba(232,168,50,0.18)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(232,168,50,0.7)' }}
      >
        {t('ranked.sidebar.seasonGoalLabel')}
      </div>
      <div
        data-testid="season-goal-widget-value"
        className="text-[15px] font-semibold leading-none mb-1"
        style={{ color: '#fff' }}
      >
        {goal}
      </div>
      <p
        data-testid="season-goal-widget-current"
        className="text-[10px] leading-snug"
        style={{ color: 'rgba(225,225,241,0.5)' }}
      >
        {rank != null
          ? t('ranked.sidebar.seasonGoalCurrent', { rank })
          : t('ranked.sidebar.seasonGoalNoRank')}
      </p>
    </div>
  )
}
