import { ReactNode } from 'react'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Compact "core experience" card — Practice (blue) + Ranked (gold) on
 * the Home page, per
 * docs/designs/biblequiz_home_redesign_proposal.html (line 81-104).
 *
 * Layout (~140px tall): tinted icon box + optional top-right badge,
 * title (14px), single-line subtitle (11px), small CTA. Theme drives
 * the four color slots (border, surface, icon, button); the 'gold'
 * theme keeps the gold-gradient filled CTA used by Ranked, while
 * 'blue' uses an outline button so the Practice card visually steps
 * back from the primary action — see V1 review in
 * PROMPT_HOME_REDESIGN.md.
 */
interface FeaturedCardProps {
  /** Card identity used for testid hooks (e.g. featured-card-practice). */
  id: string
  /** Color theme. 'gold' = Ranked (primary, filled). 'blue' = Practice
   *  (secondary, outline). */
  theme: 'blue' | 'gold'
  icon: string
  iconFill?: boolean
  title: string
  description: string
  /** Optional top-right badge. Caller controls the wrapping element so
   *  it can attach data-testid (e.g. ranked-featured-status). */
  badge?: ReactNode
  cta: {
    label: string
    onClick: () => void
    disabled?: boolean
    iconLeft?: string
  }
  /** Smart-recommendation pulse (✨). */
  isRecommended?: boolean
  recommendReason?: string
}

interface ThemeTokens {
  cardBg: string
  cardBorder: string
  iconBg: string
  iconText: string
  ctaClass: string
  reasonText: string
}

const THEMES: Record<'blue' | 'gold', ThemeTokens> = {
  blue: {
    cardBg: 'bg-[rgba(74,158,255,0.08)]',
    cardBorder: 'border-[rgba(74,158,255,0.25)]',
    iconBg: 'bg-[rgba(74,158,255,0.2)]',
    iconText: 'text-[#4a9eff]',
    // Practice — outline blue button (V1 fix per H3).
    ctaClass:
      'bg-transparent border border-[#4a9eff] text-[#4a9eff] hover:bg-[rgba(74,158,255,0.1)]',
    reasonText: 'text-[#4a9eff]',
  },
  gold: {
    cardBg: 'bg-[rgba(232,168,50,0.1)]',
    cardBorder: 'border-secondary/40',
    iconBg: 'bg-secondary/20',
    iconText: 'text-secondary',
    // Ranked — filled gold CTA, primary action.
    ctaClass:
      'gold-gradient text-on-secondary shadow-lg shadow-secondary/10 active:scale-95',
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
  cta,
  isRecommended,
  recommendReason,
}: FeaturedCardProps) {
  const tokens = THEMES[theme]
  const recommendOverlay = isRecommended
    ? 'shadow-[0_0_24px_rgba(232,168,50,0.25)] ring-1 ring-secondary/30'
    : ''

  // Disabled state overrides theme-derived button class.
  const disabledClass =
    'bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-70'
  const ctaResolved = cta.disabled ? disabledClass : tokens.ctaClass

  return (
    <div
      data-testid={`featured-card-${id}`}
      data-recommended={isRecommended ? 'true' : 'false'}
      data-theme={theme}
      className={`relative rounded-xl border ${tokens.cardBorder} ${tokens.cardBg} p-3 md:p-3.5 ${recommendOverlay}`}
    >
      {/* Top row: icon box (left) + optional badge (right) */}
      <div className="flex items-center justify-between mb-2">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center text-[14px] ${tokens.iconBg} ${tokens.iconText}`}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={iconFill ? FILL_1 : undefined}
          >
            {icon}
          </span>
        </div>
        {badge && (
          <div data-testid={`featured-card-${id}-badge-slot`} className="text-[10px]">
            {badge}
          </div>
        )}
        {isRecommended && !badge && (
          <span
            data-testid={`featured-card-${id}-badge`}
            className="px-2 py-0.5 rounded-full gold-gradient text-[9px] font-bold tracking-widest text-on-secondary animate-pulse"
          >
            ✨
          </span>
        )}
      </div>

      <h3 className="text-on-surface text-sm md:text-[14px] font-medium mb-0.5 truncate">
        {title}
      </h3>
      <p className="text-[11px] text-on-surface-variant/50 mb-3 line-clamp-1">
        {description}
      </p>

      {isRecommended && recommendReason && (
        <p
          data-testid={`featured-card-${id}-reason`}
          className={`text-[11px] font-medium ${tokens.reasonText} mb-2 leading-snug`}
        >
          {recommendReason}
        </p>
      )}

      <button
        data-testid={`featured-card-${id}-cta`}
        disabled={cta.disabled}
        onClick={cta.onClick}
        className={`w-full px-3 py-2 rounded-md text-[11px] md:text-xs font-medium transition-all ${ctaResolved}`}
      >
        {cta.iconLeft && (
          <span
            className="material-symbols-outlined align-middle text-[14px] mr-1.5"
            style={FILL_1}
          >
            {cta.iconLeft}
          </span>
        )}
        {cta.label}
      </button>
    </div>
  )
}
