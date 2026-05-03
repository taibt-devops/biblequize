import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStomp } from '../hooks/useStomp';
import { api } from '../api/client';

type Player = {
  id: string; userId: string; username: string; avatarUrl?: string;
  isReady: boolean; score: number; team?: string; playerStatus?: string;
};
type RoomDetails = {
  id: string; roomCode: string; roomName: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';
  mode: string; isPublic: boolean;
  maxPlayers: number; currentPlayers: number;
  questionCount: number; timePerQuestion: number;
  hostId: string; hostName: string; players: Player[];
  questionSource?: 'DATABASE' | 'CUSTOM';
};

type UserQuestionDTO = {
  id: string; content: string; options: string[];
  correctAnswer: number; difficulty: string; source: string;
  book: string; chapter: number; explanation: string; theme: string;
};
type ChatMessage = {
  sender: string;
  text: string;
  isHost?: boolean;
};

const MODE_LABELS: Record<string, string> = {
  SPEED_RACE: 'Speed Race',
  BATTLE_ROYALE: 'Battle Royale',
  TEAM_VS_TEAM: 'Team vs Team',
  SUDDEN_DEATH: 'Sudden Death',
};

const QUICK_EMOJIS = ['🙏', '🔥', '🙌', '💡', '✨'];

const myUsername = () => localStorage.getItem('userName') ?? '';

const RoomLobby: React.FC = () => {
  const { t } = useTranslation();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRoom: RoomDetails | undefined = location.state?.room;
  const [room, setRoom] = useState<RoomDetails | null>(initialRoom ?? null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [switchingTeam, setSwitchingTeam] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { connected, reconnecting, send } = useStomp({
    roomId,
    onReconnect: () => { fetchRoom(); },
    onMessage: (msg) => {
      switch (msg.type) {
        case 'PLAYER_JOINED':
        case 'PLAYER_LEFT':
        case 'PLAYER_READY':
        case 'PLAYER_UNREADY':
          fetchRoom();
          break;
        case 'CHAT_MESSAGE': {
          const d = msg.data as { sender: string; text: string };
          setChatMessages(prev => [...prev, { sender: d.sender, text: d.text, isHost: d.sender === room?.hostName }]);
          break;
        }
        case 'GAME_STARTING': {
          const d = msg.data as { countdown: number };
          setCountdown(d.countdown);
          const myTeam = room?.players?.find(p => p.username === myUsername())?.team ?? null;
          setTimeout(() => navigate(`/room/${roomId}/quiz`, {
            replace: true,
            state: { mode: room?.mode, myTeam }
          }), d.countdown * 1000);
          break;
        }
        case 'ROOM_STARTING':
        case 'QUESTION_START':
          navigate(`/room/${roomId}/quiz`, {
            replace: true,
            state: { mode: room?.mode, myTeam: room?.players?.find(p => p.username === myUsername())?.team ?? null }
          });
          break;
        case 'QUIZ_END':
          fetchRoom();
          break;
      }
    },
  });

  const fetchRoom = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const data = await res.json();
      if (data.success) setRoom(data.room);
      else setError(data.message || t('room.errorFetchRoom'));
    } catch {
      setError(t('room.errorNetwork'));
    }
  };

  useEffect(() => {
    if (!room) fetchRoom();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleToggleReady = () => {
    if (!roomId) return;
    send(`/app/room/${roomId}/ready`, {});
  };

  const handleStart = async () => {
    if (!roomId) return;
    try {
      await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      send(`/app/room/${roomId}/start`, {});
    } catch {
      setError(t('room.errorStartRoom'));
    }
  };

  const handleSwitchTeam = async () => {
    if (!roomId) return;
    setSwitchingTeam(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/switch-team`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const data = await res.json();
      if (data.success) setRoom(data.room);
    } catch {
      setError(t('room.errorSwitchTeam'));
    } finally {
      setSwitchingTeam(false);
    }
  };

  const handleCopyCode = () => {
    if (room?.roomCode) {
      navigator.clipboard.writeText(room.roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleSendChat = (text: string) => {
    if (!text.trim() || !roomId) return;
    send(`/app/room/${roomId}/chat`, { text: text.trim() });
    setChatInput('');
  };

  const handleLeave = async () => {
    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        });
      } catch { /* ignore */ }
    }
    navigate('/multiplayer');
  };

  const readyCount = useMemo(() => room?.players?.filter((p) => p.isReady).length ?? 0, [room]);
  const isTeamVsTeam = room?.mode === 'TEAM_VS_TEAM';
  const isSuddenDeath = room?.mode === 'SUDDEN_DEATH';
  const teamAPlayers = room?.players?.filter(p => p.team === 'A') ?? [];
  const teamBPlayers = room?.players?.filter(p => p.team === 'B') ?? [];
  const myPlayer = room?.players?.find(p => p.username === myUsername());
  const isHost = myPlayer?.userId === room?.hostId;
  const canStart = room?.status === 'LOBBY' && readyCount >= 2;
  const emptySlots = room ? Math.max(0, room.maxPlayers - room.currentPlayers) : 0;

  /* ---------- Countdown overlay ---------- */
  if (countdown !== null) {
    return (
      <div className="min-h-screen bg-surface-dim flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl font-bold text-secondary animate-bounce-in">{countdown}</div>
          <p className="text-xl text-on-surface-variant mt-4">{t('room.gameStarting')}</p>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error) return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="text-error text-lg">{error}</p>
        <button onClick={() => navigate('/multiplayer')} className="text-secondary underline text-sm">
          {t('common.back')}
        </button>
      </div>
    </div>
  );

  /* ---------- Loading state ---------- */
  if (!room) return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center">
      <p className="text-on-surface-variant animate-pulse text-lg">{t('room.loadingRoom')}</p>
    </div>
  );

  return (
    <div className="bg-surface-dim text-on-surface min-h-screen selection:bg-secondary/30">
      {/* ── Reconnecting banner ── */}
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-error-container/90 text-on-error-container text-center py-2 text-sm font-medium">
          <span className="material-symbols-outlined text-sm align-middle mr-1">wifi_off</span>
          {t('room.reconnecting')}
        </div>
      )}

      {/* ── Top Navigation Bar ── */}
      <header className="bg-surface-container sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-[900px] mx-auto">
          <h1 className="text-xl font-bold tracking-tighter text-secondary uppercase">
            {t('room.lobbyTitle')}
          </h1>
          <div className="flex items-center gap-3">
            {/* Connection status dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
              />
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant/60 font-bold">
                {connected ? t('room.online') : t('room.offline')}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="hover:bg-surface-container-high transition-colors p-2 rounded-lg active:scale-95 active:duration-150"
              title={t('room.shareRoomCode')}
            >
              <span className="material-symbols-outlined text-on-surface">share</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-[900px] mx-auto px-6 pt-8 pb-32">
        {/* ── Room Header Section ── */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-10">
          {/* Room Code + QR */}
          <div className="flex items-center gap-4">
            <div className="border-2 border-secondary/40 bg-surface-container-low px-6 py-3 rounded-xl flex items-center gap-4" data-testid="lobby-room-code">
              <span className="text-3xl font-mono font-bold tracking-widest text-secondary">
                {room.roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="text-on-surface-variant hover:text-secondary transition-colors"
                title={t('room.copyRoomCode')}
              >
                <span className="material-symbols-outlined">
                  {codeCopied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>

          {/* Game Settings Pill */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant/10">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="material-symbols-outlined text-xs text-secondary">list_alt</span>
                <span>{t('room.questionsCount', { count: room.questionCount })}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-outline-variant/30" />
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="material-symbols-outlined text-xs text-secondary">timer</span>
                <span>{t('room.timePerQuestion', { count: room.timePerQuestion })}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-outline-variant/30" />
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="material-symbols-outlined text-xs text-secondary">trending_up</span>
                <span>{MODE_LABELS[room.mode] ?? room.mode}</span>
              </div>
            </div>
            {/* Visibility badge */}
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 pr-2">
              {room.isPublic ? `🌐 ${t('room.public')}` : `🔒 ${t('room.private')}`}
            </span>
          </div>
        </div>

        {/* ── Host Question Panel (CUSTOM source only) ── */}
        {isHost && room.questionSource === 'CUSTOM' && (
          <div className="mb-8">
            <HostQuestionPanel roomId={room.id} />
          </div>
        )}

        {/* ── Main Layout: Players Grid + Chat ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-8">

          {/* ── Players Grid (Left Side) ── */}
          <section data-testid="lobby-player-grid">
            {/* Team vs Team layout */}
            {isTeamVsTeam ? (
              <div className="space-y-6">
                {/* Team A */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-2">
                    🔵 {t('room.teamA')} {myPlayer?.team === 'A' && <span className="text-on-surface-variant text-[10px]">({t('room.you')})</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {teamAPlayers.map(p => (
                      <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />
                    ))}
                    {teamAPlayers.length === 0 && (
                      <EmptySlot t={t} />
                    )}
                  </div>
                </div>
                {/* Team B */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
                    🔴 {t('room.teamB')} {myPlayer?.team === 'B' && <span className="text-on-surface-variant text-[10px]">({t('room.you')})</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {teamBPlayers.map(p => (
                      <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />
                    ))}
                    {teamBPlayers.length === 0 && (
                      <EmptySlot t={t} />
                    )}
                  </div>
                </div>
                {myPlayer && (
                  <button
                    onClick={handleSwitchTeam}
                    disabled={switchingTeam}
                    className="text-xs text-secondary border border-secondary/30 px-4 py-2 rounded-lg hover:bg-secondary/10 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm align-middle mr-1">swap_horiz</span>
                    {t('room.switchTeam')}
                  </button>
                )}
              </div>
            ) : isSuddenDeath ? (
              /* Sudden Death layout */
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                  👑 {t('room.battleOrder')}
                </div>
                <div className="space-y-3">
                  {(room.players ?? []).map((p, idx) => (
                    <div
                      key={p.id}
                      className={`bg-surface-container p-4 rounded-xl flex items-center gap-4 border transition-all ${
                        idx === 0 ? 'border-secondary/30' : 'border-outline-variant/5'
                      } hover:bg-surface-container-high`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-secondary text-on-secondary' : idx === 1 ? 'bg-surface-container-highest text-on-surface' : 'bg-surface-container-low text-on-surface-variant'
                      }`}>
                        {idx === 0 ? '👑' : idx === 1 ? '⚔️' : `#${idx + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface truncate">
                          {p.username}{p.username === myUsername() ? ` (${t('room.you')})` : ''}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {idx === 0 ? t('room.hotSeat') : idx === 1 ? t('room.challenger') : t('room.waiting')}
                        </span>
                      </div>
                      {p.userId === room.hostId && (
                        <span className="text-[10px] font-bold text-secondary uppercase">Host</span>
                      )}
                      <span
                        className={`material-symbols-outlined text-2xl ${p.isReady ? 'text-emerald-400' : 'text-on-surface-variant/20'}`}
                        style={p.isReady ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {p.isReady ? 'check_circle' : 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Default grid layout */
              <div className="grid grid-cols-2 gap-4">
                {(room.players ?? []).map((p) => (
                  <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />
                ))}
                {/* Empty slots */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <EmptySlot key={`empty-${i}`} t={t} />
                ))}
              </div>
            )}
          </section>

          {/* ── Chat Panel (Right Side) ── */}
          <aside className="flex flex-col h-[520px] bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/5">
            {/* Chat Header */}
            <div className="p-4 border-b border-outline-variant/10 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-sm">forum</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">{t('room.chat')}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {chatMessages.length === 0 && (
                <p className="text-on-surface-variant/40 text-xs text-center italic mt-8">
                  {t('room.noChatMessages')}
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className="space-y-1">
                  <p className={`text-[10px] font-bold uppercase ${msg.isHost ? 'text-secondary' : 'text-on-primary-container'}`}>
                    {msg.sender}
                  </p>
                  <div className={`${msg.isHost ? 'bg-surface-container-high' : 'bg-surface-container-highest'} px-3 py-2 rounded-xl rounded-tl-none inline-block`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Footer Chat */}
            <div className="p-3 bg-surface-container-low border-t border-outline-variant/10">
              {/* Quick emoji row */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleSendChat(emoji)}
                    className="bg-surface-container-highest w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-110 transition-transform flex-shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {/* Text input */}
              <div className="relative">
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl py-2.5 pl-4 pr-10 text-sm focus:ring-1 focus:ring-secondary/50 placeholder:text-on-surface-variant/40 text-on-surface outline-none"
                  placeholder={t('room.chatPlaceholder')}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat(chatInput);
                  }}
                />
                <button
                  onClick={() => handleSendChat(chatInput)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary p-1"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ── Bottom Action Bar ── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-center items-center px-4 pb-8 pt-6 z-50">
        <div className="bg-surface-container/60 backdrop-blur-xl w-full max-w-[900px] flex justify-between items-center px-8 py-4 rounded-2xl shadow-[0_-4px_24px_rgba(11,14,24,0.6)] border border-outline-variant/5">
          {/* Left: Leave Button */}
          <button
            data-testid="lobby-leave-btn"
            onClick={handleLeave}
            className="flex items-center gap-2 text-on-surface/80 hover:bg-error-container/20 hover:text-error transition-all px-6 py-3 rounded-xl border border-outline-variant/15 font-medium uppercase tracking-widest text-[11px] active:scale-[0.98] active:duration-100"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            {t('room.leaveRoom')}
          </button>

          {/* Center: Player Counter */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60 mb-1">
              {connected ? t('room.connected') : t('room.disconnected')}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xl font-bold text-on-surface">
                {room.currentPlayers} / {room.maxPlayers}
              </span>
            </div>
          </div>

          {/* Right: Ready / Start buttons */}
          <div className="flex items-center gap-3">
            {/* Ready toggle */}
            <button
              data-testid="lobby-ready-btn"
              onClick={handleToggleReady}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all active:scale-[0.98] active:duration-100 ${
                myPlayer?.isReady
                  ? 'bg-surface-container-highest text-on-surface border border-outline-variant/20'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {myPlayer?.isReady ? 'close' : 'check_circle'}
              </span>
              {myPlayer?.isReady ? t('room.unready') : t('room.ready')}
            </button>

            {/* Start button (host only) */}
            {isHost && (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="gold-gradient flex items-center gap-2 text-surface-dim px-10 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:opacity-90 transition-opacity active:scale-[0.98] active:duration-100 shadow-lg shadow-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                {t('room.startGame')}
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};

/* ── Player Card Component ── */
const PlayerCard: React.FC<{ player: Player; hostId: string; t: (key: string) => string }> = ({ player, hostId, t }) => {
  const isHost = player.userId === hostId;
  const isMe = player.username === myUsername();

  return (
    <div className={`bg-surface-container p-4 rounded-xl flex items-center gap-4 border transition-all hover:bg-surface-container-high ${
      isHost ? 'border-secondary/20' : 'border-outline-variant/5'
    }`}>
      {/* Avatar */}
      <div className="relative">
        {player.avatarUrl ? (
          <img
            className={`w-14 h-14 rounded-full object-cover ${isHost ? 'border-2 border-secondary' : ''} ${!player.isReady ? 'opacity-60 grayscale' : ''}`}
            src={player.avatarUrl}
            alt={player.username}
          />
        ) : (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
            isHost ? 'border-2 border-secondary bg-surface-container-high text-secondary' : 'bg-surface-container-highest text-on-surface'
          } ${!player.isReady ? 'opacity-60 grayscale' : ''}`}>
            {player.username?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
        {/* Host crown badge */}
        {isHost && (
          <div className="absolute -top-2 -left-2 bg-secondary text-on-secondary w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className={`font-bold truncate ${player.isReady ? 'text-on-surface' : 'text-on-surface-variant'}`}>
            {player.username}{isMe ? ` (${t('room.you')})` : ''}
          </p>
          {isHost && (
            <span className="material-symbols-outlined text-secondary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          )}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isHost ? 'text-secondary/70' : 'text-on-surface-variant'}`}>
          {isHost ? t('room.hostLabel') : (player.isReady ? t('room.readyLabel') : t('room.waitingLabel'))}
        </span>
      </div>

      {/* Ready status icon */}
      <span
        className={`material-symbols-outlined text-2xl ${player.isReady ? 'text-emerald-400' : 'text-on-surface-variant/20'}`}
        style={player.isReady ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {player.isReady ? 'check_circle' : 'pending'}
      </span>
    </div>
  );
};

/* ── Empty Slot Component ── */
const EmptySlot: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div className="bg-surface-container-low border-2 border-dashed border-outline-variant/15 p-4 rounded-xl flex items-center justify-center gap-4 animate-pulse">
    <div className="w-14 h-14 rounded-full bg-outline-variant/10 flex items-center justify-center">
      <span className="material-symbols-outlined text-outline-variant/40">person_add</span>
    </div>
    <span className="text-sm font-medium text-outline-variant/40 italic">{t('room.waitingSlot')}</span>
  </div>
);

/* ── Question Preview Item ── */
const QuestionPreviewItem: React.FC<{
  question: UserQuestionDTO; index: number; onRemove: () => void;
}> = ({ question, index, onRemove }) => (
  <div className="flex items-start gap-3 bg-surface-container rounded-lg p-3 text-xs">
    <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex-shrink-0 flex items-center justify-center font-bold text-[10px]">
      {index}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-on-surface leading-snug line-clamp-1">{question.content}</p>
      <p className="text-on-surface-variant/50 mt-0.5 truncate">
        ✓ {question.options[question.correctAnswer]}
        {question.book ? ` · ${question.book}` : ''}
      </p>
    </div>
    <button type="button" onClick={onRemove} className="text-on-surface-variant/40 hover:text-error transition-colors flex-shrink-0 mt-0.5">
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  </div>
);

/* ── Host Question Panel ── */
const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" };

const HostQuestionPanel: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [tab, setTab] = useState<'ai' | 'manual' | 'assigned'>('ai');
  const [staging, setStaging] = useState<UserQuestionDTO[]>([]);
  const [assigned, setAssigned] = useState<UserQuestionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'ok'; msg: string } | null>(null);
  const [aiForm, setAiForm] = useState({ book: '', chapterStart: '', chapterEnd: '', theme: '', difficulty: 'MIXED', language: 'vi', count: 5 });
  const [manualForm, setManualForm] = useState({ content: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'MIXED', explanation: '', book: '', language: 'vi' });

  const flash = (type: 'error' | 'ok', msg: string) => { setNotice({ type, msg }); setTimeout(() => setNotice(null), 3500); };

  useEffect(() => {
    api.get(`/api/user-questions/room/${roomId}`)
      .then(r => { if (r.data.success) setAssigned(r.data.questions); })
      .catch(() => {});
  }, [roomId]);

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { difficulty: aiForm.difficulty, language: aiForm.language, count: aiForm.count };
      if (aiForm.book) payload.book = aiForm.book;
      if (aiForm.chapterStart) payload.chapterStart = Number(aiForm.chapterStart);
      if (aiForm.chapterEnd) payload.chapterEnd = Number(aiForm.chapterEnd);
      if (aiForm.theme) payload.theme = aiForm.theme;
      const r = await api.post('/api/user-questions/generate', payload);
      setStaging(prev => [...r.data.questions, ...prev]);
      flash('ok', `Đã tạo ${r.data.generated} câu hỏi!`);
    } catch (e: any) { flash('error', e?.response?.data?.message || 'Lỗi tạo câu hỏi'); }
    finally { setLoading(false); }
  };

  const handleCreateManual = async () => {
    setLoading(true);
    try {
      const r = await api.post('/api/user-questions', {
        content: manualForm.content, options: manualForm.options,
        correctAnswer: manualForm.correctAnswer, difficulty: manualForm.difficulty,
        explanation: manualForm.explanation || null, book: manualForm.book || null, language: manualForm.language,
      });
      setStaging(prev => [r.data.question, ...prev]);
      setManualForm({ content: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'MIXED', explanation: '', book: '', language: 'vi' });
      flash('ok', 'Đã thêm câu hỏi!');
    } catch (e: any) { flash('error', e?.response?.data?.message || 'Lỗi thêm câu hỏi'); }
    finally { setLoading(false); }
  };

  const handleAssignAll = async () => {
    if (!staging.length) return;
    setLoading(true);
    try {
      const r = await api.post('/api/user-questions/assign-to-room', { roomId, questionIds: staging.map(q => q.id) });
      setAssigned(r.data.questions);
      setStaging([]);
      flash('ok', `Đã gán ${r.data.assigned} câu hỏi!`);
      setTab('assigned');
    } catch (e: any) { flash('error', e?.response?.data?.message || 'Lỗi gán câu hỏi'); }
    finally { setLoading(false); }
  };

  const handleRemoveAssigned = async (qId: string) => {
    try {
      await api.delete(`/api/user-questions/room/${roomId}/${qId}`);
      setAssigned(prev => prev.filter(q => q.id !== qId));
    } catch (e: any) { flash('error', e?.response?.data?.message || 'Lỗi xoá câu hỏi'); }
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4 border border-secondary/20" data-testid="host-question-panel">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-lg" style={FILL_1}>quiz</span>
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Câu hỏi phòng</h3>
        <div className="ml-auto flex items-center gap-2">
          {assigned.length > 0 && <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full font-bold">{assigned.length} đã gán</span>}
          {staging.length > 0 && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">+{staging.length} chờ gán</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container-highest p-1 rounded-lg text-xs">
        {([['ai', 'smart_toy', 'AI tạo'], ['manual', 'edit_note', 'Thủ công'], ['assigned', 'checklist', 'Đã gán']] as const).map(([k, icon, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md transition-all font-medium ${tab === k ? 'bg-[#f8bd45] text-[#11131e] font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-sm">{icon}</span>{label}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${notice.type === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-error/10 border border-error/20 text-error'}`}>
          <span className="material-symbols-outlined text-sm">{notice.type === 'ok' ? 'check_circle' : 'error'}</span>
          {notice.msg}
          {notice.type === 'error' && <button onClick={() => setNotice(null)} className="ml-auto"><span className="material-symbols-outlined text-sm">close</span></button>}
        </div>
      )}

      {/* AI Tab */}
      {tab === 'ai' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Sách Kinh Thánh</label>
              <input type="text" value={aiForm.book} onChange={e => setAiForm(p => ({ ...p, book: e.target.value }))}
                placeholder="VD: Giăng, Sáng Thế Ký..." className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Chủ đề</label>
              <input type="text" value={aiForm.theme} onChange={e => setAiForm(p => ({ ...p, theme: e.target.value }))}
                placeholder="VD: tình yêu thương, cứu rỗi..." className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-secondary/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Chương từ</label>
              <input type="number" min={1} value={aiForm.chapterStart} onChange={e => setAiForm(p => ({ ...p, chapterStart: e.target.value }))}
                placeholder="1" className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Đến chương</label>
              <input type="number" min={1} value={aiForm.chapterEnd} onChange={e => setAiForm(p => ({ ...p, chapterEnd: e.target.value }))}
                placeholder="3" className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Số câu</label>
              <select value={aiForm.count} onChange={e => setAiForm(p => ({ ...p, count: Number(e.target.value) }))}
                className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50 appearance-none">
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={handleGenerateAI} disabled={loading}
            className="w-full gold-gradient h-10 rounded-xl text-[#11131e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>Đang tạo...</>
              : <><span className="material-symbols-outlined text-lg" style={FILL_1}>auto_awesome</span>Tạo với AI</>}
          </button>
          <StagingPreview staging={staging} loading={loading} onRemove={id => setStaging(prev => prev.filter(q => q.id !== id))} onAssign={handleAssignAll} />
        </div>
      )}

      {/* Manual Tab */}
      {tab === 'manual' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-on-surface-variant">Nội dung câu hỏi *</label>
            <textarea rows={2} value={manualForm.content} onChange={e => setManualForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Nhập câu hỏi..."
              className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-secondary/50 resize-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-on-surface-variant">4 đáp án (nhấn chữ cái để đánh dấu đúng)</label>
            {manualForm.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button type="button" onClick={() => setManualForm(p => ({ ...p, correctAnswer: idx }))}
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${manualForm.correctAnswer === idx ? 'bg-emerald-500 text-white' : 'bg-surface-container-highest text-on-surface-variant hover:bg-secondary/20'}`}>
                  {String.fromCharCode(65 + idx)}
                </button>
                <input type="text" value={opt}
                  onChange={e => { const o = [...manualForm.options]; o[idx] = e.target.value; setManualForm(p => ({ ...p, options: o })); }}
                  placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                  className="flex-1 bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-secondary/50" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Sách (tùy chọn)</label>
              <input type="text" value={manualForm.book} onChange={e => setManualForm(p => ({ ...p, book: e.target.value }))}
                placeholder="VD: Giăng" className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant">Độ khó</label>
              <select value={manualForm.difficulty} onChange={e => setManualForm(p => ({ ...p, difficulty: e.target.value }))}
                className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50 appearance-none">
                {[['EASY','Dễ'],['MEDIUM','Trung bình'],['HARD','Khó'],['MIXED','Hỗn hợp']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={handleCreateManual}
            disabled={loading || !manualForm.content.trim() || manualForm.options.some(o => !o.trim())}
            className="w-full h-10 rounded-xl border border-secondary/40 text-secondary font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors disabled:opacity-40">
            <span className="material-symbols-outlined text-lg">add_circle</span>Thêm câu hỏi
          </button>
          <StagingPreview staging={staging} loading={loading} onRemove={id => setStaging(prev => prev.filter(q => q.id !== id))} onAssign={handleAssignAll} />
        </div>
      )}

      {/* Assigned Tab */}
      {tab === 'assigned' && (
        <div className="space-y-2">
          {assigned.length === 0 ? (
            <p className="text-center text-on-surface-variant/40 text-xs italic py-8">
              Chưa có câu hỏi nào được gán.<br />Tạo câu hỏi ở tab AI hoặc Thủ công.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
              {assigned.map((q, idx) => (
                <QuestionPreviewItem key={q.id} question={q} index={idx + 1} onRemove={() => handleRemoveAssigned(q.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* Staging preview shared by AI + Manual tabs */
const StagingPreview: React.FC<{
  staging: UserQuestionDTO[]; loading: boolean;
  onRemove: (id: string) => void; onAssign: () => void;
}> = ({ staging, loading, onRemove, onAssign }) => {
  if (!staging.length) return null;
  return (
    <div className="space-y-2 pt-1 border-t border-outline-variant/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Chờ gán ({staging.length})</p>
        <button type="button" onClick={onAssign} disabled={loading}
          className="text-xs bg-secondary/20 text-secondary px-3 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors font-bold flex items-center gap-1 disabled:opacity-50">
          <span className="material-symbols-outlined text-sm">playlist_add_check</span>Gán vào phòng
        </button>
      </div>
      <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
        {staging.map((q, idx) => <QuestionPreviewItem key={q.id} question={q} index={idx + 1} onRemove={() => onRemove(q.id)} />)}
      </div>
    </div>
  );
};

export default RoomLobby;
