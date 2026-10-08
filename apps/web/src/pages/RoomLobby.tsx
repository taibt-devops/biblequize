import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRoomChannel } from '../hooks/useRoomChannel';
import { api } from '../api/client';
import { QRCodeSVG } from 'qrcode.react';
import { soundManager } from '../services/soundManager';
import { haptic } from '../utils/haptics';
import SequentialLobbyView from './room/SequentialLobbyView';
import InviteShareModal from '../components/room/InviteShareModal';
import { ChatPanel, ChatDrawer, type ChatMessage } from '../components/multiplayer/RoomChat';
import { useRoomChatStore, selectRoomMessages } from '../store/roomChatStore';
import { useRoomChatHistory } from '../hooks/useRoomChatHistory';
import { PlaceBackdrop, Plaque } from '../components/lk/Place'
import { PlayerCrest } from '../components/lk/PlayerCrest'
import { TIERS } from '../data/tiers'
import type { RoomDetails, RoomEvent, RoomPlayer } from '../types/room';

// Canonical shapes moved to src/types/room.ts (FMR-1) — local aliases keep
// the page body unchanged.
type Player = RoomPlayer;
type ActivityTone = 'info' | 'ok' | 'warn';
type ActivityEntry = { text: string; time: string; tone: ActivityTone };

type ModeInfo = {
  label: string; icon: string;
  ruleTitle: string; ruleText: string; ruleDetail?: string;
  chipColor: string; chipBg: string; chipBorder: string;
};

const MODE_INFO: Record<string, ModeInfo> = {
  SPEED_RACE: {
    label: 'Speed Race', icon: 'bolt',
    ruleTitle: 'Luật Speed Race',
    ruleText: 'Trả lời nhanh + đúng để ghi điểm cao nhất.',
    ruleDetail: 'Tốc độ + chính xác cùng quyết định thứ hạng. Ai trả lời nhanh hơn và đúng hơn sẽ giành điểm cao nhất.',
    chipColor: 'var(--bq-amber-deep)', chipBg: 'color-mix(in srgb, var(--bq-amber) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-amber) 40%, transparent)',
  },
  BATTLE_ROYALE: {
    label: 'Battle Royale', icon: 'favorite',
    ruleTitle: 'Luật Battle Royale',
    ruleText: 'Sai = Loại. Người đúng cuối cùng thắng.',
    ruleDetail: 'Mỗi câu sai sẽ bị loại khỏi vòng tiếp theo. Tối đa 30 câu/trận. Khi cả nhóm cùng sai 1 câu, không ai bị loại.',
    chipColor: 'var(--bq-ruby)', chipBg: 'color-mix(in srgb, var(--bq-ruby) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-ruby) 40%, transparent)',
  },
  TEAM_VS_TEAM: {
    label: 'Team vs Team', icon: 'groups_2',
    ruleTitle: 'Luật Team vs Team',
    ruleText: 'Hai đội cạnh tranh — đội nhiều điểm hơn thắng.',
    ruleDetail: 'Hai đội cạnh tranh nhau. Đội nào ghi nhiều điểm hơn sau tất cả câu hỏi sẽ thắng. Phối hợp với đồng đội!',
    chipColor: 'var(--bq-sapphire)', chipBg: 'color-mix(in srgb, var(--bq-sapphire) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-sapphire) 40%, transparent)',
  },
  SUDDEN_DEATH: {
    label: 'Đấu vương', icon: 'swords',
    ruleTitle: 'Luật Đấu vương',
    ruleText: 'Sai một câu là thua. Hai người đấu tay đôi.',
    ruleDetail: 'Chỉ 2 người đấu cùng lúc. Sai 1 câu là thua. Người chiến thắng sẽ đấu tiếp người tiếp theo trong hàng đợi.',
    chipColor: 'var(--bq-ember)', chipBg: 'color-mix(in srgb, var(--bq-ember) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-ember) 40%, transparent)',
  },
  GROUP_LIVE_SEQUENTIAL: {
    label: 'Chơi cùng nhau', icon: 'group',
    ruleTitle: 'Luật Chơi cùng nhau',
    ruleText: 'Mọi người trả lời tuần tự — chờ tất cả xong mới hiện đáp án.',
    chipColor: 'var(--bq-emerald)', chipBg: 'color-mix(in srgb, var(--bq-emerald) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-emerald) 40%, transparent)',
  },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó', MIXED: 'Hỗn hợp',
};

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
  const initialViewerUserId: string | null = location.state?.viewerUserId ?? null;
  const [room, setRoom] = useState<RoomDetails | null>(initialRoom ?? null);
  // viewerUserId is per-viewer context, NOT part of the room snapshot — kept
  // separate so WS ROOM_STATE broadcasts (which carry no viewer identity)
  // can't overwrite it. Sourced from the REST wrapper.
  const [viewerUserId, setViewerUserId] = useState<string | null>(initialViewerUserId);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [switchingTeam, setSwitchingTeam] = useState(false);
  // MPC-7: chat history lives in the shared store (survives reload via the
  // server replay below + Lobby→Quiz→Results navigation).
  const chatMessages = useRoomChatStore(selectRoomMessages(roomId));
  const [activity, setActivity] = useState<ActivityEntry[]>([
    { text: 'Phòng được tạo', time: nowTime(), tone: 'info' },
  ]);
  const appendActivity = (text: string, tone: ActivityTone = 'info') =>
    setActivity(prev => [...prev, { text, time: nowTime(), tone }]);
  const [chatInput, setChatInput] = useState('');
  const appendChatToStore = useRoomChatStore(s => s.appendMessage);
  // MPC-7: replay server-persisted chat on mount/reload.
  useRoomChatHistory(roomId, room?.hostName);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [showRulesDetail, setShowRulesDetail] = useState(false);
  const [kickMenuFor, setKickMenuFor] = useState<string | null>(null);
  const [heroCopied, setHeroCopied] = useState<'code' | 'link' | null>(null);
  const copyToClipboard = async (kind: 'code' | 'link', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setHeroCopied(kind);
      setTimeout(() => setHeroCopied(null), 1500);
    } catch { /* ignore */ }
  };

  // FMR-2: typed room channel (events narrowed via the RoomEvent union).
  const { connected, reconnecting, send } = useRoomChannel(roomId, {
    onReconnect: () => { fetchRoom(); },
    onEvent: (msg: RoomEvent) => {
      switch (msg.type) {
        case 'ROOM_STATE': {
          // Sprint 2 S2-8: atomic snapshot from BE. Use it instead of the
          // per-event fetchRoom REST round-trips that used to flicker the
          // player list with multi-join races.
          setRoom(msg.data);
          break;
        }
        case 'PLAYER_KICKED': {
          const d = msg.data;
          if (d?.userId && d.userId === viewerUserId) {
            navigate('/multiplayer', { replace: true, state: { kickedFromRoom: true } });
            return;
          }
          if (d?.userId) {
            const name = room?.players?.find(p => p.userId === d.userId)?.username ?? 'Người chơi';
            appendActivity(`${name} đã bị kick`, 'warn');
          }
          // ROOM_STATE will follow with the post-kick snapshot.
          break;
        }
        case 'PLAYER_JOINED': {
          const d = msg.data;
          if (d?.username) appendActivity(`${d.username} đã tham gia 👋`);
          // S2-9 hook: subtle audio cue when someone enters the lobby.
          soundManager.play('playerJoin');
          // ROOM_STATE will follow with the new player list.
          break;
        }
        case 'PLAYER_LEFT': {
          const d = msg.data;
          if (d?.userId) {
            const name = room?.players?.find(p => p.userId === d.userId)?.username ?? 'Người chơi';
            appendActivity(`${name} đã rời phòng`);
          }
          // ROOM_STATE will follow.
          break;
        }
        case 'PLAYER_READY': {
          const d = msg.data;
          if (d?.username) appendActivity(`${d.username} sẵn sàng ✓`, 'ok');
          // ROOM_STATE will follow.
          break;
        }
        case 'PLAYER_UNREADY': {
          const d = msg.data;
          if (d?.username) appendActivity(`${d.username} hủy sẵn sàng`);
          // ROOM_STATE will follow.
          break;
        }
        case 'CHAT_MESSAGE': {
          const d = msg.data;
          const chatMsg: ChatMessage = {
            sender: d.sender, text: d.text,
            isHost: d.sender === room?.hostName,
            isSystem: d.isSystem === true,
            time: nowTime(),
          };
          // MPC-3/7: store is the single source of truth for room chat; the
          // results screen (RoomQuiz, separate tree) replays the same history.
          if (roomId) appendChatToStore(roomId, chatMsg);
          if (isMobile && !chatOpen && !d.isSystem) setUnreadChat(c => c + 1);
          break;
        }
        case 'GAME_STARTING': {
          // Sprint 2 S2-4: cinematic countdown. Just seed the state — the
          // overlay's own useEffect ticks it down per second with sound +
          // haptic, then navigates after the "BẮT ĐẦU!" beat.
          setCountdown(msg.data.countdown);
          break;
        }
        case 'QUESTION_START': {
          const navState = location.state as { fromGroupId?: string } | null;
          const fromGroupId = navState?.fromGroupId ?? room?.groupId ?? undefined;
          // Sprint 4: Quản trò goes to the host spectator route; players go to /quiz.
          const dest = isOrganizerMode ? `/room/${roomId}/host` : `/room/${roomId}/quiz`;
          navigate(dest, {
            replace: true,
            state: { mode: room?.mode, myTeam: room?.players?.find(p => p.userId === viewerUserId)?.team ?? null, isHost, hostId: room?.hostId, viewerUserId, hostName: room?.hostName, hostPlaysGame, fromGroupId, groupQuizSetName: room?.groupQuizSetName ?? null, quizSetTotalQuestions: room?.quizSetTotalQuestions ?? null }
          });
          break;
        }
        case 'QUIZ_END':
          fetchRoom();
          break;
        case 'ROOM_ENDED': {
          // SPEC §5.4.0 R1/R2/R5 — backend cleanup forced the room to end.
          // Stash the reason in nav state so /multiplayer can toast it.
          navigate('/multiplayer', { replace: true, state: { roomEndedReason: msg.data?.reason ?? 'GENERIC' } });
          break;
        }
        case 'HOST_CHANGED': {
          // SPEC §5.4.0 R4 — old host's grace expired; backend promoted
          // a successor. Refetch room details so the crown + start
          // button move to the new host.
          const d = msg.data;
          if (d?.newHostName) {
            appendActivity(`${d.newHostName} đã trở thành chủ phòng mới`, 'ok');
          }
          fetchRoom();
          break;
        }
      }
    },
  });

  const fetchRoom = async () => {
    if (!roomId) return;
    try {
      const res = await api.get(`/api/rooms/${roomId}`);
      if (res.data.success) {
        setRoom(res.data.room);
        if (res.data.viewerUserId) setViewerUserId(res.data.viewerUserId);
      }
      else setError(res.data.message || t('room.errorFetchRoom'));
    } catch {
      setError(t('room.errorNetwork'));
    }
  };

  useEffect(() => { fetchRoom(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Reset desktop unread when chat is visible (always on desktop); mobile resets when drawer opens.
  useEffect(() => {
    if (!isMobile) setUnreadChat(0);
    else if (chatOpen) setUnreadChat(0);
  }, [chatOpen, isMobile]);

  // Sprint 2 S2-4: Cinematic countdown effect. Once GAME_STARTING seeds
  // `countdown` we tick down per second with sound + haptic, render
  // "BẮT ĐẦU!" at zero with the gameStart flourish, and navigate ~800ms
  // later so the moment lands before the quiz UI appears.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      // Per-tick beats: louder warning beep on the last second.
      soundManager.play(countdown === 1 ? 'timerWarning' : 'timerTick');
      haptic.tap();
      const t = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
      return () => clearTimeout(t);
    }
    // countdown === 0 → the "BẮT ĐẦU!" beat
    soundManager.play('gameStart');
    haptic.combo();
    const myTeam = room?.players?.find(p => p.userId === viewerUserId)?.team ?? null;
    const navState = location.state as { fromGroupId?: string } | null;
    const fromGroupId = navState?.fromGroupId ?? room?.groupId ?? undefined;
    const t = setTimeout(() => {
      const dest = isOrganizerMode ? `/room/${roomId}/host` : `/room/${roomId}/quiz`;
      navigate(dest, {
        replace: true,
        state: { mode: room?.mode, myTeam, isHost, hostId: room?.hostId, viewerUserId, hostName: room?.hostName, hostPlaysGame, fromGroupId, groupQuizSetName: room?.groupQuizSetName ?? null, quizSetTotalQuestions: room?.quizSetTotalQuestions ?? null },
      });
    }, 800);
    return () => clearTimeout(t);
    // isHost / room can change underneath but the countdown is short
    // enough that capturing them on first mount is fine; ESLint
    // dependency exhaustive disabled intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Close kick menu on outside click
  useEffect(() => {
    if (!kickMenuFor) return;
    const onDoc = () => setKickMenuFor(null);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [kickMenuFor]);

  // Throttle 600ms — WS round-trip is ~200-500ms so a fast double-click
  // would otherwise toggle ready twice and confuse the lobby state.
  const togglingReadyRef = useRef(false);
  const handleToggleReady = () => {
    if (!roomId || togglingReadyRef.current) return;
    togglingReadyRef.current = true;
    haptic.tap(); // Sprint 2 S2-10 — subtle tap on ready toggle.
    const delivered = send(`/app/room/${roomId}/ready`, {});
    if (!delivered) {
      // WS still (re)connecting — surface it instead of swallowing the click;
      // a tap after the connection indicator turns green will go through.
      appendActivity('Chưa kết nối được tới phòng — thử lại sau giây lát', 'warn');
    }
    setTimeout(() => { togglingReadyRef.current = false; }, 600);
  };
  const handleStart = async () => {
    if (!roomId) return;
    try {
      await api.post(`/api/rooms/${roomId}/start`);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('room.errorStartRoom'));
    }
  };
  const handleSwitchTeam = async () => {
    if (!roomId) return;
    setSwitchingTeam(true);
    try {
      const res = await api.post(`/api/rooms/${roomId}/switch-team`);
      if (res.data.success) {
        setRoom(res.data.room);
        if (res.data.viewerUserId) setViewerUserId(res.data.viewerUserId);
      }
    } catch { setError(t('room.errorSwitchTeam')); }
    finally { setSwitchingTeam(false); }
  };
  const handleSendChat = (text: string) => {
    if (!text.trim() || !roomId) return;
    send(`/app/room/${roomId}/chat`, { text: text.trim() });
    setChatInput('');
  };
  const handleLeave = async () => {
    if (roomId) { try { await api.post(`/api/rooms/${roomId}/leave`); } catch { /* ignore */ } }
    // Prefer the explicit fromGroupId nav state (set when entering via the
    // group's "Chơi cùng nhau" flow); fall back to room.groupId for direct
    // co-play deep-links so leader returns to the group page they came from.
    // Standalone /multiplayer rooms (no group affiliation) go back to /multiplayer.
    const navState = location.state as { fromGroupId?: string } | null;
    const fromGroupId = navState?.fromGroupId ?? room?.groupId ?? undefined;
    navigate(fromGroupId ? `/groups/${fromGroupId}` : '/multiplayer');
  };
  const handleKick = async (userId: string) => {
    if (!roomId) return;
    setKickMenuFor(null);
    try {
      await api.post(`/api/rooms/${roomId}/kick`, { userId });
      fetchRoom();
    } catch { /* server emits PLAYER_KICKED on success */ }
  };

  const isTeamVsTeam = room?.mode === 'TEAM_VS_TEAM';
  const isSuddenDeath = room?.mode === 'SUDDEN_DEATH';
  const isSequential = room?.mode === 'GROUP_LIVE_SEQUENTIAL';
  const teamAPlayers = room?.players?.filter(p => p.team === 'A') ?? [];
  const teamBPlayers = room?.players?.filter(p => p.team === 'B') ?? [];
  // FMR-7 identity sweep: match by server-stable userId only (F-web-2) —
  // localStorage.userName can drift/collide so it is no longer a logic key.
  // Until fetchRoom delivers viewerUserId, myPlayer stays undefined.
  const myPlayer = viewerUserId
    ? room?.players?.find(p => p.userId === viewerUserId)
    : undefined;
  // Sprint 4: in Quản trò mode the host is NOT a RoomPlayer, so myPlayer
  // would be undefined for them. Fall back to comparing against viewerUserId
  // so the host still resolves as host in the lobby UI.
  const hostPlaysGame = room?.hostPlaysGame !== false; // defaults true (legacy)
  const isQuickMatch = !!room?.quickMatch;
  const isHost = (myPlayer?.userId === room?.hostId)
      || (!hostPlaysGame && viewerUserId != null && viewerUserId === room?.hostId);
  const isOrganizerMode = isHost && !hostPlaysGame;
  const emptySlots = room ? Math.max(0, room.maxPlayers - room.currentPlayers) : 0;
  const modeInfo = MODE_INFO[room?.mode ?? ''] ?? {
    label: room?.mode ?? '', icon: 'sports_esports',
    ruleTitle: 'Luật chơi', ruleText: '', ruleDetail: '',
    chipColor: 'var(--bq-amber-deep)', chipBg: 'color-mix(in srgb, var(--bq-amber) 15%, transparent)', chipBorder: 'color-mix(in srgb, var(--bq-amber) 40%, transparent)',
  };

  const nonHostPlayers = useMemo(() => room?.players?.filter(p => p.userId !== room?.hostId) ?? [], [room]);
  const readyNonHostCount = useMemo(() => nonHostPlayers.filter(p => p.isReady).length, [nonHostPlayers]);
  const isGroupLive = room?.mode === 'GROUP_LIVE_SEQUENTIAL';
  // Sprint 4: Quan Tro mode requires ≥2 non-host players (host doesn't play);
  // legacy mode keeps ≥1 non-host (host + 1 = 2 total).
  const minNonHost = !hostPlaysGame ? 2 : 1;
  // QP-10: Quick Match has no Quản trò; require ≥2 ready players
  // (host displayed as auto-ready via PlayerSlot) instead of host-driven start.
  const quickMatchReadyCount = useMemo(
    () => room?.players?.filter(p => p.isReady || p.userId === room?.hostId).length ?? 0,
    [room],
  );
  const canStart = room?.status === 'LOBBY' && (
    isQuickMatch
      ? quickMatchReadyCount >= 2
      : nonHostPlayers.length >= minNonHost
        && (isGroupLive || readyNonHostCount === nonHostPlayers.length)
  );

  const statusPrimary = (() => {
    if (!room) return '';
    if (room.currentPlayers < 2) return 'Đang chờ thêm người chơi...';
    if (isGroupLive) return 'Sẵn sàng bắt đầu';
    if (readyNonHostCount < nonHostPlayers.length) return 'Đang chờ tất cả sẵn sàng';
    return 'Đủ người · Có thể bắt đầu';
  })();
  const statusSecondary = (() => {
    if (!room) return '';
    const need = Math.max(0, 2 - room.currentPlayers);
    if (room.currentPlayers < 2) return `Cần thêm ${need} người để bắt đầu`;
    if (isGroupLive) return `${room.currentPlayers}/${room.maxPlayers} người · Trưởng nhóm có thể bắt đầu`;
    if (readyNonHostCount < nonHostPlayers.length) return `${readyNonHostCount}/${nonHostPlayers.length} người chơi đã sẵn sàng`;
    return `${room.currentPlayers}/${room.maxPlayers} người · Có thể bắt đầu`;
  })();

  /* ── BẮT ĐẦU! countdown overlay (per MOCKUP_GAME_START_CEREMONY states c5/c3/c1/go) ── */
  if (countdown !== null) {
    const orderedForOverlay = room
      ? [
          ...(room.players?.filter(p => p.userId === room.hostId) ?? []),
          ...(room.players?.filter(p => p.userId !== room.hostId) ?? []),
        ].slice(0, 6)
      : [];
    const modeLabel = MODE_INFO[room?.mode ?? '']?.label ?? room?.mode ?? '';
    const isGo = countdown === 0;
    return (
      <div
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{
          // GO! state: brighter amber radiating; ticking states: dimmer.
          background: isGo
            ? 'radial-gradient(circle at center, rgba(245,158,11,0.45) 0%, rgba(255,224,138,0.35) 35%, var(--bq-paper) 75%)'
            : 'radial-gradient(circle at center, rgba(255,224,138,0.40) 0%, var(--bq-paper) 70%)',
          fontFamily: "'Be Vietnam Pro', sans-serif",
          transition: 'background 200ms ease-out',
        }}
        data-testid="lobby-countdown"
      >
        {/* Header label flips between "BẮT ĐẦU TRONG" while ticking and
            an empty placeholder during the GO! beat (the slammed text
            owns the screen). */}
        {!isGo && (
          <div
            className="text-[12.5px] lg:text-sm font-bold mb-6 lg:mb-8 fade-in"
            style={{ color: 'var(--bq-amber-deep)', letterSpacing: '0.4em' }}
          >
            BẮT ĐẦU TRONG
          </div>
        )}

        {/* Number circle (ticking) OR slammed text (GO) */}
        {isGo ? (
          <div
            data-testid="lobby-countdown-go"
            className="text-center go-slam"
            style={{
              fontSize: 'clamp(72px, 18vw, 192px)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: '#1D2B22',
              textShadow: '0 0.06em 0 #FFC93C',
              filter: 'drop-shadow(0 8px 40px rgba(179,69,47,0.35))',
            }}
          >
            BẮT ĐẦU!
          </div>
        ) : (
          <div className="relative" data-testid={`lobby-countdown-${countdown}`}>
            {/* Pulsing amber ring sized 8px outside the circle */}
            <div
              className="absolute -inset-2 rounded-full pointer-events-none"
              style={{
                border: '2px solid var(--bq-amber-deep)',
                animation: 'countdownRingPulse 1s ease-in-out infinite',
              }}
              aria-hidden="true"
            />
            {/* Light card circle wrapper */}
            <div
              className="grid place-items-center rounded-full"
              style={{
                width: 'clamp(180px, 32vw, 240px)',
                height: 'clamp(180px, 32vw, 240px)',
                background: 'var(--bq-white)',
                border: '1px solid color-mix(in srgb, var(--bq-amber) 30%, transparent)',
                boxShadow: '0 0 60px rgba(245,158,11,0.25), var(--bq-shadow-soft)',
              }}
            >
              <div
                key={countdown}
                style={{
                  fontSize: 'clamp(96px, 14vw, 160px)',
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: '#1D2B22',
                  textShadow: '0 0.06em 0 #FFC93C',
                  animation: 'countdownNumberPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                {countdown}
              </div>
            </div>
          </div>
        )}

        {/* Mode chip (under the circle) — only on ticking states */}
        {!isGo && modeLabel && (
          <div
            className="mt-8 lg:mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-full fade-in bg-bq-white border border-bq-hair shadow-bq-soft"
          >
            <span className="text-base">{modeInfo.icon === 'bolt' ? '⚡' : modeInfo.icon === 'favorite' ? '❤️' : modeInfo.icon === 'groups_2' ? '👥' : '👑'}</span>
            <span className="text-sm font-semibold text-bq-ink">
              {modeLabel}{room?.questionCount ? ` · ${room.questionCount} câu` : ''}
            </span>
          </div>
        )}
        {isGo && (
          <div className="mt-6 lg:mt-8 text-base lg:text-xl font-semibold fade-in text-bq-ink2" style={{ animationDelay: '0.4s' }}>
            Câu hỏi đầu tiên đang đến...
          </div>
        )}
        {orderedForOverlay.length > 0 && (
          <div
            className="mt-6 lg:mt-8 flex items-center justify-center fade-in"
            style={{ animationDelay: isGo ? '0.6s' : '0.2s' }}
          >
            <div className="flex items-center">
              {orderedForOverlay.map((p, i) => (
                <div
                  key={p.id}
                  className="grid place-items-center rounded-full font-bold flex-shrink-0"
                  style={{
                    width: 36, height: 36,
                    fontSize: 13,
                    marginLeft: i === 0 ? 0 : -8,
                    background: i === 0
                      ? 'linear-gradient(135deg, var(--bq-amber-lt) 0%, var(--bq-amber-deep) 100%)'
                      : i === 1
                      ? 'linear-gradient(135deg, var(--bq-emerald-lt) 0%, var(--bq-emerald) 100%)'
                      : 'linear-gradient(135deg, var(--bq-sapphire-lt) 0%, var(--bq-sapphire) 100%)',
                    color: i === 0 ? 'var(--bq-ink)' : '#fff',
                    border: '2px solid var(--bq-paper)',
                    zIndex: orderedForOverlay.length - i,
                  }}
                  aria-hidden="true"
                >
                  {p.username?.[0]?.toUpperCase() ?? '?'}
                </div>
              ))}
            </div>
            <span className="ml-3 text-xs lg:text-sm font-semibold text-bq-ink2">
              {room?.currentPlayers ?? 0} người chơi
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ── Sequential mode lobby (Feature A "Chơi cùng nhau") ── */
  if (isSequential && room) {
    return (
      <SequentialLobbyView
        roomCode={room.roomCode}
        roomName={room.roomName}
        questionCount={room.questionCount}
        timePerQuestion={room.timePerQuestion}
        maxPlayers={room.maxPlayers}
        players={room.players ?? []}
        hostId={room.hostId}
        isHost={isHost}
        onStart={handleStart}
        onLeave={handleLeave}
        connected={connected}
        reconnecting={reconnecting}
        error={error}
      />
    );
  }

  /* ── Error state ── */
  if (error) return (
    <div className="min-h-screen bg-bq-paper flex items-center justify-center">
      <div className="text-center space-y-4">
        <span className="material-symbols-outlined text-bq-ruby text-5xl">error</span>
        <p className="text-bq-ruby text-lg">{error}</p>
        <button onClick={() => navigate('/multiplayer')} className="text-bq-amberd underline text-sm">{t('common.back')}</button>
      </div>
    </div>
  );

  /* ── Loading state ── */
  if (!room) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <PlaceBackdrop place="square" veil="strong" />
      <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-16 animate-pulse" />
      <p className="text-bq-ink2 font-bold text-lg">{t('room.loadingRoom')}</p>
    </div>
  );

  // ─── Build the slot list (host first, others, then invite slot, then empty padding) ───
  const orderedPlayers: Player[] = [
    ...(room.players?.filter(p => p.userId === room.hostId) ?? []),
    ...(room.players?.filter(p => p.userId !== room.hostId) ?? []),
  ];

  // Desktop: chat panel is always visible per mockup. Mobile: drawer toggle (chatOpen).
  const showChatPanel = !isMobile;

  return (
    <div
      className="min-h-screen flex flex-col text-bq-ink"
    >
      <PlaceBackdrop place="square" veil="strong" />
      {reconnecting && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-bq-ruby/10 text-bq-ruby text-center py-2 text-sm font-medium border-b border-bq-ruby/20">
          <span className="material-symbols-outlined text-sm align-middle mr-1">wifi_off</span>
          {t('room.reconnecting')}
        </div>
      )}

      {/* ─── Topbar ─── */}
      <header
        className="flex items-center justify-between gap-3 px-4 lg:px-6 py-2.5 border-b-[3px] bg-bq-white border-bq-ink"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/multiplayer')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-bq-ink bg-bq-white text-[13.5px] font-bold text-bq-ink hover:bg-bq-cream flex-shrink-0"
            data-testid="lobby-back-btn"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">Đa người chơi</span>
          </button>
          <div className="hidden sm:block h-5 w-px bg-bq-hair" />
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-extrabold flex-shrink-0"
            style={{ color: modeInfo.chipColor, background: modeInfo.chipBg, border: `1px solid ${modeInfo.chipBorder}` }}
            data-testid="lobby-topbar-mode"
          >
            <span className="material-symbols-outlined text-[12px]">{modeInfo.icon}</span>
            {modeInfo.label}
          </span>
          {room.groupQuizSetName && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 max-w-[180px] truncate"
              style={{
                color: 'var(--bq-amber-deep)',
                background: 'color-mix(in srgb, var(--bq-amber) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--bq-amber) 30%, transparent)',
              }}
              data-testid="lobby-topbar-quizset"
              title={room.groupQuizSetName}
            >
              <span className="material-symbols-outlined text-[12px]">menu_book</span>
              <span className="truncate">{room.groupQuizSetName}</span>
            </span>
          )}
          <span className="text-[13px] font-display font-bold tracking-[0.08em] truncate text-bq-ink2" style={{ fontVariantNumeric: 'tabular-nums' }} data-testid="lobby-topbar-code">
            Phòng {room.roomCode}
          </span>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-bq-ink2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: connected ? 'var(--bq-emerald)' : 'var(--bq-ruby)' }}
            />
            {connected ? 'Đã kết nối' : 'Mất kết nối'}
          </div>
          <button
            onClick={handleLeave}
            data-testid="lobby-leave-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13.5px] font-extrabold bg-bq-white text-bq-ruby border-2 border-bq-ruby hover:bg-bq-ruby/10"
          >
            <span className="material-symbols-outlined text-[14px]">logout</span>
            <span className="hidden sm:inline">Rời phòng</span>
          </button>
        </div>
      </header>

      {/* ─── Main: activity log + content + (optional) chat panel ─── */}
      <div className="flex-1 grid lg:grid-cols-[280px_1fr_320px] overflow-hidden" style={{ minHeight: 0 }}>
        <ActivityLogPanel entries={activity} statusHint={statusSecondary} />
        <div className="overflow-y-auto px-4 lg:px-7 py-4 lg:py-5 pb-24 lg:pb-5" data-testid="lobby-scroll-content">

          {/* ─── QP-10: Quick Match indigo banner (no Quản trò) ─── */}
          {isQuickMatch && (
            <div
              className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3 bg-bq-leaf/60 border-[3px] border-bq-ink"
              data-testid="lobby-quickmatch-banner"
            >
              <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-7 flex-shrink-0" />
              <div className="text-[14px] leading-relaxed text-bq-ink2">
                <span className="font-extrabold text-bq-ink">Đấu Nhanh — Không có Quản trò.</span>{' '}
                Bất kỳ ai cũng có thể bấm <strong>Bắt đầu</strong> khi đủ 2 người sẵn sàng.
              </div>
            </div>
          )}

          {/* ─── Sprint 4: Quản trò badge / host info card ─── */}
          {!isQuickMatch && isOrganizerMode && (
            <div
              className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3 bg-bq-cream border-[3px] border-bq-ink"
              data-testid="lobby-organizer-badge"
            >
              <span className="text-xl flex-shrink-0">👑</span>
              <div className="text-[14px] leading-relaxed text-bq-ink2">
                <span className="font-extrabold text-bq-ink">Bạn là Quản trò.</span>{' '}
                Bạn điều phối trận đấu, không trả lời câu hỏi để đảm bảo công bằng cho người chơi.
              </div>
            </div>
          )}
          {!isQuickMatch && !isOrganizerMode && !hostPlaysGame && room.hostName && (
            <div
              className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 bg-bq-white border-[3px] border-bq-ink"
              data-testid="lobby-host-info-card"
            >
              <div
                className="w-10 h-10 rounded-full grid place-items-center font-bold text-base flex-shrink-0 text-bq-ink"
                style={{
                  background: 'linear-gradient(135deg, var(--bq-amber-lt), var(--bq-amber-deep))',
                }}
              >
                {room.hostName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-bq-ink2">
                  👑 Quản trò
                </div>
                <div className="text-sm font-bold text-bq-ink truncate">{room.hostName}</div>
              </div>
              <span className="text-[10px] flex-shrink-0 text-bq-ink2">Không chơi</span>
            </div>
          )}

          {/* ─── HERO BLOCK ─── */}
          <section
            className="relative rounded-bq p-4 lg:p-6 mb-5 bg-bq-white border-[3px] border-bq-ink shadow-bq-card"
            data-testid="lobby-hero"
          >
            <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-6 items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {room.roomName && (
                    <span className="font-display text-[18px] font-extrabold truncate text-bq-ink">
                      {room.roomName}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-2 border-bq-ink text-[12.5px] font-extrabold text-bq-ink ${room.isPublic ? 'bg-bq-leaf' : 'bg-bq-cream'}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{room.isPublic ? 'public' : 'lock'}</span>
                    {room.isPublic ? 'Công khai' : 'Riêng tư'}
                  </span>
                </div>
                <div className="text-[13px] font-bold mb-1.5 text-bq-ink2">Mã phòng</div>
                <div className="flex gap-1.5 md:gap-2 mb-3.5" data-testid="lobby-room-code" aria-label={room.roomCode}>
                  {room.roomCode.split('').map((ch, i) => (
                    <span
                      key={i}
                      className="w-10 h-12 md:w-12 md:h-14 grid place-items-center rounded-xl bg-bq-paper border-[3px] border-bq-ink shadow-[0_3px_0_#1D2B22] font-display text-[26px] md:text-[32px] font-extrabold text-bq-ink"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => copyToClipboard('code', room.roomCode)}
                    data-testid="lobby-hero-copy-code"
                    className="px-3 py-1 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5 bg-bq-white text-bq-ink border-2 border-bq-ink hover:bg-bq-cream"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {heroCopied === 'code' ? 'Đã copy' : 'Sao chép'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('link', `${window.location.origin}/room/join?code=${room.roomCode}`)}
                    data-testid="lobby-hero-copy-link"
                    className="px-3 py-1 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5 bg-bq-white text-bq-ink border-2 border-bq-ink hover:bg-bq-cream"
                  >
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    {heroCopied === 'link' ? 'Đã copy' : 'Sao chép link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    data-testid="lobby-share-btn"
                    className="px-3 py-1 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5 bg-bq-white text-bq-ink border-2 border-bq-ink hover:bg-bq-cream"
                  >
                    <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                    Mã QR
                  </button>
                </div>
              </div>
              {/* Inline QR (desktop) */}
              <div
                className="hidden md:flex w-36 h-36 rounded-2xl bg-white p-2.5 items-center justify-center flex-shrink-0 border-[3px] border-bq-ink"
                aria-hidden="true"
                data-testid="lobby-hero-qr"
              >
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${room.roomCode}`}
                  size={112}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
            {/* Stats grid bottom */}
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-5 pt-4 border-t-2 border-dashed border-bq-hair">
              <HeroStat label="Câu hỏi" value={`${room.questionCount}`} />
              <HeroStat label="Thời gian/câu" value={`${room.timePerQuestion}s`} />
              <HeroStat label="Độ khó" value={DIFFICULTY_LABEL[room.difficulty ?? ''] ?? 'Hỗn hợp'} />
              <HeroStat label="Người chơi" value={`${room.currentPlayers} / ${room.maxPlayers}`} />
            </div>
          </section>

          {/* ─── PLAYERS ─── */}
          <section className="mb-4" data-testid="lobby-player-grid">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="inline-flex items-center gap-2">
                <Plaque as="h2" className="text-[18px] md:text-[20px]">Người chơi</Plaque>
                <span className="px-2.5 py-0.5 rounded-full border-2 border-bq-ink bg-bq-white text-[13.5px] font-extrabold tabular-nums">
                  {room.currentPlayers}/{room.maxPlayers}
                </span>
              </div>
              {room.currentPlayers < 2 ? (
                <span className="px-2.5 py-0.5 rounded-full bg-bq-cream border-2 border-bq-ink text-[12.5px] font-extrabold">
                  Cần thêm {2 - room.currentPlayers} người để bắt đầu
                </span>
              ) : canStart ? (
                <span className="px-2.5 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[12.5px] font-extrabold inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Đủ người · Sẵn sàng
                </span>
              ) : null}
            </div>

            {isTeamVsTeam ? (
              <TeamSplit
                teamAPlayers={teamAPlayers}
                teamBPlayers={teamBPlayers}
                hostId={room.hostId}
                myUserId={viewerUserId ?? undefined}
                isHost={isHost && !isQuickMatch}
                myTeam={myPlayer?.team}
                kickMenuFor={kickMenuFor}
                setKickMenuFor={setKickMenuFor}
                onKick={handleKick}
                onSwitchTeam={handleSwitchTeam}
                switchingTeam={switchingTeam}
                onInvite={() => setShowInvite(true)}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5">
                {orderedPlayers.map((p, idx) => (
                  <PlayerSlot
                    key={p.id}
                    player={p}
                    hostId={room.hostId}
                    myUserId={viewerUserId ?? undefined}
                    suddenDeathOrder={isSuddenDeath ? idx : undefined}
                    canKick={isHost && !isQuickMatch && p.userId !== room.hostId}
                    kickOpen={kickMenuFor === p.userId}
                    onKickToggle={() => setKickMenuFor(kickMenuFor === p.userId ? null : p.userId)}
                    onKickConfirm={() => handleKick(p.userId)}
                  />
                ))}
                {emptySlots > 0 && (
                  <InviteSlot onClick={() => setShowInvite(true)} />
                )}
                {Array.from({ length: Math.max(0, emptySlots - 1) }).map((_, i) => (
                  <EmptySlot key={`empty-${i}`} index={room.currentPlayers + 1 + i + 1} />
                ))}
              </div>
            )}
          </section>

          {/* ─── RULES ─── */}
          {modeInfo.ruleText && (
            <section
              className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 bg-bq-cream border-[3px] border-bq-ink"
            >
              <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-9 flex-shrink-0" />
              <div className="flex-1 min-w-0 font-read text-[14px] text-bq-ink2" style={{ lineHeight: 1.5 }}>
                <div className="text-[14px] font-extrabold mb-0.5 text-bq-ink">
                  {modeInfo.ruleTitle}
                </div>
                {modeInfo.ruleText}
              </div>
              {modeInfo.ruleDetail && (
                <button
                  type="button"
                  onClick={() => setShowRulesDetail(true)}
                  className="px-3 py-1 rounded-full border-2 border-bq-ink bg-bq-white text-[13px] font-extrabold inline-flex items-center gap-0.5 flex-shrink-0"
                  data-testid="lobby-rules-detail-btn"
                >
                  Chi tiết
                  <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                </button>
              )}
            </section>
          )}
        </div>

        {/* ─── CHAT PANEL (desktop, ≥2 players, opened) ─── */}
        {showChatPanel && (
          <ChatPanel
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            onSend={handleSendChat}
            chatEndRef={chatEndRef}
            onlineCount={room?.currentPlayers}
            cta={
              <LobbyCTA
                isHost={isHost}
                canStart={canStart}
                statusSecondary={statusSecondary}
                myReady={!!myPlayer?.isReady}
                onStart={handleStart}
                onToggleReady={handleToggleReady}
                isQuickMatch={isQuickMatch}
              />
            }
          />
        )}
      </div>

      {/* ─── MOBILE BOTTOM CTA ─── (desktop CTA lives inside ChatPanel) */}
      {isMobile && (
        <footer
          className="lg:hidden px-4 py-3 border-t-[3px] bg-bq-white border-bq-ink"
        >
          <div className="text-[12.5px] font-bold mb-2 text-center text-bq-ink2">
            {statusPrimary}
          </div>
          <LobbyCTA
            isHost={isHost}
            canStart={canStart}
            statusSecondary={statusSecondary}
            myReady={!!myPlayer?.isReady}
            onStart={handleStart}
            onToggleReady={handleToggleReady}
            isQuickMatch={isQuickMatch}
          />
        </footer>
      )}

      {/* ─── CHAT FAB (when chat panel hidden) ─── */}
      {!showChatPanel && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Mở trò chuyện"
          data-testid="lobby-chat-fab"
          className="fixed right-4 lg:right-6 bottom-28 lg:bottom-24 w-12 h-12 grid place-items-center rounded-full z-40 bg-bq-amber border-[3px] border-bq-ink text-bq-ink shadow-[0_4px_0_#1D2B22]"
        >
          <span className="material-symbols-outlined">chat_bubble</span>
          {unreadChat > 0 && (
            <span
              className="absolute -top-1 -right-1 px-1.5 rounded-full text-[9px] font-extrabold text-white"
              style={{ background: 'var(--bq-ruby)', minWidth: 16, textAlign: 'center' }}
            >
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>
      )}

      {/* ─── MOBILE CHAT DRAWER ─── */}
      {isMobile && chatOpen && (
        <ChatDrawer
          messages={chatMessages}
          input={chatInput}
          setInput={setChatInput}
          onSend={handleSendChat}
          onClose={() => setChatOpen(false)}
          chatEndRef={chatEndRef}
        />
      )}

      {/* ─── INVITE MODAL ─── */}
      <InviteShareModal
        open={showInvite}
        roomCode={room.roomCode}
        onClose={() => setShowInvite(false)}
      />

      {/* ─── RULES DETAIL MODAL ─── */}
      {showRulesDetail && modeInfo.ruleDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết luật chơi"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(20,20,30,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowRulesDetail(false)}
        >
          <div
            className="w-full max-w-md rounded-bq p-6 bg-bq-white border-[3px] border-bq-ink shadow-bq-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 font-display text-[20px] font-extrabold text-bq-ink">{modeInfo.ruleTitle}</h3>
              <button
                onClick={() => setShowRulesDetail(false)}
                aria-label="Đóng"
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-bq-inset"
              >
                <span className="material-symbols-outlined text-bq-ink2">close</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-bq-ink2">{modeInfo.ruleDetail}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Player slot

const LobbyCTA: React.FC<{
  isHost: boolean;
  canStart: boolean;
  statusSecondary: string;
  myReady: boolean;
  onStart: () => void;
  onToggleReady: () => void;
  /** QP-10: Đấu Nhanh — any player sees Start button once canStart is true. */
  isQuickMatch?: boolean;
}> = ({ isHost, canStart, statusSecondary, myReady, onStart, onToggleReady, isQuickMatch }) => {
  // QP-10: in Quick Match, once ≥2 players are ready, the start button is
  // exposed to every player (no Quản trò). Players still toggle Ready below.
  if (isQuickMatch && canStart) {
    return (
      <button onClick={onStart} data-testid="lobby-start-btn" className="lk-btn lk-btn-2 w-full text-bq-ink text-[16px]">
        <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />
        <span>Bắt đầu trận đấu</span>
      </button>
    );
  }
  if (isHost && !isQuickMatch) {
    return (
      <button
        onClick={onStart}
        disabled={!canStart}
        title={!canStart ? statusSecondary : undefined}
        data-testid="lobby-start-btn"
        className={`lk-btn w-full text-[16px] ${canStart ? 'text-bq-ink' : '!bg-bq-inset text-bq-ink2'}`}
      >
        <span>👑</span>
        <span>{canStart ? 'Bắt đầu trận đấu' : 'Đang chờ người chơi…'}</span>
      </button>
    );
  }
  return (
    <button
      data-testid="lobby-ready-btn"
      onClick={onToggleReady}
      aria-pressed={myReady}
      className={`lk-btn w-full text-bq-ink text-[16px] ${myReady ? 'lk-btn-2' : ''}`}
    >
      <span className="material-symbols-outlined text-lg">
        {myReady ? 'check_circle' : 'radio_button_unchecked'}
      </span>
      {/* Sprint 2 S2-10: distinct label per state so the user reads
          their current status off the button instead of inferring it
          from the icon alone. */}
      {myReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
    </button>
  );
};

const HeroStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[13px] font-bold text-bq-ink2">{label}</div>
    <div className="font-display font-extrabold text-bq-ink text-[19px] lg:text-[22px] leading-tight mt-0.5">{value}</div>
  </div>
);

const ActivityLogPanel: React.FC<{ entries: ActivityEntry[]; statusHint: string }> = ({ entries, statusHint }) => (
  <aside
    className="hidden lg:flex flex-col border-r-[3px] p-4 overflow-hidden bg-bq-white/95 border-bq-ink"
    data-testid="lobby-activity-log"
  >
    <div className="flex items-center gap-2 mb-3">
      <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-6" />
      <span className="font-display text-[16px] font-extrabold text-bq-ink">Hoạt động phòng</span>
    </div>
    <div className="space-y-2 flex-1 overflow-y-auto">
      {entries.map((e, i) => (
        <div
          key={i}
          className="font-read text-[13.5px] italic"
          style={{
            color: e.tone === 'ok' ? 'var(--bq-emerald)'
              : e.tone === 'warn' ? 'var(--bq-ruby)'
              : 'var(--bq-ink-soft)',
          }}
        >
          {e.time} · {e.text}
        </div>
      ))}
      {statusHint && (
        <div className="text-xs font-semibold mt-2 text-bq-amberd">
          {statusHint}
        </div>
      )}
    </div>
  </aside>
);

const PlayerSlot: React.FC<{
  player: Player;
  hostId: string;
  myUserId?: string;
  suddenDeathOrder?: number;
  canKick: boolean;
  kickOpen: boolean;
  onKickToggle: () => void;
  onKickConfirm: () => void;
}> = ({ player, hostId, myUserId, suddenDeathOrder, canKick, kickOpen, onKickToggle, onKickConfirm }) => {
  const isHost = player.userId === hostId;
  // FMR-7 identity sweep: "(bạn)" marker keys off userId only (F-web-2).
  const isMe = !!myUserId && player.userId === myUserId;
  const isReady = isHost ? true : player.isReady;
  const variant: 'host' | 'ready' | 'waiting' =
    isHost ? 'host' : (isReady ? 'ready' : 'waiting');

  // Avatar: PlayerCrest routes through resolveAvatar (emoji presets render as emojis) and
  // falls back to the initial when the picture 404s, never the alt text over a gradient.
  const { t } = useTranslation();

  const look = {
    host:    { card: 'bg-bq-cream', chip: 'bg-bq-amber', statusLabel: 'Chủ phòng' },
    ready:   { card: 'bg-bq-white', chip: 'bg-bq-leaf', statusLabel: 'Sẵn sàng' },
    waiting: { card: 'bg-bq-white', chip: 'bg-bq-paper', statusLabel: 'Chưa sẵn sàng' },
  }[variant];
  // the lobby only carries the tier name; find its id for the crest rim
  const tierId = TIERS.find(tt => t(tt.nameKey) === player.tier)?.id ?? 1;

  return (
    <div
      className={`relative text-center px-2.5 pt-3.5 pb-3 rounded-2xl border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22] ${look.card}`}
      style={{ minHeight: 140 }}
      data-testid={`lobby-slot-${player.userId}`}
    >
      {isHost && (
        <div className="absolute top-1.5 right-2 text-lg">
          👑
        </div>
      )}
      {canKick && (
        <div className="absolute top-1.5 left-1.5">
          <button
            type="button"
            aria-label="Tùy chọn"
            onClick={(e) => { e.stopPropagation(); onKickToggle(); }}
            className="w-7 h-7 grid place-items-center rounded-full border-2 border-bq-ink/30 bg-bq-white text-bq-ink hover:border-bq-ink"
            data-testid={`lobby-slot-menu-${player.userId}`}
          >
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
          {kickOpen && (
            <div
              className="absolute left-0 top-8 z-20 rounded-xl overflow-hidden bg-bq-white border-2 border-bq-ruby shadow-[0_3px_0_#1D2B22]"
              style={{ minWidth: 110 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onKickConfirm}
                className="block w-full text-left px-3 py-2 text-[13px] font-extrabold text-bq-ruby hover:bg-bq-ruby/10"
                data-testid={`lobby-kick-${player.userId}`}
              >
                <span className="material-symbols-outlined text-[15px] align-middle mr-1">person_remove</span>
                Kick
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-2 flex justify-center">
        <PlayerCrest name={player.username || 'U'} avatarUrl={player.avatarUrl} tierId={tierId} size={58} showTier={false} />
      </div>

      <div className="text-[14px] font-extrabold mb-0.5 truncate text-bq-ink">
        {player.username}{isMe ? ' (bạn)' : ''}
      </div>
      <div className="text-[12px] font-bold mb-1.5 text-bq-ink2">
        {player.tier ?? 'Tân Tín Hữu'}
      </div>
      <div className={`inline-block px-2.5 py-0.5 rounded-full border-2 border-bq-ink text-[12.5px] font-extrabold ${look.chip}`}>
        {suddenDeathOrder !== undefined && suddenDeathOrder >= 2
          ? `Chờ #${suddenDeathOrder + 1}`
          : suddenDeathOrder === 1
          ? 'Đối thủ'
          : suddenDeathOrder === 0
          ? 'Hot seat'
          : look.statusLabel}
      </div>
    </div>
  );
};

const InviteSlot: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid="lobby-invite-slot"
    className="text-center px-2.5 py-3 rounded-2xl border-[3px] border-dashed border-bq-ink/50 bg-bq-cream/80 hover:bg-bq-cream transition-colors"
    style={{ minHeight: 140 }}
  >
    <div className="mx-auto mb-2 w-[58px] h-[58px] grid place-items-center rounded-full bg-bq-amber border-[3px] border-bq-ink text-bq-ink">
      <span className="material-symbols-outlined">person_add</span>
    </div>
    <div className="text-[14px] font-extrabold text-bq-ink">Mời bạn bè</div>
    <div className="text-[12px] font-bold mt-0.5 text-bq-ink2">Chia sẻ mã / Link / QR</div>
  </button>
);

const EmptySlot: React.FC<{ index: number }> = ({ index }) => (
  <div className="text-center px-2.5 py-3 rounded-2xl border-[3px] border-dashed border-bq-ink/25 bg-bq-paper/70" style={{ minHeight: 140 }}>
    <div className="mx-auto mb-2 w-[58px] h-[58px] grid place-items-center rounded-full border-[3px] border-dashed border-bq-ink/25 text-bq-ink3">
      <img src="/images/lk/lantern-off.webp" alt="" aria-hidden className="h-8 opacity-60" />
    </div>
    <div className="text-[12.5px] font-bold text-bq-ink3">Slot {index}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Team vs Team layout

const TeamSplit: React.FC<{
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  hostId: string;
  myUserId?: string;
  isHost: boolean;
  myTeam?: string;
  kickMenuFor: string | null;
  setKickMenuFor: (id: string | null) => void;
  onKick: (id: string) => void;
  onSwitchTeam: () => void;
  switchingTeam: boolean;
  onInvite: () => void;
}> = ({ teamAPlayers, teamBPlayers, hostId, myUserId, isHost, myTeam, kickMenuFor, setKickMenuFor, onKick, onSwitchTeam, switchingTeam, onInvite }) => {
  const renderTeam = (label: string, color: string, players: Player[]) => (
    <div>
      <div className="text-[12.5px] font-extrabold mb-2 inline-flex items-center gap-2" style={{ color }}>
        <span className="material-symbols-outlined text-[15px]">shield</span>
        {label}
        {myTeam && players.some(p => p.userId === myUserId) && (
          <span className="text-[10px] font-semibold text-bq-ink2">(bạn)</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {players.map(p => (
          <PlayerSlot
            key={p.id}
            player={p}
            hostId={hostId}
            myUserId={myUserId}
            canKick={isHost && p.userId !== hostId}
            kickOpen={kickMenuFor === p.userId}
            onKickToggle={() => setKickMenuFor(kickMenuFor === p.userId ? null : p.userId)}
            onKickConfirm={() => onKick(p.userId)}
          />
        ))}
        {players.length === 0 && (
          <button
            type="button"
            onClick={onInvite}
            className="text-center px-2.5 py-3 rounded-xl col-span-2 bg-bq-inset"
            style={{ border: `1.5px dashed color-mix(in srgb, ${color} 40%, transparent)`, minHeight: 80, color }}
          >
            <span className="material-symbols-outlined">person_add</span>
            <div className="text-[11px] mt-1 font-semibold">Mời vào đội</div>
          </button>
        )}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {renderTeam('Đội A', 'var(--bq-sapphire)', teamAPlayers)}
      {renderTeam('Đội B', 'var(--bq-ruby)', teamBPlayers)}
      {myUserId && (
        <button
          onClick={onSwitchTeam}
          disabled={switchingTeam}
          className="px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 disabled:opacity-50 text-[13.5px] font-extrabold text-bq-ink bg-bq-white border-2 border-bq-ink hover:bg-bq-cream"
        >
          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          Đổi đội
        </button>
      )}
    </div>
  );
};

export default RoomLobby;
