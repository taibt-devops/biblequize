import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import ShareCard from '../components/ShareCard'
import PageMeta from '../components/PageMeta'
import DifficultyBadge from '../components/DifficultyBadge'
import { getQuizLanguage } from '../utils/quizLanguage'
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton'
import { wrapProperNouns, formatVerseRef, getQuestionLengthClass } from '../utils/textHelpers'
import { useAuthStore } from '../store/authStore'
import { PageHeader } from './daily/PageHeader'
import { HeroCard } from './daily/HeroCard'
import { DailyLeaderboard, type DailyLbEntry } from './daily/DailyLeaderboard'
import { StreakCard } from './daily/StreakCard'
import { HeatmapCard, type HeatmapDay } from './daily/HeatmapCard'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Question {
  id: string
  book: string
  chapter: number
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string
  /** DTAG-2: easy/medium/hard (BE already serializes it). Optional for safety. */
  difficulty?: string
}

interface DailyChallengeData {
  questions: Question[]
  alreadyCompleted: boolean
  sessionId: string
  date: string
  title?: string
  description?: string
  questionCount?: number
  timeLimit?: number
}

interface DailyResult {
  completed: boolean
  score: number
  correctCount: number
  totalQuestions: number
  xpEarned?: number
  xpMinCorrect?: number
  sessionId?: string
  betterThanPercent?: number
  completedAt?: string | number
  timeSeconds?: number
  rankGlobal?: number
  rankGroup?: number
}

interface YesterdaySummary {
  completed: boolean
  correctCount?: number
  totalQuestions?: number
  timeSeconds?: number
  score?: number
}

interface ActiveSeason {
  id: string
  name: string
  isActive: boolean
}

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }
const LETTERS = ['A', 'B', 'C', 'D']

// Daily Challenge XP by correct-count — mirrors BE DailyChallengeService.dailyXp
// (DECISIONS.md 2026-06-16). Used only for the optimistic result shown before
// GET /result returns the authoritative value. score == xpEarned (one number).
const DAILY_XP_BY_CORRECT = [0, 20, 40, 60, 100, 150]
function dailyXp(correctCount: number): number {
  const c = Math.max(0, Math.min(5, correctCount))
  return DAILY_XP_BY_CORRECT[c]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getTodayLabel(t: (key: string) => string): string {
  const d = new Date()
  const dayKeys = [
    'daily.dayNameSunday', 'daily.dayNameMonday', 'daily.dayNameTuesday',
    'daily.dayNameWednesday', 'daily.dayNameThursday', 'daily.dayNameFriday', 'daily.dayNameSaturday',
  ]
  return `${t(dayKeys[d.getDay()])}, ${d.toLocaleDateString('vi-VN')}`
}

function getLast7Days(t: (key: string) => string, completedDates: Set<string>) {
  const DAY_LABELS = [
    t('daily.daySun'), t('daily.dayMon'), t('daily.dayTue'),
    t('daily.dayWed'), t('daily.dayThu'), t('daily.dayFri'), t('daily.daySat'),
  ]
  const days: { label: string; date: string; isToday: boolean; completed: boolean }[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    days.push({
      label: DAY_LABELS[d.getDay()],
      date: iso,
      isToday: i === 0,
      completed: completedDates.has(iso),
    })
  }
  return days
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────
function LoadingSkeleton() {
  const { t } = useTranslation()
  // Render the real header (h1) above the placeholders so the page always has
  // its <h1> — including in the prerendered snapshot, which is captured while
  // the daily query is still loading.
  return (
    <div className="max-w-5xl mx-auto p-2 space-y-6">
      <PageHeader todayLabel={getTodayLabel(t)} />
      <div className="space-y-6 animate-pulse">
        <div className="h-80 bg-bq-inset rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
          <div className="h-96 bg-bq-inset rounded-2xl" />
          <div className="h-96 bg-bq-inset rounded-2xl" />
        </div>
        <div className="h-40 bg-bq-inset rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
const DailyChallenge: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userName = useAuthStore((s) => s.user?.name)
  const userAvatar = useAuthStore((s) => s.user?.avatar)
  const userStreak = useAuthStore((s) => s.user?.currentStreak ?? 0)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Page-level state
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [currentExplanation, setCurrentExplanation] = useState<string>('')
  const [results, setResults] = useState<boolean[]>([])
  const [correctAnswerIndices, setCorrectAnswerIndices] = useState<number[]>([])
  // Hidden by default so the panel doesn't cover the answer grid on short
  // mobile viewports (S21 Ultra report 2026-05-19). User taps pill to expand.
  const [explanationCollapsed, setExplanationCollapsed] = useState(true)
  const explanationRef = useRef<HTMLDivElement>(null)

  // Result state
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  const [showShareCard, setShowShareCard] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Click-outside on the explanation panel collapses it so the answer grid
  // behind is visible. Only attach the listener while a panel is open.
  useEffect(() => {
    if (!answered || explanationCollapsed) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const node = explanationRef.current
      if (node && !node.contains(e.target as Node)) {
        setExplanationCollapsed(true)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [answered, explanationCollapsed])

  // ── Data fetching via TanStack Query ────────────────────────────────────
  const challengeQuery = useQuery<DailyChallengeData>({
    queryKey: ['daily-challenge', getQuizLanguage()],
    queryFn: () => api.get(`/api/daily-challenge?language=${getQuizLanguage()}`).then((r) => r.data),
    staleTime: 60_000,
  })

  const resultQuery = useQuery<DailyResult>({
    queryKey: ['daily-challenge-result'],
    queryFn: () => api.get('/api/daily-challenge/result').then((r) => r.data),
    enabled: isAuthenticated && challengeQuery.data?.alreadyCompleted === true,
    staleTime: 30_000,
  })

  const leaderboardQuery = useQuery<unknown>({
    queryKey: ['daily-leaderboard'],
    queryFn: () => api.get('/api/leaderboard/daily?size=10').then((r) => r.data),
    staleTime: 60_000,
  })

  const yesterdayQuery = useQuery<YesterdaySummary>({
    queryKey: ['daily-yesterday'],
    queryFn: () => api.get('/api/daily-challenge/yesterday-summary').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  const historyQuery = useQuery<HeatmapDay[]>({
    queryKey: ['daily-history-30'],
    queryFn: () => api.get('/api/daily-challenge/history?days=30').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const seasonQuery = useQuery<ActiveSeason | null>({
    queryKey: ['season-active'],
    queryFn: () => api.get('/api/seasons/active').then((r) => r.data).catch(() => null),
    staleTime: 30 * 60_000,
  })

  // Tier level drives per-week streak-freeze allowance shown in StreakCard.
  // Reuse the existing /api/me/tier-progress endpoint (same one HomeBanner
  // reads) so we don't add a new BE call.
  const tierProgressQuery = useQuery<{ tierLevel?: number }>({
    queryKey: ['me-tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  // Sync resultQuery → local dailyResult so completion handler can also push.
  // When the /result payload omits {completed:true} but challengeData says
  // alreadyCompleted, we still mark complete using whatever fields are
  // available (BE consistency varies; FE must not get stuck on "ready").
  useEffect(() => {
    const challenge = challengeQuery.data as (DailyChallengeData & { score?: number }) | undefined
    const result = resultQuery.data
    if (result?.completed) {
      setDailyResult(result)
    } else if (challenge?.alreadyCompleted) {
      setDailyResult({
        completed: true,
        score: result?.score ?? challenge.score ?? 0,
        correctCount: result?.correctCount ?? 0,
        totalQuestions: result?.totalQuestions ?? challenge.questionCount ?? 5,
        xpEarned: result?.xpEarned ?? 0,
        completedAt: result?.completedAt,
        betterThanPercent: result?.betterThanPercent,
        rankGlobal: result?.rankGlobal,
        rankGroup: result?.rankGroup,
        timeSeconds: result?.timeSeconds,
        sessionId: result?.sessionId,
      })
    }
  }, [resultQuery.data, challengeQuery.data])

  const challengeData = challengeQuery.data
  const isCompleted = !!dailyResult?.completed
  const loading = challengeQuery.isLoading

  // Global rank cho ô "Hạng toàn cầu" trong HeroCard (state done). Endpoint
  // /daily/my-rank xếp theo UserDailyProgress.pointsCounted — cùng nguồn với
  // /api/leaderboard/daily mà DailyLeaderboard đã hiển thị. Chỉ fetch sau khi
  // hoàn thành. Trả null khi user chưa có điểm ngày hôm nay.
  const myRankQuery = useQuery<{ rank?: number } | null>({
    queryKey: ['daily-my-rank'],
    queryFn: () => api.get('/api/leaderboard/daily/my-rank').then((r) => r.data),
    enabled: isAuthenticated && isCompleted,
    staleTime: 60_000,
  })
  const myGlobalRank = myRankQuery.data?.rank

  // ── Derived ─────────────────────────────────────────────────────────────
  const todayLabel = useMemo(() => getTodayLabel(t), [t])

  const historyDays = useMemo<HeatmapDay[]>(() => {
    const data = historyQuery.data
    return Array.isArray(data) ? data : []
  }, [historyQuery.data])

  const completedDates = useMemo(() => {
    const set = new Set<string>()
    historyDays.forEach((d) => { if (d.completed) set.add(d.date) })
    return set
  }, [historyDays])

  const last7Days = useMemo(
    () => getLast7Days(t, completedDates),
    [t, completedDates]
  )

  // Source of truth for the user's consecutive-day streak is the
  // backend (User.currentStreak via /api/me) — same value the sidebar
  // StreakWidget shows. Previously this was recomputed from Daily
  // Challenge history alone, which broke when the user kept a streak
  // through other quiz modes without completing today's Daily, leaving
  // the page showing 0 while the sidebar showed 2.
  const currentStreak = userStreak

  // Per-tier streak-freeze allowance (SPEC_USER §3.2.2 / tierPerks.ts):
  // T1-2 = 1, T3-4 = 2, T5-6 = 3. Defaults to 1 while tier data loads.
  const freezesPerWeek = (() => {
    const tier = tierProgressQuery.data?.tierLevel ?? 1
    if (tier >= 5) return 3
    if (tier >= 3) return 2
    return 1
  })()

  const leaderboardEntries = useMemo<DailyLbEntry[]>(() => {
    const data = leaderboardQuery.data
    if (!data) return []
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray((data as { entries?: unknown[] }).entries)
        ? (data as { entries?: unknown[] }).entries!
        : []
    return (rawList as Array<Record<string, unknown>>).map((entry, idx) => ({
      rank: (entry.rank as number) ?? idx + 1,
      name: (entry.name as string) ?? (entry.userName as string) ?? '—',
      tier: entry.tier as string | undefined,
      score: (entry.score as number) ?? (entry.points as number) ?? 0,
      correctCount: entry.correctCount as number | undefined,
      totalQuestions: entry.totalQuestions as number | undefined,
      timeLabel: entry.time as string | undefined,
      avatarUrl: entry.avatar as string | undefined,
    }))
  }, [leaderboardQuery.data])

  const myEntry = useMemo<DailyLbEntry | null | undefined>(() => {
    if (!isCompleted || !dailyResult) return null
    return {
      rank: myGlobalRank ?? dailyResult.rankGlobal ?? 0,
      name: userName ?? '—',
      score: dailyResult.score,
      correctCount: dailyResult.correctCount,
      totalQuestions: dailyResult.totalQuestions,
      avatarUrl: userAvatar,
      avatarInitial: (userName ?? '?').charAt(0).toUpperCase(),
      isMe: true,
    }
  }, [isCompleted, dailyResult, userName, userAvatar, myGlobalRank])

  // ── Start challenge ─────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!challengeData) return
    try {
      const startRes = await api.post('/api/daily-challenge/start')
      setSessionId(startRes.data.sessionId)
      setQuizStarted(true)
    } catch {
      setError(t('daily.startError'))
    }
  }, [challengeData, t])

  // ── Handle answer selection ─────────────────────────────────────────────
  const handleAnswer = useCallback(async (optionIndex: number) => {
    if (answered || !challengeData || !sessionId) return
    setSelectedAnswer(optionIndex)
    setAnswered(true)
    const question = challengeData.questions[currentIndex]
    try {
      const res = await api.post('/api/daily-challenge/answer', {
        questionId: question.id,
        answer: optionIndex,
      })
      const correctAnswer: number[] = res.data.correctAnswer ?? []
      const correct: boolean = res.data.isCorrect ?? correctAnswer.includes(optionIndex)
      setCorrectAnswerIndices(correctAnswer)
      setIsCorrect(correct)
      setCurrentExplanation(res.data.explanation ?? '')
      setResults((prev) => [...prev, correct])
    } catch {
      setCorrectAnswerIndices([])
      setIsCorrect(false)
      setCurrentExplanation('')
      setResults((prev) => [...prev, false])
    }
    // Refresh daily-missions widget so "answer_correct" + "answer_combo"
    // tick/reset without an F5 (mission tracking happens BE-side in
    // DailyChallengeService.checkAnswer when authenticated).
    queryClient.invalidateQueries({ queryKey: ['daily-missions'] })
  }, [answered, challengeData, sessionId, currentIndex, queryClient])

  // ── Next question ───────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!challengeData) return
    if (currentIndex + 1 >= challengeData.questions.length) {
      const correctCount = results.filter(Boolean).length
      const score = dailyXp(correctCount)
      try {
        await api.post('/api/daily-challenge/complete', { score, correctCount })
      } catch { /* ignore */ }

      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['me-tier-progress'] })
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] })
      // Bugfix: invalidate the `alreadyCompleted` status query too, not
      // just the result query. Home page reads ['daily-challenge', lang]
      // to decide State A (todo) vs State B (done + Hero Ranked promoted)
      // — without this invalidation it stayed stale `alreadyCompleted:
      // false` after completion, so the user saw the State-A daily card
      // until they F5'd. Partial-key match invalidates all language
      // variants (['daily-challenge','vi'] and ['daily-challenge','en']).
      queryClient.invalidateQueries({ queryKey: ['daily-challenge'] })
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-result'] })
      queryClient.invalidateQueries({ queryKey: ['daily-history-30'] })
      queryClient.invalidateQueries({ queryKey: ['daily-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['daily-my-rank'] })
      // Ranked-status query feeds HeroRankedCard energy/cap stats — refetch
      // so the promoted-after-Daily Hero card shows fresh numbers if the
      // user already played some ranked questions during the daily session.
      queryClient.invalidateQueries({ queryKey: ['ranked-status'] })

      const localResult: DailyResult = {
        completed: true,
        score,
        correctCount,
        totalQuestions: challengeData.questions.length,
        xpEarned: score, // unified: score == XP earned (0/20/40/60/100/150)
        sessionId: sessionId || undefined,
        completedAt: new Date().toISOString(),
      }
      try {
        const resultRes = await api.get('/api/daily-challenge/result')
        const apiData = resultRes.data
        setDailyResult({
          ...localResult,
          score: apiData.score ?? score,
          correctCount: apiData.correctCount > 0 ? apiData.correctCount : correctCount,
          totalQuestions: apiData.totalQuestions > 0 ? apiData.totalQuestions : challengeData.questions.length,
          betterThanPercent: apiData.betterThanPercent,
          rankGlobal: apiData.rankGlobal,
        })
      } catch {
        setDailyResult(localResult)
      }
      setQuizStarted(false)
    } else {
      setCurrentIndex((p) => p + 1)
      setSelectedAnswer(null)
      setAnswered(false)
      setIsCorrect(null)
      setCurrentExplanation('')
      setCorrectAnswerIndices([])
      setExplanationCollapsed(true)
    }
  }, [challengeData, currentIndex, results, sessionId, queryClient])

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ─── Error ──────────────────────────────────────────────────────────────
  if (challengeQuery.isError && !challengeData) {
    return (
      <div data-testid="daily-error-state" className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-bq-ruby/10 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-bq-ruby">error</span>
        </div>
        <p className="text-bq-ink2 text-lg">{error ?? t('daily.loadError')}</p>
        <button
          data-testid="daily-error-retry-btn"
          onClick={() => window.location.reload()}
          className="bg-bq-action text-bq-ink shadow-bq-action px-8 py-3 rounded-xl font-bold"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  // ─── Quiz View (active gameplay) ────────────────────────────────────────
  if (quizStarted && challengeData && challengeData.questions.length > 0) {
    const question = challengeData.questions[currentIndex]
    const totalQuestions = challengeData.questions.length
    const correctOptionText = question.options[correctAnswerIndices[0] ?? -1] ?? ''

    return (
      <div className={`relative flex flex-col items-center max-w-5xl mx-auto ${answered ? 'pb-56 md:pb-44' : 'pb-12'}`}>
        <div className="w-full flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-bq-ink">{t('daily.title')}</h2>
            <p className="text-xs text-bq-ink2 mt-0.5">{t('quiz.question', { current: currentIndex + 1, total: totalQuestions })}</p>
          </div>
          <div className="bg-bq-white px-4 py-2 rounded-xl border border-bq-hair text-sm font-mono font-bold text-bq-amberd">
            {todayLabel}
          </div>
        </div>

        <div className="w-full flex gap-2 mb-10">
          {Array.from({ length: totalQuestions }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < currentIndex
                  ? results[i] ? 'bg-bq-emerald' : 'bg-bq-ruby'
                  : i === currentIndex ? 'bg-bq-amber' : 'bg-bq-inset'
              }`}
            />
          ))}
        </div>

        <div className="w-full space-y-6 md:space-y-16">
          {(() => {
            const lenClass = getQuestionLengthClass(question.content)
            const mobileFontCls =
              lenClass === 'short'  ? 'text-[21px] font-bold text-center' :
              lenClass === 'medium' ? 'text-[18px] font-semibold text-center' :
                                      'text-[15px] font-semibold text-left'
            return (
              <div
                data-question-length={lenClass}
                className="relative w-full aspect-auto min-h-[160px] md:aspect-[21/7] md:min-h-0 flex flex-col items-center justify-center text-center p-5 md:p-10 bg-bq-white rounded-2xl md:rounded-[2.5rem] border border-bq-hair shadow-bq-soft overflow-hidden"
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 md:w-2 h-20 md:h-32 bg-bq-amber rounded-r-full" />
                {/* Verse badge + DTAG-2 difficulty badge. */}
                <div className="flex items-center justify-center flex-wrap gap-2 mb-3 md:mb-4">
                  <div className="inline-flex items-center gap-1.5 bg-bq-amber/10 border border-bq-amber/20 rounded-full px-3 py-1">
                    <span className="material-symbols-outlined text-bq-amberd text-xs">menu_book</span>
                    <span className="text-bq-amberd text-[11px] font-medium tracking-wider">
                      {formatVerseRef({ book: question.book, chapter: question.chapter })}
                    </span>
                  </div>
                  <DifficultyBadge difficulty={question.difficulty} />
                </div>
                <h2
                  data-testid="daily-question-text"
                  className={`question-text font-headline ${mobileFontCls} md:text-4xl md:font-extrabold md:text-center tracking-tight leading-snug max-w-3xl text-bq-ink w-full`}
                >
                  {wrapProperNouns(question.content)}
                </h2>
                <div className="hidden md:flex mt-6 items-center gap-2 text-bq-ink3">
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {question.book}{question.chapter ? ` - ${t('quiz.chapter', { chapter: question.chapter })}` : ''}
                  </span>
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            {question.options.map((option, i) => {
              let state: AnswerState = 'default'
              // Only enter the reveal branch once the API has reported the
              // correct indices — otherwise the picked option flashes 'wrong'
              // (red + X badge) for ~100ms while `correctAnswerIndices` is
              // still []. Until then, show 'selected' (per-letter color +
              // glow) as click acknowledgment.
              if (answered && isCorrect !== null) {
                if (correctAnswerIndices.includes(i)) state = 'correct'
                else if (i === selectedAnswer) state = 'wrong'
                else state = 'disabled'
              } else if (i === selectedAnswer) {
                state = 'selected'
              }
              return (
                <AnswerButton
                  key={i}
                  index={i as 0 | 1 | 2 | 3}
                  letter={LETTERS[i] as 'A' | 'B' | 'C' | 'D'}
                  text={option}
                  state={state}
                  onClick={() => handleAnswer(i)}
                  testId={`daily-option-${i}`}
                  pickedByUser={i === selectedAnswer}
                />
              )
            })}
          </div>
        </div>

        {/* Fixed bottom dock for answered state. Combines the optional
            explanation pill/panel and the result bar in a single column
            so they share spacing and never overlap the answer grid. The
            pad-bottom on the wrapper above guarantees the last answer row
            scrolls clear of this dock. */}
        {answered && isCorrect !== null && (
          <div className="fixed bottom-[var(--mobile-nav-h)] md:bottom-10 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] max-w-lg flex flex-col items-center gap-2">
            {(!isCorrect || currentExplanation) && (
              explanationCollapsed ? (
                <button
                  data-testid="daily-explanation-pill"
                  type="button"
                  onClick={() => setExplanationCollapsed(false)}
                  className={`px-4 py-2 rounded-full bg-bq-white border text-xs font-bold flex items-center gap-2 shadow-bq-soft hover:scale-105 transition-transform ${
                    isCorrect ? 'border-bq-emerald/30 text-bq-emerald' : 'border-bq-ruby/30 text-bq-ruby'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={FILL_1}>lightbulb</span>
                  {t('quiz.showExplanationAgain', 'Xem giải thích')}
                </button>
              ) : (
                <div ref={explanationRef} className="w-full">
                  <div className={`bg-bq-white shadow-bq-soft p-5 rounded-2xl border space-y-3 max-h-[50vh] overflow-y-auto ${isCorrect ? 'border-bq-emerald/20' : 'border-bq-ruby/20'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!isCorrect && correctOptionText && (
                          <>
                            <span className="material-symbols-outlined text-bq-emerald text-sm flex-shrink-0" style={FILL_1}>check_circle</span>
                            <span className="text-sm font-bold text-bq-emerald truncate">
                              {t('quiz.correctAnswerIs', { answer: correctOptionText })}
                            </span>
                          </>
                        )}
                      </div>
                      <button
                        data-testid="daily-explanation-close"
                        type="button"
                        onClick={() => setExplanationCollapsed(true)}
                        className="text-bq-ink3 hover:text-bq-ink transition-colors -mr-1 flex-shrink-0"
                        aria-label={t('quiz.minimizeExplanation', 'Thu nhỏ')}
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                    {currentExplanation && (
                      <p className="text-bq-ink2 text-sm leading-relaxed flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-sm mt-0.5 text-bq-amberd">lightbulb</span>
                        <span>{currentExplanation}</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
            <div
              data-testid="daily-answer-feedback"
              className={`w-full bg-bq-white p-4 sm:p-5 rounded-3xl border shadow-bq-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${isCorrect ? 'border-bq-emerald/30' : 'border-bq-ruby/30'}`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-bq-emerald/15' : 'bg-bq-ruby/15'}`}>
                  <span
                    className={`material-symbols-outlined text-2xl ${isCorrect ? 'text-bq-emerald' : 'text-bq-ruby'}`}
                    style={FILL_1}
                  >{isCorrect ? 'verified' : 'cancel'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-bq-ink leading-tight">
                    {isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                  </p>
                  <p className={`text-xs font-medium leading-tight mt-0.5 ${isCorrect ? 'text-bq-emerald' : 'text-bq-ruby'}`}>
                    {t('daily.xpSoFar', { xp: dailyXp(results.filter(Boolean).length) })}
                  </p>
                </div>
              </div>
              <button
                data-testid="daily-next-btn"
                onClick={handleNext}
                className="bg-bq-action text-bq-ink px-6 sm:px-8 py-3 rounded-2xl font-black text-sm shadow-bq-action active:scale-95 transition-all hover:brightness-110 whitespace-nowrap w-full sm:w-auto"
              >
                {currentIndex + 1 >= totalQuestions ? t('daily.viewResult') : t('daily.nextQuestion')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── No data — only block when not completed; completed users still see hero ─
  if ((!challengeData || !Array.isArray(challengeData.questions) || challengeData.questions.length === 0) && !isCompleted) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-bq-inset rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-bq-ink2">hourglass_empty</span>
        </div>
        <h3 className="font-display text-2xl font-bold text-bq-ink">{t('daily.noQuestions')}</h3>
        <p className="text-bq-ink2">{t('daily.comeBackLater')}</p>
        <Link to="/" className="bg-bq-action text-bq-ink shadow-bq-action px-8 py-3 rounded-xl font-bold">{t('daily.home')}</Link>
      </div>
    )
  }

  // ─── Unified state-aware Landing ────────────────────────────────────────
  const questionCount = challengeData?.questionCount ?? challengeData?.questions?.length ?? 5
  const timeLimit = challengeData?.timeLimit ?? 5
  const seasonName = seasonQuery.data?.isActive ? seasonQuery.data.name : undefined

  const heroDone = isCompleted && dailyResult ? {
    correctCount: dailyResult.correctCount,
    totalQuestions: dailyResult.totalQuestions,
    score: dailyResult.score,
    xpEarned: dailyResult.xpEarned ?? 0,
    betterThanPercent: dailyResult.betterThanPercent,
    completedAt: typeof dailyResult.completedAt === 'number'
      ? new Date(dailyResult.completedAt).toISOString()
      : dailyResult.completedAt,
    timeSeconds: dailyResult.timeSeconds,
    rankGlobal: myGlobalRank ?? dailyResult.rankGlobal,
    resultsBreakdown: results.length === dailyResult.totalQuestions ? results : undefined,
  } : undefined

  return (
    <div data-testid="daily-page" className="max-w-5xl mx-auto p-2">
      <PageMeta
        title="Thử thách Kinh Thánh hàng ngày"
        description="5 câu hỏi Kinh Thánh mỗi ngày — thử sức với cộng đồng và chia sẻ kết quả."
        canonicalPath="/daily"
      />

      <PageHeader todayLabel={todayLabel} seasonName={seasonName} />

      <HeroCard
        state={isCompleted ? 'done' : 'ready'}
        questionCount={questionCount}
        timeLimit={timeLimit}
        yesterday={yesterdayQuery.data}
        onStart={handleStart}
        done={heroDone}
        onReview={() => setShowReviewModal(true)}
        onShare={() => setShowShareCard(true)}
        onDownload={() => setShowShareCard(true)}
      />

      {/* Leaderboard chỉ hiện ở State B (post-completion). Trên State A
          (chưa làm hôm nay), block "Bạn — Chưa làm hôm nay / 0 đ" là tín
          hiệu động lực ngược trước khi user kịp bấm Bắt đầu. Khi đã
          hoàn thành, surface ranking thật làm reward. */}
      {isCompleted ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 mb-7">
          <DailyLeaderboard
            entries={leaderboardEntries}
            myEntry={myEntry}
            myCompleted={isCompleted}
          />
          <StreakCard
            currentStreak={currentStreak}
            last7Days={last7Days}
            freezesPerWeek={freezesPerWeek}
          />
        </div>
      ) : (
        // State A: pair StreakCard with the 30-day heatmap side-by-side on
        // lg+ so the page doesn't read as a 3-row stack with mostly empty
        // horizontal space. Mobile stays vertical (default grid-cols-1).
        <div className={`grid grid-cols-1 ${historyDays.length > 0 ? 'lg:grid-cols-[2fr_3fr]' : ''} gap-5 mb-7`}>
          <StreakCard
            currentStreak={currentStreak}
            last7Days={last7Days}
            freezesPerWeek={freezesPerWeek}
          />
          {historyDays.length > 0 && <HeatmapCard days={historyDays} />}
        </div>
      )}

      {isCompleted && historyDays.length > 0 && (
        <div className="mb-7">
          <HeatmapCard days={historyDays} />
        </div>
      )}

      {/* Review modal — shows the 5 questions with correct answers + explanations.
          Backend reveals correctAnswer/explanation in GET /api/daily-challenge
          payload only when the user has already completed today. */}
      {showReviewModal && challengeData?.questions && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowReviewModal(false)}>
          <div className="max-w-2xl w-full bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-xl font-extrabold text-bq-ink flex items-center gap-2">
                <span className="material-symbols-outlined text-bq-amberd">visibility</span>
                {t('daily.review.title')}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-lg bg-bq-inset hover:bg-bq-hair grid place-items-center text-bq-ink2"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5">
              {challengeData.questions.map((q, idx) => {
                const correctIdx = q.correctAnswer?.[0] ?? -1
                const userGotIt = results[idx]
                return (
                  <div key={q.id} className="bg-bq-paper border border-bq-hair rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2 flex-1">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${
                          userGotIt === undefined
                            ? 'bg-bq-inset text-bq-ink2'
                            : userGotIt ? 'bg-bq-emerald/15 text-bq-emerald' : 'bg-bq-ruby/15 text-bq-ruby'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-bq-ink leading-relaxed">{q.content}</span>
                      </div>
                      <span className="text-[10px] text-bq-ink2 flex-shrink-0 px-2 py-0.5 rounded bg-bq-inset">
                        {q.book} {q.chapter}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = i === correctIdx
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 border ${
                              isCorrect
                                ? 'bg-bq-emerald/10 border-bq-emerald/30 text-bq-emerald'
                                : 'bg-bq-inset border-bq-hair text-bq-ink2'
                            }`}
                          >
                            <span className="font-bold">{LETTERS[i]}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span className="material-symbols-outlined text-sm">check_circle</span>}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <div className="text-xs text-bq-ink2 leading-relaxed bg-bq-amber/5 border-l-2 border-bq-amber/40 px-3 py-2 rounded">
                        <span className="material-symbols-outlined text-sm align-middle mr-1 text-bq-amberd">lightbulb</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareCard && dailyResult && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareCard(false)}>
          <div className="max-w-md w-full bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <ShareCard
              sessionId={dailyResult.sessionId ?? sessionId ?? ''}
              score={dailyResult.xpEarned ?? 0}
              correct={dailyResult.correctCount}
              total={dailyResult.totalQuestions}
              userName={userName ?? ''}
            />
            <button
              onClick={() => setShowShareCard(false)}
              className="block mx-auto mt-4 text-bq-ink2 hover:text-bq-ink transition-colors text-sm font-medium"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DailyChallenge
