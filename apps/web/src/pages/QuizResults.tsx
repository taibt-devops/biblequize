import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import confetti from 'canvas-confetti'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import MobileBottomTabs from '../layouts/components/MobileBottomTabs'
import { Medal, PlaceBackdrop, ScrollPanel, TrackBar, lkClass } from '../components/lk/Place'
import { useBookName } from '../hooks/useBookName'
import { useAuthStore } from '../store/authStore'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'

interface Question {
  id: string
  book: string
  chapter: number
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
  baseScore?: number
  speedBonus?: number
  comboBonus?: number
  comboMultiplier?: number
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

interface QuizResultsProps {
  stats: QuizStats
  onPlayAgain: () => void
  onBackToHome: () => void
  isRanked?: boolean
  sessionId?: string
}

type Tone = 'perfect' | 'great' | 'ok' | 'learning' | 'encourage'

function pickTone(accuracy: number): { tone: Tone; emoji: string; state: 'high' | 'low' } {
  if (accuracy >= 90) return { tone: 'perfect', emoji: '🌟', state: 'high' }
  if (accuracy >= 70) return { tone: 'great', emoji: '👏', state: 'high' }
  if (accuracy >= 50) return { tone: 'ok', emoji: '💪', state: 'low' }
  if (accuracy >= 30) return { tone: 'learning', emoji: '📚', state: 'low' }
  return { tone: 'encourage', emoji: '🎯', state: 'low' }
}

const QuizResults: React.FC<QuizResultsProps> = ({ stats, onPlayAgain, onBackToHome, isRanked = false }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const getBookName = useBookName()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const [scoreDisplay, setScoreDisplay] = useState(0)

  // Sounds, haptics & confetti on mount (must be before any early-return to satisfy hooks rules)
  useEffect(() => {
    if (!stats || stats.totalQuestions <= 0) return
    const acc = (stats.correctAnswers / stats.totalQuestions) * 100
    if (acc >= 95) {
      soundManager.play('perfectScore')
      haptic.tierUp()
    } else if (acc >= 70) {
      soundManager.play('quizComplete')
      haptic.correct()
    } else {
      soundManager.play('quizComplete')
    }

    if (acc >= 70) {
      // Storybook (LK) celebration confetti: gold, the four answer colours, cream paper.
      const colors = ['#FFC93C', '#E8826A', '#6AB8E8', '#7AB87A', '#FFF8E7']
      const burst = (originX: number) => confetti({
        particleCount: acc >= 90 ? 90 : 55,
        spread: 75,
        startVelocity: 45,
        origin: { x: originX, y: 0.7 },
        colors,
        scalar: 0.9,
        ticks: 220
      })
      burst(0.25)
      burst(0.75)
      if (acc >= 90) {
        const t1 = window.setTimeout(() => burst(0.5), 250)
        const t2 = window.setTimeout(() => {
          confetti({ particleCount: 60, spread: 110, startVelocity: 35, origin: { x: 0.5, y: 0.4 }, colors, scalar: 0.8 })
        }, 600)
        return () => {
          window.clearTimeout(t1)
          window.clearTimeout(t2)
        }
      }
    }
  }, [stats])

  // Animate total score counter
  useEffect(() => {
    if (!stats) return
    const target = stats.totalScore || 0
    const steps = 40
    let frame = 0
    const interval = setInterval(() => {
      frame++
      const p = Math.min(1, frame / steps)
      setScoreDisplay(Math.round(target * p))
      if (p >= 1) clearInterval(interval)
    }, 600 / steps)
    return () => clearInterval(interval)
  }, [stats])

  // Save ranked progress (mirror previous behavior)
  useEffect(() => {
    if (!isRanked) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const snap = JSON.parse(localStorage.getItem('rankedSnapshot') || '{}')
      if (snap.date === today) {
        localStorage.setItem('rankedProgress', JSON.stringify({ ...snap, cap: 500, dailyLives: 30 }))
      } else {
        const defaults = { date: today, livesRemaining: 30, questionsCounted: 0, pointsToday: 0, cap: 500, dailyLives: 30 }
        localStorage.setItem('rankedSnapshot', JSON.stringify(defaults))
        localStorage.setItem('rankedProgress', JSON.stringify(defaults))
      }
    } catch { /* ignore */ }
  }, [isRanked])

  // Book aggregates
  const { books, primaryBook, accuracy, diffRows, breakdown, isHigh, tone } = useMemo(() => {
    if (!stats) {
      return {
        books: [] as { book: string; correct: number; total: number; acc: number }[],
        primaryBook: '',
        accuracy: 0,
        diffRows: [] as { key: 'easy' | 'medium' | 'hard'; correct: number; total: number; pct: number }[],
        breakdown: null as null | { base: number; speed: number; combo: number; multiplier: number; total: number; hasBonuses: boolean },
        isHigh: false,
        tone: 'learning' as Tone,
        emoji: '📚'
      }
    }

    const bookMap: Record<string, { correct: number; total: number }> = {}
    stats.questions?.forEach((q, idx) => {
      if (!bookMap[q.book]) bookMap[q.book] = { correct: 0, total: 0 }
      bookMap[q.book].total++
      if (stats.userAnswers[idx] !== null && stats.userAnswers[idx] === q.correctAnswer[0]) {
        bookMap[q.book].correct++
      }
    })
    const bookList = Object.entries(bookMap).map(([book, v]) => ({
      book: getBookName(book),
      correct: v.correct,
      total: v.total,
      acc: v.total ? v.correct / v.total : 0
    }))

    const acc = stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 0

    const rows = (['easy', 'medium', 'hard'] as const).map((k) => {
      const b = stats.difficultyBreakdown[k]
      const pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0
      return { key: k, correct: b.correct, total: b.total, pct }
    }).filter(r => r.total > 0)

    const base = typeof stats.baseScore === 'number' ? stats.baseScore : null
    const speed = typeof stats.speedBonus === 'number' ? stats.speedBonus : 0
    const combo = typeof stats.comboBonus === 'number' ? stats.comboBonus : 0
    const multiplier = typeof stats.comboMultiplier === 'number' ? stats.comboMultiplier : 1
    const total = stats.totalScore || 0
    const hasBonuses = (speed > 0 || combo > 0) && base !== null && base !== total

    const t = pickTone(acc)

    return {
      books: bookList,
      primaryBook: bookList[0]?.book ?? '',
      accuracy: acc,
      diffRows: rows,
      breakdown: hasBonuses ? { base: base ?? total, speed, combo, multiplier, total, hasBonuses: true } : null,
      isHigh: t.state === 'high',
      tone: t.tone,
      emoji: t.emoji
    }
  }, [stats, getBookName])

  if (!stats) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <PlaceBackdrop place="meadow" veil="mid" />
        <div className="bg-bq-white p-8 rounded-bq text-center max-w-md w-full border-[3px] border-bq-ink shadow-bq-card">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="h-28 mx-auto mb-3" />
          <h2 className="text-2xl font-display font-extrabold text-bq-ink mb-2">{t('results.noData')}</h2>
          <p className="font-read text-bq-ink2 text-sm mb-6">{t('results.errorLoading')}</p>
          <button onClick={onBackToHome} className="lk-btn text-bq-ink">{t('errors.goHome')}</button>
        </div>
      </div>
    )
  }

  // Storybook stars, like the game's level result (LKD-14): 3 >= 90 %, 2 >= 70 %, 1 >= 40 %.
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 40 ? 1 : 0
  const toneColor = isHigh ? 'text-bq-emerald' : 'text-bq-sapphire'

  // Multi-book breakdown
  const sorted = [...books].sort((a, b) => b.acc - a.acc)
  const strongest = sorted[0]
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null
  const showInsight = books.length === 1

  const diffMeta = {
    easy: { label: t('results.difficulty.easy'), labelShort: t('results.difficulty.easy'), fill: 'bg-bq-emerald' },
    medium: { label: t('results.difficulty.medium'), labelShort: t('results.difficulty.mediumShort'), fill: 'bg-bq-sapphire' },
    hard: { label: t('results.difficulty.hard'), labelShort: t('results.difficulty.hard'), fill: 'bg-bq-ruby' }
  } as const

  const medalValue = 'font-display font-extrabold leading-none tabular-nums text-[19px] md:text-[23px]'
  const medalLabel = 'mt-3 text-[13px] md:text-[14px] font-extrabold text-bq-ink2'

  // "Stage complete" screen (LKF-5): the meadow of the quiz, the traveller, three stars popping,
  // the result written on a parchment scroll, stats as wooden-bezel medals.
  return (
    <div data-testid="quiz-results-page" className="relative min-h-screen px-4 pt-6 md:pt-10 pb-28 md:pb-12">
      <PlaceBackdrop place="meadow" veil="soft" />
      <main className="relative max-w-[640px] mx-auto w-full flex flex-col">

        <section data-testid="quiz-results-hero" className="relative text-center">
          {/* stars */}
          <div
            data-testid="quiz-results-stars"
            aria-label={t('results.starsLabel', { count: stars, defaultValue: '{{count}}/3 sao' })}
            className="relative z-10 flex justify-center items-end gap-1 md:gap-2 mb-1 text-[52px] md:text-[64px] leading-none font-extrabold [-webkit-text-stroke:3px_#1D2B22] [text-shadow:0_5px_0_#1D2B22]"
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                aria-hidden
                className={`${lkClass.star} ${i < stars ? 'text-bq-amber' : 'text-bq-track'} ${i === 1 ? 'text-[64px] md:text-[80px] -translate-y-2' : ''}`}
                style={{ animationDelay: `${0.25 + i * 0.22}s` }}
              >
                ★
              </span>
            ))}
          </div>

          <ScrollPanel bodyClassName="relative px-5 md:px-10 pt-5 pb-6 md:pb-7">
            <img
              src={isHigh ? '/images/lk/hero-cheer.webp' : '/images/lk/hero.webp'}
              alt=""
              aria-hidden
              className={`absolute ${isHigh ? 'h-[120px] md:h-[190px]' : 'h-[110px] md:h-[170px]'} -left-2 md:-left-[150px] -top-[96px] md:top-auto md:bottom-0 ${lkClass.bob}`}
            />
            <h1 data-testid="quiz-results-grade" className={`font-display text-[30px] md:text-[38px] font-extrabold leading-tight ${toneColor}`}>
              {t(`results.tones.${tone}`)}
            </h1>
            <p className="font-read text-[14px] md:text-[15px] text-bq-ink2 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
              {t(`results.tonesSub.${tone}`, { book: primaryBook || '' })}
            </p>

            <div className="flex justify-center gap-6 md:gap-10">
              <div className="flex flex-col items-center">
                <Medal size={78}>
                  <span data-testid="quiz-results-score" className={`${medalValue} text-bq-ink`}>
                    {stats.correctAnswers}<span className="text-bq-ink3 text-[0.68em]">/{stats.totalQuestions}</span>
                  </span>
                </Medal>
                <span className={medalLabel}>
                  <span className="md:hidden">{t('results.stats.correctShort')}</span>
                  <span className="hidden md:inline">{t('results.stats.correct')}</span>
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Medal size={78}>
                  <span data-testid="quiz-results-accuracy" className={`${medalValue} ${toneColor}`}>{accuracy}%</span>
                </Medal>
                <span className={medalLabel}>{t('results.stats.accuracyShort')}</span>
              </div>
              <div className="flex flex-col items-center">
                <Medal size={78} className="!bg-bq-cream">
                  <span data-testid="quiz-results-total-score" className={`${medalValue} text-bq-amberd`}>{scoreDisplay}</span>
                </Medal>
                <span className={medalLabel}>
                  <span className="md:hidden">{t('results.stats.scoreShort')}</span>
                  <span className="hidden md:inline">{t('results.stats.score')}</span>
                </span>
              </div>
            </div>

            {/* score receipt — only when there are real bonuses */}
            {breakdown && (
              <div data-testid="quiz-results-breakdown" className="mt-6 text-left max-w-sm mx-auto font-read text-[14px]">
                <div className="flex justify-between py-1.5 border-b-2 border-dashed border-bq-hair">
                  <span className="text-bq-ink2">{t('results.breakdown.base')}</span>
                  <span className="font-bold tabular-nums">{breakdown.base}</span>
                </div>
                {breakdown.speed > 0 && (
                  <div className="flex justify-between py-1.5 border-b-2 border-dashed border-bq-hair">
                    <span className="text-bq-ink2">{t('results.breakdown.speedBonus')}</span>
                    <span className="font-bold tabular-nums text-bq-emerald">+{breakdown.speed}</span>
                  </div>
                )}
                {breakdown.combo > 0 && (
                  <div className="flex justify-between py-1.5 border-b-2 border-dashed border-bq-hair">
                    <span className="text-bq-ink2 inline-flex items-center gap-1.5">
                      <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-5" />
                      {t('results.breakdown.combo', { multiplier: breakdown.multiplier })}
                    </span>
                    <span className="font-bold tabular-nums text-bq-emerald">+{breakdown.combo}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2">
                  <span className="font-display font-extrabold text-bq-ink text-[16px]">{t('results.breakdown.total')}</span>
                  <span className="font-display text-[24px] font-extrabold text-bq-amberd tabular-nums">{scoreDisplay}</span>
                </div>
              </div>
            )}
          </ScrollPanel>
        </section>

        {/* insight + analysis on one parchment card */}
        {(showInsight || (books.length === 1 && diffRows.length > 0) || (books.length > 1 && strongest)) && (
          <section className="mt-5 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card px-5 py-4 md:px-6 md:py-5">
            {showInsight && (
              <p data-testid="quiz-results-insight" className="flex items-center gap-3 text-[14px] text-bq-ink2 leading-relaxed">
                <img src={isHigh ? '/images/lk/lantern-on.webp' : '/images/lk/scroll.webp'} alt="" aria-hidden className="h-9 shrink-0" />
                <span>
                  {primaryBook && <><strong className={`font-extrabold ${toneColor}`}>{primaryBook}</strong>{' · '}</>}
                  {t('results.stats.correct')}: <strong className="text-bq-ink font-extrabold">{stats.correctAnswers}/{stats.totalQuestions}</strong>
                  {isHigh && <> · <strong className="text-bq-emerald font-extrabold">+1 streak</strong></>}
                </span>
              </p>
            )}

            {books.length === 1 && diffRows.length > 0 && (
              <div className={showInsight ? 'mt-4 pt-4 border-t-2 border-dashed border-bq-hair' : ''}>
                <h3 className="font-display text-[16px] font-extrabold text-bq-ink mb-2.5">{t('results.difficulty.title')}</h3>
                <div className="space-y-2">
                  {diffRows.map(row => {
                    const meta = diffMeta[row.key]
                    return (
                      <div key={row.key} className="grid grid-cols-[58px_1fr_72px] md:grid-cols-[96px_1fr_80px] gap-3 items-center">
                        <span className="text-[13px] font-extrabold text-bq-ink">
                          <span className="md:hidden">{meta.labelShort}</span>
                          <span className="hidden md:inline">{meta.label}</span>
                        </span>
                        <TrackBar pct={row.pct} fill={meta.fill} className="h-3" />
                        <span className="text-[13px] font-extrabold text-right tabular-nums">
                          {row.correct}/{row.total} <span className="text-bq-ink3 text-[11px]">{row.pct}%</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {books.length > 1 && strongest && (
              <div className={showInsight ? 'mt-4 pt-4 border-t-2 border-dashed border-bq-hair' : ''}>
                <h3 className="font-display text-[16px] font-extrabold text-bq-ink mb-2.5">{t('results.analysis')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bq-leaf border-2 border-bq-ink rounded-2xl p-3">
                    <p className="text-bq-emerald font-extrabold text-[13px] mb-0.5">{t('results.strongest')}</p>
                    <p className="text-bq-ink font-bold text-[14px]">{strongest.book} ({Math.round(strongest.acc * 100)}%)</p>
                  </div>
                  <div className="bg-bq-cream border-2 border-bq-ink rounded-2xl p-3">
                    <p className="text-bq-ruby font-extrabold text-[13px] mb-0.5">{t('results.needsImprovement')}</p>
                    <p className="text-bq-ink font-bold text-[14px]">
                      {weakest && weakest.acc < 1 ? `${weakest.book} (${Math.round(weakest.acc * 100)}%)` : t('results.allExcellent')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Visitors played without an account: invite them in. This game is not kept, so the
            card promises only what signing in changes for the next ones. */}
        {!isAuthenticated && (
          <section
            data-testid="quiz-results-guest-signin"
            className="mt-5 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-bq-cream border-[3px] border-bq-ink rounded-bq shadow-bq-card px-5 py-4 text-center sm:text-left"
          >
            <img src="/images/lk/dove-letter.webp" alt="" aria-hidden className="h-14 shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="m-0 font-display text-[18px] font-extrabold text-bq-ink">{t('guest.results.title')}</h2>
              <p className="m-0 mt-1 font-read text-[14px] leading-snug text-bq-ink2">{t('guest.results.body')}</p>
            </div>
            <GoogleSignInButton testId="quiz-results-guest-google" className="w-full sm:w-auto" />
          </section>
        )}

        {/* actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-3">
          <button
            data-testid="quiz-results-review-btn"
            onClick={() => navigate('/review', { state: { stats } })}
            className="lk-btn lk-btn-2 w-full text-bq-ink text-[16px]"
          >
            <span className="md:hidden">{t('results.review')}</span>
            <span className="hidden md:inline">{t('results.actions.reviewLong')}</span>
          </button>
          <button
            data-testid="quiz-results-play-btn"
            onClick={onPlayAgain}
            className="lk-btn w-full text-bq-ink text-[18px]"
          >
            <span className="md:hidden">{t('results.playAgain')}</span>
            <span className="hidden md:inline">{t('results.actions.playAgainBook')}</span>
          </button>
        </div>
        <button
          data-testid="quiz-results-home-btn"
          onClick={onBackToHome}
          className="mt-3 mx-auto px-4 py-1.5 rounded-full bg-bq-white/85 border-2 border-bq-ink text-[14px] font-bold text-bq-ink hover:bg-bq-cream"
        >
          {t('results.actions.backHome')}
        </button>
      </main>

      {/* /quiz lives outside AppLayout (immersive play); results bring the bottom tabs back on phones. */}
      <MobileBottomTabs />
    </div>
  )
}

export default QuizResults
