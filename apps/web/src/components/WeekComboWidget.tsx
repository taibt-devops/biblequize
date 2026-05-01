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
      className="rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(255,140,66,0.06)',
        border: '1px solid rgba(255,140,66,0.18)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(255,140,66,0.7)' }}
      >
        {t('ranked.sidebar.weekComboLabel')}
      </div>
      {combo != null && combo > 0 ? (
        <div
          data-testid="week-combo-widget-value"
          className="text-[15px] font-semibold leading-none"
          style={{ color: '#ff8c42' }}
        >
          ×{combo}
        </div>
      ) : (
        <p
          data-testid="week-combo-widget-pending"
          className="text-[10px] leading-snug"
          style={{ color: 'rgba(225,225,241,0.5)' }}
        >
          {t('ranked.sidebar.weekComboPending')}
        </p>
      )}
    </div>
  )
}
