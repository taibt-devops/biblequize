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
import { wrapProperNouns, getQuestionLengthClass } from '../utils/textHelpers'
import { useAuthStore } from '../store/authStore'
import { useBookName } from '../hooks/useBookName'
import { PageHeader } from './daily/PageHeader'
import { HeroCard } from './daily/HeroCard'
import { DailyLeaderboard, type DailyLbEntry } from './daily/DailyLeaderboard'
import { StreakCard } from './daily/StreakCard'
import { HeatmapCard, type HeatmapDay } from './daily/HeatmapCard'
import { PlaceBackdrop, Plaque, ScrollPanel } from '../components/lk/Place'

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
    <div className="relative max-w-5xl mx-auto p-2 space-y-6">
      <PlaceBackdrop place="post" veil="mid" />
      <PageHeader todayLabel={getTodayLabel(t)} />
      <div className="space-y-6 animate-pulse">
        <div className="h-80 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-bq" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
          <div className="h-96 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-bq" />
          <div className="h-96 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-bq" />
        </div>
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
  const getBookName = useBookName()

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
      <div data-testid="daily-error-state" className="relative max-w-md mx-auto py-16 px-4">
        <PlaceBackdrop place="post" veil="strong" />
        <div className="p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card space-y-4">
          <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="mx-auto h-32" />
          <p className="m-0 font-read text-[16px] text-bq-ink2">{error ?? t('daily.loadError')}</p>
          <button
            data-testid="daily-error-retry-btn"
            onClick={() => window.location.reload()}
            className="lk-btn text-bq-ink text-[16px]"
          >
            {t('common.retry')}
          </button>
        </div>
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
        <PlaceBackdrop place="post" veil="strong" />
        <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4">
          <Plaque as="h2" className="text-[20px] md:text-[26px]">
            <img src="/images/lk/dove-letter.webp" alt="" aria-hidden className="h-[1.3em] -my-1" />
            {t('daily.title')}
          </Plaque>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-bq-white border-2 border-bq-ink rounded-full text-[14px] font-extrabold tabular-nums">
              {t('quiz.question', { current: currentIndex + 1, total: totalQuestions })}
            </span>
            <span className="hidden sm:inline-block px-3 py-1 bg-bq-cream border-2 border-bq-ink rounded-full text-[13px] font-bold">
              {todayLabel}
            </span>
          </div>
        </div>

        {/* one stone per question: leaf = right, ruby = wrong, gold = now */}
        <div className="w-full flex gap-2 mb-6 md:mb-8">
          {Array.from({ length: totalQuestions }, (_, i) => (
            <div
              key={i}
              className={`h-4 flex-1 rounded-full border-2 border-bq-ink transition-colors duration-300 ${
                i < currentIndex
                  ? results[i] ? 'bg-bq-leaf' : 'bg-bq-ruby'
                  : i === currentIndex ? 'bg-bq-amber' : 'bg-bq-track'
              }`}
            />
          ))}
        </div>

        <div className="w-full space-y-5 md:space-y-8">
          {(() => {
            const lenClass = getQuestionLengthClass(question.content)
            const mobileFontCls =
              lenClass === 'short'  ? 'text-[22px] font-bold text-center' :
              lenClass === 'medium' ? 'text-[19px] font-bold text-center' :
                                      'text-[16px] font-semibold text-left'
            return (
              <ScrollPanel bodyClassName="px-5 md:px-12 py-6 md:py-9 text-center">
                <div data-question-length={lenClass} className="flex flex-col items-center">
                  <div className="flex items-center justify-center flex-wrap gap-2 mb-3 md:mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-bq-white border-2 border-bq-ink rounded-full text-[13px] font-extrabold">
                      <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-4" />
                      {getBookName(question.book)} {question.chapter}
                    </span>
                    <DifficultyBadge difficulty={question.difficulty} />
                  </div>
                  <h2
                    data-testid="daily-question-text"
                    className={`question-text m-0 font-read ${mobileFontCls} md:text-[30px] md:font-bold md:text-center leading-snug max-w-3xl text-bq-ink w-full`}
                  >
                    {wrapProperNouns(question.content)}
                  </h2>
                </div>
              </ScrollPanel>
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
                  className="px-4 py-1.5 rounded-full bg-bq-white border-2 border-bq-ink text-[14px] font-extrabold flex items-center gap-2 shadow-[0_3px_0_#1D2B22] active:translate-y-[3px] active:shadow-none"
                >
                  <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-5" />
                  {t('quiz.showExplanationAgain', 'Xem giải thích')}
                </button>
              ) : (
                <div ref={explanationRef} className="w-full">
                  <div className="bg-bq-white p-4 rounded-2xl border-[3px] border-bq-ink shadow-bq-card space-y-2.5 max-h-[50vh] overflow-y-auto">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {isCorrect && <span className="font-display text-[16px] font-extrabold">{t('daily.explanation')}</span>}
                        {!isCorrect && correctOptionText && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[13.5px] font-extrabold">
                            ✓ {t('quiz.lk.correctIs', { letter: LETTERS[correctAnswerIndices[0] ?? 0], answer: correctOptionText })}
                          </span>
                        )}
                      </div>
                      <button
                        data-testid="daily-explanation-close"
                        type="button"
                        onClick={() => setExplanationCollapsed(true)}
                        className="w-8 h-8 grid place-items-center rounded-full border-2 border-bq-ink bg-bq-paper text-bq-ink flex-shrink-0"
                        aria-label={t('quiz.minimizeExplanation', 'Thu nhỏ')}
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    {currentExplanation && (
                      <p className="m-0 font-read text-[15px] leading-relaxed text-bq-ink2">{currentExplanation}</p>
                    )}
                  </div>
                </div>
              )
            )}
            <div
              data-testid="daily-answer-feedback"
              className={`w-full p-3.5 sm:p-4 rounded-[22px] border-[3px] border-bq-ink shadow-bq-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isCorrect ? 'bg-bq-leaf' : 'bg-[#F9D9CF]'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-11 h-11 rounded-full border-[3px] border-bq-ink grid place-items-center text-[20px] font-extrabold flex-shrink-0 ${isCorrect ? 'bg-bq-white text-bq-emerald' : 'bg-bq-white text-bq-ruby'}`}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-display text-[19px] font-extrabold text-bq-ink leading-tight">
                    {isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                  </p>
                  <p className="m-0 text-[13.5px] font-bold leading-tight mt-0.5 text-bq-ink2">
                    {t('daily.xpSoFar', { xp: dailyXp(results.filter(Boolean).length) })}
                  </p>
                </div>
              </div>
              <button
                data-testid="daily-next-btn"
                onClick={handleNext}
                className="lk-btn w-full sm:w-auto whitespace-nowrap text-bq-ink text-[16px]"
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
      <div className="relative max-w-md mx-auto py-16 px-4">
        <PlaceBackdrop place="post" veil="strong" />
        <div className="p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card space-y-3">
          <img src="/images/lk/dove-perched.webp" alt="" aria-hidden className="mx-auto h-28" />
          <h3 className="m-0 font-display text-[24px] font-extrabold text-bq-ink">{t('daily.noQuestions')}</h3>
          <p className="m-0 font-read text-[15px] text-bq-ink2">{t('daily.comeBackLater')}</p>
          <Link to="/" className="lk-btn text-bq-ink text-[16px] no-underline">{t('daily.home')}</Link>
        </div>
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
    <div data-testid="daily-page" className="relative max-w-5xl mx-auto p-2">
      <PlaceBackdrop place="post" veil="mid" />
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
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] lg:items-start gap-5 mb-7">
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
        <div className={`grid grid-cols-1 ${historyDays.length > 0 ? 'lg:grid-cols-[2fr_3fr]' : ''} lg:items-start gap-5 mb-7`}>
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
          <div className="max-w-2xl w-full bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-5 md:p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <Plaque as="h3" className="text-[20px] md:text-[22px]">{t('daily.review.title')}</Plaque>
              <button
                onClick={() => setShowReviewModal(false)}
                aria-label={t('common.close')}
                className="w-10 h-10 grid place-items-center bg-bq-white border-[3px] border-bq-ink rounded-[12px] shadow-[0_3px_0_#1D2B22] active:translate-y-[3px] active:shadow-none"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              {challengeData.questions.map((q, idx) => {
                const correctIdx = q.correctAnswer?.[0] ?? -1
                const userGotIt = results[idx]
                return (
                  <div key={q.id} className="bg-bq-paper border-2 border-bq-ink rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 border-bq-ink grid place-items-center text-[13px] font-extrabold ${
                          userGotIt === undefined
                            ? 'bg-bq-white text-bq-ink'
                            : userGotIt ? 'bg-bq-leaf text-bq-ink' : 'bg-bq-ruby text-bq-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-read text-[15.5px] font-bold text-bq-ink leading-relaxed">{q.content}</span>
                      </div>
                      <span className="text-[12px] font-bold text-bq-ink2 flex-shrink-0 px-2 py-0.5 rounded-full bg-bq-white border-2 border-bq-ink/30">
                        {q.book} {q.chapter}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = i === correctIdx
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-xl text-[14px] flex items-start gap-2 border-2 ${
                              isCorrect
                                ? 'bg-bq-leaf border-bq-ink text-bq-ink font-bold'
                                : 'bg-bq-white border-bq-ink/15 text-bq-ink2'
                            }`}
                          >
                            <span className="font-extrabold">{LETTERS[i]}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span aria-hidden>✓</span>}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <div className="font-read text-[14px] text-bq-ink2 leading-relaxed bg-bq-cream border-2 border-dashed border-bq-ink/40 px-3 py-2 rounded-xl">
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
          <div className="max-w-md w-full bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-6" onClick={(e) => e.stopPropagation()}>
            <ShareCard
              sessionId={dailyResult.sessionId ?? sessionId ?? ''}
              score={dailyResult.xpEarned ?? 0}
              correct={dailyResult.correctCount}
              total={dailyResult.totalQuestions}
              userName={userName ?? ''}
            />
            <button
              onClick={() => setShowShareCard(false)}
              className="lk-btn !bg-bq-white mx-auto mt-4 !flex text-bq-ink text-[15px]"
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
