import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
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
  questionSetId?: string | null;
  bookScope?: string;
  difficulty?: string;
  createdAt?: string;
};

type UserQuestionDTO = {
  id: string; content: string; options: string[];
  correctAnswer: number; difficulty: string; source: string;
  book: string; chapter: number; explanation: string; theme: string;
};
type ChatMessage = {
  sender: string; text: string;
  isHost?: boolean; isSystem?: boolean; time?: string;
};

const MODE_INFO: Record<string, { label: string; emoji: string; ruleTitle: string; ruleText: string; badgeColor: string; badgeBg: string; badgeBorder: string }> = {
  SPEED_RACE: {
    label: 'Speed Race', emoji: '⚡',
    ruleTitle: 'LUẬT SPEED RACE',
    ruleText: 'Trả lời nhanh nhất để ghi điểm cao nhất. Tốc độ và độ chính xác cùng quyết định thứ hạng của bạn.',
    badgeColor: '#fbbf24', badgeBg: 'rgba(251,191,36,0.15)', badgeBorder: 'rgba(251,191,36,0.3)',
  },
  BATTLE_ROYALE: {
    label: 'Battle Royale', emoji: '❤️',
    ruleTitle: 'LUẬT BATTLE ROYALE',
    ruleText: 'Mỗi câu sai = bị loại. Người trả lời đúng cuối cùng thắng. Tối đa 30 câu/trận. Khi cả nhóm sai cùng câu, không ai bị loại.',
    badgeColor: '#f87171', badgeBg: 'rgba(239,68,68,0.15)', badgeBorder: 'rgba(239,68,68,0.3)',
  },
  TEAM_VS_TEAM: {
    label: 'Team vs Team', emoji: '🏆',
    ruleTitle: 'LUẬT TEAM VS TEAM',
    ruleText: 'Hai đội cạnh tranh nhau. Đội nào ghi nhiều điểm hơn sau tất cả câu hỏi sẽ thắng. Phối hợp với đồng đội!',
    badgeColor: '#60a5fa', badgeBg: 'rgba(96,165,250,0.15)', badgeBorder: 'rgba(96,165,250,0.3)',
  },
  SUDDEN_DEATH: {
    label: 'Sudden Death', emoji: '⚔️',
    ruleTitle: 'LUẬT SUDDEN DEATH',
    ruleText: 'Sai một câu là thua! Chỉ có một người có thể trở thành người chiến thắng cuối cùng.',
    badgeColor: '#c084fc', badgeBg: 'rgba(192,132,252,0.15)', badgeBorder: 'rgba(192,132,252,0.3)',
  },
};

const DIFFICULTY_INFO: Record<string, { label: string; color: string; bg: string }> = {
  EASY:   { label: 'Dễ',          color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  MEDIUM: { label: 'Trung bình',  color: '#ff8c42', bg: 'rgba(255,140,66,0.15)' },
  HARD:   { label: 'Khó',         color: '#f87171', bg: 'rgba(239,68,68,0.15)'  },
  MIXED:  { label: 'Hỗn hợp',    color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.07)' },
};

const QUICK_EMOJIS = ['🙏', '🔥', '👏', '💡', '✨'];

const myUsername = () => localStorage.getItem('userName') ?? '';

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return ''; }
};

const nowTime = () => fmtTime(new Date().toISOString());

// ─────────────────────────────────────────────────────────────────────────────

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{
    sender: 'SYSTEM',
    text: 'Phòng đã được tạo. Đang chờ người chơi tham gia...',
    isSystem: true,
    time: nowTime(),
  }]);
  const [chatInput, setChatInput] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [chatOpen, setChatOpen] = useState(true);

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
          setChatMessages(prev => [...prev, {
            sender: d.sender, text: d.text,
            isHost: d.sender === room?.hostName,
            time: nowTime(),
          }]);
          break;
        }
        case 'GAME_STARTING': {
          const d = msg.data as { countdown: number };
          setCountdown(d.countdown);
          const myTeam = room?.players?.find(p => p.username === myUsername())?.team ?? null;
          setTimeout(() => navigate(`/room/${roomId}/quiz`, {
            replace: true, state: { mode: room?.mode, myTeam }
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
      const res = await api.get(`/api/rooms/${roomId}`);
      if (res.data.success) setRoom(res.data.room);
      else setError(res.data.message || t('room.errorFetchRoom'));
    } catch {
      setError(t('room.errorNetwork'));
    }
  };

  useEffect(() => { fetchRoom(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleToggleReady = () => { if (roomId) send(`/app/room/${roomId}/ready`, {}); };
  const handleStart = async () => {
    if (!roomId) return;
    try {
      await api.post(`/api/rooms/${roomId}/start`);
      send(`/app/room/${roomId}/start`, {});
    } catch { setError(t('room.errorStartRoom')); }
  };
  const handleSwitchTeam = async () => {
    if (!roomId) return;
    setSwitchingTeam(true);
    try {
      const res = await api.post(`/api/rooms/${roomId}/switch-team`);
      if (res.data.success) setRoom(res.data.room);
    } catch { setError(t('room.errorSwitchTeam')); }
    finally { setSwitchingTeam(false); }
  };
  const handleCopyCode = () => {
    if (room?.roomCode) {
      navigator.clipboard.writeText(room.roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join?code=${room?.roomCode}`);
  };
  const handleSendChat = (text: string) => {
    if (!text.trim() || !roomId) return;
    send(`/app/room/${roomId}/chat`, { text: text.trim() });
    setChatInput('');
  };
  const handleLeave = async () => {
    if (roomId) { try { await api.post(`/api/rooms/${roomId}/leave`); } catch { /* ignore */ } }
    navigate('/multiplayer');
  };

  const isTeamVsTeam = room?.mode === 'TEAM_VS_TEAM';
  const isSuddenDeath = room?.mode === 'SUDDEN_DEATH';
  const teamAPlayers = room?.players?.filter(p => p.team === 'A') ?? [];
  const teamBPlayers = room?.players?.filter(p => p.team === 'B') ?? [];
  const myPlayer = room?.players?.find(p => p.username === myUsername());
  const isHost = myPlayer?.userId === room?.hostId;
  const emptySlots = room ? Math.max(0, room.maxPlayers - room.currentPlayers) : 0;
  const modeInfo = MODE_INFO[room?.mode ?? ''] ?? { label: room?.mode ?? '', emoji: '🎮', ruleTitle: 'LUẬT CHƠI', ruleText: '', badgeColor: '#e8a832', badgeBg: 'rgba(232,168,50,0.15)', badgeBorder: 'rgba(232,168,50,0.3)' };
  const diffInfo = DIFFICULTY_INFO[room?.difficulty ?? ''] ?? DIFFICULTY_INFO.MIXED;

  // Non-host players: must all be ready before host can start
  const nonHostPlayers = useMemo(() => room?.players?.filter(p => p.userId !== room?.hostId) ?? [], [room]);
  const readyNonHostCount = useMemo(() => nonHostPlayers.filter(p => p.isReady).length, [nonHostPlayers]);
  const readyCount = useMemo(() => room?.players?.filter(p => p.isReady).length ?? 0, [room]);
  const canStart = room?.status === 'LOBBY' && nonHostPlayers.length >= 1 && readyNonHostCount === nonHostPlayers.length;

  // Status copy — single source of truth
  const statusPrimary = (() => {
    if (!room) return '';
    if (room.currentPlayers < 2) return 'Đang chờ thêm người chơi';
    if (readyNonHostCount < nonHostPlayers.length) return 'Đang chờ tất cả sẵn sàng';
    return 'Tất cả đã sẵn sàng!';
  })();
  const statusSecondary = (() => {
    if (!room) return '';
    const need = Math.max(0, 2 - room.currentPlayers);
    if (room.currentPlayers < 2) return `Cần thêm ${need} người để bắt đầu`;
    if (readyNonHostCount < nonHostPlayers.length) return `${readyNonHostCount}/${nonHostPlayers.length} người chơi đã sẵn sàng`;
    return `${room.currentPlayers}/${room.maxPlayers} người · Có thể bắt đầu`;
  })();

  /* ── Countdown overlay ── */
  if (countdown !== null) return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-secondary animate-bounce-in">{countdown}</div>
        <p className="text-xl text-on-surface-variant mt-4">{t('room.gameStarting')}</p>
      </div>
    </div>
  );

  /* ── Error state ── */
  if (error) return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="text-error text-lg">{error}</p>
        <button onClick={() => navigate('/multiplayer')} className="text-secondary underline text-sm">{t('common.back')}</button>
      </div>
    </div>
  );

  /* ── Loading state ── */
  if (!room) return (
    <div className="min-h-screen bg-surface-dim flex items-center justify-center">
      <p className="text-on-surface-variant animate-pulse text-lg">{t('room.loadingRoom')}</p>
    </div>
  );

  /* ── MOBILE LAYOUT ── */
  if (isMobile) return (
    <div style={{ background: '#11131e', minHeight: '100vh', position: 'relative', fontFamily: "'Be Vietnam Pro', sans-serif", color: '#e1e1f1' }}>

      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-error-container/90 text-on-error-container text-center py-2 text-sm font-medium">
          <span className="material-symbols-outlined text-sm align-middle mr-1">wifi_off</span>
          {t('room.reconnecting')}
        </div>
      )}

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, background: 'rgba(17,19,30,0.95)', backdropFilter: 'blur(8px)', borderBottom: '0.5px solid rgba(255,255,255,0.06)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <Link to="/multiplayer" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecoration: 'none' }}>←</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#97C459' : '#f87171', boxShadow: connected ? '0 0 4px #97C459' : '0 0 4px #f87171', display: 'inline-block' }} />
          <span style={{ color: connected ? '#97C459' : '#f87171', fontSize: 10, fontWeight: 500, letterSpacing: '0.4px' }}>
            {connected ? 'ĐÃ KẾT NỐI' : 'MẤT KẾT NỐI'}
          </span>
        </div>
        <button style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 16, cursor: 'pointer' }}>⚙️</button>
      </header>

      {/* Scrollable content */}
      <div style={{ padding: '12px 14px 110px' }}>

        {/* Room info card */}
        <section style={{ background: 'linear-gradient(135deg, rgba(232,168,50,0.08), rgba(50,52,64,0.4))', border: '0.5px solid rgba(232,168,50,0.25)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ background: modeInfo.badgeBg, color: modeInfo.badgeColor, padding: '2px 6px', borderRadius: 5, fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3, border: `0.5px solid ${modeInfo.badgeBorder}` }}>
              <span>{modeInfo.emoji}</span> {modeInfo.label}
            </span>
            <span style={{ background: room.isPublic ? 'rgba(74,222,128,0.1)' : 'rgba(255,140,66,0.15)', color: room.isPublic ? '#4ade80' : '#ff8c42', padding: '2px 6px', borderRadius: 999, fontSize: 8, fontWeight: 500 }}>
              {room.isPublic ? '🌐 Công khai' : '🔒 Riêng tư'}
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 16, fontWeight: 500, margin: '0 0 6px', lineHeight: 1.3 }}>{room.roomName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(156,163,175,0.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500 }}>
              {room.hostName?.[0]?.toUpperCase()}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>{room.hostName}</span>
            <span style={{ background: 'rgba(232,168,50,0.2)', color: '#e8a832', padding: '1px 5px', borderRadius: 999, fontSize: 8, fontWeight: 500 }}>CHỦ</span>
            {room.createdAt && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 'auto' }}>{fmtTime(room.createdAt)}</span>}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              <span>📖</span>
              <span style={{ fontWeight: 500 }}>{room.bookScope && room.bookScope !== 'ALL' ? room.bookScope : 'Toàn bộ Kinh Thánh'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
              {room.difficulty && (
                <span style={{ background: diffInfo.bg, color: diffInfo.color, padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 500 }}>⚡ {diffInfo.label}</span>
              )}
              <span>📝 {room.questionCount} câu</span>
              <span>⏱ {room.timePerQuestion}s</span>
            </div>
          </div>
        </section>

        {/* Room code section */}
        <section style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(232,168,50,0.4)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ color: 'rgba(232,168,50,0.7)', fontSize: 9, letterSpacing: '0.5px', marginBottom: 6, fontWeight: 500 }}>MÃ PHÒNG · CHIA SẺ MỜI BẠN BÈ</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ color: '#e8a832', fontSize: 22, fontWeight: 600, fontFamily: "'Courier New', monospace", letterSpacing: 3, lineHeight: 1, flex: 1 }}>
              {room.roomCode}
            </div>
            <button
              onClick={handleCopyCode}
              style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832', border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
            >
              {codeCopied ? '✓ Đã sao' : '📋 Sao'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button onClick={handleCopyLink} style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832', border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6, padding: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              🔗 Chia sẻ link
            </button>
            <button style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832', border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6, padding: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              📱 Hiện QR
            </button>
          </div>
        </section>

        {/* Players section */}
        <section style={{ marginBottom: 10 }} data-testid="lobby-player-grid">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Người chơi</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 }}>Cần ≥2 người · Tối đa {room.maxPlayers}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(232,168,50,0.08)', border: '0.5px solid rgba(232,168,50,0.25)', borderRadius: 999, padding: '3px 8px' }}>
              <span style={{ color: '#e8a832', fontSize: 11, fontWeight: 500 }}>{room.currentPlayers} / {room.maxPlayers}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(room.players ?? []).map(p => (
              <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} compact />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} index={i} t={t} gold={i === 0} />
            ))}
          </div>
        </section>

        {/* Rule banner */}
        {modeInfo.ruleText && (
          <section style={{ background: 'rgba(74,158,255,0.05)', border: '0.5px solid rgba(74,158,255,0.2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#6AB8E8', fontSize: 9, fontWeight: 500, letterSpacing: '0.4px', marginBottom: 3 }}>{modeInfo.ruleTitle}</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 1.4 }}>{modeInfo.ruleText}</div>
            </div>
          </section>
        )}

        {/* Chat section (collapsible) */}
        <section style={{ background: 'rgba(50,52,64,0.4)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: chatOpen ? 10 : 0, cursor: 'pointer' }}
            onClick={() => setChatOpen(v => !v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>💬</span>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Trò chuyện</span>
              {chatMessages.length > 1 && (
                <span style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832', padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 500 }}>
                  {chatMessages.length}
                </span>
              )}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{chatOpen ? '▲' : '▼'}</span>
          </div>
          {chatOpen && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8, maxHeight: 160, overflowY: 'auto' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: msg.isSystem ? 'rgba(232,168,50,0.7)' : msg.isHost ? '#e8a832' : 'rgba(106,184,232,0.9)', fontSize: 9, fontWeight: 500, marginBottom: 2 }}>
                      {msg.isSystem ? `SYSTEM · ${msg.time ?? ''}` : msg.sender}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.4 }}>{msg.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {QUICK_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => handleSendChat(emoji)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', fontSize: 13, cursor: 'pointer' }}
                  >{emoji}</button>
                ))}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 11, flex: 1 }}
                  placeholder="Nhắn tin trong phòng..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendChat(chatInput); }}
                />
                <button onClick={() => handleSendChat(chatInput)}
                  style={{ background: 'transparent', color: '#e8a832', border: 'none', fontSize: 14, cursor: 'pointer' }}
                >→</button>
              </div>
            </>
          )}
        </section>

      </div>

      {/* Fixed footer */}
      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(17,19,30,0.97)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid rgba(232,168,50,0.15)', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: canStart ? '#4ade80' : '#ff8c42', boxShadow: canStart ? '0 0 4px #4ade80' : '0 0 4px #ff8c42', display: 'inline-block' }} />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{statusPrimary}</span>
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 10, marginBottom: 10 }}>
          {statusSecondary}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <button
            data-testid="lobby-leave-btn"
            onClick={handleLeave}
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '11px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ↩ Rời
          </button>
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart}
              title={!canStart ? statusSecondary : undefined}
              style={{ background: canStart ? 'linear-gradient(135deg, #e8a832, #e7c268)' : 'rgba(232,168,50,0.15)', color: canStart ? '#11131e' : 'rgba(232,168,50,0.5)', border: `0.5px solid ${canStart ? 'transparent' : 'rgba(232,168,50,0.3)'}`, borderRadius: 10, padding: 11, fontSize: 12, fontWeight: 500, cursor: canStart ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              ▶ Bắt đầu
            </button>
          ) : (
            <button
              data-testid="lobby-ready-btn"
              onClick={handleToggleReady}
              style={{ background: myPlayer?.isReady ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: myPlayer?.isReady ? '#4ade80' : 'rgba(255,255,255,0.7)', border: `0.5px solid ${myPlayer?.isReady ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, padding: 11, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              {myPlayer?.isReady ? '✓ Sẵn sàng' : '○ Sẵn sàng'}
            </button>
          )}
        </div>
      </footer>

    </div>
  );

  /* ── DESKTOP LAYOUT ── */
  return (
    <div style={{ background: '#11131e', minHeight: '100vh', fontFamily: "'Be Vietnam Pro', sans-serif", padding: '1.5rem', color: '#e1e1f1' }}>

      {/* ── Reconnecting banner ── */}
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-error-container/90 text-on-error-container text-center py-2 text-sm font-medium">
          <span className="material-symbols-outlined text-sm align-middle mr-1">wifi_off</span>
          {t('room.reconnecting')}
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link
          to="/multiplayer"
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Đa người chơi
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? '#97C459' : '#f87171',
              boxShadow: connected ? '0 0 6px #97C459' : '0 0 6px #f87171',
              display: 'inline-block',
            }} />
            <span style={{ color: connected ? '#97C459' : '#f87171', fontSize: 11, fontWeight: 500, letterSpacing: '0.4px' }}>
              {connected ? 'ĐÃ KẾT NỐI' : 'MẤT KẾT NỐI'}
            </span>
          </div>
          <button
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            ⚙️ Cài đặt
          </button>
        </div>
      </header>

      {/* ── ROOM INFO CARD ── */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(232,168,50,0.08), rgba(50,52,64,0.4))',
        border: '0.5px solid rgba(232,168,50,0.25)',
        borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>

          {/* Left: room metadata */}
          <div>
            {/* Mode + privacy badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                background: modeInfo.badgeBg, color: modeInfo.badgeColor,
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
                border: `0.5px solid ${modeInfo.badgeBorder}`,
              }}>
                <span>{modeInfo.emoji}</span> {modeInfo.label}
              </span>
              <span style={{
                background: room.isPublic ? 'rgba(74,222,128,0.1)' : 'rgba(255,140,66,0.15)',
                color: room.isPublic ? '#4ade80' : '#ff8c42',
                padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {room.isPublic ? '🌐 Công khai' : '🔒 Riêng tư'}
              </span>
            </div>

            {/* Room name */}
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 500, margin: '0 0 6px' }}>
              {room.roomName}
            </h1>

            {/* Host info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(156,163,175,0.3)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 500,
                }}>
                  {room.hostName?.[0]?.toUpperCase()}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{room.hostName}</span>
                <span style={{
                  background: 'rgba(232,168,50,0.2)', color: '#e8a832',
                  padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 500,
                }}>CHỦ PHÒNG</span>
              </div>
              {room.createdAt && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Tạo lúc {fmtTime(room.createdAt)}</span>
                </>
              )}
            </div>

            {/* Metadata row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {room.bookScope && room.bookScope !== 'ALL' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📖</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{room.bookScope}</span>
                </div>
              )}
              {room.difficulty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span style={{
                    background: diffInfo.bg, color: diffInfo.color,
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  }}>{diffInfo.label}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>📝</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{room.questionCount} câu</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>⏱</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{room.timePerQuestion}s/câu</span>
              </div>
            </div>
          </div>

          {/* Right: room code box */}
          <div style={{
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(232,168,50,0.4)',
            borderRadius: 12, padding: '12px 16px', minWidth: 220,
          }}>
            <div style={{ color: 'rgba(232,168,50,0.7)', fontSize: 9, letterSpacing: '0.5px', marginBottom: 6, fontWeight: 500 }}>
              MÃ PHÒNG · CHIA SẺ
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                color: '#e8a832', fontSize: 26, fontWeight: 600,
                fontFamily: "'Courier New', monospace", letterSpacing: 4, lineHeight: 1,
              }}>
                {room.roomCode}
              </div>
              <button
                onClick={handleCopyCode}
                title="Sao chép mã"
                style={{
                  background: 'rgba(232,168,50,0.15)', color: '#e8a832',
                  border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6,
                  padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                }}
              >
                {codeCopied ? '✓' : '📋'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleCopyLink}
                style={{
                  background: 'rgba(232,168,50,0.15)', color: '#e8a832',
                  border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6,
                  padding: '6px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                🔗 Link
              </button>
              <button
                style={{
                  background: 'rgba(232,168,50,0.15)', color: '#e8a832',
                  border: '0.5px solid rgba(232,168,50,0.4)', borderRadius: 6,
                  padding: '6px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                📱 QR
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── MAIN 2-COLUMN ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── PLAYERS SECTION ── */}
          <section data-testid="lobby-player-grid">
            {/* Section header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>Người chơi</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                  Cần ít nhất 2 người để bắt đầu · Tối đa {room.maxPlayers} người
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(232,168,50,0.08)', border: '0.5px solid rgba(232,168,50,0.25)',
                borderRadius: 999, padding: '4px 10px',
              }}>
                <span style={{ color: '#e8a832', fontSize: 12, fontWeight: 500 }}>
                  {room.currentPlayers} / {room.maxPlayers}
                </span>
                <span style={{ width: 1, height: 10, background: 'rgba(232,168,50,0.3)', display: 'inline-block' }} />
                <span style={{ color: 'rgba(232,168,50,0.7)', fontSize: 10 }}>
                  {room.currentPlayers < 2 ? `Cần thêm ${2 - room.currentPlayers} người` : canStart ? 'Sẵn sàng' : 'Đang chờ sẵn sàng'}
                </span>
              </div>
            </div>

            {/* Team vs Team layout */}
            {isTeamVsTeam ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-2">
                    🔵 {t('room.teamA')} {myPlayer?.team === 'A' && <span className="text-on-surface-variant text-[10px]">({t('room.you')})</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {teamAPlayers.map(p => <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />)}
                    {teamAPlayers.length === 0 && <EmptySlot index={0} t={t} />}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
                    🔴 {t('room.teamB')} {myPlayer?.team === 'B' && <span className="text-on-surface-variant text-[10px]">({t('room.you')})</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {teamBPlayers.map(p => <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />)}
                    {teamBPlayers.length === 0 && <EmptySlot index={0} t={t} />}
                  </div>
                </div>
                {myPlayer && (
                  <button
                    onClick={handleSwitchTeam} disabled={switchingTeam}
                    className="text-xs text-secondary border border-secondary/30 px-4 py-2 rounded-lg hover:bg-secondary/10 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm align-middle mr-1">swap_horiz</span>
                    {t('room.switchTeam')}
                  </button>
                )}
              </div>
            ) : isSuddenDeath ? (
              /* Sudden Death layout */
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-4">
                  👑 {t('room.battleOrder')}
                </div>
                {(room.players ?? []).map((p, idx) => (
                  <div key={p.id} className={`bg-surface-container p-4 rounded-xl flex items-center gap-4 border transition-all ${idx === 0 ? 'border-secondary/30' : 'border-outline-variant/5'} hover:bg-surface-container-high`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-secondary text-on-secondary' : idx === 1 ? 'bg-surface-container-highest text-on-surface' : 'bg-surface-container-low text-on-surface-variant'}`}>
                      {idx === 0 ? '👑' : idx === 1 ? '⚔️' : `#${idx + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-on-surface truncate">{p.username}{p.username === myUsername() ? ` (${t('room.you')})` : ''}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {idx === 0 ? t('room.hotSeat') : idx === 1 ? t('room.challenger') : t('room.waiting')}
                      </span>
                    </div>
                    {p.userId === room.hostId && <span className="text-[10px] font-bold text-secondary uppercase">Host</span>}
                    <span className={`material-symbols-outlined text-2xl ${p.isReady ? 'text-emerald-400' : 'text-on-surface-variant/20'}`} style={p.isReady ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      {p.isReady ? 'check_circle' : 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Default 4-column grid */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {(room.players ?? []).map(p => (
                  <PlayerCard key={p.id} player={p} hostId={room.hostId} t={t} />
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <EmptySlot key={`empty-${i}`} index={i} t={t} />
                ))}
              </div>
            )}
          </section>

          {/* ── RULE BANNER ── */}
          {modeInfo.ruleText && (
            <section style={{
              background: 'rgba(74,158,255,0.04)', border: '0.5px solid rgba(74,158,255,0.2)',
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#6AB8E8', fontSize: 11, fontWeight: 500, letterSpacing: '0.4px', marginBottom: 4 }}>
                  {modeInfo.ruleTitle}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.5 }}>
                  {modeInfo.ruleText}
                </div>
              </div>
              <button style={{
                background: 'transparent', color: 'rgba(106,184,232,0.7)',
                border: '0.5px solid rgba(106,184,232,0.3)', borderRadius: 6,
                padding: '4px 8px', fontSize: 10, cursor: 'pointer', flexShrink: 0,
              }}>
                Xem chi tiết →
              </button>
            </section>
          )}

        </div>

        {/* ── RIGHT: CHAT ASIDE ── */}
        <aside style={{
          background: 'rgba(50,52,64,0.4)', border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 12, padding: '1rem',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Chat header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 12, paddingBottom: 12,
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>Trò chuyện</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 'auto' }}>Public</span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, overflowY: 'auto', maxHeight: 280 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{
                  color: msg.isSystem ? 'rgba(232,168,50,0.7)' : msg.isHost ? '#e8a832' : 'rgba(106,184,232,0.9)',
                  fontSize: 9, fontWeight: 500, marginBottom: 2,
                }}>
                  {msg.isSystem ? 'SYSTEM' : msg.sender}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.4 }}>{msg.text}</div>
                {msg.time && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 2 }}>{msg.time}</div>}
              </div>
            ))}
            {chatMessages.length === 1 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '20px 10px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Hãy nói lời chào tới những người chơi khác!
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick emoji */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleSendChat(emoji)}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, padding: '4px 8px', fontSize: 13, cursor: 'pointer',
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat input */}
          <div style={{
            background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '8px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12, flex: 1 }}
              placeholder="Nhắn tin trong phòng..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendChat(chatInput); }}
            />
            <button
              onClick={() => handleSendChat(chatInput)}
              style={{ background: 'transparent', color: '#e8a832', border: 'none', fontSize: 16, cursor: 'pointer' }}
            >
              →
            </button>
          </div>
        </aside>

      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        marginTop: '1.25rem',
        background: 'rgba(50,52,64,0.4)', border: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>

        {/* Leave */}
        <button
          data-testid="lobby-leave-btn"
          onClick={handleLeave}
          style={{
            background: 'rgba(239,68,68,0.1)', color: '#f87171',
            border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 8,
            padding: '10px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}
        >
          ↩ Rời phòng
        </button>

        {/* Center status */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: canStart ? '#4ade80' : '#ff8c42',
              boxShadow: canStart ? '0 0 6px #4ade80' : '0 0 6px #ff8c42',
              display: 'inline-block',
            }} />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{statusPrimary}</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{statusSecondary}</div>
        </div>

        {/* Right: host → Start only; player → Ready toggle only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart}
              title={!canStart ? statusSecondary : undefined}
              style={{
                background: canStart ? 'linear-gradient(135deg, #e8a832, #e7c268)' : 'rgba(232,168,50,0.15)',
                color: canStart ? '#11131e' : 'rgba(232,168,50,0.5)',
                border: `0.5px solid ${canStart ? 'transparent' : 'rgba(232,168,50,0.3)'}`,
                borderRadius: 10, padding: '12px 28px',
                fontSize: 13, fontWeight: 500,
                cursor: canStart ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              ▶ Bắt đầu
            </button>
          ) : (
            <button
              data-testid="lobby-ready-btn"
              onClick={handleToggleReady}
              style={{
                background: myPlayer?.isReady ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                color: myPlayer?.isReady ? '#4ade80' : 'rgba(255,255,255,0.7)',
                border: `0.5px solid ${myPlayer?.isReady ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {myPlayer?.isReady ? '✓ Sẵn sàng' : '○ Sẵn sàng'}
            </button>
          )}
        </div>

      </footer>

      {/* ── TIP ── */}
      <div style={{ textAlign: 'center', marginTop: 8, color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
        💡 Khi có ≥2 người sẵn sàng, nút "Bắt đầu" sẽ kích hoạt · Auto-start sau 10 giây nếu host AFK
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

/* ── Player Card — vertical layout ── */
const PlayerCard: React.FC<{ player: Player; hostId: string; t: (key: string) => string; compact?: boolean }> = ({ player, hostId, t, compact }) => {
  const avatarSize = compact ? 40 : 48;
  const crownSize = compact ? 16 : 18;
  const isHost = player.userId === hostId;
  const isMe = player.username === myUsername();

  return (
    <div style={{
      background: 'rgba(50,52,64,0.5)',
      border: `1.5px solid ${isHost ? 'rgba(232,168,50,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: compact ? 10 : 12, padding: compact ? 10 : 12, position: 'relative',
      boxShadow: isHost ? (compact ? '0 0 12px rgba(232,168,50,0.1)' : '0 0 16px rgba(232,168,50,0.1)') : undefined,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>

        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl} alt={player.username}
              style={{
                width: avatarSize, height: avatarSize, borderRadius: '50%', objectFit: 'cover',
                border: isHost ? '1.5px solid #e8a832' : '1.5px solid rgba(255,255,255,0.1)',
                opacity: player.isReady ? 1 : 0.7,
              }}
            />
          ) : (
            <div style={{
              width: avatarSize, height: avatarSize, borderRadius: '50%',
              background: isHost ? 'rgba(232,168,50,0.15)' : 'rgba(156,163,175,0.3)',
              border: isHost ? '1.5px solid #e8a832' : '1.5px solid rgba(255,255,255,0.1)',
              color: isHost ? '#e8a832' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 14 : 18, fontWeight: 500,
              opacity: player.isReady ? 1 : 0.7,
            }}>
              {player.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          {/* Crown badge for host */}
          {isHost && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: crownSize, height: crownSize, borderRadius: '50%',
              background: '#e8a832', color: '#412d00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 9 : 10,
            }}>
              👑
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 11, fontWeight: 500, lineHeight: 1.2 }}>
            {player.username}{isMe ? ' (bạn)' : ''}
          </div>
          {isHost && (
            <div style={{ color: 'rgba(232,168,50,0.7)', fontSize: 9, marginTop: 1 }}>CHỦ PHÒNG</div>
          )}
        </div>

        {/* Ready status badge */}
        <div style={{
          background: player.isReady ? 'rgba(74,222,128,0.15)' : 'rgba(255,140,66,0.1)',
          color: player.isReady ? '#4ade80' : '#ff8c42',
          padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
          border: `0.5px solid ${player.isReady ? 'rgba(74,222,128,0.4)' : 'rgba(255,140,66,0.3)'}`,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: player.isReady ? '#4ade80' : '#ff8c42',
            display: 'inline-block',
          }} />
          {player.isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
        </div>

      </div>
    </div>
  );
};

/* ── Empty Slot ── */
const EmptySlot: React.FC<{ index: number; t: (key: string) => string; gold?: boolean }> = ({ index, gold }) => {
  const isInvite = index === 0;
  if (gold) return (
    <div style={{ background: 'rgba(232,168,50,0.04)', border: '1.5px dashed rgba(232,168,50,0.3)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(232,168,50,0.08)', border: '1.5px dashed rgba(232,168,50,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 18, color: '#e8a832' }}>+</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <div style={{ color: '#e8a832', fontSize: 10, fontWeight: 500 }}>Mời bạn bè</div>
          <div style={{ color: 'rgba(232,168,50,0.5)', fontSize: 8, marginTop: 1 }}>Chia sẻ mã</div>
        </div>
      </div>
    </div>
  );
  return (
    <div style={{
      background: isInvite ? 'rgba(50,52,64,0.3)' : 'rgba(50,52,64,0.25)',
      border: isInvite ? '1.5px dashed rgba(255,255,255,0.15)' : '1.5px dashed rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 12, cursor: isInvite ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: isInvite ? 0.65 : 0.5 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: isInvite ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
          border: isInvite ? '1.5px dashed rgba(255,255,255,0.2)' : '1px dashed rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isInvite
            ? <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>+</span>
            : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>⏳</span>
          }
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: isInvite ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: isInvite ? 500 : 400 }}>
            {isInvite ? 'Mời bạn bè' : 'Đang chờ'}
          </div>
          <div style={{ color: isInvite ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.25)', fontSize: 9, marginTop: 1 }}>
            {isInvite ? 'Hoặc chia sẻ mã' : `Slot #${index + 1}`}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Question Preview Item ── */
const QuestionPreviewItem: React.FC<{ question: UserQuestionDTO; index: number; onRemove: () => void }> = ({ question, index, onRemove }) => (
  <div className="flex items-start gap-3 bg-surface-container rounded-lg p-3 text-xs">
    <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex-shrink-0 flex items-center justify-center font-bold text-[10px]">{index}</span>
    <div className="flex-1 min-w-0">
      <p className="text-on-surface leading-snug line-clamp-1">{question.content}</p>
      <p className="text-on-surface-variant/50 mt-0.5 truncate">✓ {question.options[question.correctAnswer]}{question.book ? ` · ${question.book}` : ''}</p>
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

/* ── Staging Preview ── */
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
