import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

/**
 * Streak / energy / season-point chips in the top bar (Lu Khach mockup, LKF-1).
 * Uses the same ['me'] and ['ranked-status'] queries as Home, so the cache is
 * shared and no extra request is made. `compact` (phones): streak + energy only,
 * numbers without words.
 */
export default function HeaderStats({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { data: me } = useQuery<{ currentStreak?: number }>({
    queryKey: ['me'], queryFn: () => api.get('/api/me').then(r => r.data), staleTime: 5 * 60_000,
  })
  const { data: ranked } = useQuery<{ livesRemaining?: number; seasonPoints?: number }>({
    queryKey: ['ranked-status'], queryFn: () => api.get('/api/me/ranked-status').then(r => r.data), staleTime: 60_000,
  })
  const streak = me?.currentStreak ?? 0
  const energy = ranked?.livesRemaining ?? 100
  const season = ranked?.seasonPoints ?? 0

  const chip = `inline-flex items-center gap-1.5 bg-bq-cream border-bq-ink rounded-full text-bq-ink whitespace-nowrap ${
    compact ? 'border-2 pl-1 pr-2.5 text-[15px] font-extrabold' : 'border-[3px] pl-1.5 pr-3.5 py-0.5 text-[17px] font-bold'
  }`

  return (
    <div data-testid="header-stats" className="flex items-center gap-2">
      <span data-testid="header-streak" className={chip}>
        <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className={compact ? 'h-[22px]' : 'h-7'} />
        <span aria-hidden>{compact ? streak : t('nav.streakDays', { count: streak })}</span>
        <span className="sr-only">{t('nav.streakAria', { count: streak })}</span>
      </span>
      <span data-testid="header-energy" className={chip}>
        <img src="/images/lk/heart.webp" alt="" aria-hidden className={compact ? 'h-[18px]' : 'h-6'} />
        <span aria-hidden>{energy}</span>
        <span className="sr-only">{t('nav.energyAria', { count: energy })}</span>
      </span>
      {!compact && (
        <span data-testid="header-season" className={chip}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="ml-0.5">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#FFC93C" stroke="#1D2B22" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span aria-hidden>{season.toLocaleString('vi-VN')}</span>
          <span className="sr-only">{t('nav.seasonAria', { count: season })}</span>
        </span>
      )}
    </div>
  )
}
