import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { api } from '../../api/client'

interface SessionItem {
  id: string
  mode: string
  status: string
  score: number | null
  totalQuestions: number | null
  correctAnswers: number | null
  createdAt: string
  /** Some sessions store the active book; surface it when present so
   *  rows can label the row with what the user was studying. */
  currentBook?: string | null
}

interface HistoryResponse {
  items: SessionItem[]
  totalPages: number
  totalItems: number
  currentPage: number
  hasMore: boolean
}

/**
 * Tiny formatter shared with NotificationBell — kept inline rather
 * than promoted to a util because the ranges here are coarse (we
 * never need seconds resolution) and the helper is used in exactly
 * two surfaces with different i18n key sets.
 */
function timeAgo(dateStr: string, t: TFunction): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('header.time.justNow')
  if (diffMin < 60) return t('header.time.minutesAgo', { count: diffMin })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return t('header.time.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('header.time.daysAgo', { count: diffDays })
}

interface RowProps {
  match: SessionItem
}

function MatchRow({ match }: RowProps) {
  const { t } = useTranslation()
  const total = match.totalQuestions ?? 0
  const correct = match.correctAnswers ?? 0
  const accuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0
  const score = match.score ?? 0
  // "Pass" if accuracy ≥ 60% — same threshold the daily-challenge
  // celebrate copy uses (scoreMessageKey in FeaturedDailyChallenge),
  // so the ✓/✗ glyph stays consistent across surfaces.
  const passed = accuracyPct >= 60

  return (
    <Link
      to={`/sessions/${match.id}/review`}
      data-testid="ranked-match-row"
      className="rounded-md border border-white/[0.04] flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-high/40 transition-colors"
      style={{
        background: 'rgba(50,52,64,0.4)',
        borderLeftWidth: '2px',
        borderLeftColor: passed ? '#639922' : 'rgba(255,180,171,0.5)',
      }}
    >
      <div
        className="text-[12px] font-medium w-3.5 shrink-0 text-center"
        style={{ color: passed ? '#639922' : 'rgba(255,180,171,0.7)' }}
      >
        {passed ? '✓' : '✗'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-on-surface text-[12px] font-medium truncate">
          {match.currentBook ?? t('ranked.title')}
        </div>
        <div className="text-on-surface-variant/45 text-[10px]">
          {t('ranked.recentMatchMeta', {
            count: total,
            percent: accuracyPct,
            ago: timeAgo(match.createdAt, t),
          })}
        </div>
      </div>
      <div
        className="text-[13px] font-medium shrink-0"
        style={{ color: passed ? '#e8a832' : 'rgba(255,255,255,0.4)' }}
      >
        +{score}
      </div>
    </Link>
  )
}

/**
 * Recent-matches section on /ranked — surfaces the 3 most recent ranked
 * sessions so the user has momentum context when they return (RK-P2-3).
 *
 * Fetches /api/me/history (no `mode` query param yet — R10 will add)
 * and filters client-side to {@code mode === 'ranked'}. Until R10
 * lands, fetching limit=20 + filtering keeps the FE simple and a
 * single roundtrip; once the BE supports the filter we can drop the
 * client-side filter.
 *
 * Each row links to /sessions/{id}/review — the existing review
 * route — so users can re-walk their answers.
 */
export default function RecentMatchesSection() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['ranked-history'],
    queryFn: () => api.get('/api/me/history?limit=20').then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return null
  const ranked = (data?.items ?? []).filter(s => s.mode === 'ranked').slice(0, 3)

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-on-surface/85 text-[13px] font-medium">
          {t('ranked.recentMatchesSection')}
        </span>
        <Link
          to="/profile?tab=history"
          data-testid="ranked-recent-matches-view-all"
          className="text-secondary text-[11px] hover:underline"
        >
          {t('ranked.recentMatchesViewAll')}
        </Link>
      </div>

      {ranked.length === 0 ? (
        <div
          data-testid="ranked-recent-matches-empty"
          className="rounded-md border border-white/[0.04] px-3 py-4 text-center"
          style={{ background: 'rgba(50,52,64,0.4)' }}
        >
          <p className="text-on-surface-variant/55 text-[11px]">
            {t('ranked.recentMatchEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {ranked.map(match => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      )}
    </section>
  )
}
