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

          {nextTier ? (
            <p data-testid="ranked-tier-progress-text" className="text-sm text-on-surface-variant">
              {t('ranked.pointsToNext', {
                points: pointsToNext.toLocaleString('vi-VN'),
                tier: t(nextTier.nameKey),
              })}
            </p>
          ) : (
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

      {/* ── Energy Card ── */}
      <section data-testid="ranked-energy-display" className="glass-card rounded-xl p-6 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-8xl">bolt</span>
        </div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant uppercase text-xs font-bold tracking-widest mb-1">
              <span className="material-symbols-outlined text-sm">bolt</span>
              {t('ranked.energy')}
            </div>
            <div className="text-4xl font-black text-on-surface">
              {rankedStatus.livesRemaining}<span className="text-on-surface-variant text-xl font-normal">/{rankedStatus.dailyLives}</span>
            </div>
          </div>
          <div className="text-right">
            <div data-testid="ranked-reset-timer" className="flex items-center gap-1 text-on-surface-variant text-sm font-medium">
              <span className="material-symbols-outlined text-sm">schedule</span>
              {t('ranked.recovery')}: <span data-testid="ranked-energy-timer">{timeLeft || '--:--:--'}</span>
            </div>
          </div>
        </div>
        <div className="h-3 w-full bg-primary-container rounded-full overflow-hidden">
          <div className="h-full gold-gradient rounded-full shadow-[0_0_10px_rgba(248,189,69,0.4)]" style={{ width: `${energyPct}%` }} />
        </div>
      </section>

      {/* ── Today's Progress + Current Book ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Today's Progress */}
        <section data-testid="ranked-today-progress" className="lg:col-span-7 glass-card rounded-xl p-6 border border-white/5 min-h-[180px]">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-sm">leaderboard</span>
            {t('ranked.today')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <div className="text-on-surface-variant text-xs mb-1">{t('ranked.questionsCounted')}</div>
              <div data-testid="ranked-questions-counted" className="font-bold text-on-surface mb-2">{rankedStatus.questionsCounted}<span className="text-on-surface-variant font-normal">/{rankedStatus.cap}</span></div>
              <div className="h-1 w-full bg-primary-container rounded-full overflow-hidden">
                <div className="h-full bg-secondary/60 rounded-full" style={{ width: `${rankedStatus.cap > 0 ? (rankedStatus.questionsCounted / rankedStatus.cap) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-r border-outline-variant/10">
              <div className="text-on-surface-variant text-xs mb-1">{t('ranked.pointsToday')}</div>
              <div data-testid="ranked-points-today" className="text-4xl font-black text-secondary">{rankedStatus.pointsToday ?? 0}</div>
            </div>
            <div className="flex flex-col items-end justify-center">
              <div className="text-on-surface-variant text-xs mb-1">{t('ranked.ranking')}</div>
              <div data-testid="ranked-user-rank" className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span>#{userRank?.rank ?? '—'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Current Book */}
        <section className="lg:col-span-5 glass-card rounded-xl p-6 border border-white/5 relative">
          <div className="absolute -left-1 top-6 w-1 h-12 bg-secondary rounded-full shadow-[0_0_10px_rgba(248,189,69,0.5)]" />
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
      </div>

      {/* ── Season Card ── */}
      <section data-testid="ranked-season-card" className="glass-card rounded-xl p-8 border border-white/5 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 opacity-5 pointer-events-none">
          <span className="material-symbols-outlined text-[300px]">trophy</span>
        </div>
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
