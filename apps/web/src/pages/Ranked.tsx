import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useAuth } from '../store/authStore'
import { useRankedDataSync } from '../hooks/useRankedDataSync'
import { getTierInfo } from '../data/tiers'

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
  // TODO: BE-EXTEND-RANKED-STATUS — accuracy/delta not yet exposed by
  // /api/me/ranked-status. When backend ships these, the FE renders
  // the third stats card (accuracy) and the delta line on points card.
  dailyAccuracy?: number  // 0-1
  dailyCorrect?: number   // numerator for the "{correct}/{total}" subtitle
  dailyDelta?: number     // points delta vs yesterday
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
      {/* ── Header (R1) ── */}
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          {t('ranked.title')}
        </h1>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div
            data-testid="ranked-tier-badge"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
            style={{
              backgroundColor: 'rgba(232,168,50,0.1)',
              borderColor: 'rgba(232,168,50,0.3)',
            }}
          >
            <span
              className="material-symbols-outlined text-base"
              style={{ ...FILL_1, color: currentTier.colorHex }}
            >
              {currentTier.iconMaterial}
            </span>
            <span
              className="font-bold text-sm uppercase tracking-wide"
              style={{ color: currentTier.colorHex }}
            >
              {t(currentTier.nameKey)}
            </span>
          </div>

          {nextTier ? (() => {
            const nextTierName = t(nextTier.nameKey)
            const fullText = t('ranked.pointsToNext', {
              points: pointsToNext.toLocaleString('vi-VN'),
              tier: nextTierName,
            })
            // R1 polish: highlight nextTier name in gold + semibold without
            // changing the i18n string (locale-agnostic — assumes tier name
            // appears verbatim once in the translated sentence).
            const idx = fullText.lastIndexOf(nextTierName)
            const before = idx >= 0 ? fullText.slice(0, idx) : fullText
            const after = idx >= 0 ? fullText.slice(idx + nextTierName.length) : ''
            return (
              <p data-testid="ranked-tier-progress-text" className="text-sm text-on-surface-variant">
                {before}
                <span className="font-semibold" style={{ color: '#e8a832' }}>{nextTierName}</span>
                {after}
              </p>
            )
          })() : (
            <p data-testid="ranked-tier-progress-text" className="text-sm text-secondary font-bold">
              {t('ranked.maxTier')}
            </p>
          )}
        </div>

        <div className="h-1.5 w-full bg-primary-container rounded-full overflow-hidden">
          <div
            data-testid="ranked-tier-progress-bar"
            className="h-full gold-gradient rounded-full transition-all duration-700 ease-out"
            style={{ width: `${tierProgressPct}%` }}
          />
        </div>
      </header>

      {/* ── Energy + Streak (R2) ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Energy Card (left ~60%) */}
        <section
          data-testid="ranked-energy-card"
          className="md:col-span-7 glass-card rounded-xl p-6 border border-white/5"
        >
          <div className="flex items-center gap-2 text-on-surface-variant uppercase text-xs font-bold tracking-widest mb-2">
            <span className="material-symbols-outlined text-sm" style={FILL_1}>bolt</span>
            {t('ranked.energy')}
          </div>
          <div data-testid="ranked-energy-display" className="mb-3">
            <span className="text-4xl font-black" style={{ color: '#e8a832' }}>
              {rankedStatus.livesRemaining ?? 0}
            </span>
            <span className="text-on-surface-variant text-xl font-normal ml-1">
              /{rankedStatus.dailyLives ?? 0}
            </span>
          </div>
          <div className="h-2 w-full bg-primary-container rounded-full overflow-hidden mb-4">
            <div
              className="h-full gold-gradient rounded-full transition-all duration-700 ease-out"
              style={{ width: `${energyPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-on-surface-variant">
              {t('ranked.questionsLeft', { count: Math.floor((rankedStatus.livesRemaining ?? 0) / 5) })}
            </span>
            <span data-testid="ranked-reset-timer" className="flex items-center gap-1 text-on-surface-variant font-medium">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {t('ranked.recovery')}: <span data-testid="ranked-energy-timer">{timeLeft || '--:--:--'}</span>
            </span>
          </div>
        </section>

        {/* Streak Card (right ~40%) */}
        <section
          className="md:col-span-5 rounded-xl p-6 border flex flex-col justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(251,146,60,0.08), rgba(232,168,50,0.04))',
            borderColor: 'rgba(251,146,60,0.2)',
          }}
        >
          <div className="flex items-center gap-2 uppercase text-xs font-bold tracking-widest mb-3" style={{ color: 'rgba(251,146,60,0.9)' }}>
            <span className="text-base" aria-hidden>🔥</span>
            {t('ranked.streakHeader')}
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-4xl" aria-hidden style={{ filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.4))' }}>🔥</span>
            <span className="text-3xl font-black" style={{ color: '#fb923c' }}>
              {t('ranked.streakDays', { count: user?.currentStreak ?? 0 })}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            {(user?.currentStreak ?? 0) > 0 ? t('ranked.streakKeepGoing') : t('ranked.streakStart')}
          </p>
        </section>
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
        const correctCount = rankedStatus.dailyCorrect
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
                  style={{ color: delta! > 0 ? '#4ade80' : 'rgba(225,225,241,0.6)' }}
                >
                  {delta! > 0 ? '↑' : '↓'} {delta! > 0 ? '+' : ''}{delta} {t('ranked.deltaVsYesterday')}
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
                {typeof correctCount === 'number' && (
                  <div className="text-xs text-on-surface-variant">
                    {t('ranked.correctOfTotal', { correct: correctCount, total: questionsAnswered })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Currently Playing ── */}
      <section className="glass-card rounded-xl p-6 border border-white/5">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-sm">menu_book</span>
          {t('ranked.currentlyPlaying')}
        </h3>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 data-testid="ranked-current-book" className="text-3xl font-black text-on-surface tracking-tight">
              <span data-testid="ranked-current-book-name">{rankedStatus.currentBook}</span>
            </h4>
            <p data-testid="ranked-current-book-progress" className="text-sm text-on-surface-variant">
              {rankedStatus.bookProgress ? t('ranked.bookOf', { current: rankedStatus.bookProgress.currentIndex + 1, total: rankedStatus.bookProgress.totalBooks }) : ''}
            </p>
          </div>
          <span className="bg-surface-container-high text-secondary text-[10px] font-bold px-3 py-1 rounded-full border border-secondary/20 uppercase tracking-tighter">
            {difficultyLabel}
          </span>
        </div>
        <div className="h-1 w-full bg-primary-container rounded-full overflow-hidden">
          <div className="h-full gold-gradient rounded-full" style={{ width: `${bookPct}%` }} />
        </div>
      </section>

      {/* ── Season Card ── */}
      <section data-testid="ranked-season-card" className="glass-card rounded-xl p-8 border border-white/5 flex flex-col md:flex-row items-center gap-8">
        <div className="w-full md:w-1/3 text-center md:text-left">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mb-4">
            <span className="material-symbols-outlined text-sm">emoji_events</span>
            {t('ranked.season')}
          </h3>
          <div data-testid="ranked-season-rank" className="text-6xl font-black text-secondary mb-2">#{userRank?.rank ?? '—'}</div>
          <div data-testid="ranked-season-points" className="text-on-surface font-medium">{(totalPoints ?? 0).toLocaleString()} {t('ranked.points')}</div>
        </div>
        <div className="w-full md:w-2/3 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface font-bold">{t('ranked.seasonProgress')}</span>
            <span className="text-on-surface-variant italic">{t('ranked.reset')}: {timeLeft || '--:--:--'}</span>
          </div>
          <div className="h-4 w-full bg-primary-container rounded-full overflow-hidden p-1">
            <div className="h-full gold-gradient rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" style={{ width: '65%' }} />
          </div>
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60">
            <span>{t('ranked.start')}</span>
            <span>{t('ranked.peak')}</span>
          </div>
        </div>
      </section>

      {/* ── Start CTA ── */}
      <div className="mt-4 mb-10">
        {canPlay ? (
          <button
            data-testid="ranked-start-btn"
            onClick={startRankedQuiz}
            className="w-full gold-gradient text-on-secondary font-black py-5 rounded-xl text-xl uppercase tracking-widest shadow-[0_8px_30px_rgb(248,189,69,0.3)] active:scale-[0.98] transition-transform flex items-center justify-center gap-4"
          >
            <span className="material-symbols-outlined" style={FILL_1}>play_arrow</span>
            {t('gameModes.rankedBtn')}
          </button>
        ) : rankedStatus.questionsCounted >= rankedStatus.cap ? (
          <div data-testid="ranked-cap-reached-msg" className="w-full bg-surface-container-high text-on-surface-variant font-black py-5 rounded-xl text-xl uppercase tracking-widest flex items-center justify-center gap-4 opacity-60 cursor-not-allowed">
            <span className="material-symbols-outlined">block</span>
            {t('ranked.outOfEnergy')}
          </div>
        ) : (
          <div data-testid="ranked-no-energy-msg" className="w-full bg-surface-container-high text-on-surface-variant font-black py-5 rounded-xl text-xl uppercase tracking-widest flex items-center justify-center gap-4 opacity-60 cursor-not-allowed">
            <span className="material-symbols-outlined">block</span>
            {t('ranked.outOfEnergy')}
          </div>
        )}
      </div>
    </main>
  )
}
