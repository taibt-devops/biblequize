import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';

interface Member {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
}

interface Group {
  id: string;
  name: string;
  code: string;
  description?: string;
  isPublic: boolean;
  maxMembers: number;
  members: Member[];
  leaderUserId: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  score: number;
  role?: string;
}

interface Announcement {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

interface QuizSet {
  id: string;
  name: string;
  questionCount: number;
  createdAt: string;
}

type TabKey = 'leaderboard' | 'members' | 'announcements' | 'quizsets';

const GROUP_BANNER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDFnTx3fGDw7x7TL7ge8vDEEkbSjq2ai-wsyEd__vq0byTyOGvi3d1WQJV-Z692ksccl6DDoOTaPZ-RL6J3WDmSBY0g8tNHqXPey9lmDhtJm5uWerKyh-E_CoWIffIBMnkKidiZmdYyryDzyan-U5KggGWHq86m0LjMDFuhdre8DhsrG1bfRTGgMv0gcxaS723-h-Ktb7hs3pnVXl86T0Bxzczh42s-_TVCqF9GGN9tV6Evi0FZeIe1ilRaSLf4vwUHB7Q31bszVCE';

const GROUP_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD4sJ4N_X2MNRMMd3yaZH9kLp_-xyJ4GqF9FvdK1dAW0P1U3HdpQYGd1pIgSJzNDOc44IwaqQIjthMlpuDdh5pYmQ2jNq3KaGX4HvM7hfZGtpiiP4mR5ak9Inm0c7b_s_pgenTSwlf77RToeW07Qk-jDkuNo8rxgTF2QZFN5RzT9LZTyvzKmm4UGlKv4EFucaEvknMaxEwjnCJI-h8JklEYtOS7RH_Hx2QgMk9KnmmiDj-ard7VlrNcnYErAbV48emDvKUI6Mccb0M';

const STORAGE_KEY = 'biblequiz_my_groups';

function updateSavedGroup(group: { id: string; name: string; code: string }) {
  try {
    const groups = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const existing = groups.findIndex((g: any) => g.id === group.id);
    if (existing >= 0) {
      groups[existing] = { id: group.id, name: group.name, code: group.code };
    } else {
      groups.unshift({ id: group.id, name: group.name, code: group.code });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch { /* ignore */ }
}

function removeSavedGroup(id: string) {
  try {
    const groups = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups.filter((g: any) => g.id !== id)));
  } catch { /* ignore */ }
}

const GroupDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const TABS: { key: TabKey; label: string; icon?: string; hasNotification?: boolean }[] = [
    { key: 'leaderboard', label: t('groups.leaderboardTab') },
    { key: 'members', label: t('groups.membersTab') },
    { key: 'announcements', label: t('groups.announcementsTab'), hasNotification: true },
    { key: 'quizsets', label: t('groups.quizSetsTab') },
  ];

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Deep-link support: ?tab=members opens that tab on mount.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey | null);
  const validInitial: TabKey = initialTab && ['leaderboard', 'members', 'announcements', 'quizsets'].includes(initialTab)
    ? initialTab
    : 'leaderboard';
  const [activeTab, setActiveTab] = useState<TabKey>(validInitial);

  // Sync state → URL when user clicks a tab so deep links can be shared.
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'leaderboard') next.delete('tab');
      else next.set('tab', key);
      return next;
    }, { replace: true });
  };

  // Leaderboard
  const [period, setPeriod] = useState<'weekly' | 'all_time'>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Quiz Sets
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [quizSetsLoading, setQuizSetsLoading] = useState(false);

  // Members tab — Phase 0.3 paginated endpoint
  type MemberSort = 'score' | 'tier' | 'activity' | 'joined';
  type MemberFilter = '' | 'leader' | 'mod' | 'member' | 'inactive';
  interface PaginatedMember {
    userId: string;
    name: string;
    avatarUrl?: string;
    role: string;
    joinedAt?: string;
    lastActiveAt?: string;
    score: number;
  }
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchDebounced, setMemberSearchDebounced] = useState('');
  const [memberSort, setMemberSort] = useState<MemberSort>('score');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>(
    (searchParams.get('filter') as MemberFilter | null) ?? '',
  );
  const [memberItems, setMemberItems] = useState<PaginatedMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  // Debounce search input 300ms — avoid hammering the BE on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setMemberSearchDebounced(memberSearch), 300);
    return () => clearTimeout(handle);
  }, [memberSearch]);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [editMaxMembers, setEditMaxMembers] = useState(50);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Copy state
  const [copied, setCopied] = useState(false);

  const isLeader = group?.leaderUserId === user?.email ||
    group?.members?.some(m => m.role === 'LEADER' && m.name === user?.name);

  const isLeaderOrMod = isLeader ||
    group?.members?.some(m => (m.role === 'LEADER' || m.role === 'MODERATOR') && m.name === user?.name);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/groups/${id}`);
      if (res.data.success) {
        setGroup(res.data.group);
        updateSavedGroup(res.data.group);
      } else {
        setError(res.data.message || t('groups.errorLoadGroupInfo'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('groups.connectionError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await api.get(`/api/groups/${id}/leaderboard?period=${period}`);
      if (res.data.success) {
        setLeaderboard(res.data.leaderboard || res.data.entries || []);
      }
    } catch { /* ignore */ }
    finally { setLbLoading(false); }
  }, [id, period]);

  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await api.get(`/api/groups/${id}/announcements?limit=20&offset=0`);
      if (res.data.success) {
        setAnnouncements(res.data.announcements || []);
      }
    } catch { /* ignore */ }
    finally { setAnnouncementsLoading(false); }
  }, [id]);

  const fetchMembers = useCallback(async (cursor: string | null = null, append = false) => {
    setMemberLoading(true);
    try {
      const params = new URLSearchParams();
      if (memberSearchDebounced) params.set('search', memberSearchDebounced);
      params.set('sort', memberSort);
      params.set('order', 'desc');
      if (memberFilter) params.set('filter', memberFilter);
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      const res = await api.get(`/api/groups/${id}/members?${params.toString()}`);
      if (res.data.success) {
        const data = res.data.data ?? {};
        const items: PaginatedMember[] = data.items ?? [];
        setMemberItems((prev) => (append ? [...prev, ...items] : items));
        setMemberTotal(data.total ?? 0);
        setMemberCursor(data.nextCursor ?? null);
      }
    } catch { /* ignore */ }
    finally { setMemberLoading(false); }
  }, [id, memberSearchDebounced, memberSort, memberFilter]);

  const fetchQuizSets = useCallback(async () => {
    setQuizSetsLoading(true);
    try {
      const res = await api.get(`/api/groups/${id}/quiz-sets`);
      if (res.data.success) {
        setQuizSets(res.data.quizSets || []);
      }
    } catch { /* ignore */ }
    finally { setQuizSetsLoading(false); }
  }, [id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  useEffect(() => {
    if (!group) return;
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    } else if (activeTab === 'announcements') {
      fetchAnnouncements();
    } else if (activeTab === 'quizsets') {
      fetchQuizSets();
    } else if (activeTab === 'members') {
      fetchMembers(null, false);
    }
  }, [activeTab, group, fetchLeaderboard, fetchAnnouncements, fetchQuizSets, fetchMembers]);

  useEffect(() => {
    if (activeTab === 'leaderboard' && group) fetchLeaderboard();
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset + refetch when search / sort / filter change while on members tab
  useEffect(() => {
    if (activeTab === 'members' && group) {
      fetchMembers(null, false);
    }
  }, [memberSearchDebounced, memberSort, memberFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = group.code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKick = async (userId: string, name: string) => {
    if (!confirm(t('groups.confirmKick', { name }))) return;
    try {
      await api.delete(`/api/groups/${id}/members/${userId}`);
      fetchGroup();
      if (activeTab === 'members') fetchMembers(null, false);
    } catch { /* ignore */ }
  };

  const handleChangeRole = async (userId: string, newRole: 'MEMBER' | 'MOD') => {
    try {
      await api.patch(`/api/groups/${id}/members/${userId}/role`, { role: newRole });
      fetchGroup();
      if (activeTab === 'members') fetchMembers(null, false);
    } catch { /* ignore — backend returns 400 with reason on conflicts */ }
  };

  const formatRelativeTime = (iso?: string): string => {
    if (!iso) return '—';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    if (diff < 60_000) return t('groups.timeJustNow');
    if (diff < 3_600_000) return t('groups.timeMinutesAgo', { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('groups.timeHoursAgo', { count: Math.floor(diff / 3_600_000) });
    return t('groups.timeDaysAgo', { count: Math.floor(diff / 86_400_000) });
  };

  const isInactive = (member: PaginatedMember): boolean => {
    if (!member.lastActiveAt) return true;
    const ts = new Date(member.lastActiveAt).getTime();
    return Date.now() - ts > 7 * 86_400_000;
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    setPostingAnnouncement(true);
    try {
      const res = await api.post(`/api/groups/${id}/announcements`, {
        content: newAnnouncement.trim(),
      });
      if (res.data.success) {
        setNewAnnouncement('');
        fetchAnnouncements();
      }
    } catch { /* ignore */ }
    finally { setPostingAnnouncement(false); }
  };

  const handleLeave = async () => {
    if (!confirm(t('groups.confirmLeave'))) return;
    try {
      await api.delete(`/api/groups/${id}/leave`);
      removeSavedGroup(id!);
      navigate('/groups');
    } catch { /* ignore */ }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      const res = await api.patch(`/api/groups/${id}`, {
        name: editName.trim(),
        description: editDesc.trim(),
        isPublic: editPublic,
        maxMembers: editMaxMembers,
      });
      if (res.data.success) {
        setShowEditModal(false);
        fetchGroup();
      } else {
        setEditError(res.data.message || t('groups.updateFailed'));
      }
    } catch (err: any) {
      setEditError(err.response?.data?.message || t('groups.connectionError'));
    } finally {
      setEditLoading(false);
    }
  };

  const openEditModal = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDesc(group.description || '');
    setEditPublic(group.isPublic);
    setEditMaxMembers(group.maxMembers);
    setEditError('');
    setShowEditModal(true);
  };

  // -- Render --

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-secondary/20 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="px-12 py-20">
        <div className="bg-surface-container rounded-2xl p-12 text-center border border-outline-variant/10">
          <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <p className="text-error font-bold mb-6">{error || t('groups.groupNotFound')}</p>
          <button
            onClick={fetchGroup}
            className="px-6 py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-sm hover:bg-surface-bright transition-all"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const totalXp = leaderboard.reduce((sum, e) => sum + (e.score || 0), 0);
  const leader = group.members?.find(m => m.role === 'LEADER');
  const top3 = leaderboard.slice(0, 3);
  const restLeaderboard = leaderboard.slice(3);

  return (
    <div className="relative pb-20" data-testid="group-detail-page">

      {/* ── Hero Header ── */}
      <header className="relative w-full h-[360px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent z-10" />
        <img
          alt="Church Interior"
          className="w-full h-full object-cover scale-105"
          src={GROUP_BANNER}
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-end px-12 pb-12">
          <div className="flex items-end gap-8">
            {/* Group Logo */}
            <div className="w-32 h-32 rounded-3xl bg-surface-container-high border-4 border-surface shadow-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
              <img alt="Group Logo" className="w-full h-full object-cover" src={GROUP_LOGO} />
            </div>
            {/* Group Info */}
            <div className="flex-grow min-w-0" data-testid="group-detail-name">
              <div className="flex items-center gap-4 mb-2">
                <span className="bg-secondary/20 text-secondary text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                  {group.isPublic ? 'OPEN' : 'PRIVATE'}
                </span>
                {group.isPublic && (
                  <span className="text-on-surface-variant flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-sm">public</span> {t('groups.publicGroup')}
                  </span>
                )}
                {/* Invite Code Chip */}
                <button
                  data-testid="group-join-code"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-secondary transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  {copied ? t('groups.copied') : group.code}
                </button>
              </div>
              <h1 data-testid="group-name-heading" className="text-5xl font-black text-on-surface tracking-tighter mb-2 truncate">
                {group.name?.trim() || t('groups.untitledGroup')}
              </h1>
              {group.description && (
                <p className="text-on-surface-variant max-w-2xl font-medium leading-relaxed line-clamp-2">
                  {group.description}
                </p>
              )}
            </div>
            {/* Action Buttons */}
            <div className="flex gap-3 mb-4 flex-shrink-0">
              {isLeader ? (
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-2 bg-surface-container-highest hover:bg-surface-variant text-on-surface px-6 py-3 rounded-xl font-bold transition-all border border-outline-variant/15"
                >
                  <span className="material-symbols-outlined">settings</span>
                  {t('groups.settings')}
                </button>
              ) : (
                <button
                  data-testid="group-leave-btn"
                  onClick={handleLeave}
                  className="flex items-center gap-2 bg-surface-container-highest hover:bg-surface-variant text-on-surface px-6 py-3 rounded-xl font-bold transition-all border border-outline-variant/15"
                >
                  <span className="material-symbols-outlined">logout</span>
                  {t('groups.leaveGroup')}
                </button>
              )}
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 gold-gradient text-on-secondary px-8 py-3 rounded-xl font-bold shadow-lg shadow-secondary/10 transition-transform active:scale-95"
              >
                <span className="material-symbols-outlined">person_add</span>
                {t('groups.invite')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <section className="px-12 -mt-6 relative z-30">
        <div className="grid grid-cols-4 gap-6">
          {/* Members */}
          <div className="col-span-1 glass-card p-6 rounded-2xl flex items-center gap-5 border border-outline-variant/10">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">groups</span>
            </div>
            <div>
              <p data-testid="group-member-count" className="text-2xl font-black text-on-surface">{group.members?.length || 0}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{t('groups.members')}</p>
            </div>
          </div>
          {/* Total XP */}
          <div className="col-span-1 glass-card p-6 rounded-2xl flex items-center gap-5 border border-outline-variant/10">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            </div>
            <div>
              <p className="text-2xl font-black text-on-surface">{(totalXp ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{t('groups.totalXP')}</p>
            </div>
          </div>
          {/* Max Members */}
          <div className="col-span-1 glass-card p-6 rounded-2xl flex items-center gap-5 border border-outline-variant/10">
            <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-3xl">workspace_premium</span>
            </div>
            <div>
              <p className="text-2xl font-black text-on-surface">{group.maxMembers}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{t('groups.limit')}</p>
            </div>
          </div>
          {/* Leader Mini Card */}
          <div className="col-span-1 glass-card p-4 rounded-2xl border border-secondary/30 flex items-center justify-between bg-secondary/5">
            <div className="pl-2 flex items-center gap-3 min-w-0">
              {leader && (
                <>
                  <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center text-secondary font-black flex-shrink-0 overflow-hidden">
                    {leader.avatarUrl ? (
                      <img src={leader.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      leader.name?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-on-surface font-bold text-sm truncate">{leader.name}</p>
                    <p className="text-xs text-on-surface-variant">{t('groups.groupLeader')}</p>
                  </div>
                </>
              )}
              {!leader && (
                <div>
                  <p className="text-on-surface font-bold text-sm">--</p>
                  <p className="text-xs text-on-surface-variant">{t('groups.groupLeader')}</p>
                </div>
              )}
            </div>
            {isLeader && (
              <Link to={`/groups/${id}/analytics`} className="bg-secondary text-on-secondary p-3 rounded-xl flex-shrink-0">
                <span className="material-symbols-outlined">analytics</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── Tab Navigation (underline style) ── */}
        <nav className="mt-12 flex items-center gap-10 border-b border-outline-variant/15 overflow-x-auto whitespace-nowrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`pb-4 px-2 font-bold text-sm tracking-wide transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'text-secondary border-b-2 border-secondary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
              {tab.hasNotification && announcements.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-error" />
              )}
            </button>
          ))}
        </nav>
      </section>

      {/* ── Tab Content ── */}

      {/* ===== LEADERBOARD TAB ===== */}
      {activeTab === 'leaderboard' && (
        <section className="px-12 mt-10" data-testid="group-leaderboard">
          {/* Period Toggle */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-3xl">leaderboard</span>
              {t('groups.leaderboardTitle')}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('weekly')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === 'weekly'
                    ? 'bg-secondary/15 text-secondary'
                    : 'text-on-surface-variant hover:text-on-surface bg-surface-container-high'
                }`}
              >
                {t('groups.weekly')}
              </button>
              <button
                onClick={() => setPeriod('all_time')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === 'all_time'
                    ? 'bg-secondary/15 text-secondary'
                    : 'text-on-surface-variant hover:text-on-surface bg-surface-container-high'
                }`}
              >
                {t('groups.allTime')}
              </button>
            </div>
          </div>

          {lbLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-secondary/20 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">emoji_events</span>
              <p className="text-sm text-on-surface-variant font-bold">{t('groups.noRankingData')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-8">
              {/* Podium Top 3 */}
              {top3.length > 0 && (
                <div className="col-span-12 flex justify-center items-end gap-8 pb-10">
                  {/* 2nd Place */}
                  {top3[1] && (
                    <div className="flex flex-col items-center group">
                      <div className="relative mb-4">
                        <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-outline to-surface-variant">
                          {top3[1].avatarUrl ? (
                            <img alt={top3[1].name} className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" src={top3[1].avatarUrl} />
                          ) : (
                            <div className="w-full h-full rounded-full bg-surface-container-highest flex items-center justify-center text-2xl font-black text-on-surface-variant grayscale group-hover:grayscale-0 transition-all">
                              {top3[1].name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface">2</div>
                      </div>
                      <p className="font-bold text-on-surface">{top3[1].name}</p>
                      <p className="text-xs text-on-surface-variant mb-3">{top3[1].role === 'LEADER' ? t('groups.leaderRole') : top3[1].role === 'MODERATOR' ? t('groups.moderatorRole') : t('groups.memberRole')}</p>
                      <div className="px-4 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-black">{(top3[1].score ?? 0).toLocaleString()} XP</div>
                    </div>
                  )}
                  {/* 1st Place */}
                  {top3[0] && (
                    <div className="flex flex-col items-center group -translate-y-4">
                      <div className="relative mb-4">
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-secondary scale-150 animate-bounce">
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                        </div>
                        <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-tr from-secondary to-tertiary">
                          {top3[0].avatarUrl ? (
                            <img alt={top3[0].name} className="w-full h-full rounded-full object-cover" src={top3[0].avatarUrl} />
                          ) : (
                            <div className="w-full h-full rounded-full bg-secondary/15 flex items-center justify-center text-3xl font-black text-secondary">
                              {top3[0].name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 gold-gradient text-on-secondary text-sm font-black w-10 h-10 rounded-full flex items-center justify-center border-4 border-surface shadow-lg">1</div>
                      </div>
                      <p className="font-black text-lg text-on-surface">{top3[0].name}</p>
                      <p className="text-xs text-secondary mb-3 font-bold">{top3[0].role === 'LEADER' ? t('groups.leaderRole') : top3[0].role === 'MODERATOR' ? t('groups.moderatorRole') : t('groups.memberRole')}</p>
                      <div className="px-6 py-2 rounded-full gold-gradient text-on-secondary text-sm font-black shadow-xl shadow-secondary/20">{(top3[0].score ?? 0).toLocaleString()} XP</div>
                    </div>
                  )}
                  {/* 3rd Place */}
                  {top3[2] && (
                    <div className="flex flex-col items-center group">
                      <div className="relative mb-4">
                        <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-tertiary to-surface-variant">
                          {top3[2].avatarUrl ? (
                            <img alt={top3[2].name} className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" src={top3[2].avatarUrl} />
                          ) : (
                            <div className="w-full h-full rounded-full bg-surface-container-highest flex items-center justify-center text-xl font-black text-on-surface-variant grayscale group-hover:grayscale-0 transition-all">
                              {top3[2].name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface">3</div>
                      </div>
                      <p className="font-bold text-on-surface">{top3[2].name}</p>
                      <p className="text-xs text-on-surface-variant mb-3">{top3[2].role === 'LEADER' ? t('groups.leaderRole') : top3[2].role === 'MODERATOR' ? t('groups.moderatorRole') : t('groups.memberRole')}</p>
                      <div className="px-4 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-black">{(top3[2].score ?? 0).toLocaleString()} XP</div>
                    </div>
                  )}
                </div>
              )}

              {/* Full Leaderboard Table */}
              {restLeaderboard.length > 0 && (
                <div className="col-span-12 glass-card rounded-3xl overflow-hidden border border-outline-variant/10">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high/50 text-left">
                        <th className="py-5 px-8 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{t('groups.rankColumn')}</th>
                        <th className="py-5 px-8 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{t('groups.memberColumn')}</th>
                        <th className="py-5 px-8 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{t('groups.roleColumn')}</th>
                        <th className="py-5 px-8 text-right text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{t('groups.totalXP')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {restLeaderboard.map((entry, i) => {
                        const isCurrentUser = entry.name === user?.name;
                        return (
                          <tr
                            key={entry.userId}
                            className={`transition-colors group ${
                              isCurrentUser
                                ? 'bg-secondary/5 border-l-4 border-secondary'
                                : 'hover:bg-surface-container-high/30'
                            }`}
                          >
                            <td className={`py-5 px-8 font-black ${isCurrentUser ? 'text-secondary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                              {String(i + 4).padStart(2, '0')}
                            </td>
                            <td className="py-5 px-8">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 ${
                                  isCurrentUser ? 'bg-secondary/20 ring-2 ring-secondary/50 ring-offset-2 ring-offset-surface' : 'bg-surface-container-highest'
                                }`}>
                                  {entry.avatarUrl ? (
                                    <img alt={entry.name} className="w-full h-full object-cover" src={entry.avatarUrl} />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center font-black text-on-surface-variant">
                                      {entry.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-on-surface">
                                    {entry.name}{isCurrentUser && ` (${t('groups.you')})`}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="text-[10px] text-secondary font-bold uppercase tracking-tighter">{t('groups.levelUpSoon')}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-8">
                              <span className="px-3 py-1 rounded-lg bg-surface-container-highest text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
                                {entry.role === 'LEADER' ? t('groups.leaderRole') : entry.role === 'MODERATOR' ? t('groups.moderatorRole') : t('groups.memberRole')}
                              </span>
                            </td>
                            <td className="py-5 px-8 text-right font-black text-on-surface">{(entry.score ?? 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===== MEMBERS TAB (mockup: groups_member_list_expanded.html) ===== */}
      {activeTab === 'members' && (
        <section className="px-6 lg:px-12 mt-8" data-testid="group-detail-members">
          {/* Header + search + sort */}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div>
              <div className="text-on-surface text-[18px] font-medium">
                {t('groups.membersHeader', { count: memberTotal || group.members?.length || 0 })}
              </div>
              <div className="text-on-surface/50 text-[11px] mt-0.5">
                {t('groups.membersHeaderSubtitle', {
                  active: memberItems.filter((m) => !isInactive(m)).length,
                  inactive: memberItems.filter((m) => isInactive(m)).length,
                })}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.08] rounded-lg px-3 py-2 flex items-center gap-2 min-w-[220px]">
                <span className="text-[12px] text-on-surface/40">🔍</span>
                <input
                  className="bg-transparent border-0 outline-none text-on-surface text-[12px] flex-1"
                  placeholder={t('groups.memberSearchPlaceholder')}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="inline-flex bg-black/30 rounded-md p-0.5">
                {(['score', 'tier', 'activity'] as MemberSort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setMemberSort(s)}
                    className={`border-0 px-3 py-1.5 rounded text-[11px] font-medium cursor-pointer transition-all ${
                      memberSort === s ? 'bg-secondary text-on-secondary' : 'bg-transparent text-on-surface/55'
                    }`}
                  >
                    {s === 'score' ? t('groups.sortByScore') : s === 'tier' ? t('groups.sortByTier') : t('groups.sortByActivity')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {([
              ['', t('groups.filterAll')],
              ['leader', `👑 ${t('groups.filterLeader')}`],
              ['mod', `🛡️ ${t('groups.filterMod')}`],
              ['member', t('groups.filterMember')],
              ['inactive', t('groups.filterInactive')],
            ] as Array<[MemberFilter, string]>).map(([key, label]) => {
              const active = memberFilter === key;
              const isInactiveChip = key === 'inactive';
              return (
                <button
                  key={key}
                  onClick={() => setMemberFilter(key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium border-[0.5px] cursor-pointer transition-all ${
                    active
                      ? isInactiveChip
                        ? 'bg-[rgba(255,140,66,0.15)] text-[#ff8c42] border-[rgba(255,140,66,0.4)]'
                        : 'bg-[rgba(232,168,50,0.15)] text-secondary border-[rgba(232,168,50,0.4)]'
                      : isInactiveChip
                      ? 'bg-[rgba(255,140,66,0.08)] text-[#ff8c42] border-[rgba(255,140,66,0.3)]'
                      : 'bg-white/[0.04] text-on-surface/60 border-white/10'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {memberLoading && memberItems.length === 0 ? (
            <div className="bg-[rgba(50,52,64,0.3)] rounded-xl py-10 text-center">
              <div className="w-8 h-8 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin mx-auto" />
            </div>
          ) : memberItems.length === 0 ? (
            <div className="bg-[rgba(50,52,64,0.3)] rounded-xl py-10 text-center text-on-surface/50 text-[12px]">
              {t('groups.noMembersFound')}
            </div>
          ) : (
            <div className="bg-[rgba(50,52,64,0.3)] border-[0.5px] border-white/[0.06] rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[40px_1fr_100px_100px_100px_60px] gap-3 px-4 py-2.5 bg-black/20 border-b-[0.5px] border-white/[0.06] items-center">
                <div className="text-on-surface/40 text-[9px] font-medium tracking-wider">#</div>
                <div className="text-on-surface/40 text-[9px] font-medium tracking-wider">{t('groups.colMember')}</div>
                <div className="text-on-surface/40 text-[9px] font-medium tracking-wider text-right">{t('groups.colWeekScore')}</div>
                <div className="text-on-surface/40 text-[9px] font-medium tracking-wider text-right">{t('groups.colStreak')}</div>
                <div className="text-on-surface/40 text-[9px] font-medium tracking-wider text-right">{t('groups.colLastActive')}</div>
                <div></div>
              </div>

              {/* Rows */}
              {memberItems.map((m, idx) => {
                const isMe = m.name === user?.name;
                const isMemberLeader = m.role === 'LEADER';
                const isMemberMod = m.role === 'MOD' || m.role === 'MODERATOR';
                const inactive = isInactive(m);
                const tierColor = isMemberLeader ? '#e8a832' : '#6AB8E8';

                return (
                  <div
                    key={m.userId}
                    className={`grid grid-cols-[40px_1fr_100px_100px_100px_60px] gap-3 px-4 py-2.5 items-center border-b-[0.5px] border-white/[0.04] ${
                      isMe ? 'bg-[rgba(232,168,50,0.08)] border-l-2 border-l-secondary' : isMemberLeader ? 'bg-[rgba(232,168,50,0.05)]' : ''
                    } ${inactive ? 'opacity-60' : ''}`}
                  >
                    <div className={`text-[13px] font-medium text-center ${isMe || isMemberLeader ? 'text-secondary' : 'text-on-surface/50'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0 ${
                          isMemberLeader
                            ? 'bg-[rgba(232,168,50,0.3)] border-[1.5px] border-secondary text-secondary'
                            : isMemberMod
                            ? 'bg-[rgba(168,85,247,0.3)] text-[#c084fc]'
                            : inactive
                            ? 'bg-[rgba(255,140,66,0.2)] text-[rgba(255,140,66,0.7)]'
                            : 'bg-[rgba(74,158,255,0.3)] text-[#6AB8E8]'
                        }`}
                      >
                        {m.avatarUrl ? (
                          <img alt={m.name} src={m.avatarUrl} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (m.name || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-on-surface text-[12px] font-medium flex items-center gap-1.5 truncate">
                          {m.name}
                          {isMemberLeader && (
                            <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-1.5 py-px rounded-full text-[9px] flex-shrink-0">
                              👑 {t('groups.filterLeader')}
                            </span>
                          )}
                          {isMemberMod && (
                            <span className="bg-[rgba(74,158,255,0.15)] text-[#6AB8E8] px-1.5 py-px rounded-full text-[9px] flex-shrink-0">
                              🛡️ {t('groups.filterMod')}
                            </span>
                          )}
                          {isMe && (
                            <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-1.5 py-px rounded-full text-[9px] flex-shrink-0">
                              {t('groups.youBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px]" style={{ color: inactive ? 'rgba(255,140,66,0.6)' : tierColor }}>
                          {inactive ? t('groups.inactiveBadge') : t('groups.memberRole')}
                        </div>
                      </div>
                    </div>
                    <div className={`text-[13px] font-medium text-right ${isMe || isMemberLeader ? 'text-secondary' : 'text-on-surface'}`}>
                      {(m.score ?? 0).toLocaleString()}
                    </div>
                    <div className="text-on-surface/40 text-[12px] text-right">— 0</div>
                    <div className={`text-[11px] text-right ${inactive ? 'text-[rgba(255,140,66,0.7)]' : 'text-on-surface/55'}`}>
                      {formatRelativeTime(m.lastActiveAt ?? m.joinedAt)}
                    </div>
                    <div className="text-right flex justify-end gap-1">
                      {inactive && isLeaderOrMod && (
                        <button
                          onClick={() => alert(t('groups.remindCta'))}
                          className="bg-[rgba(255,140,66,0.15)] text-[#ff8c42] border-[0.5px] border-[rgba(255,140,66,0.4)] rounded-[4px] px-2 py-0.5 text-[10px] cursor-pointer hover:brightness-125"
                        >
                          {t('groups.remindCta')}
                        </button>
                      )}
                      {isLeader && !isMemberLeader && !isMe && (
                        <details className="relative inline-block">
                          <summary className="list-none cursor-pointer text-on-surface/30 text-[14px] hover:text-on-surface/70">⋯</summary>
                          <div className="absolute right-0 top-full mt-1 z-10 bg-surface-container border-[0.5px] border-white/10 rounded-lg shadow-lg py-1 min-w-[160px]">
                            {!isMemberMod ? (
                              <button
                                onClick={() => handleChangeRole(m.userId, 'MOD')}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-on-surface hover:bg-white/5"
                              >
                                {t('groups.promoteToMod')}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeRole(m.userId, 'MEMBER')}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-on-surface hover:bg-white/5"
                              >
                                {t('groups.demoteToMember')}
                              </button>
                            )}
                            <button
                              onClick={() => handleKick(m.userId, m.name)}
                              className="w-full text-left px-3 py-1.5 text-[11px] text-error hover:bg-error/10"
                            >
                              {t('groups.removeMember')}
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {memberCursor && (
                <div className="px-4 py-3 text-center bg-black/20">
                  <button
                    onClick={() => fetchMembers(memberCursor, true)}
                    disabled={memberLoading}
                    className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-md px-5 py-2 text-[11px] cursor-pointer hover:bg-white/10 disabled:opacity-50"
                  >
                    {memberLoading ? '...' : `${t('groups.loadMore')} →`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===== ANNOUNCEMENTS TAB ===== */}
      {activeTab === 'announcements' && (
        <section className="px-12 mt-10 space-y-8">
          {/* Post Announcement (Leader/Mod only) */}
          {isLeaderOrMod && (
            <div className="glass-card rounded-2xl p-6 border border-outline-variant/10">
              <div className="flex gap-3">
                <input
                  className="flex-1 px-5 py-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10 text-on-surface font-medium text-sm outline-none focus:border-secondary/30 transition-all placeholder:text-on-surface-variant/50"
                  value={newAnnouncement}
                  onChange={e => setNewAnnouncement(e.target.value)}
                  placeholder={t('groups.writeAnnouncement')}
                  onKeyDown={e => e.key === 'Enter' && handlePostAnnouncement()}
                />
                <button
                  onClick={handlePostAnnouncement}
                  disabled={postingAnnouncement || !newAnnouncement.trim()}
                  className="px-6 py-3.5 gold-gradient text-on-secondary rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(232,168,50,0.3)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  {postingAnnouncement ? '...' : t('groups.send')}
                </button>
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="glass-card rounded-3xl p-10 border border-outline-variant/10">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-secondary text-3xl">timeline</span>
              {t('groups.recentActivity')}
            </h2>

            {announcementsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">history</span>
                <p className="text-sm text-on-surface-variant font-bold">{t('groups.noActivity')}</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-outline-variant/15" />
                <div className="space-y-8">
                  {announcements.map(a => (
                    <article key={a.id} className="relative flex gap-5 group/item">
                      {/* Timeline dot */}
                      <div className="relative z-10 mt-1.5 flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-secondary/30 flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary text-[18px]">campaign</span>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 group-hover/item:border-secondary/10 transition-all">
                        <p className="text-sm text-on-surface leading-relaxed font-medium mb-3">
                          {a.body}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          {a.author}
                          <span className="mx-1 opacity-30">|</span>
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== QUIZ SETS TAB ===== */}
      {activeTab === 'quizsets' && (
        <section className="px-12 mt-10">
          <div className="glass-card rounded-3xl p-10 border border-outline-variant/10">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-tertiary text-3xl">quiz</span>
              {t('groups.quizSets')}
            </h2>
            {quizSetsLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              </div>
            ) : quizSets.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">description</span>
                <p className="text-xs text-on-surface-variant font-bold">{t('groups.noQuizSets')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quizSets.map(qs => (
                  <div key={qs.id} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-all border border-outline-variant/5">
                    <div>
                      <p className="font-bold text-sm text-on-surface">{qs.name}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{t('groups.questionsCount', { count: qs.questionCount })}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-xl">chevron_right</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Footer Actions ── */}
      {isLeader && (
        <div className="flex justify-center gap-4 px-12 mt-12 pb-10">
          <button
            onClick={() => {
              if (confirm(t('groups.confirmDelete'))) {
                // Delete group logic would go here
              }
            }}
            className="px-8 py-3.5 bg-error-container/20 text-error rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-error-container/40 transition-all active:scale-95 border border-error/10 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            {t('groups.deleteGroup')}
          </button>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-surface-container rounded-[2rem] p-10 w-full max-w-md mx-4 border border-outline-variant/10 shadow-2xl">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-secondary text-2xl">settings</span>
              <h3 className="text-xl font-black tracking-tight">{t('groups.settingsModal')}</h3>
            </div>

            <form onSubmit={handleEdit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">{t('groups.groupNameLabel')}</label>
                <input
                  className="w-full px-5 py-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10 text-on-surface font-medium text-sm outline-none focus:border-secondary/30 transition-all"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">{t('groups.descriptionLabel')}</label>
                <textarea
                  className="w-full px-5 py-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10 text-on-surface font-medium text-sm outline-none focus:border-secondary/30 transition-all resize-vertical min-h-[80px]"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editPublic"
                  checked={editPublic}
                  onChange={e => setEditPublic(e.target.checked)}
                  className="accent-secondary w-4 h-4"
                />
                <label htmlFor="editPublic" className="text-sm text-on-surface-variant font-bold">{t('groups.publicGroup')}</label>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">{t('groups.maxMembers')}</label>
                <input
                  className="w-full px-5 py-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10 text-on-surface font-medium text-sm outline-none focus:border-secondary/30 transition-all"
                  type="number"
                  value={editMaxMembers}
                  onChange={e => setEditMaxMembers(Number(e.target.value))}
                  min={2}
                  max={500}
                />
              </div>
              {editError && (
                <p className="text-error text-sm font-bold text-center">{editError}</p>
              )}
              <button
                type="submit"
                disabled={editLoading || !editName.trim()}
                className="w-full py-4 gold-gradient text-on-secondary rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(232,168,50,0.3)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editLoading ? t('groups.saving') : t('groups.saveChanges')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
