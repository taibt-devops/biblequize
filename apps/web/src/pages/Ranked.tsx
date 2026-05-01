import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useAuth } from '../store/authStore'
import { useRankedDataSync } from '../hooks/useRankedDataSync'
import { getTierInfo } from '../data/tiers'
import RankedHeader from '../components/ranked/RankedHeader'
import TierProgressCard from '../components/ranked/TierProgressCard'
import EnergyCard from '../components/ranked/EnergyCard'
import RankedStreakCard from '../components/ranked/RankedStreakCard'
import DailyStatsCards from '../components/ranked/DailyStatsCards'
import SeasonCard from '../components/ranked/SeasonCard'
import CurrentBookCard from '../components/ranked/CurrentBookCard'
import RecentMatchesSection from '../components/ranked/RecentMatchesSection'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/* ── Types ── */
interface TierProgressData {
  tierLevel: number
  tierName: string
  totalPoints: number
  nextTierPoints: number
  tierProgressPercent: number
  starIndex: number
  starXp: number
  nextStarXp: number
  starProgressPercent: number
  milestone: string | null
  surgeActive?: boolean
  surgeUntil?: string | null
  surgeMultiplier?: number
}

interface RankedStatus {
  date: string
  livesRemaining: number
  questionsCounted: number
  pointsToday: number
  cap: number
  dailyLives: number
  currentBook: string
  currentBookIndex: number
  isPostCycle: boolean
  currentDifficulty: string
  nextBook?: string
  resetAt: string
  bookProgress?: {
    currentIndex: number
    totalBooks: number
    currentBook: string
    nextBook: string
    isCompleted: boolean
    progressPercentage: number
  }
  askedQuestionIdsToday?: string[]
  askedQuestionCountToday?: number
  // Path A backend extensions to /api/me/ranked-status. Each is null
  // when the relevant signal is unavailable (no answers today, no
  // yesterday baseline, leaderboard < N users, no active season).
  // The component branches off `null` rather than coalescing to 0
  // so missing-data and zero-value stay visually distinguishable.
  dailyAccuracy: number | null         // 0.0 – 1.0
  dailyCorrectCount: number | null
  dailyTotalAnswered: number | null
  dailyDelta: number | null            // can be negative
  pointsToTop50: number | null         // null when user is already in top 50
  pointsToTop10: number | null         // null when user is already in top 10
  pointsToTop100?: number | null       // R10 will populate; null until then
}

// Tier data centralised in `data/tiers.ts` (single source of truth).
// Use `getTierByPoints(points)` for current tier lookup.

/* ── Skeleton ── */
function RankedSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-12 w-64 rounded-xl bg-surface-container" />
      <div className="h-40 rounded-xl bg-surface-container" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 h-44 rounded-xl bg-surface-container" />
        <div className="col-span-5 h-44 rounded-xl bg-surface-container" />
      </div>
      <div className="h-48 rounded-xl bg-surface-container" />
      <div className="h-16 rounded-xl bg-surface-container" />
    </div>
  )
}

/* ── Main ── */
export default function Ranked() {
  const { t } = useTranslation()
  const [rankedStatus, setRankedStatus] = useState<RankedStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isInitialized } = useRankedDataSync()

  const [userRank, setUserRank] = useState<any>(null)
  const [tierData, setTierData] = useState<TierProgressData | null>(null)
  const [timeLeft, setTimeLeft] = useState('')

  const fetchStatus = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/me/ranked-status')
      const data = res.data
      if (data?.askedQuestionIdsToday?.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        localStorage.setItem('askedQuestionIds', JSON.stringify(data.askedQuestionIdsToday))
        localStorage.setItem('lastAskedDate', today)
      }
      setRankedStatus(data ?? null)
    } catch {
      setRankedStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMyRank = async () => {
    if (!user) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await api.get('/api/leaderboard/daily/my-rank', { params: { date: today } })
      setUserRank(res.data)
    } catch { /* rank info not available */ }
  }

  const fetchTierProgress = async () => {
    if (!user) return
    try {
      const res = await api.get('/api/me/tier-progress')
      setTierData(res.data)
    } catch { /* fallback to FE-computed tier info from totalPoints */ }
  }

  useEffect(() => {
    if (isInitialized) { fetchStatus(); fetchMyRank(); fetchTierProgress() }
  }, [isInitialized])

  // Countdown
  useEffect(() => {
    if (!rankedStatus?.resetAt) return
    const tick = () => {
      const diff = new Date(rankedStatus.resetAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('00:00:00'); return false }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      return true
    }
    tick() // Set initial value immediately (was only updating on interval)
    const timer = setInterval(() => { if (!tick()) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [rankedStatus?.resetAt])

  // Visibility change refresh
  useEffect(() => {
    const handler = () => { if (!document.hidden && isInitialized) fetchStatus() }
    const customHandler = (e: CustomEvent) => {
      try { setRankedStatus(prev => ({ ...prev!, ...e.detail })) } catch { /* ignore */ }
    }
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('rankedStatusUpdate', customHandler as EventListener)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('rankedStatusUpdate', customHandler as EventListener)
    }
  }, [isInitialized])

  const startRankedQuiz = async () => {
    try {
      const res = await api.post('/api/ranked/sessions', { language: getQuizLanguage() })
      const sessionId = res.data.sessionId
      const serverAskedIds: string[] = rankedStatus?.askedQuestionIdsToday ?? []
      const localAskedIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('askedQuestionIds') || '[]') } catch { return [] } })()
      const exclude = new Set<string>([...serverAskedIds, ...localAskedIds])

      let questions: any[] = []
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
        if (rankedStatus?.currentBook) params.book = rankedStatus.currentBook
        if (rankedStatus?.currentDifficulty && rankedStatus.currentDifficulty !== 'all') params.difficulty = rankedStatus.currentDifficulty
        addUnique((await api.get('/api/questions', { params })).data ?? [])
      }
      if (questions.length < 10 && rankedStatus?.currentBook) {
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

  // ── Loading ──
  if (isLoading || !isInitialized) return <RankedSkeleton />

  // ── Error ──
  if (!rankedStatus) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-surface-container p-10 rounded-2xl text-center max-w-md">
          <span className="material-symbols-outlined text-error text-5xl mb-4 block">error</span>
          <p className="text-on-surface font-bold text-lg mb-2">{t('ranked.loadError')}</p>
          <p className="text-on-surface-variant text-sm mb-6">{t('ranked.tryAgainLater')}</p>
          <button onClick={fetchStatus} className="gold-gradient text-on-secondary font-black px-8 py-3 rounded-xl text-sm uppercase tracking-widest">
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  // ── Derived ──
  const energyPct = rankedStatus.dailyLives > 0 ? Math.round((rankedStatus.livesRemaining / rankedStatus.dailyLives) * 100) : 0
  const canPlay = rankedStatus.livesRemaining > 0 && rankedStatus.questionsCounted < rankedStatus.cap
  // Prefer tier-progress API totalPoints (all-time accurate); fall back to leaderboard rank or today's points.
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
    <main data-testid="ranked-page" className="max-w-5xl mx-auto space-y-6">
      {/* ── Header (R2) — title + How to play ── */}
      <RankedHeader />

      {/* ── Tier progress card (R2 — RK-P1-1, RK-P1-2) ── */}
      <TierProgressCard
        currentTier={currentTier}
        nextTier={nextTier}
        totalPoints={totalPoints}
        pointsToNext={pointsToNext}
        tierProgressPct={tierProgressPct}
        starIndex={tierData?.starIndex}
      />

      {/* ── Energy + Streak 2-col (R3 — RK-P2-4) ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-3">
        <EnergyCard
          energy={rankedStatus.livesRemaining ?? 0}
          energyMax={rankedStatus.dailyLives ?? 0}
          recoverTimeLeft={timeLeft || '--:--:--'}
        />
        <RankedStreakCard streak={user?.currentStreak ?? 0} />
      </div>

      {/* ── Daily stats 2-col (R4 — RK-P1-5) ──
          Accuracy moved to sidebar WinRateWidget (R1) so this row is
          now exactly two symmetric cards. */}
      <DailyStatsCards
        questionsAnswered={rankedStatus.questionsCounted ?? 0}
        questionsCap={rankedStatus.cap || 0}
        pointsToday={rankedStatus.pointsToday ?? 0}
        dailyDelta={rankedStatus.dailyDelta}
        pointsToTop100={rankedStatus.pointsToTop100}
        pointsToTop50={rankedStatus.pointsToTop50}
        pointsToTop10={rankedStatus.pointsToTop10}
      />

      {/* ── Season card (R5 — RK-P0-2, RK-P1-3, RK-P1-4, RK-P3-2) ── */}
      <SeasonCard />

      {/* ── Current book card (R6 — RK-P0-3, RK-P1-6) ── */}
      <CurrentBookCard
        bookName={rankedStatus.currentBook}
        bookIndex={rankedStatus.currentBookIndex ?? 0}
        masteryPct={bookPct}
        difficultyLabel={difficultyLabel}
      />

      {/* ── Recent matches (R7 — RK-P2-3) ── */}
      <RecentMatchesSection />

      {/* ── Start CTA ── */}
      <div className="mt-4 mb-10">
        {(() => {
          const energy = rankedStatus.livesRemaining ?? 0
          const questionsLeftFromEnergy = Math.floor(energy / 5)
          const capReached = rankedStatus.questionsCounted >= rankedStatus.cap

          if (canPlay) {
            return (
              <button
                data-testid="ranked-start-btn"
                onClick={startRankedQuiz}
                className="w-full gold-gradient text-on-secondary font-black rounded-xl shadow-[0_8px_30px_rgb(248,189,69,0.3)] hover:shadow-[0_12px_36px_rgb(248,189,69,0.45)] active:scale-[0.98] transition-all py-4 px-7 flex flex-col items-center gap-1"
              >
                <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined" style={FILL_1}>play_arrow</span>
                  {t('ranked.ctaPlayMain')}
                </span>
                <span className="text-xs font-medium opacity-80 normal-case tracking-normal">
                  {t('ranked.ctaPlaySub', {
                    book: rankedStatus.currentBook,
                    count: questionsLeftFromEnergy,
                  })}
                </span>
              </button>
            )
          }

          // Disabled states share styling; pick label by reason
          const sharedDisabledClass = 'w-full bg-surface-container-high text-on-surface-variant font-black rounded-xl py-4 px-7 flex flex-col items-center gap-1 opacity-60 cursor-not-allowed'
          if (capReached) {
            return (
              <div className={sharedDisabledClass}>
                <span className="text-xl uppercase tracking-widest">
                  {t('ranked.ctaCapMain')}
                </span>
                <span data-testid="ranked-cap-reached-msg" className="text-xs font-medium normal-case tracking-normal">
                  {t('ranked.ctaCapSub', { time: timeLeft || '--:--:--' })}
                </span>
              </div>
            )
          }
          // noEnergy fallback
          return (
            <div className={sharedDisabledClass}>
              <span className="text-xl uppercase tracking-widest">
                {t('ranked.ctaNoEnergyMain')}
              </span>
              <span data-testid="ranked-no-energy-msg" className="text-xs font-medium normal-case tracking-normal">
                {t('ranked.ctaNoEnergySub', { time: timeLeft || '--:--:--' })}
              </span>
            </div>
          )
        })()}
      </div>
    </main>
  )
}
