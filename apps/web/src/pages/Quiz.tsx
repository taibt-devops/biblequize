import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import { useLifeline } from '../hooks/useLifeline'
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton'
import LampTimer from '../components/quiz/LampTimer'
import QuizTopBar from '../components/quiz/QuizTopBar'
import QuizFeedback from '../components/quiz/QuizFeedback'
import DifficultyBadge from '../components/DifficultyBadge'
import { wrapProperNouns, formatVerseRef, getQuestionLengthClass } from '../utils/textHelpers'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useToast } from '../hooks/useToast'
import { useBookName } from '../hooks/useBookName'
import QuizResults from './QuizResults'
import RankedQuizResults from './RankedQuizResults'

interface Question {
  id: string
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: string
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string
}

interface QuizStats {
  totalScore: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  averageTime: number
  totalTime: number
  difficultyBreakdown: {
    easy: { correct: number; total: number; score: number }
    medium: { correct: number; total: number; score: number }
    hard: { correct: number; total: number; score: number }
  }
  timePerQuestion: number[]
  questions: Question[]
  userAnswers: (number | null)[]
  questionScores: number[]
}

interface QuizPageSettings {
  sessionId?: string
  questions?: Question[]
  mode?: string
  book?: string
  difficulty?: string
  showExplanation?: boolean
  isRanked?: boolean
  timePerQuestion?: number
  previousTier?: {
    level: number
    name: string
    totalPoints: number
    nextTierPoints: number
  } | null
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']
const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const
const DEFAULT_TIMER = 30
const ENERGY_MAX = 100
const PRACTICE_LIVES_MAX = 5

export function computeEnergyPercent(
  energy: number | null | undefined,
  lives: number,
  livesMax: number = PRACTICE_LIVES_MAX
): number {
  if (energy != null) {
    return Math.max(0, Math.min(100, (Math.max(0, energy) / ENERGY_MAX) * 100))
  }
  if (livesMax <= 0) return 0
  return Math.max(0, Math.min(100, (lives / livesMax) * 100))
}

const Quiz: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  // Localize Bible book names (English keys → Vietnamese display, e.g.
  // "Exodus" → "Xuất Ê-díp-tô Ký"). Falls back to the English key.
  const getBookName = useBookName()
  const bookLang = getQuizLanguage()
  const settings = location.state as QuizPageSettings | null
  const timerLimit = settings?.timePerQuestion ?? DEFAULT_TIMER
  // Practice is for-fun: no energy / lives gauge. Energy only relevant for
  // Ranked (server-driven) and any future modes that consume lives.
  const isPracticeMode = !settings?.mode || settings.mode === 'practice'

  /** Where the close (×) button + "back to mode" link should send the user.
   *  Each mode entry returns to its own start page so users don't get dumped
   *  on /practice after a mystery/speed quiz they launched from Home. */
  const quitPath: string = (() => {
    if (settings?.isRanked || settings?.mode === 'ranked') return '/ranked'
    if (settings?.mode === 'mystery_mode') return '/mystery-mode'
    if (settings?.mode === 'speed_round')  return '/speed-round'
    return '/practice'
  })()

  /** PlayAgain refetch — variety modes need fresh random questions on replay
   *  ("Random hoàn toàn" promise). Other modes reuse the original set. */
  const refetchVarietyQuestions = async (): Promise<Question[] | null> => {
    try {
      if (settings?.mode === 'mystery_mode') {
        const r = await api.post('/api/quiz/mystery')
        return (r.data?.questions as Question[]) ?? null
      }
      if (settings?.mode === 'speed_round') {
        const r = await api.get('/api/quiz/speed-round')
        return (r.data?.questions as Question[]) ?? null
      }
    } catch { /* fall through — reuse original questions */ }
    return null
  }

  /** Ranked "Chơi trận khác" — a replay must be a brand-new match: a fresh
   *  session + freshly-selected questions (excluding today's asked IDs).
   *  Reusing location.state.questions replayed the same 10 (user report
   *  2026-05-22). Mirrors Ranked.tsx startRankedQuiz. */
  const startNextRankedMatch = async (): Promise<QuizPageSettings | null> => {
    try {
      const language = getQuizLanguage()
      const statusRes = await api.get('/api/me/ranked-status')
      const status = statusRes.data
      const sessRes = await api.post('/api/ranked/sessions', { language })
      const newSessionId = sessRes.data?.sessionId
      if (!newSessionId) return null
      const serverAskedIds: string[] = status?.askedQuestionIdsToday ?? []
      const localAskedIds: string[] = (() => {
        try { return JSON.parse(localStorage.getItem('askedQuestionIds') || '[]') } catch { return [] }
      })()
      const excludeIds = Array.from(new Set<string>([...serverAskedIds, ...localAskedIds]))
      const pickRes = await api.post('/api/ranked/questions/select', {
        limit: 10,
        excludeIds,
        // Option C: ~70% current journey book, ~30% whole-pool variety.
        book: status?.currentBook,
        difficulty: status?.currentDifficulty,
        language,
      })
      const freshQuestions: Question[] = pickRes.data?.questions ?? []
      if (pickRes.data?.poolExhausted === true || freshQuestions.length === 0) return null
      let previousTier: QuizPageSettings['previousTier'] = null
      try {
        const tp = await api.get('/api/me/tier-progress')
        previousTier = tp.data ? {
          level: tp.data.tierLevel,
          name: tp.data.tierName,
          totalPoints: tp.data.totalPoints,
          nextTierPoints: tp.data.nextTierPoints,
        } : null
      } catch { /* tier-up detection best-effort */ }
      return {
        sessionId: newSessionId,
        mode: 'ranked',
        questions: freshQuestions,
        showExplanation: false,
        isRanked: true,
        timePerQuestion: 90,
        previousTier,
      }
    } catch {
      return null
    }
  }

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [combo, setCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(5)
  const [serverEnergy, setServerEnergy] = useState<number | null>(null)
  // §7.1.5 — Liturgical week completion captured during the 10-question batch,
  // surfaced on the RankedQuizResults screen (Option B — no mid-quiz interrupt).
  const [weekCompletion, setWeekCompletion] = useState<{
    completedWeek: number
    nextWeekBooks: string[]
  } | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [timeLeft, setTimeLeft] = useState(timerLimit)
  const [isQuizCompleted, setIsQuizCompleted] = useState(false)
  // BL-26 B: end-of-match accuracy bonus returned by /match-complete (server
  // recomputes from its own counters and credits it once).
  const [matchBonus, setMatchBonus] = useState<{ bonusPoints: number; bonusPercent: number; accuracy: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quizStats, setQuizStats] = useState<QuizStats>({
    totalScore: 0,
    correctAnswers: 0,
    totalQuestions: 0,
    accuracy: 0,
    averageTime: 0,
    totalTime: 0,
    difficultyBreakdown: {
      easy: { correct: 0, total: 0, score: 0 },
      medium: { correct: 0, total: 0, score: 0 },
      hard: { correct: 0, total: 0, score: 0 }
    },
    timePerQuestion: [],
    questions: [],
    userAnswers: [],
    questionScores: []
  })
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now())
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([])
  const [questionScores, setQuestionScores] = useState<number[]>([])
  const [lastQuestionScore, setLastQuestionScore] = useState(0)
  // Ranked XP is server-authoritative: the reveal (showResult) flips instantly
  // on tap, but `earned` only lands after the /answer roundtrip. Without this
  // flag the score line renders "+0" for one frame before the real value, so
  // gate it: while pending, show a "scoring…" placeholder instead of "+0".
  const [scorePending, setScorePending] = useState(false)
  const [showCombo, setShowCombo] = useState(false)
  const [answerAnim, setAnswerAnim] = useState<'correct' | 'wrong' | null>(null)
  const [scorePopping, setScorePopping] = useState(false)
  // Feedback card: brought into view on reveal (desktop card sits under the answers).
  const feedbackRef = useRef<HTMLElement | null>(null)

  const currentQuestion = questions[currentQuestionIndex]
  const progressPercent = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0
  const questionLenClass = getQuestionLengthClass(currentQuestion?.content)

  // Lifeline (hint) integration. Disabled when there's no backend session
  // (guest / practice-without-session mode) or when the user is on the
  // results screen. Tied to the current questionId so eliminated-options
  // reset automatically when the user advances.
  const lifeline = useLifeline({
    sessionId: settings?.sessionId,
    questionId: currentQuestion?.id,
    enabled: !!settings?.sessionId && !isQuizCompleted,
  })

  useEffect(() => {
    const fetchBackendStats = async () => {
      if (!settings?.sessionId) return
      try {
        const res = await api.get(`/api/sessions/${settings.sessionId}/review`)
        const serverStats = res.data?.stats
        if (serverStats) {
          setQuizStats(prev => ({
            ...prev,
            totalScore: serverStats.totalScore ?? prev.totalScore,
            correctAnswers: serverStats.correctAnswers ?? prev.correctAnswers,
            totalQuestions: serverStats.totalQuestions ?? prev.totalQuestions,
            accuracy: serverStats.accuracy ?? prev.accuracy,
            averageTime: serverStats.averageTime ?? prev.averageTime,
            totalTime: serverStats.totalTime ?? prev.totalTime,
            difficultyBreakdown: serverStats.difficultyBreakdown ?? prev.difficultyBreakdown,
            timePerQuestion: serverStats.timePerQuestion ?? prev.timePerQuestion
          }))
        }
      } catch (e) {
        console.error('Failed to load backend review stats', e)
      }
    }
    if (isQuizCompleted) {
      fetchBackendStats()
    }
  }, [isQuizCompleted, settings?.sessionId])

  useEffect(() => {
    if (timeLeft > 0 && !showResult && !isQuizCompleted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !showResult) {
      handleAnswerSelect(-1)
    }
  }, [timeLeft, showResult, isQuizCompleted])

  // Timer warning sounds
  useEffect(() => {
    if (showResult || isQuizCompleted) return
    if (timeLeft <= 5 && timeLeft > 0) {
      soundManager.play('timerTick')
      if (timeLeft <= 3) {
        haptic.timerWarning()
      }
    }
  }, [timeLeft, showResult, isQuizCompleted])

  // Invalidate the /api/me cache when a quiz finishes so Home.tsx picks
  // up the updated practiceCorrectCount/practiceTotalCount/earlyRankedUnlock
  // flag — otherwise the locked Ranked card keeps showing stale "0/0 đúng"
  // until the 5-minute staleTime expires. Covers all modes (Practice
  // updates early-unlock counters; Ranked/others can bump streaks/XP).
  useEffect(() => {
    if (isQuizCompleted) {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['me-tier-progress'] })
    }
  }, [isQuizCompleted, queryClient])

  useEffect(() => {
    if (showResult) feedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [showResult])

  useEffect(() => {
    const boot = () => {
      try {
        setIsLoading(true)
        // Full reset so a re-navigation to /quiz (ranked "Chơi trận khác")
        // starts a clean match instead of inheriting the finished one.
        setIsQuizCompleted(false)
        setCurrentQuestionIndex(0)
        setSelectedAnswer(null)
        setShowResult(false)
        setIsCorrect(null)
        setCombo(0)
        setScore(0)
        setCorrectAnswers(0)
        setLives(PRACTICE_LIVES_MAX)
        setLastQuestionScore(0)
        setWeekCompletion(null)
        const initialQuestions = settings?.questions || []
        if (initialQuestions.length > 0) {
          setQuestions(initialQuestions)
          setTimeLeft(timerLimit)
          setQuizStartTime(Date.now())
          setQuizStats(prev => ({
            ...prev,
            totalQuestions: initialQuestions.length,
            questions: initialQuestions
          }))
          setUserAnswers(new Array(initialQuestions.length).fill(null))
          setQuestionScores(new Array(initialQuestions.length).fill(0))
          if (settings?.mode === 'ranked') {
            try {
              const snap = JSON.parse(localStorage.getItem('rankedStatus') || localStorage.getItem('rankedSnapshot') || 'null')
              const v = snap?.livesRemaining
              setServerEnergy(typeof v === 'number' ? Math.max(0, Math.min(ENERGY_MAX, v)) : ENERGY_MAX)
            } catch {
              setServerEnergy(ENERGY_MAX)
            }
          }
        } else {
          showToast({ type: 'error', message: t('quiz.noQuestions') })
          navigate('/practice')
        }
      } finally {
        setIsLoading(false)
      }
    }
    if (settings) boot(); else navigate('/practice')
  }, [settings, navigate])

  // BL-26 B: when a Ranked match ends, ask the server for the accuracy bonus.
  // The server recomputes from its own per-match counters and credits it once
  // (idempotent). Without this call the bonus never triggers. Best-effort —
  // a failure just hides the bonus line on the results screen.
  useEffect(() => {
    if (!isQuizCompleted) return
    const ranked = settings?.isRanked || settings?.mode === 'ranked'
    if (!ranked || !settings?.sessionId) return
    let cancelled = false
    api.post(`/api/ranked/sessions/${settings.sessionId}/match-complete`)
      .then(res => {
        if (cancelled) return
        const d = res.data || {}
        setMatchBonus({
          bonusPoints: Number(d.bonusPoints) || 0,
          bonusPercent: Number(d.bonusPercent) || 0,
          accuracy: Number(d.accuracy) || 0,
        })
      })
      .catch(() => { /* non-critical */ })
    return () => { cancelled = true }
  }, [isQuizCompleted, settings?.isRanked, settings?.mode, settings?.sessionId])

  const handleAnswerSelect = async (answerIndex: number) => {
    if (showResult) return

    setSelectedAnswer(answerIndex)
    setShowResult(true)
    // Batched with setShowResult so the very first feedback render already
    // hides the "+0" frame until the server-side `earned` settles below.
    setScorePending(true)

    const timeTaken = timerLimit - timeLeft
    let correct = answerIndex === (currentQuestion.correctAnswer?.[0] ?? -1)
    setIsCorrect(correct)
    let rankedResponse: Record<string, unknown> | null = null

    try {
      if (settings?.mode === 'ranked' && settings?.sessionId) {
        const res = await api.post(`/api/ranked/sessions/${settings.sessionId}/answer`, {
          questionId: currentQuestion.id,
          answer: answerIndex,
          clientElapsedMs: (timerLimit - timeLeft) * 1000
        })

        const data = res.data
        rankedResponse = data
        correct = answerIndex === (currentQuestion.correctAnswer?.[0] ?? -1)

        // §7.1.5 — capture week completion (fires once per week, on any
        // question of the batch). Held in state until results render.
        if (data?.weekCompleted === true) {
          setWeekCompletion({
            completedWeek: Number(data.completedWeek),
            nextWeekBooks: Array.isArray(data.nextWeekBooks) ? data.nextWeekBooks : [],
          })
        }

        try {
          const today = new Date().toISOString().slice(0, 10)
          const currentAskedIds = JSON.parse(localStorage.getItem('askedQuestionIds') || '[]')
          if (!currentAskedIds.includes(currentQuestion.id)) {
            currentAskedIds.push(currentQuestion.id)
            localStorage.setItem('askedQuestionIds', JSON.stringify(currentAskedIds))
            localStorage.setItem('lastAskedDate', today)
          }
        } catch (e) {
          console.warn('Failed to update askedQuestionIds:', e)
        }

        if (typeof data.livesRemaining === 'number') {
          setServerEnergy(Math.max(0, Math.min(ENERGY_MAX, data.livesRemaining)))
        }

        if (typeof data.livesRemaining === 'number' && data.livesRemaining <= 0) {
          setQuizStats(prev => ({
            ...prev,
            totalTime: Date.now() - quizStartTime,
            userAnswers: userAnswers,
            questionScores: questionScores
          }))
          setIsQuizCompleted(true)
          return
        }

        try {
          const today = new Date().toISOString().slice(0, 10)
          const updatedData = {
            date: today,
            livesRemaining: data.livesRemaining,
            questionsCounted: data.questionsCounted,
            pointsToday: data.pointsToday,
            cap: 500,
            dailyLives: 30
          }
          localStorage.setItem('rankedSnapshot', JSON.stringify(updatedData))
          localStorage.setItem('rankedProgress', JSON.stringify(updatedData))
          localStorage.setItem('rankedStatus', JSON.stringify(updatedData))
          localStorage.setItem('sessionBackup', JSON.stringify(updatedData))
          window.dispatchEvent(new CustomEvent('rankedStatusUpdate', { detail: updatedData }))
        } catch (e) {
          console.warn('Failed to update ranked status:', e)
        }

        try {
          await api.post('/api/ranked/sync-progress', {
            livesRemaining: data.livesRemaining,
            questionsCounted: data.questionsCounted,
            pointsToday: data.pointsToday,
            currentBook: data.currentBook || 'Genesis',
            currentBookIndex: data.currentBookIndex || 0,
            isPostCycle: data.isPostCycle || false,
            currentDifficulty: data.currentDifficulty || 'all'
          })
        } catch {
          // non-critical
        }
      } else if (settings?.sessionId) {
        const res = await api.post(`/api/sessions/${settings.sessionId}/answer`, {
          questionId: currentQuestion.id,
          answer: answerIndex,
          clientElapsedMs: (timerLimit - timeLeft) * 1000
        })
        const data = res.data
        correct = !!data.isCorrect
      } else {
        correct = answerIndex === (currentQuestion.correctAnswer?.[0] ?? -1)
      }
    } catch (e) {
      console.error('submit answer failed', e)
      correct = answerIndex === (currentQuestion.correctAnswer?.[0] ?? -1)
    }

    // Refresh daily missions so "answer_correct" + "answer_combo" tick
    // (and combo resets) without waiting for an F5.
    queryClient.invalidateQueries({ queryKey: ['daily-missions'] })

    setIsCorrect(correct)

    let questionScore = 0
    if (correct) {
      // Ranked mode: server is authoritative for XP. Use the per-question
      // `earned` value returned by `/api/ranked/sessions/{id}/answer` so the
      // displayed score matches what hits the leaderboard. Falls through to
      // the FE formula only when the field is missing (older BE / non-ranked
      // modes that haven't migrated to server-side scoring yet).
      const serverEarned = typeof rankedResponse?.earned === 'number'
        ? (rankedResponse.earned as number)
        : null
      if (serverEarned != null) {
        questionScore = serverEarned
      } else {
        const baseScore = currentQuestion.difficulty === 'easy' ? 10 :
          currentQuestion.difficulty === 'medium' ? 20 : 30
        const timeBonus = Math.floor(timeLeft / 2)
        const perfectBonus = timeLeft >= 25 ? 5 : 0
        const difficultyMultiplier = currentQuestion.difficulty === 'hard' ? 1.5 :
          currentQuestion.difficulty === 'medium' ? 1.2 : 1
        questionScore = Math.floor((baseScore + timeBonus + perfectBonus) * difficultyMultiplier)
      }

      setScore(prev => prev + questionScore)
      const newCombo = combo + 1
      setCombo(newCombo)
      soundManager.play('correctAnswer')
      haptic.correct()
      setAnswerAnim('correct')
      setScorePopping(true)
      setTimeout(() => setScorePopping(false), 500)
      setCorrectAnswers(prev => prev + 1)

      // Combo sounds
      if (newCombo === 3) {
        soundManager.play('combo3')
        haptic.combo()
        setShowCombo(true)
        setTimeout(() => setShowCombo(false), 1800)
      } else if (newCombo === 5) {
        soundManager.play('combo5')
        haptic.combo()
        setShowCombo(true)
        setTimeout(() => setShowCombo(false), 1800)
      } else if (newCombo === 10) {
        soundManager.play('combo10')
        haptic.combo()
        setShowCombo(true)
        setTimeout(() => setShowCombo(false), 2000)
      }
    } else {
      setCombo(0)
      setLives(prev => Math.max(0, prev - 1))
      soundManager.play('wrongAnswer')
      haptic.wrong()
      setAnswerAnim('wrong')
    }

    setLastQuestionScore(questionScore)
    // Score settled (runs on every path, including the API-failure fallback
    // above) — reveal the real value.
    setScorePending(false)

    const newUserAnswers = [...userAnswers]
    newUserAnswers[currentQuestionIndex] = answerIndex
    setUserAnswers(newUserAnswers)

    const newQuestionScores = [...questionScores]
    newQuestionScores[currentQuestionIndex] = questionScore
    setQuestionScores(newQuestionScores)

    setQuizStats(prev => {
      // PURE updater — every nested object/array is copied before mutation.
      // The previous version did `const newStats = { ...prev }` then
      // `newStats.difficultyBreakdown[diff].total += 1` which mutated
      // `prev.difficultyBreakdown[diff]` (shared reference). React 18
      // StrictMode runs updaters twice in dev to surface this exact bug,
      // so the breakdown numbers showed up doubled (5/8 easy displayed
      // as 10/16 — user report 2026-05-20).
      const difficulty = currentQuestion.difficulty as 'easy' | 'medium' | 'hard'
      const prevBucket = prev.difficultyBreakdown[difficulty]
      const newBucket = {
        total: prevBucket.total + 1,
        correct: prevBucket.correct + (correct ? 1 : 0),
        score: prevBucket.score + (correct ? questionScore : 0),
      }
      const newTimePerQuestion = [...prev.timePerQuestion, timeTaken]
      const newCorrectAnswers = correctAnswers + (correct ? 1 : 0)
      return {
        ...prev,
        difficultyBreakdown: {
          ...prev.difficultyBreakdown,
          [difficulty]: newBucket,
        },
        timePerQuestion: newTimePerQuestion,
        totalTime: Date.now() - quizStartTime,
        averageTime: newTimePerQuestion.reduce((a, b) => a + b, 0) / newTimePerQuestion.length,
        totalScore: score + questionScore,
        correctAnswers: newCorrectAnswers,
        accuracy: prev.totalQuestions > 0
          ? (newCorrectAnswers / prev.totalQuestions) * 100
          : 0,
        userAnswers: newUserAnswers,
        questionScores: newQuestionScores,
      }
    })

    if (settings?.mode === 'ranked' && settings?.sessionId) {
      try {
        const today = new Date().toISOString().slice(0, 10)
        if (rankedResponse) {
          const finalSnap = {
            date: today,
            livesRemaining: rankedResponse.livesRemaining || 30,
            questionsCounted: rankedResponse.questionsCounted || 0,
            pointsToday: rankedResponse.pointsToday || 0,
            cap: 500,
            dailyLives: 30
          }
          localStorage.setItem('rankedSnapshot', JSON.stringify(finalSnap))
          window.dispatchEvent(new CustomEvent('rankedStatusUpdate', { detail: finalSnap }))
        }
      } catch { /* non-critical */ }
    }
  }

  const nextQuestion = () => {
    if (currentQuestionIndex + 1 >= questions.length) {
      setQuizStats(prev => ({
        ...prev,
        totalTime: Date.now() - quizStartTime,
        userAnswers: userAnswers,
        questionScores: questionScores,
        questions: questions
      }))
      setIsQuizCompleted(true)
      // Mark non-ranked sessions completed so they don't stay orphaned in_progress.
      // Ranked has its own completion path via /api/ranked/sync-progress.
      if (settings?.sessionId && settings?.mode !== 'ranked') {
        api.post(`/api/sessions/${settings.sessionId}/complete`).catch(() => {
          // Non-critical — backend abandonment scheduler picks up stragglers.
        })
      }
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setIsCorrect(null)
      setTimeLeft(timerLimit)
      setLastQuestionScore(0)
      setScorePending(false)
      setAnswerAnim(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-bq-paper flex items-center justify-center">
        <div className="bg-bq-white p-8 text-center max-w-xs w-full rounded-3xl border border-bq-hair shadow-bq-soft">
          <div className="text-xl font-bold mb-4 text-bq-ink">{t('quiz.loading')}</div>
          <div className="animate-spin w-8 h-8 border-4 border-bq-amberd border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    )
  }

  if (isQuizCompleted) {
    const answeredCount = userAnswers.filter(a => a !== null && a !== undefined).length
    const ensuredTotalTime = quizStats.totalTime || (Date.now() - quizStartTime)
    const ensuredAvgTime = quizStats.timePerQuestion.length > 0
      ? quizStats.timePerQuestion.reduce((a, b) => a + b, 0) / quizStats.timePerQuestion.length
      : (answeredCount > 0 ? ensuredTotalTime / answeredCount / 1000 : 0)
    const finalizedStats = {
      ...quizStats,
      totalScore: score,
      correctAnswers: correctAnswers,
      totalQuestions: questions.length,
      accuracy: questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0,
      totalTime: ensuredTotalTime,
      averageTime: ensuredAvgTime,
      questions,
      userAnswers,
      questionScores,
    }
    const handlePlayAgain = async () => {
          // Ranked replay = brand-new match. The sessionId lives in the
          // immutable location.state, so re-navigate with a fresh session +
          // freshly-selected questions; boot() fully resets quiz state.
          if (location.state?.isRanked || settings?.mode === 'ranked') {
            const next = await startNextRankedMatch()
            if (next) {
              navigate('/quiz', { state: next, replace: true })
            } else {
              // Pool exhausted / error — send back to the ranked hub.
              navigate('/ranked')
            }
            return
          }
          // Variety modes (mystery / speed) refetch a fresh random batch so
          // "Random hoàn toàn" / "10 câu × 10s" actually delivers new content
          // instead of replaying the same 10 questions. Best-effort: if the
          // fetch fails, fall back to the original set.
          const fresh = await refetchVarietyQuestions()
          if (fresh && fresh.length > 0) {
            setQuestions(fresh)
            setUserAnswers(new Array(fresh.length).fill(null))
            setQuestionScores(new Array(fresh.length).fill(0))
          }
          setCurrentQuestionIndex(0)
          setSelectedAnswer(null)
          setShowResult(false)
          setIsCorrect(null)
          setCombo(0)
          setLives(5)
          if (location.state?.isRanked || settings?.mode === 'ranked') {
            try {
              const snap = JSON.parse(localStorage.getItem('rankedStatus') || localStorage.getItem('rankedSnapshot') || 'null')
              const v = snap?.livesRemaining
              setServerEnergy(typeof v === 'number' ? Math.max(0, Math.min(ENERGY_MAX, v)) : ENERGY_MAX)
            } catch {
              setServerEnergy(ENERGY_MAX)
            }
          }
          setScore(0)
          setCorrectAnswers(0)
          setTimeLeft(timerLimit)
          setIsQuizCompleted(false)
          setLastQuestionScore(0)
          // (Variety refetch above already reset these for fresh batches;
          // keep these for non-variety modes that reuse the original set.)
          if (!fresh) {
            setUserAnswers(new Array(questions.length).fill(null))
            setQuestionScores(new Array(questions.length).fill(0))
          }
          setQuizStartTime(Date.now())
          setQuizStats(prev => ({
            ...prev,
            totalScore: 0,
            correctAnswers: 0,
            accuracy: 0,
            averageTime: 0,
            totalTime: 0,
            difficultyBreakdown: {
              easy: { correct: 0, total: 0, score: 0 },
              medium: { correct: 0, total: 0, score: 0 },
              hard: { correct: 0, total: 0, score: 0 }
            },
            timePerQuestion: [],
            userAnswers: new Array(questions.length).fill(null),
            questionScores: new Array(questions.length).fill(0)
          }))
        }
    const handleBackToHome = () => navigate(location.state?.isRanked ? '/ranked' : '/')

    // Ranked mode gets the dedicated 3-state result screen
    // (`docs/mockups/mockup_ranked_result.html`, 2026-05-20). Practice /
    // Mystery / Speed keep the original generic QuizResults so they
    // don't lose their difficulty breakdown section.
    if (location.state?.isRanked) {
      const previousTier = (location.state as any)?.previousTier ?? null
      return (
        <RankedQuizResults
          stats={finalizedStats}
          previousTier={previousTier}
          livesRemaining={serverEnergy ?? 0}
          resetTimeLeft={(location.state as any)?.resetTimeLeft ?? '--:--:--'}
          sessionId={location.state?.sessionId}
          weekCompletion={weekCompletion}
          matchBonus={matchBonus}
          onPlayAgain={handlePlayAgain}
          onBackToHome={handleBackToHome}
        />
      )
    }

    return (
      <QuizResults
        stats={finalizedStats}
        onPlayAgain={handlePlayAgain}
        onBackToHome={handleBackToHome}
        isRanked={location.state?.isRanked || false}
        sessionId={location.state?.sessionId}
      />
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-dvh bg-bq-paper flex items-center justify-center">
        <div className="bg-bq-white p-8 text-center max-w-sm w-full rounded-3xl border border-bq-hair shadow-bq-soft">
          <div className="text-2xl font-bold mb-4 text-bq-ink font-display">{t('quiz.noQuestions')}</div>
          <button
            onClick={() => navigate('/practice')}
            className="bg-bq-action text-bq-ink px-8 py-3 rounded-2xl font-black text-sm shadow-bq-action active:scale-95 transition-all hover:brightness-110"
          >
            {t('quiz.goBack')}
          </button>
        </div>
      </div>
    )
  }

  const modeLabel = settings?.isRanked || settings?.mode === 'ranked' ? t('gameModes.ranked')
    : settings?.mode === 'mystery_mode' ? t('gameModes.mystery')
    : settings?.mode === 'speed_round' ? t('gameModes.speed')
    : t('gameModes.practice')
  const bookLabel = getBookName(currentQuestion.book, bookLang)
  const handleQuit = () => { if (confirm(t('quiz.confirmQuit'))) navigate(quitPath) }
  const correctIdx = currentQuestion.correctAnswer?.[0] ?? -1
  const showExplanation = showResult && !!currentQuestion.explanation &&
    (isCorrect === false || (isCorrect === true && !!settings?.showExplanation))
  // Sentence-case reference for the scroll pill (formatVerseRef upper-cases the book).
  const refLabel = currentQuestion.chapter ? `${bookLabel} ${currentQuestion.chapter}` : bookLabel
  const verseRefText = currentQuestion.verseStart
    ? `${bookLabel} ${currentQuestion.chapter}:${currentQuestion.verseStart}${currentQuestion.verseEnd && currentQuestion.verseEnd !== currentQuestion.verseStart ? `–${currentQuestion.verseEnd}` : ''}`
    : null
  const questionFont =
    questionLenClass === 'short' ? 'text-[22px] text-center'
      : questionLenClass === 'medium' ? 'text-[19px] text-center'
        : 'text-[16px] text-left md:text-center'

  // Storybook play screen (LKF-4): chips float over the painted meadow, the
  // question sits on a scroll with the lamp-oil timer and the combo sword,
  // answers are big C5 boards, feedback comes with the traveller.
  return (
    <div data-testid="quiz-page" className="min-h-dvh font-sans text-bq-ink relative">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <img src="/images/lk/bq-quiz.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-[30%_50%] md:object-center" />
        <div className="absolute inset-0 bg-bq-cream/20" />
      </div>

      {showCombo && (
        <div className="combo-banner-anim fixed top-24 left-1/2 z-[60] flex items-center gap-2 pl-2 pr-5 py-1.5 rounded-full bg-bq-amber border-[3px] border-bq-ink shadow-[0_5px_0_#1D2B22] font-extrabold text-[20px] whitespace-nowrap">
          <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-9 -rotate-[30deg]" />
          {t('quiz.lk.comboBanner', { count: combo })}
        </div>
      )}

      <main className={`relative max-w-[1100px] mx-auto px-3.5 md:px-6 pt-3.5 md:pt-[18px] flex flex-col gap-3 md:gap-[18px] ${showResult ? 'pb-[250px] md:pb-8' : 'pb-8'}`}>
        <QuizTopBar
          onQuit={handleQuit}
          modeLabel={modeLabel}
          bookLabel={bookLabel}
          current={currentQuestionIndex + 1}
          total={questions.length}
          energy={isPracticeMode ? null : computeEnergyPercent(serverEnergy, lives)}
          energyRaw={serverEnergy}
          score={score}
        />

        {/* The question on a parchment scroll between two wooden rods */}
        <section aria-label={t('quiz.lk.questionAria')} className="md:px-1.5">
          <div aria-hidden className="h-4 md:h-5 rounded-full bg-bq-wood border-[3px] border-bq-ink" />
          <div
            data-question-length={questionLenClass}
            className="relative mx-2.5 md:mx-3.5 -my-[3px] md:-my-1 px-4 md:px-[34px] pt-2.5 md:pt-4 pb-3.5 md:pb-[26px] bg-bq-parch border-x-[3px] border-bq-ink"
          >
            <div className="flex items-center justify-between gap-2.5">
              <LampTimer secondsLeft={timeLeft} totalSeconds={timerLimit} />
              <span
                data-testid="quiz-combo"
                className={`shrink-0 flex items-center gap-0.5 md:gap-1.5 pl-0.5 md:pl-1.5 pr-2.5 md:pr-4 py-0.5 bg-bq-cream border-2 md:border-[3px] border-bq-ink rounded-full font-extrabold text-[14px] md:text-[19px] ${combo > 0 ? '' : 'opacity-60'} ${scorePopping ? 'score-pop-anim' : ''}`}
              >
                <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6 md:h-[34px] -rotate-[30deg]" />
                <span className="md:hidden">×{combo}</span>
                <span className="hidden md:inline">{t('quiz.lk.combo', { count: combo })}</span>
              </span>
            </div>
            <h1
              data-testid="quiz-question-text"
              className={`question-text font-extrabold leading-[1.22] mt-2.5 md:mt-[18px] mb-2 md:mb-2.5 md:[font-size:clamp(26px,3.3vw,38px)] ${questionFont}`}
            >
              {wrapProperNouns(currentQuestion.content)}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span data-testid="quiz-verse-badge" className="px-3 md:px-3.5 bg-bq-white border-2 border-bq-ink rounded-full text-[13px] md:text-[15px] font-bold text-bq-ink2">
                <span data-testid="quiz-question-book">{refLabel}</span>
              </span>
              <DifficultyBadge difficulty={currentQuestion.difficulty} />
            </div>
          </div>
          <div aria-hidden className="h-4 md:h-5 rounded-full bg-bq-wood border-[3px] border-bq-ink" />
        </section>

        {/* Answers: C5 boards (AnswerButton) */}
        <div
          data-testid="quiz-answers-grid"
          data-compact={questionLenClass === 'long' || undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-[18px]"
        >
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index
            const isCorrectAnswer = showResult && index === correctIdx
            const isWrongSelected = showResult && isSelected && index !== correctIdx
            const isEliminated = !showResult && lifeline.eliminatedOptions.has(index)

            let state: AnswerState
            if (isEliminated) state = 'eliminated'
            else if (isCorrectAnswer) state = 'correct'
            else if (isWrongSelected) state = 'wrong'
            else if (isSelected && !showResult) state = 'selected'
            else if (showResult) state = 'disabled'
            else state = 'default'

            return (
              <AnswerButton
                key={index}
                index={index as 0 | 1 | 2 | 3}
                letter={ANSWER_LETTERS[index] as 'A' | 'B' | 'C' | 'D'}
                text={option}
                state={state}
                compact={questionLenClass === 'long'}
                onClick={() => handleAnswerSelect(index)}
                testId={`quiz-answer-${index}`}
                pickedByUser={isSelected}
              />
            )
          })}
        </div>

        {/* Before answering: hint + skip on the left, a nudge on the right.
            (AskOpinion lifeline removed in v1 — see DECISIONS.md 2026-04-18.) */}
        {!showResult && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2.5">
              <button
                type="button"
                data-testid="quiz-hint-btn"
                data-hint-remaining={lifeline.hintsRemaining}
                onClick={() => { if (lifeline.canUseHint) lifeline.useHint() }}
                disabled={!lifeline.canUseHint}
                aria-disabled={!lifeline.canUseHint}
                className="px-4 md:px-[18px] py-1.5 md:py-2 bg-bq-white border-[3px] border-bq-ink rounded-[14px] shadow-[0_5px_0_#1D2B22] font-extrabold text-[15px] md:text-[17px] active:translate-y-1 active:shadow-[0_1px_0_#1D2B22] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lifeline.hintsRemaining === -1 ? t('quiz.lk.hint') : t('quiz.lk.hintLeft', { count: Math.max(0, lifeline.hintsRemaining) })}
              </button>
              <button
                type="button"
                onClick={() => handleAnswerSelect(-1)}
                className="px-4 md:px-[18px] py-1.5 md:py-2 bg-bq-white border-[3px] border-bq-ink rounded-[14px] shadow-[0_5px_0_#1D2B22] font-extrabold text-[15px] md:text-[17px] active:translate-y-1 active:shadow-[0_1px_0_#1D2B22] transition-transform"
              >
                {t('quiz.lk.skip')}
              </button>
            </div>
            <span className="hidden md:inline px-3.5 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-xl text-[17px] font-bold">{t('quiz.lk.pickOne')}</span>
          </div>
        )}

        {showResult && (
          <QuizFeedback
            ref={feedbackRef}
            isCorrect={!!isCorrect}
            pending={scorePending}
            points={lastQuestionScore}
            combo={combo}
            correctLetter={ANSWER_LETTERS[correctIdx] ?? ''}
            correctText={currentQuestion.options[correctIdx] ?? ''}
            explanation={showExplanation ? currentQuestion.explanation : null}
            verseRef={verseRefText}
            isLast={currentQuestionIndex + 1 >= questions.length}
            onNext={nextQuestion}
            onBookmark={() => { try { api.post('/api/me/bookmarks', { questionId: currentQuestion.id }) } catch { /* best effort */ } }}
          />
        )}
      </main>
    </div>
  )
}

export default Quiz
