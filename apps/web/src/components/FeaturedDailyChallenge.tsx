import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useBookName } from '../hooks/useBookName'
import { localizeSeasonName } from '../utils/seasonName'

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

interface DailyChallengeResult {
  completed: boolean
  correctCount?: number
  totalQuestions?: number
  xpEarned?: number
  nextResetAt?: string
}

interface SeasonResponse {
  active: boolean
  id?: string
  name?: string
  startDate?: string
  endDate?: string
}

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
 * Daily Challenge hero (HR-2 redesign) per
 * docs/designs/home_redesign_mockup.html `.dc-hero`. 3-col grid: red→orange
 * icon | label/title/meta-chips | CTA + countdown stacked. Mobile collapses
 * to single column. Three states preserved: loading, active, completed.
 *
 * Season chip shows only the season name (no XP multiplier) because BE
 * does not currently apply any season multiplier to Daily Challenge.
 * Daily XP follows the 0/20/40/60/100/150 curve (DECISIONS.md 2026-06-16).
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

  const { data: season } = useQuery<SeasonResponse>({
    queryKey: ['season-active'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 5 * 60_000,
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
    if (count === 1) return t('home.featuredDaily.singleBook', { book: uniqueBookNames[0] })
    if (count <= 3) return t('home.featuredDaily.fewBooks', { count })
    return t('home.featuredDaily.manyBooks', { count })
  }, [uniqueBookNames, t])

  const countdown = formatCountdown(msUntilMidnightUtc())

  if (isLoading) {
    return (
      <div data-testid="featured-daily-loading" className="rounded-2xl bg-bq-white p-5 border border-bq-hair shadow-bq-soft animate-pulse">
        <div className="h-3 w-28 bg-bq-inset rounded mb-3" />
        <div className="h-6 w-3/4 bg-bq-inset rounded mb-2" />
        <div className="h-3 w-1/2 bg-bq-inset rounded mb-4" />
        <div className="h-3 w-2/3 bg-bq-inset rounded mb-4" />
        <div className="h-10 w-full bg-bq-inset rounded" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div data-testid="featured-daily-error" className="rounded-2xl bg-bq-white p-5 border border-bq-hair shadow-bq-soft">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-bq-amberd text-2xl" style={FILL_1}>calendar_today</span>
          <h2 className="text-xs font-bold text-bq-ink2 uppercase tracking-widest">
            {t('home.featuredDaily.title')}
          </h2>
        </div>
        <p className="text-base font-medium text-bq-ink mb-3">{t('home.featuredDaily.errorFallback')}</p>
        <button
          data-testid="featured-daily-retry"
          onClick={() => refetch()}
          className="text-xs font-bold text-bq-amberd uppercase tracking-widest hover:underline"
        >
          {t('home.featuredDaily.retry')} →
        </button>
      </div>
    )
  }

  const completed = data.alreadyCompleted
  const seasonName = season?.active && season.name
    ? (localizeSeasonName(season.name, t) ?? season.name)
    : null

  // ── State B: completed today ──
  if (completed) {
    const correct = resultData?.correctCount ?? 0
    const total = resultData?.totalQuestions ?? data.totalQuestions ?? 5
    const xpEarned = resultData?.xpEarned ?? 0
    const scoreKey = scoreMessageKey(correct, total)

    return (
      <div
        data-testid="featured-daily-challenge"
        data-state="completed"
        className="relative overflow-hidden rounded-2xl border border-bq-hair bg-bq-white shadow-bq-soft p-5 md:p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] md:text-[11px] font-bold text-bq-ink2 uppercase tracking-[0.6px] md:tracking-[0.8px]">
            {t('home.featuredDaily.completedState.title')}
          </h2>
          <span className="bg-bq-emerald/10 text-bq-emerald px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium">
            {t('home.featuredDaily.doneBadge')}
          </span>
        </div>

        <p
          data-testid="featured-daily-score"
          className="text-bq-ink text-[15px] md:text-[17px] font-medium mb-1.5 leading-tight"
        >
          {t(scoreKey, { correct, total })}
        </p>

        <p
          data-testid="featured-daily-theme"
          className="text-[11px] md:text-xs text-bq-ink2 leading-relaxed mb-3"
        >
          {t('home.featuredDaily.completedState.themeLabel', { theme: tagline })}
        </p>

        <p className="text-[10px] md:text-[11px] font-medium text-bq-amberd uppercase tracking-widest mb-3">
          {t('home.featuredDaily.completedState.xpEarned', { xp: xpEarned })}
        </p>

        <Link
          to="/daily"
          data-testid="featured-daily-review-cta"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-bq-hair text-bq-ink2 font-medium hover:border-bq-amber/30 hover:bg-bq-paper transition-colors text-sm"
        >
          <span className="material-symbols-outlined text-base" style={FILL_1}>menu_book</span>
          {t('home.featuredDaily.completedState.ctaReview')}
        </Link>

        <div
          data-testid="featured-daily-countdown"
          className="text-[10px] md:text-[11px] text-bq-ink3 mt-3"
        >
          {t('home.featuredDaily.completedState.nextChallenge', { time: countdown })}
        </div>
      </div>
    )
  }

  // ── State A: active (mockup .dc-hero — 3-col grid: icon | info | CTA) ──
  return (
    <div
      data-testid="featured-daily-challenge"
      data-state="active"
      className="relative overflow-hidden rounded-2xl border border-bq-amber/30 bg-bq-white shadow-bq-amb p-5 md:p-6"
    >
      {/* Signature spectrum top strip */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[5px] bg-bq-spectrum" />

      {/* Decorative radial blob (top-right) */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-[200px] h-[200px] rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(245,158,11,0.10)_0%,transparent_70%)]"
      />

      <div className="relative">
        {/* Mobile: icon + info on row 1, meta full-width row 2, CTA full-width row 3.
            Desktop: 3-col grid (icon | info+meta | CTA stack). */}
        <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-x-3 md:gap-x-6 gap-y-3 md:gap-y-0 items-center">
          <div
            data-testid="featured-daily-icon"
            className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl grid place-items-center text-white shadow-bq-flame bg-bq-flame shrink-0"
          >
            <span className="material-symbols-outlined text-[24px] md:text-[32px]" style={FILL_1}>local_fire_department</span>
          </div>

          <div className="min-w-0">
            <div
              data-testid="featured-daily-label"
              className="text-[10px] md:text-[11px] font-bold text-bq-amberd uppercase tracking-[0.8px] md:tracking-[1px] mb-0.5 md:mb-1"
            >
              {t('home.featuredDaily.title')}
            </div>
            <div
              data-testid="featured-daily-tagline"
              className="font-display text-[17px] md:text-[22px] font-extrabold leading-tight md:mb-2 text-bq-ink tracking-[-0.3px]"
            >
              {tagline || t('home.featuredDaily.errorFallback')}
            </div>

            <div
              data-testid="featured-daily-meta"
              className="hidden md:flex flex-wrap gap-2"
            >
              <MetaChip icon="timer">{t('home.featuredDaily.metaTime')}</MetaChip>
              <MetaChip icon="quiz">{t('home.featuredDaily.metaQuestions')}</MetaChip>
              <MetaChip icon="workspace_premium" tone="reward">
                {t('home.featuredDaily.metaXp')}
              </MetaChip>
              {seasonName && (
                <MetaChip testId="featured-daily-season-chip" icon="auto_awesome" tone="season">
                  {seasonName}
                </MetaChip>
              )}
            </div>
          </div>

          {/* Mobile-only meta chips row (full width). Desktop renders meta inside info col above. */}
          <div className="md:hidden col-span-2 flex flex-wrap gap-1.5">
            <MetaChip icon="timer">{t('home.featuredDaily.metaTime')}</MetaChip>
            <MetaChip icon="quiz">{t('home.featuredDaily.metaQuestions')}</MetaChip>
            <MetaChip icon="workspace_premium" tone="reward">
              {t('home.featuredDaily.metaXp')}
            </MetaChip>
            {seasonName && (
              <MetaChip icon="auto_awesome" tone="season">
                {seasonName}
              </MetaChip>
            )}
          </div>

          {/* CTA + countdown — full width mobile, right-aligned col desktop */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-stretch md:items-end gap-2 md:min-w-[180px]">
            <Link
              to="/daily"
              data-testid="featured-daily-cta"
              className="inline-flex items-center justify-center gap-2 px-5 md:px-6 py-3 md:py-3.5 rounded-xl bg-bq-action text-bq-ink shadow-bq-action font-extrabold text-[15px] hover:-translate-y-0.5 transition-transform"
            >
              {t('home.featuredDaily.cta')}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
            <div
              data-testid="featured-daily-countdown"
              className="text-[11px] text-bq-ink2 tabular-nums text-center md:text-right"
            >
              {t('home.featuredDaily.countdownShort', { time: countdown })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MetaChipProps {
  icon: string
  children: React.ReactNode
  tone?: 'default' | 'reward' | 'season'
  testId?: string
}

function MetaChip({ icon, children, tone = 'default', testId }: MetaChipProps) {
  const toneCls =
    tone === 'reward'
      ? 'text-bq-amberd border-bq-amber/30'
      : tone === 'season'
        ? 'text-bq-sapphire border-bq-sapphire/30'
        : 'text-bq-ink2 border-bq-hair'
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-bq-paper border text-[12px] font-semibold ${toneCls}`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {children}
    </span>
  )
}
