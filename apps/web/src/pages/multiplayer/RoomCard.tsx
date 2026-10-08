// MLR — Room card redesigned per docs/MULTIPLAYER/MOCKUP_MULTIPLAYER_LOBBY.html.
// Mode badge box (top-left, tinted) → room title → host + group + relative
// time → avatar stack + capacity + meta (Q câu · Ts/câu · difficulty) → CTA.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { MODE_META, type RoomModeId } from '../create-room/modeMeta'
import AvatarStack from './AvatarStack'
import { DIFFICULTY_CONFIG, formatBookScope, formatRelativeTime, type PublicRoom } from './types'

const STATUS_BADGE_STYLE: Record<'WAITING' | 'ALMOST_FULL' | 'FULL' | 'PLAYING', { bg: string; fg: string; key: string }> = {
  WAITING:     { bg: 'rgba(46,125,79,0.12)', fg: '#2E7D4F', key: 'multiplayer.room.statusWaiting' },
  ALMOST_FULL: { bg: 'rgba(245,158,11,0.14)', fg: '#D97F06', key: 'multiplayer.room.statusAlmostFull' },
  FULL:        { bg: 'rgba(179,69,47,0.12)',  fg: '#B3452F', key: 'multiplayer.room.statusFull'  },
  PLAYING:     { bg: 'rgba(217,127,6,0.14)',  fg: '#D97F06', key: 'multiplayer.room.statusPlaying' },
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export default function RoomCard({ room }: { room: PublicRoom }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const mode = MODE_META[room.mode as RoomModeId] ?? MODE_META.SPEED_RACE
  const diff = DIFFICULTY_CONFIG[room.difficulty] ?? DIFFICULTY_CONFIG.MIXED

  const isFull = room.currentPlayers >= room.maxPlayers
  const almostFull = !isFull && room.currentPlayers >= room.maxPlayers - 1
  const playing = room.status === 'IN_PROGRESS'
  const status = playing ? STATUS_BADGE_STYLE.PLAYING
    : isFull ? STATUS_BADGE_STYLE.FULL
    : almostFull ? STATUS_BADGE_STYLE.ALMOST_FULL
    : STATUS_BADGE_STYLE.WAITING

  const handleJoin = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!room.id || joining) return
    setJoining(true); setJoinError(null)
    try {
      const res = await api.post('/api/rooms/join', { roomCode: room.roomCode })
      const joined = res.data.room
      const isOrganizerHost = joined.hostPlaysGame === false && joined.hostId === res.data.viewerUserId
      const target = joined.status === 'IN_PROGRESS' ? (isOrganizerHost ? 'host' : 'quiz') : 'lobby'
      navigate(`/room/${joined.id}/${target}`, { state: { room: joined, mode: joined.mode, viewerUserId: res.data.viewerUserId } })
    } catch (err: any) {
      setJoinError(err?.response?.data?.message || t('multiplayer.joinError'))
      setJoining(false)
    }
  }

  const cta = playing
    ? (room.joinable ? { label: joining ? t('multiplayer.room.ctaJoining') : t('multiplayer.room.ctaResume'), enabled: true }
                     : { label: t('multiplayer.room.ctaPlaying'),         enabled: false })
    : isFull         ? { label: t('multiplayer.room.ctaFull'),            enabled: false }
    : room.mode === 'SUDDEN_DEATH' ? { label: t('multiplayer.room.ctaQueue'),    enabled: true }
    : room.mode === 'TEAM_VS_TEAM' ? { label: t('multiplayer.room.ctaPickTeam'), enabled: true }
                                   : { label: t('multiplayer.room.ctaJoin'),    enabled: true }

  // cta.enabled already encodes per-status rules (joinable resume for
  // IN_PROGRESS, capacity for LOBBY) — don't re-gate on `waiting` here or
  // the rejoin button stays permanently disabled.
  const ctaEnabled = cta.enabled && !joining

  return (
    <article
      data-testid="room-card"
      className="rounded-xl p-4 flex flex-col gap-3 transition-all bg-bq-white shadow-bq-soft"
      style={{
        border: `1px solid ${almostFull ? hexToRgba(mode.color, 0.4) : '#C9B58C'}`,
        boxShadow: almostFull ? `0 0 16px ${hexToRgba(mode.color, 0.12)}` : undefined,
        cursor: ctaEnabled ? 'pointer' : 'default',
      }}
      onClick={() => { if (ctaEnabled) handleJoin() }}
    >
      {/* Top row: mode icon box + kicker/title + status pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: hexToRgba(mode.color, 0.18), border: `1px solid ${hexToRgba(mode.color, 0.25)}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: mode.color, fontVariationSettings: "'FILL' 1" }}>
              {mode.icon}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold truncate" style={{ color: mode.color }}>
              {modeLabel(room.mode)}
            </div>
            <div className="text-sm font-bold text-bq-ink truncate">{room.roomName}</div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0"
          style={{ background: status.bg, color: status.fg }}
        >
          {t(status.key)}
        </span>
      </div>

      {/* Host + relative time */}
      <div className="flex items-center gap-2 text-[11px] text-bq-ink2">
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#D97F06' }}>workspace_premium</span>
        <span className="truncate">{room.hostName ?? '—'}</span>
        <span className="w-1 h-1 rounded-full bg-bq-hair" />
        <span className="text-bq-ink3 flex-shrink-0">{formatRelativeTime(t, room.createdAt)}</span>
        {!room.isPublic && (
          <span
            className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#D97F06' }}
          >{t('multiplayer.room.privateBadge')}</span>
        )}
      </div>

      {/* Avatar stack + meta footer */}
      <div className="flex items-center justify-between gap-2">
        <AvatarStack initials={room.playerInitials ?? []} current={room.currentPlayers} max={room.maxPlayers} />
        <div className="text-[10px] text-bq-ink3 text-right flex-shrink-0">
          <div>{t('multiplayer.room.questionsMeta', { count: room.questionCount ?? 10, time: room.timePerQuestion ?? 30 })}</div>
          <div className="mt-0.5">
            <span className="text-bq-ink2">{formatBookScope(t, room.bookScope)}</span>
            <span className="mx-1 text-bq-ink3">·</span>
            <span style={{ color: diff.color }}>{t(diff.labelKey)}</span>
          </div>
        </div>
      </div>

      {joinError && (
        <div className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'rgba(179,69,47,0.10)', color: '#B3452F' }}>
          ⚠ {joinError}
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); if (ctaEnabled) handleJoin() }}
        disabled={!ctaEnabled}
        className="w-full h-9 rounded-lg text-[12px] font-bold transition-colors disabled:cursor-not-allowed"
        style={{
          background: ctaEnabled ? 'var(--bq-action)' : '#EFE3C3',
          color: ctaEnabled ? 'var(--bq-action-fg)' : '#6B5530',
        }}
      >
        {cta.label}
      </button>
    </article>
  )
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'SPEED_RACE':    return 'Speed Race'
    case 'BATTLE_ROYALE': return 'Battle Royale'
    case 'TEAM_VS_TEAM':  return 'Team vs Team'
    case 'SUDDEN_DEATH':  return 'Đấu vương'
    default:              return mode
  }
}
