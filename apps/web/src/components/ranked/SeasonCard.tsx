import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { localizeSeasonName } from '../../utils/seasonName'

interface ActiveSeasonResponse {
  active: boolean
  id?: string
  name?: string
  startDate?: string
  endDate?: string
}

interface MyRankResponse {
  userId?: string
  rank?: number
  points?: number
  /** R10 will populate; not in BE response yet. */
  totalPlayers?: number
}

const CHAMPIONSHIP_THRESHOLD = 1000
const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

function daysUntil(endDateIso?: string | null): number | null {
  if (!endDateIso) return null
  const end = new Date(endDateIso)
  if (Number.isNaN(end.getTime())) return null
  const now = new Date()
  const ms = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Season card — desktop v2 (mockup_ranked_desktop_v2.html .season
 * 2026-05-20). 2-col grid 1.4fr/1fr on md+:
 *   LEFT  : 🏆 season name (large) + meta row (ends-in + ×1.5 bonus chip)
 *           + Cormorant prize quote + thin progress bar toward championship.
 *   RIGHT : two stacked stat sub-cards (Hạng mùa #N gold, Điểm mùa N) +
 *           leaderboard link with arrow hover-shift.
 *
 * Mobile (< md): falls back to a single column with sub-cards stacked
 * below the text block (the layout we shipped earlier today).
 *
 * R10 trend column is still deferred — no rendering until BE adds
 * seasonRankDelta to /api/seasons/{id}/my-rank.
 */
export default function SeasonCard() {
  const { t } = useTranslation()

  const { data: activeSeason } = useQuery<ActiveSeasonResponse>({
    queryKey: ['active-season'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const seasonId = activeSeason?.active ? activeSeason.id : null
  const seasonName = activeSeason?.active ? (localizeSeasonName(activeSeason.name, t) ?? activeSeason.name) : null

  const { data: myRank } = useQuery<MyRankResponse | null>({
    queryKey: ['season-my-rank', seasonId],
    queryFn: () => api.get(`/api/seasons/${seasonId}/my-rank`).then(r => r.data),
    staleTime: 60_000,
    enabled: !!seasonId,
  })

  if (!activeSeason?.active) {
    return (
      <section
        data-testid="ranked-season-card"
        data-state="no-active-season"
        className="rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-soft p-5 md:p-6 text-center"
      >
        <p className="text-bq-ink3 text-[12px]">
          {t('ranked.seasonNoActive')}
        </p>
      </section>
    )
  }

  const rank = myRank?.rank ?? null
  const totalPlayers = myRank?.totalPlayers ?? null
  const seasonPoints = myRank?.points ?? 0
  const days = daysUntil(activeSeason.endDate)
  const pointsToChamp = Math.max(0, CHAMPIONSHIP_THRESHOLD - seasonPoints)
  const champPct = Math.min(100, (seasonPoints / CHAMPIONSHIP_THRESHOLD) * 100)
  const percentile = rank != null && totalPlayers != null && totalPlayers > 0
    ? Math.max(0.1, ((1 - (rank - 1) / totalPlayers) * 100))
    : null

  return (
    <section
      data-testid="ranked-season-card"
      data-state="active"
      className="relative overflow-hidden rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-sap p-5 md:p-7 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5 md:gap-8 md:items-center"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(50% 70% at 100% 0%, rgba(47,111,176,0.06), transparent 60%)',
        }}
      />

      {/* LEFT — text block */}
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-bq-amberd text-[22px]" style={FILL_1}>
            emoji_events
          </span>
          <span className="font-display text-bq-ink text-[18px] md:text-[19px] font-extrabold tracking-tight">
            {seasonName}
          </span>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap mt-2 text-[12px] text-bq-ink3">
          {days != null && (
            <span data-testid="ranked-season-end">
              {t('ranked.seasonEndsIn', { days })}
            </span>
          )}
          <span className="text-bq-ink3/60">•</span>
          <span>
            {t('ranked.seasonBonusChip', 'Bonus')}{' '}
            <b className="text-bq-amberd font-extrabold">×1.5</b>{' '}
            {t('ranked.seasonBonusChipSuffix', 'câu theo mùa')}
          </span>
        </div>

        <p className="text-bq-ink2 text-[13px] mt-3.5 leading-relaxed">
          {t('ranked.seasonRewardHintItalic', 'Top 3 mỗi tier nhận badge')}{' '}
          <i className="font-headline italic font-semibold text-bq-amberd">
            "{t('ranked.seasonBadgeName', 'Vinh Quang')} {seasonName}"
          </i>
        </p>

        <div className="flex items-center gap-3.5 mt-4">
          <div className="flex-1 bg-bq-track border-2 border-bq-ink rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${champPct}%`,
                background: '#FFC93C',
              }}
            />
          </div>
          <span className="text-[12px] text-bq-ink2 whitespace-nowrap">
            {pointsToChamp > 0 ? (
              <>
                {t('ranked.seasonStillNeedsPrefix', 'Còn')}{' '}
                <b className="text-bq-ink font-semibold">
                  {pointsToChamp.toLocaleString('vi-VN')} {t('ranked.points')}
                </b>
                {' '}
                {t('ranked.seasonStillNeedsSuffix', 'đến mục tiêu mùa')}
              </>
            ) : (
              t('ranked.seasonChampReached', 'Đã đạt mục tiêu mùa 🎉')
            )}
          </span>
        </div>
      </div>

      {/* RIGHT — 2 sub-stat cards + leaderboard link */}
      <div className="relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[13px] border border-bq-hair bg-bq-inset px-4 py-3.5 md:px-[18px] md:py-4">
            <div className="text-bq-ink3 text-[12px] font-bold">
              {t('ranked.seasonRankLabel')}
            </div>
            {rank != null ? (
              <>
                <div
                  data-testid="ranked-season-rank"
                  className="text-bq-amberd text-[26px] md:text-[28px] font-extrabold leading-none tracking-tight mt-1.5"
                >
                  #{rank}
                </div>
                {percentile != null && (
                  <div className="text-[10px] mt-1 text-bq-sapphire">
                    {t('ranked.seasonRankPercentile', { percent: percentile.toFixed(1) })}
                  </div>
                )}
              </>
            ) : (
              <div
                data-testid="ranked-season-rank"
                className="text-bq-ink3 text-[16px] font-semibold mt-1.5"
              >
                {t('ranked.unranked')}
              </div>
            )}
          </div>

          <div className="rounded-[13px] border border-bq-hair bg-bq-inset px-4 py-3.5 md:px-[18px] md:py-4">
            <div className="text-bq-ink3 text-[12px] font-bold">
              {t('ranked.seasonPointsBigLabel')}
            </div>
            <div
              data-testid="ranked-season-points"
              className="text-bq-ink text-[26px] md:text-[28px] font-extrabold leading-none tracking-tight mt-1.5"
            >
              {seasonPoints}
            </div>
          </div>
        </div>

        <Link
          to="/leaderboard?period=season"
          data-testid="ranked-season-leaderboard-link"
          className="group flex items-center justify-end gap-1 mt-3 text-bq-amberd text-[12px] md:text-[13px] font-semibold hover:underline"
        >
          {t('ranked.seasonViewLeaderboard')}
          <span className="material-symbols-outlined text-[15px] transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5">
            arrow_forward
          </span>
        </Link>
      </div>
    </section>
  )
}
