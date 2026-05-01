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

      {/* ── 3 Stats Cards (R3) ── */}
      {/*
        Note: rank #N display removed from this row — rank lives only in
        the Season card below (R5). testid ranked-user-rank is no longer
        rendered; corresponding e2e assertion removed in W-M04-L1-002.
      */}
      {(() => {
        const questionsCap = rankedStatus.cap || 0
        const questionsAnswered = rankedStatus.questionsCounted ?? 0
        const questionsLeft = Math.max(0, questionsCap - questionsAnswered)
        const questionsPct = questionsCap > 0 ? (questionsAnswered / questionsCap) * 100 : 0
        const points = rankedStatus.pointsToday ?? 0
        const delta = rankedStatus.dailyDelta
        const showDelta = typeof delta === 'number' && delta !== 0
        const accuracyRaw = rankedStatus.dailyAccuracy
        const showAccuracy = typeof accuracyRaw === 'number'
        const accuracyPct = showAccuracy ? Math.round(accuracyRaw! * 100) : null
        const correctCount = rankedStatus.dailyCorrectCount
        const totalAnswered = rankedStatus.dailyTotalAnswered
        return (
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${showAccuracy ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
            {/* Card 1: questions counted */}
            <div className="glass-card rounded-xl p-5 border border-white/5">
              <div className="text-on-surface-variant text-xs uppercase tracking-widest mb-2">
                {t('ranked.questionsCounted')}
              </div>
              <div className="text-2xl font-black text-on-surface mb-1">
                <span data-testid="ranked-questions-counted">{questionsAnswered}</span>
                <span className="text-on-surface-variant font-normal text-lg">/{questionsCap}</span>
              </div>
              <div className="text-xs text-on-surface-variant mb-3">
                {t('ranked.questionsLeftToday', { count: questionsLeft })}
              </div>
              <div className="h-[3px] w-full bg-primary-container rounded-full overflow-hidden">
                <div
                  data-testid="ranked-today-progress"
                  className="h-full gold-gradient rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${questionsPct}%` }}
                />
              </div>
            </div>

            {/* Card 2: points today */}
            <div className="glass-card rounded-xl p-5 border border-white/5">
              <div className="text-on-surface-variant text-xs uppercase tracking-widest mb-2">
                {t('ranked.pointsToday')}
              </div>
              <div data-testid="ranked-points-today" className="text-3xl font-black mb-1" style={{ color: '#e8a832' }}>
                {points}
              </div>
              {showDelta && (
                <div
                  data-testid="ranked-points-delta"
                  className="text-xs font-medium"
                  style={{ color: delta! > 0 ? '#4ade80' : '#fb923c' }}
                >
                  {delta! > 0
                    ? `↑ +${delta} ${t('ranked.deltaVsYesterday')}`
                    : `↓ ${Math.abs(delta!)} ${t('ranked.deltaVsYesterday')}`}
                </div>
              )}
            </div>

            {/* Card 3: accuracy — only when BE provides it */}
            {showAccuracy && (
              <div className="glass-card rounded-xl p-5 border border-white/5">
                <div className="text-on-surface-variant text-xs uppercase tracking-widest mb-2">
                  {t('ranked.accuracy')}
                </div>
                <div data-testid="ranked-accuracy" className="text-2xl font-black text-on-surface mb-1">
                  {accuracyPct}%
                </div>
                {typeof correctCount === 'number' && typeof totalAnswered === 'number' && (
                  <div className="text-xs text-on-surface-variant">
                    {t('ranked.correctOfTotal', { correct: correctCount, total: totalAnswered })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Active Book Card (R4) ── */}
      <section
        data-testid="ranked-current-book"
        className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-4"
      >
        {/* Icon 48x48 gold-tinted */}
        <div
          className="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
          style={{
            backgroundColor: 'rgba(232,168,50,0.12)',
            border: '1px solid rgba(232,168,50,0.25)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ ...FILL_1, color: '#e8a832', fontSize: '24px' }}
          >
            menu_book
          </span>
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
            <h4
              data-testid="ranked-current-book-name"
              className="text-lg font-black text-on-surface tracking-tight"
            >
              {rankedStatus.currentBook}
            </h4>
            {rankedStatus.bookProgress && (
              <span className="text-xs text-on-surface-variant font-medium">
                • {t('ranked.bookOf', {
                  current: rankedStatus.bookProgress.currentIndex + 1,
                  total: rankedStatus.bookProgress.totalBooks,
                })}
              </span>
            )}
            <span
              className="bg-surface-container-high text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full border border-secondary/20 uppercase tracking-wider"
            >
              {difficultyLabel}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mb-2">
            {t('ranked.conquering')} — {Math.round(bookPct)}%
          </p>
          <div className="h-1 w-full bg-primary-container rounded-full overflow-hidden">
            <div
              data-testid="ranked-current-book-progress"
              className="h-full gold-gradient rounded-full transition-all duration-700 ease-out"
              style={{ width: `${bookPct}%` }}
            />
          </div>
        </div>

        {/* Change-book button — disabled until a Ranked book-selector flow exists */}
        <button
          type="button"
          disabled
          title={t('ranked.changeBookSoon')}
          aria-label={t('ranked.changeBookSoon')}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border opacity-50 cursor-not-allowed"
          style={{
            color: '#e8a832',
            borderColor: 'rgba(232,168,50,0.4)',
            backgroundColor: 'transparent',
          }}
        >
          {t('ranked.changeBook')}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </section>

      {/* ── Season Card with Milestones (R5) ── */}
      {(() => {
        const seasonRank = userRank?.rank as number | undefined | null
        const hasRank = typeof seasonRank === 'number' && seasonRank > 0
        // Lerp formula agreed with product: 4 milestones evenly spaced on a
        // 0-100% bar. Rank > 100 → 0%, 100 → 0%, 50 → 33%, 10 → 66%, 1 → 100%.
        const lerp = (v: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number => {
          if (fromMin === fromMax) return toMin
          const t = (v - fromMin) / (fromMax - fromMin)
          const clamped = Math.min(1, Math.max(0, t))
          return toMin + clamped * (toMax - toMin)
        }
        const computeSeasonProgress = (rank: number): number => {
          if (rank > 100) return 0
          if (rank > 50) return lerp(rank, 100, 50, 0, 0.33)
          if (rank > 10) return lerp(rank, 50, 10, 0.33, 0.66)
          return lerp(rank, 10, 1, 0.66, 1)
        }
        const progress = hasRank ? computeSeasonProgress(seasonRank!) : 0
        // Highlight the milestone closest to the user's progress position.
        // For ranks > 100, the user is "before" Top 100 → highlight slot 0.
        const milestones = [
          { rank: 100, position: 0 },
          { rank: 50, position: 1 / 3 },
          { rank: 10, position: 2 / 3 },
          { rank: 1, position: 1 },
        ]
        const youAreHereSlot = hasRank
          ? (() => {
              if (seasonRank! > 100) return 0
              if (seasonRank! > 50) return 0  // between Top 100 and Top 50
              if (seasonRank! > 10) return 1  // between Top 50 and Top 10
              if (seasonRank! > 1) return 2   // between Top 10 and Top 1
              return 3
            })()
          : -1
        return (
          <section
            data-testid="ranked-season-card"
            className="glass-card rounded-xl p-6 border border-white/5"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={FILL_1}>emoji_events</span>
                {t('ranked.season')}
              </h3>
              <span data-testid="ranked-season-reset" className="text-xs text-on-surface-variant italic">
                {t('ranked.reset')}: <span data-testid="ranked-season-reset-time">{timeLeft || '--:--:--'}</span>
              </span>
            </div>

            <div className="flex items-center gap-6">
              {/* Left: rank big number + season points */}
              <div className="shrink-0 min-w-[100px]">
                {hasRank ? (
                  <div data-testid="ranked-season-rank" className="text-4xl font-black mb-1" style={{ color: '#e8a832' }}>
                    #{seasonRank}
                  </div>
                ) : (
                  <div data-testid="ranked-season-rank" className="text-base font-bold text-on-surface-variant mb-1">
                    {t('ranked.unranked')}
                  </div>
                )}
                <div data-testid="ranked-season-points" className="text-xs text-on-surface-variant font-medium">
                  {t('ranked.seasonPointsLabel', { points: (totalPoints ?? 0).toLocaleString('vi-VN') })}
                </div>
              </div>

              {/* Right: progress bar + milestones */}
              <div className="flex-1 min-w-0">
                <div className="h-1.5 w-full bg-primary-container rounded-full overflow-hidden mb-2">
                  <div
                    data-testid="ranked-season-progress-bar"
                    className="h-full gold-gradient rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 text-[11px] uppercase font-bold tracking-wider">
                  {milestones.map((m, i) => {
                    const active = i === youAreHereSlot
                    const align = i === 0 ? 'text-left' : i === milestones.length - 1 ? 'text-right' : 'text-center'
                    // Path A surfaces "points to enter" only for top 50 / top 10.
                    // Show the suffix when the user is below that threshold;
                    // otherwise fall back to the bare label.
                    const pointsToReach = m.rank === 50
                      ? rankedStatus.pointsToTop50
                      : m.rank === 10
                        ? rankedStatus.pointsToTop10
                        : null
                    const labelKey = !active && typeof pointsToReach === 'number'
                      ? 'ranked.topMilestoneWithPoints'
                      : 'ranked.topMilestone'
                    return (
                      <span
                        key={m.rank}
                        data-testid={`ranked-milestone-${m.rank}`}
                        className={align}
                        style={{
                          color: active ? '#e8a832' : 'rgba(225,225,241,0.45)',
                          fontWeight: active ? 700 : 600,
                        }}
                      >
                        {active
                          ? t('ranked.youAreHere')
                          : t(labelKey, { n: m.rank, points: pointsToReach ?? 0 })}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {/* ── Start CTA (R5 — 3 states) ── */}
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
