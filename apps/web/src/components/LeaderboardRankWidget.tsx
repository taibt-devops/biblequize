import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface MyRankResponse {
  userId?: string
  rank?: number
  points?: number
}

/**
 * Sidebar widget — mounted on /leaderboard routes by AppLayout. Shows
 * the user's daily rank as a quick reference while they browse the
 * leaderboard. Reuses the same query key as the Leaderboard page's
 * daily my-rank fetch, so this widget hits the cache on first paint
 * after the page loads.
 *
 * Renders a "no rank yet" sub-line when the user hasn't played today
 * (BE returns null for zero-point days). Slot stays consistent so new
 * users see something rather than the widget disappearing.
 */
export default function LeaderboardRankWidget() {
  const { t } = useTranslation()

  const { data: myRank } = useQuery<MyRankResponse | null>({
    queryKey: ['leaderboard', 'my-rank', 'daily'],
    queryFn: () => api.get('/api/leaderboard/daily/my-rank').then(r => r.data).catch(() => null),
    staleTime: 30_000,
  })

  const rank = myRank?.rank ?? null

  return (
    <div
      data-testid="leaderboard-rank-widget"
      className="rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(74,158,255,0.06)',
        border: '1px solid rgba(74,158,255,0.2)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(74,158,255,0.7)' }}
      >
        {t('leaderboard.sidebar.rankLabel')}
      </div>
      <div
        data-testid="leaderboard-rank-widget-value"
        className="text-[15px] font-semibold leading-none mb-1"
        style={{ color: '#fff' }}
      >
        {rank != null ? `#${rank}` : t('leaderboard.sidebar.rankNone')}
      </div>
      <p
        className="text-[10px] leading-snug"
        style={{ color: 'rgba(225,225,241,0.5)' }}
      >
        {rank != null ? t('leaderboard.sidebar.rankSubtitle') : t('leaderboard.sidebar.rankNoneSubtitle')}
      </p>
    </div>
  )
}
