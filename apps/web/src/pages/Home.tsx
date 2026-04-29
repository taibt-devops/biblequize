import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ActivityFeed from '../components/ActivityFeed'
import ComebackModal from '../components/ComebackModal'
import DailyBonusModal from '../components/DailyBonusModal'
import DailyMissionsCard from '../components/DailyMissionsCard'
import EmptyLeaderboardCTA from '../components/EmptyLeaderboardCTA'
import FeaturedDailyChallenge from '../components/FeaturedDailyChallenge'
import DailyVerseBanner from '../components/DailyVerseBanner'
import GameModeGrid from '../components/GameModeGrid'
import HeroStatSheet from '../components/HeroStatSheet'
import TierPerksTeaser from '../components/TierPerksTeaser'
import TutorialOverlay from '../components/TutorialOverlay'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'
import { getTierInfo } from '../data/tiers'

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
      {/* ── Hero (V3 stat sheet) ── */}
      <HeroStatSheet />

      {/* ── Daily Verse banner (V3 ornament) ── */}
      <DailyVerseBanner />

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

      {/* ── Journey Widget ── */}
      <JourneyWidget />

      {/* ── Aspirational next-tier perks (returns null at tier 6) ── */}
      <TierPerksTeaser userTier={userTierLevel} totalPoints={totalPoints} />

      {/* ── Leaderboard + Feed ── */}
      <section data-testid="home-leaderboard" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-surface-container rounded-2xl p-6 border border-outline-variant/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-black tracking-tight text-on-surface">{t('home.leaderboard')}</h3>
            {/* Period tabs */}
            <div className="flex p-1 bg-surface-container-high rounded-lg">
              <button
                data-testid="leaderboard-tab-daily"
                onClick={() => setLbPeriod('daily')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${lbPeriod === 'daily' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {t('home.daily')}
              </button>
              <button
                data-testid="leaderboard-tab-weekly"
                onClick={() => setLbPeriod('weekly')}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${lbPeriod === 'weekly' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                {t('home.weekly')}
              </button>
            </div>
          </div>

          <div className={`space-y-3 transition-opacity duration-200 ${lbFetching ? 'opacity-50' : 'opacity-100'}`}>
            {leaderboard.length === 0 ? (
              <EmptyLeaderboardCTA />
            ) : leaderboard.map((p: any, i: number) => (
              <div key={p.userId || i} data-testid="leaderboard-row" className={`flex items-center justify-between p-4 rounded-xl ${i === 0 ? 'bg-secondary/5 border border-secondary/10' : 'hover:bg-surface-container-high transition-colors'}`}>
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-black w-6 text-center ${i === 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>{i + 1}</span>
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 overflow-hidden">
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> :
                      <span className="text-sm font-bold text-on-surface-variant">{(p.name || p.userName || '?').charAt(0).toUpperCase()}</span>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{p.name || p.userName}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{p.groupName || ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${i === 0 ? 'text-secondary' : 'text-on-surface'}`}>{(p.points || 0).toLocaleString()} XP</p>
                  <p className="text-[10px] font-bold text-on-surface-variant">{(p.questions || 0)} {t('home.questions')}</p>
                </div>
              </div>
            ))}
            {showMyRankSticky && (
              <div data-testid="home-my-rank-sticky" className="flex items-center justify-between p-4 rounded-xl bg-surface-container-highest border-l-4 border-secondary">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black text-on-surface w-6 text-center">#{myRank}</span>
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-secondary overflow-hidden">
                    <span className="material-symbols-outlined text-secondary text-sm">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{t('home.you', { name: userName })}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{t(tier.current.nameKey)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-on-surface text-sm">{totalPoints.toLocaleString()} XP</p>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">{t(tier.current.nameKey)}</p>
                </div>
              </div>
            )}
          </div>

          <Link to="/leaderboard" className="block mt-4 text-center text-xs font-bold text-secondary hover:underline uppercase tracking-widest">
            {t('home.viewAll')}
          </Link>
        </div>

        {/* Activity */}
        <div className="lg:col-span-4 space-y-6">
          <ActivityFeed userCreatedAt={meData?.createdAt} />
        </div>
      </section>
    </div>
  )
}

function JourneyWidget() {
  const { t, i18n } = useTranslation()
  const isVi = i18n.language === 'vi'

  const { data } = useQuery<{ summary: { completedBooks: number; totalBooks: number; currentBook: string | null; overallMasteryPercent: number } }>({
    queryKey: ['journey-summary', i18n.language],
    queryFn: async () => (await api.get(`/api/me/journey?language=${i18n.language}`)).data,
  })

  if (!data) return null

  const { summary } = data
  const pct = summary.totalBooks > 0 ? Math.round((summary.completedBooks / summary.totalBooks) * 100) : 0

  return (
    <Link to="/journey" className="block">
      <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10 hover:border-secondary/20 transition-all group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
            <div>
              <p className="text-sm font-bold text-on-surface">
                {t('journey.homeWidget', { count: summary.completedBooks, total: summary.totalBooks })}
              </p>
              {summary.currentBook && (
                <p className="text-xs text-on-surface-variant">
                  {t('journey.currentBook', { book: summary.currentBook, percent: summary.overallMasteryPercent })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-secondary transition-colors">chevron_right</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
