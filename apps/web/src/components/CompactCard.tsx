const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface CompactCardProps {
  /** Unique id used by data-testid (e.g. "compact-card-group"). */
  id: string
  icon: string
  iconFill?: boolean
  iconColor: string
  /** Localized full title — comes from i18n. */
  title: string
  /** Localized tiny subtitle (max 4 words) — comes from i18n. */
  subtitle: string
  onClick: () => void
  /** Optional matchmaking-hint info pill (Tournament + Multiplayer). */
  matchmakingHint?: { title: string }
}

/**
 * Secondary card for the 6-card "explore more" grid. Goal: visible,
 * tappable, but visually subordinate to the two FeaturedCards above.
 * Whole card is the click target — no separate CTA button. No
 * background patterns / decorative imagery.
 */
export default function CompactCard({
  id,
  icon,
  iconFill,
  iconColor,
  title,
  subtitle,
  onClick,
  matchmakingHint,
}: CompactCardProps) {
  return (
    <button
      data-testid={`compact-card-${id}`}
      onClick={onClick}
      className="compact-card-polished group relative flex flex-col items-start text-left rounded-xl p-4 min-h-[100px]"
    >
      {matchmakingHint && (
        <span
          data-testid={`compact-card-${id}-matchmaking-hint`}
          title={matchmakingHint.title}
          aria-label={matchmakingHint.title}
          className="material-symbols-outlined absolute top-3 right-3 text-sm text-on-surface-variant/70"
          onClick={(e) => e.stopPropagation()}
        >
          info
        </span>
      )}
      <span
        className={`material-symbols-outlined text-2xl ${iconColor} mb-2`}
        style={iconFill ? FILL_1 : undefined}
      >
        {icon}
      </span>
      <span className="text-[15px] font-bold text-on-surface leading-tight">{title}</span>
      <span className="text-xs text-on-surface-variant mt-1">{subtitle}</span>
    </button>
  )
}
