// MPP-5 — Sidebar widget shown only on /multiplayer routes (AppLayout
// renders it conditionally). Replaces the meaningless "Vị trí #1" generic
// leaderboard rank with multiplayer-context stats from MPP-2 BE endpoint.

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

interface WeeklyStats {
  period: string
  periodStart: string
  wins: number
  totalMatches: number
  winRate: number  // 0.0–1.0
  mvpCount: number
}

export default function WeeklyMultiplayerStatsWidget() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery<WeeklyStats>({
    queryKey: ['multiplayer-stats', 'weekly'],
    queryFn: () => api.get('/api/me/multiplayer-stats', { params: { period: 'weekly' } }).then(r => r.data),
    staleTime: 60_000,
    retry: 1,
  })

  // Gracefully hide on error — sidebar shouldn't show a scary error tile.
  if (isError) return null

  if (isLoading || !data) {
    return (
      <div
        className="p-4 rounded-xl animate-pulse bg-bq-white border border-bq-hair shadow-bq-soft"
      >
        <div className="h-3 w-16 bg-bq-inset rounded mb-3" />
        <div className="h-6 w-12 bg-bq-inset rounded mb-3" />
        <div className="space-y-2">
          <div className="h-2 w-full bg-bq-inset rounded" />
          <div className="h-2 w-full bg-bq-inset rounded" />
        </div>
      </div>
    )
  }

  const winRatePct = Math.round(data.winRate * 100)

  return (
    <div
      className="p-4 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft"
    >
      <div className="text-[12px] font-bold mb-2" style={{ color: '#2F6FB0' }}>
        {t('multiplayer.stats.weekHeader')}
      </div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[26px] font-extrabold leading-none text-bq-ink">{data.wins}</div>
        <div className="text-[10px] text-bq-ink2">{t('multiplayer.stats.wins')}</div>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between text-bq-ink2">
          <span>{t('multiplayer.stats.winRate')}</span>
          <span className="font-bold text-bq-ink">{winRatePct}%</span>
        </div>
        <div className="flex justify-between text-bq-ink2">
          <span>{t('multiplayer.stats.mvp')}</span>
          <span className="font-bold" style={{ color: '#D97F06' }}>×{data.mvpCount}</span>
        </div>
      </div>
    </div>
  )
}
