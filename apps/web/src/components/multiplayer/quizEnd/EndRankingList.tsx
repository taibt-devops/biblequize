import type { PlayerScore } from '../../../pages/room/RoomOverlays';

interface Props {
  /** Already rank-sorted (finalRank asc, then score desc). */
  ranked: PlayerScore[];
  myUsername: string;
  myUserId?: string;
}

const rankColor = (rank: number) =>
  rank === 1 ? '#e8a832' : rank === 2 ? '#d1d5db' : rank === 3 ? '#cd7f32' : '#9ca3af';

/** Scrollable final standings shown in the result-screen aside. */
export function EndRankingList({ ranked, myUsername, myUserId }: Props) {
  return (
    <div
      className="rounded-2xl p-4 mt-3"
      style={{
        // Secondary panel — opaque bg instead of backdrop blur to keep the
        // result screen smooth on mid-range Android (see QuizEndScreen).
        background: 'rgba(40,42,54,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
        animation: 'fadeIn 0.6s ease-out 0.5s backwards',
      }}
    >
      <div
        className="text-[12px] font-bold mb-3"
        style={{ color: '#9ca3af' }}
      >
        Bảng xếp hạng
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {ranked.map((r, i) => {
          const isMe = myUserId ? r.playerId === myUserId : r.username === myUsername;
          const rank = r.finalRank ?? i + 1;
          return (
            <div
              key={r.playerId}
              className="flex items-center gap-2 py-1"
              style={isMe ? {
                background: 'rgba(232,168,50,0.08)',
                border: '1px solid rgba(232,168,50,0.25)',
                borderRadius: 8,
                padding: '4px 8px',
              } : undefined}
            >
              <span className="font-bold text-sm w-5" style={{ color: rankColor(rank) }}>
                {rank}.
              </span>
              <span className="text-xs font-semibold text-white flex-1 truncate">
                {r.username}{rank === 1 ? ' 👑' : ''}{isMe ? ' (bạn)' : ''}
              </span>
              <span className="font-bold text-xs" style={{ color: rank === 1 ? '#e8a832' : '#fff' }}>
                {r.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EndRankingList;
