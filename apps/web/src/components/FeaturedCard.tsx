import { ReactNode } from 'react'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Primary "core experience" card — Practice + Ranked on the Home page.
 * HR-4b redesign per mockup home_redesign_mockup.html `.mode-card`:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ [icon] Title                  [status chip]    │
 *   │        Description                             │
 *   ├──────────────────────────────────────────────── │
 *   │ meta text                       Bắt đầu  →     │
 *   └────────────────────────────────────────────────┘
 *
 * The whole card surface is clickable; the footer arrow is the visible
 * affordance. The "gold" theme adds a tinted background gradient and a
 * brighter border to flag Ranked as the featured action; "blue" stays
 * subdued so Ranked dominates as the primary CTA.
 */
interface FeaturedCardProps {
  id: string
  theme: 'blue' | 'gold'
  icon: string
  iconFill?: boolean
  title: string
  description: string
  /** Optional top-right slot (status chip or badge). */
  badge?: ReactNode
  /** Optional small meta line in the footer (left side). e.g. "Energy 100/100". */
  meta?: ReactNode
  /** Footer-arrow CTA. Whole card calls onClick; arrow label is text only. */
  cta: {
    label: string
    onClick: () => void
    disabled?: boolean
    /** Kept for API compatibility — currently unused in HR-4b layout. */
    iconLeft?: string
  }
  isRecommended?: boolean
  recommendReason?: string
}

interface ThemeTokens {
  cardBg: string
  cardBorder: string
  iconBg: string
  iconBorder: string
  iconText: string
  arrowText: string
  reasonText: string
}

const THEMES: Record<'blue' | 'gold', ThemeTokens> = {
  blue: {
    cardBg: 'bg-[rgba(50,52,64,0.4)]',
    cardBorder: 'border-secondary/10',
    iconBg: 'bg-[linear-gradient(135deg,rgba(96,165,250,0.2)_0%,rgba(59,130,246,0.1)_100%)]',
    iconBorder: 'border-[rgba(96,165,250,0.3)]',
    iconText: 'text-[#60a5fa]',
    arrowText: 'text-[#60a5fa]',
    reasonText: 'text-[#60a5fa]',
  },
  gold: {
    cardBg:
      'bg-[linear-gradient(135deg,rgba(232,168,50,0.06)_0%,transparent_50%),rgba(50,52,64,0.4)]',
    cardBorder: 'border-secondary/30',
    iconBg: 'bg-[linear-gradient(135deg,rgba(232,168,50,0.2)_0%,rgba(217,119,6,0.1)_100%)]',
    iconBorder: 'border-secondary/30',
    iconText: 'text-secondary',
    arrowText: 'text-secondary',
    reasonText: 'text-secondary',
  },
}

export default function FeaturedCard({
  id,
  theme,
  icon,
  iconFill,
  title,
  description,
  badge,
  meta,
  cta,
  isRecommended,
  recommendReason,
}: FeaturedCardProps) {
  const tokens = THEMES[theme]
  const recommendOverlay = isRecommended
    ? 'shadow-[0_0_24px_rgba(232,168,50,0.25)] ring-1 ring-secondary/30'
    : ''
  const disabled = !!cta.disabled

  return (
    <button
      type="button"
      data-testid={`featured-card-${id}`}
      data-recommended={isRecommended ? 'true' : 'false'}
      data-theme={theme}
      onClick={disabled ? undefined : cta.onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`relative w-full text-left rounded-2xl border ${tokens.cardBorder} ${tokens.cardBg} backdrop-blur-md p-5 md:p-5 flex flex-col gap-3.5 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5 transition-transform'
      } ${recommendOverlay}`}
    >
      {/* Top row: icon + title/desc (left) | status chip (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`shrink-0 w-11 h-11 rounded-xl border ${tokens.iconBorder} ${tokens.iconBg} ${tokens.iconText} grid place-items-center`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={iconFill ? FILL_1 : undefined}
            >
              {icon}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-on-surface text-[16px] md:text-[17px] font-bold leading-tight truncate">
              {title}
            </div>
            <div className="text-on-surface-variant text-[12px] mt-0.5 truncate">
              {description}
            </div>
          </div>
        </div>
        {badge && (
          <div data-testid={`featured-card-${id}-badge-slot`} className="shrink-0">
            {badge}
          </div>
        )}
        {isRecommended && !badge && (
          <span
            data-testid={`featured-card-${id}-badge`}
            className="px-2 py-0.5 rounded-full gold-gradient text-[9px] font-bold tracking-widest text-on-secondary animate-pulse shrink-0"
          >
            ✨
          </span>
        )}
      </div>

      {isRecommended && recommendReason && (
        <p
          data-testid={`featured-card-${id}-reason`}
          className={`text-[11px] font-medium ${tokens.reasonText} leading-snug`}
        >
          {recommendReason}
        </p>
      )}

      {/* Footer: meta (left) | arrow link (right) */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
        <div className="text-[11px] text-on-surface-variant min-w-0 truncate">
          {meta ?? ' '}
        </div>
        <span
          data-testid={`featured-card-${id}-cta`}
          className={`inline-flex items-center gap-1 text-[13px] font-bold ${tokens.arrowText} shrink-0`}
        >
          {cta.label}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </button>
  )
}
