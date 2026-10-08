import { useTranslation } from 'react-i18next'
import { TIERS } from '../../data/tiers'

const tierImg = (id: number) => `/images/lk/tier-${Math.min(6, Math.max(1, id))}.webp`

/**
 * Tier road on the profile (LKF-12): current shield → next shield (greyed), five sub-stars, the
 * wooden XP rail with 50 % / 90 % marks, and the unlock note.
 */
export function TierProgressCard({ currentTier, nextTier, tierProgress, currentStreak }: {
  currentTier: typeof TIERS[number]
  nextTier: typeof TIERS[number] | null
  tierProgress: {
    currentTierName: string
    nextTierName: string
    currentExp: number
    nextTierExp: number
    progressPercent: number
    expRemaining: number
  }
  currentStreak: number
}) {
  const { t } = useTranslation()
  const starsFilled = Math.min(5, Math.floor(tierProgress.progressPercent / 20))

  // ETA: rough heuristic — assume avg 50 EXP/day at current streak (no real data)
  const etaDays = nextTier && currentStreak > 0
    ? Math.ceil(tierProgress.expRemaining / Math.max(40, currentStreak * 20))
    : null

  return (
    <section data-testid="profile-tier-progress" className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={tierImg(currentTier.id)} alt="" aria-hidden className="w-14 md:w-16 shrink-0 drop-shadow-[0_3px_0_rgba(29,43,34,.35)]" />
          <div className="min-w-0">
            <p data-testid="profile-tier-current-name" className="m-0 font-display text-[20px] md:text-[22px] font-extrabold text-bq-ink">
              {t(currentTier.nameKey)}
            </p>
            <p className="m-0 text-[13px] font-bold text-bq-ink2">
              {t('profile.tierCurrentSub', { n: currentTier.id })}
            </p>
          </div>
        </div>
        <span aria-hidden className="hidden sm:block flex-1 max-w-[160px] border-t-[3px] border-dashed border-bq-ink/30" />
        <div className="flex items-center gap-3 shrink-0">
          {nextTier ? (
            <>
              <div className="text-right">
                <p data-testid="profile-tier-next-name" className="m-0 font-display text-[16px] font-extrabold text-bq-amberd">
                  {t(nextTier.nameKey)}
                </p>
                <p className="m-0 text-[12.5px] font-bold text-bq-ink2">
                  {t('profile.tierNextSub', { n: nextTier.id, exp: tierProgress.expRemaining.toLocaleString() })}
                </p>
              </div>
              <img src={tierImg(nextTier.id)} alt="" aria-hidden className="w-11 md:w-12 grayscale-[.6] opacity-75" />
            </>
          ) : (
            <span className="px-3 py-1 bg-bq-amber border-2 border-bq-ink rounded-full text-[13px] font-extrabold">{t('profile.tierMaxLabel')}</span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              aria-hidden
              className={`text-[24px] leading-none ${i === starsFilled && tierProgress.progressPercent < 100 ? 'motion-safe:animate-pulse' : ''}`}
              style={{ color: i < starsFilled ? '#FFC93C' : '#F0DFB8', WebkitTextStroke: '1.5px #1D2B22' }}
            >
              ★
            </span>
          ))}
        </div>
        <span className="text-[13px] font-bold text-bq-ink2">{t('profile.subStarsLabel', { n: starsFilled })}</span>
      </div>

      <div className="relative mt-4 mb-7">
        <div className="h-4 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
          <div className="h-full bg-bq-amber border-r-2 border-bq-ink/40" style={{ width: `${tierProgress.progressPercent}%` }} />
        </div>
        {[50, 90].map(p => (
          <div key={p} className="absolute top-5 -translate-x-1/2 flex flex-col items-center" style={{ left: `${p}%` }}>
            <span aria-hidden className="w-0.5 h-1.5 bg-bq-ink/40" />
            <span className="text-[11px] font-extrabold text-bq-ink3">{p}%</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t-2 border-dashed border-bq-hair">
        <div className="flex flex-wrap items-center gap-3">
          <div data-testid="profile-tier-exp" className="text-[13px] font-bold text-bq-ink2">
            <span className="font-display text-[20px] font-extrabold text-bq-ink align-baseline tabular-nums">
              {`${tierProgress.currentExp.toLocaleString()} / ${tierProgress.nextTierExp.toLocaleString()}`}
            </span>
            <span className="ml-1">EXP</span>
          </div>
          {nextTier && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bq-cream border-2 border-bq-ink text-[12.5px] font-bold">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {etaDays != null ? t('profile.tierEta', { days: etaDays }) : t('profile.tierEtaUnknown')}
            </span>
          )}
        </div>
        {nextTier && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bq-leaf border-2 border-bq-ink text-[13px] font-extrabold self-start sm:self-auto">
            <span className="material-symbols-outlined text-[16px]">lock_open</span>
            {t('profile.tierUnlockNext')}: {t(nextTier.nameKey)}
          </span>
        )}
      </div>
    </section>
  )
}
