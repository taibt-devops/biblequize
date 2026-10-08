import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../store/authStore'
import { getTierByPoints, getNextTier } from '../data/tiers'
import type { Achievement, SessionHistory, UserProfile } from '../components/profile/types'
import { SkeletonBlock } from '../components/profile/SkeletonBlock'
import { HeroCompact } from '../components/profile/HeroCompact'
import { StatsStrip } from '../components/profile/StatsStrip'
import { TierProgressCard } from '../components/profile/TierProgressCard'
import { HeatmapCard, buildHeatmapLevels } from '../components/profile/HeatmapCard'
import { BibleJourneyCard } from '../components/profile/BibleJourneyCard'
import { BadgeCollection } from '../components/profile/BadgeCollection'
import { AnalyticsCard } from '../components/profile/AnalyticsCard'
import { PrestigeSection } from '../components/profile/PrestigeSection'
import { SoundHapticsSettings } from '../components/profile/SoundHapticsSettings'
import { PrivacySettings } from '../components/profile/PrivacySettings'
import { DeleteAccountSection } from '../components/profile/DeleteAccountSection'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'

function ProfileSkeleton() {
  return (
    <>
      <SkeletonBlock className="h-32 rounded-3xl mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-24" />)}
      </div>
      <SkeletonBlock className="h-56 mb-6" />
      <SkeletonBlock className="h-48 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} className="h-36" />)}
      </div>
    </>
  )
}

const Profile: React.FC = () => {
  const { t } = useTranslation()
  const { user: authUser, isAuthenticated } = useAuth()

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/me')).data,
    enabled: isAuthenticated,
  })

  const { data: achievements = [], isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ['my-achievements'],
    queryFn: async () => {
      try { return (await api.get('/api/achievements/me')).data } catch { return [] }
    },
    enabled: isAuthenticated,
  })

  const { data: historyData } = useQuery<{ items?: SessionHistory[] }>({
    queryKey: ['my-history'],
    queryFn: async () => {
      try { return (await api.get('/api/me/history')).data } catch { return { items: [] } }
    },
    enabled: isAuthenticated,
  })

  // totalPoints isn't exposed on /api/me (UserResponse DTO doesn't include it).
  // It's computed server-side via UserTierService.getTotalPoints and returned
  // by /api/me/tier-progress, so fetch that endpoint to drive Stats + Tier.
  const { data: tierProgressData } = useQuery<{ totalPoints?: number }>({
    queryKey: ['me-tier-progress'],
    queryFn: async () => {
      try { return (await api.get('/api/me/tier-progress')).data } catch { return { totalPoints: 0 } }
    },
    enabled: isAuthenticated,
  })

  // Lifetime accuracy + session count via /api/me/stats. Previously FE summed
  // from the paginated /api/me/history payload, which only ever covered the
  // first 20 sessions — totals were wrong for any active user.
  const { data: statsData } = useQuery<{
    totalAnswered?: number; totalCorrect?: number; accuracyPercent?: number; totalSessions?: number
  }>({
    queryKey: ['me-stats'],
    queryFn: async () => {
      try { return (await api.get('/api/me/stats')).data } catch { return {} }
    },
    enabled: isAuthenticated,
  })

  if (!isAuthenticated || !authUser) {
    return (
      <div className="relative flex items-center justify-center py-20 px-4">
        <PlaceBackdrop place="camp" veil="strong" />
        <div className="max-w-sm w-full p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-28 mb-2" />
          <h2 className="m-0 mb-4 font-display text-[22px] font-extrabold text-bq-ink">{t('profile.loginRequired')}</h2>
          <Link to="/login" className="lk-btn text-bq-ink text-[16px] no-underline">
            {t('auth.login')}
          </Link>
        </div>
      </div>
    )
  }

  if (profileLoading) return <ProfileSkeleton />

  if (profileError || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-error">{t('profile.loadError')}</h2>
          <p className="text-bq-ink2 mb-4">{t('profile.tryAgainLater')}</p>
        </div>
      </div>
    )
  }

  const points = tierProgressData?.totalPoints ?? 0
  const currentTier = getTierByPoints(points)
  const nextTier = getNextTier(points)
  const tierProgress = {
    currentTierName: t(currentTier.nameKey),
    nextTierName: nextTier ? t(nextTier.nameKey) : t('profile.tierMaxLabel'),
    currentExp: points,
    nextTierExp: nextTier?.minPoints ?? currentTier.maxPoints,
    progressPercent: nextTier
      ? Math.min(100, Math.round(((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100))
      : 100,
    expRemaining: nextTier ? nextTier.minPoints - points : 0,
  }

  // Stats from /api/me/stats (lifetime); heatmap still uses paginated
  // /api/me/history because heatmap visualisation only needs recent
  // session dates and the date histogram doesn't need full history.
  const history = historyData?.items ?? []
  const totalSessions = statsData?.totalSessions ?? 0
  const totalQuestions = statsData?.totalAnswered ?? 0
  const totalCorrect = statsData?.totalCorrect ?? 0
  const correctRate = statsData?.accuracyPercent ?? 0
  const heatmapLevels = buildHeatmapLevels(history)
  const activeDays = heatmapLevels.filter(l => l > 0).length

  return (
    <div data-testid="profile-page" className="relative max-w-5xl mx-auto space-y-5">
      <PlaceBackdrop place="camp" veil="strong" />
      <div className="space-y-3">
        <Plaque className="text-[28px] md:text-[36px]">
          <img src="/images/lk/hero.webp" alt="" aria-hidden className="h-[1.2em] -my-1" />
          {t('profile.title')}
        </Plaque>
        <p className="m-0 w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[14px] md:text-[15px] text-bq-ink2">{t('profile.subtitle')}</p>
      </div>

      <HeroCompact
        profile={profile}
        tierEmoji={currentTier.iconEmoji}
        tierName={tierProgress.currentTierName}
        tierLevel={currentTier.id}
      />

      <StatsStrip
        points={points}
        currentStreak={profile.currentStreak ?? 0}
        longestStreak={profile.longestStreak ?? 0}
        totalSessions={totalSessions}
        totalQuestions={totalQuestions}
        totalCorrect={totalCorrect}
        correctRate={correctRate}
      />

      <TierProgressCard
        currentTier={currentTier}
        nextTier={nextTier}
        tierProgress={tierProgress}
        currentStreak={profile.currentStreak ?? 0}
      />

      <HeatmapCard cells={heatmapLevels} activeDays={activeDays} />

      <BibleJourneyCard />

      <BadgeCollection achievements={achievements} loading={achievementsLoading} />

      <AnalyticsCard />

      <PrestigeSection />

      <SoundHapticsSettings />

      <PrivacySettings initialVisible={profile?.leaderboardVisible ?? true} />

      <DeleteAccountSection />
    </div>
  )
}

export default Profile
