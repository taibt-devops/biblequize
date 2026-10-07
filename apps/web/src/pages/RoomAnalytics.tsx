import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

type RoomDetails = {
  id: string;
  roomCode: string;
  roomName: string;
  status: string;
  mode: string;
  questionCount: number;
  timePerQuestion: number;
  startedAt?: string | null;
  endedAt?: string | null;
  hostName: string;
  currentPlayers: number;
  maxPlayers: number;
};

type LeaderboardEntry = {
  playerId: string;
  username: string;
  avatarUrl?: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  accuracy: number;
  finalRank?: number;
  playerStatus?: string;
};

type RoundAnalytics = {
  roundNo: number;
  questionId: string;
  questionContent: string;
  options: string[];
  correctIndex: number;
  totalAnswers: number;
  correctCount: number;
  avgResponseMs: number;
  distribution: number[];
};

const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const;

/**
 * Per-match analytics view for the host (and any curious player). Powered
 * by the existing GET /api/rooms/{id} + /api/rooms/{id}/leaderboard
 * endpoints — no per-question breakdown yet (the BE doesn't expose
 * room_rounds + room_answers as a public read; tracked for a follow-up).
 */
export default function RoomAnalytics() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [rounds, setRounds] = useState<RoundAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      try {
        const [roomRes, lbRes, anRes] = await Promise.all([
          api.get(`/api/rooms/${roomId}`),
          api.get(`/api/rooms/${roomId}/leaderboard`),
          api.get(`/api/rooms/${roomId}/analytics`),
        ]);
        if (cancelled) return;
        setRoom(roomRes.data?.room ?? null);
        const lb = (lbRes.data?.leaderboard ?? []) as LeaderboardEntry[];
        setBoard(lb.slice().sort((a, b) =>
          (a.finalRank ?? 99) - (b.finalRank ?? 99) || b.score - a.score
        ));
        const rs = (anRes.data?.rounds ?? []) as RoundAnalytics[];
        setRounds(rs);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message ?? 'Không tải được phân tích');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  const stats = useMemo(() => {
    if (board.length === 0) return null;
    const totalScore = board.reduce((s, p) => s + (p.score ?? 0), 0);
    const totalCorrect = board.reduce((s, p) => s + (p.correctAnswers ?? 0), 0);
    const totalAnswered = board.reduce((s, p) => s + (p.totalAnswered ?? 0), 0);
    const avgAccuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
    const winnerScore = board[0]?.score ?? 0;
    return { totalScore, totalCorrect, totalAnswered, avgAccuracy, winnerScore };
  }, [board]);

  const matchDuration = useMemo(() => {
    if (!room?.startedAt) return null;
    const start = new Date(room.startedAt).getTime();
    const end = room.endedAt ? new Date(room.endedAt).getTime() : Date.now();
    return Math.max(0, end - start);
  }, [room]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-bq-ink2 bg-bq-paper">
        Đang tải phân tích...
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 bg-bq-paper">
        <span className="material-symbols-outlined text-4xl" style={{ color: '#B3452F', ...FILL_STYLE }}>error</span>
        <p className="text-bq-ink text-center">{error ?? 'Không tìm thấy phòng'}</p>
        <button
          onClick={() => navigate('/multiplayer')}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-bq-action text-bq-ink shadow-bq-action"
        >
          Về danh sách phòng
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="room-analytics-page"
      className="min-h-screen px-4 lg:px-8 py-6 bg-bq-paper"
      style={{
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/room/${roomId}/quiz`)}
          className="text-sm font-semibold inline-flex items-center gap-1.5 text-bq-ink2"
          data-testid="analytics-back-btn"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại kết quả
        </button>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(245,158,11,0.18)', color: '#D97F06' }}
          >
            📊 Phân tích chi tiết
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto space-y-5">
        {/* Title */}
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] mb-1" style={{ color: '#4D3A1F' }}>
            {room.mode.replace(/_/g, ' ')} · {room.roomCode}
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold text-bq-ink tracking-tight">
            {room.roomName || 'Phân tích trận đấu'}
          </h1>
          {room.hostName && (
            <p className="text-sm mt-1" style={{ color: '#4D3A1F' }}>
              Chủ phòng: <span className="text-bq-ink font-semibold">{room.hostName}</span>
            </p>
          )}
        </div>

        {/* Match summary card */}
        <section
          className="rounded-2xl p-5 bg-bq-white border border-bq-hair shadow-bq-soft"
        >
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-0">
            <SummaryCell label="Câu hỏi" value={`${room.questionCount}`} />
            <SummaryCell label="Thời gian" value={formatDuration(matchDuration)} divider />
            <SummaryCell label="Người chơi" value={`${board.length}`} divider />
            <SummaryCell label="Tổng điểm" value={`${stats?.totalScore ?? 0}`} divider />
            <SummaryCell
              label="Độ chính xác trung bình"
              value={stats ? `${Math.round(stats.avgAccuracy * 100)}%` : '—'}
              divider
            />
          </div>
        </section>

        {/* Per-player breakdown */}
        <section
          className="rounded-2xl overflow-hidden bg-bq-white border border-bq-hair shadow-bq-soft"
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: '#C9B58C' }}>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#D97F06' }}>
              Chi tiết người chơi
            </h2>
          </div>
          {board.length === 0 ? (
            <p className="px-5 py-6 text-sm text-center" style={{ color: '#4D3A1F' }}>
              Phòng chưa có dữ liệu kết quả.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider" style={{ color: '#4D3A1F' }}>
                  <tr className="border-b" style={{ borderColor: '#C9B58C' }}>
                    <Th>Hạng</Th>
                    <Th>Người chơi</Th>
                    <Th align="right">Điểm</Th>
                    <Th align="right">Đúng</Th>
                    <Th align="right" className="hidden sm:table-cell">Trả lời</Th>
                    <Th align="right" className="hidden sm:table-cell">Chính xác</Th>
                    <Th className="hidden sm:table-cell">Trạng thái</Th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((p, i) => {
                    const rank = p.finalRank ?? i + 1;
                    // BE returns accuracy as a percentage 0-100 (RoomPlayer.getAccuracy
                    // multiplies by 100 internally). Fall back to manual ratio if missing.
                    const accPct = p.totalAnswered > 0
                      ? Math.round(p.accuracy ?? (p.correctAnswers / p.totalAnswered) * 100)
                      : 0;
                    return (
                      <tr
                        key={p.playerId}
                        className="border-b"
                        style={{ borderColor: '#C9B58C' }}
                      >
                        <Td>
                          <span
                            className="font-bold"
                            style={{
                              color: rank === 1 ? '#D97F06' : rank === 2 ? '#4D3A1F' : rank === 3 ? '#D97F06' : '#4D3A1F',
                            }}
                          >
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-semibold text-bq-ink">{p.username}</span>
                          {rank === 1 && <span className="ml-1">👑</span>}
                        </Td>
                        <Td align="right">
                          <span className="font-bold" style={{ color: rank === 1 ? '#D97F06' : '#1D2B22' }}>
                            {p.score}
                          </span>
                        </Td>
                        <Td align="right" className="tabular-nums" style={{ color: '#2E7D4F' }}>
                          {p.correctAnswers}
                        </Td>
                        <Td align="right" className="tabular-nums hidden sm:table-cell" style={{ color: '#4D3A1F' }}>
                          {p.totalAnswered}/{room.questionCount}
                        </Td>
                        <Td align="right" className="tabular-nums hidden sm:table-cell" style={{ color: accPct >= 70 ? '#2E7D4F' : accPct >= 40 ? '#D97F06' : '#B3452F' }}>
                          {accPct}%
                        </Td>
                        <Td className="hidden sm:table-cell">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{
                              background: p.playerStatus === 'ELIMINATED' ? 'rgba(179,69,47,0.12)' : 'rgba(46,125,79,0.12)',
                              color: p.playerStatus === 'ELIMINATED' ? '#B3452F' : '#2E7D4F',
                            }}
                          >
                            {p.playerStatus === 'ELIMINATED' ? 'Bị loại' : 'Hoàn thành'}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Per-question breakdown */}
        <section
          className="rounded-2xl overflow-hidden bg-bq-white border border-bq-hair shadow-bq-soft"
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: '#C9B58C' }}>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#D97F06' }}>
              Chi tiết từng câu hỏi
            </h2>
          </div>
          {rounds.length === 0 ? (
            <p className="px-5 py-6 text-sm text-center" style={{ color: '#4D3A1F' }}>
              Phòng chưa có vòng nào được lưu.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#C9B58C' }}>
              {rounds.map(r => (
                <RoundRow key={r.roundNo} round={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const RoundRow: React.FC<{ round: RoundAnalytics }> = ({ round: r }) => {
  const correctPct = r.totalAnswers > 0 ? Math.round((r.correctCount / r.totalAnswers) * 100) : 0;
  const avgSec = (r.avgResponseMs / 1000).toFixed(1);
  const maxOptCount = r.distribution.reduce((m, n) => Math.max(m, n), 0);
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const optionPalette = ['#FF6F3D', '#2F6FB0', '#F59E0B', '#2E7D4F', '#2F6FB0', '#4D3A1F'];

  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: '#C9B58C' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#D97F06' }}
            >
              Câu {r.roundNo + 1}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#4D3A1F' }}>
              {r.totalAnswers} người trả lời · TB {avgSec}s
            </span>
          </div>
          <p className="text-sm text-bq-ink leading-relaxed">{r.questionContent}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#4D3A1F' }}>
            Đúng
          </div>
          <div
            className="font-bold text-lg tabular-nums"
            style={{ color: correctPct >= 70 ? '#2E7D4F' : correctPct >= 40 ? '#D97F06' : '#B3452F' }}
          >
            {r.correctCount}/{r.totalAnswers} · {correctPct}%
          </div>
        </div>
      </div>

      {r.options.length > 0 && (
        <div className="mt-3 space-y-2">
          {r.options.map((opt, i) => {
            const count = r.distribution[i] ?? 0;
            const pct = r.totalAnswers > 0 ? (count / r.totalAnswers) * 100 : 0;
            const isCorrect = i === r.correctIndex;
            const barColor = isCorrect ? '#2E7D4F' : optionPalette[i] ?? '#4D3A1F';
            const barAlpha = maxOptCount > 0 ? count / maxOptCount : 0;
            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg grid place-items-center font-bold text-xs flex-shrink-0"
                  style={{
                    background: isCorrect ? 'rgba(46,125,79,0.14)' : `${barColor}1f`,
                    color: isCorrect ? '#2E7D4F' : barColor,
                    border: isCorrect ? '1px solid rgba(46,125,79,0.45)' : 'none',
                  }}
                >
                  {optionLetters[i] ?? i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm truncate ${isCorrect ? 'font-semibold text-bq-ink' : 'text-bq-ink2'}`}>
                      {opt}
                    </span>
                    {isCorrect && <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#2E7D4F' }}>✓ ĐÁP ÁN</span>}
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: '#EFE3C3' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: barColor,
                        opacity: 0.4 + 0.6 * barAlpha,
                      }}
                    />
                  </div>
                </div>
                <div className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: '#4D3A1F' }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

const SummaryCell: React.FC<{ label: string; value: string; divider?: boolean }> = ({ label, value, divider }) => (
  <div
    className={`text-center px-3 ${divider ? 'lg:border-l' : ''}`}
    style={{ borderColor: '#C9B58C' }}
  >
    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#4D3A1F' }}>{label}</div>
    <div className="font-bold text-bq-ink text-base lg:text-lg mt-0.5">{value}</div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; className?: string }> = ({ children, align = 'left', className }) => (
  <th className={`px-4 py-3 font-semibold text-${align} ${className ?? ''}`}>{children}</th>
);

const Td: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, align = 'left', className, style }) => (
  <td className={`px-4 py-3 text-${align} ${className ?? ''}`} style={style}>{children}</td>
);
