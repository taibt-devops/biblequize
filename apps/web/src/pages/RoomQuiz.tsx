import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStomp } from '../hooks/useStomp';
import ReactionBar from '../components/ReactionBar';
import LiveFeed from '../components/LiveFeed';
import { AnswerButton, type AnswerState } from '../components/quiz/AnswerButton';
import {
  PodiumScreen, EliminationScreen, TeamScoreBar, TeamWinScreen,
  MatchResultOverlay, SdArenaHeader, RoundScoreboard,
  type PlayerScore,
} from './room/RoomOverlays';

type Question = { id: string; content: string; options: string[]; explanation?: string };

type EliminationToast = { id: number; username: string; rank: number };

interface RoomQuizLocationState {
  mode?: string;
  myTeam?: string;
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const;

// ────────────────────── MAIN COMPONENT ──────────────────────

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

  const myUsername = localStorage.getItem('userName') ?? '';

  // Core question state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);
  const [question, setQuestion] = useState<Question | null>(null);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Battle Royale state
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isEliminated, setIsEliminated] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [showEliminationScreen, setShowEliminationScreen] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [toasts, setToasts] = useState<EliminationToast[]>([]);
  const [showPodium, setShowPodium] = useState(false);
  const [finalResults, setFinalResults] = useState<PlayerScore[]>([]);

  // Team vs Team state
  const [myTeam, setMyTeam] = useState<string | null>(myTeamFromState);
  const [teamScoreA, setTeamScoreA] = useState(0);
  const [teamScoreB, setTeamScoreB] = useState(0);
  const [perfectA, setPerfectA] = useState(false);
  const [perfectB, setPerfectB] = useState(false);
  const [teamWinner, setTeamWinner] = useState<string | null>(null);
  const [teamWinScoreA, setTeamWinScoreA] = useState(0);
  const [teamWinScoreB, setTeamWinScoreB] = useState(0);

  // Sudden Death state
  const [sdChampionName, setSdChampionName] = useState('');
  const [sdChampionId, setSdChampionId] = useState('');
  const [sdChampionStreak, setSdChampionStreak] = useState(0);
  const [sdChallengerName, setSdChallengerName] = useState('');
  const [sdChallengerId, setSdChallengerId] = useState('');
  const [sdQueueRemaining, setSdQueueRemaining] = useState(0);
  const [sdMatchResult, setSdMatchResult] = useState<{ winnerId: string; winnerName: string; loserId: string; loserName: string } | null>(null);
  const [sdSpectating, setSdSpectating] = useState(false);
  const [sdMyUserId, setSdMyUserId] = useState('');

  // Social fun state
  const [reactions, setReactions] = useState<Array<{ senderId: string; senderName: string; reaction: string }>>([]);
  const [latestAnswer, setLatestAnswer] = useState<{ playerId: string; username: string; isCorrect: boolean; reactionTimeMs: number } | null>(null);
  const myUserId = localStorage.getItem('userId') ?? '';

  const questionStartedAt = useRef<number>(0);
  const toastCounter = useRef(0);

  const addToast = (username: string, rank: number) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, username, rank }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const { connected, reconnecting, send } = useStomp({
    roomId,
    onReconnect: () => { if (roomId) send(`/app/room/${roomId}/join`, {}); },
    onMessage: (msg) => {
      switch (msg.type) {
        case 'QUESTION_START': {
          const data = msg.data as { questionIndex: number; totalQuestions: number; question: Question; timeLimit: number };
          questionStartedAt.current = Date.now();
          setQuestionIndex(data.questionIndex);
          setTotalQuestions(data.totalQuestions);
          setQuestion(data.question);
          setTimeLimit(data.timeLimit);
          setTimeLeft(data.timeLimit);
          setSelected(null);
          setCorrectIndex(null);
          setSubmitting(false);
          setPerfectA(false);
          setPerfectB(false);
          break;
        }
        case 'ROUND_END': {
          const d = msg.data as { correctIndex: number; leaderboard: PlayerScore[] };
          setCorrectIndex(d.correctIndex);
          setScores(d.leaderboard.sort((a, b) => b.score - a.score));
          break;
        }
        case 'SCORE_UPDATE': {
          setScores(prev => {
            const upd = [...prev];
            const d = msg.data as PlayerScore;
            const i = upd.findIndex(x => x.playerId === d.playerId);
            if (i >= 0) upd[i] = { ...upd[i], ...d }; else upd.push(d);
            return upd.sort((a, b) => b.score - a.score);
          });
          break;
        }
        case 'LEADERBOARD_UPDATE': {
          setScores((msg.data as PlayerScore[]).sort((a, b) => b.score - a.score));
          break;
        }

        // ── Battle Royale ──
        case 'PLAYER_ELIMINATED': {
          const d = msg.data as { userId: string; username: string; rank: number; activeRemaining: number };
          addToast(d.username, d.rank);
          setActiveCount(d.activeRemaining);
          if (d.username === myUsername) {
            setIsEliminated(true);
            setMyRank(d.rank);
            setShowEliminationScreen(true);
          }
          break;
        }
        case 'BATTLE_ROYALE_UPDATE': {
          const d = msg.data as { activeCount: number; totalCount: number };
          setActiveCount(d.activeCount);
          setTotalCount(d.totalCount);
          break;
        }

        // ── Team vs Team ──
        case 'TEAM_ASSIGNMENT': {
          const d = msg.data as { players: { userId: string; username: string; team: string }[] };
          const me = d.players.find(p => p.username === myUsername);
          if (me) setMyTeam(me.team);
          break;
        }
        case 'TEAM_SCORE_UPDATE': {
          const d = msg.data as { scoreA: number; scoreB: number };
          setTeamScoreA(d.scoreA);
          setTeamScoreB(d.scoreB);
          break;
        }
        case 'PERFECT_ROUND': {
          const d = msg.data as { teamAPerfect: boolean; teamBPerfect: boolean };
          setPerfectA(d.teamAPerfect);
          setPerfectB(d.teamBPerfect);
          break;
        }

        // ── Sudden Death ──
        case 'MATCH_START': {
          const d = msg.data as { championId: string; championName: string; championStreak: number; challengerId: string; challengerName: string; queueRemaining: number };
          setSdChampionId(d.championId);
          setSdChampionName(d.championName);
          setSdChampionStreak(d.championStreak);
          setSdChallengerId(d.challengerId);
          setSdChallengerName(d.challengerName);
          setSdQueueRemaining(d.queueRemaining);
          setSdMatchResult(null);
          const inMatch = d.championName === myUsername || d.challengerName === myUsername;
          setSdSpectating(!inMatch);
          break;
        }
        case 'MATCH_END': {
          const d = msg.data as { winnerId: string; winnerName: string; winnerNewStreak: number; loserId: string; loserName: string };
          setSdMatchResult({ winnerId: d.winnerId, winnerName: d.winnerName, loserId: d.loserId, loserName: d.loserName });
          if (d.winnerName === sdChampionName || d.winnerName === sdChallengerName) {
            setSdChampionStreak(d.winnerNewStreak);
          }
          break;
        }

        // ── Social Fun ──
        case 'REACTION': {
          const d = msg.data as { senderId: string; senderName: string; reaction: string };
          setReactions(prev => [...prev, d]);
          break;
        }
        case 'ANSWER_SUBMITTED': {
          const d = msg.data as { playerId: string; username: string; isCorrect: boolean; reactionTimeMs: number };
          setLatestAnswer(d);
          break;
        }

        case 'QUIZ_END': {
          const d = msg.data as any;
          if (isBattleRoyale) {
            const results = d.finalResults as PlayerScore[] | undefined;
            if (results && results.length > 0) {
              setFinalResults(results);
              setShowPodium(true);
            } else {
              navigate(`/multiplayer`, { replace: true });
            }
          } else if (isTeamVsTeam) {
            const results = Array.isArray(d.leaderboard) ? d.leaderboard : (Array.isArray(d.finalResults) ? d.finalResults : []);
            setFinalResults(results);
            setTeamWinner(d.teamWinner ?? null);
            setTeamWinScoreA(d.scoreA ?? 0);
            setTeamWinScoreB(d.scoreB ?? 0);
          } else if (isSuddenDeath) {
            const results = Array.isArray(d) ? d : (Array.isArray(d.finalResults) ? d.finalResults : []);
            setFinalResults(results);
            setShowPodium(true);
          } else {
            // Speed Race: show podium if results available
            const results = Array.isArray(d.finalResults) ? d.finalResults : (Array.isArray(d) ? d : []);
            if (results.length > 0) {
              setFinalResults(results);
              setShowPodium(true);
            } else {
              navigate(`/multiplayer`, { replace: true });
            }
          }
          break;
        }
      }
    },
  });

  useEffect(() => {
    if (!timeLeft) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const inSdMatch = isSuddenDeath && (sdChampionName === myUsername || sdChallengerName === myUsername);
  const canAnswer = useMemo(
    () => connected && question && timeLeft > 0 && selected === null && !submitting
      && !isEliminated && !(isSuddenDeath && sdSpectating),
    [connected, question, timeLeft, selected, submitting, isEliminated, isSuddenDeath, sdSpectating]
  );

  const submitAnswer = (idx: number) => {
    if (!roomId || !question || !canAnswer) return;
    const reactionTimeMs = Date.now() - questionStartedAt.current;
    setSelected(idx);
    setSubmitting(true);
    send(`/app/room/${roomId}/answer`, { questionIndex, answerIndex: idx, reactionTimeMs });
    setTimeout(() => setSubmitting(false), 500);
  };

  const timerPercent = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0;

  // Map RoomQuiz state → AnswerButton state (per-position color via component).
  // Preserves the prior visual semantics (correct=green, wrong=red, selected
  // pre-reveal, faded for cannot-interact) but adds the 4-position colour
  // mapping (Coral/Sky/Gold/Sage) shared with single-player Quiz.
  const buildAnswerState = (i: number): AnswerState => {
    if (correctIndex !== null) {
      if (i === correctIndex) return 'correct';
      if (i === selected) return 'wrong';
      return 'disabled';
    }
    if (selected === i) return 'selected';
    if ((isEliminated && !isSpectator) || (isSuddenDeath && sdSpectating)) return 'disabled';
    return 'default';
  };

  // ── Overlays ──
  if (showPodium) {
    return <PodiumScreen results={finalResults} onClose={() => navigate('/multiplayer', { replace: true })} />;
  }
  if (isTeamVsTeam && teamWinner !== null) {
    return (
      <TeamWinScreen
        winner={teamWinner}
        scoreA={teamWinScoreA}
        scoreB={teamWinScoreB}
        leaderboard={finalResults}
        onClose={() => navigate('/multiplayer', { replace: true })}
      />
    );
  }
  if (showEliminationScreen) {
    return (
      <EliminationScreen
        rank={myRank!}
        totalPlayers={totalCount}
        correctIndex={correctIndex}
        question={question}
        onSpectate={() => { setShowEliminationScreen(false); setIsSpectator(true); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#9b59b6]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[120px] rounded-full" />
      </div>

      {/* Social Fun: Live Feed + Reactions */}
      <LiveFeed incoming={latestAnswer} myId={myUserId} />
      <ReactionBar
        onSend={(emoji) => send(`/app/room/${roomId}/reaction`, { reaction: emoji })}
        incoming={reactions.length > 0 ? reactions : null}
      />

      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="fixed top-0 inset-x-0 z-50 px-4 py-2.5 bg-secondary-container/90 border-b border-secondary/30 text-on-surface text-sm text-center animate-pulse flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-sm animate-spin">sync</span>
          {t('room.reconnecting')}
        </div>
      )}

      {/* Elimination toasts (Battle Royale) */}
      {isBattleRoyale && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 space-y-2 w-72">
          {toasts.map(toast => (
            <div key={toast.id} className="glass-card border border-error/20 text-error text-sm px-4 py-2.5 rounded-xl shadow-lg animate-pulse text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm" style={FILL_STYLE}>person_remove</span>
              <b>{toast.username}</b> {t('room.quiz.eliminatedSuffix', { rank: toast.rank })}
            </div>
          ))}
        </div>
      )}

      {/* Match result overlay (Sudden Death) */}
      {isSuddenDeath && sdMatchResult && (
        <MatchResultOverlay
          winnerId={sdMatchResult.winnerId}
          winnerName={sdMatchResult.winnerName}
          loserId={sdMatchResult.loserId}
          loserName={sdMatchResult.loserName}
          myUserId={sdMyUserId}
          onDismiss={() => setSdMatchResult(null)}
        />
      )}

      {/* ═══════════ HEADER BAR ═══════════ */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-low/90 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-6 h-14">
          {/* Left: Room info */}
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.4)]' : 'bg-error shadow-[0_0_6px_rgba(255,180,171,0.4)]'}`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b59b6]">
                {gameMode.replace(/_/g, ' ')}
              </span>
              <span className="font-headline font-bold text-sm tracking-tight text-on-surface">
                {t('room.quiz.roomHeader', { code: roomId?.slice(-4) ?? '' })}
              </span>
            </div>
          </div>

          {/* Center: Round counter + mini scores */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/10">
              <span className="material-symbols-outlined text-secondary text-sm" style={FILL_STYLE}>quiz</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                {t('room.quiz.questionProgress', { current: questionIndex + 1, total: totalQuestions || '?' })}
              </span>
            </div>

            {/* Mini player scores */}
            <div className="flex items-center gap-1">
              {scores.slice(0, 4).map((s, idx) => (
                <div
                  key={s.playerId}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    s.username === myUsername
                      ? 'border-secondary/30 bg-secondary/10 text-secondary'
                      : idx === 0
                      ? 'border-secondary/20 bg-surface-container text-on-surface'
                      : 'border-outline-variant/5 bg-surface-container text-on-surface-variant'
                  }`}
                  title={s.username}
                >
                  {s.username.slice(0, 3)}: {s.score}
                </div>
              ))}
              {scores.length > 4 && (
                <span className="text-on-surface-variant text-[10px] font-bold ml-1">+{scores.length - 4}</span>
              )}
            </div>
          </div>

          {/* Right: Timer + status badges */}
          <div className="flex items-center gap-3">
            {isBattleRoyale && activeCount > 0 && (
              <div className="flex items-center gap-1.5 bg-error/10 px-2.5 py-1 rounded-full border border-error/20">
                <span className="material-symbols-outlined text-error text-sm" style={FILL_STYLE}>group</span>
                <span className="text-error text-[10px] font-black">{activeCount}/{totalCount}</span>
              </div>
            )}
            {isSpectator && (
              <div className="flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-full border border-outline-variant/10">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">visibility</span>
                <span className="text-on-surface-variant text-[10px] font-bold">{t('room.quiz.spectator')}</span>
              </div>
            )}
            {isSuddenDeath && sdSpectating && (
              <div className="flex items-center gap-1 bg-[#ff8c42]/10 px-2.5 py-1 rounded-full border border-[#ff8c42]/20">
                <span className="material-symbols-outlined text-[#ff8c42] text-sm">visibility</span>
                <span className="text-[#ff8c42] text-[10px] font-bold">{t('room.quiz.sdSpectating')}</span>
              </div>
            )}
            {isTeamVsTeam && myTeam && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                myTeam === 'A'
                  ? 'bg-[#4a9eff]/10 border-[#4a9eff]/20'
                  : 'bg-error/10 border-error/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${myTeam === 'A' ? 'bg-[#4a9eff]' : 'bg-error'}`} />
                <span className={`text-[10px] font-black ${myTeam === 'A' ? 'text-[#4a9eff]' : 'text-error'}`}>
                  Team {myTeam}
                </span>
              </div>
            )}

            {/* Timer circle */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="timer-svg w-full h-full" viewBox="0 0 36 36">
                <circle
                  className="stroke-surface-container-highest"
                  cx="18" cy="18" r="15"
                  fill="none" strokeWidth="2.5"
                />
                <circle
                  className={`timer-arc ${timeLeft <= 5 ? 'stroke-error' : 'stroke-secondary'}`}
                  cx="18" cy="18" r="15"
                  fill="none" strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="94.25"
                  strokeDashoffset={94.25 - (timerPercent / 100) * 94.25}
                />
              </svg>
              <span className={`absolute font-headline font-black text-sm ${timeLeft <= 5 ? 'text-error animate-pulse' : 'text-secondary'}`}>
                {timeLeft}
              </span>
            </div>
          </div>
        </div>

        {/* Timer progress bar (mobile) */}
        <div className="h-1 bg-surface-container-highest md:hidden">
          <div
            className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-error' : 'bg-gradient-to-r from-secondary to-tertiary'}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="relative min-h-screen pt-20 pb-8 px-4 md:px-6 max-w-6xl mx-auto">
        {/* Mode-specific headers */}
        {isTeamVsTeam && (
          <TeamScoreBar scoreA={teamScoreA} scoreB={teamScoreB} perfectA={perfectA} perfectB={perfectB} />
        )}
        {isSuddenDeath && sdChampionName && (
          <SdArenaHeader
            championName={sdChampionName}
            championStreak={sdChampionStreak}
            challengerName={sdChallengerName}
            myUsername={myUsername}
            queueRemaining={sdQueueRemaining}
          />
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          {/* ── Question + Answers area ── */}
          <div className="space-y-6">
            {/* Mobile round counter */}
            <div className="flex items-center justify-between md:hidden">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-sm" style={FILL_STYLE}>quiz</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                  {t('room.quiz.questionProgress', { current: questionIndex + 1, total: totalQuestions || '?' })}
                </span>
              </div>
              {scores.length > 0 && (
                <div className="text-[10px] font-bold text-on-surface-variant">
                  {t('room.quiz.points', { count: scores.find(s => s.username === myUsername)?.score ?? 0 })}
                </div>
              )}
            </div>

            {/* Question Card */}
            <div className="relative w-full flex flex-col items-center justify-center text-center p-8 md:p-10 bg-surface-container-low rounded-[2rem] border border-outline-variant/10 shadow-2xl overflow-hidden min-h-[140px]">
              {/* Gold left accent bar */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-24 bg-secondary rounded-r-full" />

              <h2 className="font-headline text-xl md:text-3xl font-extrabold tracking-tight leading-snug max-w-3xl text-on-surface">
                {question?.content || t('room.quiz.waitingQuestion')}
              </h2>
            </div>

            {/* Answer Grid — 2x2. AnswerButton handles per-position colour
                (A=Coral, B=Sky, C=Gold, D=Sage) + state visuals + icons. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(question?.options ?? []).map((opt, i) => (
                <AnswerButton
                  key={i}
                  index={i as 0 | 1 | 2 | 3}
                  letter={ANSWER_LETTERS[i] as 'A' | 'B' | 'C' | 'D'}
                  text={opt}
                  state={buildAnswerState(i)}
                  onClick={() => submitAnswer(i)}
                  testId={`room-quiz-answer-${i}`}
                />
              ))}
            </div>

            {/* Feedback */}
            {selected !== null && correctIndex === null && !isSpectator && !(isSuddenDeath && sdSpectating) && (
              <div className="text-center text-on-surface-variant text-sm animate-pulse flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm animate-spin">hourglass_empty</span>
                {t('room.quiz.waitingResult')}
              </div>
            )}
            {/* Result Popup Overlay (Stitch design) */}
            {correctIndex !== null && !isSpectator && !(isSuddenDeath && sdSpectating) && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-surface-container-lowest/80 backdrop-blur-md">
                <div className="w-full max-w-md bg-surface-container-high rounded-2xl overflow-hidden shadow-2xl border border-secondary/20" style={{ boxShadow: '0 0 20px rgba(248, 189, 69, 0.15)' }}>
                  {/* Header */}
                  <div className={`p-6 text-center ${
                    selected === correctIndex
                      ? 'bg-gradient-to-r from-secondary to-tertiary'
                      : selected !== null
                        ? 'bg-gradient-to-r from-error to-error/80'
                        : 'bg-surface-container-highest'
                  }`}>
                    <span className="material-symbols-outlined text-5xl mb-2" style={{
                      ...FILL_STYLE,
                      color: selected === correctIndex ? '#412d00' : selected !== null ? '#690005' : '#c7c5ce'
                    }}>
                      {selected === correctIndex ? 'workspace_premium' : selected !== null ? 'cancel' : 'timer_off'}
                    </span>
                    <h4 className={`text-2xl font-bold ${
                      selected === correctIndex ? 'text-on-secondary' : selected !== null ? 'text-on-error' : 'text-on-surface-variant'
                    }`}>
                      {selected === correctIndex
                        ? t('room.quiz.correctFeedback')
                        : selected !== null
                          ? t('room.quiz.wrongFeedback')
                          : t('room.quiz.timeoutFeedback')}
                    </h4>
                    <p className={`font-medium ${
                      selected === correctIndex ? 'text-on-secondary/80' : 'text-on-surface-variant'
                    }`}>
                      {selected === correctIndex
                        ? t('room.quiz.bonusPoints')
                        : t('room.quiz.correctAnswerLine', {
                            letter: String.fromCharCode(65 + correctIndex),
                            text: question?.options[correctIndex] ?? ''
                          })}
                    </p>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Explanation */}
                    {question?.explanation && (
                      <div className="p-4 bg-surface-container rounded-lg border-l-4 border-secondary">
                        <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">{t('room.quiz.explanationLabel')}</p>
                        <p className="text-sm text-on-surface italic">{question.explanation}</p>
                      </div>
                    )}
                    {/* Rank */}
                    {scores.length > 0 && (
                      <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-secondary">
                            <span className="material-symbols-outlined">trending_up</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{t('room.quiz.rankLabel')}</p>
                            <p className="text-xs text-on-surface-variant">{t('room.quiz.rankSubtitle')}</p>
                          </div>
                        </div>
                        <span className="text-2xl font-black text-secondary">
                          #{(scores.findIndex(s => s.username === myUsername) + 1) || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Spectator feedback */}
            {correctIndex !== null && (isSpectator || (isSuddenDeath && sdSpectating)) && (
              <div className="text-center text-sm">
                <span className="text-[#4a9eff] flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  {t('room.quiz.spectatorNote')}
                </span>
              </div>
            )}

            {/* Perfect round banner */}
            {isTeamVsTeam && (perfectA || perfectB) && (
              <div className={`p-4 rounded-2xl border text-center font-bold text-sm animate-pulse ${
                (perfectA && myTeam === 'A') || (perfectB && myTeam === 'B')
                  ? 'border-secondary/30 bg-secondary/5 text-secondary'
                  : 'border-[#9b59b6]/30 bg-[#9b59b6]/5 text-[#9b59b6]'
              }`}>
                <span className="material-symbols-outlined text-sm mr-1" style={FILL_STYLE}>stars</span>
                Perfect Round! {perfectA ? 'Team A' : ''}{perfectA && perfectB ? ' & ' : ''}{perfectB ? 'Team B' : ''} +50 diem!
              </div>
            )}

            {/* Scoreboard overlay after round */}
            {correctIndex !== null && (
              <RoundScoreboard scores={scores} myUsername={myUsername} />
            )}
          </div>

          {/* ── Leaderboard / Side Panel ── */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 p-4 self-start lg:sticky lg:top-20">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9b59b6] text-sm" style={FILL_STYLE}>
                {isBattleRoyale ? 'swords' :
                 isTeamVsTeam ? 'groups' :
                 isSuddenDeath ? 'local_fire_department' :
                 'leaderboard'}
              </span>
              {isBattleRoyale ? t('room.quiz.leaderboardBattleRoyale') :
               isTeamVsTeam ? t('room.quiz.leaderboardTeam') :
               isSuddenDeath ? t('room.quiz.leaderboardSuddenDeath') :
               t('room.quiz.leaderboardDefault')}
            </div>
            <div className="space-y-1.5 max-h-[55vh] overflow-auto pr-1">
              {scores.length === 0 ? (
                <p className="text-on-surface-variant/50 text-xs text-center py-6">{t('room.quiz.noScoresYet')}</p>
              ) : (
                scores.map((s, idx) => {
                  const isMe = s.username === myUsername;
                  const eliminated = s.playerStatus === 'ELIMINATED';
                  return (
                    <div
                      key={s.playerId}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        isMe ? 'border-secondary/30 bg-secondary/5' :
                        eliminated ? 'border-transparent bg-surface-container-low opacity-40' :
                        idx === 0 ? 'border-secondary/15 bg-surface-container-low' :
                        'border-outline-variant/5 bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          eliminated ? 'bg-surface-container-highest text-on-surface-variant' :
                          idx === 0 ? 'bg-secondary/15 text-secondary border border-secondary/20' :
                          'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {eliminated ? (
                            <span className="material-symbols-outlined text-xs" style={FILL_STYLE}>skull</span>
                          ) : isSuddenDeath ? (
                            <span className="material-symbols-outlined text-xs text-[#ff8c42]" style={FILL_STYLE}>local_fire_department</span>
                          ) : idx + 1}
                        </div>
                        <div className={`text-sm font-medium truncate max-w-[80px] ${
                          isMe ? 'text-secondary' : eliminated ? 'text-on-surface-variant' : 'text-on-surface'
                        }`}>
                          {s.username}{isMe ? t('room.quiz.youSuffix') : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black ${eliminated ? 'text-on-surface-variant' : 'text-on-surface'}`}>{s.score}</div>
                        <div className="text-on-surface-variant/50 text-[10px] font-bold">{s.correctAnswers}/{s.totalAnswered}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RoomQuiz;
