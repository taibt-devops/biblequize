// MLR — Multiplayer Lobby page, redesigned per
// docs/MULTIPLAYER/MOCKUP_MULTIPLAYER_LOBBY.html.
//
// Structure: top header (kicker + live count + title + "Bộ câu hỏi") →
// hero row 3:2 (Tạo phòng card + Join code) → mode showcase (4 cards) →
// active rooms section (filter chips + 2 states). BE contract
// (/api/rooms/public + /api/rooms/join) and i18n keys unchanged.

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../store/authStore'
import { MODE_LIST, MODE_META, type RoomModeId } from './create-room/modeMeta'
import JoinByCodeBar from './multiplayer/JoinByCodeBar'
import RoomCard from './multiplayer/RoomCard'
import QuickMatchRoomCard from './multiplayer/QuickMatchRoomCard'
import EmptyState from './multiplayer/EmptyState'
import QuickMatchEntryCard from './multiplayer/QuickMatchEntryCard'
import type { PublicRoom, RoomMode, SortOption } from './multiplayer/types'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

const MODE_DISPLAY_LABEL: Record<RoomModeId, string> = {
  SPEED_RACE: 'Speed Race',
  BATTLE_ROYALE: 'Battle Royale',
  TEAM_VS_TEAM: 'Team vs Team',
  SUDDEN_DEATH: 'Đấu vương',
}

export default function Multiplayer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  const [sort, setSort] = useState<SortOption>('newest')
  const [modeFilter, setModeFilter] = useState<RoomMode | 'ALL' | 'QUICK_MATCH'>('ALL')
  const [codeJoinError, setCodeJoinError] = useState<string | null>(null)
  const [isCodeJoining, setIsCodeJoining] = useState(false)
  const [roomEndedBanner, setRoomEndedBanner] = useState<string | null>(null)

  // Show banner once when redirected here with a roomEndedReason in nav state.
  useEffect(() => {
    const navState = location.state as { roomEndedReason?: string } | null
    if (navState?.roomEndedReason) {
      setRoomEndedBanner(navState.roomEndedReason)
      window.history.replaceState({}, '')
      const timer = setTimeout(() => setRoomEndedBanner(null), 6000)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoinByCode = async (code: string) => {
    setIsCodeJoining(true)
    setCodeJoinError(null)
    try {
      const res = await api.post('/api/rooms/join', { roomCode: code })
      const room = res.data.room
      const target = room.status === 'IN_PROGRESS' ? 'quiz' : 'lobby'
      navigate(`/room/${room.id}/${target}`, { state: { room, mode: room.mode, viewerUserId: res.data.viewerUserId } })
    } catch (err: any) {
      setCodeJoinError(err?.response?.data?.message || t('multiplayer.badRoomCode'))
      setIsCodeJoining(false)
    }
  }

  useEffect(() => { if (!isAuthenticated) navigate('/login') }, [isAuthenticated, navigate])

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; rooms: PublicRoom[] }>({
    queryKey: ['public-rooms'],
    queryFn: () => api.get('/api/rooms/public').then(r => r.data),
    enabled: isAuthenticated,
    // 10s poll: a freshly-created room should show up for people already
    // browsing the lobby without F5 (no lobby-wide STOMP topic yet).
    refetchInterval: 10000,
    staleTime: 5000,
  })

  if (!isAuthenticated) return null

  const allRooms = data?.rooms ?? []
  const filtered = (() => {
    if (modeFilter === 'ALL') return allRooms
    if (modeFilter === 'QUICK_MATCH') return allRooms.filter(r => r.quickMatch === true)
    return allRooms.filter(r => !r.quickMatch && r.mode === modeFilter)
  })()
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'filling') return (b.currentPlayers / b.maxPlayers) - (a.currentPlayers / a.maxPlayers)
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  })

  const liveCount = allRooms.filter(r => r.status === 'LOBBY' || r.status === 'IN_PROGRESS').length

  return (
    <div data-testid="multiplayer-page" className="max-w-[1180px] mx-auto space-y-6 bg-bq-paper">

      {roomEndedBanner && (
        <div
          data-testid="multiplayer-room-ended-banner"
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#D97F06' }}
        >
          <span className="material-symbols-outlined text-lg">info</span>
          <span className="text-sm font-medium">
            {t(`room.ended.${roomEndedBanner.toLowerCase()}`, t('room.ended.generic', 'Phòng đã đóng'))}
          </span>
        </div>
      )}

      {/* ── Top header ── */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12.5px] font-bold" style={{ color: '#D97F06' }}>
              {t('multiplayer.subtitle', 'Chế độ Đa người chơi')}
            </span>
            <span className="w-1 h-1 rounded-full bg-bq-hair" />
            <span className="flex items-center gap-1.5 text-[11px] text-bq-ink2">
              <LiveDot />
              <span><span className="font-bold text-bq-ink">{liveCount}</span> {t('multiplayer.liveRoomsSuffix')}</span>
            </span>
          </div>
          <h1 className="font-display text-[28px] md:text-[34px] font-extrabold tracking-tight leading-tight text-bq-ink">
            {t('multiplayer.title', 'Phòng Chơi')}
          </h1>
          <p className="text-[13px] text-bq-ink2 mt-1">
            {t('multiplayer.desc', 'Realtime · 4 chế độ · Mời bạn bè cùng học Kinh Thánh qua game')}
          </p>
        </div>

        <button
          onClick={() => navigate('/my-sets')}
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-lg text-[13px] font-semibold transition-colors bg-bq-white"
          style={{ border: '1px solid #C9B58C', color: '#1D2B22' }}
        >
          <span className="material-symbols-outlined text-sm" style={FILL_1}>menu_book</span>
          {t('multiplayer.quizSetsBtn')}
        </button>
      </header>

      {/* ── Thin "Tham gia mã" bar (above hero per canonical mockup) ── */}
      <JoinByCodeBar onJoin={handleJoinByCode} disabled={isCodeJoining} error={codeJoinError} />

      {/* ── Hero row 50/50: Tạo phòng (gold) + Solo Arena (indigo) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-6 relative overflow-hidden bg-bq-white shadow-bq-soft"
          style={{
            border: '1px solid rgba(245,158,11,0.30)',
          }}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FFE08A)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#FFFFFF', fontVariationSettings: "'FILL' 1" }}>
                  workspace_premium
                </span>
              </div>
              <div className="text-[12px] font-bold" style={{ color: '#D97F06' }}>
                {t('multiplayer.create.kicker')}
              </div>
            </div>
            <h2 className="font-display text-[20px] font-extrabold mb-1.5 leading-tight text-bq-ink">{t('multiplayer.create.title')}</h2>
            <p className="text-[12.5px] text-bq-ink2 mb-4 leading-relaxed">
              {t('multiplayer.create.desc')}
            </p>
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <FeatureTag icon="group" label={t('multiplayer.create.tagPlayers')} />
              <FeatureTag icon="layers" label={t('multiplayer.create.tagModes')} />
              <FeatureTag icon="wifi" label={t('multiplayer.create.tagRealtime')} />
            </div>
            <button
              data-testid="multiplayer-create-btn"
              onClick={() => navigate('/room/create')}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-[14px] font-bold transition-opacity hover:opacity-90 shadow-bq-action"
              style={{ background: 'var(--bq-action)', color: 'var(--bq-action-fg)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              {t('multiplayer.createRoom', 'Tạo Phòng')}
            </button>
          </div>
        </div>

        <QuickMatchEntryCard />
      </section>

      {/* ── Mode showcase hidden 2026-05-20 (per user request) — modes still
            picked via /room/create flow; component preserved for future re-enable. */}

      {/* ── Active rooms section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[18px] font-bold tracking-tight text-bq-ink">
              {t('multiplayer.waitingRooms', 'Phòng đang chờ')}
            </h3>
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(46,125,79,0.10)', border: '1px solid rgba(46,125,79,0.22)' }}
            >
              <LiveDot />
              <span className="text-[12px] font-bold" style={{ color: '#2E7D4F' }}>Live · {liveCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={t('multiplayer.refresh', 'Làm mới')}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-bq-inset"
            >
              <span className={`material-symbols-outlined text-bq-ink2 ${isFetching ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>refresh</span>
            </button>
          </div>
        </div>

        {/* Filter chips: All + 4 modes + divider + sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip active={modeFilter === 'ALL'} onClick={() => setModeFilter('ALL')}>{t('multiplayer.filterAll')}</FilterChip>
          <FilterChip
            active={modeFilter === 'QUICK_MATCH'}
            onClick={() => setModeFilter('QUICK_MATCH')}
            icon="rocket_launch"
            iconColor="#2F6FB0"
          >
            {t('multiplayer.filterQuickMatch')}
          </FilterChip>
          {MODE_LIST.map(m => (
            <FilterChip
              key={m.id}
              active={modeFilter === m.id}
              onClick={() => setModeFilter(m.id)}
              icon={m.icon}
              iconColor={m.color}
            >
              {MODE_DISPLAY_LABEL[m.id]}
            </FilterChip>
          ))}
          <div className="w-px h-5 bg-bq-hair mx-1" />
          <FilterChip active={sort === 'newest'} onClick={() => setSort('newest')}>{t('multiplayer.sortNewest')}</FilterChip>
          <FilterChip active={sort === 'filling'} onClick={() => setSort('filling')}>{t('multiplayer.sortFilling')}</FilterChip>
        </div>

        {/* Rooms list (loading / error / empty / populated) */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 rounded-xl animate-pulse bg-bq-inset" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} retrying={isFetching} />
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sorted.map(room =>
              room.quickMatch
                ? <QuickMatchRoomCard key={room.id} room={room} />
                : <RoomCard key={room.id} room={room} />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Local sub-components ─────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative inline-block w-2 h-2">
      <span className="absolute inset-0 rounded-full bg-bq-emerald" />
      <span className="absolute inset-0 rounded-full bg-bq-emerald animate-ping opacity-75" />
    </span>
  )
}

function FeatureTag({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      className="px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1"
      style={{ background: '#EFE3C3', color: '#4D3A1F' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </span>
  )
}

function FilterChip({
  active, onClick, children, icon, iconColor,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: string
  iconColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-colors"
      style={{
        background: active ? 'rgba(245,158,11,0.14)' : '#FFFFFF',
        border: `1px solid ${active ? 'rgba(245,158,11,0.40)' : '#C9B58C'}`,
        color: active ? '#D97F06' : '#4D3A1F',
      }}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 12, color: iconColor }}>{icon}</span>
      )}
      {children}
    </button>
  )
}

function ErrorState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation()
  return (
    <div
      data-testid="multiplayer-error-state"
      className="flex flex-col items-center justify-center py-20 rounded-2xl"
      style={{ background: 'rgba(179,69,47,0.06)', border: '1px solid rgba(179,69,47,0.20)' }}
    >
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(179,69,47,0.12)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#B3452F' }}>error</span>
      </div>
      <h5 className="font-display text-lg font-bold text-bq-ink mb-2">{t('multiplayer.loadErrorTitle')}</h5>
      <p className="text-sm text-bq-ink2 text-center max-w-xs mb-6">{t('multiplayer.loadErrorDesc')}</p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="py-3 px-8 rounded-xl font-bold text-sm disabled:opacity-60 shadow-bq-action"
        style={{ background: 'var(--bq-action)', color: 'var(--bq-action-fg)' }}
      >
        {retrying ? t('multiplayer.loadErrorLoading') : t('multiplayer.loadErrorRetry')}
      </button>
    </div>
  )
}
