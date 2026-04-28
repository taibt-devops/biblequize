import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTierInfo } from '../data/tiers'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface LockedMode {
  id: string
  nameKey: string
  icon: string
  iconFill?: boolean
}

/**
 * Five modes hidden from the tier-1 Home grid (see Home tier-1 first
 * impression layout). The list is fixed — once the user reaches a tier
 * that exposes the full grid, the parent simply stops rendering this
 * teaser; no per-mode filtering needed here.
 */
const LOCKED_MODES: LockedMode[] = [
  { id: 'ranked',      nameKey: 'gameModes.ranked',     icon: 'bolt',    iconFill: true },
  { id: 'mystery',     nameKey: 'gameModes.mystery',    icon: 'casino',  iconFill: true },
  { id: 'speed',       nameKey: 'gameModes.speed',      icon: 'speed',   iconFill: true },
  { id: 'tournament',  nameKey: 'gameModes.tournament', icon: 'trophy' },
  { id: 'multiplayer', nameKey: 'gameModes.rooms',      icon: 'gamepad' },
]

interface LockedModesTeaserProps {
  /** User's current tier id (1-6). */
  userTier: number
  /** Lifetime XP — used to compute progress to the next tier. */
  totalPoints: number
}

/**
 * Compact "preview wall" for modes the tier-1 user does not yet see on
 * Home. Rendered as a 5-cell grid of blurred icons under a single lock
 * overlay, with a progress bar to the next tier and a link to the help
 * page that explains the tier system.
 *
 * Returns {@code null} when the user has progressed past tier 4 — at
 * that point Tournament (the last hard-locked mode) is unlocked, so the
 * teaser has nothing useful left to say. Threshold is generous on
 * purpose: keeps the "you have something to chase" surface visible
 * while the user is still climbing the early tiers.
 */
export default function LockedModesTeaser({ userTier, totalPoints }: LockedModesTeaserProps) {
  const { t } = useTranslation()

  // Hide once user is at or above tier 5 — Tournament unlocked at T4 is
  // the last tier-gated mode, so by T5 nothing in this list is locked.
  if (userTier >= 5) return null

  const tierInfo = getTierInfo(totalPoints)
  const progressPct = tierInfo.progressPct
  const nextTierName = tierInfo.next ? t(tierInfo.next.nameKey) : t('home.maxTier')
  const targetXp = tierInfo.next?.minPoints ?? totalPoints
  const currentXp = totalPoints

  return (
    <Link
      to="/help#tiers"
      data-testid="locked-modes-teaser"
      className="block rounded-2xl bg-surface-container p-6 border border-outline-variant/10 hover:border-secondary/20 transition-all group"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-on-surface-variant text-base" style={FILL_1}>lock</span>
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          {t('home.lockedTeaser.title')}
        </h3>
      </div>

      {/* 5-cell grid: 3+2 wrap on mobile, single row from sm: up */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
        {LOCKED_MODES.map(mode => (
          <div
            key={mode.id}
            data-testid={`locked-mode-${mode.id}`}
            title={t(mode.nameKey)}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative w-full aspect-square rounded-xl bg-surface-container-high border border-outline-variant/10 overflow-hidden">
              {/* Blurred icon — keeps the silhouette but feels "out of reach" */}
              <span
                className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-3xl text-on-surface-variant"
                style={{ ...(mode.iconFill ? FILL_1 : {}), filter: 'blur(4px)' }}
              >
                {mode.icon}
              </span>
              {/* Lock overlay on top */}
              <span
                data-testid={`locked-mode-overlay-${mode.id}`}
                className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-xl text-on-surface/70"
                style={FILL_1}
              >
                lock
              </span>
            </div>
            <p className="text-[10px] font-bold text-on-surface text-center leading-tight">
              {t(mode.nameKey)}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar to next tier */}
      <div className="space-y-2 mb-3">
        <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div
            data-testid="locked-teaser-progress-bar"
            className="h-full gold-gradient rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p data-testid="locked-teaser-progress-label" className="text-xs font-bold text-on-surface-variant">
          {t('home.lockedTeaser.progressLabel', {
            current: currentXp.toLocaleString(),
            target: targetXp.toLocaleString(),
            tierName: nextTierName,
          })}
        </p>
      </div>

      {/* Link */}
      <p className="text-xs font-bold text-secondary uppercase tracking-widest group-hover:underline">
        {t('home.lockedTeaser.linkText')}
      </p>
    </Link>
  )
}
