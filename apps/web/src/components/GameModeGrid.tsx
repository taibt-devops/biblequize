import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  iconColor: string
  titleKey: string
  subtitleKey: string
  route: string
}

/**
 * 6-card secondary grid (3×2 desktop, 2×3 mobile). Daily migrated to
 * the standalone FeaturedDailyChallenge banner above the grid; Practice
 * + Ranked promoted to the FeaturedCard row, so this list stays focused
 * on "more ways to play".
 */
const COMPACT_CARDS: CompactConfig[] = [
  {
    id: 'group',
    icon: 'church',
    iconColor: 'text-primary',
    titleKey: 'gameModes.groups',
    subtitleKey: 'home.compactSubtitles.group',
    route: '/groups',
  },
  {
    id: 'multiplayer',
    icon: 'gamepad',
    iconColor: 'text-secondary',
    titleKey: 'gameModes.rooms',
    subtitleKey: 'home.compactSubtitles.multiplayer',
    route: '/multiplayer',
  },
  {
    id: 'tournament',
    icon: 'trophy',
    iconColor: 'text-error',
    titleKey: 'gameModes.tournament',
    subtitleKey: 'home.compactSubtitles.tournament',
    route: '/tournaments',
  },
  {
    id: 'weekly',
    icon: 'event',
    iconFill: true,
    iconColor: 'text-purple-400',
    titleKey: 'gameModes.weekly',
    subtitleKey: 'home.compactSubtitles.weekly',
    route: '/weekly-quiz',
  },
  {
    id: 'mystery',
    icon: 'casino',
    iconFill: true,
    iconColor: 'text-pink-400',
    titleKey: 'gameModes.mystery',
    subtitleKey: 'home.compactSubtitles.mystery',
    route: '/mystery-mode',
  },
  {
    id: 'speed',
    icon: 'speed',
    iconFill: true,
    iconColor: 'text-orange-400',
    titleKey: 'gameModes.speed',
    subtitleKey: 'home.compactSubtitles.speed',
    route: '/speed-round',
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

  return (
    <div data-testid="game-mode-grid" className="space-y-8">
      {/* ── Featured: Practice + Ranked (core experience) ── */}
      <section
        data-testid="game-mode-tier-featured"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <FeaturedCard
          id="practice"
          icon="menu_book"
          iconColor="text-secondary"
          title={t('practiceFeatured.title')}
          description={t('practiceFeatured.description')}
          isRecommended={recommendation?.mode === 'practice'}
          recommendReason={recommendReason('practice')}
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
      </section>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          {t('home.exploreMore')}
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      {/* ── Secondary: 6-card grid (3×2 desktop, 2×3 mobile) ── */}
      <section
        data-testid="game-mode-tier-secondary"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {COMPACT_CARDS.map(card => (
          <CompactCard
            key={card.id}
            id={card.id}
            icon={card.icon}
            iconFill={card.iconFill}
            iconColor={card.iconColor}
            title={t(card.titleKey)}
            subtitle={t(card.subtitleKey)}
            onClick={() => navigate(card.route)}
            matchmakingHint={
              MATCHMAKING_HINT_MODES.has(card.id)
                ? { title: t('home.matchmakingHint') }
                : undefined
            }
          />
        ))}
      </section>
    </div>
  )
}
