import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import { useLifeline } from '../hooks/useLifeline'
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton'
import { wrapProperNouns, formatVerseRef } from '../utils/textHelpers'
import QuizResults from './QuizResults'

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
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']
const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const
const DEFAULT_TIMER = 30
const ENERGY_BARS = 5
const ENERGY_MAX = 100
const ENERGY_PER_BAR = ENERGY_MAX / ENERGY_BARS

export function computeEnergyBarsFilled(
  energy: number | null | undefined,
  lives: number,
  totalBars: number = ENERGY_BARS,
  perBar: number = ENERGY_PER_BAR
): number {
  if (energy != null) {
    return Math.max(0, Math.min(totalBars, Math.ceil(Math.max(0, energy) / perBar)))
  }
  return Math.max(0, Math.min(totalBars, lives))
}

const Quiz: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settings = location.state as QuizPageSettings | null
  const timerLimit = settings?.timePerQuestion ?? DEFAULT_TIMER

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [combo, setCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(5)
  const [serverEnergy, setServerEnergy] = useState<number | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [isQuizCompleted, setIsQuizCompleted] = useState(false)
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
  const [showCombo, setShowCombo] = useState(false)
  const [answerAnim, setAnswerAnim] = useState<'correct' | 'wrong' | null>(null)
  const [scorePopping, setScorePopping] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]
  const progressPercent = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

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
    const boot = () => {
      try {
        setIsLoading(true)
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
          alert(t('quiz.noQuestions'))
          navigate('/practice')
        }
      } finally {
        setIsLoading(false)
      }
    }
    if (settings) boot(); else navigate('/practice')
  }, [settings, navigate])

  const handleAnswerSelect = async (answerIndex: number) => {
    if (showResult) return

    setSelectedAnswer(answerIndex)
    setShowResult(true)

    const timeTaken = timerLimit - timeLeft
    let correct = false
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

    setIsCorrect(correct)

    let questionScore = 0
    if (correct) {
      const baseScore = currentQuestion.difficulty === 'easy' ? 10 :
        currentQuestion.difficulty === 'medium' ? 20 : 30
      const timeBonus = Math.floor(timeLeft / 2)
      const perfectBonus = timeLeft >= 25 ? 5 : 0
      const difficultyMultiplier = currentQuestion.difficulty === 'hard' ? 1.5 :
        currentQuestion.difficulty === 'medium' ? 1.2 : 1
      questionScore = Math.floor((baseScore + timeBonus + perfectBonus) * difficultyMultiplier)

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

    const newUserAnswers = [...userAnswers]
    newUserAnswers[currentQuestionIndex] = answerIndex
    setUserAnswers(newUserAnswers)

    const newQuestionScores = [...questionScores]
    newQuestionScores[currentQuestionIndex] = questionScore
    setQuestionScores(newQuestionScores)

    setQuizStats(prev => {
      const newStats = { ...prev }
      const difficulty = currentQuestion.difficulty as 'easy' | 'medium' | 'hard'
      newStats.difficultyBreakdown[difficulty].total += 1
      if (correct) {
        newStats.difficultyBreakdown[difficulty].correct += 1
        newStats.difficultyBreakdown[difficulty].score += questionScore
      }
      newStats.timePerQuestion.push(timeTaken)
      newStats.totalTime = Date.now() - quizStartTime
      newStats.averageTime = newStats.timePerQuestion.reduce((a, b) => a + b, 0) / newStats.timePerQuestion.length
      newStats.totalScore = score + questionScore
      newStats.correctAnswers = correctAnswers + (correct ? 1 : 0)
      newStats.accuracy = (newStats.correctAnswers / newStats.totalQuestions) * 100
      newStats.userAnswers = newUserAnswers
      newStats.questionScores = newQuestionScores
      return newStats
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
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setIsCorrect(null)
      setTimeLeft(timerLimit)
      setLastQuestionScore(0)
      setAnswerAnim(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-xs w-full rounded-3xl border border-outline-variant/10">
          <div className="text-xl font-bold mb-4 text-on-surface">{t('quiz.loading')}</div>
          <div className="animate-spin w-8 h-8 border-4 border-secondary border-t-transparent rounded-full mx-auto"></div>
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
    return (
      <QuizResults
        stats={finalizedStats}
        onPlayAgain={() => {
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
          setUserAnswers(new Array(questions.length).fill(null))
          setQuestionScores(new Array(questions.length).fill(0))
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
        }}
        onBackToHome={() => navigate(location.state?.isRanked ? '/ranked' : '/')}
        isRanked={location.state?.isRanked || false}
        sessionId={location.state?.sessionId}
      />
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-sm w-full rounded-3xl border border-outline-variant/10">
          <div className="text-2xl font-bold mb-4 text-on-surface">{t('quiz.noQuestions')}</div>
          <button
            onClick={() => navigate('/practice')}
            className="bg-gradient-to-r from-secondary to-tertiary text-on-secondary px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all hover:brightness-110"
          >
            {t('quiz.goBack')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="quiz-page" className="min-h-screen bg-surface font-body text-on-surface overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Top Navigation Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-low border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <Link
            to={settings?.isRanked ? '/ranked' : '/practice'}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-variant transition-colors"
            onClick={(e) => {
              e.preventDefault()
              if (confirm(t('quiz.confirmQuit'))) {
                navigate(settings?.isRanked ? '/ranked' : '/practice')
              }
            }}
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              {t('quiz.question', { current: currentQuestionIndex + 1, total: questions.length })}
            </span>
            <span className="font-headline font-bold text-sm tracking-tight">
              {currentQuestion.book}{currentQuestion.chapter ? `: ${t('quiz.chapter', { chapter: currentQuestion.chapter })}` : ''}
            </span>
          </div>
        </div>

        {/* Progress Bar Center (desktop) */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4 hidden md:block text-center">
          <div className="flex items-center gap-4">
            <div className="h-2 flex-1 bg-primary-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-secondary to-tertiary shadow-[0_0_8px_rgba(232,168,50,0.4)] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span data-testid="quiz-progress" className="text-[10px] font-black text-secondary whitespace-nowrap">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant/10">
            <span className="material-symbols-outlined text-secondary text-lg" style={FILL_STYLE}>bolt</span>
            <span className="font-bold text-sm">{score.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-secondary/20 flex items-center justify-center bg-surface-container-high md:hidden">
            <span className={`font-black text-sm ${timeLeft <= 5 ? 'text-error animate-pulse' : 'text-on-surface'}`}>
              {timeLeft}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Progress Bar */}
      <div className="fixed top-16 left-0 w-full h-1 bg-primary-container md:hidden z-50">
        <div
          className="h-full bg-gradient-to-r from-secondary to-tertiary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Combo Banner */}
      {showCombo && (
        <div className="combo-banner-anim fixed top-20 left-1/2 z-[60] px-6 py-3 rounded-full font-black text-lg shadow-lg bg-gradient-to-r from-orange-500 to-red-500 text-white whitespace-nowrap">
          🔥 {combo}x COMBO!
        </div>
      )}

      {/* Main Content */}
      <main className="relative min-h-screen pt-24 pb-12 px-6 flex flex-col items-center justify-center max-w-5xl mx-auto">
        {/* Top Stats Row */}
        <div className="w-full flex justify-between items-end mb-8">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{t('quiz.comboStreak')}</span>
            <div className={`flex items-center gap-2 glass-panel px-4 py-2 rounded-2xl border transition-all duration-300 ${combo > 0 ? 'border-secondary/20 gold-glow' : 'border-outline-variant/10'}`}>
              <span className="material-symbols-outlined text-secondary" style={FILL_STYLE}>stars</span>
              <span className={`font-headline font-black text-2xl italic ${combo > 0 ? 'text-secondary' : 'text-on-surface-variant'} ${scorePopping ? 'score-pop-anim' : ''}`}>
                x{combo}
              </span>
            </div>
          </div>

          {/* Circular Countdown Timer */}
          <div className="hidden md:flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{t('quiz.time')}</span>
            <div className={`relative w-14 h-14 flex items-center justify-center ${
              timeLeft <= 3 ? 'timer-critical-anim' : timeLeft <= 5 ? 'timer-warning-anim' : ''
            }`}>
              <svg className="timer-svg w-full h-full" viewBox="0 0 36 36">
                <circle
                  className="stroke-surface-container-highest"
                  cx="18" cy="18" r="16"
                  fill="none" strokeWidth="2"
                />
                <circle
                  className={`timer-arc ${timeLeft <= 3 ? 'stroke-error' : timeLeft <= 5 ? 'stroke-yellow-500' : 'stroke-secondary'}`}
                  cx="18" cy="18" r="16"
                  fill="none" strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 - (timeLeft / timerLimit) * 100}
                />
              </svg>
              <span data-testid="quiz-timer" className={`absolute font-headline font-black text-xl ${
                timeLeft <= 3 ? 'text-error' : timeLeft <= 5 ? 'text-yellow-500' : 'text-secondary'
              }`}>
                {timeLeft}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">{t('quiz.energy')}</span>
            <div className="flex gap-1" data-testid="quiz-energy-bars" data-energy={serverEnergy ?? ''}>
              {Array.from({ length: ENERGY_BARS }).map((_, i) => {
                const filled = i < computeEnergyBarsFilled(serverEnergy, lives)
                return (
                  <div
                    key={i}
                    className={`w-2 h-6 rounded-full ${filled
                      ? 'bg-secondary shadow-[0_0_10px_rgba(232,168,50,0.3)]'
                      : 'bg-surface-container-highest'
                    }`}
                  ></div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Question Section.
            QZ-P0-2: verse badge top + wrapProperNouns on the question
            content + .question-text class for `text-wrap: pretty`. The
            bottom book-meta line stays for E2E (data-testid="quiz-question-book"). */}
        <div className="w-full space-y-16">
          <div className="relative w-full aspect-[16/9] md:aspect-[21/7] flex flex-col items-center justify-center text-center p-10 bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 shadow-2xl overflow-hidden">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-32 bg-secondary rounded-r-full"></div>

            {/* Verse badge — pill at the top of the card. */}
            <div
              data-testid="quiz-verse-badge"
              className="inline-flex items-center gap-1.5 bg-secondary/10 border border-secondary/20 rounded-full px-3 py-1 mb-4"
            >
              <span className="material-symbols-outlined text-secondary text-xs">menu_book</span>
              <span className="text-secondary text-[11px] font-medium tracking-wider">
                {formatVerseRef(currentQuestion)}
              </span>
            </div>

            <h2
              data-testid="quiz-question-text"
              className="question-text font-headline text-2xl md:text-4xl font-extrabold tracking-tight leading-snug max-w-3xl text-on-surface"
            >
              {wrapProperNouns(currentQuestion.content)}
            </h2>
            <div className="mt-8 flex items-center gap-2 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              <span data-testid="quiz-question-book" className="text-xs font-bold uppercase tracking-widest">
                {currentQuestion.book}{currentQuestion.chapter ? ` - ${t('quiz.chapter', { chapter: currentQuestion.chapter })}` : ''}
              </span>
            </div>
          </div>

          {/* Answers Grid — AnswerButton handles per-position color (Coral/Sky/Gold/Sage),
              all 6 visual states, animations, icons. See QZ-P0-1 in BUG_REPORT_QUIZ.md. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  onClick={() => handleAnswerSelect(index)}
                  testId={`quiz-answer-${index}`}
                />
              )
            })}
          </div>
        </div>

        {/* Gameplay Footer */}
        {/*
          AskOpinion (community poll) lifeline was removed in v1 — it needs
          a critical mass of community answers (cold-start problem). Will
          be reintroduced in v2 once we reach ≥30 samples/question avg.
          See DECISIONS.md 2026-04-18.
        */}
        <div className="mt-16 w-full flex justify-between items-center opacity-80">
          <button
            data-testid="quiz-hint-btn"
            data-hint-remaining={lifeline.hintsRemaining}
            onClick={() => { if (lifeline.canUseHint && !showResult) lifeline.useHint() }}
            disabled={!lifeline.canUseHint || showResult}
            aria-disabled={!lifeline.canUseHint || showResult}
            className={`flex items-center gap-2 transition-colors ${
              lifeline.canUseHint && !showResult
                ? 'text-on-surface-variant hover:text-on-surface'
                : 'text-on-surface-variant/30 cursor-not-allowed'
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
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">skip_next</span>
            <span className="text-xs font-bold uppercase tracking-widest">{t('quiz.skip')}</span>
          </button>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showResult && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-lg">
          <div data-testid="quiz-answer-feedback" className="bg-surface-container-highest p-5 rounded-3xl border border-secondary/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 glass-panel">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isCorrect ? 'bg-secondary/20' : 'bg-error/20'}`}>
                <span
                  className={`material-symbols-outlined text-2xl ${isCorrect ? 'text-secondary' : 'text-error'}`}
                  style={FILL_STYLE}
                >{isCorrect ? 'verified' : 'cancel'}</span>
              </div>
              <div>
                <p className="text-base font-bold text-on-surface">
                  {isCorrect ? t('quiz.correct') : t('quiz.incorrect')}
                </p>
                <p data-testid="quiz-score-delta" className={`text-xs font-medium ${isCorrect ? 'text-secondary/80' : 'text-error/80'}`}>
                  {isCorrect ? t('quiz.bonusPoints', { points: lastQuestionScore }) : t('quiz.noPoints')}
                </p>
              </div>
            </div>
            <button
              data-testid="quiz-next-btn"
              onClick={nextQuestion}
              className="bg-gradient-to-r from-secondary to-tertiary text-on-secondary px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all hover:brightness-110 whitespace-nowrap"
            >
              {currentQuestionIndex + 1 >= questions.length ? t('quiz.viewResults') : t('quiz.nextQuestion')}
            </button>
          </div>
        </div>
      )}

      {/* Explanation panel — always show for wrong answers */}
      {showResult && isCorrect === false && (currentQuestion.explanation || currentQuestion.verseStart) && (
        <div data-testid="quiz-explanation" className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-3rem)] max-w-lg animate-slide-up">
          <div className="glass-panel p-5 rounded-2xl border border-error/20 space-y-3">
            {/* Correct answer */}
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-400 text-sm" style={FILL_STYLE}>check_circle</span>
              <span className="text-sm font-bold text-green-400">
                {t('quiz.correctAnswerIs', { answer: currentQuestion.options[currentQuestion.correctAnswer?.[0] ?? 0] ?? '' })}
              </span>
            </div>

            {/* Scripture reference */}
            {currentQuestion.verseStart && (
              <p className="text-secondary text-sm font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">menu_book</span>
                {currentQuestion.book} {currentQuestion.chapter}:{currentQuestion.verseStart}
                {currentQuestion.verseEnd && currentQuestion.verseEnd !== currentQuestion.verseStart
                  ? `–${currentQuestion.verseEnd}` : ''}
              </p>
            )}

            {/* Explanation */}
            {currentQuestion.explanation && (
              <p className="text-on-surface-variant text-sm leading-relaxed flex items-start gap-1.5">
                <span className="material-symbols-outlined text-sm mt-0.5 text-secondary/60">lightbulb</span>
                <span>{currentQuestion.explanation}</span>
              </p>
            )}

            {/* Bookmark button */}
            <button
              onClick={() => {
                try { api.post('/api/me/bookmarks', { questionId: currentQuestion.id }) } catch {}
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-secondary/80 transition-colors mt-1"
            >
              <span className="material-symbols-outlined text-sm">bookmark_add</span>
              {t('quiz.bookmarkForReview', 'Đánh dấu ôn lại')}
            </button>
          </div>
        </div>
      )}

      {/* Explanation for correct — only when showExplanation setting is on */}
      {showResult && isCorrect === true && settings?.showExplanation && currentQuestion.explanation && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-3rem)] max-w-lg">
          <div className="glass-panel p-4 rounded-2xl border border-outline-variant/10 text-sm text-on-surface-variant">
            <strong className="text-on-surface">{t('quiz.explanation')}:</strong> {currentQuestion.explanation}
          </div>
        </div>
      )}
    </div>
  )
}

export default Quiz
