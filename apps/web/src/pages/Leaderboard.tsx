import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { TIERS, getTierByPoints } from '../data/tiers'
import PageMeta from '../components/PageMeta'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'
import { PlayerCrest, TierRibbon } from '../components/lk/PlayerCrest'

type Tab = 'weekly' | 'season' | 'all_time'

// Podium hierarchy per mockup (LB-P1-1, LB-P1-2, LB-P1-3):
// idx in podiumOrder: 0 = rank 2 (left), 1 = rank 1 (center, tallest), 2 = rank 3 (right).
// Avatar size + stage height encode rank without numerals; LKF-11: gold / silver / bronze stages.
const PODIUM_LAYOUT = [
  { rank: 2, crest: 72, bucket: 'h-[70px] md:h-[104px]', stage: 'bg-bq-silver' },
  { rank: 1, crest: 92, bucket: 'h-[100px] md:h-[148px]', stage: 'bg-bq-amber' },
  { rank: 3, crest: 64, bucket: 'h-[50px] md:h-[76px]', stage: 'bg-bq-bronze' },
]

const tierImg = (id: number) => `/images/lk/tier-${Math.min(6, Math.max(1, id))}.webp`

const TAB_TO_API_PATH: Record<Tab, string> = {
  weekly: 'weekly',
  season: 'season',
  all_time: 'all-time',
}

// LBF-11 (2026-06-18): "né con số" — when fewer than this many players have
// points, the board is too sparse to show without exposing weak numbers
// (1–2 rows, "0đ"). Below the threshold we render an encouraging seed-state
// instead of the podium/list. The board page size is 20 (> threshold), so
// `list.length < SEED_THRESHOLD` reliably means "fewer than N real players",
// not a truncated page.
const SEED_THRESHOLD = 10

export default function Leaderboard() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('all_time')
  const user = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const apiPath = TAB_TO_API_PATH[activeTab]

  // Guests read the board via the no-auth public endpoint so they don't 401
  // (which would also trigger the session-expiry refresh/logout storm). Authed
  // users keep the richer authenticated board.
  const { data: entries, isLoading, isFetching } = useQuery({
    queryKey: ['leaderboard', activeTab, isAuthenticated],
    queryFn: () => {
      const url = isAuthenticated
        ? `/api/leaderboard/${apiPath}?size=20`
        : `/api/public/leaderboard?period=${apiPath}&size=20`
      return api.get(url).then(r => r.data)
    },
    staleTime: 30_000,
    keepPreviousData: true,
  })

  // Per-user queries only make sense when logged in — gating them avoids guest
  // 401s and the fake "Me / New Believer / 0 pts" marker on the tier ladder.
  const { data: myRank } = useQuery({
    queryKey: ['leaderboard', 'my-rank', activeTab],
    queryFn: () => api.get(`/api/leaderboard/${apiPath}/my-rank`).then(r => r.data).catch(() => null),
    enabled: isAuthenticated,
  })

  const { data: season } = useQuery({
    queryKey: ['season', 'active'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data).catch(() => null),
    staleTime: 300_000,
    enabled: isAuthenticated,
  })

  // LBF-9 (2026-06-18): the "Mùa" (competitive season) tab is hidden for the
  // early-launch phase — a 3-month window-sum board duplicated the sparse
  // all-time data and exposed weak numbers. BE `/leaderboard/season` +
  // `/api/seasons/active` stay live (dormant); only the tab is removed. The
  // liturgical season (×1.5 focus bonus + coverage) is unaffected — see
  // docs/todo/active/2026-06-18-leaderboard-deep-fixes.md.
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all_time', label: t('leaderboard.allTime') },
    { key: 'weekly', label: t('leaderboard.weekly') },
  ]

  const { data: tierData } = useQuery({
    queryKey: ['me-tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data).catch(() => null),
    staleTime: 60_000,
    enabled: isAuthenticated,
  })

  const userPoints = tierData?.totalPoints ?? 0
  // Only mark a "current tier" for logged-in users — otherwise a guest's
  // 0 points would falsely flag the lowest tier as theirs.
  const userTierId = isAuthenticated ? getTierByPoints(userPoints).id : null

  // LBF-2 (2026-06-18): no FE dedup. Investigation conclusion — the board
  // cannot return a userId twice: `user_daily_progress` has
  // UNIQUE(user_id, date) so the daily query yields one row per user, and
  // weekly/all-time GROUP BY u.id (the PK). The old "defensive dedup +
  // investigation pending" guard masked an impossible state; a real duplicate
  // should now surface loudly (React duplicate-key warning) as a schema/query
  // regression rather than being silently swallowed.
  const list: any[] = Array.isArray(entries) ? entries : []
  // Low-data seed-state gate (LBF-11). Empty + 1..9-player boards both fall here.
  const lowData = !isLoading && list.length < SEED_THRESHOLD
  const top3 = list.slice(0, 3)
  const rest = list.slice(3)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) // 2, 1, 3

  // Identify current user via my-rank API response (authStore.User has no `id` field)
  const myUserId: string | undefined = myRank?.userId
  const isCurrentUserInList = myUserId != null && list.some((e: any) => e.userId === myUserId)
  const showMyRankSticky = myRank != null && !isCurrentUserInList

  // LBF-4 (2026-06-18): around-me window — the 5 players above + you + 5 below,
  // so an off-board user sees who to overtake / who's chasing instead of a lone
  // sticky row. Only fetched when the user is outside the displayed top list.
  // Falls back to the single sticky row if the endpoint returns nothing.
  const { data: aroundMe } = useQuery({
    queryKey: ['leaderboard', 'around-me', activeTab],
    queryFn: () => api.get(`/api/leaderboard/around-me?period=${apiPath}&radius=5`).then(r => r.data).catch(() => null),
    enabled: isAuthenticated && showMyRankSticky,
    staleTime: 30_000,
  })
  // Drop window rows already shown in the main top list (user sitting just past
  // the cut, e.g. rank 21, would otherwise duplicate ranks 16–20).
  const aroundRows: any[] = Array.isArray(aroundMe)
    ? aroundMe.filter((r: any) => !list.some((e: any) => e.userId === r.userId))
    : []

  return (
    <div className="relative max-w-5xl mx-auto py-2 md:py-6">
      <PlaceBackdrop place="summit" veil="mid" focus="center 30%" />
      <PageMeta
        title="Bảng Xếp Hạng – Trắc Nghiệm Kinh Thánh"
        description="Bảng xếp hạng người chơi trắc nghiệm Kinh Thánh trên BibleQuiz — thi đua điểm số cùng cộng đồng Tin Lành Việt Nam."
        canonicalPath="/leaderboard"
      />
      {/* title + which board */}
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="space-y-3 min-w-0">
          <Plaque className="text-[28px] md:text-[38px]">
            <img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-[1.05em]" />
            {t('leaderboard.title')}
          </Plaque>
          <p className="m-0 w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[14px] md:text-[15px] text-bq-ink2">
            {t('leaderboard.description')}
          </p>
        </div>
        <nav className="flex gap-1 p-1 bg-bq-white border-[3px] border-bq-ink rounded-full shadow-[0_4px_0_#1D2B22]">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} aria-pressed={activeTab === tab.key}
              className={`px-4 md:px-5 py-1.5 rounded-full text-[15px] font-extrabold transition-colors ${
                activeTab === tab.key ? 'bg-bq-amber text-bq-ink' : 'text-bq-ink2 hover:bg-bq-cream'
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Top 3 on the summit podium */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 md:gap-10 items-end mb-12 px-2 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-bq-inset/80 border-[3px] border-bq-ink/20 mb-4" />
              <div className="w-full h-24 rounded-t-2xl bg-bq-inset/80 border-[3px] border-bq-ink/20" />
            </div>
          ))}
        </div>
      ) : !lowData && top3.length >= 3 ? (
        <section data-testid="leaderboard-podium" className="grid grid-cols-3 gap-2 md:gap-5 items-end mb-12 max-w-3xl mx-auto">
          {podiumOrder.map((player, idx) => {
            const layout = PODIUM_LAYOUT[idx]
            const isFirst = layout.rank === 1
            const tier = getTierByPoints(player.points ?? 0)
            const points = (player.points ?? 0).toLocaleString()
            const questions = player.questions
            return (
              <div key={player.userId || idx} data-testid={`podium-rank-${layout.rank}`} className="flex flex-col items-center min-w-0">
                {/* the player's crest + crown on #1 + rank number */}
                <div className="relative mb-2 md:mb-3">
                  {isFirst && (
                    <div className="absolute -top-7 md:-top-9 left-1/2 -translate-x-1/2 z-10 text-[28px] md:text-[38px] leading-none">
                      👑
                    </div>
                  )}
                  {isFirst && <span aria-hidden className="absolute -inset-6 rounded-full bg-[radial-gradient(circle_closest-side,rgba(255,214,90,.95)_60%,rgba(255,214,90,.45)_78%,rgba(255,214,90,0)_100%)] motion-safe:animate-pulse" />}
                  <PlayerCrest name={player.name} avatarUrl={player.avatarUrl} tierId={tier.id} size={layout.crest} />
                  <div className={`absolute -top-1 -left-1 w-6 h-6 md:w-7 md:h-7 rounded-full grid place-items-center font-extrabold text-[12px] md:text-[14px] text-bq-ink border-2 border-bq-ink shadow-[0_2px_0_#1D2B22] ${layout.stage}`}>
                    {layout.rank}
                  </div>
                </div>

                {/* name + tier ribbon */}
                <p className="m-0 mt-1 font-extrabold text-[13px] md:text-[16px] text-center truncate w-full text-bq-ink">{player.name}</p>
                <div className="mb-2 mt-1 max-w-full overflow-hidden flex justify-center">
                  <TierRibbon tierId={tier.id} />
                </div>

                {/* wooden stage, height by rank */}
                <div
                  className={`w-full ${layout.bucket} ${layout.stage} rounded-t-2xl border-[3px] border-b-0 border-bq-ink flex flex-col items-center justify-start pt-2 md:pt-3 px-1 md:px-2 bg-[repeating-linear-gradient(180deg,rgba(29,43,34,.07)_0_2px,transparent_2px_14px)]`}
                >
                  <div className={`${isFirst ? 'text-[18px] md:text-[28px]' : 'text-[15px] md:text-[21px]'} font-display font-extrabold text-bq-ink leading-none tabular-nums`}>
                    {points}
                  </div>
                  <div className="text-[11px] md:text-[12.5px] font-bold text-bq-ink2 mt-1 truncate w-full text-center">
                    {t('leaderboard.points').toLowerCase()}{questions ? ` · ${questions} câu` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ) : null}
      {!isLoading && !lowData && top3.length >= 3 && (
        <div aria-hidden className="-mt-12 mb-8 h-3 max-w-3xl mx-auto rounded-full border-[3px] border-bq-ink bg-[#8A5A2B]" />
      )}

      {/* the rest of the board (or low-data seed-state — LBF-11) */}
      <div className={`space-y-3 mb-12 transition-opacity ${isFetching ? 'opacity-50' : ''}`}>
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-2xl animate-pulse" />)
        ) : lowData ? (
          <div data-testid="leaderboard-seed-state" className="max-w-md mx-auto flex flex-col items-center text-center gap-2 px-6 py-8 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
            <img src="/images/lk/hero.webp" alt="" aria-hidden className="h-28" />
            <p className="m-0 font-display text-[22px] font-extrabold text-bq-ink">{t('leaderboard.seedTitle')}</p>
            <p className="m-0 font-read text-[15px] text-bq-ink2 leading-relaxed">{t('leaderboard.seedBody')}</p>
            <Link
              to="/practice"
              data-testid="leaderboard-seed-cta"
              className="lk-btn mt-2 text-bq-ink text-[16px] no-underline"
            >
              {t('leaderboard.seedCta')}
            </Link>
          </div>
        ) : (
          <>
            {rest.map((entry: any, idx: number) => {
              const rank = idx + 4
              const isMe = myUserId != null && entry.userId === myUserId
              return (
                <LeaderboardListRow
                  key={entry.userId || rank}
                  rank={rank}
                  name={entry.name}
                  points={entry.points}
                  avatarUrl={entry.avatarUrl}
                  isMe={isMe}
                />
              )
            })}

            {/* Around-me — current user NOT in displayed top list. Renders the
                neighbourhood window (LBF-4) or, as a fallback, a single sticky row. */}
            {showMyRankSticky && (
              aroundRows.length > 0 ? (
                <div data-testid="leaderboard-around-me" className="space-y-3 mt-2 pt-5 border-t-2 border-dashed border-bq-ink/30">
                  <p className="m-0 mb-1 text-[14px] font-extrabold text-bq-ink2">{t('leaderboard.aroundMe')}</p>
                  {aroundRows.map((r: any) => {
                    const me = myUserId != null && r.userId === myUserId
                    return (
                      <LeaderboardListRow
                        key={r.userId || r.rank}
                        testId={me ? 'leaderboard-my-rank-sticky' : undefined}
                        rank={r.rank}
                        name={r.name}
                        points={r.points}
                        // /around-me doesn't return avatarUrl for the current user;
                        // use authStore.user.avatar (kept in sync on edit).
                        avatarUrl={me ? (r.avatarUrl ?? user?.avatar) : r.avatarUrl}
                        isMe={me}
                      />
                    )
                  })}
                </div>
              ) : (
                <LeaderboardListRow
                  testId="leaderboard-my-rank-sticky"
                  rank={myRank.rank ?? 0}
                  name={myRank.name ?? user?.name ?? '?'}
                  points={myRank.points ?? 0}
                  // /my-rank doesn't return avatarUrl; use authStore.user.avatar.
                  avatarUrl={myRank.avatarUrl ?? user?.avatar}
                  isMe
                />
              )
            )}
          </>
        )}
      </div>

      {/* Season tier ladder — 6 religious tiers (decision A 2026-05-01), as shields */}
      <section className="bg-bq-white p-5 md:p-7 rounded-bq mb-16 border-[3px] border-bq-ink shadow-bq-card" data-testid="leaderboard-tier-section">
        <header className="mb-5 space-y-2">
          <Plaque as="h2" className="text-[20px] md:text-[24px]">{t('leaderboard.seasonRanking')}</Plaque>
          <p className="m-0 font-read text-[14.5px] text-bq-ink2 leading-relaxed">
            {season?.active && season.name
              ? t('leaderboard.tierSeasonSubtitle', { seasonName: season.name })
              : t('leaderboard.tierSeasonSubtitleFallback')}
          </p>
          {!isAuthenticated && (
            <p className="m-0 text-[14px] text-bq-ink2" data-testid="leaderboard-guest-rank-cta">
              <Link to="/login" className="font-extrabold text-bq-ink underline decoration-bq-amber decoration-[3px] underline-offset-2">
                {t('auth.login')}
              </Link>{' '}
              {t('leaderboard.loginForRank')}
            </p>
          )}
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === userTierId
            const thresholdLabel = Number.isFinite(tier.maxPoints)
              ? t('leaderboard.tierThresholdRange', { min: tier.minPoints.toLocaleString(), max: tier.maxPoints.toLocaleString() })
              : t('leaderboard.tierThresholdMax', { min: tier.minPoints.toLocaleString() })
            return (
              <div
                key={tier.id}
                data-testid={`leaderboard-tier-card-${tier.id}`}
                className={`relative flex items-center gap-3 p-3 md:p-4 rounded-2xl border-[3px] ${
                  isCurrent
                    ? 'bg-bq-cream border-bq-amber shadow-[0_0_0_3px_#1D2B22]'
                    : 'bg-bq-paper border-bq-ink/20'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 right-3 px-2 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[12px] font-extrabold">
                    {t('leaderboard.me')}
                  </span>
                )}
                <img src={tierImg(tier.id)} alt="" aria-hidden className={`w-11 md:w-12 shrink-0 ${isCurrent ? '' : 'opacity-85'}`} />
                <div className="min-w-0">
                  <p className="m-0 font-extrabold text-[15px] text-bq-ink">{t(tier.nameKey)}</p>
                  <p className="m-0 text-[12.5px] font-bold text-bq-ink2 leading-snug">{thresholdLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** One leaderboard list row. Avatar + name + tier badge + points.
 *  Highlight gold + "BẠN" badge when {@code isMe}. Used for both rest list rows
 *  and the sticky my-rank row (around-me pattern). */
interface LeaderboardListRowProps {
  rank: number
  name: string
  points: number
  avatarUrl?: string
  isMe?: boolean
  testId?: string
}

function LeaderboardListRow({ rank, name, points, avatarUrl, isMe, testId }: LeaderboardListRowProps) {
  const { t } = useTranslation()
  const tier = getTierByPoints(points)

  return (
    <div
      data-testid={testId}
      className={`flex items-center gap-3 md:gap-4 px-3 py-2.5 md:px-5 md:py-3 rounded-2xl border-[3px] border-bq-ink ${
        isMe ? 'bg-bq-amber/30 shadow-[0_4px_0_#1D2B22]' : 'bg-bq-white shadow-[0_3px_0_rgba(29,43,34,.35)]'
      }`}
    >
      <div className={`w-8 h-8 md:w-9 md:h-9 shrink-0 grid place-items-center rounded-full border-2 border-bq-ink font-extrabold text-[13px] md:text-[14px] ${isMe ? 'bg-bq-amber' : 'bg-bq-cream'}`}>{rank}</div>
      <PlayerCrest name={name} avatarUrl={avatarUrl} tierId={tier.id} size={50} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="m-0 font-extrabold text-[15px] md:text-[16px] text-bq-ink truncate">{name}</h3>
          {isMe && (
            <span className="px-2 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[11.5px] font-extrabold">{t('leaderboard.me')}</span>
          )}
        </div>
        <TierRibbon tierId={tier.id} className="mt-1" />
      </div>
      <div className="text-right">
        <p className="m-0 font-display text-bq-ink font-extrabold text-[17px] md:text-[19px] leading-none tabular-nums">{points.toLocaleString()}</p>
        <p className="m-0 mt-0.5 text-[12px] font-bold text-bq-ink2">{t('leaderboard.points')}</p>
      </div>
    </div>
  )
}
