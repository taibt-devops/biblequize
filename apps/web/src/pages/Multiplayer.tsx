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
import { PlaceBackdrop, Plaque } from '../components/lk/Place'

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
    <div data-testid="multiplayer-page" className="relative max-w-[1180px] mx-auto space-y-6">
      <PlaceBackdrop place="square" veil="strong" />

      {roomEndedBanner && (
        <div
          data-testid="multiplayer-room-ended-banner"
          className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-bq-cream border-[3px] border-bq-ink text-bq-ink"
        >
          <span className="material-symbols-outlined text-lg">info</span>
          <span className="text-sm font-medium">
            {t(`room.ended.${roomEndedBanner.toLowerCase()}`, t('room.ended.generic', 'Phòng đã đóng'))}
          </span>
        </div>
      )}

      {/* ── Top header ── */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-3">
          <Plaque className="text-[28px] md:text-[38px]">
            <img src="/images/lk/pennant.webp" alt="" aria-hidden className="h-[1.05em]" />
            {t('multiplayer.title', 'Phòng Chơi')}
          </Plaque>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[13px] font-bold">
              <LiveDot />
              <span><span className="font-extrabold">{liveCount}</span> {t('multiplayer.liveRoomsSuffix')}</span>
            </span>
            <span className="px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full font-read text-[14px] text-bq-ink2">
              {t('multiplayer.desc', 'Realtime · 4 chế độ · Mời bạn bè cùng học Kinh Thánh qua game')}
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/my-sets')}
          className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full text-[14px] font-extrabold bg-bq-white border-2 border-bq-ink text-bq-ink shadow-[0_3px_0_#1D2B22] hover:bg-bq-cream active:translate-y-[3px] active:shadow-none"
        >
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-5" />
          {t('multiplayer.quizSetsBtn')}
        </button>
      </header>

      {/* ── Thin "Tham gia mã" bar (above hero per canonical mockup) ── */}
      <JoinByCodeBar onJoin={handleJoinByCode} disabled={isCodeJoining} error={codeJoinError} />

      {/* ── Hero row 50/50: Tạo phòng (gold) + Solo Arena (indigo) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-bq p-6 relative bg-bq-white border-[3px] border-bq-ink shadow-bq-card">
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-10" />
              <span className="px-2.5 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[12.5px] font-extrabold">
                {t('multiplayer.create.kicker')}
              </span>
            </div>
            <h2 className="m-0 font-display text-[24px] font-extrabold mb-1.5 leading-tight text-bq-ink">{t('multiplayer.create.title')}</h2>
            <p className="m-0 font-read text-[15px] text-bq-ink2 mb-4 leading-relaxed">
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
              className="lk-btn w-full md:w-auto text-bq-ink text-[16px]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
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
            <Plaque as="h3" className="text-[20px] md:text-[22px]">
              {t('multiplayer.waitingRooms', 'Phòng đang chờ')}
            </Plaque>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink">
              <LiveDot />
              <span className="text-[12.5px] font-extrabold">Live · {liveCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={t('multiplayer.refresh', 'Làm mới')}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-bq-white border-2 border-bq-ink shadow-[0_3px_0_#1D2B22] active:translate-y-[3px] active:shadow-none"
            >
              <span className={`material-symbols-outlined text-bq-ink ${isFetching ? 'animate-spin' : ''}`} style={{ fontSize: 18 }}>refresh</span>
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
          <div className="w-0.5 h-6 bg-bq-ink/25 mx-1" />
          <FilterChip active={sort === 'newest'} onClick={() => setSort('newest')}>{t('multiplayer.sortNewest')}</FilterChip>
          <FilterChip active={sort === 'filling'} onClick={() => setSort('filling')}>{t('multiplayer.sortFilling')}</FilterChip>
        </div>

        {/* Rooms list (loading / error / empty / populated) */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 rounded-2xl animate-pulse bg-bq-inset/80 border-[3px] border-bq-ink/20" />
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
    <span className="px-2.5 py-0.5 rounded-full text-[12.5px] font-bold flex items-center gap-1 bg-bq-paper border-2 border-bq-ink/30 text-bq-ink">
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
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
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full border-2 text-[13.5px] font-extrabold transition-colors ${
        active ? 'bg-bq-amber border-bq-ink text-bq-ink' : 'bg-bq-white/90 border-bq-ink/25 text-bq-ink2 hover:border-bq-ink'
      }`}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: iconColor }}>{icon}</span>
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
      className="flex flex-col items-center justify-center py-12 px-6 rounded-bq bg-bq-white border-[3px] border-bq-ink shadow-bq-card"
    >
      <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="h-28 mb-3" />
      <h5 className="font-display text-lg font-bold text-bq-ink mb-2">{t('multiplayer.loadErrorTitle')}</h5>
      <p className="text-sm text-bq-ink2 text-center max-w-xs mb-6">{t('multiplayer.loadErrorDesc')}</p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="lk-btn text-bq-ink text-[16px]"
      >
        {retrying ? t('multiplayer.loadErrorLoading') : t('multiplayer.loadErrorRetry')}
      </button>
    </div>
  )
}
