import React from 'react'
import { useTranslation } from 'react-i18next'
import { TIERS } from '../../data/tiers'

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
  const stars = [0, 1, 2, 3, 4].map(i => {
    if (i < starsFilled) return 'filled'
    if (i === starsFilled && tierProgress.progressPercent < 100) return 'current'
    return 'empty'
  })

  // ETA: rough heuristic — assume avg 50 EXP/day at current streak (no real data)
  const etaDays = nextTier && currentStreak > 0
    ? Math.ceil(tierProgress.expRemaining / Math.max(40, currentStreak * 20))
    : null

  return (
    <section data-testid="profile-tier-progress" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-bq-inset flex items-center justify-center text-[22px] border border-bq-hair shrink-0">
            {currentTier.iconEmoji}
          </div>
          <div className="min-w-0">
            <p data-testid="profile-tier-current-name" className="text-base font-bold text-bq-ink truncate">
              {t(currentTier.nameKey)}
            </p>
            <p className="text-xs text-bq-ink2 mt-0.5">
              {t('profile.tierCurrentSub', { n: currentTier.id })}
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-2xl text-bq-ink3 hidden sm:block">arrow_forward</span>
        <div className="flex items-center gap-3 shrink-0">
          {nextTier ? (
            <>
              <div className="text-right">
                <p data-testid="profile-tier-next-name" className="text-[13px] font-semibold text-bq-amberd">
                  {t(nextTier.nameKey)}
                </p>
                <p className="text-[11px] text-bq-ink2 mt-0.5">
                  {t('profile.tierNextSub', { n: nextTier.id, exp: tierProgress.expRemaining.toLocaleString() })}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-bq-amber/10 border border-dashed border-bq-amber/40 flex items-center justify-center text-[22px] opacity-70">
                {nextTier.iconEmoji}
              </div>
            </>
          ) : (
            <span className="text-xs font-bold text-bq-amberd uppercase">{t('profile.tierMaxLabel')}</span>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-bq-ink2 mb-1.5">
          {t('profile.subStarsLabel', { n: starsFilled })}
        </p>
        <div className="flex items-center justify-between px-1">
          {stars.map((state, i) => (
            <div
              key={i}
              className={
                state === 'filled'
                  ? 'w-6 h-6 rounded-full bg-bq-action text-bq-ink shadow-bq-action flex items-center justify-center text-[13px]'
                  : state === 'current'
                  ? 'w-6 h-6 rounded-full bg-bq-amber/15 border border-bq-amber text-bq-amberd flex items-center justify-center text-[13px] animate-pulse'
                  : 'w-6 h-6 rounded-full bg-bq-inset border border-bq-hair text-bq-ink3 flex items-center justify-center text-[13px]'
              }
            >
              ★
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-5 mb-7">
        <div className="h-2.5 bg-bq-inset rounded-full overflow-hidden">
          <div
            className="h-full bg-bq-action rounded-full shadow-bq-action relative"
            style={{ width: `${tierProgress.progressPercent}%` }}
          >
            {tierProgress.progressPercent > 0 && tierProgress.progressPercent < 100 && (
              <div className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 rounded-full bg-bq-amber border-2 border-bq-white shadow-bq-amb" />
            )}
          </div>
        </div>
        {[50, 90].map(p => (
          <React.Fragment key={p}>
            <div className="absolute -top-0.5 w-0.5 h-3.5 bg-bq-hair rounded" style={{ left: `${p}%` }} />
            <div
              className="absolute top-4 text-[9px] font-semibold uppercase tracking-wider text-bq-ink3 -translate-x-1/2"
              style={{ left: `${p}%` }}
            >
              {p}%
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-bq-hair">
        <div className="flex flex-wrap items-center gap-3">
          <div data-testid="profile-tier-exp" className="text-xs text-bq-ink2">
            <span className="text-lg font-extrabold text-bq-amberd tracking-tight align-baseline">
              {`${tierProgress.currentExp.toLocaleString()} / ${tierProgress.nextTierExp.toLocaleString()}`}
            </span>
            <span className="ml-1">EXP</span>
          </div>
          {nextTier && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bq-inset border border-bq-hair text-[11px] text-bq-ink2">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {etaDays != null ? t('profile.tierEta', { days: etaDays }) : t('profile.tierEtaUnknown')}
            </div>
          )}
        </div>
        {nextTier && (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-bq-amber/10 border border-bq-amber/20 text-xs font-semibold text-bq-amberd self-start sm:self-auto">
            <span className="material-symbols-outlined text-[16px]">lock_open</span>
            {t('profile.tierUnlockNext')}: {t(nextTier.nameKey)}
          </div>
        )}
      </div>
    </section>
  )
}
