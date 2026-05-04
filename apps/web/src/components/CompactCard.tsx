const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface CompactCardProps {
  /** Unique id used by data-testid (e.g. "compact-card-group"). */
  id: string
  icon: string
  iconFill?: boolean
  /** Hex color theme — drives bg tint, border, icon, hint text. */
  themeHex: string
  /** Localized full title — comes from i18n. */
  title: string
  /** Localized tiny subtitle (max 4 words) — comes from i18n. */
  subtitle: string
  /** Optional live-data hint (e.g. "3 rooms open"). When the
   *  underlying BE endpoint returns nothing, the consumer passes
   *  undefined and the hint row collapses. */
  liveHint?: string
  onClick: () => void
  /** Optional matchmaking-hint info pill (Tournament + Multiplayer). */
  matchmakingHint?: { title: string }
  /** Tier-gated lock (HR-4). When set, click is disabled, card is dimmed,
   *  and a lock chip + overlay describing the unlock condition is shown. */
  locked?: { reason: string }
}

function hexToRgba(hex: string, alpha: number): string {
  // Accept "#rgb", "#rrggbb", or "#rrggbbaa". Fall back to a neutral
  // tint if the input is malformed so we never throw inside render.
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
    return `rgba(255,255,255,${alpha})`
  }
  let r = 0
  let g = 0
  let b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Secondary card for the 6-card "explore more" grid. Each card
 * carries its own theme color (mockup line 286-294) — a tinted bg,
 * matching border, and matching icon + live-hint text — so the
 * section reads as a vibrant exploration menu instead of six
 * indistinguishable tiles. The whole card is the click target.
 */
export default function CompactCard({
  id,
  icon,
  iconFill,
  themeHex,
  title,
  subtitle,
  liveHint,
  onClick,
  matchmakingHint,
  locked,
}: CompactCardProps) {
  const isLocked = !!locked
  return (
    <button
      data-testid={`compact-card-${id}`}
      data-locked={isLocked || undefined}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      aria-disabled={isLocked || undefined}
      title={isLocked ? locked.reason : undefined}
      style={{
        backgroundColor: hexToRgba(themeHex, isLocked ? 0.03 : 0.06),
        border: `0.5px solid ${hexToRgba(themeHex, isLocked ? 0.12 : 0.2)}`,
      }}
      className={`relative w-full h-full rounded-xl p-3 md:p-4 text-left flex flex-col gap-2.5 items-stretch min-h-[112px] md:min-h-[120px] transition-opacity ${
        isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className="w-8 h-8 md:w-9 md:h-9 rounded-lg grid place-items-center material-symbols-outlined text-[16px] md:text-[18px] border"
          style={{
            color: themeHex,
            backgroundColor: hexToRgba(themeHex, 0.12),
            borderColor: hexToRgba(themeHex, 0.25),
            ...(iconFill ? FILL_1 : {}),
          }}
        >
          {icon}
        </span>
        {isLocked ? (
          <span
            data-testid={`compact-card-${id}-lock-chip`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(107,114,128,0.2)] border border-[rgba(107,114,128,0.3)] text-[9px] font-bold uppercase tracking-wide text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[10px]">lock</span>
            Khóa
          </span>
        ) : (
          matchmakingHint && (
            <span
              data-testid={`compact-card-${id}-matchmaking-hint`}
              title={matchmakingHint.title}
              aria-label={matchmakingHint.title}
              className="material-symbols-outlined text-[12px] text-on-surface-variant/70"
              onClick={(e) => e.stopPropagation()}
            >
              info
            </span>
          )
        )}
      </div>
      <div className="text-[13px] md:text-[14px] text-on-surface font-bold leading-tight">
        {title}
      </div>
      <div className="text-[10px] md:text-[11px] text-on-surface-variant/60 leading-snug">
        {subtitle}
      </div>
      {isLocked ? (
        <div
          data-testid={`compact-card-${id}-lock-reason`}
          className="text-[9px] md:text-[10px] font-medium mt-1.5 text-[#fbbf24] flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[11px]">flag</span>
          {locked.reason}
        </div>
      ) : (
        liveHint && (
          <div
            data-testid={`compact-card-${id}-hint`}
            className="text-[9px] md:text-[10px] font-medium mt-1.5"
            style={{ color: themeHex }}
          >
            {liveHint}
          </div>
        )
      )}
    </button>
  )
}
