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
  avatarUrl?: string;
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
  questionIds?: string[];
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
  const [playingSetId, setPlayingSetId] = useState<string | null>(null);

  // Create quiz set modal — 2 tabs: AI Generate + Manual
  type QsTab = 'ai' | 'manual';
  interface AiDraft { content: string; options: string[]; correctAnswer: number[]; explanation?: string; difficulty: string; book?: string; chapter?: number; verseStart?: number; verseEnd?: number; }
  interface ManualQ { content: string; options: string[]; correctAnswer: number; difficulty: string; }

  const [showCreateQsModal, setShowCreateQsModal] = useState(false);
  const [qsModalTab, setQsModalTab] = useState<QsTab>('ai');
  const [qsName, setQsName] = useState('');
  const [qsError, setQsError] = useState('');
  const [qsSubmitting, setQsSubmitting] = useState(false);

  // AI tab
  const [qsAiBook, setQsAiBook] = useState('');
  const [qsAiChapter, setQsAiChapter] = useState(1);
  const [qsAiChapterEnd, setQsAiChapterEnd] = useState(1);
  const [qsAiVerseStart, setQsAiVerseStart] = useState(1);
  const [qsAiVerseEnd, setQsAiVerseEnd] = useState(50);
  const [qsAiTopic, setQsAiTopic] = useState('');
  const [qsAiCount, setQsAiCount] = useState(5);
  const [qsAiDifficulty, setQsAiDifficulty] = useState('MEDIUM');
  const [qsAiGenerating, setQsAiGenerating] = useState(false);
  const [qsAiDrafts, setQsAiDrafts] = useState<AiDraft[]>([]);

  // Manual tab
  const [qsManualList, setQsManualList] = useState<ManualQ[]>([]);
  const [qsMContent, setQsMContent] = useState('');
  const [qsMOptions, setQsMOptions] = useState(['', '', '', '']);
  const [qsMCorrect, setQsMCorrect] = useState(0);
  const [qsMDifficulty, setQsMDifficulty] = useState('MEDIUM');

  const openCreateModal = () => {
    setQsModalTab('ai');
    setQsName(''); setQsError('');
    setQsAiBook(''); setQsAiChapter(1); setQsAiChapterEnd(1);
    setQsAiVerseStart(1); setQsAiVerseEnd(50);
    setQsAiTopic(''); setQsAiCount(5); setQsAiDifficulty('MEDIUM');
    setQsAiGenerating(false); setQsAiDrafts([]);
    setQsManualList([]); setQsMContent('');
    setQsMOptions(['', '', '', '']); setQsMCorrect(0); setQsMDifficulty('MEDIUM');
    setShowCreateQsModal(true);
  };

  const handleAiGenerate = async () => {
    if (!qsAiBook.trim()) { setQsError(t('groups.aiModalBookRequired')); return; }
    setQsAiGenerating(true);
    setQsError('');
    try {
      const res = await api.post(`/api/groups/${id}/ai-generate`, {
        book: qsAiBook.trim(),
        chapter: qsAiChapter,
        chapterEnd: qsAiChapterEnd,
        verseStart: qsAiVerseStart,
        verseEnd: qsAiVerseEnd,
        topic: qsAiTopic.trim() || undefined,
        count: qsAiCount,
        difficulty: qsAiDifficulty,
        language: 'vi',
      });
      setQsAiDrafts((res.data.questions ?? []).map((q: any) => ({
        ...q,
        correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer ?? 0],
      })));
    } catch (err: any) {
      setQsError(err.response?.data?.message ?? t('groups.createFailed'));
    } finally { setQsAiGenerating(false); }
  };

  const handleSaveQuizSet = async (questions: object[]) => {
    if (!qsName.trim()) { setQsError(t('groups.aiModalNoName')); return; }
    if (questions.length === 0) { setQsError(t('groups.aiModalNoQuestions')); return; }
    setQsSubmitting(true);
    setQsError('');
    try {
      await api.post(`/api/groups/${id}/quiz-sets/custom`, { name: qsName.trim(), questions });
      setShowCreateQsModal(false);
      fetchQuizSets();
    } catch (err: any) {
      setQsError(err.response?.data?.message ?? t('groups.createFailed'));
    } finally { setQsSubmitting(false); }
  };

  const handleManualAdd = () => {
    if (!qsMContent.trim() || qsMOptions.filter(o => o.trim()).length < 2) return;
    setQsManualList(prev => [...prev, { content: qsMContent.trim(), options: qsMOptions.map(o => o.trim()), correctAnswer: qsMCorrect, difficulty: qsMDifficulty }]);
    setQsMContent('');
    setQsMOptions(['', '', '', '']);
    setQsMCorrect(0);
  };

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
        const sets = (res.data.quizSets || []).map((qs: any) => ({
          ...qs,
          questionCount: Array.isArray(qs.questionIds) ? qs.questionIds.length : (qs.questionCount ?? 0),
        }));
        setQuizSets(sets);
      }
    } catch { /* ignore */ }
    finally { setQuizSetsLoading(false); }
  }, [id]);

  const handlePlayQuizSet = useCallback(async (setId: string) => {
    if (playingSetId) return;
    setPlayingSetId(setId);
    try {
      const res = await api.post(`/api/groups/${id}/quiz-sets/${setId}/play`);
      if (res.data.success && res.data.room?.id) {
        navigate(`/room/${res.data.room.id}/lobby`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tạo phòng';
      alert(msg);
    } finally {
      setPlayingSetId(null);
    }
  }, [id, navigate, playingSetId]);

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
    <div className="relative pb-12 max-w-5xl mx-auto px-4 lg:px-6 pt-6" data-testid="group-detail-page">

      {/* ── Compact Header (mockup: groups_member_dashboard.html / groups_leader_dashboard.html) ── */}
      <header
        className={`rounded-[14px] p-4 flex items-center gap-4 mb-3 ${
          isLeader
            ? 'bg-gradient-to-br from-[rgba(232,168,50,0.1)] to-[rgba(50,52,64,0.4)] border-[0.5px] border-[rgba(232,168,50,0.3)]'
            : 'bg-[rgba(50,52,64,0.4)] border-[0.5px] border-[rgba(232,168,50,0.2)]'
        }`}
      >
        <div
          className={`w-[60px] h-[60px] rounded-[14px] bg-[rgba(232,168,50,0.15)] flex items-center justify-center flex-shrink-0 overflow-hidden ${
            isLeader ? 'border-[1.5px] border-secondary' : 'border-[1.5px] border-[rgba(232,168,50,0.4)]'
          }`}
        >
          {group.avatarUrl ? (
            <img alt={group.name} src={group.avatarUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[28px]">⛪</span>
          )}
        </div>

        <div className="flex-1 min-w-0" data-testid="group-detail-name">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 data-testid="group-name-heading" className="text-on-surface text-[18px] font-medium m-0 truncate">
              {group.name?.trim() || t('groups.untitledGroup')}
            </h2>
            {isLeader ? (
              <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-2 py-0.5 rounded-full text-[9px] font-medium border-[0.5px] border-[rgba(232,168,50,0.4)]">
                👑 {t('groups.leaderBadge')}
              </span>
            ) : group.isPublic ? (
              <span className="bg-[rgba(99,153,34,0.15)] text-[#97C459] px-2 py-0.5 rounded-full text-[9px] font-medium">
                {t('groups.publicBadge')}
              </span>
            ) : (
              <span className="bg-white/[0.06] text-on-surface-variant px-2 py-0.5 rounded-full text-[9px] font-medium">
                {t('groups.privateBadge')}
              </span>
            )}
          </div>
          <div className="text-on-surface/55 text-[12px] mt-1 flex items-center gap-3 flex-wrap">
            <span data-testid="group-member-count">👥 {group.members?.length || 0} {t('groups.members')}</span>
            {leader && (
              <>
                <span>·</span>
                <span>👑 {leader.name}</span>
              </>
            )}
            <span>·</span>
            <button
              data-testid="group-join-code"
              onClick={handleCopyCode}
              className="flex items-center gap-1 text-on-surface/55 hover:text-secondary transition-colors"
            >
              🔑 {t('groups.groupCodeLabel')}:{' '}
              <code className="bg-white/[0.06] px-1.5 py-px rounded text-secondary font-mono">
                {copied ? t('groups.copied') : group.code}
              </code>
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {isLeader && (
            <Link
              to={`/groups/${id}/analytics`}
              className="bg-[rgba(232,168,50,0.15)] text-secondary border-[0.5px] border-[rgba(232,168,50,0.4)] rounded-lg px-3.5 py-2 text-[11px] font-medium hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              📊 {t('groupAnalytics.title')}
            </Link>
          )}
          {isLeader ? (
            <button
              onClick={openEditModal}
              className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-lg px-3.5 py-2 text-[11px] font-medium hover:bg-white/10 transition-all flex items-center gap-1.5"
            >
              ⚙️ {t('groups.settings')}
            </button>
          ) : (
            <button
              data-testid="group-leave-btn"
              onClick={handleLeave}
              className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-lg px-3.5 py-2 text-[11px] font-medium hover:bg-white/10 transition-all flex items-center gap-1.5"
            >
              🚪 {t('groups.leaveGroup')}
            </button>
          )}
          <button
            onClick={handleCopyCode}
            className="bg-secondary text-on-secondary rounded-lg px-3.5 py-2 text-[11px] font-medium shadow-[0_0_18px_rgba(232,168,50,0.2)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            🔗 {t('groups.invite')}
          </button>
        </div>
      </header>

      {/* ── Tab Navigation (compact) ── */}
      <nav className="flex items-center gap-6 border-b border-white/10 overflow-x-auto whitespace-nowrap mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`pb-2.5 px-1 text-[12px] font-medium tracking-wide transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'text-secondary border-b-2 border-secondary'
                : 'text-on-surface/55 hover:text-on-surface'
            }`}
          >
            {tab.label}
            {tab.hasNotification && announcements.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}

      {/* ===== LEADERBOARD TAB ===== */}
      {activeTab === 'leaderboard' && (
        <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-[rgba(232,168,50,0.15)] rounded-xl p-5" data-testid="group-leaderboard">
          {/* Header + period toggle */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-on-surface text-[13px] font-medium">📊 {t('groups.leaderboard')}</div>
            <div className="inline-flex bg-black/30 rounded-md p-0.5">
              <button
                onClick={() => setPeriod('weekly')}
                className={`border-0 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all ${
                  period === 'weekly' ? 'bg-secondary text-on-secondary' : 'bg-transparent text-on-surface/55'
                }`}
              >
                {t('groups.thisWeek')}
              </button>
              <button
                onClick={() => setPeriod('all_time')}
                className={`border-0 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all ${
                  period === 'all_time' ? 'bg-secondary text-on-secondary' : 'bg-transparent text-on-surface/55'
                }`}
              >
                {t('groups.everytime')}
              </button>
            </div>
          </div>

          {lbLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-center text-on-surface-variant py-6 text-[12px]">
              {t('groups.noRankingData')}
            </p>
          ) : (
            <>
              {/* Compact 3-slot podium (mockup pattern: rank 2 left / rank 1 elevated center / rank 3 right) */}
              <div className="grid grid-cols-3 gap-2 items-end mb-4">
                {[1, 0, 2].map((podiumIdx, gridPos) => {
                  const entry = top3[podiumIdx];
                  const rank = (podiumIdx + 1) as 1 | 2 | 3;
                  const elevated = gridPos === 1;
                  if (!entry) {
                    return (
                      <div
                        key={`empty-${rank}`}
                        className="bg-white/[0.03] border-[0.5px] border-dashed border-white/10 rounded-[10px] p-2.5 text-center opacity-60 flex flex-col items-center justify-center"
                        style={{ minHeight: elevated ? 110 : 90 }}
                      >
                        <div className="w-10 h-10 rounded-full border border-dashed border-on-surface-variant/30 flex items-center justify-center mb-1.5">
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">person_add</span>
                        </div>
                        <div className="text-on-surface-variant text-[10px]">{t('groups.podiumEmptySlot')}</div>
                      </div>
                    );
                  }
                  const isCurrentUser = entry.name === user?.name;
                  const isMemberLeader = entry.role === 'LEADER';
                  const wrapperStyle = elevated
                    ? 'bg-[rgba(232,168,50,0.12)] border border-[rgba(232,168,50,0.5)] shadow-[0_0_0_2px_rgba(232,168,50,0.15)]'
                    : rank === 2
                    ? 'bg-white/[0.04] border-[0.5px] border-white/10'
                    : 'bg-[rgba(255,140,66,0.08)] border-[0.5px] border-[rgba(255,140,66,0.3)]';
                  const avatarStyle = elevated
                    ? 'w-[50px] h-[50px] bg-[rgba(232,168,50,0.3)] border-2 border-secondary text-secondary text-[16px]'
                    : rank === 2
                    ? 'w-10 h-10 bg-[rgba(74,158,255,0.3)] border-2 border-[rgba(74,158,255,0.6)] text-[#6AB8E8] text-[14px]'
                    : 'w-10 h-10 bg-[rgba(168,85,247,0.3)] border-2 border-[rgba(168,85,247,0.6)] text-[#c084fc] text-[14px]';
                  const badgeStyle = elevated
                    ? 'bg-secondary text-on-secondary text-[11px] w-5 h-5'
                    : rank === 2
                    ? 'bg-white/60 text-background text-[10px] w-[18px] h-[18px]'
                    : 'bg-[rgba(255,140,66,0.8)] text-background text-[10px] w-[18px] h-[18px]';
                  return (
                    <div
                      key={entry.userId}
                      className={`rounded-[10px] p-2.5 text-center ${wrapperStyle} ${isCurrentUser ? 'ring-1 ring-secondary' : ''}`}
                    >
                      <div className="relative inline-block mb-1.5">
                        <div className={`rounded-full flex items-center justify-center font-medium ${avatarStyle}`}>
                          {entry.avatarUrl ? (
                            <img alt={entry.name} src={entry.avatarUrl} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (entry.name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div
                          className={`absolute -bottom-0.5 -right-1 rounded-full flex items-center justify-center font-semibold ${badgeStyle}`}
                        >
                          {rank}
                        </div>
                      </div>
                      <div className="text-on-surface text-[12px] font-medium truncate">
                        {entry.name}
                      </div>
                      <div className="text-[9px]" style={{ color: isMemberLeader ? '#e8a832' : rank === 2 ? '#6AB8E8' : '#c084fc' }}>
                        {isMemberLeader ? `👑 ${t('groups.filterLeader')}` : entry.role === 'MOD' ? `🛡️ ${t('groups.filterMod')}` : t('groups.memberRole')}
                      </div>
                      <div className="text-on-surface/45 text-[10px] mt-0.5">
                        {(entry.score ?? 0).toLocaleString()} {t('groups.pointsAbbr')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mini list (rank 4+) */}
              {restLeaderboard.length > 0 && (
                <div className="flex flex-col gap-1">
                  {restLeaderboard.map((entry, i) => {
                    const isCurrentUser = entry.name === user?.name;
                    return (
                      <div
                        key={entry.userId}
                        className={`rounded-md px-3 py-2 flex items-center gap-2.5 border-[0.5px] ${
                          isCurrentUser
                            ? 'bg-[rgba(232,168,50,0.08)] border-[rgba(232,168,50,0.4)]'
                            : 'bg-white/[0.03] border-white/[0.04]'
                        }`}
                      >
                        <div
                          className={`text-[11px] font-medium w-[18px] text-center ${
                            isCurrentUser ? 'text-secondary' : 'text-on-surface/50'
                          }`}
                        >
                          {i + 4}
                        </div>
                        <div className="w-[26px] h-[26px] rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-on-surface overflow-hidden">
                          {entry.avatarUrl ? (
                            <img alt={entry.name} src={entry.avatarUrl} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (entry.name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-on-surface text-[11px] truncate">
                            {entry.name}
                            {isCurrentUser && <span className="ml-1 font-medium">{t('groups.memberLabel')}</span>}
                          </div>
                          <div className="text-on-surface/40 text-[9px]">
                            {entry.role === 'LEADER' ? t('groups.filterLeader') : entry.role === 'MOD' ? t('groups.filterMod') : t('groups.memberRole')}
                          </div>
                        </div>
                        <div className="text-secondary text-[11px] font-medium">
                          {(entry.score ?? 0).toLocaleString()} {t('groups.pointsAbbr')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.08] rounded-lg px-2.5 sm:px-3 py-2 flex items-center gap-2 sm:min-w-[220px]">
                <span className="text-[12px] text-on-surface/40">🔍</span>
                <input
                  className="bg-transparent border-0 outline-none text-on-surface text-[11px] sm:text-[12px] flex-1"
                  placeholder={t('groups.memberSearchPlaceholder')}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface/50 text-[10px] sm:hidden">{t('groups.sortByScore').split(' ')[0]}:</span>
                <div className="inline-flex bg-black/30 rounded-md p-0.5">
                  {(['score', 'tier', 'activity'] as MemberSort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMemberSort(s)}
                      className={`border-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-medium cursor-pointer transition-all ${
                        memberSort === s ? 'bg-secondary text-on-secondary' : 'bg-transparent text-on-surface/55'
                      }`}
                    >
                      {s === 'score' ? t('groups.sortByScore') : s === 'tier' ? t('groups.sortByTier') : t('groups.sortByActivity')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filter chips — horizontal scroll on mobile */}
          <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
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
                  className={`rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium border-[0.5px] cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
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
                    className={`flex sm:grid sm:grid-cols-[40px_1fr_100px_100px_100px_60px] gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 items-center border-b-[0.5px] border-white/[0.04] ${
                      isMe ? 'bg-[rgba(232,168,50,0.08)] border-l-2 border-l-secondary' : isMemberLeader ? 'bg-[rgba(232,168,50,0.05)]' : ''
                    } ${inactive ? 'opacity-60' : ''}`}
                  >
                    <div className={`text-[12px] sm:text-[13px] font-medium text-center w-[16px] sm:w-auto flex-shrink-0 ${isMe || isMemberLeader ? 'text-secondary' : 'text-on-surface/50'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0 ${
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
                      <div className="min-w-0 flex-1">
                        <div className="text-on-surface text-[11px] sm:text-[12px] font-medium flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          {m.name}
                          {isMemberLeader && (
                            <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              👑 {t('groups.filterLeader')}
                            </span>
                          )}
                          {isMemberMod && (
                            <span className="bg-[rgba(74,158,255,0.15)] text-[#6AB8E8] px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              🛡️ {t('groups.filterMod')}
                            </span>
                          )}
                          {isMe && (
                            <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              {t('groups.youBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] sm:text-[10px]" style={{ color: inactive ? 'rgba(255,140,66,0.6)' : tierColor }}>
                          {inactive ? t('groups.inactiveBadge') : t('groups.memberRole')}
                        </div>
                      </div>
                    </div>
                    {/* Mobile: score + time stacked right */}
                    <div className="flex flex-col items-end flex-shrink-0 sm:hidden">
                      <div className={`text-[12px] font-medium ${isMe || isMemberLeader ? 'text-secondary' : 'text-on-surface'}`}>
                        {(m.score ?? 0).toLocaleString()}
                      </div>
                      <div className={`text-[9px] ${inactive ? 'text-[rgba(255,140,66,0.7)]' : 'text-on-surface/40'}`}>
                        {formatRelativeTime(m.lastActiveAt ?? m.joinedAt)}
                      </div>
                    </div>
                    {/* Desktop: separate grid columns */}
                    <div className={`hidden sm:block text-[13px] font-medium text-right ${isMe || isMemberLeader ? 'text-secondary' : 'text-on-surface'}`}>
                      {(m.score ?? 0).toLocaleString()}
                    </div>
                    <div className="hidden sm:block text-on-surface/40 text-[12px] text-right">— 0</div>
                    <div className={`hidden sm:block text-[11px] text-right ${inactive ? 'text-[rgba(255,140,66,0.7)]' : 'text-on-surface/55'}`}>
                      {formatRelativeTime(m.lastActiveAt ?? m.joinedAt)}
                    </div>
                    <div className="hidden sm:flex text-right justify-end gap-1">
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

      {/* ===== ANNOUNCEMENTS TAB (mockup: announcements panel pattern) ===== */}
      {activeTab === 'announcements' && (
        <section className="space-y-3">
          {/* Compose box (Leader/Mod only) */}
          {isLeaderOrMod && (
            <div className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/10 rounded-lg px-3 py-2 text-on-surface text-[12px] outline-none focus:border-secondary/30 placeholder:text-on-surface/40"
                  value={newAnnouncement}
                  onChange={e => setNewAnnouncement(e.target.value)}
                  placeholder={t('groups.writeAnnouncement')}
                  onKeyDown={e => e.key === 'Enter' && handlePostAnnouncement()}
                  maxLength={500}
                />
                <button
                  onClick={handlePostAnnouncement}
                  disabled={postingAnnouncement || !newAnnouncement.trim()}
                  className="bg-secondary text-on-secondary rounded-lg px-4 py-2 text-[11px] font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  📨 {postingAnnouncement ? '...' : t('groups.send')}
                </button>
              </div>
            </div>
          )}

          {/* Announcements list */}
          <div className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-4">
            <div className="text-on-surface text-[13px] font-medium mb-3">📢 {t('groups.announcements')}</div>

            {announcementsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-center text-on-surface-variant py-6 text-[12px]">
                {t('groups.noAnnouncements')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {announcements.map(a => {
                  // Match the row authorship to the leader/mod role from group.members
                  const authorMember = group.members?.find(m => m.name === a.author);
                  const isLeaderAuthor = authorMember?.role === 'LEADER';
                  return (
                    <article
                      key={a.id}
                      className={`rounded-[4px] px-3 py-2.5 ${
                        isLeaderAuthor
                          ? 'bg-[rgba(232,168,50,0.05)] border-l-2 border-secondary'
                          : 'bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.04]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className={`text-[10px] font-medium ${isLeaderAuthor ? 'text-secondary' : 'text-on-surface/70'}`}>
                          {isLeaderAuthor ? '👑' : '🛡️'} {a.author}
                        </div>
                        <div className="text-on-surface/40 text-[9px]">
                          {formatRelativeTime(a.createdAt)}
                        </div>
                      </div>
                      <div className="text-on-surface/85 text-[11px] leading-relaxed">{a.body}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== QUIZ SETS TAB (mockup: groups_member_dashboard.html quiz sets section) ===== */}
      {activeTab === 'quizsets' && (
        <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="text-on-surface text-[13px] font-medium">📚 {t('groups.quizSetsSection')}</div>
            {isLeaderOrMod && (
              <button
                onClick={openCreateModal}
                className="bg-[rgba(232,168,50,0.15)] text-secondary border-[0.5px] border-[rgba(232,168,50,0.4)] rounded-md px-3 py-1.5 text-[11px] font-medium hover:brightness-110 transition-all"
              >
                + {t('groups.createQuizSetCta')}
              </button>
            )}
          </div>
          {quizSetsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : quizSets.length === 0 ? (
            <p className="text-center text-on-surface-variant py-6 text-[12px]">
              {t('groups.noQuizSets')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {quizSets.map((qs, idx) => {
                // Highlight the most recent set (index 0 — backend orders by createdAt DESC implicitly)
                const isNew = idx === 0;
                return (
                  <div
                    key={qs.id}
                    className={`rounded-lg px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all hover:brightness-110 ${
                      isNew
                        ? 'bg-[rgba(232,168,50,0.06)] border-[0.5px] border-[rgba(232,168,50,0.25)]'
                        : 'bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.06]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 ${
                        isNew ? 'bg-[rgba(232,168,50,0.2)]' : 'bg-[rgba(74,158,255,0.15)]'
                      }`}
                    >
                      {isNew ? '📖' : '📜'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface text-[12px] font-medium truncate">{qs.name}</div>
                      <div className="text-on-surface/50 text-[10px]">
                        {t('groups.questionsCount', { count: qs.questionCount })}
                        {isNew && ` · ${t('groups.newToday')}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlayQuizSet(qs.id)}
                      disabled={playingSetId === qs.id}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isNew
                          ? 'bg-secondary text-on-secondary hover:brightness-110'
                          : 'bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {playingSetId === qs.id ? '...' : isNew ? t('groups.play') : t('groups.playAgain')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Footer: leader-only delete ── */}
      {isLeader && (
        <div className="flex justify-center mt-6 mb-2">
          <button
            onClick={() => {
              if (confirm(t('groups.confirmDelete'))) {
                // Delete group logic would go here
              }
            }}
            className="bg-error-container/20 text-error rounded-lg px-4 py-2 text-[11px] font-medium hover:bg-error-container/40 transition-all border border-error/10 flex items-center gap-1.5"
          >
            🗑️ {t('groups.deleteGroup')}
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

      {/* ── Create Quiz Set Modal — 2 tabs: AI Generate + Manual ── */}
      {showCreateQsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateQsModal(false)} />
          <div className="relative bg-[#1d1f2a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl mx-auto border border-white/10 shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">📚</span>
                <h3 className="text-[14px] font-semibold text-on-surface">{t('groups.aiModalTitle')}</h3>
              </div>
              <button onClick={() => setShowCreateQsModal(false)} className="text-on-surface/50 hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex px-5 pt-3 pb-0 gap-2 flex-shrink-0">
              {(['ai', 'manual'] as QsTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setQsModalTab(tab); setQsError(''); }}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-all ${qsModalTab === tab ? 'bg-[rgba(232,168,50,0.15)] text-secondary border border-[rgba(232,168,50,0.3)]' : 'bg-white/[0.04] text-on-surface/50 border border-white/[0.06] hover:bg-white/[0.07]'}`}
                >
                  {tab === 'ai' ? `🤖 ${t('groups.aiModalTabAI')}` : `✍️ ${t('groups.aiModalTabManual')}`}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Quiz set name — always visible */}
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalQsNameLabel')}</label>
                <input
                  className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3.5 py-2.5 text-on-surface text-[13px] placeholder:text-on-surface/30 focus:outline-none focus:border-secondary/50 transition-all"
                  value={qsName}
                  onChange={e => setQsName(e.target.value)}
                  placeholder={t('groups.aiModalQsNamePlaceholder')}
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* ── AI TAB ── */}
              {qsModalTab === 'ai' && (
                <>
                  {/* Book + Chapter range */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 sm:col-span-1">
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalBook')}</label>
                      <input
                        className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-secondary/40"
                        value={qsAiBook}
                        onChange={e => setQsAiBook(e.target.value)}
                        placeholder={t('groups.aiModalBookPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalChapterFrom')}</label>
                      <input type="number" min={1} max={150}
                        className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-on-surface focus:outline-none focus:border-secondary/40"
                        value={qsAiChapter}
                        onChange={e => { const v = Number(e.target.value); setQsAiChapter(v); if (qsAiChapterEnd < v) setQsAiChapterEnd(v); }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalChapterTo')}</label>
                      <input type="number" min={1} max={150}
                        className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-on-surface focus:outline-none focus:border-secondary/40"
                        value={qsAiChapterEnd}
                        onChange={e => setQsAiChapterEnd(Math.max(qsAiChapter, Number(e.target.value)))}
                      />
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalTopic')}</label>
                    <textarea
                      className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-secondary/40 resize-none"
                      rows={2}
                      value={qsAiTopic}
                      onChange={e => setQsAiTopic(e.target.value)}
                      placeholder={t('groups.aiModalTopicPlaceholder')}
                      maxLength={300}
                    />
                  </div>

                  {/* Count + Difficulty */}
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalCount')}: {qsAiCount}</label>
                      <input type="range" min={3} max={15} step={1}
                        className="w-full accent-secondary mt-1"
                        value={qsAiCount}
                        onChange={e => setQsAiCount(Number(e.target.value))}
                      />
                      <div className="flex justify-between text-[9px] text-on-surface/40 mt-0.5"><span>3</span><span>15</span></div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalDifficulty')}</label>
                      <div className="flex gap-1">
                        {(['EASY', 'MEDIUM', 'HARD'] as const).map(d => (
                          <button key={d} onClick={() => setQsAiDifficulty(d)}
                            className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all border ${qsAiDifficulty === d
                              ? d === 'EASY' ? 'bg-[rgba(99,153,34,0.25)] text-[#97C459] border-[rgba(99,153,34,0.4)]'
                                : d === 'MEDIUM' ? 'bg-[rgba(232,168,50,0.2)] text-secondary border-[rgba(232,168,50,0.4)]'
                                : 'bg-[rgba(239,68,68,0.15)] text-error border-error/30'
                              : 'bg-transparent text-on-surface/40 border-white/[0.06] hover:bg-white/5'
                            }`}
                          >
                            {d === 'EASY' ? t('groups.aiModalDiffEasy') : d === 'MEDIUM' ? t('groups.aiModalDiffMedium') : t('groups.aiModalDiffHard')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={handleAiGenerate}
                    disabled={qsAiGenerating || !qsAiBook.trim()}
                    className="w-full py-3 gold-gradient text-on-secondary rounded-xl text-[12px] font-semibold hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {qsAiGenerating
                      ? <><div className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin" />{t('groups.aiModalGenerating')}</>
                      : t('groups.aiModalGenerate')}
                  </button>

                  {/* Draft question list */}
                  {qsAiDrafts.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-[11px] font-medium text-on-surface/70">{t('groups.aiModalDraftTitle')} · {qsAiDrafts.length} {t('groups.aiModalDraftCount')}</div>
                        <button onClick={handleAiGenerate} disabled={qsAiGenerating} className="text-[10px] text-secondary hover:brightness-125 disabled:opacity-50 transition-colors">
                          {t('groups.aiModalRegenerate')}
                        </button>
                      </div>
                      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                        {qsAiDrafts.map((draft, idx) => (
                          <div key={idx} className="bg-[rgba(50,52,64,0.6)] border-[0.5px] border-white/[0.08] rounded-xl p-3">
                            <div className="flex items-start gap-2 mb-2.5">
                              <span className="text-secondary text-[10px] font-bold mt-0.5 flex-shrink-0">Q{idx + 1}</span>
                              <textarea
                                className="flex-1 bg-transparent text-on-surface text-[11px] leading-snug resize-none outline-none border-b border-transparent focus:border-secondary/30 transition-all"
                                value={draft.content}
                                onChange={e => { const u = [...qsAiDrafts]; u[idx] = { ...draft, content: e.target.value }; setQsAiDrafts(u); }}
                                rows={2}
                              />
                              <button
                                onClick={() => setQsAiDrafts(prev => prev.filter((_, i) => i !== idx))}
                                className="text-on-surface/25 hover:text-error transition-colors flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-[15px]">close</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(draft.options || []).map((opt, oi) => {
                                const isCorrect = (draft.correctAnswer || []).includes(oi);
                                return (
                                  <div
                                    key={oi}
                                    onClick={() => { const u = [...qsAiDrafts]; u[idx] = { ...draft, correctAnswer: [oi] }; setQsAiDrafts(u); }}
                                    className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer border transition-all ${isCorrect ? 'border-[rgba(99,153,34,0.5)] bg-[rgba(99,153,34,0.1)]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'}`}
                                  >
                                    <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border text-[8px] transition-all ${isCorrect ? 'bg-[#4a9c22] border-[#4a9c22] text-white' : 'bg-transparent border-white/20'}`}>
                                      {isCorrect && '✓'}
                                    </div>
                                    <span className="text-[10px] text-on-surface/80 flex-1 truncate">{opt || `Đáp án ${oi + 1}`}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── MANUAL TAB ── */}
              {qsModalTab === 'manual' && (
                <>
                  {/* Question input form */}
                  <div className="bg-[rgba(50,52,64,0.3)] border-[0.5px] border-white/[0.06] rounded-xl p-4 space-y-3">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-on-surface/60 mb-1.5">{t('groups.aiModalManualContent')}</label>
                      <textarea
                        className="w-full bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-secondary/40 resize-none"
                        rows={3}
                        value={qsMContent}
                        onChange={e => setQsMContent(e.target.value)}
                        placeholder="Nhập câu hỏi..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {qsMOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <button
                            onClick={() => setQsMCorrect(i)}
                            className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-all ${qsMCorrect === i ? 'bg-[#4a9c22] border-[#4a9c22] text-white text-[9px]' : 'bg-transparent border-white/25 hover:border-white/50'}`}
                          >
                            {qsMCorrect === i && '✓'}
                          </button>
                          <input
                            className="flex-1 bg-[rgba(50,52,64,0.5)] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-secondary/40"
                            value={opt}
                            onChange={e => { const n = [...qsMOptions]; n[i] = e.target.value; setQsMOptions(n); }}
                            placeholder={`${t('groups.aiModalManualOption')} ${i + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        {(['EASY', 'MEDIUM', 'HARD'] as const).map(d => (
                          <button key={d} onClick={() => setQsMDifficulty(d)}
                            className={`px-2 py-1 rounded text-[9px] font-medium transition-all border ${qsMDifficulty === d ? d === 'EASY' ? 'bg-[rgba(99,153,34,0.25)] text-[#97C459] border-[rgba(99,153,34,0.4)]' : d === 'MEDIUM' ? 'bg-[rgba(232,168,50,0.2)] text-secondary border-[rgba(232,168,50,0.3)]' : 'bg-[rgba(239,68,68,0.15)] text-error border-error/30' : 'bg-transparent text-on-surface/40 border-white/[0.06]'}`}
                          >
                            {d === 'EASY' ? t('groups.aiModalDiffEasy') : d === 'MEDIUM' ? t('groups.aiModalDiffMedium') : t('groups.aiModalDiffHard')}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleManualAdd}
                        disabled={!qsMContent.trim() || qsMOptions.filter(o => o.trim()).length < 2}
                        className="bg-[rgba(232,168,50,0.15)] text-secondary border-[0.5px] border-[rgba(232,168,50,0.4)] rounded-lg px-4 py-1.5 text-[11px] font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        + {t('groups.aiModalManualAdd')}
                      </button>
                    </div>
                  </div>

                  {/* Question list */}
                  {qsManualList.length === 0 ? (
                    <p className="text-center text-on-surface/35 text-[11px] py-3">{t('groups.aiModalManualEmpty')}</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                      {qsManualList.map((q, i) => (
                        <div key={i} className="bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.06] rounded-xl p-3 flex items-start gap-2">
                          <span className="text-secondary text-[10px] font-bold mt-0.5 flex-shrink-0">Q{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-on-surface text-[11px] font-medium line-clamp-2">{q.content}</div>
                            <div className="text-on-surface/45 text-[9px] mt-0.5">
                              {q.options.filter(Boolean).length} {t('groups.aiModalDraftCount')} · {q.difficulty === 'EASY' ? t('groups.aiModalDiffEasy') : q.difficulty === 'HARD' ? t('groups.aiModalDiffHard') : t('groups.aiModalDiffMedium')}
                            </div>
                          </div>
                          <button onClick={() => setQsManualList(prev => prev.filter((_, j) => j !== i))} className="text-on-surface/25 hover:text-error transition-colors flex-shrink-0">
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] flex-shrink-0 space-y-2">
              {qsError && <p className="text-error text-[11px] text-center">{qsError}</p>}
              <button
                onClick={() => handleSaveQuizSet(
                  qsModalTab === 'ai'
                    ? qsAiDrafts.map(d => ({ ...d, book: d.book || qsAiBook }))
                    : qsManualList
                )}
                disabled={qsSubmitting || !qsName.trim() || (qsModalTab === 'ai' ? qsAiDrafts.length === 0 : qsManualList.length === 0)}
                className="w-full py-3 gold-gradient text-on-secondary rounded-xl text-[12px] font-semibold hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {qsSubmitting
                  ? <><div className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin" />{t('groups.aiModalSaving')}</>
                  : `${t('groups.aiModalSave')} (${qsModalTab === 'ai' ? qsAiDrafts.length : qsManualList.length} ${t('groups.aiModalDraftCount')})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
