import { useTranslation } from 'react-i18next'
import type { Tier } from '../../data/tiers'

interface TierProgressCardProps {
  currentTier: Tier
  nextTier: Tier | null
  totalPoints: number
  pointsToNext: number
  tierProgressPct: number
  starIndex?: number
}

const tierImg = (id: number) => `/images/lk/tier-${Math.min(6, Math.max(1, id))}.webp`

/**
 * Tier banner on /ranked (LKF-9): the traveller's tier shield and name with the 5 sub-tier stars
 * on the left, the next shield greyed out as the goal on the right, and the wooden XP rail below.
 */
export default function TierProgressCard({
  currentTier,
  nextTier,
  totalPoints,
  pointsToNext,
  tierProgressPct,
  starIndex,
}: TierProgressCardProps) {
  const { t } = useTranslation()
  const isMaxTier = !nextTier
  const tierName = t(currentTier.nameKey)
  const nextTierName = nextTier ? t(nextTier.nameKey) : ''

  return (
    <section
      data-testid="ranked-tier-card"
      className="relative rounded-bq border-[3px] border-bq-ink bg-bq-white shadow-bq-card p-5 md:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 md:gap-7">
        {/* current tier: shield, name, stars */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <img src={tierImg(currentTier.id)} alt="" aria-hidden className="w-[68px] md:w-[88px] shrink-0 drop-shadow-[0_4px_0_rgba(29,43,34,.35)]" />
          <div className="min-w-0">
            <div data-testid="ranked-tier-badge" className="font-display text-[24px] md:text-[30px] font-extrabold leading-tight">
              {tierName}
            </div>
            {!isMaxTier && starIndex != null && (
              <div className="flex items-center gap-1 mt-1" data-testid="ranked-sub-tier-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="text-[22px] md:text-[24px] leading-none"
                    style={{ color: i < starIndex ? '#FFC93C' : '#F0DFB8', WebkitTextStroke: '1.5px #1D2B22' }}
                  >
                    ★
                  </span>
                ))}
                <span
                  className="ml-1.5 w-6 h-6 rounded-full grid place-items-center text-[12px] font-extrabold border-2 border-bq-ink bg-bq-cream cursor-help"
                  title={t('ranked.starsHelpHint')}
                  aria-label={t('ranked.starsHelpHint')}
                >
                  ?
                </span>
              </div>
            )}
          </div>
        </div>

        {/* next tier: the goal, greyed until reached */}
        {!isMaxTier ? (
          <div className="flex items-center gap-3 md:flex-row-reverse md:text-right">
            <img src={tierImg(nextTier.id)} alt="" aria-hidden className="w-11 md:w-14 shrink-0 grayscale-[.6] opacity-80" />
            <div>
              <div className="text-[13px] font-bold text-bq-ink3">{t('ranked.nextTierEyebrow')}</div>
              <div className="font-display text-[20px] md:text-[22px] font-extrabold leading-tight text-bq-amberd" data-testid="ranked-next-tier-name">
                {nextTierName}
              </div>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-bq-cream border-2 border-bq-ink rounded-full text-[12.5px] font-extrabold">
                {t('ranked.pointsToNextShort', { points: pointsToNext.toLocaleString('vi-VN') })}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-3 py-1 bg-bq-amber border-2 border-bq-ink rounded-full text-[15px] font-extrabold" data-testid="ranked-tier-progress-text">
            {t('ranked.maxTier')}
          </div>
        )}
      </div>

      {/* XP rail */}
      <div className="mt-5 md:mt-6">
        <div className="bg-bq-track border-2 border-bq-ink rounded-full h-4 overflow-hidden">
          <div
            data-testid="ranked-tier-progress-bar"
            className="h-full bg-bq-amber border-r-2 border-bq-ink/40 transition-[width] duration-700 ease-out"
            style={{ width: `${tierProgressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[13px] font-bold">
          <span data-testid="ranked-tier-progress-xp" className="text-bq-ink2">
            <span className="text-bq-ink font-extrabold text-[16px]">{totalPoints.toLocaleString('vi-VN')}</span>{' '}
            XP
          </span>
          <span className="text-bq-ink3 tabular-nums">
            / {(nextTier ? nextTier.minPoints : totalPoints).toLocaleString('vi-VN')} XP
          </span>
        </div>
      </div>
    </section>
  )
}
