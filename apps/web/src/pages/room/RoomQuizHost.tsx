import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchCurrentQuestion, useRoomChannel } from '../../hooks/useRoomChannel';
import { api } from '../../api/client';
import { PodiumBlock } from './RoomOverlays';
import HeadToHead from '../../components/multiplayer/HeadToHead';
import type { QuestionStartData, RoomEvent, RoomQuestion } from '../../types/room';

/**
 * Sprint 4 (S4-8) — Quản trò spectator + 4 controls.
 *
 * Lives at /room/:roomId/host. Mounted only when the lobby decides the
 * viewer is a Quản trò (host && !room.hostPlaysGame). Players continue
 * to land on the existing /room/:roomId/quiz page.
 *
 * Why a separate page instead of a flag inside RoomQuiz: the host UI
 * differs in non-trivial ways (correct-answer revealed real-time, no
 * answer buttons, live-answer status grid, control bar), and dragging
 * those branches into the 1400-line player page would make both
 * harder to read and test. Sharing happens at the WS event-handling
 * layer only.
 */

type Question = RoomQuestion;
type AnswerStatus = 'pending' | 'correct' | 'wrong';
type LiveAnswer = {
  userId: string;
  username: string;
  status: AnswerStatus;
  reactionTimeMs?: number;
};
type ScoreRow = { userId: string; username: string; score: number };

interface NavState {
  hostId?: string;
  hostName?: string;
  mode?: string;
  fromGroupId?: string;
}

interface FinalRanking {
  playerId?: string;
  username?: string;
  score?: number;
  correctAnswers?: number;
  totalAnswered?: number;
}

// QTR-1 — C5 answer palette (A=Coral, B=Sky, C=Gold, D=Sage). Literal class
// strings per position because Tailwind JIT cannot expand template strings;
// mirrors components/quiz/AnswerButton.tsx COLORS (host tiles are read-only,
// so only the default tile + letter variants are needed here).
const HOST_OPTION_STYLES = [
  { tile: 'border-answer-a/30 bg-answer-a/10', letter: 'bg-answer-a/20 text-answer-a' },
  { tile: 'border-answer-b/30 bg-answer-b/10', letter: 'bg-answer-b/20 text-answer-b' },
  { tile: 'border-answer-c/30 bg-answer-c/10', letter: 'bg-answer-c/20 text-answer-c' },
  { tile: 'border-answer-d/30 bg-answer-d/10', letter: 'bg-answer-d/20 text-answer-d' },
] as const;

// Rank accent colors for top-3 rows (gold / silver / bronze) — Khung Sáng
// contrast-safe variants that read on the light paper/white surfaces.
const RANK_ACCENTS = ['#D97F06', '#6C6A62', '#cd7f32'] as const;

const RoomQuizHost: React.FC = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as NavState;

  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);

  const [liveAnswers, setLiveAnswers] = useState<Record<string, LiveAnswer>>({});
  const [scores, setScores] = useState<ScoreRow[]>([]);

  const [isPaused, setIsPaused] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [skippedToast, setSkippedToast] = useState(false);
  const [finalRanks, setFinalRanks] = useState<FinalRanking[] | null>(null);
  const [matchStartedAt] = useState(() => Date.now());

  // FMR-5: shared typed event union/dispatcher (RoomEvent) — same contract
  // as the player view, no more ad-hoc per-page payload casts.
  const handleRoomEvent = (msg: RoomEvent) => {
    switch (msg.type) {
      case 'QUESTION_START': {
        const d = msg.data;
        setQuestionIndex(d.questionIndex);
        setTotalQuestions(d.totalQuestions);
        setTimeLimit(d.timeLimit);
        setTimeLeft(d.timeLimit);
        setQuestion(d.question);
        // Anti-spoiler 2026-05-23: BE đã bỏ correctAnswer khỏi QUESTION_START
        // payload (Quản trò subscribe cùng /topic/room/{id} sẽ thấy đáp án
        // trước player). Reveal chỉ sau ROUND_END / QUESTION_REVEALED.
        setCorrectIndex(null);
        setLiveAnswers({}); // reset for new round
        break;
      }
      case 'ROUND_END': {
        const d = msg.data;
        if (typeof d.correctIndex === 'number') setCorrectIndex(d.correctIndex);
        break;
      }
      case 'QUESTION_REVEALED': {
        // GROUP_LIVE_SEQUENTIAL reveal — same correctIndex field.
        const d = msg.data;
        if (typeof d.correctIndex === 'number') setCorrectIndex(d.correctIndex);
        break;
      }
      case 'ANSWER_SUBMITTED': {
        const d = msg.data;
        setLiveAnswers(prev => ({
          ...prev,
          [d.playerId]: {
            userId: d.playerId,
            username: d.username,
            status: d.isCorrect ? 'correct' : 'wrong',
            reactionTimeMs: d.reactionTimeMs,
          },
        }));
        break;
      }
      case 'SCORE_UPDATE': {
        const d = msg.data;
        setScores(prev => {
          const idx = prev.findIndex(s => s.userId === d.playerId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], score: d.newScore };
            return next.sort((a, b) => b.score - a.score);
          }
          return [...prev, { userId: d.playerId, username: d.username ?? '', score: d.newScore }]
            .sort((a, b) => b.score - a.score);
        });
        break;
      }
      case 'GAME_PAUSED':
        setIsPaused(true);
        break;
      case 'GAME_RESUMED':
        setIsPaused(false);
        break;
      case 'QUESTION_SKIPPED':
        setSkippedToast(true);
        setTimeout(() => setSkippedToast(false), 2500);
        break;
      case 'ROOM_ENDED':
        // End-early or stuck-game cleanup — show wrap-up if we have ranks
        // so far, otherwise bounce back to /multiplayer.
        if (finalRanks == null) {
          navigate('/multiplayer', { replace: true });
        }
        break;
      case 'QUIZ_END': {
        const d = msg.data;
        let rows: FinalRanking[] = [];
        if (Array.isArray(d)) rows = d;
        else if (Array.isArray(d?.finalResults)) rows = d!.finalResults!;
        else if (Array.isArray(d?.leaderboard)) rows = d!.leaderboard!;
        rows = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setFinalRanks(rows);
        break;
      }
    }
  };

  // Apply a REST current-question payload over the live state (reconnect
  // path) — same reset semantics as a QUESTION_START broadcast, with the
  // countdown adjusted for how much of the window already elapsed.
  const applyRehydratedQuestion = (data: QuestionStartData) => {
    setQuestion(data.question);
    setQuestionIndex(data.questionIndex);
    setTotalQuestions(data.totalQuestions);
    setTimeLimit(data.timeLimit);
    const elapsedSec = data.startedAtMs ? (Date.now() - data.startedAtMs) / 1000 : 0;
    setTimeLeft(Math.max(0, data.timeLimit - elapsedSec));
    setCorrectIndex(null);
    setLiveAnswers({});
  };

  const { connected, reconnecting } = useRoomChannel(roomId, {
    onEvent: handleRoomEvent,
    // F-web-4 fix (FMR-2): after a WS gap, re-pull the in-flight question.
    // Only overwrite when the round actually moved on — same-question
    // reconnects keep the live answer grid intact.
    onRehydrateQuestion: (data) => {
      if (data.question.id !== question?.id) applyRehydratedQuestion(data);
    },
  });

  // Rehydrate first question via REST when navigating từ lobby → host view.
  // Race: BE fires QUESTION_START đúng lúc host page chưa subscribe xong → host
  // miss câu đầu (player view có cùng pattern ở RoomQuiz.tsx mount effect). Bug
  // user report 2026-05-23 ("chỉ có câu đầu ko hiện"). Fallback REST endpoint
  // trả 200 nếu mid-question, 204 nếu giữa rounds — silent ignore lỗi.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      const data = await fetchCurrentQuestion(roomId);
      if (cancelled || !data) return;
      // Only seed if state still empty — STOMP event arrived first wins.
      setQuestion(prev => prev ?? data.question);
      setQuestionIndex(prev => (prev > 0 ? prev : data.questionIndex));
      setTotalQuestions(prev => prev || data.totalQuestions);
      setTimeLimit(prev => prev || data.timeLimit);
      const elapsedSec = data.startedAtMs ? (Date.now() - data.startedAtMs) / 1000 : 0;
      setTimeLeft(prev => prev || Math.max(0, data.timeLimit - elapsedSec));
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Local timer
  useEffect(() => {
    if (timeLeft <= 0 || isPaused) return;
    const t = setTimeout(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, isPaused]);

  const callHost = async (path: string, body?: object) => {
    setActionError(null);
    try {
      await api.post(`/api/rooms/${roomId}/host/${path}`, body ?? {});
    } catch (e) {
      const msg = (e as { userMessage?: string; message?: string })?.userMessage
        || (e as Error)?.message || 'Lỗi điều khiển';
      setActionError(msg);
    }
  };

  const handlePauseToggle = () => isPaused ? callHost('resume') : callHost('pause');
  const handleSkip = () => callHost('skip-question');
  const handleSendBroadcast = () => {
    const msg = broadcastMsg.trim();
    if (!msg) return;
    callHost('broadcast', { message: msg });
    setBroadcastMsg('');
    setShowBroadcast(false);
  };
  const handleEndEarly = () => {
    setShowEndConfirm(false);
    callHost('end-early');
  };

  const handleReplayWithSameGroup = () => {
    // Sprint 4: pre-fill CreateRoom with mode + invite list. CreateRoom can
    // ignore unknown nav-state fields safely.
    navigate('/multiplayer/create', {
      state: {
        prefill: {
          mode: navState.mode ?? 'SPEED_RACE',
          invitePlayerIds: (finalRanks ?? []).map(r => r.playerId).filter(Boolean) as string[],
        },
      },
    });
  };

  const matchStats = useMemo(() => {
    const ranks = finalRanks ?? [];
    const totalCorrect = ranks.reduce((s, r) => s + (r.correctAnswers ?? 0), 0);
    const totalAnswered = ranks.reduce((s, r) => s + (r.totalAnswered ?? 0), 0);
    const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const durationS = Math.max(1, Math.round((Date.now() - matchStartedAt) / 1000));
    const m = Math.floor(durationS / 60);
    const s = durationS % 60;
    return {
      duration: `${m}m ${s}s`,
      avgAccuracy,
      players: ranks.length,
      totalQuestions,
    };
  }, [finalRanks, matchStartedAt, totalQuestions]);

  const liveAnswerList = useMemo(
    () => Object.values(liveAnswers).sort((a, b) => a.username.localeCompare(b.username)),
    [liveAnswers]
  );
  const answeredCount = liveAnswerList.length;
  // playerCount derived from scoreboard (best signal we have here without
  // a separate roomDetails fetch). Falls back to answered count.
  const playerCount = Math.max(scores.length, answeredCount);

  // QTR-5 — TV presentation: timer urgency derived per render (pure math,
  // no extra state). Amber while >50% of the window remains, ember ≤50%,
  // ruby ≤20% (Khung Sáng warm-family urgency, contrast-safe on paper).
  const timerRatio = timeLimit > 0 ? Math.max(0, Math.min(1, timeLeft / timeLimit)) : 0;
  const timerColor = timerRatio <= 0.2 ? '#E0354B' : timerRatio <= 0.5 ? '#FF6F3D' : '#D97F06';

  // ── Sprint 4 (S4-10): Quan Tro wrap-up screen — QTR-2 visual redesign:
  // centered max-w-3xl column, winner hero with gold accent + glow, 4 stat
  // tiles in one row, medal-accented ranking rows with correct-ratio bars. ──
  if (finalRanks) {
    const winner = finalRanks[0];
    // BR ranks by correctAnswers (DECISIONS 2026-06-12) — show "X/Y đúng" as
    // the primary number so rank #1 never displays a lower score than #2.
    const isBattleRoyale = navState.mode === 'BATTLE_ROYALE';
    const brMetric = (r: { correctAnswers?: number; totalAnswered?: number }) =>
      `${r.correctAnswers ?? 0}/${r.totalAnswered ?? 0} đúng`;
    return (
      <div
        data-testid="quiz-end-host-page"
        className="min-h-screen text-bq-ink relative"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(245,158,11,0.18) 0%, #FBFAF5 60%)',
          fontFamily: "'Be Vietnam Pro', sans-serif",
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 lg:px-6 pb-10">
          <header className="pt-4 flex items-center">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'rgba(245,158,11,0.18)', color: '#D97F06' }}
            >
              👑 Quản trò
            </span>
          </header>

          {/* Celebration header */}
          <div className="text-center pt-8 pb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] mb-2" style={{ color: '#D97F06' }}>
              Trận đấu kết thúc
            </div>
            {/* Audience-facing headline (this screen is cast to a TV) —
                celebrate the winner, not the organizer. */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl" aria-hidden="true">🏆</span>
              <h1
                className="font-display font-black text-3xl lg:text-4xl tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97F06 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Chúc mừng nhà vô địch!
              </h1>
            </div>
          </div>

          {/* QTR-6: podium = the celebration moment on the cast/TV screen
              (replaces the old winner hero card, which duplicated rank #1) */}
          {winner && (
            <div className="mb-8" data-testid="end-host-winner">
              {/* HRP: ≤2 người → duel cân đối (light) thay podium 3 bậc lệch. */}
              {finalRanks.length <= 2
                ? <HeadToHead results={finalRanks} light metric={isBattleRoyale ? brMetric : undefined} />
                : <PodiumBlock results={finalRanks} metric={isBattleRoyale ? brMetric : undefined} />}
            </div>
          )}

          {/* Stat tiles — one row on ≥sm, 2×2 on mobile */}
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#6C6A62' }}>
              📊 Thống kê trận đấu
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="end-host-stats">
              <StatCard label="Tổng câu hỏi" value={`${matchStats.totalQuestions || finalRanks[0]?.totalAnswered || 0}`} icon="quiz" />
              <StatCard label="Thời lượng" value={matchStats.duration} icon="timer" />
              <StatCard label="Người chơi" value={`${matchStats.players}`} icon="group" />
              <StatCard label="Tỷ lệ đúng TB" value={`${matchStats.avgAccuracy}%`} accent="#0E8A6B" icon="check_circle" />
            </div>
          </div>

          {/* Final rankings — hidden for ≤2 (head-to-head already shows both). */}
          {finalRanks.length > 2 && (
          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#6C6A62' }}>
              🏆 Xếp hạng cuối cùng
            </div>
            <ul className="space-y-2" data-testid="end-host-rankings">
              {finalRanks.map((r, i) => {
                const accent = RANK_ACCENTS[i];
                const ratio =
                  typeof r.correctAnswers === 'number' && typeof r.totalAnswered === 'number' && r.totalAnswered > 0
                    ? r.correctAnswers / r.totalAnswered
                    : null;
                return (
                  <li
                    key={r.playerId ?? `r${i}`}
                    className="bg-bq-white shadow-bq-soft rounded-xl px-3 py-2.5 flex items-center gap-3"
                    style={{
                      border: accent ? `1px solid ${accent}4D` : '1px solid #E7E4DA',
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-full grid place-items-center text-xs font-black flex-shrink-0"
                      style={
                        accent
                          ? { background: `${accent}26`, color: accent }
                          : { background: '#F2F0E7', color: '#6C6A62' }
                      }
                    >
                      {i + 1}
                    </span>
                    <div
                      className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6E86F0, #2D46C8)' }}
                    >
                      {r.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-bq-ink">{r.username}</div>
                      {ratio !== null && (
                        <div className="flex items-center gap-2 mt-1" data-testid={`host-rank-ratio-${i}`}>
                          <div className="h-1 flex-1 max-w-[120px] rounded-full overflow-hidden" style={{ background: '#F2F0E7' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.round(ratio * 100)}%`, background: '#0E8A6B' }}
                            />
                          </div>
                          <span className="text-[10px] whitespace-nowrap" style={{ color: '#0E8A6B' }}>
                            {r.correctAnswers}/{r.totalAnswered} đúng
                          </span>
                        </div>
                      )}
                    </div>
                    {isBattleRoyale ? (
                      <span className="text-right flex-shrink-0">
                        <span className="block text-base font-black tabular-nums" style={{ color: accent ?? '#16151B' }}>
                          {r.correctAnswers ?? 0}/{r.totalAnswered ?? 0}
                        </span>
                        <span className="block text-[10px] tabular-nums" style={{ color: '#6C6A62' }}>
                          {r.score ?? 0}đ
                        </span>
                      </span>
                    ) : (
                      <span
                        className="text-base font-black tabular-nums flex-shrink-0"
                        style={{ color: accent ?? '#16151B' }}
                      >
                        {r.score ?? 0}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          )}

          {/* Actions — primary gold CTA + ghost secondary row */}
          <div>
            <button
              data-testid="end-host-replay"
              onClick={handleReplayWithSameGroup}
              className="bg-bq-action text-bq-ink shadow-bq-action w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">replay</span>
              <span>Tổ chức trận mới với cùng nhóm</span>
            </button>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                data-testid="end-host-analytics"
                onClick={() => navigate(`/room/${roomId}/analytics`)}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-bq-ink"
                style={{ background: '#FFFFFF', border: '1px solid #E7E4DA' }}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">monitoring</span>
                Phân tích
              </button>
              <button
                data-testid="end-host-close"
                onClick={() => navigate('/multiplayer', { replace: true })}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-bq-ink"
                style={{ background: '#FFFFFF', border: '1px solid #E7E4DA' }}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">logout</span>
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="room-quiz-host-page"
      className="min-h-screen text-bq-ink"
      style={{ background: '#FBFAF5', fontFamily: "'Be Vietnam Pro', sans-serif" }}
    >
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[70] text-center py-2 text-sm font-medium text-white"
             style={{ background: 'rgba(224,53,75,0.92)' }}>
          Đang kết nối lại…
        </div>
      )}
      {!connected && !reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[60] text-center py-1 text-xs"
             style={{ background: '#F2F0E7', color: '#6C6A62' }}>
          Đang chờ kết nối…
        </div>
      )}

      {/* QTR-5 — TV presentation layout: compact header strip + dramatic
          timer, oversized question/answers (read-from-the-couch scale),
          sticky sidebar ticker. Mobile stays single column with the full
          sticky bottom control bar. */}
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 pt-4 lg:pt-6 pb-28 lg:pb-24">
        {/* Header strip — badge · Câu X/N · host name | big urgency timer */}
        <header className="flex items-center justify-between gap-3 mb-2 lg:mb-3" data-testid="host-header">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <span
              className="px-2 py-0.5 lg:px-2.5 lg:py-1 rounded text-[10px] lg:text-xs font-bold uppercase tracking-wider flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.18)', color: '#D97F06' }}
            >
              👑 Quản trò
            </span>
            <span className="text-sm lg:text-lg font-bold text-bq-ink2 flex-shrink-0" data-testid="host-question-counter">
              Câu {questionIndex + (question ? 1 : 0)} / {totalQuestions || '?'}
            </span>
            {navState.hostName && (
              <span className="hidden sm:block text-xs lg:text-sm truncate" style={{ color: '#A8A69C' }}>
                · Quản trò: {navState.hostName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0" data-testid="host-timer">
            <span className="material-symbols-outlined text-2xl lg:text-3xl" style={{ color: timerColor }} aria-hidden="true">timer</span>
            <span
              className="font-display font-black text-3xl lg:text-4xl xl:text-5xl tabular-nums transition-colors duration-500"
              style={{ color: timerColor }}
            >
              {timeLeft}s
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: connected ? '#0E8A6B' : '#E0354B' }}
              aria-hidden="true"
            />
          </div>
        </header>
        {/* Countdown bar — thick, amber → ember → ruby as time runs out */}
        <div className="h-2 rounded-full overflow-hidden mb-4 lg:mb-6" style={{ background: '#F2F0E7' }}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear${timerRatio > 0.5 ? ' bg-bq-flame' : ''}`}
            style={{
              width: `${timerRatio * 100}%`,
              background: timerRatio > 0.5 ? undefined : timerColor,
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start">

          {/* ── Main column ── */}
          <main className="min-w-0 space-y-4">
            {/* Question card */}
            <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 lg:p-8" data-testid="host-question-card">
              {question ? (
                <>
                  <h2 className="font-display text-3xl lg:text-4xl xl:text-5xl font-bold leading-snug lg:leading-snug mb-6 lg:mb-8 text-bq-ink">
                    {question.content}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    {question.options.map((opt, i) => {
                      const isCorrect = correctIndex === i;
                      const revealed = correctIndex !== null;
                      const c = HOST_OPTION_STYLES[i] ?? HOST_OPTION_STYLES[0];
                      return (
                        <div
                          key={i}
                          data-testid={`host-option-${i}`}
                          className={
                            isCorrect
                              ? 'answer-correct-anim relative flex items-center gap-4 rounded-2xl border-2 px-4 py-5 lg:px-5 lg:py-6 min-h-[72px] scale-[1.02] transition-transform duration-300'
                              : `relative flex items-center gap-4 rounded-2xl border-2 px-4 py-5 lg:px-5 lg:py-6 min-h-[72px] transition-all duration-200 ${c.tile}${revealed ? ' opacity-20' : ''}`
                          }
                          style={
                            isCorrect
                              ? {
                                  background: 'rgba(14,138,107,0.12)',
                                  borderColor: '#0E8A6B',
                                  boxShadow: '0 0 40px rgba(14,138,107,0.35)',
                                }
                              : undefined
                          }
                        >
                          <div
                            className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl grid place-items-center text-xl lg:text-2xl font-bold flex-shrink-0 ${c.letter}`}
                            style={isCorrect ? { background: '#0E8A6B', color: '#FFFFFF' } : undefined}
                          >
                            {['A','B','C','D'][i] ?? '?'}
                          </div>
                          <span
                            className={`flex-1 text-xl lg:text-2xl leading-snug ${
                              isCorrect ? 'text-bq-emerald font-semibold' : 'text-bq-ink font-medium'
                            }`}
                          >
                            {opt}
                          </span>
                          {isCorrect && (
                            <span className="text-xs lg:text-sm font-bold whitespace-nowrap flex-shrink-0" style={{ color: '#0E8A6B' }}>
                              ✓ ĐÁP ÁN
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-bq-ink2 py-10">Đang chờ câu hỏi đầu tiên…</div>
              )}
            </section>

            {/* Controls — QTR-5: the host screen is cast to a TV, so on lg+
                the 4 admin buttons collapse into a discreet floating pill
                bottom-right, dimmed (opacity-40) until the host hovers or
                tabs into it. Mobile keeps the full sticky bottom bar (host
                drives from a phone). */}
            <section
              data-testid="host-controls-bar"
              className={`fixed bottom-0 inset-x-0 p-3 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:p-0 lg:transition-opacity lg:duration-300 ${
                isPaused
                  ? 'z-[60] lg:opacity-100'
                  : 'z-40 lg:opacity-40 lg:hover:opacity-100 lg:focus-within:opacity-100'
              }`}
            >
              <div
                className="bg-bq-white shadow-bq-soft relative mx-auto max-w-xl rounded-2xl px-3 py-2.5 border lg:mx-0 lg:max-w-none lg:rounded-full lg:px-2 lg:py-1.5"
                style={{ borderColor: '#E7E4DA' }}
              >
                {actionError && (
                  <div
                    className="text-[10px] mb-1.5 text-center lg:absolute lg:bottom-full lg:right-0 lg:mb-2 lg:whitespace-nowrap lg:px-3 lg:py-1.5 lg:rounded-lg lg:bg-bq-white lg:shadow-bq-soft"
                    style={{ color: '#E0354B' }}
                  >
                    {actionError}
                  </div>
                )}
                <div className="flex items-stretch justify-center gap-2 lg:gap-1.5">
                  <button
                    data-testid="host-control-pause"
                    onClick={handlePauseToggle}
                    className="flex-1 lg:flex-none px-2 lg:px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-full flex items-center justify-center gap-1.5 text-xs lg:text-[11px] font-semibold transition-colors"
                    style={{ background: '#F2F0E7', border: '1px solid #E7E4DA', color: '#16151B' }}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {isPaused ? 'play_arrow' : 'pause'}
                    </span>
                    <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                  </button>
                  <button
                    data-testid="host-control-skip"
                    onClick={handleSkip}
                    className="flex-1 lg:flex-none px-2 lg:px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-full flex items-center justify-center gap-1.5 text-xs lg:text-[11px] font-semibold transition-colors"
                    style={{ background: '#F2F0E7', border: '1px solid #E7E4DA', color: '#16151B' }}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">skip_next</span>
                    <span>Bỏ câu</span>
                  </button>
                  <button
                    data-testid="host-control-broadcast"
                    onClick={() => setShowBroadcast(true)}
                    className="flex-1 lg:flex-none px-2 lg:px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-full flex items-center justify-center gap-1.5 text-xs lg:text-[11px] font-semibold transition-colors"
                    style={{ background: '#F2F0E7', border: '1px solid #E7E4DA', color: '#16151B' }}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
                    <span>Nhắn</span>
                  </button>
                  <button
                    data-testid="host-control-end"
                    onClick={() => setShowEndConfirm(true)}
                    className="flex-1 lg:flex-none px-2 lg:px-3.5 py-2 lg:py-1.5 rounded-xl lg:rounded-full flex items-center justify-center gap-1.5 text-xs lg:text-[11px] font-semibold transition-colors"
                    style={{ background: 'rgba(224,53,75,0.06)', border: '1px solid rgba(224,53,75,0.35)', color: '#E0354B' }}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">stop_circle</span>
                    <span>Kết thúc</span>
                  </button>
                </div>
              </div>
            </section>
          </main>

          {/* ── Sidebar (sticky on desktop) ── */}
          <aside className="space-y-4 lg:sticky lg:top-6" data-testid="host-sidebar">
            {/* Live answer ticker — QTR-5: TV-readable n/m counter + chips
                that pop in as ANSWER_SUBMITTED events land. (Per-option
                counts stay impossible — payload carries no option index.) */}
            <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 lg:p-5">
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#6C6A62' }}>
                Tình trạng trả lời
              </span>
              <div className="flex items-baseline gap-2 mt-1 mb-3">
                <span className="font-display font-black text-3xl lg:text-4xl tabular-nums" style={{ color: '#D97F06' }}>
                  {answeredCount}
                </span>
                <span className="font-bold text-lg tabular-nums text-bq-ink2">/ {playerCount}</span>
                <span className="text-xs font-semibold" style={{ color: '#6C6A62' }}>đã trả lời</span>
              </div>
              {liveAnswerList.length === 0 ? (
                <div className="text-xs text-bq-ink3 italic">Chưa có ai trả lời</div>
              ) : (
                <ul className="space-y-2" data-testid="host-live-answers">
                  {liveAnswerList.map(a => (
                    <li
                      key={a.userId}
                      className="host-chip-pop flex items-center gap-2.5 text-sm rounded-xl px-2.5 py-2"
                      style={{ background: '#F2F0E7' }}
                    >
                      <div
                        className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6E86F0, #2D46C8)' }}
                      >
                        {a.username[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="flex-1 truncate font-medium text-bq-ink">{a.username}</span>
                      {a.status === 'correct' && (
                        <span className="text-xs font-bold whitespace-nowrap" style={{ color: '#0E8A6B' }}>
                          ✓ ĐÚNG{a.reactionTimeMs ? ` · ${(a.reactionTimeMs/1000).toFixed(1)}s` : ''}
                        </span>
                      )}
                      {a.status === 'wrong' && (
                        <span className="text-xs font-bold whitespace-nowrap" style={{ color: '#E0354B' }}>
                          ✗ SAI{a.reactionTimeMs ? ` · ${(a.reactionTimeMs/1000).toFixed(1)}s` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Live scoreboard — top 5 with rank accents */}
            <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold mb-3" style={{ color: '#6C6A62' }}>
                🏆 Bảng xếp hạng tạm thời
              </div>
              {scores.length === 0 ? (
                <div className="text-xs text-bq-ink3 italic">Chưa có điểm</div>
              ) : (
                <ul className="space-y-1.5" data-testid="host-scoreboard">
                  {scores.slice(0, 5).map((s, i) => {
                    const accent = RANK_ACCENTS[i];
                    return (
                      <li
                        key={s.userId}
                        className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5"
                        style={{
                          background: '#F2F0E7',
                          border: accent ? `1px solid ${accent}33` : '1px solid transparent',
                        }}
                      >
                        <span
                          className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-black flex-shrink-0"
                          style={
                            accent
                              ? { background: `${accent}33`, color: accent }
                              : { background: '#FBFAF5', color: '#6C6A62' }
                          }
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-bq-ink">{s.username}</span>
                        <span className="font-bold tabular-nums" style={{ color: accent ?? '#16151B' }}>
                          {s.score}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <div
          data-testid="host-pause-overlay"
          className="fixed inset-0 z-50 grid place-items-center backdrop-blur-sm"
          style={{ background: 'rgba(251,250,245,0.82)' }}
        >
          <div className="text-center">
            <div className="text-5xl mb-3">⏸️</div>
            <div className="font-display font-bold text-2xl mb-1 text-bq-ink">Trận đấu đã tạm dừng</div>
            <div className="text-sm text-bq-ink2 mb-6">Bấm tiếp tục khi sẵn sàng</div>
            <button
              data-testid="host-pause-resume"
              onClick={handlePauseToggle}
              className="bg-bq-action text-bq-ink shadow-bq-action inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-lg"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Tiếp tục
            </button>
          </div>
        </div>
      )}

      {/* Skip toast */}
      {skippedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg text-sm font-semibold"
             style={{ background: 'rgba(245,158,11,0.95)', color: '#16151B' }}>
          ⏭️ Đã bỏ câu này
        </div>
      )}

      {/* Broadcast modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: 'rgba(22,21,27,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-4 bg-bq-white shadow-bq-soft border border-bq-hair">
            <div className="font-bold mb-2 text-bq-ink">💬 Nhắn cả phòng</div>
            <textarea
              data-testid="host-broadcast-input"
              maxLength={200}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Tin nhắn hiện 5 giây cho tất cả người chơi…"
              className="w-full rounded-lg p-2 text-sm text-bq-ink outline-none"
              style={{ background: '#F2F0E7', border: '1px solid #E7E4DA', minHeight: 80 }}
            />
            <div className="text-right text-[10px] text-bq-ink3 mb-3">{broadcastMsg.length} / 200</div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowBroadcast(false); setBroadcastMsg(''); }}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: '#F2F0E7', color: '#6C6A62' }}
              >
                Hủy
              </button>
              <button
                data-testid="host-broadcast-send"
                onClick={handleSendBroadcast}
                disabled={broadcastMsg.trim().length === 0}
                className="px-3 py-1.5 rounded text-sm font-bold bg-bq-action text-bq-ink shadow-bq-action"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End-early confirm */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: 'rgba(22,21,27,0.4)' }}>
          <div className="w-full max-w-sm rounded-xl p-4 bg-bq-white shadow-bq-soft border border-bq-hair">
            <div className="font-bold mb-2 text-bq-ink">🛑 Kết thúc trận đấu sớm?</div>
            <div className="text-sm text-bq-ink2 mb-4">
              Tất cả người chơi sẽ thấy bảng xếp hạng cuối cùng dựa trên điểm số hiện tại.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: '#F2F0E7', color: '#6C6A62' }}
              >
                Hủy
              </button>
              <button
                data-testid="host-end-confirm"
                onClick={handleEndEarly}
                className="px-3 py-1.5 rounded text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #E0354B, #B0233A)', color: '#fff' }}
              >
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* hostName now lives in the header strip (QTR-5) — the old fixed
          bottom-right footer chip would collide with the floating controls. */}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent?: string; icon?: string }> = ({ label, value, accent, icon }) => (
  <div
    className="bg-bq-white shadow-bq-soft rounded-xl p-3"
    style={{ border: '1px solid #E7E4DA' }}
  >
    {icon && (
      <span
        className="material-symbols-outlined text-[18px] mb-1 block"
        style={{ color: accent ?? '#D97F06' }}
        aria-hidden="true"
      >
        {icon}
      </span>
    )}
    <div className="font-display font-black text-lg lg:text-xl tabular-nums" style={{ color: accent ?? '#16151B' }}>{value}</div>
    <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: '#6C6A62' }}>{label}</div>
  </div>
);

export default RoomQuizHost;
