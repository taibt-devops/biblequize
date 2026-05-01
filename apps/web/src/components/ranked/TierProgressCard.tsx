import { useTranslation } from 'react-i18next'
import type { Tier } from '../../data/tiers'

interface TierProgressCardProps {
  /** Tier the user currently sits in (from data/tiers.ts). */
  currentTier: Tier
  /** Tier above current; null when the user is at max tier. */
  nextTier: Tier | null
  /** All-time points used to compute fill % (decoupled from tier-progress
   *  starIndex/starXp so the card renders even when /tier-progress hasn't
   *  resolved). */
  totalPoints: number
  /** Points still needed to reach {@link nextTier}. 0 at max tier. */
  pointsToNext: number
  /** 0..100 fill of the tier progress bar. */
  tierProgressPct: number
  /** Sub-tier index 0-4. Drives the 5-star indicator on the right.
   *  Optional — when undefined, stars row hides cleanly. */
  starIndex?: number
}

/**
 * Tier progress card on /ranked — replaces the previous tier badge +
 * inline progress bar combo with the mockup pattern (line 48-72):
 *   [tier-color pill] + points-to-next caption + 5-star sub-tier row
 *   single-gold progress bar
 *   "X / Y XP" caption (left) + next-tier hint (right)
 *
 * Fixes:
 *   - RK-P1-1: tier pill renders with proper bg/border/text contrast
 *     (was solid disabled-looking) using {@code tier.colorHex}.
 *   - RK-P1-2: progress bar single-color gold (was 2-color confusing).
 *   - RK-P3-1: smaller header context fits the redesigned hierarchy.
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

  // Card-tinted surface that signals "tier" without competing with the
  // larger Energy / Streak cards below.
  return (
    <section
      data-testid="ranked-tier-card"
      className="rounded-2xl border border-secondary/25 p-4 md:p-5"
      style={{
        background:
          'linear-gradient(180deg, rgba(50,52,64,0.6), rgba(30,32,44,0.6))',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            data-testid="ranked-tier-badge"
            className="px-3 py-1 rounded-full text-[11px] font-medium border"
            style={{
              background: hexToRgba(currentTier.colorHex, 0.15),
              borderColor: hexToRgba(currentTier.colorHex, 0.5),
              color: currentTier.colorHex,
            }}
          >
            {tierName}
          </span>
          {!isMaxTier ? (
            <span
              data-testid="ranked-tier-progress-text"
              className="text-on-surface-variant/60 text-[13px]"
            >
              {t('ranked.pointsToNext', {
                points: pointsToNext.toLocaleString('vi-VN'),
                tier: nextTierName,
              })}
            </span>
          ) : (
            <span
              data-testid="ranked-tier-progress-text"
              className="text-secondary text-[13px] font-semibold"
            >
              {t('ranked.maxTier')}
            </span>
          )}
        </div>
        {!isMaxTier && starIndex != null && (
          <div className="flex items-center gap-1.5" data-testid="ranked-sub-tier-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="text-[14px]"
                style={{
                  color:
                    i < starIndex ? '#e8a832' : 'rgba(232,168,50,0.25)',
                }}
              >
                ★
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative bg-white/[0.06] rounded-[4px] h-2 overflow-hidden">
        <div
          data-testid="ranked-tier-progress-bar"
          className="absolute left-0 top-0 h-full bg-secondary rounded-[4px] transition-[width] duration-700 ease-out"
          style={{ width: `${tierProgressPct}%` }}
        />
        {/* Thin next-tier hint at 100% mark — subtle, doesn't dominate. */}
        {!isMaxTier && (
          <div
            className="absolute right-0 top-0 h-full w-px"
            style={{ background: 'rgba(96,165,250,0.6)' }}
            aria-hidden
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span
          data-testid="ranked-tier-progress-xp"
          className="text-on-surface-variant/50 text-[11px]"
        >
          {t('ranked.xpProgressLabel', {
            current: totalPoints.toLocaleString('vi-VN'),
            total: nextTier
              ? nextTier.minPoints.toLocaleString('vi-VN')
              : totalPoints.toLocaleString('vi-VN'),
          })}
        </span>
        {!isMaxTier && (
          <span className="text-[11px]" style={{ color: 'rgba(96,165,250,0.7)' }}>
            {t('ranked.targetNextTier')}
          </span>
        )}
      </div>
    </section>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(255,255,255,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
