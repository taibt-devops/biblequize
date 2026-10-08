import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface RankedStatus {
  weekHighestCombo?: number | null
}

/**
 * Sidebar widget — only mounted on /ranked routes by AppLayout. Shows
 * the user's highest consecutive-correct combo over the past 7 days.
 *
 * Backend field {@code weekHighestCombo} on /api/me/ranked-status is
 * tracked in BACKEND_GAPS_RANKED_V2.md (R10). Until BE ships, the
 * widget renders a "Coming soon" placeholder so the sidebar slot
 * stays stable instead of leaving a gap.
 */
export default function WeekComboWidget() {
  const { t } = useTranslation()

  const { data } = useQuery<RankedStatus>({
    queryKey: ['ranked-status'],
    queryFn: () => api.get('/api/me/ranked-status').then(r => r.data),
    staleTime: 60_000,
  })

  const combo = data?.weekHighestCombo ?? null

  return (
    <div
      data-testid="week-combo-widget"
      className="rounded-[10px] px-3.5 py-3 bg-bq-white border border-bq-amber/20 shadow-bq-soft"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-amberd"
        style={{ letterSpacing: '0.12em' }}
      >
        {t('ranked.sidebar.weekComboLabel')}
      </div>
      {combo != null && combo > 0 ? (
        <div
          data-testid="week-combo-widget-value"
          className="text-[15px] font-semibold leading-none text-bq-amberd"
        >
          ×{combo}
        </div>
      ) : (
        <p
          data-testid="week-combo-widget-pending"
          className="text-[10px] leading-snug text-bq-ink2"
        >
          {t('ranked.sidebar.weekComboPending')}
        </p>
      )}
    </div>
  )
}
