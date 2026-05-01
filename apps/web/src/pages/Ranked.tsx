import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useAuth } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { useRankedPage } from '../hooks/useRankedPage'
import RankedSkeleton from '../components/ranked/RankedSkeleton'
import RankedHeader from '../components/ranked/RankedHeader'
import TierProgressCard from '../components/ranked/TierProgressCard'
import EnergyCard from '../components/ranked/EnergyCard'
import RankedStreakCard from '../components/ranked/RankedStreakCard'
import DailyStatsCards from '../components/ranked/DailyStatsCards'
import SeasonCard from '../components/ranked/SeasonCard'
import CurrentBookCard from '../components/ranked/CurrentBookCard'
import RecentMatchesSection from '../components/ranked/RecentMatchesSection'
import RankedActionFooter from '../components/ranked/RankedActionFooter'

export default function Ranked() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    rankedStatus,
    userRank,
    tierData,
    timeLeft,
    isLoading,
    isInitialized,
    refetch,
  } = useRankedPage()

  const startRankedQuiz = async () => {
    if (!rankedStatus) return
    try {
      const res = await api.post('/api/ranked/sessions', { language: getQuizLanguage() })
      const sessionId = res.data.sessionId
      const serverAskedIds: string[] = rankedStatus.askedQuestionIdsToday ?? []
      const localAskedIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('askedQuestionIds') || '[]') } catch { return [] } })()
      const exclude = new Set<string>([...serverAskedIds, ...localAskedIds])

      const questions: any[] = []
      const addUnique = (items: any[]) => {
        for (const q of items ?? []) {
          if (!q?.id || exclude.has(q.id) || questions.find((x: any) => x.id === q.id)) continue
          questions.push(q)
          exclude.add(q.id)
          if (questions.length >= 10) break
        }
      }

      if (questions.length < 10) {
        const params: any = { limit: 10 - questions.length, excludeIds: Array.from(exclude) }
        if (rankedStatus.currentBook) params.book = rankedStatus.currentBook
        if (rankedStatus.currentDifficulty && rankedStatus.currentDifficulty !== 'all') params.difficulty = rankedStatus.currentDifficulty
        addUnique((await api.get('/api/questions', { params })).data ?? [])
      }
      if (questions.length < 10 && rankedStatus.currentBook) {
        addUnique((await api.get('/api/questions', { params: { limit: 10 - questions.length, book: rankedStatus.currentBook, excludeIds: Array.from(exclude) } })).data ?? [])
      }
      if (questions.length < 10) {
        addUnique((await api.get('/api/questions', { params: { limit: 10 - questions.length, excludeIds: Array.from(exclude) } })).data ?? [])
      }

      navigate('/quiz', { state: { sessionId, mode: 'ranked', questions, showExplanation: false, isRanked: true } })
    } catch {
      alert(t('ranked.cannotStart'))
    }
  }

  if (isLoading || !isInitialized) return <RankedSkeleton />

  if (!rankedStatus) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-surface-container p-10 rounded-2xl text-center max-w-md">
          <span className="material-symbols-outlined text-error text-5xl mb-4 block">error</span>
          <p className="text-on-surface font-bold text-lg mb-2">{t('ranked.loadError')}</p>
          <p className="text-on-surface-variant text-sm mb-6">{t('ranked.tryAgainLater')}</p>
          <button onClick={refetch} className="gold-gradient text-on-secondary font-black px-8 py-3 rounded-xl text-sm uppercase tracking-widest">
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  // Derived values
  const canPlay = rankedStatus.livesRemaining > 0 && rankedStatus.questionsCounted < rankedStatus.cap
  // Prefer tier-progress API totalPoints (all-time accurate); fall
  // back to leaderboard rank or today's points.
  const totalPoints = tierData?.totalPoints ?? userRank?.points ?? rankedStatus.pointsToday ?? 0
  const tierInfo = getTierInfo(totalPoints)
  const currentTier = tierInfo.current
  const nextTier = tierInfo.next
  const pointsToNext = tierData
    ? Math.max(0, tierData.nextTierPoints - tierData.totalPoints)
    : tierInfo.pointsToNext
  const tierProgressPct = nextTier
    ? (tierData?.tierProgressPercent ?? tierInfo.progressPct)
    : 100
  const bookPct = rankedStatus.bookProgress?.progressPercentage ?? 0
  const difficultyLabel = rankedStatus.currentDifficulty === 'all' ? t('practice.mixed')
    : rankedStatus.currentDifficulty === 'easy' ? t('practice.easy')
    : rankedStatus.currentDifficulty === 'medium' ? t('practice.medium')
    : rankedStatus.currentDifficulty === 'hard' ? t('practice.hard') : rankedStatus.currentDifficulty

  return (
    <main data-testid="ranked-page" className="max-w-5xl mx-auto space-y-6 pb-[120px] md:pb-[112px]">
      <RankedHeader />

      <TierProgressCard
        currentTier={currentTier}
        nextTier={nextTier}
        totalPoints={totalPoints}
        pointsToNext={pointsToNext}
        tierProgressPct={tierProgressPct}
        starIndex={tierData?.starIndex}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-3">
        <EnergyCard
          energy={rankedStatus.livesRemaining ?? 0}
          energyMax={rankedStatus.dailyLives ?? 0}
          recoverTimeLeft={timeLeft || '--:--:--'}
        />
        <RankedStreakCard streak={user?.currentStreak ?? 0} />
      </div>

      <DailyStatsCards
        questionsAnswered={rankedStatus.questionsCounted ?? 0}
        questionsCap={rankedStatus.cap || 0}
        pointsToday={rankedStatus.pointsToday ?? 0}
        dailyDelta={rankedStatus.dailyDelta}
        pointsToTop100={rankedStatus.pointsToTop100}
        pointsToTop50={rankedStatus.pointsToTop50}
        pointsToTop10={rankedStatus.pointsToTop10}
      />

      <SeasonCard />

      <CurrentBookCard
        bookName={rankedStatus.currentBook}
        bookIndex={rankedStatus.currentBookIndex ?? 0}
        masteryPct={bookPct}
        difficultyLabel={difficultyLabel}
      />

      <RecentMatchesSection />

      <RankedActionFooter
        canPlay={canPlay}
        capReached={rankedStatus.questionsCounted >= rankedStatus.cap}
        energy={rankedStatus.livesRemaining ?? 0}
        currentBook={rankedStatus.currentBook}
        resetTimeLeft={timeLeft || '--:--:--'}
        onStart={startRankedQuiz}
      />
    </main>
  )
}
