import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTierInfo } from '../data/tiers'
import { TIER_PERKS } from '../data/tierPerks'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface TierPerksTeaserProps {
  /** User's current tier id (1-6). */
  userTier: number
  /** Lifetime XP — used to render the progress bar to the next tier. */
  totalPoints: number
}

/**
 * Aspirational "what you unlock at the next tier" card on Home. Replaces
 * the older {@code <LockedModesTeaser>}: instead of saying "5 modes are
 * locked" — which was misleading because the backend never gated those
 * modes — this card frames tier progression positively, listing the
 * concrete perks (XP×, energy regen, streak freeze) the user will gain
 * when they cross the next threshold.
 *
 * Returns {@code null} for tier-6 users — they have no next tier to
 * preview. A future Prestige system can plug in here.
 */
export default function TierPerksTeaser({ userTier, totalPoints }: TierPerksTeaserProps) {
  const { t } = useTranslation()

  if (userTier >= 6) return null

  const nextTierId = userTier + 1
  const perks = TIER_PERKS[nextTierId] ?? []
  if (perks.length === 0) return null

  const tierInfo = getTierInfo(totalPoints)
  const nextTier = tierInfo.next
  if (!nextTier) return null

  const targetXp = nextTier.minPoints
  const progressPct = tierInfo.progressPct

  return (
    <Link
      to="/help#tiers"
      data-testid="tier-perks-teaser"
      className="block rounded-2xl bg-surface-container p-6 border border-outline-variant/10 hover:border-secondary/20 transition-all group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-secondary text-base" style={FILL_1}>
          auto_awesome
        </span>
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          {t('home.tierPerks.title')}
        </h3>
      </div>

      <p className="text-sm font-medium text-on-surface mb-5">
        {t('home.tierPerks.subtitle', {
          tierName: t(nextTier.nameKey),
          xp: targetXp.toLocaleString(),
        })}
      </p>

      {/* Perks list */}
      <ul data-testid="tier-perks-list" className="space-y-3 mb-5">
        {perks.map((perk, i) => (
          <li
            key={`${perk.textKey}-${i}`}
            data-testid={`tier-perk-${perk.textKey}`}
            className="flex items-center gap-3"
          >
            <span
              className="material-symbols-outlined text-secondary text-xl shrink-0"
              style={FILL_1}
            >
              {perk.icon}
            </span>
            <span className="text-sm text-on-surface">
              {t(`home.tierPerks.${perk.textKey}`, perk.textParams ?? {})}
            </span>
          </li>
        ))}
      </ul>

      {/* Progress bar to next tier */}
      <div className="space-y-2 mb-3">
        <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div
            data-testid="tier-perks-progress-bar"
            className="h-full gold-gradient rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs font-bold text-on-surface-variant">
          {totalPoints.toLocaleString()} / {targetXp.toLocaleString()} XP
        </p>
      </div>

      {/* Link */}
      <p className="text-xs font-bold text-secondary uppercase tracking-widest group-hover:underline">
        {t('home.tierPerks.linkText')}
      </p>
    </Link>
  )
}
