import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ActivityFeed from '../components/ActivityFeed'
import BibleJourneyCard from '../components/BibleJourneyCard'
import ComebackModal from '../components/ComebackModal'
import DailyBonusModal from '../components/DailyBonusModal'
import DailyMissionsCard from '../components/DailyMissionsCard'
import EmptyLeaderboardCTA from '../components/EmptyLeaderboardCTA'
import FeaturedDailyChallenge from '../components/FeaturedDailyChallenge'
import DailyVerseBanner from '../components/DailyVerseBanner'
import GameModeGrid from '../components/GameModeGrid'
import GreetingCard from '../components/GreetingCard'
import TierPerksTeaser from '../components/TierPerksTeaser'
import TutorialOverlay from '../components/TutorialOverlay'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'
import { getTierInfo, getTierByPoints } from '../data/tiers'

/* ── Skeleton ── */
function HomeSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[200px] rounded-2xl bg-surface-container" />
        <div className="h-[200px] rounded-2xl bg-surface-container-low" />
      </div>
      <div className="h-8 w-48 rounded-lg bg-surface-container" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 rounded-2xl bg-surface-container" />)}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 h-80 rounded-2xl bg-surface-container" />
        <div className="col-span-4 h-80 rounded-2xl bg-surface-container-low" />
      </div>
    </div>
  )
}

/* ── Main ── */
export default function Home() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [lbPeriod, setLbPeriod] = useState<'daily' | 'weekly'>('daily')

  // TanStack Query: user profile
  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(r => r.data),
    staleTime: 5 * 60_000, // 5 min
  })

  // TanStack Query: tier progress (includes totalPoints)
  const { data: tierData } = useQuery({
    queryKey: ['me-tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data),
    staleTime: 60_000,
  })

  // TanStack Query: leaderboard
  const { data: lbData, isLoading: lbLoading, isFetching: lbFetching } = useQuery({
    queryKey: ['home-leaderboard', lbPeriod],
    queryFn: () => api.get(`/api/leaderboard/${lbPeriod}?size=5`).then(r => r.data),
    staleTime: 30_000,
    keepPreviousData: true,
  })

  // TanStack Query: my rank
  const { data: rankData } = useQuery({
    queryKey: ['home-my-rank', lbPeriod],
    queryFn: () => api.get(`/api/leaderboard/${lbPeriod}/my-rank`).then(r => r.data),
    staleTime: 30_000,
  })

  if (meLoading && lbLoading) return <HomeSkeleton />

  const totalPoints = tierData?.totalPoints ?? meData?.totalPoints ?? 0
  const leaderboard: any[] = Array.isArray(lbData) ? lbData : []
  const myRank = rankData?.rank ?? null
  const userName = user?.name || t('home.defaultName')

  // The leaderboard API returns the top-N users in rank order (rank = index+1).
  // If the current user's rank falls within that range, they are already
  // visible in the list above — rendering the sticky "Bạn" row a second
  // time is just duplication. Only show the sticky row when rank is
  // BEYOND the displayed window (around-me pattern).
  const isCurrentUserVisibleInList = myRank != null && myRank <= leaderboard.length
  const showMyRankSticky = myRank != null && !isCurrentUserVisibleInList
  const tier = getTierInfo(totalPoints)
  // Tier level 1..6 — passed into TierPerksTeaser to highlight next-tier perks.
  const userTierLevel = tier.current.id

  return (
    <div data-testid="home-page" className="space-y-8 max-w-7xl mx-auto w-full">
      <ComebackModal />
      <DailyBonusModal />
      <TutorialOverlay />
      {/* ── Greeting card (HR-1: replaces HeroStatSheet) ── */}
      <GreetingCard />

      {/* ── Featured Daily Challenge (hero CTA for tier-1) ── */}
      <FeaturedDailyChallenge />

      {/* ── Game Modes ──
          Open access for everyone. The Bible Basics catechism gate
          (Ranked unlock) is surfaced inside the Ranked featured card
          itself — see RankedFeaturedCard inside GameModeGrid. */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-sora text-base font-semibold text-on-surface">{t('home.gameModes')}</h2>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {t('home.exploreModes', { count: 8 })}
          </span>
        </div>
        <GameModeGrid
          userStats={{
            currentStreak: meData?.currentStreak,
            totalPoints,
          }}
        />
      </section>

      {/* ── Daily Missions ── */}
      <section>
        <div data-testid="home-daily-missions"><DailyMissionsCard /></div>
      </section>

      {/* ── Verse + Journey 2-col (HR-5 — verse promoted from footer) ── */}
      <section
        data-testid="home-verse-journey"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <DailyVerseBanner />
        <BibleJourneyCard />
      </section>

      {/* ── Aspirational next-tier perks (returns null at tier 6) ── */}
      <TierPerksTeaser userTier={userTierLevel} totalPoints={totalPoints} />

      {/* ── Leaderboard + Activity (H7) ── 1.4fr / 1fr per mockup */}
      <section
        data-testid="home-leaderboard"
        className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-2.5"
      >
        <div className="bg-[rgba(50,52,64,0.4)] rounded-2xl p-4 border border-secondary/15">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-on-surface text-[12px] md:text-[13px] font-medium">
              {t('home.leaderboard')}
            </h3>
            <div className="flex gap-1 bg-black/30 rounded-md p-0.5">
              <button
                data-testid="leaderboard-tab-daily"
                onClick={() => setLbPeriod('daily')}
                className={`px-2 py-1 text-[9px] md:text-[10px] font-medium rounded transition-all ${
                  lbPeriod === 'daily'
                    ? 'bg-secondary text-on-secondary'
                    : 'text-on-surface-variant/45'
                }`}
              >
                {t('home.daily')}
              </button>
              <button
                data-testid="leaderboard-tab-weekly"
                onClick={() => setLbPeriod('weekly')}
                className={`px-2 py-1 text-[9px] md:text-[10px] font-medium rounded transition-all ${
                  lbPeriod === 'weekly'
                    ? 'bg-secondary text-on-secondary'
                    : 'text-on-surface-variant/45'
                }`}
              >
                {t('home.weekly')}
              </button>
            </div>
          </div>

          <div
            className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
              lbFetching ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {leaderboard.length === 0 ? (
              <EmptyLeaderboardCTA />
            ) : (
              leaderboard.map((p: any, i: number) => (
                <LeaderboardRow
                  key={p.userId || i}
                  rank={i + 1}
                  name={p.name || p.userName || '?'}
                  points={p.points || 0}
                  isTop1={i === 0}
                />
              ))
            )}
            {showMyRankSticky && (
              <LeaderboardRow
                rank={myRank!}
                name={userName}
                points={totalPoints}
                isCurrentUser
              />
            )}
          </div>

          <div className="text-center pt-2.5 mt-1.5 border-t border-white/[0.06]">
            <Link
              to="/leaderboard"
              className="text-[10px] text-secondary hover:underline"
            >
              {t('home.viewAll')} →
            </Link>
          </div>
        </div>

        {/* Activity */}
        <ActivityFeed userCreatedAt={meData?.createdAt} />
      </section>
    </div>
  )
}

interface LeaderboardRowProps {
  rank: number
  name: string
  points: number
  /** Top-1 row gets the gold-tinted bg + gold rank/XP. */
  isTop1?: boolean
  /** Current user row pinned via gold left border + you-suffix. */
  isCurrentUser?: boolean
}

/**
 * One leaderboard row in the Home H7 list. Avatar background uses the
 * tier color from {@code data/tiers.ts} so the row at a glance signals
 * the player's standing — top of the list still differentiates by gold
 * accents on rank + XP.
 */
function LeaderboardRow({ rank, name, points, isTop1, isCurrentUser }: LeaderboardRowProps) {
  const { t } = useTranslation()
  const tier = getTierByPoints(points)
  const tierName = t(tier.nameKey)
  const initial = (name || '?').charAt(0).toUpperCase()

  const rowClass = isCurrentUser
    ? 'bg-[rgba(232,168,50,0.04)] border-l-2 border-secondary rounded-r-md'
    : isTop1
      ? 'bg-[rgba(232,168,50,0.06)] rounded-md'
      : ''

  const accent = isTop1 || isCurrentUser

  return (
    <div
      data-testid={isCurrentUser ? 'home-my-rank-sticky' : 'leaderboard-row'}
      className={`flex items-center gap-2 md:gap-2.5 px-1.5 md:px-2 py-1.5 ${rowClass}`}
    >
      <span
        className={`text-[10px] md:text-[11px] font-medium w-3.5 md:w-[18px] text-center shrink-0 ${
          accent ? 'text-secondary' : 'text-on-surface-variant/45'
        }`}
      >
        {isCurrentUser ? `#${rank}` : rank}
      </span>
      <div
        className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-medium shrink-0"
        style={{ background: tier.colorHex, color: '#11131e' }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[10px] md:text-[11px] truncate ${
            accent ? 'text-on-surface font-medium' : 'text-on-surface/85'
          }`}
        >
          {isCurrentUser ? t('home.you', { name }) : name}
        </div>
        <div
          className="text-[8px] md:text-[9px] truncate"
          style={{ color: tier.colorHex }}
        >
          {tierName}
        </div>
      </div>
      <span
        className={`text-[10px] md:text-[11px] font-medium shrink-0 ${
          accent ? 'text-secondary' : 'text-on-surface/85'
        }`}
      >
        {points.toLocaleString()}
      </span>
    </div>
  )
}
