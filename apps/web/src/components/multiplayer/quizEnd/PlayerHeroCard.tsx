import type { PlayerScore } from '../../../pages/room/RoomOverlays';
import { Stat } from './quizEndParts';

interface Props {
  me: PlayerScore;
  myUsername: string;
  myRank: number | null;
  totalQuestions: number;
}

const rankBadgeBg = (rank: number | null) =>
  rank === 1
    ? 'linear-gradient(135deg, #f4c560 0%, #e8a832 100%)'
    : rank === 2
    ? 'linear-gradient(135deg, #f3f4f6 0%, #9ca3af 100%)'
    : rank === 3
    ? 'linear-gradient(135deg, #cd7f32 0%, #8b5a2b 100%)'
    : 'rgba(50,52,64,0.9)';

/** Player-view hero card: personal rank + score + per-match stats.
 *  Sits between the title and the podium on the result screen. */
export function PlayerHeroCard({ me, myUsername, myRank, totalQuestions }: Props) {
  return (
    <div className="pt-4 pb-2">
      <div
        data-testid="end-hero-card"
        className="mx-auto rounded-2xl p-5 relative overflow-hidden"
        style={{
          maxWidth: 720,
          background: 'rgba(50,52,64,0.78)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(232,168,50,0.3)',
        }}
      >
        <div className="grid grid-cols-[auto_1fr] gap-4 lg:gap-5 items-center">
          <div className="relative shrink-0">
            <div
              className="rounded-full grid place-items-center font-bold text-white"
              style={{
                width: 80, height: 80,
                background: 'linear-gradient(135deg, #4ade80 0%, #047857 100%)',
                fontSize: 28,
              }}
            >
              {(me.username?.[0] ?? myUsername?.[0] ?? '?').toUpperCase()}
            </div>
            {myRank && (
              <div
                className="absolute -bottom-1 -right-1 grid place-items-center font-black"
                style={{
                  width: 36, height: 36,
                  borderRadius: '50%',
                  background: rankBadgeBg(myRank),
                  color: '#1D2B22',
                  border: '2px solid #1D2B22',
                }}
              >
                {myRank}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div
              className="text-[12.5px] font-bold mb-1"
              style={{ color: '#9ca3af' }}
            >
              Bạn về thứ
            </div>
            <div
              className="font-black text-2xl lg:text-4xl text-white tracking-tight"
              style={{ lineHeight: 1.1 }}
            >
              {myRank ? `Hạng ${myRank}` : 'Chưa xếp hạng'}
            </div>
            <div className="text-sm" style={{ color: '#d1d5db' }}>
              {me.username ?? myUsername}{me.score != null ? ` · ${me.score} điểm` : ''}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <Stat label="Đúng" value={`${me.correctAnswers ?? 0}/${me.totalAnswered ?? totalQuestions}`} color="#4ade80" />
              {/* BE returns accuracy as 0-100 already (RoomPlayer.getAccuracy
                  multiplies by 100). Don't double-scale. */}
              <Stat label="Chính xác" value={`${Math.round(me.accuracy ?? 0)}%`} color="#e8a832" />
              <Stat label="Tổng câu" value={`${totalQuestions}`} color="#d1d5db" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerHeroCard;
