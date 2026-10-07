import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import confetti from 'canvas-confetti'
import { soundManager } from '../services/soundManager'
import { haptic } from '../utils/haptics'
import MobileBottomTabs from '../layouts/components/MobileBottomTabs'

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
      book,
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
  }, [stats])

  if (!stats) {
    return (
      <div className="min-h-screen bg-bq-paper flex items-center justify-center p-4">
        <div className="bg-bq-white p-8 rounded-2xl text-center max-w-md w-full border border-bq-hair shadow-bq-soft">
          <span className="material-symbols-outlined text-bq-ruby text-5xl mb-4 block">error</span>
          <h2 className="text-2xl font-display font-black text-bq-ink mb-2">{t('results.noData')}</h2>
          <p className="text-bq-ink2 text-sm mb-6">{t('results.errorLoading')}</p>
          <button onClick={onBackToHome} className="bg-bq-action text-bq-ink shadow-bq-action hover:brightness-105 font-black px-8 py-3 rounded-xl transition">
            {t('errors.goHome')}
          </button>
        </div>
      </div>
    )
  }

  // Hero variant tokens — high = emerald (success), low = sapphire (info).
  // Hero is a white card + spectrum strip + amber shadow; accent only tints
  // the radial glow, the tone message and the accuracy figure.
  // Storybook (LK) stars, like the game's level result (LKD-14): 3 ≥ 90%, 2 ≥ 70%, 1 ≥ 40%.
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 40 ? 1 : 0
  const heroMessageClass = isHigh ? 'text-bq-emerald' : 'text-bq-sapphire'
  const accuracyColor = isHigh ? 'text-bq-emerald' : 'text-bq-sapphire'

  // Insight card (only show if we have a clear book context)
  const showInsight = books.length === 1
  const insightTone = isHigh
    ? { bg: 'bg-bq-inset', border: 'border-bq-hair', iconBg: 'bg-bq-emerald/10', iconBorder: 'border-bq-emerald/25', iconColor: 'text-bq-emerald' }
    : { bg: 'bg-bq-inset', border: 'border-bq-hair', iconBg: 'bg-bq-sapphire/10', iconBorder: 'border-bq-sapphire/25', iconColor: 'text-bq-sapphire' }

  // Multi-book breakdown
  const sorted = [...books].sort((a, b) => b.acc - a.acc)
  const strongest = sorted[0]
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null

  const diffMeta = {
    easy: { label: t('results.difficulty.easy'), labelShort: t('results.difficulty.easy'), labelColor: 'text-bq-emerald', barClass: 'bg-bq-emerald' },
    medium: { label: t('results.difficulty.medium'), labelShort: t('results.difficulty.mediumShort'), labelColor: 'text-bq-sapphire', barClass: 'bg-bq-sapphire' },
    hard: { label: t('results.difficulty.hard'), labelShort: t('results.difficulty.hard'), labelColor: 'text-bq-ruby', barClass: 'bg-bq-ruby' }
  } as const

  return (
    <div data-testid="quiz-results-page" className="min-h-screen bg-bq-paper p-4 py-8 md:py-12 pb-28 md:pb-12">
      <main className="max-w-2xl mx-auto w-full flex flex-col">

        {/* HERO BLOCK — Storybook (LK) sticker card: the traveller + stars */}
        <section
          className="relative overflow-hidden rounded-bq border-[3px] border-bq-ink bg-bq-white shadow-bq-card px-6 py-7 md:px-8 md:py-8 mb-4 text-center"
          data-testid="quiz-results-hero"
        >
          <div className="relative z-10">
            <img
              src={isHigh ? '/images/lk/hero-cheer.webp' : '/images/lk/hero.webp'}
              alt=""
              aria-hidden
              className="h-28 md:h-32 w-auto mx-auto mb-1"
            />
            <div
              data-testid="quiz-results-stars"
              aria-label={t('results.starsLabel', { count: stars, defaultValue: '{{count}}/3 sao' })}
              className="text-4xl md:text-5xl font-extrabold tracking-[0.12em] text-bq-amber [-webkit-text-stroke:2px_#1D2B22] mb-1"
            >
              <span>{'★'.repeat(stars)}</span>
              <span className="text-bq-track">{'★'.repeat(3 - stars)}</span>
            </div>
            <h1
              data-testid="quiz-results-grade"
              className={`font-display text-2xl md:text-[28px] font-extrabold leading-tight mb-1.5 ${heroMessageClass}`}
            >
              {t(`results.tones.${tone}`)}
            </h1>
            <p className="text-xs md:text-sm text-bq-ink2 max-w-md mx-auto mb-5 leading-relaxed">
              {t(`results.tonesSub.${tone}`, { book: primaryBook || '' })}
            </p>

            {/* 3 stat row */}
            <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
              <div className="bg-bq-inset border-2 border-bq-ink rounded-2xl py-3 px-2">
                <div data-testid="quiz-results-score" className="font-display text-lg md:text-xl font-extrabold leading-none mb-1 tabular-nums text-bq-ink">
                  {stats.correctAnswers}
                  <span className="text-bq-ink3 font-semibold text-[0.7em]">/{stats.totalQuestions}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-bq-ink2">
                  <span className="md:hidden">{t('results.stats.correctShort')}</span>
                  <span className="hidden md:inline">{t('results.stats.correct')}</span>
                </div>
              </div>
              <div className="bg-bq-inset border-2 border-bq-ink rounded-2xl py-3 px-2">
                <div data-testid="quiz-results-accuracy" className={`font-display text-lg md:text-xl font-extrabold leading-none mb-1 tabular-nums ${accuracyColor}`}>
                  {accuracy}%
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-bq-ink2">{t('results.stats.accuracyShort')}</div>
              </div>
              <div className="bg-bq-inset border-2 border-bq-ink rounded-2xl py-3 px-2">
                <div data-testid="quiz-results-total-score" className="font-display text-lg md:text-xl font-extrabold leading-none mb-1 tabular-nums text-bq-amberd">
                  {scoreDisplay}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-bq-ink2">
                  <span className="md:hidden">{t('results.stats.scoreShort')}</span>
                  <span className="hidden md:inline">{t('results.stats.score')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SCORE BREAKDOWN — only when there are real bonuses */}
        {breakdown && (
          <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl px-5 py-4 md:px-6 md:py-5 mb-3.5" data-testid="quiz-results-breakdown">
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-bq-ink2 inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-bq-amberd">check_circle</span>
                {t('results.breakdown.base')}
              </span>
              <span className="font-bold text-bq-ink tabular-nums">{breakdown.base}</span>
            </div>
            {breakdown.speed > 0 && (
              <div className="flex items-center justify-between py-2 text-sm border-t border-bq-hair">
                <span className="text-bq-ink2 inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-bq-amberd">timer</span>
                  {t('results.breakdown.speedBonus')}
                </span>
                <span className="font-bold text-bq-emerald tabular-nums">+{breakdown.speed}</span>
              </div>
            )}
            {breakdown.combo > 0 && (
              <div className="flex items-center justify-between py-2 text-sm border-t border-bq-hair">
                <span className="text-bq-ink2 inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-bq-amberd">local_fire_department</span>
                  {t('results.breakdown.combo', { multiplier: breakdown.multiplier })}
                </span>
                <span className="font-bold text-bq-emerald tabular-nums">+{breakdown.combo}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3.5 mt-1.5 border-t-2 border-bq-hair">
              <span className="font-bold text-bq-ink text-[15px]">{t('results.breakdown.total')}</span>
              <span className="font-display text-[22px] font-extrabold text-bq-amberd tabular-nums">
                {scoreDisplay}
              </span>
            </div>
          </section>
        )}

        {/* INSIGHT CARD — only single-book context (placeholder text, no percentile API yet) */}
        {showInsight && (
          <section className={`flex items-center gap-3.5 rounded-2xl border ${insightTone.border} ${insightTone.bg} px-4 py-3.5 mb-3.5`} data-testid="quiz-results-insight">
            <div className={`w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0 border ${insightTone.iconBorder} ${insightTone.iconBg} ${insightTone.iconColor}`}>
              <span className="material-symbols-outlined text-[22px]">{isHigh ? 'trophy' : 'insights'}</span>
            </div>
            <p className="text-xs md:text-[13px] text-bq-ink2 leading-relaxed">
              {primaryBook && (
                <>
                  <strong className={isHigh ? 'text-bq-emerald font-bold' : 'text-bq-sapphire font-bold'}>
                    {primaryBook}
                  </strong>
                  {' · '}
                </>
              )}
              {t('results.stats.correct')}: <strong className="text-bq-ink font-bold">{stats.correctAnswers}/{stats.totalQuestions}</strong>
              {isHigh && <> · <strong className="text-bq-emerald font-bold">+1 streak</strong> 🔥</>}
            </p>
          </section>
        )}

        {/* ANALYSIS — diff rows for single-book; strongest/weakest for multi-book */}
        {books.length === 1 && diffRows.length > 0 && (
          <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl px-5 py-4 md:px-6 md:py-5 mb-4">
            <h3 className="text-[13px] font-bold mb-3.5 flex items-center gap-2 text-bq-ink">
              <span className="material-symbols-outlined text-base text-bq-amberd">analytics</span>
              {t('results.difficulty.title')}
            </h3>
            <div className="space-y-1">
              {diffRows.map(row => {
                const meta = diffMeta[row.key]
                return (
                  <div key={row.key} className="grid grid-cols-[58px_1fr_60px] md:grid-cols-[80px_1fr_70px] gap-2.5 items-center py-1.5">
                    <div className={`text-xs font-bold ${meta.labelColor}`}>
                      <span className="md:hidden">{meta.labelShort}</span>
                      <span className="hidden md:inline">{meta.label}</span>
                    </div>
                    <div className="h-2 bg-bq-inset rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${meta.barClass} transition-[width] duration-500`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <div className="text-xs font-bold text-bq-ink text-right tabular-nums">
                      {row.correct}/{row.total} <span className="text-bq-ink3 text-[10px] font-medium">{row.pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {books.length > 1 && strongest && (
          <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl px-5 py-4 md:px-6 md:py-5 mb-4">
            <h3 className="text-[13px] font-bold mb-3.5 flex items-center gap-2 text-bq-ink">
              <span className="material-symbols-outlined text-base text-bq-amberd">analytics</span>
              {t('results.analysis')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bq-emerald/5 border border-bq-emerald/20 rounded-xl p-3.5">
                <p className="text-bq-emerald font-bold text-xs mb-1">{t('results.strongest')}</p>
                <p className="text-bq-ink font-bold text-sm">{strongest.book} ({Math.round(strongest.acc * 100)}%)</p>
              </div>
              <div className="bg-bq-ruby/5 border border-bq-ruby/20 rounded-xl p-3.5">
                <p className="text-bq-ruby font-bold text-xs mb-1">{t('results.needsImprovement')}</p>
                <p className="text-bq-ink font-bold text-sm">
                  {weakest && weakest.acc < 1 ? `${weakest.book} (${Math.round(weakest.acc * 100)}%)` : t('results.allExcellent')}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ACTIONS */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2">
          <button
            data-testid="quiz-results-review-btn"
            onClick={() => navigate('/review', { state: { stats } })}
            className="w-full py-3.5 rounded-xl border border-bq-hair bg-bq-white text-bq-ink2 hover:text-bq-ink hover:bg-bq-inset font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            <span className="md:hidden">{t('results.review')}</span>
            <span className="hidden md:inline">{t('results.actions.reviewLong')}</span>
          </button>
          <button
            data-testid="quiz-results-play-btn"
            onClick={onPlayAgain}
            className="w-full py-3.5 rounded-xl bg-bq-action text-bq-ink shadow-bq-action font-extrabold text-sm flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span className="md:hidden">{t('results.playAgain')}</span>
            <span className="hidden md:inline">{t('results.actions.playAgainBook')}</span>
          </button>
        </div>
        <button
          data-testid="quiz-results-home-btn"
          onClick={onBackToHome}
          className="mt-2 w-full py-2.5 text-xs text-bq-ink3 hover:text-bq-ink2 underline underline-offset-[3px]"
        >
          {t('results.actions.backHome')}
        </button>

      </main>

      {/* /quiz route lives OUTSIDE AppLayout for immersive gameplay
          (main.tsx line 181-186) so MobileBottomTabs would normally be
          hidden here. Surface them on the Results screen — gameplay is
          over, the user wants nav back. The pb-28 above on the wrapper
          adds the 80px clearance so the "Về trang chủ" link doesn't
          sit under the fixed bar. */}
      <MobileBottomTabs />
    </div>
  )
}

export default QuizResults
