import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomChannel } from '../hooks/useRoomChannel';
import { useError } from '../contexts/ErrorContext';
import { api } from '../api/client';
import { soundManager } from '../services/soundManager';
import { haptic } from '../utils/haptics';
import QuizEndScreen from '../components/multiplayer/QuizEndScreen';
import ResultsChat from '../components/multiplayer/ResultsChat';
import { useRoomChatStore } from '../store/roomChatStore';
import { useRoomChatHistory } from '../hooks/useRoomChatHistory';
import { EliminationScreen, TeamWinScreen } from './room/RoomOverlays';
import SequentialFinalView from './room/SequentialFinalView';
import RoomQuizShell, { type FeedEntry } from './room/RoomQuizShell';
import { anchorQuestionStart, coreGameReducer, initialCoreGameState } from './room/roomQuizCore';
import { useBattleRoyale } from './room/hooks/useBattleRoyale';
import { useTeamVsTeam } from './room/hooks/useTeamVsTeam';
import { useSuddenDeath } from './room/hooks/useSuddenDeath';
import { useSequentialMode } from './room/hooks/useSequentialMode';
import { useTeamNames } from './room/teamNames';
import type {
  PlayerScore,
  QuestionStartData,
  QuizEndSummary,
  ReactionData,
  RoomEvent,
} from '../types/room';

interface RoomQuizLocationState {
  mode?: string;
  myTeam?: string;
  isHost?: boolean;
  hostId?: string;
  viewerUserId?: string;
  fromGroupId?: string;
  groupQuizSetName?: string | null;
  quizSetTotalQuestions?: number | null;
}

// ────────────────────── MAIN COMPONENT ──────────────────────
// FMR-4 composition point: core game state (reducer) + per-mode hooks
// (FMR-3) + typed room channel (FMR-2) feed the shared RoomQuizShell and
// the full-screen end/elimination overlays.

const RoomQuiz: React.FC = () => {
  const { t } = useTranslation();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as RoomQuizLocationState | null;
  const gameMode: string = state?.mode ?? 'SPEED_RACE';
  const myTeamFromState: string | null = state?.myTeam ?? null;

  const isBattleRoyale = gameMode === 'BATTLE_ROYALE';
  const isTeamVsTeam = gameMode === 'TEAM_VS_TEAM';
  const isSuddenDeath = gameMode === 'SUDDEN_DEATH';
  const isSequential = gameMode === 'GROUP_LIVE_SEQUENTIAL';
  const isHost: boolean = state?.isHost ?? false;

  // Display-only fallback — all identity *logic* matches by userId (FMR-7).
  const myUsername = localStorage.getItem('userName') ?? '';
  // Server-stable identity. Primary: viewerUserId handed through navigation
  // state (REST join/lobby responses). The legacy localStorage 'userId' key
  // was never written by the app — kept only as a harmless last resort; the
  // mount room-fetch below upgrades it from GET /api/rooms/{id}.
  const [myUserId, setMyUserId] = useState<string>(
    () => state?.viewerUserId ?? localStorage.getItem('userId') ?? ''
  );

  // Sprint 4 (S4-9): host control state — pause overlay, skip toast, host broadcast banner.
  const hostNameFromState = (state as { hostName?: string } | null)?.hostName;
  const hostPlaysGameFromState = (state as { hostPlaysGame?: boolean } | null)?.hostPlaysGame;
  const showHostHint = hostPlaysGameFromState === false; // Quan Tro mode → show "đang theo dõi" hint
  const [isPaused, setIsPaused] = useState(false);
  // PCV-17: ván mới của nhóm (REMATCH_READY) + phòng có phải Đấu nhanh (ai cũng mở ván mới được).
  const [rematch, setRematch] = useState<{ roomId: string; roomCode: string } | null>(null);
  const [isQuickMatchRoom, setIsQuickMatchRoom] = useState(false);
  const [skipToast, setSkipToast] = useState(false);
  const [hostBroadcast, setHostBroadcast] = useState<{ hostName: string; message: string } | null>(null);

  // Core question state (FMR-4 reducer)
  const [core, dispatchCore] = useReducer(coreGameReducer, initialCoreGameState);
  const [timeLeft, setTimeLeft] = useState(0);

  // Per-mode state + event handling (FMR-3)
  const br = useBattleRoyale(myUserId);
  const team = useTeamVsTeam(myUserId, myTeamFromState);
  const sd = useSuddenDeath(myUserId);
  const seq = useSequentialMode();
  // PCV-14: tên hai đội theo phòng (Đội đấu đội).
  const teamNames = useTeamNames(roomId);

  // Social fun state
  const [reactions, setReactions] = useState<ReactionData[]>([]);
  // latestAnswer / LiveFeed retired — see comment near ReactionBar (shell).

  // PCV-3: banner combo ×1,2/×1,5 cũ chỉ có ở giao diện (máy chủ không nhân điểm) nên đã bỏ;
  // chuỗi đúng thật do máy chủ tính (Đua tốc độ, đợt 2) hiện qua ROUND_END.results.

  // Sprint 2 Q3 — reveal-stats card. Captures the player's reaction
  // time when they submit, then on ROUND_END computes the score delta
  // and rank shift to populate the 4-cell card.
  const [revealStats, setRevealStats] = useState<{
    reactionMs: number; pointsEarned: number; newRank: number; rankDelta: number;
  } | null>(null);
  const lastSubmitMs = useRef<number | null>(null);
  const prevScoreRef = useRef<number>(0);
  const prevRankRef = useRef<number | null>(null);

  // Sprint 2 Q1 — persistent live-feed sidebar (rendered by the shell).
  const [feedHistory, setFeedHistory] = useState<FeedEntry[]>([]);
  const feedIdRef = useRef(0);
  const appendFeed = (kind: FeedEntry['kind'], text: string, tone: FeedEntry['tone']) => {
    feedIdRef.current += 1;
    setFeedHistory(prev => [
      ...prev.slice(-29),
      { id: feedIdRef.current, kind, text, tone },
    ]);
  };

  // C3: which players have submitted their answer for the current round.
  // Drives the mobile chip strip's ✓ vs pulse indicator and the bottom
  // waiting overlay. Cleared on QUESTION_START. Keyed by playerId
  // (server-stable userId) — identity fix d504299b.
  const [roundAnswered, setRoundAnswered] = useState<Set<string>>(new Set());

  // Sprint 2 S2-11: end-screen sound. Fire once on showPodium=true. We
  // can't drive this from inside PodiumScreen because that component is
  // shared with multiple modes and wouldn't know `myUsername`.
  const endSoundFiredRef = useRef(false);
  // Sprint 2 S2-11: capture match start (first QUESTION_START with
  // questionIndex===0) so the end screen can show "Thời gian" stat.
  const matchStartedAtRef = useRef<number | null>(null);

  const questionStartedAt = useRef<number>(0);
  const { showError } = useError();

  // Shared QUESTION_START application — used by the WS event and by the
  // reconnect rehydrate when the in-flight question changed underneath us.
  const applyQuestionStart = (data: QuestionStartData) => {
    // Sprint 2 S2-5: anchor the timer to the server's broadcast moment.
    // Falls back to local clock if BE didn't include startedAtMs (older
    // server / dev fixture).
    // PCV-3: đồng hồ máy người chơi lệch thì neo theo giờ máy (xem anchorQuestionStart).
    questionStartedAt.current = anchorQuestionStart(data, Date.now(), true);
    if (data.questionIndex === 0 && matchStartedAtRef.current === null) {
      matchStartedAtRef.current = questionStartedAt.current;
    }
    dispatchCore({ type: 'QUESTION_START', data });
    const elapsedSec = (Date.now() - questionStartedAt.current) / 1000;
    setTimeLeft(Math.max(0, data.timeLimit - elapsedSec));
    // Q3: reset reveal stats for the new question.
    setRevealStats(null);
    lastSubmitMs.current = null;
    // C3: reset answered tracker for the new round.
    setRoundAnswered(new Set());
  };

  // MPC-4: mirror chat into the shared store so the end-game results screen
  // can replay the lobby + post-match conversation.
  const appendChatToStore = useRoomChatStore(s => s.appendMessage);
  // MPC-7: replay server-persisted chat on mount/reload (survives F5 on results).
  useRoomChatHistory(roomId, hostNameFromState);

  // FMR-2/FMR-5: typed event dispatcher. Handles core + social + host-echo
  // events, then routes every event through the per-mode hooks (each ignores
  // what it doesn't own — same semantics as the pre-split single switch).
  const handleRoomEvent = (msg: RoomEvent) => {
    switch (msg.type) {
      case 'QUESTION_START': {
        applyQuestionStart(msg.data);
        break;
      }
      case 'CHAT_MESSAGE': {
        const d = msg.data;
        if (roomId) {
          appendChatToStore(roomId, {
            sender: d.sender, text: d.text,
            isHost: d.sender === hostNameFromState,
            isSystem: d.isSystem === true,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          });
        }
        break;
      }
      case 'QUESTION_REVEALED': {
        // Sequential reveal panel state lives in useSequentialMode; the
        // shared correctIndex + leaderboard mirror is core state.
        const d = msg.data;
        dispatchCore({
          type: 'QUESTION_REVEALED',
          correctIndex: d.correctIndex,
          leaderboard: Array.isArray(d.leaderboard) ? d.leaderboard : undefined,
        });
        break;
      }
      case 'ROUND_END': {
        const d = msg.data;
        const sortedNew = d.leaderboard.slice().sort((a, b) => b.score - a.score);
        dispatchCore({
          type: 'ROUND_END',
          correctIndex: d.correctIndex,
          scores: sortedNew,
          reveal: { explanation: d.explanation, reference: d.reference, answerCounts: d.answerCounts, results: d.results },
        });
        // Q1 + PCV-3: feed — đáp án và ai đúng (chỉ công bố khi vòng đã đóng).
        const letter = String.fromCharCode(65 + d.correctIndex);
        appendFeed('round_end', t('room.quiz.feedRoundEnd', { n: core.questionIndex + 1, letter }), 'neutral');
        const nameOf = (id: string) => d.leaderboard.find(p => p.playerId === id)?.username ?? '?';
        const right = (d.results ?? []).filter(r => r.isCorrect).map(r => nameOf(r.playerId));
        if (right.length > 0) appendFeed('answer', t('room.quiz.feedCorrect', { names: right.join(', ') }), 'ok');
        // Q3: reveal-stats card (only when the player submitted). PCV-3: điểm câu lấy từ máy chủ.
        if (lastSubmitMs.current !== null) {
          // Identity by playerId (=User.id server-side) — see PLAYER_ELIMINATED fix d504299b.
          const myNew = sortedNew.find(s => s.playerId === myUserId);
          const newRank = myNew ? sortedNew.findIndex(s => s.playerId === myUserId) + 1 : 0;
          const newScore = myNew?.score ?? prevScoreRef.current;
          const mine = d.results?.find(r => r.playerId === myUserId);
          const pointsEarned = mine ? mine.pointsEarned : Math.max(0, newScore - prevScoreRef.current);
          const rankDelta = prevRankRef.current ? prevRankRef.current - newRank : 0;
          setRevealStats({
            reactionMs: lastSubmitMs.current,
            pointsEarned,
            newRank,
            rankDelta,
          });
        }
        // Sprint 2 S2-6: reveal feedback — sound + haptic for the player's own pick.
        if (core.selected !== null) {
          const wasCorrect = core.selected === d.correctIndex;
          soundManager.play(wasCorrect ? 'correctAnswer' : 'wrongAnswer');
          wasCorrect ? haptic.correct() : haptic.wrong();
        }
        break;
      }
      case 'SCORE_UPDATE': {
        dispatchCore({ type: 'SCORE_UPDATE', data: msg.data });
        break;
      }
      case 'LEADERBOARD_UPDATE': {
        dispatchCore({ type: 'LEADERBOARD_UPDATE', data: msg.data });
        break;
      }

      // ── Social Fun ──
      case 'REACTION': {
        const d = msg.data;
        setReactions(prev => [...prev, d]);
        break;
      }
      case 'ANSWER_SUBMITTED': {
        const d = msg.data;
        // C3: mark this player as having answered this round (keyed by playerId — d504299b).
        setRoundAnswered(prev => {
          const next = new Set(prev);
          next.add(d.playerId);
          return next;
        });
        // PCV-3 (chống lộ đáp án): chỉ biết "đã trả lời"; đúng/sai công bố ở ROUND_END.
        appendFeed('answer', t('room.quiz.feedAnswered', { name: d.username }), 'neutral');
        break;
      }

      case 'QUIZ_END': {
        // Payload varies per mode — see QuizEndData in types/room.ts.
        const d = msg.data;
        if (isBattleRoyale) {
          const results = Array.isArray(d) ? d : d?.finalResults;
          if (results && results.length > 0) {
            dispatchCore({ type: 'SHOW_PODIUM', results });
          } else {
            navigate(`/multiplayer`, { replace: true });
          }
        } else if (isTeamVsTeam) {
          const obj: QuizEndSummary = Array.isArray(d) ? {} : (d ?? {});
          const results = obj.leaderboard ?? obj.finalResults ?? [];
          dispatchCore({ type: 'SET_FINAL_RESULTS', results });
          team.applyQuizEnd(obj);
        } else if (isSuddenDeath) {
          const results = Array.isArray(d) ? d : (d?.finalResults ?? []);
          dispatchCore({ type: 'SHOW_PODIUM', results });
        } else {
          // Speed Race: show podium if results available
          const results = Array.isArray(d) ? d : (d?.finalResults ?? []);
          if (results.length > 0) {
            dispatchCore({ type: 'SHOW_PODIUM', results });
          } else {
            navigate(`/multiplayer`, { replace: true });
          }
        }
        break;
      }
      case 'ROOM_ENDED': {
        // SPEC §5.4.0 R5 — backend recovered a stuck game or otherwise
        // ended the room out from under us. Bail to /multiplayer with the
        // reason so it can be toasted there.
        navigate('/multiplayer', { replace: true, state: { roomEndedReason: msg.data?.reason ?? 'GENERIC' } });
        break;
      }
      case 'REMATCH_READY': {
        setRematch(msg.data);
        break;
      }
      case 'HOST_CHANGED': {
        // SPEC §5.4.0 R4 — host promoted mid-game. We don't store
        // host details locally on this page; just log so dev tools can
        // verify the broadcast made it.
        break;
      }
      // ── Sprint 4 (S4-9) host control echoes ──
      case 'GAME_PAUSED': {
        setIsPaused(true);
        break;
      }
      case 'GAME_RESUMED': {
        setIsPaused(false);
        break;
      }
      case 'QUESTION_SKIPPED': {
        setSkipToast(true);
        setTimeout(() => setSkipToast(false), 2500);
        break;
      }
      case 'HOST_BROADCAST': {
        const d = msg.data;
        if (d?.message) {
          setHostBroadcast({ hostName: d.hostName ?? 'Quản trò', message: d.message });
          setTimeout(() => setHostBroadcast(null), 5000);
        }
        break;
      }
    }

    // Per-mode handling (FMR-3). Every hook sees every event — exactly like
    // the single pre-split switch, where mode events mutated their state
    // slices regardless of the page's active mode.
    br.handleEvent(msg);
    team.handleEvent(msg);
    sd.handleEvent(msg);
    seq.handleEvent(msg);
  };

  const { connected, reconnecting, send } = useRoomChannel(roomId, {
    onEvent: handleRoomEvent,
    onReconnect: () => { if (roomId) send(`/app/room/${roomId}/join`, {}); },
    // F-web-4 fix: after a WS gap, pull the cached current question so the
    // player view doesn't sit on stale state until the next broadcast.
    onRehydrateQuestion: (data) => {
      if (data.question.id !== core.question?.id) {
        // Question advanced while we were away — same flow as a live
        // QUESTION_START (clears selection + per-mode round state).
        handleRoomEvent({ type: 'QUESTION_START', data });
      } else {
        // Same question still running — just re-anchor the countdown.
        questionStartedAt.current = anchorQuestionStart(data, Date.now(), false);
        dispatchCore({ type: 'SEED_QUESTION', data });
        const elapsedSec = (Date.now() - questionStartedAt.current) / 1000;
        setTimeLeft(Math.max(0, data.timeLimit - elapsedSec));
      }
    },
  });

  // Sprint 2 S2-5: server-anchored countdown. Recompute remaining from
  // questionStartedAt every tick instead of decrementing locally — drift,
  // tab-throttled timers, and late-join all stay in sync.
  useEffect(() => {
    if (!core.timeLimit) return;
    if (timeLeft <= 0) return;
    const tick = () => {
      const elapsedSec = (Date.now() - questionStartedAt.current) / 1000;
      const remaining = Math.max(0, core.timeLimit - elapsedSec);
      setTimeLeft(remaining);
    };
    const t = setInterval(tick, 250); // 4Hz: smooth seconds digit + low cost
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.timeLimit, core.questionIndex]);

  // Sprint 2 S2-11: end-of-match sound — victory if I won, complete
  // otherwise. Once-only; the ref guards against re-fires from
  // showPodium toggling.
  useEffect(() => {
    if (!core.showPodium || endSoundFiredRef.current) return;
    endSoundFiredRef.current = true;
    const me = core.finalResults.find(r => r.playerId === myUserId);
    const won = !!me && me.finalRank === 1;
    soundManager.play(won ? 'victory' : 'quizComplete');
  }, [core.showPodium, core.finalResults, myUserId]);

  // Sprint 2 S2-5: per-second beep in the last 5 seconds, sharper at ≤3.
  // Tracks the last whole-second-played so a 4Hz tick doesn't spam.
  const lastTickSecond = useRef<number>(-1);
  useEffect(() => {
    const sec = Math.ceil(timeLeft);
    if (sec === lastTickSecond.current) return;
    lastTickSecond.current = sec;
    if (sec > 0 && sec <= 5 && core.selected === null) {
      soundManager.play(sec <= 3 ? 'timerWarning' : 'timerTick');
    }
  }, [timeLeft, core.selected]);

  // Mount-time rehydrate. Two cases:
  //   1) Room is IN_PROGRESS — pull the cached current question so the
  //      view doesn't sit on "Đang chờ câu hỏi..." until the next
  //      QUESTION_START broadcast.
  //   2) Room is ENDED — pull the leaderboard and seed showPodium so a
  //      reload on the end screen still shows results (without this the
  //      user falls back to "Đang chờ câu hỏi..." waiting on a QUIZ_END
  //      that already fired before mount).
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      try {
        const roomRes = await api.get(`/api/rooms/${roomId}`);
        if (cancelled) return;
        // Authoritative viewer identity (covers reloads where nav state is gone).
        if (roomRes.data?.viewerUserId) setMyUserId(roomRes.data.viewerUserId);
        setIsQuickMatchRoom(roomRes.data?.room?.quickMatch === true);
        const status = roomRes.data?.room?.status;
        if (status === 'ENDED') {
          const lbRes = await api.get(`/api/rooms/${roomId}/leaderboard`);
          if (cancelled) return;
          const board = lbRes.data?.leaderboard as PlayerScore[] | undefined;
          if (Array.isArray(board) && board.length > 0) {
            const sorted = board.slice().sort((a, b) =>
              (a.finalRank ?? 99) - (b.finalRank ?? 99) || b.score - a.score
            );
            dispatchCore({
              type: 'SEED_ENDED',
              results: sorted,
              totalQuestions: roomRes.data.room.questionCount ?? undefined,
            });
          }
          return; // no point hitting current-question for an ENDED room
        }
      } catch { /* fall through to current-question fetch */ }

      try {
        const res = await api.get(`/api/rooms/${roomId}/current-question`);
        if (cancelled || res.status !== 200 || !res.data?.question) return;
        const data = res.data.question as QuestionStartData;
        // Sprint 2 S2-5: prefer the cached server timestamp so the
        // remaining-seconds figure reflects how much of this question is
        // actually left, not a fresh full window.
        questionStartedAt.current = anchorQuestionStart(data, Date.now(), false);
        dispatchCore({ type: 'SEED_QUESTION', data });
        const elapsedSec = (Date.now() - questionStartedAt.current) / 1000;
        setTimeLeft(Math.max(0, data.timeLimit - elapsedSec));
      } catch { /* 204/error: keep waiting for QUESTION_START */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const canAnswer = useMemo(
    () => connected && core.question && timeLeft > 0 && core.selected === null && !core.submitting
      // PCV-13: người bị loại đã chọn "trả lời tiếp" (bóng) vẫn trả lời được.
      && !(br.state.isEliminated && !br.state.isSpectator) && !(isSuddenDeath && sd.state.sdSpectating) && !seq.state.revealedData,
    [connected, core.question, timeLeft, core.selected, core.submitting,
     br.state.isEliminated, isSuddenDeath, sd.state.sdSpectating, seq.state.revealedData]
  );

  const handleAdvance = () => {
    if (!roomId || !isHost || !isSequential) return;
    const ok = send(`/app/room/${roomId}/advance`, {});
    if (!ok) showError(t('room.quiz.networkUnstable', 'Mất kết nối, đang kết nối lại — thử lại sau giây lát'), 'warning');
  };

  const submitAnswer = (idx: number) => {
    if (!roomId || !core.question || !canAnswer) return;
    const reactionTimeMs = Date.now() - questionStartedAt.current;
    lastSubmitMs.current = reactionTimeMs;
    // Snapshot pre-round score + rank so ROUND_END can compute deltas.
    const sortedNow = [...core.scores].sort((a, b) => b.score - a.score);
    const myEntry = sortedNow.find(s => s.playerId === myUserId);
    prevScoreRef.current = myEntry?.score ?? 0;
    prevRankRef.current = myEntry ? sortedNow.findIndex(s => s.playerId === myUserId) + 1 : null;
    dispatchCore({ type: 'SELECT_ANSWER', index: idx });
    // C3: mark myself as answered locally — server's broadcast back to me
    // would re-set this but we can't rely on the round-trip.
    setRoundAnswered(prev => {
      const next = new Set(prev);
      next.add(myUserId);
      return next;
    });
    const ok = send(`/app/room/${roomId}/answer`, { questionIndex: core.questionIndex, answerIndex: idx, reactionTimeMs });
    if (!ok) {
      // WS disconnected — revert optimistic state so user can retry once
      // reconnect succeeds (otherwise selected !== null blocks resubmit).
      dispatchCore({ type: 'REVERT_SUBMIT' });
      showError(t('room.quiz.networkUnstable', 'Mất kết nối, đang kết nối lại — chọn lại đáp án sau giây lát'), 'warning');
      return;
    }
    setTimeout(() => dispatchCore({ type: 'SUBMIT_SETTLED' }), 500);
  };

  // PCV-15: số liệu dưới tên ở màn kết quả theo cách xếp hạng của mode.
  const endMetric = isSuddenDeath
    ? (p: PlayerScore) => t('room.end.sdMetric', { n: p.matchesWon ?? 0 })
    : isBattleRoyale
      ? (p: PlayerScore) => t('room.end.brMetric', { c: p.correctAnswers ?? 0, t: p.totalAnswered ?? 0 })
      : undefined;

  // PCV-17: mở ván mới cùng cài đặt (chủ phòng; Đấu nhanh: người chơi) rồi vào sảnh của nó.
  const startRematch = async () => {
    if (!roomId) return;
    try {
      const res = await api.post(`/api/rooms/${roomId}/rematch`);
      if (res.data?.success && res.data.room?.id) {
        navigate(`/room/${res.data.room.id}/lobby`, { replace: true, state: { room: res.data.room, viewerUserId: res.data.viewerUserId } });
      }
    } catch (err: any) {
      showError(err?.response?.data?.message ?? t('room.end.rematchFailed'), 'warning');
    }
  };
  const joinRematch = async () => {
    if (!rematch) return;
    try {
      const res = await api.post('/api/rooms/join', { roomCode: rematch.roomCode });
      const joined = res.data?.room ?? { id: rematch.roomId };
      navigate(`/room/${joined.id}/lobby`, { replace: true, state: { room: res.data?.room, viewerUserId: res.data?.viewerUserId } });
    } catch {
      navigate(`/room/${rematch.roomId}/lobby`, { replace: true });
    }
  };

  // PCV-16: Đấu vương — "Khán giả tinh mắt": người đoán đúng nhiều nhất (từ leaderboard cuối trận).
  const endNote = (() => {
    if (!isSuddenDeath) return null;
    const best = [...core.finalResults].sort((a, b) => (b.predictionPoints ?? 0) - (a.predictionPoints ?? 0))[0];
    return best && (best.predictionPoints ?? 0) > 0
      ? t('room.end.topPredictor', { name: best.username, n: best.predictionPoints })
      : null;
  })();

  // ── Overlays ──
  if (core.showPodium) {
    const exitTo = state?.fromGroupId ? `/groups/${state.fromGroupId}` : '/multiplayer';
    // MPC-4: keep chatting on the results screen, with the prior conversation.
    const resultsChat = roomId ? (
      <ResultsChat roomId={roomId} onSend={(text) => send(`/app/room/${roomId}/chat`, { text })} />
    ) : null;
    if (isSequential) {
      return (
        <>
          <SequentialFinalView
            roomName={`Quiz ${roomId?.slice(-4) ?? ''}`}
            results={core.finalResults}
            myUsername={myUsername}
            isHost={isHost}
            totalQuestions={core.totalQuestions}
            onClose={() => navigate(exitTo, { replace: true })}
            onCreateNew={() => navigate(exitTo, { replace: true })}
          />
          {resultsChat}
        </>
      );
    }
    return (
      <>
        <QuizEndScreen
          results={core.finalResults}
          myUsername={myUsername}
          myUserId={myUserId || undefined}
          isHost={isHost}
          totalQuestions={core.totalQuestions}
          startedAtMs={matchStartedAtRef.current}
          onReplay={startRematch}
          onClose={() => navigate(exitTo, { replace: true })}
          onShare={() => navigate(exitTo, { replace: true })}
          rematchReady={!!rematch}
          onJoinRematch={joinRematch}
          onPlayerRematch={isQuickMatchRoom ? startRematch : undefined}
          onNewRoom={() => navigate('/room/create', { replace: true })}
          onHome={() => navigate('/', { replace: true })}
          onAnalytics={() => navigate(`/room/${roomId}/analytics`)}
          metric={endMetric}
          note={endNote}
        />
        {resultsChat}
      </>
    );
  }
  if (isTeamVsTeam && team.state.teamWinner !== null) {
    return (
      <TeamWinScreen
        winner={team.state.teamWinner}
        scoreA={team.state.teamWinScoreA}
        scoreB={team.state.teamWinScoreB}
        leaderboard={core.finalResults}
        names={teamNames}
        onClose={() => navigate('/multiplayer', { replace: true })}
      />
    );
  }
  if (br.state.showEliminationScreen) {
    return (
      <EliminationScreen
        rank={br.state.myRank!}
        totalPlayers={br.state.totalCount}
        correctIndex={core.correctIndex}
        question={core.question}
        onSpectate={br.spectate}
      />
    );
  }

  return (
    <RoomQuizShell
      gameMode={gameMode}
      isBattleRoyale={isBattleRoyale}
      isTeamVsTeam={isTeamVsTeam}
      isSuddenDeath={isSuddenDeath}
      isSequential={isSequential}
      isHost={isHost}
      myUserId={myUserId}
      myUsername={myUsername}
      groupQuizSetName={state?.groupQuizSetName}
      showHostHint={showHostHint}
      hostNameFromState={hostNameFromState}
      connected={connected}
      reconnecting={reconnecting}
      core={core}
      timeLeft={timeLeft}
      isPaused={isPaused}
      skipToast={skipToast}
      hostBroadcast={hostBroadcast}
      reactions={reactions}
      feedHistory={feedHistory}
      roundAnswered={roundAnswered}
      comboBanner={null}
      onDismissCombo={() => {}}
      revealStats={revealStats}
      br={br.state}
      team={team.state}
      sd={sd.state}
      seq={seq.state}
      onDismissSdResult={sd.dismissMatchResult}
      onSubmitAnswer={submitAnswer}
      onAdvance={handleAdvance}
      onSendReaction={(emoji) => send(`/app/room/${roomId}/reaction`, { reaction: emoji })}
      teamNames={teamNames}
      onPredict={(pickUserId) => {
        if (!roomId || !sd.state.predictionOpen) return;
        sd.choosePrediction(pickUserId);
        send(`/app/room/${roomId}/predict`, { matchNo: sd.state.sdMatchNo, pickUserId });
      }}
    />
  );
};

export default RoomQuiz;
