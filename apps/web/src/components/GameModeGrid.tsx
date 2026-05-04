import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getRecommendedMode, type RecommendedMode } from '../utils/getRecommendedMode'
import FeaturedCard from './FeaturedCard'
import CompactCard from './CompactCard'
import RankedFeaturedCard from './RankedFeaturedCard'

/* ── Helpers ── */
function msUntilMidnight(): number {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  return utcMidnight.getTime() - now.getTime()
}

/* ── Secondary card configs ── */
interface CompactConfig {
  id: string
  icon: string
  iconFill?: boolean
  /** Mockup color. Drives bg tint, border, icon, and live-hint text. */
  themeHex: string
  titleKey: string
  subtitleKey: string
  route: string
  /** Tier-locked threshold (HR-4). Card is shown locked until totalPoints
   *  reaches this minimum. Undefined = always unlocked. Tier 2 (Người Tìm
   *  Kiếm) = 1000, Tier 4 (Hiền Triết) = 15000 — see data/tiers.ts. */
  lockedUntilPoints?: number
  lockedUnlockTierKey?: string
}

/**
 * HR-4 redesign: 3 sections matching home_redesign_mockup.html.
 *   1. Primary (FeaturedCard row): Practice + Ranked
 *   2. Variety (3-col): Weekly + Mystery + Speed — never tier-locked
 *      (DECISIONS.md 2026-05-02: variety modes are flat XP, no leaderboard)
 *   3. Group (3-col): Group + Multiplayer + Tournament — Multiplayer +
 *      Tournament are tier-gated (cannot enter competitive room without
 *      proving readiness in single-player first).
 */
const VARIETY_CARDS: CompactConfig[] = [
  {
    id: 'weekly',
    icon: 'event',
    iconFill: true,
    themeHex: '#a855f7',
    titleKey: 'gameModes.weekly',
    subtitleKey: 'home.compactSubtitles.weekly',
    route: '/weekly-quiz',
  },
  {
    id: 'mystery',
    icon: 'casino',
    iconFill: true,
    themeHex: '#d4537e',
    titleKey: 'gameModes.mystery',
    subtitleKey: 'home.compactSubtitles.mystery',
    route: '/mystery-mode',
  },
  {
    id: 'speed',
    icon: 'speed',
    iconFill: true,
    themeHex: '#ff8c42',
    titleKey: 'gameModes.speed',
    subtitleKey: 'home.compactSubtitles.speed',
    route: '/speed-round',
  },
]

const GROUP_CARDS: CompactConfig[] = [
  {
    id: 'group',
    icon: 'church',
    themeHex: '#4a9eff',
    titleKey: 'gameModes.groups',
    subtitleKey: 'home.compactSubtitles.group',
    route: '/groups',
  },
  {
    id: 'multiplayer',
    icon: 'gamepad',
    themeHex: '#9b59b6',
    titleKey: 'gameModes.rooms',
    subtitleKey: 'home.compactSubtitles.multiplayer',
    route: '/multiplayer',
    // Bui 2026-05-05: multiplayer không khóa — anyone can join a room
    // regardless of tier.
  },
  {
    id: 'tournament',
    icon: 'trophy',
    themeHex: '#ff6b6b',
    titleKey: 'gameModes.tournament',
    subtitleKey: 'home.compactSubtitles.tournament',
    route: '/tournaments',
    lockedUntilPoints: 15_000,
    lockedUnlockTierKey: 'tiers.sage',
  },
]

/** Modes that put the user in a competitive room with strangers — the
 *  CompactCard renders a hover-tooltip info icon to flag the matchmaking
 *  caveat. Tier-based seeding is tracked under MATCHMAKING TODO v1.1. */
const MATCHMAKING_HINT_MODES = new Set(['tournament', 'multiplayer'])

/* ── Props ── */
interface GameModeGridProps {
  userStats?: {
    currentStreak?: number
    totalPoints?: number
  }
}

/* ── Component ── */
export default function GameModeGrid({ userStats }: GameModeGridProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Daily completion state — drives the recommendation engine. (Daily
  // itself is no longer a card here, but the engine still considers it
  // when deciding whether to nudge Practice vs Ranked.)
  const [dailyCompleted, setDailyCompleted] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [countdown, setCountdown] = useState(msUntilMidnight())

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

  useEffect(() => {
    const interval = setInterval(() => setCountdown(msUntilMidnight()), 1_000)
    return () => clearInterval(interval)
  }, [])

  // Recommendation engine — targets Practice + Ranked + Daily. The
  // engine's energy-aware branches are unreachable from this grid since
  // Ranked's energy display moved out, so we feed sentinels.
  const unlockedRecommendModes = useMemo<Set<RecommendedMode>>(
    () => new Set(['practice', 'ranked', 'daily']),
    [],
  )

  const totalPoints = userStats?.totalPoints ?? 0

  const recommendation = useMemo(() => {
    if (dailyLoading) return null
    if (!userStats || userStats.currentStreak == null || userStats.totalPoints == null) {
      return null
    }
    return getRecommendedMode({
      totalPoints: userStats.totalPoints,
      currentStreak: userStats.currentStreak,
      energy: 0,
      energyMax: 100,
      dailyDone: dailyCompleted,
      hoursToMidnight: countdown / 3_600_000,
      unlockedModes: unlockedRecommendModes,
    })
  }, [userStats, dailyCompleted, countdown, dailyLoading, unlockedRecommendModes])

  const recommendReason = (mode: RecommendedMode): string | undefined =>
    recommendation?.mode === mode
      ? (t(`home.recommend.${recommendation.reasonKey}`, recommendation.values) as string)
      : undefined

  // Live-data hints (H4 + HM-P1-1). All 4 BE endpoints wired up as
  // of 2026-05-01. Cards without an endpoint (mystery + speed) render
  // static XP-multiplier text. Each query lives in its own TanStack
  // entry so a slow one doesn't block the rest of the grid.
  const { data: roomsCount } = useQuery<number>({
    queryKey: ['home-rooms-public-count'],
    queryFn: async () => {
      const res = await api.get('/api/rooms/public')
      return Array.isArray(res.data) ? res.data.length : 0
    },
    staleTime: 60_000,
  })

  const { data: weeklyTheme } = useQuery<string | null>({
    queryKey: ['home-weekly-theme'],
    queryFn: async () => {
      const res = await api.get('/api/quiz/weekly/theme')
      return (res.data?.themeName as string) || (res.data?.theme as string) || null
    },
    staleTime: 5 * 60_000,
  })

  interface MyGroupResponse {
    hasGroup: boolean
    groupName?: string
  }
  const { data: myGroup } = useQuery<MyGroupResponse>({
    queryKey: ['home-my-group'],
    queryFn: () => api.get('/api/groups/me').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  interface UpcomingTournamentsResponse {
    count: number
    next: { id: string; name: string } | null
  }
  const { data: upcomingTournaments } = useQuery<UpcomingTournamentsResponse>({
    queryKey: ['home-tournaments-upcoming'],
    queryFn: () => api.get('/api/tournaments/upcoming').then(r => r.data),
    staleTime: 60_000,
  })

  const groupHint = myGroup
    ? myGroup.hasGroup && myGroup.groupName
      ? (t('home.modeHint.groupIn', { name: myGroup.groupName }) as string)
      : (t('home.modeHint.groupNone') as string)
    : undefined

  const tournamentHint =
    upcomingTournaments && upcomingTournaments.count > 0
      ? (t('home.modeHint.tournamentOpen', { count: upcomingTournaments.count }) as string)
      : undefined

  const liveHints: Record<string, string | undefined> = {
    group: groupHint,
    multiplayer:
      typeof roomsCount === 'number' && roomsCount > 0
        ? (t('home.modeHint.roomsOpen', { count: roomsCount }) as string)
        : undefined,
    tournament: tournamentHint,
    weekly: weeklyTheme || undefined,
    // HR-4b fix: Mystery + Speed are "for fun" — no XP / no leaderboard
    // per DECISIONS.md 2026-05-02. Remove the misleading +50% / +100% XP
    // hint labels; subtitle ("Random hoàn toàn", "10 câu × 10s") is the
    // only descriptive text these cards need.
    mystery: undefined,
    speed: undefined,
  }

  return (
    <div data-testid="game-mode-grid" className="space-y-8">
      {/* ── Featured: Practice + Ranked (continue-journey row) ──
          Per H3 — section header + 2-col compact cards. Practice uses
          the blue theme (outline button) so the gold filled Ranked CTA
          dominates as the primary action. Reverts the PL-3 gold-outline
          intermediate variant. */}
      <section
        data-testid="game-mode-tier-featured"
        className="space-y-2.5"
      >
        <header className="flex items-baseline justify-between">
          <h2 className="text-on-surface/85 text-[13px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              sports_esports
            </span>
            {t('home.primary.title')}
          </h2>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FeaturedCard
            id="practice"
            theme="blue"
            icon="menu_book"
            title={t('practiceFeatured.title')}
            description={t('practiceFeatured.description')}
            isRecommended={recommendation?.mode === 'practice'}
            recommendReason={recommendReason('practice')}
            badge={
              <span data-testid="featured-card-practice-status" className="text-on-surface-variant/40">
                {t('practiceFeatured.badge')}
              </span>
            }
            cta={{
              label: t('practiceFeatured.cta'),
              onClick: () => navigate('/practice'),
              iconLeft: 'play_arrow',
            }}
          />
          <RankedFeaturedCard
            isRecommended={recommendation?.mode === 'ranked'}
            recommendReason={recommendReason('ranked')}
          />
        </div>
      </section>

      {/* ── Variety modes (3-col, never tier-locked) ── */}
      <section data-testid="game-mode-tier-variety" className="space-y-2.5">
        <header className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="text-on-surface/85 text-[13px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">casino</span>
            {t('home.variety.title')}
          </h2>
          <span className="text-on-surface-variant/40 text-[10px]">
            {t('home.variety.subtitle')}
          </span>
        </header>
        {/* Mobile: horizontal scroll (snap), Desktop: 3-col grid */}
        <div className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VARIETY_CARDS.map(card => (
            <div
              key={card.id}
              className="snap-start shrink-0 w-[180px] sm:w-full"
            ><CompactCard
              id={card.id}
              icon={card.icon}
              iconFill={card.iconFill}
              themeHex={card.themeHex}
              title={t(card.titleKey)}
              subtitle={t(card.subtitleKey)}
              liveHint={liveHints[card.id]}
              onClick={() => navigate(card.route)}
            /></div>
          ))}
        </div>
      </section>

      {/* ── Group modes (Tournament tier-locked) ── */}
      <section data-testid="game-mode-tier-group" className="space-y-2.5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-on-surface/85 text-[13px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">groups</span>
            {t('home.group.title')}
          </h2>
        </header>
        {/* Mobile: 1-col stack (mockup .mode-stack); Desktop: 3-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {GROUP_CARDS.map(card => {
            const isLocked =
              typeof card.lockedUntilPoints === 'number' &&
              totalPoints < card.lockedUntilPoints
            return (
              <CompactCard
                key={card.id}
                id={card.id}
                icon={card.icon}
                iconFill={card.iconFill}
                themeHex={card.themeHex}
                title={t(card.titleKey)}
                subtitle={t(card.subtitleKey)}
                liveHint={liveHints[card.id]}
                onClick={() => navigate(card.route)}
                matchmakingHint={
                  MATCHMAKING_HINT_MODES.has(card.id)
                    ? { title: t('home.matchmakingHint') }
                    : undefined
                }
                locked={
                  isLocked && card.lockedUnlockTierKey
                    ? {
                        reason: t('home.modeLocked.reason', {
                          tier: t(card.lockedUnlockTierKey),
                        }) as string,
                      }
                    : undefined
                }
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
