import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { localizeSeasonName } from '../utils/seasonName'

interface ActiveSeasonResponse {
  active?: boolean
  id?: string
  name?: string
  startDate?: string
  endDate?: string
}

/**
 * Sidebar widget — mounted on /leaderboard routes by AppLayout. Shows
 * the active season name + countdown to season end. Reuses the same
 * query key as the Leaderboard page's seasons/active fetch, so this
 * widget hits the cache on first paint after the page loads.
 *
 * When no season is active (between transitions or freshly-seeded env)
 * the widget renders a fallback rather than disappearing — keeps the
 * sidebar slot consistent.
 */
export default function LeaderboardSeasonWidget() {
  const { t } = useTranslation()

  const { data: season } = useQuery<ActiveSeasonResponse | null>({
    queryKey: ['season', 'active'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data).catch(() => null),
    staleTime: 5 * 60_000,
  })

  const daysLeft = season?.endDate
    ? Math.max(0, Math.floor((new Date(season.endDate).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div
      data-testid="leaderboard-season-widget"
      className="rounded-[10px] px-3.5 py-3 bg-bq-white border border-bq-amber/20 shadow-bq-soft"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-amberd"
        style={{ letterSpacing: '0.12em' }}
      >
        {t('leaderboard.sidebar.seasonLabel')}
      </div>
      <div
        className="text-[13px] font-semibold leading-none mb-1 text-bq-ink"
      >
        {localizeSeasonName(season?.name, t) ?? t('leaderboard.sidebar.seasonNone')}
      </div>
      <p
        className="text-[10px] leading-snug text-bq-ink2"
      >
        {daysLeft != null
          ? t('leaderboard.sidebar.seasonDaysLeft', { count: daysLeft })
          : t('leaderboard.sidebar.seasonNoCountdown')}
      </p>
    </div>
  )
}
