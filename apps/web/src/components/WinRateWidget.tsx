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
      className="rounded-[10px] px-3.5 py-3 bg-bq-white border border-bq-sapphire/20 shadow-bq-soft"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-sapphire"
        style={{ letterSpacing: '0.12em' }}
      >
        {t('ranked.sidebar.winRateLabel')}
      </div>
      {hasData ? (
        <div
          data-testid="win-rate-widget-value"
          className="text-[15px] font-semibold leading-none text-bq-sapphire"
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
          className="text-[10px] leading-snug text-bq-ink2"
        >
          {t('ranked.sidebar.winRateNoData')}
        </p>
      )}
    </div>
  )
}
