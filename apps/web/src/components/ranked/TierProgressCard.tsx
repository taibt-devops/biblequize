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

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Hero tier banner — desktop v2 (mockup_ranked_desktop_v2.html .hero
 * 2026-05-20). Combined card with two columns on top row:
 *   LEFT  : tier badge (icon + tier name pill) + 5-star sub-tier indicator
 *           + "?" help affordance for the star system.
 *   RIGHT : eyebrow "Đích tiếp theo" + next tier name in Cormorant italic
 *           gold + "Còn N XP" gap caption.
 * Bottom : full-width gold gradient progress bar; foot shows
 *          "{current} XP" (bold, gold) and "/ {target} XP" (muted).
 *
 * Mobile (< sm) gracefully collapses: top row wraps into two stacked
 * blocks so the long "Đích tiếp theo" copy doesn't crowd the badge.
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
      className="relative overflow-hidden rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-rub p-5 md:p-7"
    >
      {/* Soft ruby radial accents — only on md+ so mobile stays calm. */}
      <div
        className="hidden md:block absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 80% at 8% 0%, rgba(179,69,47,0.08), transparent 60%),'
            + 'radial-gradient(50% 70% at 95% 100%, rgba(179,69,47,0.05), transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 md:gap-7">
        {/* LEFT — current tier badge + stars */}
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <div
            data-testid="ranked-tier-badge"
            className="inline-flex items-center gap-2.5 rounded-[14px] border border-bq-hair bg-bq-inset px-3 py-2 md:px-4 md:py-2.5"
          >
            <span
              className="grid place-items-center w-6 h-6 md:w-[26px] md:h-[26px] rounded-lg flex-shrink-0"
              style={{
                background: hexToRgba(currentTier.colorHex, 0.15),
                color: currentTier.colorHex,
              }}
            >
              <span className="material-symbols-outlined text-[16px] md:text-[17px]" style={FILL_1}>
                workspace_premium
              </span>
            </span>
            <span className="text-bq-ink text-[13px] md:text-[14px] font-bold tracking-tight">
              {tierName}
            </span>
          </div>

          {!isMaxTier && starIndex != null && (
            <div className="flex items-center gap-1" data-testid="ranked-sub-tier-stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="material-symbols-outlined text-[18px] md:text-[20px]"
                  style={{
                    color: i < starIndex ? '#F59E0B' : '#C9B58C',
                    ...(i < starIndex ? FILL_1 : undefined),
                  }}
                >
                  star
                </span>
              ))}
              <span
                className="ml-1 w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] font-bold border border-bq-hair bg-bq-inset text-bq-ink3 cursor-help"
                title={t('ranked.starsHelpHint', 'Mỗi tier có 5 sao — đạt đủ XP mới lên tier kế tiếp')}
              >
                ?
              </span>
            </div>
          )}
        </div>

        {/* RIGHT — next tier target */}
        {!isMaxTier ? (
          <div className="text-left md:text-right">
            <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-bq-ink3 mb-1">
              {t('ranked.nextTierEyebrow')}
            </div>
            <div
              className="font-headline italic font-semibold text-bq-amberd text-[20px] md:text-[22px] leading-none tracking-tight"
              data-testid="ranked-next-tier-name"
            >
              {nextTierName}
            </div>
            <div className="text-[12px] text-bq-ink2 mt-1.5">
              {t('ranked.pointsToNextShort', {
                points: pointsToNext.toLocaleString('vi-VN'),
              })}
            </div>
          </div>
        ) : (
          <div className="text-bq-amberd text-[14px] font-semibold" data-testid="ranked-tier-progress-text">
            {t('ranked.maxTier')}
          </div>
        )}
      </div>

      {/* Progress bar + foot */}
      <div className="relative z-10 mt-5 md:mt-6">
        <div className="bg-bq-track border-2 border-bq-ink rounded-full h-[14px] overflow-hidden">
          <div
            data-testid="ranked-tier-progress-bar"
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${tierProgressPct}%`,
              background: '#FFC93C',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[12px]">
          <span data-testid="ranked-tier-progress-xp" className="text-bq-ink2 font-semibold">
            <span className="text-bq-amberd font-extrabold text-[14px]">
              {totalPoints.toLocaleString('vi-VN')}
            </span>{' '}
            XP
          </span>
          <span className="text-bq-ink3">
            / {(nextTier ? nextTier.minPoints : totalPoints).toLocaleString('vi-VN')} XP
          </span>
        </div>
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
