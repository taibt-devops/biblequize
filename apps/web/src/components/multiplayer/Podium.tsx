import { useMemo } from 'react';
import type { PlayerScore } from '../../pages/room/RoomOverlays';

interface Props {
  results: PlayerScore[];
  /** Compact variant for player view (mockup ⑥). Default = host variant. */
  compact?: boolean;
}

/**
 * Sprint 2 S2-11 — three-step podium reused by host and player end
 * screens. Host gets the full-height variant (95–200px); player view
 * passes compact=true for a 50–110px mini podium.
 *
 * Top-3 lookup uses finalRank when present (BE sets it for Speed
 * Race / Battle Royale). Falls back to score order when ranks are
 * missing.
 */
export function Podium({ results, compact = false }: Props) {
  // Display order: 2nd, 1st, 3rd — so 1st sits in the middle and visually
  // taller. Memoized so the two sorts don't re-run on every re-render the
  // result screen triggers from late STOMP events.
  const blocks = useMemo(() => {
    const byRank = results
      .filter(r => r.finalRank && r.finalRank <= 3)
      .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
    const top3 = byRank.length > 0
      ? byRank
      : [...results].sort((a, b) => b.score - a.score).slice(0, 3);
    return [top3[1], top3[0], top3[2]];
  }, [results]);

  // Step heights per position. Compact variant ≈ half the host heights.
  const blockHeight = (rank: number) => {
    if (compact) return rank === 1 ? 110 : rank === 2 ? 70 : 50;
    return rank === 1 ? 200 : rank === 2 ? 130 : 95;
  };
  const avatarSize = compact ? 48 : 80;
  const avatar1Size = compact ? 56 : 80;

  // Color per rank (1 = gold, 2 = silver, 3 = bronze).
  const blockBg = (rank: number) => {
    if (rank === 1) return 'linear-gradient(180deg, #f4c560 0%, #e8a832 100%)';
    if (rank === 2) return 'linear-gradient(180deg, #e5e7eb 0%, #9ca3af 100%)';
    return 'linear-gradient(180deg, #cd7f32 0%, #8b5a2b 100%)';
  };
  const numberColor = (rank: number) => (rank === 3 ? '#fff' : '#1D2B22');
  const scoreColor = (rank: number) =>
    rank === 1 ? '#e8a832' : rank === 2 ? '#9ca3af' : '#cd7f32';

  // Avatar gradient per slot index (visual variety, not score-tied).
  const avatarGrads = [
    'linear-gradient(135deg, #4ade80 0%, #047857 100%)', // emerald
    'linear-gradient(135deg, #e8a832 0%, #d4941f 100%)', // gold (host)
    'linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)', // sky
  ];

  return (
    <div
      data-testid="podium"
      className="flex items-end justify-center gap-3 lg:gap-4"
      style={{
        // min-height = block height + avatar + score/name copy + crown
        // halo. Was 300px which overflowed (block 200 + avatar 80 + name
        // 22 + score 22 = 324, plus crown). Use min-height so the box
        // grows with content instead of overflowing UP into the title.
        minHeight: compact ? 280 : 380,
        paddingTop: compact ? 28 : 44, // reserve room for the floating crown
        overflow: 'visible',
      }}
    >
      {blocks.map((p, i) => {
        if (!p) return null;
        // i: 0 = 2nd slot, 1 = 1st slot, 2 = 3rd slot
        const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
        const initial = (p.username?.[0] ?? '?').toUpperCase();
        const isFirst = rank === 1;
        return (
          <div
            key={p.playerId}
            className="flex-1 flex flex-col items-center podium-rise relative"
            style={{
              maxWidth: compact ? (isFirst ? 160 : 140) : (isFirst ? 200 : 180),
              animationDelay: rank === 1 ? '0s' : rank === 2 ? '0.2s' : '0.4s',
            }}
          >
            <div
              className="relative"
              style={{
                width: isFirst ? avatar1Size : avatarSize,
                height: isFirst ? avatar1Size : avatarSize,
                marginBottom: 8,
              }}
            >
              {/* 1st-place crown — positioned ABOVE the avatar without
                  pushing the flex-column up; memory rule "crown absolute,
                  no avatar shift". Pointer-events-none so it can't grab
                  hovers. */}
              {isFirst && (
                <div
                  aria-hidden="true"
                  className={compact ? 'text-xl' : 'text-3xl'}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 'calc(100% + 4px)',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    lineHeight: 1,
                    filter: 'drop-shadow(0 4px 12px rgba(232,168,50,0.5))',
                  }}
                >
                  👑
                </div>
              )}
              <div
                className={`grid place-items-center font-bold ${isFirst ? 'pulse-glow' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: avatarGrads[i % avatarGrads.length],
                  color: rank === 1 ? '#1D2B22' : '#fff',
                  fontSize: isFirst ? (compact ? 18 : 28) : (compact ? 14 : 22),
                  border: isFirst ? `3px solid #e8a832` : `2px solid #1D2B22`,
                }}
              >
                {initial}
              </div>
            </div>
            <div
              className={`${compact ? 'text-xs' : 'text-base lg:text-lg'} font-bold text-white truncate w-full text-center`}
            >
              {p.username}
            </div>
            <div
              className={compact ? 'text-[10px] font-bold' : 'text-base lg:text-lg font-bold'}
              style={{ color: scoreColor(rank) }}
            >
              {p.score}{compact ? 'đ' : ' điểm'}
            </div>
            <div
              className="w-full mt-2 rounded-t-xl flex items-center justify-center font-black"
              style={{
                height: blockHeight(rank),
                background: blockBg(rank),
                color: numberColor(rank),
                fontSize: compact ? '24px' : '48px',
                boxShadow: isFirst ? '0 -10px 50px rgba(232,168,50,0.4)' : 'none',
              }}
            >
              {rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Podium;
