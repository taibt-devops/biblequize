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
      className="rounded-[10px] px-3.5 py-3 bg-bq-white border border-bq-sapphire/20 shadow-bq-soft"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-sapphire"
        style={{ letterSpacing: '0.12em' }}
      >
        {t('leaderboard.sidebar.rankLabel')}
      </div>
      <div
        data-testid="leaderboard-rank-widget-value"
        className="text-[15px] font-semibold leading-none mb-1 text-bq-ink"
      >
        {rank != null ? `#${rank}` : t('leaderboard.sidebar.rankNone')}
      </div>
      <p
        className="text-[10px] leading-snug text-bq-ink2"
      >
        {rank != null ? t('leaderboard.sidebar.rankSubtitle') : t('leaderboard.sidebar.rankNoneSubtitle')}
      </p>
    </div>
  )
}
