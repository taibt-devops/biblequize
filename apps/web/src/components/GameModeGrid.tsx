import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getRecommendedMode, type RecommendedMode } from '../utils/getRecommendedMode'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/* ── Helpers ── */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function msUntilMidnight(): number {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  return utcMidnight.getTime() - now.getTime()
}

/* ── Card config ── */
type CardTier = 'primary' | 'secondary' | 'discovery'

interface CardConfig {
  id: string
  titleKey: string
  descKey: string
  icon: string
  color: string
  borderHover: string
  ctaKey: string
  ctaClass: string
  route: string
  tier: CardTier
  iconFill?: boolean
  borderDefault?: string
  bgIcon?: string
}

const CARDS: CardConfig[] = [
  {
    id: 'practice',
    titleKey: 'gameModes.practice',
    descKey: 'gameModes.practiceDesc',
    icon: 'menu_book',
    color: 'text-secondary',
    borderHover: 'hover:border-secondary/30',
    ctaKey: 'common.startNow',
    ctaClass: 'bg-surface-container-highest text-secondary border border-outline-variant/20 hover:bg-secondary hover:text-on-secondary',
    route: '/practice',
    tier: 'primary',
  },
  // Ranked card removed (BasicQuizCard banner above the grid is now the
  // single gateway for Ranked unlock). DECISIONS.md 2026-04-29.
  {
    id: 'daily',
    titleKey: 'gameModes.daily',
    descKey: 'gameModes.dailyDesc',
    icon: 'calendar_today',
    color: 'text-tertiary',
    borderHover: 'hover:border-tertiary/30',
    bgIcon: 'text-tertiary',
    ctaKey: 'gameModes.dailyBtn',
    ctaClass: 'bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary hover:text-on-tertiary',
    route: '/daily',
    tier: 'secondary',
  },
  {
    id: 'group',
    titleKey: 'gameModes.groups',
    descKey: 'gameModes.groupsDesc',
    icon: 'church',
    color: 'text-primary',
    borderHover: 'hover:border-primary/30',
    bgIcon: 'text-primary',
    ctaKey: 'gameModes.groupsBtn',
    ctaClass: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary',
    route: '/groups',
    tier: 'secondary',
  },
  {
    id: 'multiplayer',
    titleKey: 'gameModes.rooms',
    descKey: 'gameModes.roomsDesc',
    icon: 'gamepad',
    color: 'text-secondary',
    borderHover: 'hover:border-secondary/30',
    ctaKey: 'gameModes.roomsBtn',
    ctaClass: 'bg-surface-container-highest text-secondary border border-outline-variant/20 hover:bg-secondary hover:text-on-secondary',
    route: '/multiplayer',
    tier: 'secondary',
  },
  {
    id: 'tournament',
    titleKey: 'gameModes.tournament',
    descKey: 'gameModes.tournamentDesc',
    icon: 'trophy',
    color: 'text-error',
    borderHover: 'hover:border-error/30',
    bgIcon: 'text-error',
    ctaKey: 'gameModes.tournamentBtn',
    ctaClass: 'bg-error/10 text-error border border-error/20 hover:bg-error hover:text-on-error',
    route: '/tournaments',
    tier: 'secondary',
    // Tournament was previously gated at tier 4. Backend never enforced
    // this — only the UI was hiding it — so the gate is removed for v1
    // launch (open access). A subtle matchmaking hint on the card warns
    // the user they may face longer-tenured players. Tier-based seeding
    // is tracked as a v1.1 follow-up (MATCHMAKING TODO).
  },
  {
    id: 'weekly',
    titleKey: 'gameModes.weekly',
    descKey: 'gameModes.weeklyDesc',
    icon: 'event',
    iconFill: true,
    color: 'text-purple-400',
    borderHover: 'hover:border-purple-400/30',
    bgIcon: 'text-purple-400',
    ctaKey: 'gameModes.weeklyBtn',
    ctaClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500 hover:text-white',
    route: '/weekly-quiz',
    tier: 'discovery',
  },
  {
    id: 'mystery',
    titleKey: 'gameModes.mystery',
    descKey: 'gameModes.mysteryDesc',
    icon: 'casino',
    iconFill: true,
    color: 'text-pink-400',
    borderHover: 'hover:border-pink-400/30',
    bgIcon: 'text-pink-400',
    ctaKey: 'gameModes.mysteryBtn',
    ctaClass: 'bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500 hover:text-white',
    route: '/mystery-mode',
    tier: 'discovery',
  },
  {
    id: 'speed',
    titleKey: 'gameModes.speed',
    descKey: 'gameModes.speedDesc',
    icon: 'speed',
    iconFill: true,
    color: 'text-orange-400',
    borderHover: 'hover:border-orange-400/30',
    bgIcon: 'text-orange-400',
    ctaKey: 'gameModes.speedBtn',
    ctaClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-white',
    route: '/speed-round',
    tier: 'discovery',
  },
]

/**
 * Cards where we surface a soft matchmaking hint — these put the user in
 * a competitive room with strangers, so a tier-1 user may face longer-
 * tenured players. Rendered as a subtle info icon with a hover tooltip
 * (no scary modal). Tier-based seeding tracked as MATCHMAKING TODO v1.1.
 */
const MATCHMAKING_HINT_MODES = new Set(['tournament', 'multiplayer'])

/* ── Props ── */
interface GameModeGridProps {
  /**
   * User stats needed by the recommendation engine. When omitted (or
   * fields undefined) no card will be highlighted — the grid renders in
   * its uniform baseline state, which is the safe fallback while the
   * parent page is still loading {@code /api/me}.
   */
  userStats?: {
    currentStreak?: number
    totalPoints?: number
  }
}

/* ── Component ── */
export default function GameModeGrid({
  userStats,
}: GameModeGridProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Daily state
  const [dailyCompleted, setDailyCompleted] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [countdown, setCountdown] = useState(msUntilMidnight())

  // Multiplayer state
  const [roomCount, setRoomCount] = useState(0)
  const [roomLoading, setRoomLoading] = useState(true)

  // Fetch daily challenge status
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/daily-challenge')
        if (!cancelled) setDailyCompleted(res.data?.alreadyCompleted ?? false)
      } catch { /* keep default */ }
      finally { if (!cancelled) setDailyLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  // Fetch multiplayer rooms
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/rooms/public')
        if (!cancelled) {
          const rooms = res.data?.rooms
          setRoomCount(Array.isArray(rooms) ? rooms.length : 0)
        }
      } catch { /* keep default */ }
      finally { if (!cancelled) setRoomLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setCountdown(msUntilMidnight()), 1_000)
    return () => clearInterval(interval)
  }, [])

  // Recommendation targets currently exposed by this grid. 'ranked' is
  // intentionally NOT in the set: the Ranked card was retired (Bible
  // Basics catechism is the gateway above the grid), so a 'ranked'
  // recommendation would have no card to highlight.
  const unlockedRecommendModes = useMemo(
    () => new Set<RecommendedMode>(['practice', 'daily']),
    [],
  )

  // Compute recommendation once all signals are loaded. Returns null while
  // loading or when parent hasn't passed userStats → grid stays uniform.
  const recommendation = useMemo(() => {
    if (dailyLoading) return null
    if (!userStats || userStats.currentStreak == null || userStats.totalPoints == null) {
      return null
    }
    return getRecommendedMode({
      totalPoints: userStats.totalPoints,
      currentStreak: userStats.currentStreak,
      // Energy/energyMax kept at sentinels: Ranked is not in the grid so
      // the engine's energy-aware branches are unreachable from here.
      energy: 0,
      energyMax: 100,
      dailyDone: dailyCompleted,
      hoursToMidnight: countdown / 3_600_000,
      unlockedModes: unlockedRecommendModes,
    })
  }, [
    userStats,
    dailyCompleted,
    countdown,
    dailyLoading,
    unlockedRecommendModes,
  ])

  /* ── Status line per card ── */
  function getStatusLine(id: string) {
    switch (id) {
      case 'practice':
        return <span className="text-[10px] font-bold text-secondary-container uppercase">{t('gameModes.practiceTag')}</span>
      case 'daily':
        return (
          <span className="text-[10px] font-bold text-tertiary uppercase">
            {dailyLoading ? '...' : dailyCompleted ? `✅ ${t('gameModes.dailyCompleted')}` : t('gameModes.dailyEndsIn', { time: formatCountdown(countdown) })}
          </span>
        )
      case 'group':
        return <span className="text-[10px] font-bold text-primary-fixed-dim uppercase">{t('gameModes.groupsTag')}</span>
      case 'multiplayer':
        return (
          <span className="text-[10px] font-bold text-secondary-container uppercase">
            {roomLoading ? '...' : t('gameModes.roomsTag', { count: roomCount })}
          </span>
        )
      case 'tournament':
        return <span className="text-[10px] font-bold text-error uppercase">{t('gameModes.tournamentTag')}</span>
      default:
        return null
    }
  }

  // Split cards by tier for sectioned rendering.
  const primaryCards = CARDS.filter(c => c.tier === 'primary')
  const secondaryCards = CARDS.filter(c => c.tier === 'secondary')
  const discoveryCards = CARDS.filter(c => c.tier === 'discovery')

  // Per-tier sizing tokens. Primary gets bigger height + icon + title;
  // discovery gets compact treatment to visually de-emphasize.
  const tierStyles: Record<CardTier, {
    height: string
    padding: string
    iconSize: string
    titleSize: string
    descLines: string
  }> = {
    primary:   { height: 'h-60', padding: 'p-7', iconSize: 'text-4xl', titleSize: 'text-xl',   descLines: 'line-clamp-3' },
    secondary: { height: 'h-44', padding: 'p-5', iconSize: 'text-2xl', titleSize: 'text-base', descLines: 'line-clamp-2' },
    // Discovery is de-emphasized so new users can focus on primary/secondary first.
    // Compact height, smaller icon, description hidden (line-clamp-1).
    discovery: { height: 'h-32', padding: 'p-4', iconSize: 'text-xl',  titleSize: 'text-sm',  descLines: 'line-clamp-1' },
  }

  function renderCard(card: CardConfig) {
    const styles = tierStyles[card.tier]
    const isRecommended = recommendation?.mode === card.id
    const recommendReason = isRecommended
      ? t(`home.recommend.${recommendation!.reasonKey}`, recommendation!.values)
      : null

    const baseBorderClasses =
      `${card.borderDefault ?? 'border-outline-variant/10'} ${card.borderHover}`
    const highlightBorderClasses =
      'border-secondary bg-secondary/[0.04] shadow-[0_0_32px_rgba(232,168,50,0.35)] ring-2 ring-secondary/30'
    const borderClasses = isRecommended ? highlightBorderClasses : baseBorderClasses

    return (
      <div
        key={card.id}
        data-testid={`game-mode-${card.id}`}
        data-recommended={isRecommended ? 'true' : 'false'}
        data-tier={card.tier}
        onClick={() => navigate(card.route)}
        className={`group bg-surface-container rounded-2xl ${styles.padding} border-2 transition-all flex flex-col justify-between ${styles.height} relative overflow-hidden cursor-pointer ${borderClasses}`}
      >
        {/* Recommendation badge — gold pill with pulse animation */}
        {isRecommended && (
          <div
            data-testid={`game-mode-${card.id}-badge`}
            className="absolute top-3 right-3 z-20 px-3 py-1 rounded-full gold-gradient text-[10px] font-black tracking-widest text-on-secondary shadow-xl animate-pulse"
          >
            {t('home.recommend.badge')}
          </div>
        )}

        {/* Watermark background icon */}
        <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity ${card.bgIcon ?? ''}`}>
          <span className="material-symbols-outlined text-9xl">{card.icon}</span>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`material-symbols-outlined ${styles.iconSize} ${card.color}`}
              style={card.iconFill ? FILL_1 : undefined}
            >
              {card.icon}
            </span>
            <h4 className={`font-bold text-on-surface ${styles.titleSize}`}>{t(card.titleKey)}</h4>
            {MATCHMAKING_HINT_MODES.has(card.id) && (
              <span
                data-testid={`game-mode-${card.id}-matchmaking-hint`}
                title={t('home.matchmakingHint')}
                aria-label={t('home.matchmakingHint')}
                className="material-symbols-outlined text-sm text-on-surface-variant/70 ml-auto cursor-help"
                onClick={(e) => e.stopPropagation()}
              >
                info
              </span>
            )}
          </div>
          <p className={`text-xs text-on-surface-variant ${styles.descLines}`}>{t(card.descKey)}</p>
          {/* Reason text (recommendation) */}
          {isRecommended && recommendReason && (
            <p
              data-testid={`game-mode-${card.id}-reason`}
              className="mt-2 text-[12px] font-bold text-secondary leading-snug"
            >
              {recommendReason}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center relative z-10">
          {getStatusLine(card.id)}
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(card.route)
            }}
            className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${card.ctaClass}`}
          >
            {t(card.ctaKey)}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="game-mode-grid" className="space-y-5">
      {/* Tier 1 — Primary (core loop): Practice spans full width since
          Ranked migrated out of the grid into the BasicQuizCard banner. */}
      <section
        data-testid="game-mode-tier-primary"
        className="grid grid-cols-1 gap-6"
      >
        {primaryCards.map(renderCard)}
      </section>

      {/* Tier 2 — Secondary (feature modes): standard size, 4-up on desktop */}
      <section
        data-testid="game-mode-tier-secondary"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {secondaryCards.map(renderCard)}
      </section>

      {/* Tier 3 — Discovery (novelty modes): compact, 3-up on desktop */}
      <section
        data-testid="game-mode-tier-discovery"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {discoveryCards.map(renderCard)}
      </section>
    </div>
  )
}
