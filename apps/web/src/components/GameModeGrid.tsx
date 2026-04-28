import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getRecommendedMode, type RecommendedMode } from '../utils/getRecommendedMode'
import { TIERS } from '../data/tiers'
import {
  minCorrectNeededForEarlyUnlock,
  practiceAccuracyPct,
  earlyUnlockProgressPct,
  EARLY_UNLOCK_MIN_QUESTIONS,
  EARLY_UNLOCK_MIN_ACCURACY_PCT,
} from '../utils/earlyUnlock'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/* ── Types ── */
interface RankedStatus {
  livesRemaining: number
  dailyLives: number
}

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
  /**
   * Tier id at which this mode unlocks. Undefined = always unlocked
   * (tier 1+). Spec ref: 3.2.3.
   */
  requiredTier?: number
  /** i18n key for the tier name shown in the unlock message. */
  requiredTierNameKey?: string
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
  {
    id: 'ranked',
    titleKey: 'gameModes.ranked',
    descKey: 'gameModes.rankedDesc',
    icon: 'bolt',
    iconFill: true,
    color: 'text-secondary',
    borderHover: 'hover:shadow-[0_0_30px_rgba(248,189,69,0.05)]',
    borderDefault: 'border-secondary/20',
    bgIcon: 'text-secondary',
    ctaKey: 'gameModes.rankedBtn',
    ctaClass: 'gold-gradient text-on-secondary shadow-lg shadow-secondary/10 active:scale-95',
    route: '/ranked',
    tier: 'primary',
    requiredTier: 2,
    requiredTierNameKey: 'tiers.seeker',
  },
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
    requiredTier: 4,
    requiredTierNameKey: 'tiers.sage',
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
    /** Cumulative Practice answers — enables the early-unlock progress
     *  indicator on the locked Ranked card. Both must be supplied;
     *  omit to fall back to the single-path hint. */
    practiceCorrectCount?: number
    practiceTotalCount?: number
  }
  /**
   * User's current tier id (1..6). Used for tier gating — modes whose
   * {@code requiredTier} exceeds this value render in locked state and
   * are filtered out of recommendations. Defaults to {@code 1} when
   * omitted (safest for new/unauthenticated views).
   */
  userTier?: number
  /**
   * Early Ranked unlock flag — Tier-1 users who demonstrated ≥80%
   * accuracy over 10+ Practice answers bypass the Ranked tier gate.
   * Server-side {@code /api/me} returns {@code earlyRankedUnlock}.
   * Only affects the Ranked card (Tournament remains tier-4 gated).
   */
  earlyRankedUnlock?: boolean
  /**
   * Selects how many cards the grid renders.
   *
   * <ul>
   *   <li>{@code 'tier2plus'} (default) — full 9-card layout with
   *       primary/secondary/discovery sections. Used for the steady-
   *       state Home, the standalone Game Modes page, etc.</li>
   *   <li>{@code 'tier1'} — first-impression layout for brand-new
   *       users: only Practice + Church Groups, both as medium
   *       (secondary-style) cards. The other 7 modes are surfaced
   *       via {@code <LockedModesTeaser>} below the grid.</li>
   * </ul>
   */
  layout?: 'tier1' | 'tier2plus'
}

/* ── Component ── */
export default function GameModeGrid({
  userStats,
  userTier = 1,
  earlyRankedUnlock = false,
  layout = 'tier2plus',
}: GameModeGridProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Ranked state
  const [rankedStatus, setRankedStatus] = useState<RankedStatus>({ livesRemaining: 0, dailyLives: 100 })
  const [rankedLoading, setRankedLoading] = useState(true)
  const [rankedError, setRankedError] = useState(false)

  // Daily state
  const [dailyCompleted, setDailyCompleted] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [countdown, setCountdown] = useState(msUntilMidnight())

  // Multiplayer state
  const [roomCount, setRoomCount] = useState(0)
  const [roomLoading, setRoomLoading] = useState(true)

  // Fetch ranked status
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/me/ranked-status')
        if (!cancelled) {
          setRankedStatus({
            livesRemaining: res.data?.livesRemaining ?? 0,
            dailyLives: res.data?.dailyLives ?? 100,
          })
        }
      } catch {
        if (!cancelled) setRankedError(true)
      } finally {
        if (!cancelled) setRankedLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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

  const noEnergy = rankedStatus.livesRemaining <= 0
  const energyText = rankedLoading
    ? '...'
    : rankedError
      ? '—'
      : `${rankedStatus.livesRemaining}/${rankedStatus.dailyLives}`

  // Which recommendation targets are unlocked for this user's tier?
  // The engine currently targets 'practice' | 'ranked' | 'daily' only;
  // 'ranked' is gated (tier 2) but the early-unlock flag bypasses it.
  const unlockedRecommendModes = useMemo(() => {
    const modes = new Set<RecommendedMode>(['practice', 'daily'])
    if (userTier >= 2 || earlyRankedUnlock) modes.add('ranked')
    return modes
  }, [userTier, earlyRankedUnlock])

  // Compute recommendation once all signals are loaded. Returns null while
  // loading or when parent hasn't passed userStats → grid stays uniform.
  const recommendation = useMemo(() => {
    if (rankedLoading || dailyLoading) return null
    if (!userStats || userStats.currentStreak == null || userStats.totalPoints == null) {
      return null
    }
    return getRecommendedMode({
      totalPoints: userStats.totalPoints,
      currentStreak: userStats.currentStreak,
      energy: rankedStatus.livesRemaining,
      energyMax: rankedStatus.dailyLives,
      dailyDone: dailyCompleted,
      hoursToMidnight: countdown / 3_600_000,
      unlockedModes: unlockedRecommendModes,
    })
  }, [
    userStats,
    rankedStatus.livesRemaining,
    rankedStatus.dailyLives,
    dailyCompleted,
    countdown,
    rankedLoading,
    dailyLoading,
    unlockedRecommendModes,
  ])

  /* ── Status line per card ── */
  function getStatusLine(id: string) {
    switch (id) {
      case 'practice':
        return <span className="text-[10px] font-bold text-secondary-container uppercase">{t('gameModes.practiceTag')}</span>
      case 'ranked':
        return (
          <div data-testid="home-energy-bar" className="flex flex-col">
            <span className="text-[10px] font-black text-secondary uppercase">
              ⚡ {t('gameModes.rankedEnergy', { current: rankedStatus.livesRemaining, max: rankedStatus.dailyLives })}
            </span>
            <span className="text-[8px] text-error font-medium">{t('gameModes.rankedCost')}</span>
          </div>
        )
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
    // Early Ranked unlock bypasses tier gate for the Ranked card only.
    // Tournament (requiredTier=4) and other gated modes still respect tier.
    const bypassByEarlyUnlock = card.id === 'ranked' && earlyRankedUnlock
    const isLocked =
      card.requiredTier != null &&
      userTier < card.requiredTier &&
      !bypassByEarlyUnlock
    const isNoEnergy = card.id === 'ranked' && noEnergy && !rankedLoading && !isLocked
    // "isDisabled" = card cannot be activated right now (either locked or out of energy).
    const isDisabled = isLocked || isNoEnergy
    const isRecommended = recommendation?.mode === card.id && !isDisabled
    const recommendReason = isRecommended
      ? t(`home.recommend.${recommendation!.reasonKey}`, recommendation!.values)
      : null
    const unlockTierName = card.requiredTierNameKey ? t(card.requiredTierNameKey) : ''
    // Compute XP gap so we can surface a concrete "cần X điểm nữa" message
    // rather than a vague "đạt tier Y" nudge. TIERS id is 1-based;
    // requiredTier is the id, so array index is id-1.
    const requiredTierData =
      card.requiredTier != null ? TIERS[card.requiredTier - 1] : null
    const pointsToUnlock =
      requiredTierData && userStats?.totalPoints != null
        ? Math.max(0, requiredTierData.minPoints - userStats.totalPoints)
        : null
    // Lower tier in TIERS list = closer to the user's start; progress
    // percentage toward unlock.
    const unlockProgressPct =
      requiredTierData && userStats?.totalPoints != null && requiredTierData.minPoints > 0
        ? Math.min(100, Math.round((userStats.totalPoints / requiredTierData.minPoints) * 100))
        : 0

    // Baseline border classes — overridden when recommended.
    const baseBorderClasses =
      `${card.borderDefault ?? 'border-outline-variant/10'} ${card.borderHover}`
    const highlightBorderClasses =
      'border-secondary bg-secondary/[0.04] shadow-[0_0_32px_rgba(232,168,50,0.35)] ring-2 ring-secondary/30'
    // Locked: more muted than no-energy; grayscale icon + subtle border.
    const lockedBorderClasses =
      'border-outline-variant/20 grayscale-[0.4] opacity-75'

    let borderClasses: string
    if (isRecommended) borderClasses = highlightBorderClasses
    else if (isLocked) borderClasses = lockedBorderClasses
    else borderClasses = baseBorderClasses

    return (
      <div
        key={card.id}
        data-testid={`game-mode-${card.id}`}
        data-recommended={isRecommended ? 'true' : 'false'}
        data-locked={isLocked ? 'true' : 'false'}
        data-tier={card.tier}
        onClick={() => !isDisabled && navigate(card.route)}
        className={`group bg-surface-container rounded-2xl ${styles.padding} border-2 transition-all flex flex-col justify-between ${styles.height} relative overflow-hidden ${
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${borderClasses}`}
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

        {/* Lock badge — tier-gated modes. Distinct from recommendation. */}
        {isLocked && (
          <div
            data-testid={`game-mode-${card.id}-lock`}
            className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-highest border border-outline-variant/30 text-[10px] font-bold text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-xs">lock</span>
            {t('gameModes.lockedBadge', { defaultValue: 'Locked' })}
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
          {/* Unlock hint (locked) — for Ranked card, show BOTH paths
              (XP + Practice accuracy) with progress bars so the user
              sees "how close am I to each" at a glance. For other
              tier-gated cards (Tournament etc.), show only XP path. */}
          {isLocked && (() => {
            const showEarlyPath =
              card.id === 'ranked' &&
              userStats?.practiceCorrectCount != null &&
              userStats?.practiceTotalCount != null
            const practiceCorrect = userStats?.practiceCorrectCount ?? 0
            const practiceTotal = userStats?.practiceTotalCount ?? 0
            const needed = minCorrectNeededForEarlyUnlock(practiceCorrect, practiceTotal)
            const accuracy = practiceAccuracyPct(practiceCorrect, practiceTotal)
            const earlyPct = earlyUnlockProgressPct(practiceCorrect, practiceTotal)
            return (
              <div data-testid={`game-mode-${card.id}-unlock-hint`} className="mt-2 space-y-2">
                {/* Path 1 — XP (always shown) */}
                <div className="space-y-1" data-testid={`game-mode-${card.id}-xp-path`}>
                  <p className="text-[11px] font-semibold text-on-surface-variant leading-snug">
                    {pointsToUnlock != null
                      ? t('gameModes.unlockAtWithPoints', {
                          tier: unlockTierName,
                          points: pointsToUnlock.toLocaleString(),
                        })
                      : t('gameModes.unlockAt', { tier: unlockTierName })}
                  </p>
                  {pointsToUnlock != null && requiredTierData && (
                    <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        data-testid={`game-mode-${card.id}-unlock-progress`}
                        className="h-full gold-gradient rounded-full transition-all"
                        style={{ width: `${unlockProgressPct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Path 2 — Early unlock via Practice accuracy (Ranked only) */}
                {showEarlyPath && (
                  <div className="space-y-1" data-testid={`game-mode-${card.id}-accuracy-path`}>
                    <p className="text-[11px] font-semibold text-on-surface-variant leading-snug">
                      {t('gameModes.orEarlyUnlock')}{' '}
                      <span data-testid={`game-mode-${card.id}-accuracy-status`} className="text-secondary">
                        {needed === 0
                          ? t('gameModes.earlyUnlockReady')
                          : t('gameModes.earlyUnlockRemaining', {
                              correct: practiceCorrect,
                              total: practiceTotal,
                              acc: accuracy ?? 0,
                              need: needed,
                            })}
                      </span>
                    </p>
                    <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        data-testid={`game-mode-${card.id}-accuracy-progress`}
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${earlyPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Deep link into the FAQ for full explanation */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/help#howUnlockRanked')
                  }}
                  className="text-[11px] font-semibold text-secondary hover:underline"
                >
                  {t('gameModes.learnMore', { defaultValue: 'Tìm hiểu thêm →' })}
                </button>
              </div>
            )
          })()}
        </div>

        <div className="flex justify-between items-center relative z-10">
          {getStatusLine(card.id)}
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Locked card: redirect to Practice (onboarding path to earn
              // XP) instead of a dead CTA. Users previously saw a
              // non-interactive button and had to guess the path forward.
              if (isLocked) return navigate('/practice')
              if (!isDisabled) navigate(card.route)
            }}
            disabled={isNoEnergy}
            className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isLocked
                ? 'bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary hover:text-on-secondary'
                : card.ctaClass
            }`}
          >
            {isLocked
              ? t('gameModes.unlockCtaEarnXp')
              : card.id === 'ranked' && isNoEnergy
                ? t('gameModes.noEnergy')
                : t(card.ctaKey)}
          </button>
        </div>
      </div>
    )
  }

  // Tier-1 first-impression layout: only Practice + Church Groups, both
  // sized as 'secondary' (medium) cards. The other 7 modes are exposed
  // via <LockedModesTeaser> below the grid in Home.tsx.
  if (layout === 'tier1') {
    const tier1Cards = CARDS
      .filter(c => c.id === 'practice' || c.id === 'group')
      .map(c => ({ ...c, tier: 'secondary' as CardTier }))
    return (
      <div data-testid="game-mode-grid" data-layout="tier1" className="space-y-5">
        <section
          data-testid="game-mode-tier1-cards"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {tier1Cards.map(renderCard)}
        </section>
      </div>
    )
  }

  return (
    <div data-testid="game-mode-grid" data-layout="tier2plus" className="space-y-5">
      {/* Tier 1 — Primary (core loops): Practice + Ranked, taller/wider */}
      <section
        data-testid="game-mode-tier-primary"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
