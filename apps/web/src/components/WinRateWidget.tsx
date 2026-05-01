import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface RankedStatus {
  dailyAccuracy: number | null
  dailyCorrectCount: number | null
  dailyTotalAnswered: number | null
}

/**
 * Sidebar widget — only mounted on /ranked routes by AppLayout. Reuses
 * the {@code ['ranked-status']} TanStack key so the same in-flight
 * request the Ranked dashboard already triggered serves both. Renders
 * "{percent}% ({correct}/{total})" when the user has answered ≥ 1
 * ranked question today, falling back to a "no data yet" sub-line
 * otherwise — never disappears so the sidebar slot stays stable.
 */
export default function WinRateWidget() {
  const { t } = useTranslation()

  const { data } = useQuery<RankedStatus>({
    queryKey: ['ranked-status'],
    queryFn: () => api.get('/api/me/ranked-status').then(r => r.data),
    staleTime: 60_000,
  })

  const total = data?.dailyTotalAnswered ?? 0
  const correct = data?.dailyCorrectCount ?? 0
  const accuracy = data?.dailyAccuracy ?? null
  const hasData = total > 0 && accuracy != null

  return (
    <div
      data-testid="win-rate-widget"
      className="rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(74,158,255,0.06)',
        border: '1px solid rgba(74,158,255,0.18)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(74,158,255,0.7)' }}
      >
        {t('ranked.sidebar.winRateLabel')}
      </div>
      {hasData ? (
        <div
          data-testid="win-rate-widget-value"
          className="text-[15px] font-semibold leading-none"
          style={{ color: '#4a9eff' }}
        >
          {t('ranked.sidebar.winRateValue', {
            percent: Math.round(accuracy * 100),
            correct,
            total,
          })}
        </div>
      ) : (
        <p
          data-testid="win-rate-widget-empty"
          className="text-[10px] leading-snug"
          style={{ color: 'rgba(225,225,241,0.5)' }}
        >
          {t('ranked.sidebar.winRateNoData')}
        </p>
      )}
    </div>
  )
}
