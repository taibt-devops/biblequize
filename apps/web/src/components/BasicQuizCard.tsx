import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Server contract — mirrors apps/api ../dto/basicquiz/BasicQuizStatusResponse.java.
 * `cooldownRemainingSeconds` is the live countdown source-of-truth; we
 * tick it down locally each second so the FE doesn't hammer the BE, then
 * refetch from the server when it should hit zero (clock skew safety).
 */
interface BasicQuizStatus {
  passed: boolean
  passedAt: string | null
  attemptCount: number
  cooldownRemainingSeconds: number
  totalQuestions: number
  threshold: number
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds | 0)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Bible Basics catechism unlock card — 4 states:
 *  1. First time (attempts=0, not passed) — start-CTA points at /basic-quiz.
 *  2. Retry      (attempts>0, no cooldown) — retake-CTA points at /basic-quiz.
 *  3. Cooldown   (cooldownRemainingSeconds>0) — countdown, button disabled.
 *  4. Passed     — completion badge + CTA points at /ranked.
 *
 * Renders above GameModeGrid on Home. Replaces the Tier-2 / XP gate that
 * previously locked Ranked. All user-visible copy comes from
 * basicQuiz.card.* keys in vi.json + en.json.
 */
export default function BasicQuizCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Local cooldown ticker — initialized from server, decremented every 1s.
  // Falls back to a server refetch when it hits zero so we never trust the
  // local clock for the decision "may submit?".
  const [localCooldown, setLocalCooldown] = useState<number>(0)

  const { data, isLoading, refetch } = useQuery<BasicQuizStatus>({
    queryKey: ['basic-quiz-status'],
    queryFn: () => api.get('/api/basic-quiz/status').then(r => r.data),
    staleTime: 30_000,
  })

  // Sync local ticker whenever fresh server data arrives.
  useEffect(() => {
    if (data) setLocalCooldown(data.cooldownRemainingSeconds)
  }, [data])

  // Tick down each second when cooldown active; refetch on hitting zero
  // to confirm with the server before re-enabling the CTA.
  useEffect(() => {
    if (localCooldown <= 0) return
    const id = window.setInterval(() => {
      setLocalCooldown(prev => {
        const next = prev - 1
        if (next <= 0) {
          // Confirm with server then drop to 0 here regardless.
          refetch()
          return 0
        }
        return next
      })
    }, 1_000)
    return () => window.clearInterval(id)
  }, [localCooldown, refetch])

  if (isLoading || !data) {
    return (
      <div
        data-testid="basic-quiz-card-skeleton"
        className="glass-card rounded-2xl p-6 h-[180px] animate-pulse bg-surface-container"
      />
    )
  }

  const { passed, attemptCount, totalQuestions, threshold } = data
  const inCooldown = !passed && localCooldown > 0

  // ── State 4 — passed ──
  if (passed) {
    return (
      <section
        data-testid="basic-quiz-card"
        data-state="passed"
        className="glass-card rounded-2xl p-6 border border-secondary/20 gold-glow"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-secondary text-base" style={FILL_1}>verified</span>
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">
            {t('basicQuiz.card.passedBadge')}
          </span>
        </div>
        <h3 className="text-2xl font-black text-on-surface mb-2">
          {t('basicQuiz.card.rankedHeader')}
        </h3>
        <p className="text-sm text-on-surface-variant mb-4">
          {t('basicQuiz.card.rankedDescription')}
        </p>
        <button
          data-testid="basic-quiz-card-cta"
          onClick={() => navigate('/ranked')}
          className="gold-gradient text-on-secondary px-6 py-3 rounded-xl font-bold w-full sm:w-auto active:scale-95 shadow-lg shadow-secondary/10"
        >
          <span className="material-symbols-outlined align-middle text-base mr-1" style={FILL_1}>play_arrow</span>
          {t('basicQuiz.card.ctaRanked')}
        </button>
      </section>
    )
  }

  // ── States 1-3 — not passed yet ──
  const ctaLabel = inCooldown
    ? t('basicQuiz.card.ctaCooldown', { time: formatMmSs(localCooldown) })
    : attemptCount > 0
      ? t('basicQuiz.card.ctaRetry')
      : t('basicQuiz.card.ctaFirst')
  const stateLabel: 'first' | 'retry' | 'cooldown' = inCooldown
    ? 'cooldown'
    : attemptCount > 0
      ? 'retry'
      : 'first'

  return (
    <section
      data-testid="basic-quiz-card"
      data-state={stateLabel}
      className="glass-card rounded-2xl p-6 border border-secondary/30"
    >
      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-12 h-12 rounded-xl bg-secondary/10 items-center justify-center text-secondary shrink-0">
          <span className="material-symbols-outlined" style={FILL_1}>menu_book</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-black text-on-surface mb-1">
            {t('basicQuiz.card.unlockHeader')}
          </h3>
          <p className="text-sm text-on-surface-variant mb-3">
            {t('basicQuiz.card.subtitle', { total: totalQuestions, threshold })}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant mb-4">
            {attemptCount > 0 && (
              <span data-testid="basic-quiz-attempts">
                {t('basicQuiz.card.attemptCount', { count: attemptCount })}
              </span>
            )}
            {inCooldown && (
              <span data-testid="basic-quiz-cooldown" className="text-secondary font-semibold">
                <span className="material-symbols-outlined align-middle text-sm mr-1">timer</span>
                {t('basicQuiz.card.cooldownLabel')}: {formatMmSs(localCooldown)}
              </span>
            )}
          </div>

          <button
            data-testid="basic-quiz-card-cta"
            disabled={inCooldown}
            onClick={() => navigate('/basic-quiz')}
            className={
              inCooldown
                ? 'bg-surface-container-highest text-on-surface-variant px-6 py-3 rounded-xl font-bold w-full sm:w-auto cursor-not-allowed opacity-70'
                : 'gold-gradient text-on-secondary px-6 py-3 rounded-xl font-bold w-full sm:w-auto active:scale-95 shadow-lg shadow-secondary/10'
            }
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
