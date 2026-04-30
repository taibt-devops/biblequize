import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useBookName } from '../hooks/useBookName'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface DailyChallengeQuestion {
  id: string
  book: string
  chapter: number
}

interface DailyChallengeResponse {
  date: string
  questions: DailyChallengeQuestion[]
  alreadyCompleted: boolean
  totalQuestions: number
}

/**
 * Mirror of {@link com.biblequiz.modules.daily.service.DailyChallengeService#getResultData}.
 * Only present (i.e. fields beyond {@code completed}) when the user
 * actually finished today.
 */
interface DailyChallengeResult {
  completed: boolean
  correctCount?: number
  totalQuestions?: number
  xpEarned?: number
  nextResetAt?: string
}

/**
 * Pick a celebratory message keyed by accuracy bucket. Three buckets so
 * the copy stays warm without leaking exact percentile data (which
 * would need an aggregate query we don't have yet).
 */
function scoreMessageKey(correct: number, total: number): string {
  if (total <= 0) return 'home.featuredDaily.completedState.scoreEncouraging'
  const pct = (correct / total) * 100
  if (pct >= 80) return 'home.featuredDaily.completedState.scoreExcellent'
  if (pct >= 60) return 'home.featuredDaily.completedState.scoreGood'
  return 'home.featuredDaily.completedState.scoreEncouraging'
}

function msUntilMidnightUtc(): number {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0,
  ))
  return utcMidnight.getTime() - now.getTime()
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Daily Challenge compact card per
 * docs/designs/biblequiz_home_redesign_proposal.html. Renders one of
 * three states: loading skeleton, active (CTA), or completed (review).
 *
 * Data source: GET /api/daily-challenge for today's tagline + book mix,
 * plus GET /api/daily-challenge/result (gated on {@code alreadyCompleted})
 * for the score breakdown shown in the completed state.
 *
 * Layout differs between desktop and mobile:
 *   - desktop: countdown sits inline at the right of the meta row
 *   - mobile (< md): countdown drops to its own line under the CTA
 *     (mockup line 69) so the meta row stays scannable on narrow widths.
 */
export default function FeaturedDailyChallenge() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'vi') as 'vi' | 'en'
  const getBookName = useBookName()
  const [, setNow] = useState(Date.now())

  const { data, isLoading, isError, refetch } = useQuery<DailyChallengeResponse>({
    queryKey: ['daily-challenge', lang],
    queryFn: () => api.get(`/api/daily-challenge?language=${lang}`).then(r => r.data),
    staleTime: 60_000,
  })

  const { data: resultData } = useQuery<DailyChallengeResult>({
    queryKey: ['daily-challenge-result'],
    queryFn: () => api.get('/api/daily-challenge/result').then(r => r.data),
    enabled: !!data?.alreadyCompleted,
    staleTime: 60_000,
  })

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const uniqueBookNames = useMemo(() => {
    if (!data?.questions || data.questions.length === 0) return [] as string[]
    const unique = Array.from(new Set(data.questions.map(q => q.book)))
    return unique.map(b => getBookName(b, lang))
  }, [data, getBookName, lang])

  const tagline = useMemo(() => {
    const count = uniqueBookNames.length
    if (count === 0) return ''
    if (count === 1) {
      return t('home.featuredDaily.singleBook', { book: uniqueBookNames[0] })
    }
    if (count <= 3) {
      return t('home.featuredDaily.fewBooks', { count })
    }
    return t('home.featuredDaily.manyBooks', { count })
  }, [uniqueBookNames, t])

  const countdown = formatCountdown(msUntilMidnightUtc())

  if (isLoading) {
    return (
      <div data-testid="featured-daily-loading" className="rounded-2xl bg-surface-container p-5 border border-secondary/20 animate-pulse">
        <div className="h-3 w-28 bg-surface-container-high rounded mb-3" />
        <div className="h-6 w-3/4 bg-surface-container-high rounded mb-2" />
        <div className="h-3 w-1/2 bg-surface-container-high rounded mb-4" />
        <div className="h-3 w-2/3 bg-surface-container-high rounded mb-4" />
        <div className="h-10 w-full bg-surface-container-high rounded" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div data-testid="featured-daily-error" className="rounded-2xl bg-surface-container p-5 border border-secondary/20">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-tertiary text-2xl" style={FILL_1}>calendar_today</span>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {t('home.featuredDaily.title')}
          </h2>
        </div>
        <p className="text-base font-medium text-on-surface mb-3">{t('home.featuredDaily.errorFallback')}</p>
        <button
          data-testid="featured-daily-retry"
          onClick={() => refetch()}
          className="text-xs font-bold text-secondary uppercase tracking-widest hover:underline"
        >
          {t('home.featuredDaily.retry')} →
        </button>
      </div>
    )
  }

  const completed = data.alreadyCompleted
  const bookList = uniqueBookNames.join(' • ')

  // ── State B: completed today ──
  if (completed) {
    const correct = resultData?.correctCount ?? 0
    const total = resultData?.totalQuestions ?? data.totalQuestions ?? 5
    const xpEarned = resultData?.xpEarned ?? 50
    const scoreKey = scoreMessageKey(correct, total)

    return (
      <div
        data-testid="featured-daily-challenge"
        data-state="completed"
        className="relative rounded-2xl bg-[rgba(50,52,64,0.4)] border border-secondary/40 p-4 md:p-5"
      >
        {/* Header row: title label (left) + done badge (right) */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] md:text-[11px] font-bold text-secondary/70 uppercase tracking-[0.6px] md:tracking-[0.8px]">
            {t('home.featuredDaily.completedState.title')}
          </h2>
          <span className="bg-secondary/15 text-secondary px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium">
            {t('home.featuredDaily.doneBadge')}
          </span>
        </div>

        <p
          data-testid="featured-daily-score"
          className="text-on-surface text-[15px] md:text-[17px] font-medium mb-1.5 leading-tight"
        >
          {t(scoreKey, { correct, total })}
        </p>

        <p
          data-testid="featured-daily-theme"
          className="text-[11px] md:text-xs text-on-surface-variant/55 leading-relaxed mb-3"
        >
          {t('home.featuredDaily.completedState.themeLabel', { theme: tagline })}
        </p>

        <p className="text-[10px] md:text-[11px] font-medium text-secondary uppercase tracking-widest mb-3">
          {t('home.featuredDaily.completedState.xpEarned', { xp: xpEarned })}
        </p>

        <Link
          to="/daily"
          data-testid="featured-daily-review-cta"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-secondary/40 text-secondary font-medium hover:bg-secondary/10 transition-colors text-sm"
        >
          <span className="material-symbols-outlined text-base" style={FILL_1}>menu_book</span>
          {t('home.featuredDaily.completedState.ctaReview')}
        </Link>

        <div
          data-testid="featured-daily-countdown"
          className="text-[10px] md:text-[11px] text-on-surface-variant/40 mt-3"
        >
          {t('home.featuredDaily.completedState.nextChallenge', { time: countdown })}
        </div>
      </div>
    )
  }

  // ── State A: active (not completed) ──
  return (
    <div
      data-testid="featured-daily-challenge"
      data-state="active"
      className="relative rounded-2xl bg-[rgba(50,52,64,0.4)] border border-secondary/40 p-4 md:p-5"
    >
      {/* Header row: title label (left) + "ONLY TODAY" pill (right) */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] md:text-[11px] font-bold text-secondary/70 uppercase tracking-[0.6px] md:tracking-[0.8px]">
          {t('home.featuredDaily.title')}
        </h2>
        <span
          data-testid="featured-daily-pill"
          className="bg-secondary/15 text-secondary px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium"
        >
          {t('home.featuredDaily.onlyToday')}
        </span>
      </div>

      {/* Theme tagline */}
      <p
        data-testid="featured-daily-tagline"
        className="text-on-surface text-[15px] md:text-[17px] font-medium mb-1.5 leading-tight"
      >
        {tagline}
      </p>

      {/* Book list (only when ≥2 unique books — single-book tagline already mentions it) */}
      {uniqueBookNames.length > 1 && (
        <p
          data-testid="featured-daily-booklist"
          className="text-[11px] md:text-xs text-on-surface-variant/55 leading-relaxed mb-3"
        >
          {bookList}
        </p>
      )}

      {/* Meta row + inline countdown (desktop only) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] md:text-[11px] mb-3">
        <span className="text-on-surface-variant/60">⏱ {t('home.featuredDaily.metaTime')}</span>
        <span className="text-on-surface-variant/60">📝 {t('home.featuredDaily.metaQuestions')}</span>
        <span className="text-secondary font-medium">{t('home.featuredDaily.metaXp')}</span>
        <span className="hidden md:inline ml-auto text-on-surface-variant/40">
          {t('home.featuredDaily.countdownShort', { time: countdown })}
        </span>
      </div>

      <Link
        to="/daily"
        data-testid="featured-daily-cta"
        className="block w-full text-center gold-gradient text-on-secondary font-medium rounded-lg py-3 md:py-3.5 text-sm md:text-base"
      >
        ▶ {t('home.featuredDaily.cta')}
      </Link>

      {/* Countdown — exposes single testid; desktop variant above is
          for visual placement only (no testid). */}
      <div
        data-testid="featured-daily-countdown"
        className="md:hidden text-center text-[9px] text-on-surface-variant/40 mt-2"
      >
        {t('home.featuredDaily.countdownShort', { time: countdown })}
      </div>
      <div
        data-testid="featured-daily-countdown-desktop"
        className="hidden"
      >
        {t('home.featuredDaily.countdownShort', { time: countdown })}
      </div>
    </div>
  )
}
