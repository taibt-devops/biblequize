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
 * Hero card on Home for the daily challenge. Pulls today's 5 questions from
 * {@code /api/daily-challenge}, derives the unique book set, and renders a
 * tagline that scales with variety: singleBook / fewBooks (2-3) / manyBooks
 * (4-5). Translations live in {@code home.featuredDaily.*}.
 *
 * Daily challenge selection is random across all active questions
 * (DailyChallengeService) so the book mix is the natural way to give the
 * card a "today is unique" feel without backend changes — see
 * docs/prompts/PROMPT_HOME_REFACTOR_FIXES.md Fix 1 v2.
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

  // Only fetch the enriched completion payload (score / xpEarned /
  // nextResetAt) once the parent query confirms the user finished today.
  // Otherwise the call would return {completed: false} and waste a request.
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
      <div data-testid="featured-daily-loading" className="rounded-2xl bg-surface-container p-8 border border-outline-variant/10 animate-pulse">
        <div className="h-4 w-32 bg-surface-container-high rounded mb-4" />
        <div className="h-8 w-3/4 bg-surface-container-high rounded mb-3" />
        <div className="h-4 w-1/2 bg-surface-container-high rounded mb-6" />
        <div className="h-12 w-full bg-surface-container-high rounded" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div data-testid="featured-daily-error" className="rounded-2xl bg-surface-container p-8 border border-outline-variant/10">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-tertiary text-2xl" style={FILL_1}>calendar_today</span>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {t('home.featuredDaily.title')}
          </h2>
        </div>
        <p className="text-lg font-bold text-on-surface mb-4">{t('home.featuredDaily.errorFallback')}</p>
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
        className="featured-daily-warm rounded-2xl p-8 group"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-secondary text-2xl" style={FILL_1}>verified</span>
            <h2 className="text-xs font-bold text-secondary uppercase tracking-widest">
              {t('home.featuredDaily.completedState.title')}
            </h2>
          </div>

          <p
            data-testid="featured-daily-score"
            className="text-2xl md:text-3xl font-black text-on-surface mb-2 leading-tight"
          >
            {t(scoreKey, { correct, total })}
          </p>

          <p data-testid="featured-daily-theme" className="text-sm font-medium text-on-surface-variant mb-1">
            {t('home.featuredDaily.completedState.themeLabel', { theme: tagline })}
          </p>

          <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-6">
            {t('home.featuredDaily.completedState.xpEarned', { xp: xpEarned })}
          </p>

          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-sm">timer</span>
            <span data-testid="featured-daily-countdown">
              {t('home.featuredDaily.completedState.nextChallenge', { time: countdown })}
            </span>
          </div>

          <Link
            to="/daily"
            data-testid="featured-daily-review-cta"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-secondary/40 text-secondary font-bold hover:bg-secondary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base" style={FILL_1}>menu_book</span>
            {t('home.featuredDaily.completedState.ctaReview')}
          </Link>
        </div>
      </div>
    )
  }

  // ── State A: active (not completed) ──
  return (
    <div data-testid="featured-daily-challenge" data-state="active" className="featured-daily-warm rounded-2xl p-8 group">
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-tertiary text-2xl" style={FILL_1}>calendar_today</span>
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {t('home.featuredDaily.title')}
          </h2>
        </div>

        <p data-testid="featured-daily-tagline" className="text-2xl md:text-3xl font-black text-on-surface mb-2 leading-tight">
          {tagline}
        </p>

        {uniqueBookNames.length > 1 && (
          <p data-testid="featured-daily-booklist" className="text-sm font-medium text-on-surface-variant mb-4">
            {bookList}
          </p>
        )}

        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6">
          {t('home.featuredDaily.meta')}
        </p>

        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-sm">timer</span>
          <span data-testid="featured-daily-countdown">
            {t('home.featuredDaily.countdown', { time: countdown })}
          </span>
        </div>
        <Link
          to="/daily"
          data-testid="featured-daily-cta"
          className="block w-full text-center gold-gradient text-on-secondary font-black py-4 rounded-xl shadow-lg shadow-secondary/10 active:scale-95 transition-transform uppercase tracking-tight"
        >
          ▶  {t('home.featuredDaily.cta')}
        </Link>
      </div>
    </div>
  )
}
