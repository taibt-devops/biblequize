import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import ComebackModal from '../components/ComebackModal'
import DailyBonusModal from '../components/DailyBonusModal'
import HomeScene from '../components/home/scene/HomeScene'
import { daysLeft } from '../components/home/scene/sceneData'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useMemoryDueCount } from '../hooks/useMemoryVerses'
import { getTierInfo } from '../data/tiers'
import { getTimeOfDayGreeting } from '../utils/greeting'
import { localizeSeasonName } from '../utils/seasonName'

/* ── Skeleton: the scene's frame while the player loads ── */
function HomeSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="h-[547px] md:h-[min(calc(100dvh_-_70px),calc(100vw_/_1.5))] bg-bq-inset" />
    </div>
  )
}

/** LBF-11 "ne con so": below this many weekly players the board is too sparse to show a rank. */
const SEED_THRESHOLD = 10

/**
 * Home (LKF-3): data for the Lu Khach scene. The scene itself (signboards, lanterns, dove, HUD)
 * lives in components/home/scene; this page only gathers the player's numbers.
 */
export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const dcLang = (i18n.language === 'en' ? 'en' : 'vi') as 'vi' | 'en'

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'], queryFn: () => api.get('/api/me').then(r => r.data), staleTime: 5 * 60_000,
  })
  const { data: tierData } = useQuery({
    queryKey: ['me-tier-progress'], queryFn: () => api.get('/api/me/tier-progress').then(r => r.data), staleTime: 60_000,
  })
  const { data: activeSeason } = useQuery<{ active?: boolean; name?: string; endDate?: string }>({
    queryKey: ['active-season'], queryFn: () => api.get('/api/seasons/active').then(r => r.data), staleTime: 30 * 60_000,
  })
  const { data: weeklyRank } = useQuery<{ rank?: number; total?: number; userId?: string; points?: number } | null>({
    queryKey: ['leaderboard', 'my-rank', 'weekly'],
    queryFn: () => api.get('/api/leaderboard/weekly/my-rank').then(r => r.data).catch(() => null),
    staleTime: 60_000,
  })
  const { data: weeklyTop } = useQuery<{ userId?: string; points?: number }[]>({
    // LBF-11: fetch 10 so we can tell whether >= SEED_THRESHOLD players have weekly points.
    queryKey: ['leaderboard', 'weekly', 'top10'],
    queryFn: () => api.get('/api/leaderboard/weekly?size=10').then(r => r.data).catch(() => []),
    staleTime: 60_000,
  })
  const { data: dcData } = useQuery<{ alreadyCompleted?: boolean; totalQuestions?: number }>({
    queryKey: ['daily-challenge', dcLang],
    queryFn: () => api.get(`/api/daily-challenge?language=${dcLang}`).then(r => r.data), staleTime: 60_000,
  })
  const { data: dcResult } = useQuery<{ correctCount?: number; totalQuestions?: number }>({
    queryKey: ['daily-challenge-result'],
    queryFn: () => api.get('/api/daily-challenge/result').then(r => r.data),
    enabled: !!dcData?.alreadyCompleted, staleTime: 60_000,
  })
  const { data: missionsData } = useQuery<{ missions?: { description?: string; progress?: number; target?: number; completed?: boolean }[] }>({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/api/me/daily-missions').then(r => r.data).catch(() => null), staleTime: 60_000,
  })
  const { data: journey } = useQuery<{ summary?: { currentBook?: string | null }; books?: { book?: string; bookVi?: string; masteryPercent?: number }[] } | null>({
    queryKey: ['me-journey-home', dcLang],
    queryFn: () => api.get(`/api/me/journey?language=${i18n.language}`).then(r => r.data).catch(() => null), staleTime: 60_000,
  })
  const { data: verseDue = 0 } = useMemoryDueCount(!!user)

  if (meLoading) return <HomeSkeleton />

  const totalPoints = tierData?.totalPoints ?? meData?.totalPoints ?? 0
  const currentStreak = meData?.currentStreak ?? 0
  const tier = getTierInfo(totalPoints)
  const dailyDone = !!dcData?.alreadyCompleted
  const questionCount = dcData?.totalQuestions ?? 5

  const lowData = !Array.isArray(weeklyTop) || weeklyTop.length < SEED_THRESHOLD
  const rank = !lowData && weeklyRank?.rank != null ? { rank: weeklyRank.rank, points: weeklyRank.points ?? 0 } : null

  const curBook = (journey?.books ?? []).find(b => b.book === journey?.summary?.currentBook)
  const journeyInfo = curBook
    ? { book: (dcLang === 'vi' ? curBook.bookVi || curBook.book : curBook.book || curBook.bookVi) ?? '', pct: Math.max(0, Math.min(100, Math.round(curBook.masteryPercent ?? 0))) }
    : null

  const seasonDays = activeSeason?.active ? daysLeft(activeSeason.endDate) : null
  const season = activeSeason?.active && activeSeason.name && seasonDays
    ? { name: localizeSeasonName(activeSeason.name, t) ?? activeSeason.name, daysLeft: seasonDays }
    : null

  return (
    <div data-testid="home-page" className="w-full">
      <ComebackModal />
      <DailyBonusModal />
      <HomeScene
        greeting={getTimeOfDayGreeting(t)}
        userName={user?.name || t('home.defaultName')}
        tierId={tier.current.id}
        tierLabel={t(tier.current.nameKey)}
        nextTierLabel={tier.next ? t(tier.next.nameKey) : null}
        progressPct={tier.progressPct}
        points={totalPoints}
        nextMinPoints={tier.next?.minPoints}
        pointsToNext={tier.pointsToNext}
        isNewUser={totalPoints === 0 && !dailyDone && currentStreak === 0}
        daily={{ done: dailyDone, questionCount, correct: dcResult?.correctCount ?? 0, total: dcResult?.totalQuestions ?? questionCount }}
        quests={missionsData?.missions ?? []}
        journey={journeyInfo}
        rank={rank}
        season={season}
        verseDue={verseDue}
      />
    </div>
  )
}
