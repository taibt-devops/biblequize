import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type RoomMode = 'SPEED_RACE' | 'BATTLE_ROYALE' | 'TEAM_VS_TEAM' | 'SUDDEN_DEATH';
type RoomStatus = 'LOBBY' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED';
type RoomDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
type SortOption = 'newest' | 'filling' | 'difficulty';

interface PublicRoom {
  id: string;
  roomCode: string;
  roomName: string;
  mode: RoomMode;
  status: RoomStatus;
  isPublic: boolean;
  currentPlayers: number;
  maxPlayers: number;
  questionCount: number;
  timePerQuestion: number;
  difficulty: RoomDifficulty;
  bookScope: string;
  hostName: string;
  createdAt: string;
  playerInitials: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<RoomMode, { label: string; icon: string; color: string; border: string; bg: string; btnBg: string; btnText: string }> = {
  SPEED_RACE:   { label: 'Speed Race',   icon: '⚡', color: '#e8a832', border: 'rgba(232,168,50,0.35)',  bg: 'rgba(232,168,50,0.12)',  btnBg: 'rgba(232,168,50,0.15)', btnText: '#e8a832' },
  BATTLE_ROYALE:{ label: 'Battle Royale',icon: '❤️', color: '#f87171', border: 'rgba(239,68,68,0.35)',   bg: 'rgba(239,68,68,0.12)',   btnBg: 'rgba(239,68,68,0.15)', btnText: '#f87171' },
  TEAM_VS_TEAM: { label: 'Team vs Team', icon: '👥', color: '#6AB8E8', border: 'rgba(74,158,255,0.35)',  bg: 'rgba(74,158,255,0.12)',  btnBg: 'rgba(74,158,255,0.15)', btnText: '#6AB8E8' },
  SUDDEN_DEATH: { label: 'Sudden Death', icon: '👑', color: '#c084fc', border: 'rgba(168,85,247,0.35)',  bg: 'rgba(168,85,247,0.12)',  btnBg: 'rgba(168,85,247,0.15)', btnText: '#c084fc' },
};

const DIFFICULTY_CONFIG: Record<RoomDifficulty, { label: string; icon: string; color: string; bg: string }> = {
  EASY:   { label: 'Dễ',   icon: '😊', color: '#97C459', bg: 'rgba(99,153,34,0.15)' },
  MEDIUM: { label: 'Trung',icon: '⚡', color: '#ff8c42', bg: 'rgba(255,140,66,0.15)' },
  HARD:   { label: 'Khó',  icon: '🔥', color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  MIXED:  { label: 'Trộn', icon: '🌐', color: '#e8a832', bg: 'rgba(232,168,50,0.15)' },
};

const BOOK_SCOPE_TESTAMENT: Record<string, { label: string; color: string; bg: string }> = {
  ALL:            { label: '66 sách',    color: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
  OLD_TESTAMENT:  { label: 'Cựu Ước',   color: '#6AB8E8', bg: 'rgba(74,158,255,0.15)' },
  NEW_TESTAMENT:  { label: 'Tân Ước',   color: '#6AB8E8', bg: 'rgba(74,158,255,0.15)' },
  GOSPELS:        { label: '4 Phúc Âm', color: '#6AB8E8', bg: 'rgba(74,158,255,0.15)' },
};

const FILL_1: CSSProperties = { fontVariationSettings: "'FILL' 1" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTestamentBadge(bookScope: string) {
  const key = bookScope?.toUpperCase();
  return BOOK_SCOPE_TESTAMENT[key] ?? { label: 'Cựu Ước', color: '#6AB8E8', bg: 'rgba(74,158,255,0.15)' };
}

function formatBookScope(bookScope: string): string {
  const map: Record<string, string> = {
    ALL: 'Toàn bộ Kinh Thánh',
    OLD_TESTAMENT: 'Cựu Ước (39 sách)',
    NEW_TESTAMENT: 'Tân Ước (27 sách)',
    GOSPELS: '4 Phúc Âm',
    EPISTLES: '21 Thư Tín',
  };
  return map[bookScope?.toUpperCase()] ?? bookScope ?? 'Kinh Thánh';
}

function formatRelativeTime(createdAt: string): string {
  if (!createdAt) return 'Vừa tạo';
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa tạo';
  if (mins < 60) return `${mins} phút trước`;
  return `${Math.floor(mins / 60)} giờ trước`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarStack({ initials, current, max }: { initials: string[]; current: number; max: number }) {
  const shown = initials.slice(0, 5);
  const empty = Math.max(0, max - current);
  const colors = ['rgba(232,168,50,0.3)', 'rgba(74,158,255,0.3)', 'rgba(168,85,247,0.3)', 'rgba(99,153,34,0.3)', 'rgba(255,140,66,0.3)'];
  const textColors = ['#e8a832', '#6AB8E8', '#c084fc', '#97C459', '#ff8c42'];

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {shown.map((initial, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2"
            style={{
              background: colors[i % colors.length],
              color: textColors[i % textColors.length],
              borderColor: '#11131e',
              marginLeft: i > 0 ? '-8px' : undefined,
              zIndex: 10 - i,
            }}
          >
            {initial}
          </div>
        ))}
        {Array.from({ length: Math.min(empty, 3) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm border"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.25)',
              borderColor: 'rgba(255,255,255,0.12)',
              borderStyle: 'dashed',
              marginLeft: '-8px',
              zIndex: 10 - shown.length - i,
            }}
          >
            +
          </div>
        ))}
      </div>
      <div>
        <div className="text-white text-[11px] font-semibold">{current}/{max}</div>
        <div className="text-[9px]" style={{ color: current >= max ? '#f87171' : current >= max - 1 ? '#ff8c42' : '#97C459' }}>
          {current >= max ? 'Đã đầy' : current >= max - 1 ? 'Còn 1 chỗ!' : `Cần ${max - current} nữa`}
        </div>
      </div>
    </div>
  );
}

function CodeInput({ onJoin, disabled }: { onJoin: (code: string) => void; disabled?: boolean }) {
  const [chars, setChars] = useState<string[]>(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const code = chars.join('');
  const filled = chars.filter(Boolean).length;

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-1);
    const next = [...chars];
    next[i] = char;
    setChars(next);
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'Enter' && filled === 6) onJoin(code);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
    const next = Array(6).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setChars(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div>
      {/* Inputs + button inline (same row) */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {chars.map((c, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="text"
              maxLength={2}
              value={c}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              data-testid={`code-digit-${i}`}
              className="w-9 h-11 flex-shrink-0 rounded-lg text-center text-lg font-bold outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: `0.5px solid ${c ? 'rgba(232,168,50,0.5)' : 'rgba(232,168,50,0.2)'}`,
                color: c ? '#e8a832' : 'rgba(255,255,255,0.2)',
                boxShadow: c ? '0 0 8px rgba(232,168,50,0.15)' : 'none',
              }}
            />
          ))}
        </div>
        <button
          onClick={() => { if (filled === 6 && !disabled) onJoin(code); }}
          disabled={filled < 6 || disabled}
          className="text-xs font-semibold px-4 py-2.5 rounded-lg transition-all flex-shrink-0"
          style={{
            background: filled === 6 && !disabled ? 'rgba(232,168,50,0.2)' : 'rgba(255,255,255,0.04)',
            color: filled === 6 && !disabled ? '#e8a832' : 'rgba(255,255,255,0.25)',
            border: `0.5px solid ${filled === 6 && !disabled ? 'rgba(232,168,50,0.4)' : 'rgba(255,255,255,0.08)'}`,
            cursor: filled === 6 && !disabled ? 'pointer' : 'not-allowed',
          }}
        >
          {disabled ? '...' : 'Vào →'}
        </button>
      </div>
      {/* Status text below inputs */}
      <div className="mt-1.5">
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {filled === 6 ? '✓ Sẵn sàng vào phòng' : `Còn thiếu ${6 - filled} ký tự`}
        </span>
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: PublicRoom }) {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const mode = MODE_CONFIG[room.mode] ?? MODE_CONFIG.SPEED_RACE;
  const diff = DIFFICULTY_CONFIG[room.difficulty] ?? DIFFICULTY_CONFIG.MIXED;
  const testament = getTestamentBadge(room.bookScope);
  const isWaiting = room.status === 'LOBBY';
  const isPlaying = room.status === 'IN_PROGRESS';
  const isFull = room.currentPlayers >= room.maxPlayers;
  const isAlmostFull = room.currentPlayers >= room.maxPlayers - 1 && !isFull;

  const handleJoin = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!room.id || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await api.post('/api/rooms/join', { roomCode: room.roomCode });
      const joinedRoom = res.data.room;
      navigate(`/room/${joinedRoom.id}/lobby`, { state: { room: joinedRoom } });
    } catch (err: any) {
      setJoinError(err?.response?.data?.message || 'Không thể vào phòng');
      setJoining(false);
    }
  };

  const statusConfig = isPlaying
    ? { dot: '#e8a832', text: 'Đang chơi', textColor: '#e8a832' }
    : isFull
    ? { dot: '#f87171', text: 'Đã đầy', textColor: '#f87171' }
    : isAlmostFull
    ? { dot: '#ff8c42', text: 'Sắp đầy!', textColor: '#ff8c42' }
    : { dot: '#97C459', text: 'Đang chờ', textColor: '#97C459' };

  return (
    <article
      data-testid="room-card"
      className="rounded-xl p-3.5 cursor-pointer transition-all duration-200 flex flex-col gap-3"
      style={{
        background: 'rgba(50,52,64,0.4)',
        border: `0.5px solid ${isAlmostFull ? mode.color + '66' : mode.border}`,
        boxShadow: isAlmostFull ? `0 0 16px ${mode.color}18` : undefined,
      }}
      onClick={() => {
        if (isWaiting && !isFull) handleJoin();
        else if (isPlaying && room.id) navigate(`/room/${room.id}/spectate`);
      }}
    >
      {/* Top row: mode badge + status */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
          style={{ background: mode.bg, color: mode.color, border: `0.5px solid ${mode.border}` }}
        >
          <span>{mode.icon}</span> {mode.label}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusConfig.dot, boxShadow: `0 0 5px ${statusConfig.dot}` }}
          />
          <span className="text-[10px] font-semibold" style={{ color: statusConfig.textColor }}>
            {statusConfig.text}
          </span>
        </div>
      </div>

      {/* Room title */}
      <div className="text-white text-sm font-semibold leading-snug">{room.roomName}</div>

      {/* Host + time + public badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
          style={{ background: mode.bg, color: mode.color }}
        >
          {room.hostName ? room.hostName.charAt(0).toUpperCase() : '?'}
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{room.hostName ?? 'Unknown'}</span>
        <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{formatRelativeTime(room.createdAt)}</span>
        <span
          className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
          style={room.isPublic
            ? { background: 'rgba(99,153,34,0.15)', color: '#97C459' }
            : { background: 'rgba(255,140,66,0.12)', color: '#ff8c42' }
          }
        >
          {room.isPublic ? 'PUBLIC' : '🔒 PRIVATE'}
        </span>
      </div>

      {/* Bible context box */}
      <div
        className="rounded-lg px-3 py-2.5 flex flex-col gap-1.5"
        style={{ background: 'rgba(0,0,0,0.22)' }}
      >
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <span>📖</span>
          <span className="font-medium">{formatBookScope(room.bookScope)}</span>
          <span
            className="ml-auto px-1.5 py-0.5 rounded-full text-[9px]"
            style={{ background: testament.bg, color: testament.color }}
          >
            {testament.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span>📝 {room.questionCount ?? 10} câu</span>
          <span>⏱ {room.timePerQuestion ?? 30}s/câu</span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: diff.bg, color: diff.color }}
          >
            {diff.icon} {diff.label}
          </span>
        </div>
      </div>

      {/* Join error */}
      {joinError && (
        <div className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
          ⚠ {joinError}
        </div>
      )}

      {/* Footer: avatar stack + CTA */}
      <div className="flex items-center justify-between">
        <AvatarStack
          initials={room.playerInitials ?? []}
          current={room.currentPlayers}
          max={room.maxPlayers}
        />

        {isWaiting && !isFull && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{
              background: isAlmostFull ? mode.color : mode.btnBg,
              color: isAlmostFull ? '#11131e' : mode.btnText,
              border: isAlmostFull ? 'none' : `0.5px solid ${mode.border}`,
              boxShadow: isAlmostFull ? `0 0 12px ${mode.color}50` : undefined,
            }}
          >
            {joining ? '...' : isAlmostFull ? 'Vào nhanh →' : 'Vào →'}
          </button>
        )}
        {isWaiting && isFull && (
          <button
            disabled
            className="px-4 py-2 rounded-lg text-xs font-semibold cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)' }}
          >
            Đã đầy
          </button>
        )}
        {isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/room/${room.id}/spectate`); }}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            Xem →
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Multiplayer = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [sort, setSort] = useState<SortOption>('newest');
  const [activeFilters, setActiveFilters] = useState<{ id: string; label: string }[]>([]);
  const [codeJoinError, setCodeJoinError] = useState<string | null>(null);
  const [isCodeJoining, setIsCodeJoining] = useState(false);

  const handleJoinByCode = async (code: string) => {
    setIsCodeJoining(true);
    setCodeJoinError(null);
    try {
      const res = await api.post('/api/rooms/join', { roomCode: code });
      const room = res.data.room;
      navigate(`/room/${room.id}/lobby`, { state: { room } });
    } catch (err: any) {
      setCodeJoinError(err?.response?.data?.message || 'Mã phòng không hợp lệ hoặc phòng đã đầy');
      setIsCodeJoining(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; rooms: PublicRoom[] }>({
    queryKey: ['public-rooms'],
    queryFn: () => api.get('/api/rooms/public').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (!isAuthenticated) return null;

  const allRooms = data?.rooms ?? [];

  const sorted = [...allRooms].sort((a, b) => {
    if (sort === 'filling') {
      const fillA = a.currentPlayers / a.maxPlayers;
      const fillB = b.currentPlayers / b.maxPlayers;
      return fillB - fillA;
    }
    if (sort === 'difficulty') {
      const order: Record<RoomDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2, MIXED: 3 };
      return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3);
    }
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const waitingCount = allRooms.filter((r) => r.status === 'LOBBY').length;
  const playingCount = allRooms.filter((r) => r.status === 'IN_PROGRESS').length;
  const liveCount = waitingCount + playingCount;

  const removeFilter = (id: string) => setActiveFilters((prev) => prev.filter((f) => f.id !== id));

  return (
    <div data-testid="multiplayer-page" className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(232,168,50,0.15)' }}
          >
            <span className="text-lg">⚔️</span>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-wider mb-0.5" style={{ color: 'rgba(232,168,50,0.7)', letterSpacing: '0.05em' }}>
              {t('multiplayer.subtitle', 'CHẾ ĐỘ ĐA NGƯỜI CHƠI')}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{t('multiplayer.title', 'Phòng chơi')}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {t('multiplayer.desc', '4 chế độ · Realtime')}
              {liveCount > 0 && <span className="ml-2" style={{ color: '#97C459' }}>· {liveCount} phòng đang sống</span>}
            </p>
          </div>
        </div>
        <button
          data-testid="multiplayer-create-btn"
          onClick={() => navigate('/room/create')}
          className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold shadow-md transition-all hover:opacity-90"
          style={{ background: '#e8a832', color: '#412d00', boxShadow: '0 0 20px rgba(232,168,50,0.25)' }}
        >
          <span className="material-symbols-outlined text-sm" style={FILL_1}>add_circle</span>
          {t('multiplayer.createRoom', 'Tạo phòng mới')}
        </button>
      </div>

      {/* ── Join by code + Featured event ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
        {/* Join by code */}
        <div
          className="p-5 rounded-2xl flex flex-col gap-3"
          style={{
            background: 'rgba(50,52,64,0.4)',
            border: '0.5px solid rgba(232,168,50,0.2)',
            borderLeft: '3px solid #e8a832',
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>🔑</span>
              <span className="text-white text-sm font-semibold">{t('multiplayer.joinByCode', 'Tham gia bằng mã')}</span>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {t('multiplayer.joinByCodeDesc', 'Có mã 6 ký tự từ bạn bè? Vào ngay không cần tìm')}
            </p>
          </div>
          <CodeInput onJoin={handleJoinByCode} disabled={isCodeJoining} />
          {codeJoinError && (
            <div className="mt-2 text-[11px] px-2 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
              ⚠ {codeJoinError}
            </div>
          )}
        </div>

        {/* Featured event */}
        <div
          className="p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(50,52,64,0.4))',
            border: '0.5px solid rgba(168,85,247,0.3)',
          }}
        >
          <div className="absolute -top-3 -right-3 opacity-[0.15] text-7xl pointer-events-none select-none">✨</div>
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold mb-2"
            style={{
              background: 'rgba(168,85,247,0.25)',
              color: '#c084fc',
              border: '0.5px solid rgba(168,85,247,0.4)',
              letterSpacing: '0.04em',
            }}
          >
            ⭐ {t('multiplayer.featuredToday', 'ĐẶC BIỆT HÔM NAY')}
          </span>
          <h4 className="text-sm font-semibold leading-tight mb-1 text-white">{t('multiplayer.featuredTitle', 'Giải đố Sáng Thế Ký')}</h4>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('multiplayer.featuredHost', 'cùng Mục sư Hùng dẫn dắt')}</p>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              ⏰ {t('multiplayer.featuredTime', '14:00 chiều nay')}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              👥 47 {t('multiplayer.registered', 'đăng ký')}
            </span>
          </div>
          <button
            className="text-xs font-semibold py-2 px-3 rounded-lg w-full transition-all"
            style={{
              background: 'rgba(168,85,247,0.2)',
              color: '#c084fc',
              border: '0.5px solid rgba(168,85,247,0.5)',
            }}
          >
            {t('multiplayer.register', 'Đăng ký tham gia →')}
          </button>
        </div>
      </div>

      {/* ── Room list header: title + live badge + toolbar ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-white text-base font-bold">{t('multiplayer.waitingRooms', 'Phòng đang chờ')}</span>
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(99,153,34,0.15)', color: '#97C459', border: '0.5px solid rgba(99,153,34,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#97C459', boxShadow: '0 0 5px #97C459' }} />
              LIVE {liveCount}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={t('multiplayer.refresh', 'Làm mới')}
              aria-label={t('multiplayer.refresh', 'Làm mới danh sách phòng')}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <span className={`material-symbols-outlined text-[18px] ${isFetching ? 'animate-spin' : ''}`}>refresh</span>
            </button>

            {/* Sort tabs */}
            <div
              className="inline-flex rounded-lg p-0.5"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              {([['newest', 'Mới nhất'], ['filling', 'Sắp đầy'], ['difficulty', 'Theo khó']] as [SortOption, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSort(val)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                  style={sort === val
                    ? { background: '#e8a832', color: '#412d00' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.5)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filter */}
            <button
              title={t('multiplayer.filter', 'Lọc phòng')}
              aria-label={t('multiplayer.filter', 'Lọc phòng theo điều kiện')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              {t('multiplayer.filterBtn', 'Lọc')}
              {activeFilters.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: '#e8a832', color: '#412d00' }}
                >
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Search */}
            <button
              title={t('multiplayer.search', 'Tìm kiếm')}
              aria-label={t('multiplayer.search', 'Tìm phòng theo tên')}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {activeFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => removeFilter(f.id)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={{ background: 'rgba(232,168,50,0.12)', color: '#e8a832', border: '0.5px solid rgba(232,168,50,0.35)' }}
              >
                {f.label} <span className="text-[10px]">×</span>
              </button>
            ))}
            <button
              onClick={() => setActiveFilters([])}
              className="text-[11px] px-2 py-1 transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none' }}
            >
              Xoá tất cả
            </button>
          </div>
        )}
      </div>

      {/* ── Room list ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-52 rounded-xl animate-pulse"
              style={{ background: 'rgba(50,52,64,0.3)' }}
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-3xl"
          style={{ background: 'rgba(50,52,64,0.2)', border: '2px dashed rgba(255,255,255,0.08)' }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(50,52,64,0.6)' }}
          >
            <span className="material-symbols-outlined text-4xl" style={{ color: 'rgba(255,255,255,0.25)' }}>sentiment_dissatisfied</span>
          </div>
          <h5 className="text-lg font-bold text-white mb-2">{t('multiplayer.emptyTitle', 'Chưa có phòng nào đang chờ')}</h5>
          <p className="text-sm text-center max-w-xs mb-7" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {t('multiplayer.emptyDesc', 'Bạn là người tiên phong! Tạo phòng đầu tiên và mời anh chị em cùng chơi.')}
          </p>
          <button
            onClick={() => navigate('/room/create')}
            className="py-3 px-8 rounded-xl font-bold text-sm shadow-lg transition-all hover:opacity-90"
            style={{ background: '#e8a832', color: '#412d00' }}
          >
            {t('multiplayer.createRoomNow', '+ Tạo phòng đầu tiên')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sorted.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>

          {allRooms.length > sorted.length && (
            <div className="text-center mt-2">
              <button
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', border: '0.5px solid rgba(255,255,255,0.1)' }}
              >
                {t('multiplayer.loadMore', `Xem thêm ${allRooms.length - sorted.length} phòng →`)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Multiplayer;
