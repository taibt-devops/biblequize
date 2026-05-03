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
  correctCount?: number;
  wrongCount?: number;
  avgSpeed?: number;
}

interface Match {
  matchId: string;
  roundNumber: number;
  matchIndex: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  winnerId: string | null;
  isBye: boolean;
  participants: Participant[];
}

interface BracketData {
  tournamentId: string;
  name: string;
  status: string;
  totalRounds: number;
  rounds: Record<string, Match[]>;
}

/* ── Helpers ── */
function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Chung kết';
  if (round === totalRounds - 1) return 'Bán kết';
  if (round === totalRounds - 2) return 'Tứ kết';
  return `Vòng ${round}`;
}

/* ── HeartRow ── */
function HeartRow({ lives, max = 3, size = 16 }: { lives: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-1 justify-center">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: size, opacity: i < lives ? 1 : 0.2, filter: i < lives ? 'none' : 'grayscale(1)' }}>
          {i < lives ? '❤️' : '🖤'}
        </span>
      ))}
    </div>
  );
}

/* ── SVG Countdown Timer ── */
function TimerCircle({ seconds, maxSeconds = 15, size = 80 }: { seconds: number; maxSeconds?: number; size?: number }) {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, seconds / maxSeconds);
  const strokeDashoffset = circumference * (1 - progress);
  const color = seconds <= 5 ? '#f87171' : seconds <= 10 ? '#ff8c42' : '#e8a832';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-semibold leading-none" style={{ color, fontSize: size * 0.28 }}>{seconds}</span>
      </div>
    </div>
  );
}

/* ── Player Card ── */
function PlayerCard({
  participant,
  isCurrentUser,
  isWinner,
  isLoser,
  highlight = false,
}: {
  participant: Participant;
  isCurrentUser: boolean;
  isWinner: boolean;
  isLoser: boolean;
  highlight?: boolean;
}) {
  const initial = participant.userName.charAt(0).toUpperCase();
  const avatarBg = highlight ? 'rgba(156,163,175,0.3)' : 'rgba(255,140,66,0.3)';
  const avatarBorder = highlight ? '#e8a832' : 'rgba(255,140,66,0.5)';
  const avatarColor = highlight ? '#fff' : '#ff8c42';
  const seedBg = highlight ? '#e8a832' : 'rgba(255,255,255,0.6)';
  const seedColor = highlight ? '#412d00' : '#11131e';

  return (
    <div
      className="rounded-2xl p-4 md:p-5 flex flex-col items-center gap-3 transition-all duration-300"
      style={{
        background: 'rgba(50,52,64,0.5)',
        border: highlight
          ? '1.5px solid rgba(232,168,50,0.5)'
          : isWinner
            ? '1.5px solid rgba(232,168,50,0.4)'
            : '0.5px solid rgba(255,255,255,0.1)',
        boxShadow: highlight ? '0 0 24px rgba(232,168,50,0.15)' : isWinner ? '0 0 20px rgba(232,168,50,0.1)' : undefined,
        opacity: isLoser ? 0.55 : 1,
      }}
    >
      {/* Winner crown */}
      {isWinner && <span style={{ fontSize: 20 }}>👑</span>}

      {/* Avatar + seed badge */}
      <div className="relative">
        <div
          className="rounded-full flex items-center justify-center font-semibold"
          style={{ width: 52, height: 52, background: avatarBg, border: `2px solid ${avatarBorder}`, color: avatarColor, fontSize: 20 }}
        >
          {initial}
        </div>
        {participant.seed != null && (
          <div
            className="absolute rounded-full flex items-center justify-center font-bold"
            style={{ width: 18, height: 18, bottom: -2, right: -4, background: seedBg, color: seedColor, fontSize: 9 }}
          >
            {participant.seed}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <div className="font-medium text-white leading-tight" style={{ fontSize: 14 }}>
          {participant.userName}
        </div>
        {isCurrentUser && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(232,168,50,0.2)', color: '#e8a832' }}>BẠN</span>
        )}
        {participant.seed != null && !isCurrentUser && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 }}>Seed #{participant.seed}</div>
        )}
      </div>

      {/* Hearts */}
      <HeartRow lives={participant.lives} size={14} />

      {/* Stats */}
      {(participant.correctCount != null || participant.score > 0) && (
        <div className="w-full pt-2 mt-1 flex justify-between items-center" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div className="text-center">
            <div className="text-[9px] tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>ĐÚNG / SAI</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              <span style={{ color: '#97C459' }}>{participant.correctCount ?? participant.score}</span>
              {participant.wrongCount != null && <span style={{ color: 'rgba(255,255,255,0.4)' }}> / </span>}
              {participant.wrongCount != null && <span style={{ color: '#f87171' }}>{participant.wrongCount}</span>}
            </div>
          </div>
          {participant.avgSpeed != null && (
            <div className="text-center">
              <div className="text-[9px] tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>TỐC ĐỘ TB</div>
              <div className="text-white font-medium" style={{ fontSize: 13 }}>{participant.avgSpeed.toFixed(1)}s</div>
            </div>
          )}
        </div>
      )}
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
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${left}%`, top: '-5%',
              width: size, height: size * 0.6,
              background: `linear-gradient(${Math.random() * 360}deg, #e8a832, #e7c268, #f8bd45)`,
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
const TournamentMatch: React.FC = () => {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [match, setMatch] = useState<Match | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [totalRounds, setTotalRounds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forfeitLoading, setForfeitLoading] = useState(false);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);

  const fetchMatch = useCallback(async () => {
    if (!id || !matchId) return;
    try {
      const res = await api.get(`/api/tournaments/${id}/bracket`);
      const data: BracketData = res.data;
      setTournamentName(data.name);
      setTotalRounds(data.totalRounds);
      let found: Match | null = null;
      for (const roundMatches of Object.values(data.rounds)) {
        for (const m of roundMatches) {
          if (m.matchId === matchId) { found = m; break; }
        }
        if (found) break;
      }
      if (found) {
        setMatch(found);
        if (found.status === 'COMPLETED' && !showWinnerOverlay) setShowWinnerOverlay(true);
        setError('');
      } else {
        setError(t('tournaments.matchNotFound'));
      }
    } catch (err: any) {
      if (!match) setError(err.response?.data?.message || t('tournaments.errorLoadMatch'));
    } finally {
      setLoading(false);
    }
  }, [id, matchId, match, showWinnerOverlay, t]);

  useEffect(() => { fetchMatch(); }, [id, matchId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!match || match.status !== 'IN_PROGRESS') return;
    const iv = setInterval(fetchMatch, 5000);
    return () => clearInterval(iv);
  }, [match?.status, fetchMatch]);

  const handleForfeit = async () => {
    if (!id || !matchId) return;
    setForfeitLoading(true);
    try {
      await api.post(`/api/tournaments/${id}/matches/${matchId}/forfeit`);
      await fetchMatch();
    } catch (err: any) {
      alert(err.response?.data?.message || t('tournaments.cannotForfeit'));
    } finally { setForfeitLoading(false); }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#11131e' }}>
        <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#e8a832' }} />
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('tournaments.loadingMatch')}</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error && !match) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#11131e' }}>
        <div className="glass-card rounded-2xl p-12 text-center max-w-md w-full">
          <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#f87171' }}>error</span>
          <p className="text-sm mb-6" style={{ color: '#f87171' }}>{error}</p>
          <button
            className="px-6 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(232,168,50,0.1)', border: '0.5px solid rgba(232,168,50,0.3)', color: '#e8a832' }}
            onClick={() => { setLoading(true); setError(''); fetchMatch(); }}
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const p1 = match.participants[0] ?? null;
  const p2 = match.participants[1] ?? null;
  const winner = match.participants.find(p => p.isWinner);
  const roundLabel = totalRounds > 0 ? getRoundLabel(match.roundNumber, totalRounds) : `Vòng ${match.roundNumber}`;
  const currentUserId = user?.email ?? user?.id ?? '';

  const isP1Current = !!p1 && p1.userId === currentUserId;
  const meParticipant = match.participants.find(p => p.userId === currentUserId);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(232,168,50,0.03), rgba(168,85,247,0.03), #11131e)' }}>
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none" style={{ width: 600, height: 400, background: 'rgba(232,168,50,0.04)', filter: 'blur(120px)' }} />

      {/* ── Floating Header ── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '0.5px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate(`/tournaments/${id}`)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span className="hidden sm:inline">{t('tournaments.backToBracket')}</span>
          <span className="sm:hidden">Bỏ</span>
        </button>

        <div className="flex items-center gap-2">
          {tournamentName && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
              style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832', border: '0.5px solid rgba(232,168,50,0.3)' }}
            >
              🏆 {tournamentName} — {roundLabel}
            </span>
          )}
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Match #{match.matchIndex + 1}
          </span>
        </div>

        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
        >
          <span className="material-symbols-outlined text-sm">settings</span>
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── BYE match ── */}
        {match.isBye && (
          <div className="glass-card rounded-2xl p-10 text-center">
            <span className="text-5xl block mb-4">🛡️</span>
            <p className="text-white font-bold text-lg mb-2">{t('tournaments.byeMatch')}</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('tournaments.byeDesc')}</p>
            {p1 && (
              <div className="inline-flex items-center gap-3 rounded-full px-5 py-2" style={{ background: 'rgba(232,168,50,0.1)', border: '0.5px solid rgba(232,168,50,0.2)' }}>
                <span style={{ color: '#e8a832' }}>🏆</span>
                <span className="font-bold" style={{ color: '#e8a832' }}>{p1.userName}</span>
              </div>
            )}
          </div>
        )}

        {/* ── PENDING match ── */}
        {!match.isBye && match.status === 'PENDING' && (
          <div className="glass-card rounded-2xl p-10 text-center">
            <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'rgba(255,255,255,0.3)' }}>hourglass_empty</span>
            <p className="text-white font-bold text-lg mb-6">{t('tournaments.pendingMatch')}</p>
            {p1 && p2 && (
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-2" style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832' }}>
                    {p1.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-white">{p1.userName}</span>
                </div>
                <span className="font-black text-xl" style={{ color: 'rgba(255,255,255,0.3)' }}>VS</span>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-2" style={{ background: 'rgba(232,168,50,0.15)', color: '#e8a832' }}>
                    {p2.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-white">{p2.userName}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── IN_PROGRESS or COMPLETED ── */}
        {!match.isBye && (match.status === 'IN_PROGRESS' || match.status === 'COMPLETED') && (
          <>
            {/* Live badge */}
            {match.status === 'IN_PROGRESS' && (
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#97C459' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#97C459' }} />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#97C459' }}>LIVE</span>
              </div>
            )}

            {/* 3-column VS layout */}
            <div className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
              {/* Player 1 */}
              {p1 ? (
                <PlayerCard
                  participant={p1}
                  isCurrentUser={p1.userId === currentUserId}
                  isWinner={match.status === 'COMPLETED' && p1.isWinner}
                  isLoser={match.status === 'COMPLETED' && !p1.isWinner}
                  highlight={p1.userId === currentUserId}
                />
              ) : (
                <div className="glass-card rounded-2xl p-6 text-center" style={{ opacity: 0.4 }}>
                  <div className="text-3xl mb-2">?</div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>TBD</div>
                </div>
              )}

              {/* Center: timer + VS */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                {match.status === 'IN_PROGRESS' ? (
                  <>
                    <TimerCircle seconds={15} maxSeconds={15} size={72} />
                    <div className="px-3 py-1 rounded-full text-[10px] font-medium" style={{ background: 'rgba(232,168,50,0.1)', border: '0.5px solid rgba(232,168,50,0.3)', color: '#e8a832' }}>
                      ⚔️ VS
                    </div>
                  </>
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(50,52,64,0.6)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#e8a832', fontSize: 20 }}>swords</span>
                  </div>
                )}
              </div>

              {/* Player 2 */}
              {p2 ? (
                <PlayerCard
                  participant={p2}
                  isCurrentUser={p2.userId === currentUserId}
                  isWinner={match.status === 'COMPLETED' && p2.isWinner}
                  isLoser={match.status === 'COMPLETED' && !p2.isWinner}
                  highlight={p2.userId === currentUserId}
                />
              ) : (
                <div className="glass-card rounded-2xl p-6 text-center" style={{ opacity: 0.4 }}>
                  <div className="text-3xl mb-2">?</div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>TBD</div>
                </div>
              )}
            </div>

            {/* Stats mini row (mobile compact) */}
            {meParticipant && match.status === 'IN_PROGRESS' && (
              <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(50,52,64,0.4)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Bạn:</span>
                  <span className="text-[11px] font-medium" style={{ color: '#97C459' }}>{meParticipant.score}đ</span>
                  {meParticipant.avgSpeed != null && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{meParticipant.avgSpeed.toFixed(1)}s</span>
                    </>
                  )}
                </div>
                {p1 && p2 && (() => {
                  const opponent = p1.userId === currentUserId ? p2 : p1;
                  return (
                    <div className="flex-1 flex items-center gap-2 justify-end rounded-lg px-3 py-2" style={{ background: 'rgba(50,52,64,0.4)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      {opponent.avgSpeed != null && (
                        <>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{opponent.avgSpeed.toFixed(1)}s</span>
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                        </>
                      )}
                      <span className="text-[11px] font-medium text-white">{opponent.score}đ</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>:Đối thủ</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Forfeit button */}
            {match.status === 'IN_PROGRESS' && (
              <div className="text-center">
                <button
                  onClick={handleForfeit}
                  disabled={forfeitLoading}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">flag</span>
                    {forfeitLoading ? t('tournaments.forfeiting') : t('tournaments.forfeit')}
                  </span>
                </button>
              </div>
            )}

            {/* Back button for completed */}
            {match.status === 'COMPLETED' && !showWinnerOverlay && (
              <div className="text-center">
                <button
                  onClick={() => navigate(`/tournaments/${id}`)}
                  className="px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:scale-105 transition-transform"
                  style={{ background: '#e8a832', color: '#412d00', boxShadow: '0 0 20px rgba(232,168,50,0.25)' }}
                >
                  {t('tournaments.backToBracket')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Winner Overlay ── */}
      {showWinnerOverlay && match.status === 'COMPLETED' && winner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowWinnerOverlay(false)}
        >
          <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'rgba(17,19,30,0.9)' }} />
          <GoldConfetti />
          <div className="relative z-10 text-center px-6 max-w-md">
            <span className="material-symbols-outlined text-7xl mb-4 block" style={{ color: '#e8a832', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-4"
              style={{ background: 'rgba(232,168,50,0.2)', border: '2px solid rgba(232,168,50,0.5)', color: '#e8a832', boxShadow: '0 0 40px rgba(232,168,50,0.3)' }}
            >
              {winner.userName.charAt(0).toUpperCase()}
            </div>
            <p className="text-3xl md:text-4xl font-black mb-2" style={{ color: '#e8a832' }}>{winner.userName}</p>
            <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>{t('tournaments.wonMatch')}</p>
            <button
              className="px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              style={{ background: '#e8a832', color: '#412d00', boxShadow: '0 0 30px rgba(232,168,50,0.35)' }}
              onClick={(e) => { e.stopPropagation(); navigate(`/tournaments/${id}`); }}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                {t('tournaments.continue')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentMatch;
