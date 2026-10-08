import { useMemo, useRef } from 'react';
import Podium from './Podium';
import HeadToHead from './HeadToHead';
import ConfettiBurst from './ConfettiBurst';
import { Stat, ActionButton } from './quizEnd/quizEndParts';
import PlayerHeroCard from './quizEnd/PlayerHeroCard';
import EndRankingList from './quizEnd/EndRankingList';
import type { PlayerScore } from '../../pages/room/RoomOverlays';

interface Props {
  results: PlayerScore[];
  myUsername: string;
  /** Server-stable identity — preferred over myUsername (localStorage name
   *  can drift from the server's display name). */
  myUserId?: string;
  isHost: boolean;
  totalQuestions: number;
  /** Match start timestamp in millis. Used to render "Thời gian" stat;
   *  pass null/undefined and the stat shows "—". */
  startedAtMs?: number | null;
  onReplay: () => void;
  onClose: () => void;
  onShare: () => void;
  onNewRoom: () => void;
  onHome: () => void;
  onAnalytics?: () => void;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function QuizEndScreen({
  results, myUsername, myUserId, isHost, totalQuestions, startedAtMs,
  onReplay, onClose, onShare, onNewRoom, onHome, onAnalytics,
}: Props) {
  // Rank order: finalRank when the mode assigns it (BR/SD), else score DESC
  // (Speed Race & co never set finalRank — deriving rank from position fixes
  // the winner being shown as "Chưa xếp hạng").
  const ranked = useMemo(
    () => results.slice().sort((a, b) =>
      (a.finalRank ?? 99) !== (b.finalRank ?? 99)
        ? (a.finalRank ?? 99) - (b.finalRank ?? 99)
        : (b.score ?? 0) - (a.score ?? 0)),
    [results]
  );
  const me = useMemo(
    () => (myUserId ? ranked.find(r => r.playerId === myUserId) : undefined)
      ?? ranked.find(r => r.username === myUsername),
    [ranked, myUserId, myUsername]
  );
  const myRank = me ? (me.finalRank ?? ranked.indexOf(me) + 1) : null;
  const totalScore = useMemo(
    () => results.reduce((sum, r) => sum + (r.score ?? 0), 0),
    [results]
  );
  // Freeze "now" at mount — this screen keeps re-rendering as late STOMP
  // events arrive, and reading Date.now() in the render body made the
  // "Thời gian" stat tick upward on every re-render. Capture once.
  const shownAtRef = useRef(Date.now());
  const matchDuration = startedAtMs ? shownAtRef.current - startedAtMs : null;

  // Mockup spec: 40 confetti pieces for host, 25 for player.
  // Render once per mount (key off the ref so a remount re-spawns).
  const confettiKeyRef = useRef(shownAtRef.current);

  return (
    <div
      data-testid="quiz-end-screen"
      className="fixed inset-0 z-50 overflow-auto"
      style={{
        background: 'radial-gradient(ellipse at top, rgba(232,168,50,0.20) 0%, #1D2B22 60%)',
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      {/* Confetti — fixed full-bleed overlay above the radial gradient
          but below interactive content. position:fixed lets pieces fall
          past the page even after the user scrolls. */}
      <div
        className="pointer-events-none fixed inset-0 z-[51] overflow-hidden"
        aria-hidden="true"
      >
        <ConfettiBurst key={confettiKeyRef.current} count={isHost ? 40 : 25} />
      </div>

      {/* Top bar: role badge + room context + close */}
      <header
        className="flex items-center justify-between px-4 lg:px-6 h-14 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="px-2 py-0.5 rounded text-[12px] font-bold"
            style={{
              background: isHost ? 'rgba(232,168,50,0.2)' : 'rgba(255,255,255,0.06)',
              color: isHost ? '#e8a832' : '#d1d5db',
            }}
          >
            {isHost ? '👑 Host view' : 'Player view'}
          </span>
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            {totalQuestions ? `${totalQuestions} câu` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={isHost ? onClose : onHome}
          aria-label="Đóng"
          className="w-9 h-9 rounded-full grid place-items-center"
          style={{
            background: 'rgba(50,52,64,0.55)',
            color: '#9ca3af',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </header>

      {/* Main grid wraps title + content + actions so title centers with the
          podium column instead of viewport (had been off-center on lg+). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 px-4 lg:px-8 pt-6 pb-8">
        <div className="flex flex-col items-stretch min-w-0">
          {/* Title */}
          <div className="text-center pb-2" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div
              className="text-[12.5px] font-bold mb-2"
              style={{ color: '#e8a832', letterSpacing: '0.4em' }}
            >
              {isHost ? 'Trận đấu kết thúc' : 'Cảm ơn bạn đã chơi!'}
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl" aria-hidden="true">🏆</span>
              <h1
                className="font-black text-3xl lg:text-4xl tracking-tight"
                style={{
                  color: '#1D2B22',
                  textShadow: '0 0.06em 0 #FFC93C',
                  lineHeight: 1.1,
                }}
              >
                Vinh quang!
              </h1>
            </div>
          </div>

          {/* Player view: personal hero card sits between title and podium */}
          {!isHost && me && (
            <PlayerHeroCard me={me} myUsername={myUsername} myRank={myRank} totalQuestions={totalQuestions} />
          )}

          {/* RES: ≤2 players get a balanced duel layout; the 3-step podium
              looks lopsided + empty with two people. */}
          {results.length <= 2
            ? <HeadToHead results={results} compact={!isHost} />
            : <Podium results={results} compact={!isHost} />}

          {/* Match stats — drop "Thời gian" when the match start wasn't
              captured (reload / late join) so it never shows a bare "—". */}
          {(() => {
            const cells = [
              { label: 'Câu hỏi', value: `${totalQuestions}` },
              ...(matchDuration != null
                ? [{ label: 'Thời gian', value: formatDuration(matchDuration) }]
                : []),
              { label: 'Người chơi', value: `${results.length}` },
              { label: 'Tổng điểm', value: `${totalScore}` },
            ];
            return (
              <div
                className={`rounded-xl p-4 grid grid-cols-2 ${cells.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 mt-6`}
                style={{
                  // No backdrop blur on this secondary panel — stacking live
                  // blur layers under animating confetti janks mid-range Android.
                  background: 'rgba(40,42,54,0.92)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  animation: 'fadeIn 0.6s ease-out 0.4s backwards',
                }}
              >
                {cells.map((c, i) => (
                  <Stat key={c.label} label={c.label} value={c.value} color="#fff" border={i > 0} />
                ))}
              </div>
            );
          })()}
        </div>

        {/* Actions panel */}
        <aside
          className="flex flex-col"
          style={{ animation: 'fadeIn 0.6s ease-out 0.3s backwards' }}
        >
          {isHost ? (
            <div
              className="rounded-2xl p-5 mb-3"
              style={{
                background: 'rgba(50,52,64,0.78)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(232,168,50,0.3)',
              }}
            >
              <div
                className="text-[12.5px] font-bold mb-4 flex items-center gap-2"
                style={{ color: '#e8a832' }}
              >
                <span>👑</span><span>Lựa chọn của Host</span>
              </div>
              <div className="space-y-3">
                <ActionButton primary onClick={onReplay} icon="refresh" label="Chơi lại với phòng này" testId="end-host-replay" />
                {onAnalytics && (
                  <ActionButton onClick={onAnalytics} icon="analytics" label="Xem phân tích chi tiết" testId="end-host-analytics" />
                )}
                <ActionButton onClick={onClose} icon="logout" label="Đóng phòng" testId="end-host-close" danger />
              </div>
            </div>
          ) : (
            <>
              <div
                className="text-[12.5px] font-bold mb-3"
                style={{ color: '#9ca3af' }}
              >
                Tiếp theo?
              </div>
              <ActionButton primary onClick={onShare} icon="share" label="Chia sẻ kết quả" testId="end-player-share" />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <ActionButton onClick={onNewRoom} icon="swords" label="Phòng mới" testId="end-player-new-room" small />
                <ActionButton onClick={onHome} icon="home" label="Trang chủ" testId="end-player-home" small />
              </div>
              <div
                className="rounded-xl p-3 mt-4"
                style={{
                  background: 'rgba(50,52,64,0.55)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-2 text-[10px] mb-1" style={{ color: '#6b7280' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: '#e8a832' }}
                  />
                  <span className="uppercase tracking-wider font-bold">Trạng thái phòng</span>
                </div>
                <p className="text-xs" style={{ color: '#d1d5db' }}>
                  Host có thể bắt đầu trận mới · bạn vẫn ở trong phòng và sẽ tự vào trận tiếp theo nếu host chọn chơi lại.
                </p>
              </div>
            </>
          )}

          {/* Quick rankings — host gets a longer list, player gets a peek.
              Hidden for ≤2 players: the head-to-head duel already shows both,
              so the side list would just repeat it. */}
          {results.length > 2 && (
            <EndRankingList ranked={ranked} myUsername={myUsername} myUserId={myUserId} />
          )}
        </aside>
      </div>
    </div>
  );
}

export default QuizEndScreen;
