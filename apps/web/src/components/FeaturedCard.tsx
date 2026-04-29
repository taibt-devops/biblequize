import { ReactNode } from 'react'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface FeaturedCardProps {
  /** Unique card id used by data-testid hooks (e.g. `featured-card-practice`). */
  id: string
  icon: string
  iconFill?: boolean
  /** Tailwind text-color class for the icon (e.g. "text-secondary"). */
  iconColor: string
  /** Localized title — rendered uppercase. */
  title: string
  /** Localized 1–2 line description. */
  description: string
  /** Optional status panel rendered between description and CTA — used
   *  by the Ranked variants to surface the unlock badge, the "needs
   *  catechism" hint, or the cooldown countdown. */
  status?: ReactNode
  cta: {
    label: string
    onClick: () => void
    /** Tailwind classes for the button — defaults to gold-gradient. Pass
     *  a muted style when the CTA is disabled. */
    className?: string
    disabled?: boolean
    iconLeft?: string
  }
  /** Optional smart-recommendation pulse badge. */
  isRecommended?: boolean
  recommendReason?: string
}

/**
 * Big "core experience" card on the Home page (Practice + Ranked). Sits
 * in the primary tier section above the secondary 6-card grid. Visual
 * weight is meant to dominate the secondary cards: ~220px tall, generous
 * padding, full-width gold-gradient CTA.
 *
 * Patterns intentionally avoided:
 *  - No background image / decorative pattern (per Option Y brief).
 *  - No tier-lock UI here — Ranked surfaces its lock via the `status`
 *    slot, not via a card-level disabled overlay.
 */
export default function FeaturedCard({
  id,
  icon,
  iconFill,
  iconColor,
  title,
  description,
  status,
  cta,
  isRecommended,
  recommendReason,
}: FeaturedCardProps) {
  // Recommendation overlay — keep as a Tailwind ring so it composes
  // additively with the warm-gradient base without fighting the
  // existing box-shadow stack.
  const recommendOverlay = isRecommended
    ? 'shadow-[0_0_32px_rgba(232,168,50,0.35)] ring-2 ring-secondary/30'
    : ''

  const ctaClass =
    cta.className ??
    (cta.disabled
      ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-70'
      : 'gold-gradient text-on-secondary shadow-lg shadow-secondary/10 active:scale-95')

  // 'ranked' variant gets a warmer gradient + stronger glow via global.css;
  // any other id falls through to the Practice-style default.
  const variant = id === 'ranked' ? 'ranked' : 'practice'

  return (
    <div
      data-testid={`featured-card-${id}`}
      data-recommended={isRecommended ? 'true' : 'false'}
      data-variant={variant}
      className={`featured-warm-card rounded-2xl p-7 sm:p-8 transition-all flex flex-col min-h-[220px] ${recommendOverlay}`}
    >
      {isRecommended && (
        <div
          data-testid={`featured-card-${id}-badge`}
          className="absolute top-3 right-3 z-20 px-3 py-1 rounded-full gold-gradient text-[10px] font-black tracking-widest text-on-secondary shadow-xl animate-pulse"
        >
          ✨
        </div>
      )}

      <div className="flex-1">
        <span
          className={`material-symbols-outlined text-4xl ${iconColor} block mb-4`}
          style={iconFill ? FILL_1 : undefined}
        >
          {icon}
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-on-surface uppercase tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4 line-clamp-2">
          {description}
        </p>
        {isRecommended && recommendReason && (
          <p
            data-testid={`featured-card-${id}-reason`}
            className="text-[12px] font-bold text-secondary leading-snug mb-3"
          >
            {recommendReason}
          </p>
        )}
        {status && <div className="mb-4">{status}</div>}
      </div>

      <button
        data-testid={`featured-card-${id}-cta`}
        disabled={cta.disabled}
        onClick={cta.onClick}
        className={`w-full px-5 py-3.5 rounded-xl font-black uppercase tracking-tight transition-transform ${ctaClass}`}
      >
        {cta.iconLeft && (
          <span className="material-symbols-outlined align-middle text-base mr-2" style={FILL_1}>
            {cta.iconLeft}
          </span>
        )}
        {cta.label}
      </button>
    </div>
  )
}
