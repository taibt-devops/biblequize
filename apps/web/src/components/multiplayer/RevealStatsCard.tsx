interface Props {
  reactionMs: number;
  pointsEarned: number;
  newRank: number;
  rankDelta: number;       // positive = climbed, negative = dropped, 0 = same
  timeLimitSec: number;
}

/**
 * Sprint 2 Q3 — 4-cell stats card shown immediately after a round
 * resolves. Mirrors the desktop mockup state ③ "Stats card".
 *
 * Speed bucket is derived from reaction time vs. the question's
 * timeLimit (≤30% = Nhanh, ≤66% = Trung bình, else Chậm).
 */
export function RevealStatsCard({ reactionMs, pointsEarned, newRank, rankDelta, timeLimitSec }: Props) {
  const reactionSec = (reactionMs / 1000).toFixed(1);
  const ratio = timeLimitSec > 0 ? reactionMs / 1000 / timeLimitSec : 0;
  const speedLabel = ratio <= 0.30 ? '⚡ Nhanh' : ratio <= 0.66 ? '✦ Vừa' : '🐢 Chậm';
  const speedColor = ratio <= 0.30 ? '#4ade80' : ratio <= 0.66 ? '#e8a832' : '#ff8c42';
  const rankIcon = rankDelta > 0 ? '↑' : rankDelta < 0 ? '↓' : '·';
  const rankColor = rankDelta > 0 ? '#4ade80' : rankDelta < 0 ? '#f87171' : '#9ca3af';

  return (
    <div
      data-testid="reveal-stats-card"
      className="rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-0 text-center mt-4"
      style={{
        background: 'rgba(50,52,64,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        animation: 'fadeIn 0.4s ease-out 0.2s backwards',
      }}
    >
      <Cell label="Thời gian" value={`${reactionSec}s`} color="#fff" />
      <Cell label="Tốc độ" value={speedLabel} color={speedColor} divider />
      <Cell label="Điểm câu này" value={pointsEarned > 0 ? `+${pointsEarned}` : '0'} color="#e8a832" divider />
      <Cell
        label="Hạng"
        value={`${rankIcon} #${newRank || '—'}`}
        color={rankColor}
      />
    </div>
  );
}

const Cell: React.FC<{ label: string; value: string; color: string; divider?: boolean }> = ({ label, value, color, divider }) => (
  <div
    className={divider ? 'lg:border-x' : ''}
    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
  >
    <div className="text-[12px]" style={{ color: '#9ca3af' }}>
      {label}
    </div>
    <div className="font-bold text-lg mt-0.5" style={{ color }}>
      {value}
    </div>
  </div>
);

export default RevealStatsCard;
