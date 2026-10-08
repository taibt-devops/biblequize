// QP-9 — Distinct card variant for Đấu Nhanh rooms in the active room
// grid. Indigo accent, "Đấu Nhanh" pill badge, "Phòng #{roomCode}" title,
// kicker shows actual mode + scope (config is creator-chosen per pivot,
// not Speed-Race-only). Source indicator: cpu for DATABASE, auto_awesome
// for AI_GENERATED (room.questionSource = 'AI_GENERATED' from QP-2).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import AvatarStack from './AvatarStack'
import { formatBookScope, type PublicRoom } from './types'
import { MODE_META, type RoomModeId } from '../create-room/modeMeta'

const INDIGO = '#2F6FB0'
const INDIGO_LIGHT = '#2F6FB0'

function modeShortLabel(id: string): string {
  switch (id) {
    case 'SPEED_RACE':    return 'Speed Race'
    case 'BATTLE_ROYALE': return 'Battle Royale'
    case 'TEAM_VS_TEAM':  return 'Team vs Team'
    case 'SUDDEN_DEATH':  return 'Đấu vương'
    default:              return id
  }
}

export default function QuickMatchRoomCard({ room }: { room: PublicRoom }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const mode = MODE_META[room.mode as RoomModeId] ?? MODE_META.SPEED_RACE
  const isFull = room.currentPlayers >= room.maxPlayers
  const isAi = (room.bookScope === '' && false) || /AI/i.test((room as { questionSource?: string }).questionSource ?? '')

  const handleJoin = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (joining || isFull) return
    setJoining(true); setJoinError(null)
    try {
      const res = await api.post('/api/rooms/join', { roomCode: room.roomCode })
      const joined = res.data.room
      const target = joined.status === 'IN_PROGRESS' ? 'quiz' : 'lobby'
      navigate(`/room/${joined.id}/${target}`, { state: { room: joined, mode: joined.mode, viewerUserId: res.data.viewerUserId } })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setJoinError(msg || t('multiplayer.joinError'))
      setJoining(false)
    }
  }

  return (
    <article
      data-testid="room-card"
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-transform hover:-translate-y-0.5 bg-bq-white border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22]"
      style={{ cursor: isFull ? 'default' : 'pointer' }}
      onClick={() => { if (!isFull) handleJoin() }}
    >
      {/* "Đấu Nhanh" pill (top-right) */}
      <div
        className="absolute top-3 right-3 px-2 py-0.5 rounded-md"
        style={{ background: 'rgba(47,111,176,0.12)', border: '1px solid rgba(47,111,176,0.30)' }}
      >
        <span className="text-[11.5px] font-bold" style={{ color: INDIGO_LIGHT }}>
          {t('multiplayer.filterQuickMatch')}
        </span>
      </div>

      {/* Top row: indigo icon + mode kicker + room code */}
      <div className="flex items-start gap-2 pr-16">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(47,111,176,0.10)', border: '1px solid rgba(47,111,176,0.22)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: INDIGO }}>rocket_launch</span>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold" style={{ color: INDIGO_LIGHT }}>
            {t('multiplayer.quickMatch.noHost', { mode: modeShortLabel(room.mode) })}
          </div>
          <div className="text-sm font-bold text-bq-ink truncate">{t('multiplayer.quickMatch.roomCode', { code: room.roomCode })}</div>
        </div>
      </div>

      {/* Source + scope line */}
      <div className="flex items-center gap-2 text-[11px] text-bq-ink2">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: INDIGO_LIGHT, fontVariationSettings: isAi ? "'FILL' 1" : undefined }}
        >
          {isAi ? 'auto_awesome' : 'memory'}
        </span>
        <span>{isAi ? t('multiplayer.quickMatch.aiSource') : t('multiplayer.quickMatch.serverSource')}</span>
        <span className="w-1 h-1 rounded-full bg-bq-hair" />
        <span>{formatBookScope(t, room.bookScope)}</span>
      </div>

      {/* Avatar stack + meta */}
      <div className="flex items-center justify-between gap-2">
        <AvatarStack initials={room.playerInitials ?? []} current={room.currentPlayers} max={room.maxPlayers} />
        <div className="text-[10px] text-bq-ink3 text-right flex-shrink-0">
          {t('multiplayer.quickMatch.questionsMeta', { count: room.questionCount ?? 10, time: room.timePerQuestion ?? 30 })}
        </div>
      </div>

      {joinError && (
        <div className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'rgba(179,69,47,0.10)', color: '#B3452F' }}>
          ⚠ {joinError}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleJoin() }}
        disabled={joining || isFull}
        className={`lk-btn w-full !py-2 text-[15px] ${isFull ? '!bg-bq-inset text-bq-ink2' : 'lk-btn-2 text-bq-ink'}`}
      >
        {joining ? t('multiplayer.quickMatch.ctaJoining') : isFull ? t('multiplayer.quickMatch.ctaFull') : t('multiplayer.quickMatch.ctaEnterNow')}
      </button>

      {/* Reference imports to keep the variable usage explicit. */}
      <span className="hidden">{mode.id}</span>
    </article>
  )
}
