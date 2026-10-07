import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { SkeletonBlock } from './SkeletonBlock'

export function PrestigeSection() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery<{
    canPrestige: boolean; prestigeLevel: number; daysAtTier6: number
    daysRequired: number; nextPrestigeName: string | null
  }>({
    queryKey: ['prestige-status'],
    queryFn: () => api.get('/api/me/prestige-status').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return <SkeletonBlock className="h-32" />
  if (isError || !data) return null
  const { prestigeLevel, daysAtTier6, daysRequired, canPrestige, nextPrestigeName } = data
  const progress = Math.min(100, (daysAtTier6 / daysRequired) * 100)

  return (
    <section data-testid="profile-prestige-section" className="rounded-2xl p-5 md:p-6 bg-gradient-to-br from-bq-amber/[0.08] to-bq-sapphire/[0.05] border border-bq-amber/20 flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-bq-amber/15 to-bq-sapphire/10 border border-bq-amber/30 flex items-center justify-center shrink-0">
        <span className="text-[32px]">👑</span>
        {!canPrestige && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-bq-white border-2 border-bq-amber/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm text-bq-ink2">lock</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-[15px] font-bold text-bq-ink inline-flex items-center gap-2">
          {t('profile.prestigeTitle')}
          {prestigeLevel > 0 && <span className="text-sm text-bq-amberd font-bold">P{prestigeLevel}</span>}
        </h2>
        <p className="text-xs text-bq-ink2 mt-1 leading-relaxed">
          {t('profile.prestigeFullDescription')}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-0.5 rounded-full bg-bq-amber/15 text-bq-amberd text-[10px] font-bold">P{prestigeLevel}</span>
          <div className="flex-1 h-1.5 bg-bq-inset rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-bq-amber to-bq-sapphire" style={{ width: `${progress}%` }} />
          </div>
          <span className="px-2 py-0.5 rounded-full bg-bq-inset text-bq-ink2 text-[10px] font-bold">P{prestigeLevel + 1}</span>
        </div>
        <p className="text-[11px] text-bq-ink2 mt-2">
          <span data-testid="profile-days-at-tier6" className="font-bold text-bq-ink">{daysAtTier6}</span>/{daysRequired} {t('profile.prestigeDaysLabel').toLowerCase()}
        </p>
        {canPrestige && nextPrestigeName && (
          <Link to="/cosmetics" className="inline-flex mt-3 px-3 py-1.5 rounded-lg bg-bq-action text-bq-ink shadow-bq-action text-xs font-bold">
            {t('profile.prestigeEligibleTitle')}
          </Link>
        )}
      </div>
    </section>
  )
}
