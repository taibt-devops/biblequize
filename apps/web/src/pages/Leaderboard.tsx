import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { TIERS, getTierByPoints } from '../data/tiers'
import { resolveAvatar } from '../utils/avatar'
import PageMeta from '../components/PageMeta'

type Tab = 'weekly' | 'season' | 'all_time'

// Podium hierarchy per mockup (LB-P1-1, LB-P1-2, LB-P1-3):
// idx in podiumOrder: 0 = rank 2 (left), 1 = rank 1 (center, tallest), 2 = rank 3 (right).
// Avatar size + bục height encode rank visual hierarchy without numerals.
const PODIUM_LAYOUT = [
  { rank: 2, avatar: 'w-11 h-11 md:w-16 md:h-16', bucket: 'h-[60px] md:h-[90px]' },
  { rank: 1, avatar: 'w-14 h-14 md:w-20 md:h-20', bucket: 'h-[88px] md:h-[130px]' },
  { rank: 3, avatar: 'w-10 h-10 md:w-14 md:h-14', bucket: 'h-[42px] md:h-[65px]' },
]

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
    <div className="max-w-5xl mx-auto py-6">
      <PageMeta
        title="Bảng Xếp Hạng – Trắc Nghiệm Kinh Thánh"
        description="Bảng xếp hạng người chơi trắc nghiệm Kinh Thánh trên BibleQuiz — thi đua điểm số cùng cộng đồng Tin Lành Việt Nam."
        canonicalPath="/leaderboard"
      />
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-bq-ink mb-2">{t('leaderboard.title')}</h1>
          <p className="text-bq-ink2 text-sm">{t('leaderboard.description')}</p>
        </div>
      </header>

      {/* Top 3 Podium */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 md:gap-10 items-end mb-16 px-2 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-bq-inset mb-6" />
              <div className="h-3 w-16 bg-bq-inset rounded mb-2" />
              <div className="h-3 w-12 bg-bq-inset rounded" />
            </div>
          ))}
        </div>
      ) : !lowData && top3.length >= 3 ? (
        <section data-testid="leaderboard-podium" className="grid grid-cols-3 gap-2 md:gap-6 items-end mb-16">
          {podiumOrder.map((player, idx) => {
            const layout = PODIUM_LAYOUT[idx]
            const isFirst = layout.rank === 1
            const tier = getTierByPoints(player.points ?? 0)
            const tierColor = tier.colorHex
            const points = (player.points ?? 0).toLocaleString()
            const questions = player.questions
            return (
              <div key={player.userId || idx} data-testid={`podium-rank-${layout.rank}`} className="flex flex-col items-center">
                {/* Avatar + crown (#1 only) + rank badge */}
                <div className="relative mb-2 md:mb-3">
                  {isFirst && (
                    <div className="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 text-2xl md:text-3xl drop-shadow-[0_0_8px_rgba(232,168,50,0.6)]">
                      👑
                    </div>
                  )}
                  <div
                    className={`${layout.avatar} rounded-full overflow-hidden border-[3px] border-bq-ink bg-bq-white`}
                  >
                    {(() => {
                      const r = resolveAvatar(player.avatarUrl, player.name)
                      if (r.kind === 'img') return <img alt={`Rank ${layout.rank}`} className="w-full h-full object-cover" src={r.src} />
                      if (r.kind === 'preset') return (
                        <div className="w-full h-full flex items-center justify-center text-2xl md:text-4xl leading-none" style={{ background: r.preset.bg }} aria-hidden>{r.preset.emoji}</div>
                      )
                      return (
                        <div
                          className="w-full h-full flex items-center justify-center text-sm md:text-xl font-extrabold text-bq-ink"
                          style={{ background: `${tierColor}26` }}
                        >
                          {r.initial}
                        </div>
                      )
                    })()}
                  </div>
                  {/* Arabic-numeral rank badge — replaces La Mã (LB-P1-2) */}
                  <div
                    className={`absolute -bottom-1 md:-bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-extrabold text-[10px] md:text-xs text-bq-ink border-2 border-bq-ink ${isFirst ? 'bg-bq-amber' : 'bg-bq-white'}`}
                  >
                    {layout.rank}
                  </div>
                </div>

                {/* Name + tier name */}
                <p className="font-medium text-[11px] md:text-sm text-center truncate w-full text-bq-ink">{player.name}</p>
                <p className="text-[10px] md:text-xs font-bold mb-1.5 md:mb-2 truncate w-full text-center" style={{ color: tierColor }}>
                  {t(tier.nameKey)}
                </p>

                {/* Bục — tier-tinted bg, height varies by rank */}
                <div
                  className={`w-full ${layout.bucket} rounded-t-2xl border-[3px] border-b-0 border-bq-ink flex flex-col items-center justify-center px-1 md:px-2 ${
                    isFirst ? 'bg-bq-amber' : layout.rank === 2 ? 'bg-bq-parch' : 'bg-bq-track'
                  }`}
                >
                  <div
                    className={`${isFirst ? 'text-base md:text-2xl' : 'text-xs md:text-lg'} font-extrabold text-bq-ink`}
                  >
                    {points}
                  </div>
                  <div className="text-[10px] text-bq-ink2 mt-0.5 truncate w-full text-center">
                    {t('leaderboard.points').toLowerCase()}{questions ? ` · ${questions} câu` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ) : null}

      {/* Tabs */}
      <nav className="flex p-1 bg-bq-inset rounded-2xl mb-10">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.key ? 'text-bq-ink bg-bq-white rounded-xl shadow-bq-soft' : 'text-bq-ink2 hover:text-bq-ink'
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Table List (or low-data seed-state — LBF-11) */}
      <div className={`space-y-4 mb-16 transition-opacity ${isFetching ? 'opacity-50' : ''}`}>
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-bq-inset rounded-2xl animate-pulse" />)
        ) : lowData ? (
          <div data-testid="leaderboard-seed-state" className="flex flex-col items-center text-center gap-3 py-14">
            <div className="w-14 h-14 rounded-full bg-bq-amber/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-bq-amberd text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            </div>
            <p className="text-base font-bold text-bq-ink">{t('leaderboard.seedTitle')}</p>
            <p className="text-sm text-bq-ink2 max-w-sm leading-relaxed">{t('leaderboard.seedBody')}</p>
            <Link
              to="/practice"
              data-testid="leaderboard-seed-cta"
              className="inline-flex items-center gap-2 mt-2 px-5 py-2 rounded-xl bg-bq-amber text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              {t('leaderboard.seedCta')} →
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
                <div data-testid="leaderboard-around-me" className="space-y-4 mt-2 pt-5 border-t border-dashed border-bq-hair">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bq-ink2 mb-1">{t('leaderboard.aroundMe')}</p>
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

      {/* Season Tier Ranking — 6 religious tiers (decision A 2026-05-01) */}
      <section className="bg-bq-white p-6 md:p-8 rounded-3xl mb-24 border border-bq-hair shadow-bq-soft" data-testid="leaderboard-tier-section">
        <header className="mb-6">
          <h4 className="text-lg font-display font-black flex items-center gap-2 mb-1 text-bq-ink">
            <span>🏆</span>
            {t('leaderboard.seasonRanking')}
          </h4>
          <p className="text-xs text-bq-ink2 leading-relaxed">
            {season?.active && season.name
              ? t('leaderboard.tierSeasonSubtitle', { seasonName: season.name })
              : t('leaderboard.tierSeasonSubtitleFallback')}
          </p>
          {!isAuthenticated && (
            <p className="text-xs text-bq-ink2 mt-2" data-testid="leaderboard-guest-rank-cta">
              <Link to="/login" className="text-bq-amberd font-semibold hover:underline">
                {t('auth.login')}
              </Link>{' '}
              {t('leaderboard.loginForRank')}
            </p>
          )}
        </header>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === userTierId
            const thresholdLabel = Number.isFinite(tier.maxPoints)
              ? t('leaderboard.tierThresholdRange', { min: tier.minPoints.toLocaleString(), max: tier.maxPoints.toLocaleString() })
              : t('leaderboard.tierThresholdMax', { min: tier.minPoints.toLocaleString() })
            return (
              <div
                key={tier.id}
                data-testid={`leaderboard-tier-card-${tier.id}`}
                className={`relative p-4 rounded-2xl border-t-2 transition-colors ${
                  isCurrent
                    ? 'bg-bq-amber/10 border-bq-amber'
                    : 'bg-bq-inset border-bq-hair'
                }`}
                style={!isCurrent ? { borderTopColor: tier.colorHex + '66' } : undefined}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 bg-bq-amber text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                    {t('leaderboard.me')}
                  </span>
                )}
                <span
                  className="material-symbols-outlined mb-2 text-2xl"
                  style={{ color: tier.colorHex, fontVariationSettings: "'FILL' 1" }}
                >
                  {tier.iconMaterial}
                </span>
                <p className={`font-bold text-sm mb-1 ${isCurrent ? 'text-bq-ink' : ''}`} style={{ color: isCurrent ? undefined : tier.colorHex }}>
                  {t(tier.nameKey)}
                </p>
                <p className="text-[10px] text-bq-ink2 leading-relaxed">{thresholdLabel}</p>
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
  const tierColor = tier.colorHex
  const tierName = t(tier.nameKey)
  const resolved = resolveAvatar(avatarUrl, name)

  const renderAvatarBody = () => {
    if (resolved.kind === 'img') return <img alt={name} className="w-full h-full object-cover" src={resolved.src} />
    if (resolved.kind === 'preset') return (
      <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl leading-none" style={{ background: resolved.preset.bg }} aria-hidden>{resolved.preset.emoji}</div>
    )
    return resolved.initial
  }

  if (isMe) {
    return (
      <div
        data-testid={testId}
        className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-bq-amber/10 rounded-2xl outline outline-bq-amber/40 shadow-bq-soft"
      >
        <div className="w-7 md:w-8 text-center font-black text-bq-amberd">{rank}</div>
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-bq-amber shadow-bq-soft overflow-hidden flex items-center justify-center text-bq-ink font-bold" style={{ background: `${tierColor}26` }}>
          {renderAvatarBody()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-xs md:text-sm text-bq-ink truncate">{name}</h3>
            <span className="bg-bq-amber/20 text-bq-amberd text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">{t('leaderboard.me')}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] md:text-[11px] text-bq-ink2">
            <span>{tierName}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-bq-ink font-black text-base md:text-lg">{points.toLocaleString()}</p>
          <p className="text-[9px] md:text-[10px] uppercase text-bq-ink2 font-bold">{t('leaderboard.points')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3 md:gap-4 p-3 md:p-5 bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl hover:bg-bq-inset transition-all group"
    >
      <div className="w-7 md:w-8 text-center font-black text-bq-ink2 group-hover:text-bq-ink transition-colors text-sm">{rank}</div>
      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-bq-ink border-2 border-bq-ink" style={{ background: `${tierColor}26` }}>
        {renderAvatarBody()}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-xs md:text-sm text-bq-ink truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] md:text-[11px]">
          <span className="font-bold" style={{ color: tierColor }}>{tierName}</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-bq-ink font-black text-sm">{points.toLocaleString()}</p>
        <p className="text-[9px] md:text-[10px] uppercase text-bq-ink2">{t('leaderboard.points')}</p>
      </div>
    </div>
  )
}
