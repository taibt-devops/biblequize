import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import ShareCard from '../components/ShareCard'
import PageMeta from '../components/PageMeta'
import { getQuizLanguage } from '../utils/quizLanguage'
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton'
import { wrapProperNouns, formatVerseRef } from '../utils/textHelpers'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Question {
  id: string
  book: string
  chapter: number
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string
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
}

interface LeaderboardEntry {
  rank: number
  name: string
  group?: string
  score: number
  time: string
  avatar?: string
}

interface StreakData {
  currentStreak: number
  history: { date: string; completed: boolean }[]
}

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }
const LETTERS = ['A', 'B', 'C', 'D']

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatCountdown(diff: number): string {
  if (diff <= 0) return '00:00:00'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getToday(): string {
  return new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getLast7Days(t: (key: string) => string): { label: string; date: string; isToday: boolean }[] {
  const DAY_LABELS = [
    t('daily.daySun'), t('daily.dayMon'), t('daily.dayTue'),
    t('daily.dayWed'), t('daily.dayThu'), t('daily.dayFri'), t('daily.daySat'),
  ]
  const days: { label: string; date: string; isToday: boolean }[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push({
      label: i === 0 ? t('daily.today') : DAY_LABELS[d.getDay()],
      date: d.toISOString().split('T')[0],
      isToday: i === 0,
    })
  }
  return days
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-pulse">
      {/* Header skeleton */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-10 w-80 bg-surface-container-high rounded-lg" />
          <div className="h-4 w-40 bg-surface-container-high rounded" />
        </div>
        <div className="h-20 w-48 bg-surface-container-high rounded-2xl" />
      </section>

      {/* Hero skeleton */}
      <div className="h-80 bg-surface-container rounded-[2rem]" />

      {/* Stats skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-surface-container-high rounded-2xl" />
        ))}
      </section>

      {/* Bottom skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 h-80 bg-surface-container rounded-2xl" />
        <div className="lg:col-span-2 h-80 bg-surface-container rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────
const DailyChallenge: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [challengeData, setChallengeData] = useState<DailyChallengeData | null>(null)
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

  // Result state
  const [showResult, setShowResult] = useState(false)
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  const [showShareCard, setShowShareCard] = useState(false)

  // Landing page data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [streak, setStreak] = useState<StreakData | null>(null)

  // Countdown
  const [countdown, setCountdown] = useState('')

  const last7Days = useMemo(() => getLast7Days(t), [t])

  // ── Countdown timer to midnight (always running) ───────────────────────
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      setCountdown(formatCountdown(tomorrow.getTime() - now.getTime()))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Load daily challenge ────────────────────────────────────────────────
  useEffect(() => {
    const loadChallenge = async () => {
      try {
        const [challengeRes, leaderboardRes] = await Promise.allSettled([
          api.get(`/api/daily-challenge?language=${getQuizLanguage()}`),
          api.get('/api/leaderboard/daily'),
        ])

        if (challengeRes.status === 'fulfilled') {
          const data: DailyChallengeData = challengeRes.value.data
          setChallengeData(data)

          if (data.alreadyCompleted) {
            try {
              const resultRes = await api.get('/api/daily-challenge/result')
              const rd = resultRes.data
              setDailyResult({
                ...rd,
                totalQuestions: rd.totalQuestions > 0 ? rd.totalQuestions : (data.questionCount ?? data.questions?.length ?? 5),
              })
              setShowResult(true)
            } catch {
              // Result not available yet, show landing
            }
          }
        } else {
          setError(t('daily.loadError'))
        }

        if (leaderboardRes.status === 'fulfilled') {
          const lb = leaderboardRes.value.data
          if (Array.isArray(lb)) {
            setLeaderboard(lb.slice(0, 5))
          } else if (lb.entries) {
            setLeaderboard(lb.entries.slice(0, 5))
          }
          if (lb.streak) setStreak(lb.streak)
        }
      } catch (err) {
        console.error('Error loading daily challenge:', err)
        setError(t('daily.loadError'))
      } finally {
        setLoading(false)
      }
    }

    loadChallenge()
  }, [])

  // ── Start challenge ─────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!challengeData) return
    try {
      const startRes = await api.post('/api/daily-challenge/start')
      setSessionId(startRes.data.sessionId)
      setQuizStarted(true)
    } catch (err) {
      console.error('Error starting daily challenge:', err)
      setError(t('daily.startError'))
    }
  }, [challengeData])

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
      setResults(prev => [...prev, correct])
    } catch (error) {
      console.error('Error submitting answer:', error)
      setCorrectAnswerIndices([])
      setIsCorrect(false)
      setCurrentExplanation('')
      setResults(prev => [...prev, false])
    }
  }, [answered, challengeData, sessionId, currentIndex])

  // ── Next question ───────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!challengeData) return

    if (currentIndex + 1 >= challengeData.questions.length) {
      const correctCount = results.filter(Boolean).length
      const score = correctCount * 20

      // Persist completion server-side. Backend credits +50 XP into
      // UserDailyProgress the first time this fires per user per day
      // (idempotent via hasCompletedToday guard) — see DECISIONS.md
      // 2026-04-20 "Daily Challenge as secondary XP path".
      try {
        await api.post('/api/daily-challenge/complete', { score, correctCount })
      } catch (err) {
        console.error('Error marking daily completion:', err)
      }

      // Refresh server-derived views (Home tier progress, /api/me
      // counters, daily missions) so the new XP and mission status show immediately.
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['me-tier-progress'] })
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] })

      const XP_MIN_CORRECT = 4
      const localResult = {
        completed: true,
        score,
        correctCount,
        totalQuestions: challengeData.questions.length,
        xpEarned: correctCount >= XP_MIN_CORRECT ? 50 : 0,
        xpMinCorrect: XP_MIN_CORRECT,
        sessionId: sessionId || undefined,
      }
      try {
        const resultRes = await api.get('/api/daily-challenge/result')
        const api_data = resultRes.data
        // Merge: always trust local totalQuestions and correctCount when API
        // returns 0 (can happen if a previous broken session corrupted the DB row).
        setDailyResult({
          ...localResult,
          score: api_data.score ?? score,
          correctCount: api_data.correctCount > 0 ? api_data.correctCount : correctCount,
          totalQuestions: api_data.totalQuestions > 0 ? api_data.totalQuestions : challengeData.questions.length,
        })
      } catch {
        setDailyResult(localResult)
      }
      setShowResult(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setSelectedAnswer(null)
      setAnswered(false)
      setIsCorrect(null)
      setCurrentExplanation('')
      setCorrectAnswerIndices([])
    }
  }, [challengeData, currentIndex, results, sessionId, queryClient])

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingSkeleton />
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error && !challengeData) {
    return (
      <div data-testid="daily-error-state" className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-error-container/20 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-error">error</span>
        </div>
        <p className="text-on-surface-variant text-lg">{error}</p>
        <button
          data-testid="daily-error-retry-btn"
          onClick={() => window.location.reload()}
          className="gold-gradient px-8 py-3 rounded-xl text-on-secondary font-bold transition-all hover:scale-[1.02] active:scale-95"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  // ─── Result Screen ─────────────────────────────────────────────────────
  if (showResult && dailyResult) {
    const correctCount = dailyResult.correctCount ?? 0
    const totalQuestions = dailyResult.totalQuestions ?? 0
    const wrongCount = totalQuestions - correctCount
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const resultSessionId = dailyResult.sessionId || sessionId || ''
    const xpEarned = dailyResult.xpEarned ?? 0
    const xpMinCorrect = dailyResult.xpMinCorrect ?? 4

    const perfLabel =
      percentage === 100 ? t('daily.perf.perfect')
      : percentage >= 80  ? t('daily.perf.excellent')
      : percentage >= 60  ? t('daily.perf.good')
      : t('daily.perf.tryAgain')

    const ringRadius = 88
    const ringCircumference = 2 * Math.PI * ringRadius
    const ringOffset = ringCircumference - (percentage / 100) * ringCircumference

    const perfColor =
      percentage === 100 ? 'text-yellow-400'
      : percentage >= 80  ? 'text-[#4ade80]'
      : percentage >= 60  ? 'text-secondary'
      : 'text-error'

    return (
      <main data-testid="daily-completed-badge" className="max-w-md mx-auto w-full flex flex-col items-center gap-8 py-8">

        {/* Score circle */}
        <section className="relative flex flex-col items-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-surface-container-highest" />
              <circle cx="80" cy="80" r="70" fill="transparent" stroke="url(#dailyGoldGrad)" strokeWidth="12" strokeLinecap="round"
                style={{ strokeDasharray: ringCircumference, strokeDashoffset: ringOffset, transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease-out' }} />
              <defs>
                <linearGradient id="dailyGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8a832" />
                  <stop offset="100%" stopColor="#e7c268" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span data-testid="daily-score-display" className="text-4xl font-extrabold tracking-tighter text-on-surface">{correctCount}/{totalQuestions}</span>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-secondary font-bold text-lg uppercase tracking-widest">{percentage}%</p>
            <h1 className={`text-3xl font-black mt-1 ${perfColor}`}>{perfLabel}</h1>
            <p className="text-on-surface-variant text-sm mt-1">{t('daily.completedMessage')}</p>
          </div>
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="glass-card rounded-2xl py-4 px-2 flex flex-col items-center text-center border border-white/5">
            <span className="material-symbols-outlined text-[#4ade80] mb-1" style={FILL_1}>check_circle</span>
            <span className="text-lg font-black text-[#4ade80]">{correctCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-[#4ade80]/60 font-bold">{t('daily.correct')}</span>
          </div>
          <div className="glass-card rounded-2xl py-4 px-2 flex flex-col items-center text-center border border-white/5">
            <span className="material-symbols-outlined text-error mb-1" style={FILL_1}>cancel</span>
            <span className="text-lg font-black text-error">{wrongCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-error/60 font-bold">{t('daily.wrong')}</span>
          </div>
          <div data-testid="daily-xp-earned" className="glass-card rounded-2xl py-4 px-2 flex flex-col items-center text-center border border-white/5">
            <span className={`material-symbols-outlined mb-1 ${xpEarned > 0 ? 'text-secondary' : 'text-on-surface-variant/40'}`} style={FILL_1}>bolt</span>
            <span className={`text-lg font-black ${xpEarned > 0 ? 'text-secondary' : 'text-on-surface-variant/40'}`}>+{xpEarned}</span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${xpEarned > 0 ? 'text-secondary/60' : 'text-on-surface-variant/30'}`}>XP</span>
          </div>
        </div>

        {/* Star rating */}
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: totalQuestions || 5 }, (_, i) => (
            <span
              key={i}
              className={`material-symbols-outlined text-3xl transition-transform ${i < correctCount ? 'text-secondary scale-110' : 'text-outline-variant/20'}`}
              style={i < correctCount ? FILL_1 : undefined}
            >star</span>
          ))}
        </div>

        {/* XP notice */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${xpEarned > 0 ? 'bg-secondary/10 border-secondary/20 text-secondary font-bold' : 'bg-outline-variant/10 border-outline-variant/20 text-on-surface-variant/60'}`}>
          <span className="material-symbols-outlined text-base" style={xpEarned > 0 ? FILL_1 : undefined}>bolt</span>
          {xpEarned > 0 ? t('daily.xpEarned') : t('daily.xpNotEarned', { min: xpMinCorrect, total: totalQuestions || 5 })}
        </div>

        {/* Countdown */}
        <div className="glass-card w-full rounded-2xl p-4 border border-white/5 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-on-surface-variant/60">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span>{getToday()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">{t('daily.refreshIn')}</span>
            <span className="font-mono font-black text-secondary tracking-widest">{countdown}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => setShowShareCard(true)}
            className="w-full gold-gradient py-4 rounded-xl font-black text-on-secondary shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined">share</span>
            {t('daily.shareResult')}
          </button>
          <div className="flex gap-3 w-full">
            <Link
              to="/leaderboard"
              className="flex-1 glass-card py-4 rounded-xl font-bold text-on-surface flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all border border-white/5"
            >
              <span className="material-symbols-outlined text-sm">leaderboard</span>
              {t('daily.leaderboard')}
            </Link>
            <Link
              to="/"
              className="flex-1 glass-card py-4 rounded-xl font-bold text-on-surface flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all border border-white/5"
            >
              <span className="material-symbols-outlined text-sm">home</span>
              {t('daily.home')}
            </Link>
          </div>
        </div>

        {/* Share Card */}
        {showShareCard && resultSessionId && (
          <div className="w-full glass-card rounded-2xl border border-white/5 p-6">
            <ShareCard
              sessionId={resultSessionId}
              score={dailyResult.score}
              correct={correctCount}
              total={totalQuestions}
              userName=""
            />
            <button
              onClick={() => setShowShareCard(false)}
              className="block mx-auto mt-4 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium"
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </main>
    )
  }

  // ─── Quiz View ──────────────────────────────────────────────────────────
  if (quizStarted && challengeData && challengeData.questions.length > 0) {
    const question = challengeData.questions[currentIndex]
    const totalQuestions = challengeData.questions.length
    const correctOptionText = question.options[correctAnswerIndices[0] ?? -1] ?? ''

    return (
      <main className="relative min-h-screen pt-6 pb-12 px-6 flex flex-col items-center justify-center max-w-5xl mx-auto">

        {/* Header: title + progress + date */}
        <div className="w-full flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-on-surface">{t('daily.title')}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{t('quiz.question', { current: currentIndex + 1, total: totalQuestions })}</p>
          </div>
          <div className="bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant/10 text-sm font-mono font-bold text-secondary">
            {getToday()}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full flex gap-2 mb-10">
          {Array.from({ length: totalQuestions }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < currentIndex
                  ? results[i] ? 'bg-green-500' : 'bg-red-500'
                  : i === currentIndex ? 'bg-secondary' : 'bg-outline-variant/20'
              }`}
            />
          ))}
        </div>

        <div className="w-full space-y-16">
          {/* Question Card — matches Quiz page layout exactly */}
          <div className="relative w-full aspect-[16/9] md:aspect-[21/7] flex flex-col items-center justify-center text-center p-10 bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 shadow-2xl overflow-hidden">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-32 bg-secondary rounded-r-full" />

            {/* Verse badge */}
            <div className="inline-flex items-center gap-1.5 bg-secondary/10 border border-secondary/20 rounded-full px-3 py-1 mb-4">
              <span className="material-symbols-outlined text-secondary text-xs">menu_book</span>
              <span className="text-secondary text-[11px] font-medium tracking-wider">
                {formatVerseRef({ book: question.book, chapter: question.chapter })}
              </span>
            </div>

            <h2
              data-testid="daily-question-text"
              className="question-text font-headline text-2xl md:text-4xl font-extrabold tracking-tight leading-snug max-w-3xl text-on-surface"
            >
              {wrapProperNouns(question.content)}
            </h2>

            <div className="mt-6 flex items-center gap-2 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              <span className="text-xs font-bold uppercase tracking-widest">
                {question.book}{question.chapter ? ` - ${t('quiz.chapter', { chapter: question.chapter })}` : ''}
              </span>
            </div>
          </div>

          {/* Answers grid — 2 columns on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {question.options.map((option, i) => {
              let state: AnswerState = 'default'
              if (answered) {
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
                />
              )
            })}
          </div>
        </div>

        {/* Explanation panel — fixed above feedback bar, only when wrong */}
        {answered && (!isCorrect || currentExplanation) && (
          <div className="fixed bottom-48 sm:bottom-36 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-3rem)] max-w-lg">
            <div className={`glass-panel p-5 rounded-2xl border space-y-3 max-h-[50vh] overflow-y-auto ${isCorrect ? 'border-green-500/20' : 'border-error/20'}`}>
              {!isCorrect && correctOptionText && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-400 text-sm" style={FILL_1}>check_circle</span>
                  <span className="text-sm font-bold text-green-400">
                    {t('quiz.correctAnswerIs', { answer: correctOptionText })}
                  </span>
                </div>
              )}
              {currentExplanation && (
                <p className="text-on-surface-variant text-sm leading-relaxed flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-sm mt-0.5 text-secondary/60">lightbulb</span>
                  <span>{currentExplanation}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Feedback bar — fixed bottom, identical to Quiz page */}
        {answered && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-lg">
            <div
              data-testid="daily-answer-feedback"
              className="bg-surface-container-highest p-4 sm:p-5 rounded-3xl border border-secondary/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 glass-panel"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-secondary/20' : 'bg-error/20'}`}>
                  <span
                    className={`material-symbols-outlined text-2xl ${isCorrect ? 'text-secondary' : 'text-error'}`}
                    style={FILL_1}
                  >{isCorrect ? 'verified' : 'cancel'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-on-surface leading-tight">
                    {isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                  </p>
                  <p className={`text-xs font-medium leading-tight mt-0.5 ${isCorrect ? 'text-secondary/80' : 'text-error/80'}`}>
                    {isCorrect ? t('quiz.bonusPoints', { points: 20 }) : t('quiz.noPoints')}
                  </p>
                </div>
              </div>
              <button
                data-testid="daily-next-btn"
                onClick={handleNext}
                className="bg-gradient-to-r from-secondary to-tertiary text-on-secondary px-6 sm:px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all hover:brightness-110 whitespace-nowrap w-full sm:w-auto"
              >
                {currentIndex + 1 >= totalQuestions ? t('daily.viewResult') : t('daily.nextQuestion')}
              </button>
            </div>
          </div>
        )}
      </main>
    )
  }

  // ─── No data ────────────────────────────────────────────────────────────
  if (!challengeData || challengeData.questions.length === 0) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">hourglass_empty</span>
        </div>
        <h3 className="text-2xl font-bold text-on-surface">{t('daily.noQuestions')}</h3>
        <p className="text-on-surface-variant">{t('daily.comeBackLater')}</p>
        <Link
          to="/"
          className="gold-gradient px-8 py-3 rounded-xl text-on-secondary font-bold transition-all hover:scale-[1.02] active:scale-95"
        >
          {t('daily.home')}
        </Link>
      </div>
    )
  }

  // ─── Landing Page (before quiz starts) ─────────────────────────────────
  const completedDates = new Set(
    streak?.history?.filter((h) => h.completed).map((h) => h.date) ?? []
  )
  const currentStreak = streak?.currentStreak ?? 0
  const challengeTitle = challengeData.title ?? t('daily.defaultTitle')
  const challengeDesc = challengeData.description ?? t('daily.defaultDesc')
  const questionCount = challengeData.questionCount ?? challengeData.questions.length
  const timeLimit = challengeData.timeLimit ?? 5

  return (
    <div data-testid="daily-page" className="max-w-5xl mx-auto space-y-12">
      <PageMeta
        title="Thu thach hang ngay"
        description="5 cau hoi Kinh Thanh moi ngay — thu suc voi cong dong va chia se ket qua."
        canonicalPath="/daily"
      />
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface">{t('daily.title')}</h2>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span className="text-sm font-medium">{getToday()}</span>
          </div>
        </div>
        <div data-testid="daily-countdown" className="bg-surface-container-high px-6 py-3 rounded-2xl border border-secondary/20 gold-glow flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">{t('daily.refreshIn')}</span>
          <div className="font-mono text-2xl font-black text-secondary tracking-widest">
            {countdown}
          </div>
        </div>
      </section>

      {/* Hero Challenge Card */}
      <section className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-secondary/20 via-tertiary/20 to-secondary/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
        <div className="relative bg-surface-container border border-outline-variant/30 rounded-[2rem] overflow-hidden p-10 flex flex-col items-center text-center space-y-8">
          <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-secondary" style={FILL_1}>local_fire_department</span>
          </div>
          <div className="space-y-4">
            {!challengeData.alreadyCompleted && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-error-container/20 border border-error/20">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-error">{t('daily.notCompleted')}</span>
              </div>
            )}
            <h3 className="text-3xl font-bold text-on-surface leading-tight">{challengeTitle}</h3>
            <p className="text-on-surface-variant max-w-md mx-auto leading-relaxed">
              {challengeDesc}
            </p>
            <div className="flex items-center justify-center gap-6 text-sm font-medium text-on-surface-variant/80">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">quiz</span> {t('daily.questionCount', { count: questionCount })}
              </span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">timer</span> {t('daily.timeLimit', { minutes: timeLimit })}
              </span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">public</span> {t('daily.everyone')}
              </span>
            </div>
          </div>
          <button
            data-testid="daily-start-btn"
            onClick={handleStart}
            className="gold-gradient px-12 py-5 rounded-2xl text-on-secondary font-black text-lg shadow-lg hover:shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            {t('daily.startChallenge')}
          </button>
        </div>
      </section>

      {/* Bottom Layout: Leaderboard & History */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Leaderboard Preview */}
        <section data-testid="daily-leaderboard" className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-bold text-on-surface">{t('daily.todayLeaderboard')}</h4>
            <Link to="/leaderboard" className="text-secondary text-sm font-bold flex items-center gap-1 hover:underline">
              {t('daily.viewFull')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/5 overflow-hidden">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-30">leaderboard</span>
                <p className="text-sm">{t('daily.noOneCompleted')}</p>
              </div>
            ) : (
              leaderboard.map((entry, idx) => (
                <div
                  key={entry.rank}
                  data-testid="daily-leaderboard-row"
                  className={`flex items-center justify-between p-4 transition-colors ${
                    idx === 0
                      ? 'bg-secondary/5 hover:bg-secondary/10'
                      : 'hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-6 text-center font-black ${idx === 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {entry.rank}
                    </span>
                    <div className={`w-10 h-10 rounded-full overflow-hidden ${
                      idx === 0 ? 'border-2 border-secondary' : 'border border-outline-variant/30'
                    }`}>
                      {entry.avatar ? (
                        <img alt="Avatar" className="w-full h-full object-cover" src={entry.avatar} />
                      ) : (
                        <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant">person</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">{entry.name}</p>
                      {entry.group && (
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase">{entry.group}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${idx === 0 ? 'text-secondary' : 'text-on-surface'}`}>{entry.score}</p>
                    {entry.time && (
                      <p className="text-[10px] text-on-surface-variant font-medium">{entry.time}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* History Strip & Streak */}
        <section className="lg:col-span-2 space-y-6">
          <h4 className="text-xl font-bold text-on-surface">{t('daily.historyAndStreak')}</h4>
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 p-6 space-y-8">
            {/* Streak info */}
            <div data-testid="daily-streak-display" className="flex items-center gap-4">
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary relative">
                <span className="material-symbols-outlined text-4xl" style={FILL_1}>local_fire_department</span>
                {currentStreak > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-secondary text-on-secondary text-[10px] font-black rounded-full flex items-center justify-center border-4 border-surface-container">
                    {currentStreak}
                  </div>
                )}
              </div>
              <div>
                <p className="text-lg font-black text-on-surface">
                  {currentStreak > 0 ? t('daily.streakDays', { count: currentStreak }) : t('daily.startNewStreak')}
                </p>
                <p className="text-xs text-on-surface-variant font-medium">
                  {currentStreak > 0
                    ? t('daily.streakCompleted', { count: currentStreak })
                    : t('daily.completeToStart')
                  }
                </p>
              </div>
            </div>

            {/* Calendar strip */}
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">{t('daily.last7Days')}</p>
              <div className="flex justify-between items-center px-1">
                {last7Days.map((day) => {
                  const completed = completedDates.has(day.date)
                  const isFuture = !day.isToday && new Date(day.date) > new Date()

                  return (
                    <div key={day.date} className={`flex flex-col items-center gap-2 ${isFuture ? 'opacity-40' : ''}`}>
                      <span className={`text-[10px] font-bold ${day.isToday ? 'text-secondary' : 'text-on-surface-variant'}`}>
                        {day.label}
                      </span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        day.isToday && !completed
                          ? 'bg-surface-container-highest border-2 border-dashed border-secondary/50'
                          : completed
                            ? 'bg-surface-container-high border border-outline-variant/20'
                            : 'bg-surface-container-high border border-outline-variant/20'
                      }`}>
                        {completed && (
                          <span className="material-symbols-outlined text-sm text-secondary" style={FILL_1}>check_circle</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bible verse */}
            <div className="p-4 bg-primary-container/20 rounded-xl border border-primary/10">
              <p className="text-[11px] leading-relaxed italic text-on-primary-container">
                {t('daily.bibleVerse')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default DailyChallenge
