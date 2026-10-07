import React from 'react'

export type FinalPlayer = {
  playerId: string
  username: string
  score: number
  correctAnswers?: number
  totalAnswered?: number
  averageReactionTime?: number
}

type Props = {
  roomName: string
  results: FinalPlayer[]
  myUsername: string
  isHost: boolean
  totalQuestions: number
  totalSeconds?: number
  onShare?: () => void
  onCreateNew?: () => void
  onClose: () => void
}

const fmtAvg = (ms?: number): string => {
  if (!ms || ms <= 0) return '—'
  const seconds = ms / 1000
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const fmtElapsed = (s?: number): string => {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m} phút ${sec} giây`
}

const SequentialFinalView: React.FC<Props> = ({
  roomName, results, myUsername, isHost, totalQuestions, totalSeconds, onShare, onCreateNew, onClose,
}) => {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  const top3 = sorted.slice(0, 3)

  return (
    <div className="min-h-screen text-bq-ink px-4 py-6 max-w-3xl mx-auto" style={{ background: '#FBFAF5' }} data-testid="sequential-final">
      {/* Final banner */}
      <div className="rounded-2xl p-5 text-center mb-4 bg-bq-white shadow-bq-soft"
        style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
        <div className="text-[48px] mb-2" style={{ filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.35))' }}>🎉</div>
        <h3 className="font-display text-xl font-extrabold mb-1">Hoàn thành!</h3>
        <p className="text-bq-ink2 text-[12px]">
          "{roomName}" · {totalQuestions} câu · {sorted.length} người chơi{totalSeconds ? ` · ${fmtElapsed(totalSeconds)}` : ''}
        </p>
      </div>

      {/* Podium 3-col grid (1fr 1.2fr 1fr) — second/first/third order per mockup */}
      {top3.length > 0 && (
        <div className="grid gap-2 items-end mb-4" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
          {[top3[1], top3[0], top3[2]].map((p, idx) => {
            if (!p) return <div key={idx} />
            const place = idx === 0 ? 'second' : idx === 1 ? 'first' : 'third'
            const medal = place === 'first' ? '🥇' : place === 'second' ? '🥈' : '🥉'
            const borderColor = place === 'first' ? 'rgba(245,158,11,0.4)'
              : place === 'second' ? 'rgba(45,70,200,0.25)' : 'rgba(224,53,75,0.3)'
            const avatarBg = place === 'first' ? 'linear-gradient(135deg, #F59E0B, #D97F06)'
              : place === 'second' ? 'linear-gradient(135deg, #6E86F0, #2D46C8)' : 'linear-gradient(135deg, #FF7A5A, #E0354B)'
            const avatarColor = '#FFFFFF'
            const avatarSize = place === 'first' ? 48 : 40
            return (
              <div key={p.playerId} className="rounded-xl text-center relative px-2 py-3.5 bg-bq-white shadow-bq-soft"
                style={{ border: `1.5px solid ${borderColor}`, paddingTop: place === 'first' ? 22 : 14 }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[22px]">{medal}</div>
                <div className="rounded-full mx-auto mb-1.5 grid place-items-center font-extrabold border-2"
                  style={{
                    width: avatarSize, height: avatarSize,
                    fontSize: place === 'first' ? 18 : 14,
                    background: avatarBg, color: avatarColor,
                    borderColor: place === 'first' ? '#F59E0B' : place === 'second' ? '#6E86F0' : '#FF7A5A',
                  }}>
                  {p.username[0]?.toUpperCase()}
                </div>
                <div className="text-[11px] font-bold truncate mb-1">{p.username}</div>
                <div className="font-extrabold tabular-nums" style={{ color: '#D97F06', fontSize: place === 'first' ? 16 : 14 }}>
                  {p.score}
                </div>
                <div className="text-[9px] text-bq-ink2 mt-0.5">
                  {p.correctAnswers ?? 0}/{totalQuestions}{p.averageReactionTime ? ` · ${fmtAvg(p.averageReactionTime)} TB` : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full leaderboard list */}
      <div className="rounded-xl p-1.5 mb-4 bg-bq-white border border-bq-hair shadow-bq-soft">
        {sorted.map((p, idx) => {
          const isMe = p.username === myUsername
          return (
            <div key={p.playerId}
              className={`grid gap-2.5 items-center px-2.5 py-2.5 rounded-lg ${isMe ? 'border' : ''}`}
              style={{
                gridTemplateColumns: '28px 32px 1fr auto',
                background: isMe ? 'rgba(245,158,11,0.1)' : 'transparent',
                borderColor: isMe ? 'rgba(245,158,11,0.25)' : 'transparent',
              }}>
              <span className={`text-center text-[12px] font-extrabold ${isMe ? 'text-bq-amberd' : 'text-bq-ink3'}`}>
                {idx + 1}
              </span>
              <div className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold text-white"
                style={{
                  background: isMe ? 'linear-gradient(135deg, #F59E0B, #D97F06)'
                    : idx === 0 ? 'linear-gradient(135deg, #F59E0B, #D97F06)'
                    : 'linear-gradient(135deg, #A8A69C, #6C6A62)',
                }}>
                {p.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold truncate flex items-center gap-1.5">
                  {p.username}
                  {isMe && <span className="text-[8px] font-extrabold rounded px-1.5 py-0.5" style={{ background: 'rgba(245,158,11,0.2)', color: '#D97F06' }}>BẠN</span>}
                </div>
                <div className="text-[10px] text-bq-ink2 mt-0.5">
                  {p.correctAnswers ?? 0}/{totalQuestions} đúng{p.averageReactionTime ? ` · ${fmtAvg(p.averageReactionTime)} trung bình` : ''}
                </div>
              </div>
              <div className="text-[13px] font-extrabold tabular-nums" style={{ color: '#D97F06' }}>{p.score}</div>
            </div>
          )
        })}
      </div>

      {/* Action row */}
      <div className="flex gap-2.5">
        <button onClick={onShare ?? onClose}
          className="rounded-xl px-4 py-3.5 text-[13px] font-bold flex items-center gap-1.5"
          style={{ background: '#FFFFFF', color: '#6C6A62', border: '1px solid #E7E4DA' }}>
          <span className="material-symbols-outlined text-[16px]">share</span>
          Chia sẻ kết quả
        </button>
        {isHost ? (
          <button onClick={onCreateNew ?? onClose}
            className="flex-1 rounded-xl py-3.5 text-[14px] font-extrabold flex items-center justify-center gap-2 bg-bq-action text-bq-ink shadow-bq-action">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Tạo phòng mới
          </button>
        ) : (
          <button onClick={onClose}
            className="flex-1 rounded-xl py-3.5 text-[14px] font-extrabold bg-bq-action text-bq-ink shadow-bq-action">
            Quay về nhóm
          </button>
        )}
      </div>
    </div>
  )
}

export default SequentialFinalView
