import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { TIERS, getTierByPoints } from '../data/tiers'

type Tab = 'daily' | 'weekly' | 'season' | 'all_time'

// Podium hierarchy per mockup (LB-P1-1, LB-P1-2, LB-P1-3):
// idx in podiumOrder: 0 = rank 2 (left), 1 = rank 1 (center, tallest), 2 = rank 3 (right).
// Avatar size + bục height encode rank visual hierarchy without numerals.
const PODIUM_LAYOUT = [
  { rank: 2, avatar: 'w-11 h-11 md:w-16 md:h-16', bucket: 'h-[60px] md:h-[90px]' },
  { rank: 1, avatar: 'w-14 h-14 md:w-20 md:h-20', bucket: 'h-[88px] md:h-[130px]' },
  { rank: 3, avatar: 'w-10 h-10 md:w-14 md:h-14', bucket: 'h-[42px] md:h-[65px]' },
]

export default function Leaderboard() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('daily')
  const user = useAuthStore(s => s.user)
  const tabs: { key: Tab; label: string; apiPath: string }[] = [
    { key: 'daily', label: t('leaderboard.daily'), apiPath: 'daily' },
    { key: 'weekly', label: t('leaderboard.weekly'), apiPath: 'weekly' },
    { key: 'season', label: t('leaderboard.season'), apiPath: 'season' },
    { key: 'all_time', label: t('leaderboard.allTime'), apiPath: 'all-time' },
  ]
  const apiPath = tabs.find(t => t.key === activeTab)?.apiPath ?? 'daily'

  const { data: entries, isLoading, isFetching } = useQuery({
    queryKey: ['leaderboard', activeTab],
    queryFn: () => api.get(`/api/leaderboard/${apiPath}?size=20`).then(r => r.data),
    staleTime: 30_000,
    keepPreviousData: true,
  })

  const { data: myRank } = useQuery({
    queryKey: ['leaderboard', 'my-rank', activeTab],
    queryFn: () => api.get(`/api/leaderboard/${apiPath}/my-rank`).then(r => r.data).catch(() => null),
  })

  const { data: season } = useQuery({
    queryKey: ['season', 'active'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data).catch(() => null),
    staleTime: 300_000,
  })

  const { data: tierData } = useQuery({
    queryKey: ['me-tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data).catch(() => null),
    staleTime: 60_000,
  })

  const userPoints = tierData?.totalPoints ?? 0
  const userTierId = getTierByPoints(userPoints).id

  const rawList: any[] = Array.isArray(entries) ? entries : []
  // Defensive dedup: if BE returns duplicate rows for same userId, keep first occurrence.
  // Root-cause investigation pending — see TODO LB-1.2 for backend follow-up.
  const list = rawList.filter(
    (row, idx, arr) => arr.findIndex((r) => r.userId === row.userId) === idx,
  )
  const top3 = list.slice(0, 3)
  const rest = list.slice(3)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) // 2, 1, 3

  // Identify current user via my-rank API response (authStore.User has no `id` field)
  const myUserId: string | undefined = myRank?.userId
  const isCurrentUserInList = myUserId != null && list.some((e: any) => e.userId === myUserId)
  const showMyRankSticky = myRank != null && !isCurrentUserInList

  const seasonCountdown = season?.endAt
    ? (() => {
        const diff = new Date(season.endAt).getTime() - Date.now()
        if (diff <= 0) return t('leaderboard.seasonEnded')
        const d = Math.floor(diff / 86400000)
        const h = Math.floor((diff % 86400000) / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        return `${String(d).padStart(2, '0')} ${t('common.days')} : ${String(h).padStart(2, '0')} ${t('common.hours')} : ${String(m).padStart(2, '0')} ${t('common.minutes')}`
      })()
    : null

  return (
    <div className="px-4 md:px-10 max-w-5xl mx-auto py-6">
      {/* Header & Countdown */}
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-on-surface mb-2">{t('leaderboard.title')}</h1>
          <p className="text-on-surface-variant text-sm">{t('leaderboard.description')}</p>
        </div>
        {seasonCountdown && (
          <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3 rounded-xl border-l-4 border-secondary">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            <div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{t('leaderboard.seasonEndsIn')}</p>
              <p className="text-secondary font-bold font-mono">{seasonCountdown}</p>
            </div>
          </div>
        )}
      </header>

      {/* Top 3 Podium */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 md:gap-10 items-end mb-16 px-2 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-surface-container mb-6" />
              <div className="h-3 w-16 bg-surface-container rounded mb-2" />
              <div className="h-3 w-12 bg-surface-container rounded" />
            </div>
          ))}
        </div>
      ) : top3.length >= 3 ? (
        <section data-testid="leaderboard-podium" className="grid grid-cols-3 gap-2 md:gap-6 items-end mb-16 px-2">
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
                    className={`${layout.avatar} rounded-full overflow-hidden border-2 ${isFirst ? 'shadow-[0_0_20px_rgba(232,168,50,0.4)]' : ''}`}
                    style={{ borderColor: isFirst ? '#e8a832' : tierColor + '99' }}
                  >
                    {player.avatarUrl ? (
                      <img alt={`Rank ${layout.rank}`} className="w-full h-full object-cover" src={player.avatarUrl} />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-sm md:text-xl font-medium text-[#11131e]"
                        style={{ background: tierColor }}
                      >
                        {player.name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  {/* Arabic-numeral rank badge — replaces La Mã (LB-P1-2) */}
                  <div
                    className="absolute -bottom-1 md:-bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-medium text-[10px] md:text-xs text-[#11131e] border-2 border-background"
                    style={{ background: isFirst ? '#e8a832' : tierColor }}
                  >
                    {layout.rank}
                  </div>
                </div>

                {/* Name + tier name */}
                <p className="font-medium text-[11px] md:text-sm text-center truncate w-full text-on-surface">{player.name}</p>
                <p className="text-[9px] md:text-xs mb-1.5 md:mb-2 truncate w-full text-center" style={{ color: tierColor }}>
                  {t(tier.nameKey)}
                </p>

                {/* Bục — tier-tinted bg, height varies by rank */}
                <div
                  className={`w-full ${layout.bucket} rounded-t-lg border-t flex flex-col items-center justify-center px-1 md:px-2`}
                  style={{
                    background: isFirst ? 'rgba(232,168,50,0.12)' : `${tierColor}1a`,
                    borderTopColor: isFirst ? 'rgba(232,168,50,0.4)' : `${tierColor}66`,
                  }}
                >
                  <div
                    className={`${isFirst ? 'text-base md:text-2xl' : 'text-xs md:text-lg'} font-medium`}
                    style={{ color: isFirst ? '#e8a832' : tierColor }}
                  >
                    {points}
                  </div>
                  <div className="text-[8px] md:text-[10px] text-on-surface-variant/55 mt-0.5">
                    {t('leaderboard.points').toLowerCase()}{questions ? ` · ${questions} câu` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ) : list.length === 0 ? (
        <div className="text-center py-16 mb-16">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">leaderboard</span>
          <p className="text-on-surface-variant text-sm">{t('leaderboard.noData')}</p>
        </div>
      ) : null}

      {/* Tabs */}
      <nav className="flex p-1 bg-surface-container-low rounded-2xl mb-10">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.key ? 'text-on-surface bg-surface-container-highest rounded-xl shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Table List */}
      <div className={`space-y-4 mb-16 transition-opacity ${isFetching ? 'opacity-50' : ''}`}>
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-surface-container-low rounded-2xl animate-pulse" />)
        ) : rest.length === 0 && list.length <= 3 ? null : (
          <>
            {rest.map((entry: any, idx: number) => {
              const rank = idx + 4
              const isMe = myUserId != null && entry.userId === myUserId
              return isMe ? (
                <div key={entry.userId || rank} className="flex items-center gap-4 p-6 bg-[#e8a832] rounded-2xl border-l-8 border-background/20 shadow-[0_15px_30px_rgba(232,168,50,0.3)]">
                  <div className="w-8 text-center font-black text-[#11131e]">{rank}</div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#11131e] shadow-lg overflow-hidden bg-[#11131e]/10 flex items-center justify-center text-[#11131e] font-bold">
                    {entry.avatarUrl ? <img alt="Me" className="w-full h-full object-cover" src={entry.avatarUrl} /> : entry.name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-[#11131e]">{entry.name}</h3>
                      <span className="bg-[#11131e]/10 text-[#11131e] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">{t('leaderboard.me')}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#11131e] font-black text-lg">{(entry.points ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] uppercase text-[#11131e]/60 font-bold">{t('leaderboard.points')}</p>
                  </div>
                </div>
              ) : (
                <div key={entry.userId || rank} className="flex items-center gap-4 p-5 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-all group">
                  <div className="w-8 text-center font-black text-on-surface-variant group-hover:text-on-surface transition-colors">{rank}</div>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container flex items-center justify-center text-sm font-bold text-on-surface-variant">
                      {entry.avatarUrl ? <img alt="Player" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" src={entry.avatarUrl} /> : entry.name?.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-on-surface">{entry.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-on-surface font-black text-sm">{(entry.points ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] uppercase text-on-surface-variant">{t('leaderboard.points')}</p>
                  </div>
                </div>
              )
            })}

            {/* My rank sticky — only when current user NOT in displayed list (around-me pattern) */}
            {showMyRankSticky && (
              <div data-testid="leaderboard-my-rank-sticky" className="flex items-center gap-4 p-6 bg-[#e8a832] rounded-2xl border-l-8 border-background/20 shadow-[0_15px_30px_rgba(232,168,50,0.3)]">
                <div className="w-8 text-center font-black text-[#11131e]">{myRank.rank ?? '—'}</div>
                <div className="w-12 h-12 rounded-full border-2 border-[#11131e] shadow-lg overflow-hidden bg-[#11131e]/10 flex items-center justify-center text-[#11131e] font-bold">
                  {(myRank.name ?? user?.name)?.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-[#11131e]">{myRank.name ?? user?.name}</h3>
                    <span className="bg-[#11131e]/10 text-[#11131e] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">{t('leaderboard.me')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#11131e] font-black text-lg">{(myRank.points ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] uppercase text-[#11131e]/60 font-bold">{t('leaderboard.points')}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Season Tier Ranking — 6 religious tiers (decision A 2026-05-01) */}
      <section className="glass-card p-6 md:p-8 rounded-3xl mb-24 border border-outline-variant/10" data-testid="leaderboard-tier-section">
        <header className="mb-6">
          <h4 className="text-lg font-black flex items-center gap-2 mb-1">
            <span>🏆</span>
            {t('leaderboard.seasonRanking')}
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">{t('leaderboard.tierSeasonSubtitle')}</p>
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
                    ? 'bg-secondary/10 border-secondary'
                    : 'bg-surface-container-lowest border-outline/30'
                }`}
                style={!isCurrent ? { borderTopColor: tier.colorHex + '66' } : undefined}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 bg-secondary text-[#412d00] text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                    {t('leaderboard.me')}
                  </span>
                )}
                <span
                  className="material-symbols-outlined mb-2 text-2xl"
                  style={{ color: tier.colorHex, fontVariationSettings: "'FILL' 1" }}
                >
                  {tier.iconMaterial}
                </span>
                <p className="font-bold text-sm mb-1" style={{ color: isCurrent ? undefined : tier.colorHex }}>
                  {t(tier.nameKey)}
                </p>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">{thresholdLabel}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
