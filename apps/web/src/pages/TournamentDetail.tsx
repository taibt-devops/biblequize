import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';

/* ── Types ── */
interface Participant {
  userId: string;
  userName: string;
  lives: number;
  score: number;
  isWinner: boolean;
  seed?: number;
}

interface Match {
  matchId: string;
  roundNumber: number;
  matchIndex: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  winnerId: string | null;
  isBye: boolean;
  participants: Participant[];
  scheduledTime?: string;
}

interface BracketData {
  tournamentId: string;
  name: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED';
  currentRound: number;
  totalRounds: number;
  rounds: Record<string, Match[]>;
  participants?: { userId: string; userName: string; seed?: number }[];
  creatorId?: string;
  // Optional enriched fields from API
  bookScope?: string;
  difficulty?: string;
  questionCount?: number;
  timePerQuestion?: number;
  maxParticipants?: number;
  organizerName?: string;
  organizerLocation?: string;
  rewards?: string;
  scheduledAt?: string;
}

const STORAGE_KEY = 'biblequiz_my_tournaments';

function saveTournamentLocally(id: string, name: string) {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!list.find((t: { id: string }) => t.id === id)) {
      list.unshift({ id, name });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch { /* ignore */ }
}

/* ── Helpers ── */
function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'CHUNG KẾT 🏆';
  if (round === totalRounds - 1) return 'BÁN KẾT';
  if (round === totalRounds - 2) return 'TỨ KẾT';
  return `VÒNG ${round}`;
}

function getDifficultyLabel(d?: string): { label: string; icon: string; color: string } {
  const map: Record<string, { label: string; icon: string; color: string }> = {
    EASY:   { label: 'Dễ',       icon: '😊', color: 'var(--bq-emerald)' },
    MEDIUM: { label: 'Trung bình',icon: '⚡', color: 'var(--bq-amber-deep)' },
    HARD:   { label: 'Khó',      icon: '🔥', color: 'var(--bq-ruby)' },
    MIXED:  { label: 'Hỗn hợp', icon: '🌐', color: 'var(--bq-amber-deep)' },
  };
  return map[d ?? 'MIXED'] ?? map.MIXED;
}

/* ── HeartIcons ── */
function HeartIcons({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: 13, opacity: i < count ? 1 : 0.2 }}>
          {i < count ? '❤️' : '🖤'}
        </span>
      ))}
    </div>
  );
}

/* ── Compact Match Card ── */
function MatchCard({
  match,
  currentUserId,
  onMatchClick,
  roundIdx,
  totalRounds,
}: {
  match: Match;
  currentUserId?: string;
  onMatchClick: (m: Match) => void;
  roundIdx: number;
  totalRounds: number;
}) {
  const p1 = match.participants[0];
  const p2 = match.participants[1];
  const isUserMatch = !!currentUserId && match.participants.some(p => p.userId === currentUserId);
  const isActive = match.status === 'IN_PROGRESS';
  const isPending = match.status === 'PENDING';
  const isFinal = match.roundNumber === totalRounds;

  const AVATAR_COLORS = ['rgba(245,158,11,0.18)', 'rgba(45,70,200,0.16)', 'rgba(45,70,200,0.16)', 'rgba(14,138,107,0.16)', 'rgba(255,111,61,0.16)', 'rgba(45,70,200,0.16)', 'rgba(224,53,75,0.16)', 'rgba(45,70,200,0.16)'];
  const AVATAR_TEXT = ['var(--bq-amber-deep)', 'var(--bq-sapphire)', 'var(--bq-sapphire)', 'var(--bq-emerald)', 'var(--bq-amber-deep)', 'var(--bq-sapphire)', 'var(--bq-ruby)', 'var(--bq-sapphire)'];
  function avatarColor(idx: number) { return AVATAR_COLORS[idx % AVATAR_COLORS.length]; }
  function avatarText(idx: number)  { return AVATAR_TEXT[idx % AVATAR_TEXT.length]; }

  if (isPending && !p1 && !p2) {
    return (
      <div
        className="rounded-lg overflow-hidden cursor-pointer"
        style={{
          background: 'var(--bq-paper-sunk)',
          border: '1px dashed var(--bq-hairline)',
        }}
        onClick={() => onMatchClick(match)}
      >
        <div className="px-2.5 py-1.5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--bq-hairline)', background: 'var(--bq-paper-sunk)' }}>
          <span className="text-[9px]" style={{ color: 'var(--bq-ink-faint)' }}>Match #{match.matchIndex + 1}</span>
        </div>
        <div className="px-2.5 py-2 text-center">
          <span className="text-[11px]" style={{ color: 'var(--bq-ink-soft)' }}>⏳ Chờ kết quả vòng trước</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background: isFinal ? 'linear-gradient(135deg, rgba(245,158,11,0.10), var(--bq-white))' : 'var(--bq-white)',
        border: isUserMatch
          ? '1px solid rgba(245,158,11,0.55)'
          : isFinal
            ? '1px solid rgba(245,158,11,0.4)'
            : isActive
              ? '1px solid rgba(14,138,107,0.45)'
              : '1px solid var(--bq-hairline)',
        boxShadow: isUserMatch ? '0 0 12px rgba(245,158,11,0.18)' : 'var(--bq-shadow-soft)',
      }}
      onClick={() => onMatchClick(match)}
    >
      {/* Match header */}
      <div
        className="px-2.5 py-1.5 flex justify-between items-center"
        style={{
          borderBottom: `1px solid ${isUserMatch ? 'rgba(245,158,11,0.3)' : 'var(--bq-hairline)'}`,
          background: isUserMatch ? 'rgba(245,158,11,0.12)' : isFinal ? 'rgba(245,158,11,0.14)' : 'var(--bq-paper-sunk)',
        }}
      >
        <span className="text-[9px] font-medium" style={{ color: isUserMatch ? 'var(--bq-amber-deep)' : isFinal ? 'var(--bq-amber-deep)' : 'var(--bq-ink-soft)' }}>
          {isFinal ? '🏆 CHUNG KẾT' : isUserMatch ? `Match #${match.matchIndex + 1} · Trận của bạn` : `Match #${match.matchIndex + 1}`}
        </span>
        {isActive && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--bq-emerald)', boxShadow: '0 0 4px var(--bq-emerald)' }} />
            <span className="text-[9px]" style={{ color: 'var(--bq-emerald)' }}>LIVE</span>
          </span>
        )}
      </div>

      {/* Player 1 row */}
      <div
        className="px-2.5 py-2 flex items-center gap-1.5"
        style={{
          borderBottom: '1px solid var(--bq-hairline)',
          background: isUserMatch && p1?.userId === currentUserId ? 'rgba(245,158,11,0.06)' : undefined,
        }}
      >
        {p1 ? (
          <>
            {p1.seed != null && (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: p1.seed <= 2 ? 'rgba(245,158,11,0.18)' : 'var(--bq-paper-sunk)', color: p1.seed <= 2 ? 'var(--bq-amber-deep)' : 'var(--bq-ink-soft)' }}
              >
                {p1.seed}
              </div>
            )}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
              style={{ background: avatarColor(0), color: avatarText(0) }}
            >
              {p1.userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] flex-1 truncate font-medium" style={{ color: p1.isWinner ? 'var(--bq-amber-deep)' : 'var(--bq-ink)' }}>
              {p1.userName}{p1.userId === currentUserId ? ' (bạn)' : ''}
            </span>
            {match.status !== 'PENDING' && <HeartIcons count={p1.lives} />}
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px]" style={{ background: 'var(--bq-paper-sunk)', color: 'var(--bq-ink-faint)' }}>?</div>
            <span className="text-[11px] italic" style={{ color: 'var(--bq-ink-faint)' }}>TBD</span>
          </>
        )}
      </div>

      {/* Player 2 row */}
      <div
        className="px-2.5 py-2 flex items-center gap-1.5"
        style={{ background: isUserMatch && p2?.userId === currentUserId ? 'rgba(245,158,11,0.06)' : undefined }}
      >
        {p2 ? (
          <>
            {p2.seed != null && (
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: p2.seed <= 2 ? 'rgba(245,158,11,0.18)' : 'var(--bq-paper-sunk)', color: p2.seed <= 2 ? 'var(--bq-amber-deep)' : 'var(--bq-ink-soft)' }}
              >
                {p2.seed}
              </div>
            )}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
              style={{ background: avatarColor(3), color: avatarText(3) }}
            >
              {p2.userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] flex-1 truncate" style={{ color: p2.isWinner ? 'var(--bq-amber-deep)' : 'var(--bq-ink-soft)' }}>
              {p2.userName}{p2.userId === currentUserId ? ' (bạn)' : ''}
            </span>
            {match.status !== 'PENDING' && <HeartIcons count={p2.lives} />}
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px]" style={{ background: 'var(--bq-paper-sunk)', color: 'var(--bq-ink-faint)' }}>?</div>
            <span className="text-[11px] italic" style={{ color: 'var(--bq-ink-faint)' }}>
              {match.isBye ? 'BYE' : 'TBD'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Compact Bracket ── */
function CompactBracketView({
  rounds, totalRounds, currentUserId, onMatchClick,
}: {
  rounds: Record<string, Match[]>;
  totalRounds: number;
  currentUserId?: string;
  onMatchClick: (m: Match) => void;
}) {
  const roundNums = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-6 min-w-max" style={{ gridTemplateColumns: `repeat(${totalRounds}, minmax(220px, 1fr))` }}>
        {roundNums.map((rn) => {
          const matches = rounds[String(rn)] ?? [];
          const isFinal = rn === totalRounds;
          return (
            <div key={rn} className="flex flex-col gap-3">
              <div className="text-center pb-2" style={{ borderBottom: '1px solid var(--bq-hairline)' }}>
                <span className="text-[10px] font-medium tracking-wider" style={{ color: isFinal ? 'var(--bq-amber-deep)' : 'var(--bq-ink-soft)' }}>
                  VÒNG {rn} — {getRoundLabel(rn, totalRounds)}
                </span>
              </div>
              <div className="flex flex-col gap-3 justify-around flex-1">
                {matches.length > 0 ? matches.map((m) => (
                  <MatchCard
                    key={m.matchId}
                    match={m}
                    currentUserId={currentUserId}
                    onMatchClick={onMatchClick}
                    roundIdx={rn - 1}
                    totalRounds={totalRounds}
                  />
                )) : (
                  <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bq-paper-sunk)', border: '1px dashed var(--bq-hairline)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--bq-ink-faint)' }}>Chờ kết quả...</span>
                  </div>
                )}
                {/* Rewards placeholder for final column */}
                {isFinal && (
                  <div className="rounded-lg p-3 text-center mt-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div className="text-xl mb-1">👑</div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--bq-amber-deep)' }}>Vương quyền chờ chủ nhân</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--bq-ink-soft)' }}>+500 XP · Badge Vô Địch</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center mt-4 text-[11px]" style={{ color: 'var(--bq-ink-soft)' }}>
        💡 Trận của bạn được highlight vàng · Click vào match để xem chi tiết
      </p>
    </div>
  );
}

/* ── GoldConfetti ── */
function GoldConfetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 3;
        const size = 4 + Math.random() * 8;
        const rotation = Math.random() * 360;
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${left}%`, top: '-5%',
              width: size, height: size * 0.6,
              background: `linear-gradient(${rotation}deg, var(--bq-amber), var(--bq-amber-lt), var(--bq-ember))`,
              animation: `confettiFall ${duration}s ${delay}s ease-in infinite`,
              opacity: 0.8,
            }}
          />
        );
      })}
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 0.9; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}

/* ── Main Component ── */
const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'players' | 'rules' | 'stats'>('bracket');
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);

  const fetchBracket = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/api/tournaments/${id}/bracket`);
      setBracket(res.data);
      setError('');
      if (res.data.name) saveTournamentLocally(id, res.data.name);
    } catch (err: any) {
      if (!bracket) setError(err.response?.data?.message || err.response?.data?.error || t('tournaments.errorLoadData'));
    } finally {
      setLoading(false);
    }
  }, [id, bracket, t]);

  useEffect(() => { fetchBracket(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bracket || bracket.status !== 'IN_PROGRESS') return;
    const iv = setInterval(fetchBracket, 5000);
    return () => clearInterval(iv);
  }, [bracket?.status, fetchBracket]);

  useEffect(() => {
    if (bracket?.status === 'COMPLETED') setShowWinnerOverlay(true);
  }, [bracket?.status]);

  const handleJoin = async () => {
    if (!id) return;
    setJoinLoading(true); setActionMsg(null);
    try {
      await api.post(`/api/tournaments/${id}/join`);
      setActionMsg({ text: t('tournaments.joinedSuccess'), type: 'success' });
      await fetchBracket();
    } catch (err: any) {
      setActionMsg({ text: err.response?.data?.message || t('tournaments.cannotJoin'), type: 'error' });
    } finally { setJoinLoading(false); }
  };

  const handleStart = async () => {
    if (!id) return;
    setStartLoading(true); setActionMsg(null);
    try {
      await api.post(`/api/tournaments/${id}/start`);
      setActionMsg({ text: t('tournaments.tournamentStarted'), type: 'success' });
      await fetchBracket();
    } catch (err: any) {
      setActionMsg({ text: err.response?.data?.message || t('tournaments.cannotStart'), type: 'error' });
    } finally { setStartLoading(false); }
  };

  const handleMatchClick = (match: Match) => {
    if (id) navigate(`/tournaments/${id}/match/${match.matchId}`);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid var(--bq-hairline)', borderTopColor: 'var(--bq-amber)' }} />
        <span className="text-sm" style={{ color: 'var(--bq-ink-soft)' }}>{t('tournaments.loadingTournament')}</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error && !bracket) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/tournaments')} className="flex items-center gap-1.5 text-sm mb-8 transition-colors hover:opacity-80" style={{ color: 'var(--bq-ink-soft)' }}>
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {t('nav.tournaments')}
        </button>
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'var(--bq-ruby)' }}>error</span>
          <p className="text-sm mb-6" style={{ color: 'var(--bq-ruby)' }}>{error}</p>
          <button className="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--bq-amber-deep)' }}
            onClick={() => { setLoading(true); setError(''); fetchBracket(); }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!bracket) return null;

  const participantCount = bracket.participants?.length ||
    new Set(Object.values(bracket.rounds).flat().flatMap(m => m.participants.map(p => p.userId)).filter(Boolean)).size;
  const maxParticipants = bracket.maxParticipants ?? Math.pow(2, bracket.totalRounds);
  const diff = getDifficultyLabel(bracket.difficulty);

  const champion = (() => {
    if (bracket.status !== 'COMPLETED') return null;
    const finalRound = bracket.rounds[String(bracket.totalRounds)];
    if (!finalRound?.length) return null;
    const winner = finalRound[0]?.participants?.find(p => p.isWinner);
    return winner?.userName ?? null;
  })();

  const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
    LOBBY:       { label: '⏰ SẮP DIỄN RA',  bg: 'rgba(45,70,200,0.12)',  color: 'var(--bq-sapphire)', border: 'rgba(45,70,200,0.35)' },
    IN_PROGRESS: { label: '⚔️ ĐANG DIỄN RA', bg: 'rgba(245,158,11,0.15)', color: 'var(--bq-amber-deep)', border: 'rgba(245,158,11,0.4)' },
    COMPLETED:   { label: '✅ ĐÃ KẾT THÚC',  bg: 'rgba(14,138,107,0.14)',  color: 'var(--bq-emerald)', border: 'rgba(14,138,107,0.35)' },
  };
  const statusCfg = STATUS_CONFIG[bracket.status] ?? STATUS_CONFIG.LOBBY;

  return (
    <div data-testid="tournament-detail-page" className="space-y-4">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--bq-ink-soft)' }}>
        <button onClick={() => navigate('/multiplayer')} className="hover:opacity-80 transition-opacity">← Đa người chơi</button>
        <span style={{ color: 'var(--bq-ink-faint)' }}>/</span>
        <button onClick={() => navigate('/tournaments')} className="hover:opacity-80 transition-opacity">Giải đấu</button>
        <span style={{ color: 'var(--bq-ink-faint)' }}>/</span>
        <span className="truncate max-w-[200px]" style={{ color: 'var(--bq-ink)' }}>{bracket.name}</span>
      </nav>

      {/* ── Hero Header ── */}
      <header
        className="rounded-2xl p-5 relative overflow-hidden bg-bq-white shadow-bq-soft"
        data-testid="tournament-detail-name"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(45,70,200,0.06), var(--bq-white))',
          border: '1px solid rgba(245,158,11,0.3)',
        }}
      >
        {/* Trophy watermark */}
        <div className="absolute -top-5 -right-5 opacity-[0.06] text-[180px] pointer-events-none select-none">🏆</div>

        <div className="flex flex-col sm:flex-row items-start gap-4 relative">
          <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
          {/* Trophy icon */}
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.18)', border: '1.5px solid var(--bq-amber)' }}>
            <span className="text-3xl">🏆</span>
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, letterSpacing: '0.04em' }}>
                {statusCfg.label}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'rgba(45,70,200,0.12)', color: 'var(--bq-sapphire)' }}>
                PUBLIC
              </span>
            </div>
            <h1 className="font-display text-xl font-semibold mb-1 leading-snug" style={{ color: 'var(--bq-ink)' }}>{bracket.name}</h1>
            <p className="text-sm mb-2" style={{ color: 'var(--bq-ink-soft)' }}>
              Bracket elimination {maxParticipants} người · {bracket.totalRounds} vòng · 1v1 mỗi trận
            </p>
            {bracket.organizerName && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium" style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--bq-amber-deep)' }}>
                  {bracket.organizerName.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px]" style={{ color: 'var(--bq-ink)' }}>{bracket.organizerName}</span>
                <span style={{ color: 'var(--bq-ink-faint)' }}>·</span>
                <span className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>tổ chức</span>
                {bracket.organizerLocation && (
                  <>
                    <span style={{ color: 'var(--bq-ink-faint)' }}>·</span>
                    <span className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>📍 {bracket.organizerLocation}</span>
                  </>
                )}
              </div>
            )}
          </div>
          </div>

          {/* CTA panel */}
          <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0 w-full sm:w-auto">
            {/* Participant counter */}
            <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--bq-paper-sunk)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="text-[9px] tracking-wider mb-0.5" style={{ color: 'var(--bq-amber-deep)' }}>NGƯỜI THAM GIA</div>
              <div className="text-lg font-semibold leading-tight" style={{ color: 'var(--bq-amber-deep)' }}>{participantCount}/{maxParticipants}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--bq-ink-soft)' }}>
                Còn {Math.max(0, maxParticipants - participantCount)} chỗ
              </div>
            </div>

            {bracket.status === 'LOBBY' && (
              <>
                <button
                  onClick={handleJoin}
                  disabled={joinLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--bq-action)', color: 'var(--bq-action-fg)', boxShadow: 'var(--bq-glow-action)' }}
                >
                  <span>⚔️</span>
                  {joinLoading ? 'Đang đăng ký...' : 'Tham gia ngay'}
                </button>
                <button
                  onClick={handleStart}
                  disabled={startLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'var(--bq-paper-sunk)', color: 'var(--bq-ink-soft)', border: '1px solid var(--bq-hairline)' }}
                >
                  <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  {startLoading ? 'Đang bắt đầu...' : 'Bắt đầu ngay'}
                </button>
              </>
            )}

            {bracket.status === 'IN_PROGRESS' && (
              <button
                onClick={() => navigate(`/tournaments/${id}/match/latest`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: 'var(--bq-action)', color: 'var(--bq-action-fg)' }}
              >
                <span>⚔️</span> Vào trận của bạn
              </button>
            )}

            {actionMsg && (
              <p className="text-[11px] font-medium max-w-[160px] text-right" style={{ color: actionMsg.type === 'success' ? 'var(--bq-emerald)' : 'var(--bq-ruby)' }}>
                {actionMsg.text}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── 4 Info Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="tournament-rules">
        <div className="rounded-xl p-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid rgba(45,70,200,0.22)' }}>
          <div className="text-[9px] tracking-wider mb-1.5" style={{ color: 'var(--bq-sapphire)' }}>SÁCH KINH THÁNH</div>
          <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--bq-ink)' }}>📖 {bracket.bookScope ?? '1 + 2 Sa-mu-ên'}</div>
          <div className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>Cựu Ước · Lịch sử</div>
        </div>
        <div className="rounded-xl p-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid rgba(245,158,11,0.22)' }}>
          <div className="text-[9px] tracking-wider mb-1.5" style={{ color: 'var(--bq-amber-deep)' }}>ĐỘ KHÓ</div>
          <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--bq-ink)' }}>{diff.icon} {diff.label}</div>
          <div className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>
            {bracket.questionCount ?? 10} câu / trận · {bracket.timePerQuestion ?? 15}s/câu
          </div>
        </div>
        <div className="rounded-xl p-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid rgba(224,53,75,0.22)' }}>
          <div className="text-[9px] tracking-wider mb-1.5" style={{ color: 'var(--bq-ruby)' }}>CƠ CHẾ</div>
          <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--bq-ink)' }}>❤️ 3 mạng / trận</div>
          <div className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>Hết mạng = thua</div>
        </div>
        <div className="rounded-xl p-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid rgba(245,158,11,0.22)' }}>
          <div className="text-[9px] tracking-wider mb-1.5" style={{ color: 'var(--bq-amber-deep)' }}>PHẦN THƯỞNG</div>
          <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--bq-ink)' }}>🏆 {bracket.rewards ?? '+500 XP · Badge'}</div>
          <div className="text-[10px]" style={{ color: 'var(--bq-ink-soft)' }}>Top 1 · Top 4 nhận giảm</div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--bq-hairline)' }}>
        {([
          ['bracket', '🌳 Bracket'],
          ['players', `👥 Người chơi (${participantCount}/${maxParticipants})`],
          ['rules', '📜 Luật chơi'],
          ['stats', '📊 Thống kê'],
        ] as [typeof activeTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm transition-all whitespace-nowrap flex-shrink-0"
            style={activeTab === tab
              ? { color: 'var(--bq-amber-deep)', borderBottom: '2px solid var(--bq-amber)', fontWeight: 500, marginBottom: -1 }
              : { color: 'var(--bq-ink-soft)', border: 'none' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'bracket' && (
        <section
          className="rounded-xl p-4 bg-bq-white shadow-bq-soft"
          data-testid="tournament-bracket"
          style={{ border: '1px solid var(--bq-hairline)' }}
        >
          {(bracket.status === 'IN_PROGRESS' || bracket.status === 'COMPLETED') ? (
            <CompactBracketView
              rounds={bracket.rounds}
              totalRounds={bracket.totalRounds}
              currentUserId={user?.email}
              onMatchClick={handleMatchClick}
            />
          ) : (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--bq-ink)' }}>Giải đấu chưa bắt đầu</p>
              <p className="text-xs" style={{ color: 'var(--bq-ink-soft)' }}>
                Bracket sẽ hiển thị sau khi đủ người và giải đấu bắt đầu
              </p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'players' && (
        <section data-testid="tournament-participants">
          {bracket.participants && bracket.participants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {bracket.participants.map((p, i) => (
                <div key={p.userId} className="rounded-xl px-4 py-3 flex items-center gap-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid var(--bq-hairline)' }}>
                  {p.seed != null && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--bq-amber-deep)' }}>
                      {p.seed}
                    </div>
                  )}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: ['rgba(245,158,11,0.16)', 'rgba(45,70,200,0.14)', 'rgba(45,70,200,0.14)', 'rgba(14,138,107,0.14)'][i % 4], color: ['var(--bq-amber-deep)', 'var(--bq-sapphire)', 'var(--bq-sapphire)', 'var(--bq-emerald)'][i % 4] }}>
                    {p.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--bq-ink)' }}>{p.userName}</span>
                  {p.userId === user?.email && (
                    <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--bq-amber-deep)' }}>BẠN</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10" style={{ color: 'var(--bq-ink-soft)' }}>
              <div className="text-3xl mb-2">👥</div>
              <p className="text-sm">Chưa có người đăng ký</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'rules' && (
        <section className="rounded-xl p-5 space-y-3 bg-bq-white shadow-bq-soft" style={{ border: '1px solid var(--bq-hairline)' }}>
          {[
            ['⚔️', 'Hình thức', 'Single elimination — thua là bị loại'],
            ['❤️', 'Mạng sống', '3 mạng / trận. Trả lời sai mất 1 mạng. Hết mạng = thua trận'],
            ['⏱', 'Thời gian', `${bracket.timePerQuestion ?? 15}s / câu. Hết giờ tính sai`],
            ['📖', 'Nội dung', `${bracket.bookScope ?? 'Kinh Thánh'} · ${bracket.questionCount ?? 10} câu / trận`],
            ['🏆', 'Phần thưởng', bracket.rewards ?? '+500 XP · Badge đặc biệt cho Top 1'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex items-start gap-3 pb-3" style={{ borderBottom: '1px solid var(--bq-hairline)' }}>
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div>
                <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--bq-ink)' }}>{title}</div>
                <div className="text-xs" style={{ color: 'var(--bq-ink-soft)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {activeTab === 'stats' && (
        <div className="text-center py-12" style={{ color: 'var(--bq-ink-soft)' }}>
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm">Thống kê sẽ hiển thị sau khi giải đấu kết thúc</p>
        </div>
      )}

      {/* ── Champion Banner ── */}
      {champion && (
        <section className="max-w-md mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl blur opacity-30" style={{ background: 'linear-gradient(to right, var(--bq-amber), var(--bq-amber-lt))' }} />
            <div className="relative rounded-2xl p-8 text-center bg-bq-white shadow-bq-soft" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
              <span className="material-symbols-outlined text-5xl mb-2 block" style={{ color: 'var(--bq-amber-deep)', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--bq-ink-soft)' }}>{t('tournaments.champion')}</p>
              <p className="text-2xl font-black" style={{ color: 'var(--bq-amber-deep)' }}>{champion}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Winner Overlay ── */}
      {showWinnerOverlay && champion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowWinnerOverlay(false)}>
          <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'rgba(251,250,245,0.92)' }} />
          <GoldConfetti />
          <div className="relative z-10 text-center px-6 max-w-md">
            <span className="material-symbols-outlined text-7xl mb-4 block" style={{ color: 'var(--bq-amber-deep)', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-4" style={{ background: 'rgba(245,158,11,0.18)', border: '2px solid rgba(245,158,11,0.5)', color: 'var(--bq-amber-deep)', boxShadow: '0 0 40px rgba(245,158,11,0.3)' }}>
              {champion.charAt(0).toUpperCase()}
            </div>
            <p className="text-3xl font-black mb-2" style={{ color: 'var(--bq-amber-deep)' }}>{champion}</p>
            <p className="text-lg mb-8" style={{ color: 'var(--bq-ink-soft)' }}>{t('tournaments.wonMatch')}</p>
            <button
              className="px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              style={{ background: 'var(--bq-action)', color: 'var(--bq-action-fg)', boxShadow: 'var(--bq-glow-action)' }}
              onClick={(e) => { e.stopPropagation(); setShowWinnerOverlay(false); }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;
