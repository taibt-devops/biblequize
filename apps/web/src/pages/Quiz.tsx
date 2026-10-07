import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import { useLifeline } from '../hooks/useLifeline'
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton'
import { CircularTimer } from '../components/quiz/CircularTimer'
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
  // Hidden by default so the pill doesn't cover the answer grid on short
  // mobile viewports (user report 2026-05-20 — pill at bottom-48 was
  // overlapping answer D). User taps "Xem giải thích" pill to expand panel.
  const [explanationCollapsed, setExplanationCollapsed] = useState(true)
  const explanationRef = useRef<HTMLDivElement | null>(null)

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

  // Reset the explanation popup to collapsed whenever a new feedback shows
  // (new question, or just-answered the current one). Keeps the panel hidden
  // until the user explicitly taps the "Xem giải thích" pill.
  useEffect(() => {
    setExplanationCollapsed(true)
  }, [currentQuestionIndex, showResult])

  // Click-outside on the explanation panel collapses it so the answer grid
  // behind is visible. Only attach the listener while a panel is open.
  useEffect(() => {
    if (!showResult || explanationCollapsed) return
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
  }, [showResult, explanationCollapsed])

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

  return (
    <div data-testid="quiz-page" className="min-h-dvh font-sans text-bq-ink overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        {/* Lữ Khách: calm painted meadow behind the scroll (LKD-11) */}
        <img src="/images/lk/bq-quiz.webp" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-bq-paper/25" />
      </div>

      {/* Top Navigation Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-bq-white border-b-[3px] border-bq-ink">
        <div className="flex items-center gap-3">
          <Link
            to={quitPath}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bq-inset transition-colors"
            onClick={(e) => {
              e.preventDefault()
              if (confirm(t('quiz.confirmQuit'))) {
                navigate(quitPath)
              }
            }}
          >
            <span className="material-symbols-outlined text-bq-ink2">close</span>
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-bq-amberd">
              {t('quiz.question', { current: currentQuestionIndex + 1, total: questions.length })}
            </span>
            <span className="font-display font-bold text-sm tracking-tight">
              {getBookName(currentQuestion.book, bookLang)}{currentQuestion.chapter ? `: ${t('quiz.chapter', { chapter: currentQuestion.chapter })}` : ''}
            </span>
          </div>
        </div>

        {/* Progress Bar Center (desktop) */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4 hidden md:block text-center">
          <div className="flex items-center gap-4">
            <div className="relative h-3.5 flex-1 bg-bq-track border-2 border-bq-ink rounded-full">
              <div
                className="h-full rounded-full bg-bq-amber transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
              <img
                src="/images/lk/hero.webp"
                alt=""
                aria-hidden
                className="absolute bottom-1 h-7 -translate-x-1/2 transition-[left] duration-500"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <span data-testid="quiz-progress" className="text-[10px] font-black text-bq-amberd whitespace-nowrap">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-bq-inset px-3 py-1.5 rounded-full border border-bq-hair">
            <span className="material-symbols-outlined text-bq-amberd text-lg" style={FILL_STYLE}>bolt</span>
            <span className="font-bold text-sm">{score.toLocaleString()}</span>
          </div>
          <div className="md:hidden">
            <CircularTimer
              secondsLeft={timeLeft}
              totalSeconds={timerLimit}
              size={44}
              testId="quiz-timer-mobile"
            />
          </div>
        </div>
      </header>

      {/* Mobile Progress Bar */}
      <div className="fixed top-16 left-0 w-full h-1.5 bg-bq-track border-b-2 border-bq-ink md:hidden z-50">
        <div
          className="h-full bg-bq-amber transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Combo Banner */}
      {showCombo && (
        <div className="combo-banner-anim fixed top-20 left-1/2 z-[60] px-6 py-3 rounded-full font-black text-lg shadow-bq-flame bg-bq-flame text-white whitespace-nowrap">
          🔥 {combo}x COMBO!
        </div>
      )}

      {/* Main Content — pad-bottom grows when the feedback dock is visible
          so the answer grid scrolls clear of the dock instead of being
          covered by it (the dock was floating at `bottom-48` and overlapping
          answer D on short mobile viewports — fix 2026-05-20). */}
      <main className={`relative min-h-dvh pt-24 px-6 flex flex-col items-center justify-center max-w-5xl mx-auto ${showResult ? 'pb-56 sm:pb-44' : 'pb-12'}`}>
        {/* Mobile-only HUD strip — 3 pills (energy/combo/score) per QM-2 mockup.
            Replaces desktop "Top Stats Row" on small screens. */}
        <div
          data-testid="quiz-hud-mobile"
          className={`md:hidden w-full grid gap-2 mb-4 ${isPracticeMode ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {!isPracticeMode && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft min-w-0">
            <span className="material-symbols-outlined text-bq-amberd text-base flex-shrink-0" style={FILL_STYLE}>bolt</span>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-bq-ink2 leading-none">{t('quiz.energy')}</div>
              <div
                className="flex items-center gap-1.5 mt-1.5"
                data-testid="quiz-energy-bar-mobile"
                data-energy={serverEnergy ?? ''}
              >
                <div className="relative flex-1 h-2 rounded-full bg-bq-inset overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-bq-amber transition-[width] duration-500 ease-out"
                    style={{ width: `${computeEnergyPercent(serverEnergy, lives)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-bq-ink leading-none">
                  {Math.round(computeEnergyPercent(serverEnergy, lives))}%
                </span>
              </div>
            </div>
          </div>
          )}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft min-w-0">
            <span className="material-symbols-outlined text-bq-amberd text-base flex-shrink-0" style={FILL_STYLE}>stars</span>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-bq-ink2 leading-none">{t('quiz.comboStreak')}</div>
              <div className={`text-[13px] font-extrabold tabular-nums leading-none mt-1.5 ${combo > 0 ? 'text-bq-amberd' : 'text-bq-ink'} ${scorePopping ? 'score-pop-anim' : ''}`}>×{combo}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft min-w-0">
            <span className="material-symbols-outlined text-bq-emerald text-base flex-shrink-0" style={FILL_STYLE}>scoreboard</span>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-bq-ink2 leading-none">{t('quiz.score')}</div>
              <div className="text-[13px] font-extrabold tabular-nums leading-none mt-1.5 text-bq-ink">{score.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Top Stats Row — desktop only (mobile uses HUD strip above) */}
        <div className="hidden md:flex w-full justify-between items-end mb-8">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-bq-ink2">{t('quiz.comboStreak')}</span>
            <div className={`flex items-center gap-2 bg-bq-white px-4 py-2 rounded-2xl border transition-all duration-300 ${combo > 0 ? 'border-bq-amber/40 shadow-bq-amb' : 'border-bq-hair shadow-bq-soft'}`}>
              <span className="material-symbols-outlined text-bq-amberd" style={FILL_STYLE}>stars</span>
              <span className={`font-display font-black text-2xl italic ${combo > 0 ? 'text-bq-amberd' : 'text-bq-ink2'} ${scorePopping ? 'score-pop-anim' : ''}`}>
                x{combo}
              </span>
            </div>
          </div>

          {/* Circular Countdown Timer — CircularTimer handles 4 colour
              bands (gold/yellow/orange/red) + warning/critical pulse
              animations + correct dashOffset formula (QZ-P0-3). */}
          <div className="hidden md:flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-bq-ink2">
              {t('quiz.time')}
            </span>
            <CircularTimer
              secondsLeft={timeLeft}
              totalSeconds={timerLimit}
              size={64}
              testId="quiz-timer"
            />
          </div>

          {isPracticeMode ? (
            // Practice: no energy gauge — keep the right column as a spacer
            // so the centred timer stays centred under justify-between.
            <div className="min-w-[180px]" aria-hidden="true" />
          ) : (
            <div className="flex flex-col items-end gap-1 min-w-[180px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-bq-ink2">{t('quiz.energy')}</span>
              <div
                className="flex items-center gap-2 w-full"
                data-testid="quiz-energy-bar"
                data-energy={serverEnergy ?? ''}
              >
                <div className="relative flex-1 h-3 rounded-full bg-bq-inset overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-bq-amber transition-[width] duration-500 ease-out"
                    style={{ width: `${computeEnergyPercent(serverEnergy, lives)}%` }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums text-bq-ink min-w-[44px] text-right">
                  {Math.round(computeEnergyPercent(serverEnergy, lives))}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Question Section.
            QZ-P0-2: verse badge top + wrapProperNouns on the question
            content + .question-text class for `text-wrap: pretty`. The
            bottom book-meta line stays for E2E (data-testid="quiz-question-book").
            QM-3 mobile: aspect-auto + min-h + adaptive font 3 buckets via
            getQuestionLengthClass — desktop layout (aspect-[21/7], text-4xl) unchanged. */}
        <div className="w-full space-y-6 md:space-y-16">
          {(() => {
            // Mobile-only font/alignment overrides per length bucket.
            // Desktop (md+) keeps text-4xl, font-extrabold, text-center via md: prefix.
            const mobileFontCls =
              questionLenClass === 'short'  ? 'text-[21px] font-bold text-center' :
              questionLenClass === 'medium' ? 'text-[18px] font-semibold text-center' :
                                              'text-[15px] font-semibold text-left'
            const lenClass = questionLenClass
            // Lữ Khách: the question sits on a parchment scroll between two wooden rods (LKD-11).
            return (
              <div>
              <div aria-hidden className="h-4 md:h-5 rounded-full bg-bq-wood border-[3px] border-bq-ink" />
              <div
                data-question-length={lenClass}
                className="relative mx-3 md:mx-5 -my-1 aspect-auto min-h-[160px] md:aspect-[21/7] md:min-h-0 flex flex-col items-center justify-center text-center p-5 md:p-10 bg-bq-parch border-x-[3px] border-bq-ink overflow-hidden"
              >

                {/* Verse badge + DTAG-2 difficulty badge — pills at the top of the card. */}
                <div className="flex items-center justify-center flex-wrap gap-2 mb-3 md:mb-4">
                  <div
                    data-testid="quiz-verse-badge"
                    className="inline-flex items-center gap-1.5 bg-bq-inset border border-bq-hair rounded-full px-3 py-1"
                  >
                    <span className="material-symbols-outlined text-bq-amberd text-xs">menu_book</span>
                    <span className="text-bq-amberd text-[11px] font-medium tracking-wider">
                      {formatVerseRef(currentQuestion, getBookName(currentQuestion.book, bookLang))}
                    </span>
                  </div>
                  <DifficultyBadge difficulty={currentQuestion.difficulty} />
                </div>

                <h2
                  data-testid="quiz-question-text"
                  className={`question-text font-display ${mobileFontCls} md:text-4xl md:font-extrabold md:text-center tracking-tight leading-snug max-w-3xl text-bq-ink w-full`}
                >
                  {wrapProperNouns(currentQuestion.content)}
                </h2>
                {/* Bottom book-meta — desktop only; mobile already shows book+chapter in topbar. */}
                <div className="hidden md:flex mt-8 items-center gap-2 text-bq-ink3">
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  <span data-testid="quiz-question-book" className="text-xs font-bold uppercase tracking-widest">
                    {getBookName(currentQuestion.book, bookLang)}{currentQuestion.chapter ? ` - ${t('quiz.chapter', { chapter: currentQuestion.chapter })}` : ''}
                  </span>
                </div>
              </div>
              <div aria-hidden className="h-4 md:h-5 rounded-full bg-bq-wood border-[3px] border-bq-ink" />
              </div>
            )
          })()}

          {/* Answers Grid — AnswerButton handles per-position color (Coral/Sky/Gold/Sage),
              all 6 visual states, animations, icons. See QZ-P0-1 in BUG_REPORT_QUIZ.md.
              QM-4: tighter gap on mobile + compact button mode when question is "long". */}
          <div
            data-testid="quiz-answers-grid"
            data-compact={questionLenClass === 'long' || undefined}
            className={`grid grid-cols-1 md:grid-cols-2 ${questionLenClass === 'long' ? 'gap-2' : 'gap-3'} md:gap-6`}
          >
            {currentQuestion.options.map((option, index) => {
              const correctIdx = currentQuestion.correctAnswer?.[0] ?? -1
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
        </div>

        {/* Gameplay Footer — only renders pre-answer. Once `showResult` is
            true both controls are useless (hint can't change a revealed
            answer; skip can't unsubmit) and the bottom dock already shows
            the score delta + "Câu tiếp theo" CTA, so the footer is just
            visual noise. User report 2026-05-20: skip button looked active
            after answering. */}
        {/*
          AskOpinion (community poll) lifeline was removed in v1 — it needs
          a critical mass of community answers (cold-start problem). Will
          be reintroduced in v2 once we reach ≥30 samples/question avg.
          See DECISIONS.md 2026-04-18.
        */}
        {!showResult && (
        <div className="mt-12 w-full flex justify-between items-center">
          <button
            data-testid="quiz-hint-btn"
            data-hint-remaining={lifeline.hintsRemaining}
            onClick={() => { if (lifeline.canUseHint && !showResult) lifeline.useHint() }}
            disabled={!lifeline.canUseHint || showResult}
            aria-disabled={!lifeline.canUseHint || showResult}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-[3px] border-bq-ink bg-bq-white shadow-bq-btn active:translate-y-1 active:shadow-bq-btn-down transition-transform ${
              lifeline.canUseHint && !showResult
                ? 'text-bq-ink'
                : 'text-bq-ink3 opacity-60 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined">lightbulb</span>
            <span className="text-xs font-bold uppercase tracking-widest">
              {lifeline.hintsRemaining === -1
                ? t('quiz.hint')
                : t('quiz.hintWithCount', { count: Math.max(0, lifeline.hintsRemaining) })}
            </span>
          </button>
          <button
            onClick={() => {
              if (!showResult) {
                handleAnswerSelect(-1)
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border-[3px] border-bq-ink bg-bq-white shadow-bq-btn active:translate-y-1 active:shadow-bq-btn-down transition-transform text-bq-ink"
          >
            <span className="material-symbols-outlined">skip_next</span>
            <span className="text-xs font-bold uppercase tracking-widest">{t('quiz.skip')}</span>
          </button>
        </div>
        )}
      </main>

      {/* Bottom dock — single fixed container that stacks the (optional)
          explanation pill/panel above the feedback bar. Previously these were
          two separate `fixed` elements (pill at bottom-48 → overlapped
          answer D on short mobile viewports). Wrapping them in one column
          keeps the pill above the feedback bar without floating over the
          answer grid (fix 2026-05-20, mirrors DailyChallenge dock pattern). */}
      {showResult && (() => {
        const hasWrongExp = isCorrect === false && (currentQuestion.explanation || currentQuestion.verseStart)
        const hasRightExp = isCorrect === true && settings?.showExplanation && currentQuestion.explanation
        const hasExp = hasWrongExp || hasRightExp
        const pillBorder = isCorrect ? 'border-bq-amber/40 text-bq-amberd' : 'border-bq-ruby/40 text-bq-ruby'
        return (
          <div className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] max-w-lg flex flex-col items-center gap-2">
            {hasExp && (
              explanationCollapsed ? (
                <button
                  data-testid="quiz-explanation-pill"
                  type="button"
                  onClick={() => setExplanationCollapsed(false)}
                  className={`px-4 py-2 rounded-full bg-bq-white border text-xs font-bold flex items-center gap-2 shadow-bq-soft hover:scale-105 transition-transform ${pillBorder}`}
                >
                  <span className="material-symbols-outlined text-sm" style={FILL_STYLE}>lightbulb</span>
                  {t('quiz.showExplanationAgain', 'Xem giải thích')}
                </button>
              ) : (
                <div ref={explanationRef} data-testid="quiz-explanation" className="w-full animate-slide-up">
                  <div className={`bg-bq-white p-5 rounded-2xl border space-y-3 max-h-[50vh] overflow-y-auto shadow-bq-soft ${isCorrect ? 'border-bq-amber/40' : 'border-bq-ruby/40'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {hasWrongExp && (
                          <>
                            <span className="material-symbols-outlined text-bq-emerald text-sm flex-shrink-0" style={FILL_STYLE}>check_circle</span>
                            <span className="text-sm font-bold text-bq-emerald truncate">
                              {t('quiz.correctAnswerIs', { answer: currentQuestion.options[currentQuestion.correctAnswer?.[0] ?? 0] ?? '' })}
                            </span>
                          </>
                        )}
                        {hasRightExp && (
                          <span className="text-sm font-bold text-bq-ink">
                            {t('quiz.explanation')}
                          </span>
                        )}
                      </div>
                      <button
                        data-testid="quiz-explanation-close"
                        type="button"
                        onClick={() => setExplanationCollapsed(true)}
                        className="text-bq-ink3 hover:text-bq-ink transition-colors -mr-1 flex-shrink-0"
                        aria-label={t('quiz.minimizeExplanation', 'Thu nhỏ')}
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                    {hasWrongExp && currentQuestion.verseStart && (
                      <p className="text-bq-amberd text-sm font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">menu_book</span>
                        {getBookName(currentQuestion.book, bookLang)} {currentQuestion.chapter}:{currentQuestion.verseStart}
                        {currentQuestion.verseEnd && currentQuestion.verseEnd !== currentQuestion.verseStart
                          ? `–${currentQuestion.verseEnd}` : ''}
                      </p>
                    )}
                    {currentQuestion.explanation && (
                      <p className="text-bq-ink2 text-sm leading-relaxed flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-sm mt-0.5 text-bq-amberd">lightbulb</span>
                        <span>{currentQuestion.explanation}</span>
                      </p>
                    )}
                    {hasWrongExp && (
                      <button
                        onClick={() => {
                          try { api.post('/api/me/bookmarks', { questionId: currentQuestion.id }) } catch {}
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-bq-amberd hover:opacity-80 transition-opacity mt-1"
                      >
                        <span className="material-symbols-outlined text-sm">bookmark_add</span>
                        {t('quiz.bookmarkForReview', 'Đánh dấu ôn lại')}
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
            <div
              data-testid="quiz-answer-feedback"
              className={`w-full bg-bq-white p-4 sm:p-5 rounded-3xl border shadow-bq-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${isCorrect ? 'border-bq-amber/40' : 'border-bq-ruby/40'}`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-bq-amber/15' : 'bg-bq-ruby/15'}`}>
                  <span
                    className={`material-symbols-outlined text-2xl ${isCorrect ? 'text-bq-amberd' : 'text-bq-ruby'}`}
                    style={FILL_STYLE}
                  >{isCorrect ? 'verified' : 'cancel'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-bq-ink leading-tight">
                    {isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                  </p>
                  <p data-testid="quiz-score-delta" className={`text-xs font-medium leading-tight mt-0.5 ${isCorrect ? 'text-bq-amberd' : 'text-bq-ruby'}`}>
                    {isCorrect
                      ? (scorePending ? t('quiz.calculatingPoints') : t('quiz.bonusPoints', { points: lastQuestionScore }))
                      : t('quiz.noPoints')}
                  </p>
                </div>
              </div>
              <button
                data-testid="quiz-next-btn"
                onClick={nextQuestion}
                className="bg-bq-action text-bq-ink px-6 sm:px-8 py-3 rounded-2xl font-black text-sm shadow-bq-action active:scale-95 transition-all hover:brightness-110 whitespace-nowrap w-full sm:w-auto"
              >
                {currentQuestionIndex + 1 >= questions.length ? t('quiz.viewResults') : t('quiz.nextQuestion')}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default Quiz
