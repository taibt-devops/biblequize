import React, { useState } from 'react'

type Player = {
  id: string; userId: string; username: string; avatarUrl?: string;
  isReady: boolean; score: number;
}

type Props = {
  roomCode: string
  roomName: string
  questionCount: number
  timePerQuestion: number
  maxPlayers: number
  players: Player[]
  hostId: string
  isHost: boolean
  onStart: () => void
  onLeave: () => void
  // Connection + error state surfaced from the parent so the sequential
  // lobby can show the same reconnect banner / error fallback as the
  // standard lobby. Without these, members lose all WS feedback when the
  // socket drops or the room is closed by the host.
  connected?: boolean
  reconnecting?: boolean
  error?: string | null
}

const FILL = { fontVariationSettings: "'FILL' 1" } as const

const SequentialLobbyView: React.FC<Props> = ({
  roomCode, roomName, questionCount, timePerQuestion, maxPlayers, players,
  hostId, isHost, onStart, onLeave, connected = true, reconnecting = false, error = null,
}) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  // Pad with empty slots to show "+ slots remaining"
  const emptySlots = Math.max(0, Math.min(maxPlayers - players.length, 8 - players.length))

  // Error state — host closed room, room expired, network failure on retry.
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FBFAF5' }}>
        <div className="text-center space-y-4 max-w-sm">
          <span className="material-symbols-outlined text-bq-ruby text-5xl">error</span>
          <p className="text-bq-ink text-base">{error}</p>
          <button onClick={onLeave} className="text-bq-amberd underline text-sm">
            Quay lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-bq-ink px-4 py-5 max-w-3xl mx-auto" style={{ background: '#FBFAF5' }}>
      {/* Reconnecting banner — same UX as the standard lobby */}
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-bq-ruby/90 text-white text-center py-2 text-sm font-medium">
          <span className="material-symbols-outlined text-sm align-middle mr-1">wifi_off</span>
          Đang kết nối lại...
        </div>
      )}
      {!connected && !reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-bq-amber/15 text-bq-amberd text-center py-2 text-xs font-medium">
          Mất kết nối
        </div>
      )}

      {/* Page header */}
      <div className="mb-5 flex items-center gap-2.5">
        <button onClick={onLeave} className="text-bq-ink2 hover:text-bq-ink" aria-label="Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(47,111,176,0.16) 0%, rgba(47,111,176,0.06) 100%)', border: '1px solid rgba(47,111,176,0.3)' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#2F6FB0', ...FILL }}>play_circle</span>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-extrabold truncate">Phòng "{roomName}"</h2>
            <p className="text-bq-ink2 text-[12px]">Đang chờ thành viên tham gia</p>
          </div>
        </div>
      </div>

      {/* Lobby card */}
      <div className="rounded-2xl p-5 mb-4 bg-bq-white shadow-bq-soft"
        style={{
          border: '1px solid #C9B58C',
        }}
      >
        {/* Room code wrap */}
        <div className="rounded-xl px-4 py-3.5 mb-4 flex items-center justify-between"
          style={{ background: '#EFE3C3', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[1px] text-bq-ink2 mb-0.5">Mã tham gia · Chia sẻ với anh chị em</div>
            <div className="text-[22px] font-extrabold tabular-nums" style={{ color: '#D97F06', letterSpacing: 4 }}>{roomCode}</div>
          </div>
          <button onClick={handleCopy}
            className="rounded-lg px-3 py-2 text-[11px] font-bold flex items-center gap-1.5"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#D97F06', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Đã copy' : 'Sao chép'}
          </button>
        </div>

        {/* Config strip 3 cells */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: 'collections_bookmark', value: `${questionCount} câu`, label: 'Quiz Set' },
            { icon: 'timer', value: `${timePerQuestion}s`, label: 'Mỗi câu' },
            { icon: 'forum', value: 'Tuần tự', label: 'Có pause' },
          ].map((c, i) => (
            <div key={i} className="rounded-lg px-3 py-2.5 text-center"
              style={{ background: '#EFE3C3', border: '1px solid #C9B58C' }}>
              <span className="material-symbols-outlined text-[16px] block mb-1" style={{ color: '#2F6FB0' }}>{c.icon}</span>
              <div className="text-[14px] font-extrabold">{c.value}</div>
              <div className="text-[9px] uppercase tracking-wide text-bq-ink2 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Players header */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-bq-emerald">groups</span>
            Người tham gia
          </div>
          <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-bq-emerald/10 text-bq-emerald">
            {players.length} / {maxPlayers}
          </span>
        </div>

        {/* Players grid */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
          {players.map(p => {
            const isHostP = p.userId === hostId
            const ready = !isHostP && p.isReady
            return (
              <div key={p.userId} className="text-center relative">
                {isHostP && <div className="absolute -top-1.5 left-1/2 translate-x-[60%] text-[14px]">👑</div>}
                <div className={`w-12 h-12 rounded-full mx-auto mb-1.5 grid place-items-center font-extrabold text-[18px] border-2 ${
                  isHostP ? 'border-[#F59E0B]' : ready ? 'border-bq-emerald' : 'border-bq-hair'
                }`}
                  style={{
                    background: isHostP
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97F06 100%)'
                      : ready
                        ? 'linear-gradient(135deg, #46C89A 0%, #2E7D4F 100%)'
                        : '#EFE3C3',
                    color: isHostP || ready ? '#FFFFFF' : '#4D3A1F',
                  }}>
                  {p.username[0]?.toUpperCase()}
                </div>
                <div className="text-[11px] font-semibold text-bq-ink truncate">{p.username}</div>
                <div className={`text-[9px] uppercase tracking-wider font-bold mt-0.5 ${
                  isHostP ? 'text-bq-amberd' : ready ? 'text-bq-emerald' : 'text-bq-ink3'
                }`}>
                  {isHostP ? 'Trưởng' : ready ? 'Sẵn sàng' : 'Đang vào...'}
                </div>
              </div>
            )
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-1.5 grid place-items-center text-bq-ink3 text-[20px] border-2 border-dashed border-bq-hair">
                +
              </div>
              <div className="text-[11px] text-bq-ink3">Chờ...</div>
            </div>
          ))}
        </div>

        {/* Action row */}
        {isHost ? (
          <>
            <div className="flex gap-2.5 mb-2.5">
              <button onClick={onLeave}
                className="rounded-xl px-4 py-3.5 text-[13px] font-bold"
                style={{ background: '#EFE3C3', color: '#4D3A1F', border: '1px solid #C9B58C' }}>
                Đóng phòng
              </button>
              <button onClick={onStart}
                className="flex-1 rounded-xl py-4 text-[15px] font-extrabold flex items-center justify-center gap-2 bg-bq-action text-bq-ink shadow-bq-action">
                <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                Bắt đầu chơi
              </button>
            </div>
            <div className="text-center text-[11px] text-bq-ink2">
              <strong className="text-bq-amberd">Lưu ý:</strong> Khi bắt đầu, người vào sau sẽ không tham gia được
            </div>
          </>
        ) : (
          <div className="rounded-lg px-4 py-3 flex items-center justify-center gap-1.5 text-[12px]"
            style={{ background: 'rgba(47,111,176,0.06)', border: '1px solid rgba(47,111,176,0.22)', color: '#2F6FB0' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-bq-sapphire animate-pulse" />
            Đang chờ trưởng phòng bắt đầu...
          </div>
        )}
      </div>
    </div>
  )
}

export default SequentialLobbyView
