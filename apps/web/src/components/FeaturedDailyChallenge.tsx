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

  return (
    <div data-testid="featured-daily-challenge" className="relative overflow-hidden rounded-2xl bg-surface-container p-8 border border-outline-variant/10 group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-tertiary/10 transition-colors" />

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

        {completed ? (
          <p data-testid="featured-daily-completed" className="text-sm font-medium text-secondary">
            {t('home.featuredDaily.completed', { time: countdown })}
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
