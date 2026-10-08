import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api, aiApi } from '../api/client';
import { listScheduledQuizzes, ScheduledQuizSummary } from '../api/scheduledQuiz';
import GroupActivityTab from '../components/group/GroupActivityTab';
import GroupCodeModal from '../components/group/GroupCodeModal';
import QuizSetCard from '../components/group/QuizSetCard';
import QuizSetListCard from '../components/group/QuizSetListCard';
import type { QuizSet as ApiQuizSet, PublishStatus, QuizSetDifficulty } from '../api/quizSets';
import { PlaceBackdrop } from '../components/lk/Place';
import { resolveAvatar } from '../utils/avatar';

interface Member {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
  lastActiveAt?: string | null;
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
  leaderId?: string;
  myRole?: 'LEADER' | 'MOD' | 'MEMBER';
  avatarUrl?: string;
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
  coverImageUrl?: string | null;
  coverScripture?: string | null;
  difficulty?: string | null;
  estimatedDurationMin?: number | null;
  suggestedMode?: string | null;
  playCount?: number;
  averageRating?: number | null;
  totalRatings?: number | null;
  publishStatus?: string | null;
}

interface AnalyticsData {
  totalMembers: number;
  activeToday: number;
  activeWeek: number;
  inactiveCount: number;
  avgScore: number;
  accuracy: number;
  totalQuizzes: number;
  totalPointsWeek: number;
  totalQuestionsWeek: number;
  weeklyActivity: Array<{ date: string; activeCount: number }>;
  topContributors: Array<{ userId: string; name: string; avatarUrl?: string; score: number; questionsAnswered: number }>;
}

interface GroupStreak {
  currentStreak: number;
  longestStreak: number;
  todayActiveCount: number;
  totalMembers: number;
}

type AnalyticsPeriod = '7d' | '30d' | '90d';

type TabKey = 'activity' | 'members' | 'announcements' | 'quizsets';

const GROUP_BANNER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDFnTx3fGDw7x7TL7ge8vDEEkbSjq2ai-wsyEd__vq0byTyOGvi3d1WQJV-Z692ksccl6DDoOTaPZ-RL6J3WDmSBY0g8tNHqXPey9lmDhtJm5uWerKyh-E_CoWIffIBMnkKidiZmdYyryDzyan-U5KggGWHq86m0LjMDFuhdre8DhsrG1bfRTGgMv0gcxaS723-h-Ktb7hs3pnVXl86T0Bxzczh42s-_TVCqF9GGN9tV6Evi0FZeIe1ilRaSLf4vwUHB7Q31bszVCE';

const GROUP_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD4sJ4N_X2MNRMMd3yaZH9kLp_-xyJ4GqF9FvdK1dAW0P1U3HdpQYGd1pIgSJzNDOc44IwaqQIjthMlpuDdh5pYmQ2jNq3KaGX4HvM7hfZGtpiiP4mR5ak9Inm0c7b_s_pgenTSwlf77RToeW07Qk-jDkuNo8rxgTF2QZFN5RzT9LZTyvzKmm4UGlKv4EFucaEvknMaxEwjnCJI-h8JklEYtOS7RH_Hx2QgMk9KnmmiDj-ard7VlrNcnYErAbV48emDvKUI6Mccb0M';

const STORAGE_KEY = 'biblequiz_my_groups';

function updateSavedGroup(group: { id: string; name: string }) {
  // Only persist {id, name} — never join codes. Codes are sensitive on
  // shared devices (anyone with DevTools could read them and join).
  try {
    const groups = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const existing = groups.findIndex((g: any) => g.id === group.id);
    if (existing >= 0) {
      groups[existing] = { id: group.id, name: group.name };
    } else {
      groups.unshift({ id: group.id, name: group.name });
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

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 0 = unknown / network error, set to BE response status to differentiate
  // 404 (group missing/deleted) vs 403 (member kicked/no access) vs other.
  const [errorStatus, setErrorStatus] = useState<number>(0);

  // Deep-link support: ?tab=members opens that tab on mount.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabRaw = searchParams.get('tab');
  // Backward-compat: legacy `?tab=leaderboard` URLs (pre-GD-1) redirect to activity.
  const initialTab = (initialTabRaw === 'leaderboard' ? 'activity' : initialTabRaw) as TabKey | null;
  const validInitial: TabKey = initialTab && ['activity', 'members', 'announcements', 'quizsets'].includes(initialTab)
    ? initialTab
    : 'activity';
  const [activeTab, setActiveTab] = useState<TabKey>(validInitial);

  // Sync state → URL when user clicks a tab so deep links can be shared.
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'activity') next.delete('tab');
      else next.set('tab', key);
      return next;
    }, { replace: true });
  };

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Quiz Sets
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [quizSetsLoading, setQuizSetsLoading] = useState(false);
  const [playingSetId, setPlayingSetId] = useState<string | null>(null);
  const [activeScheduled, setActiveScheduled] = useState<ScheduledQuizSummary[]>([]);
  interface ActiveRoom {
    id: string;
    roomCode: string;
    roomName: string;
    mode: string;
    status: 'LOBBY' | 'IN_PROGRESS';
    currentPlayers: number;
    maxPlayers: number;
    quizSetId?: string;
    quizSetName?: string;
    createdAt: string;
  }
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);

  // Analytics (leader-only) + Group streak
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('7d');
  const [streak, setStreak] = useState<GroupStreak | null>(null);

  // BL-AD-8: Quiz set creation moved to dedicated page /groups/:id/quiz-sets/new.
  // openCreateModal now navigates; modal-related state/handlers removed.
  const openCreateModal = () => { navigate(`/groups/${id}/quiz-sets/new`); };

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [editMaxMembers, setEditMaxMembers] = useState(50);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Copy state
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // 3-dot header menu (Rời nhóm / Báo cáo)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showHeaderMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) setShowHeaderMenu(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHeaderMenu(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onEsc); };
  }, [showHeaderMenu]);

  // Report group modal (SPEC v1.1 §12.4 — member submits report to admin)
  type ReportReason = 'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'OTHER';
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('SPAM');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const submitReport = async () => {
    if (!id) return;
    setReportSubmitting(true);
    setReportError('');
    try {
      await api.post(`/api/groups/${id}/report`, {
        reason: reportReason,
        note: reportNote.trim() || undefined,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportReason('SPAM');
        setReportNote('');
      }, 1500);
    } catch (err: any) {
      // BE returns structured code in body; surface its message as-is.
      setReportError(err.response?.data?.message || t('groups.reportFailed'));
    } finally {
      setReportSubmitting(false);
    }
  };

  // BE now returns `myRole` (LEADER / MOD / MEMBER) when the request is
  // authenticated, so we don't have to guess by name. Fall back to a
  // case-insensitive name match for older responses.
  const fallbackMember = group?.members?.find(m =>
    user?.name && m.name && m.name.toLowerCase() === user.name.toLowerCase()
  );
  const myRole = group?.myRole ?? fallbackMember?.role;
  const isLeader = myRole === 'LEADER';
  const isLeaderOrMod = myRole === 'LEADER' || myRole === 'MOD';

  // Non-leader/mod can't see the quizsets tab; if they deep-link `?tab=quizsets`
  // bounce back to the default activity tab once role is known.
  useEffect(() => {
    if (group && activeTab === 'quizsets' && !isLeaderOrMod) handleTabChange('activity');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, activeTab, isLeaderOrMod]);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError('');
    setErrorStatus(0);
    try {
      const res = await api.get(`/api/groups/${id}`);
      if (res.data.success) {
        setGroup(res.data.group);
        updateSavedGroup(res.data.group);
      } else {
        setError(res.data.message || t('groups.errorLoadGroupInfo'));
      }
    } catch (err: any) {
      const status = err.response?.status ?? 0;
      setErrorStatus(status);
      // 403 likely means kicked/lost membership: clear stale local cache so
      // the user doesn't see this group on the /groups index after redirect.
      if (status === 403 && id) removeSavedGroup(id);
      setError(err.response?.data?.message || t('groups.connectionError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get(`/api/groups/${id}/analytics`);
      if (res.data.success) setAnalytics(res.data.analytics);
    } catch { /* ignore — non-leaders get 403, expected */ }
  }, [id]);

  const fetchStreak = useCallback(async () => {
    try {
      const res = await api.get(`/api/groups/${id}/streak`);
      if (res.data.success) setStreak(res.data.streak);
    } catch { /* ignore */ }
  }, [id]);

  const handlePlayQuizSet = useCallback(async (setId: string) => {
    if (playingSetId) return;
    setPlayingSetId(setId);
    try {
      const res = await api.post(`/api/groups/${id}/quiz-sets/${setId}/play`);
      if (res.data.success && res.data.room?.id) {
        navigate(`/room/${res.data.room.id}/lobby`, { state: { fromGroupId: id } });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tạo phòng';
      alert(msg);
    } finally {
      setPlayingSetId(null);
    }
  }, [id, navigate, playingSetId]);

  const fetchActiveScheduled = useCallback(async () => {
    if (!id) return;
    try {
      const list = await listScheduledQuizzes(id, 'ACTIVE');
      setActiveScheduled(list);
    } catch { /* ignore */ }
  }, [id]);

  const fetchActiveRooms = useCallback(async () => {
    if (!id) return;
    try {
      // Endpoint renamed per SPEC_GROUP v1.1 §13.5 (was /active-rooms).
      const res = await api.get(`/api/groups/${id}/live-rooms`);
      if (res.data.success) setActiveRooms(res.data.rooms || []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  useEffect(() => {
    if (!group) return;
    if (activeTab === 'activity') {
      // Activity tab needs quiz sets (preview top 3) + scheduled quizzes.
      // Also fetch announcements early so the GD-6 tab count badge is accurate.
      fetchQuizSets();
      fetchActiveScheduled();
      fetchAnnouncements();
    } else if (activeTab === 'announcements') {
      fetchAnnouncements();
    } else if (activeTab === 'quizsets') {
      fetchQuizSets();
      fetchActiveScheduled();
      fetchActiveRooms();
    } else if (activeTab === 'members') {
      fetchMembers(null, false);
    }
  }, [activeTab, group, fetchAnnouncements, fetchQuizSets, fetchMembers, fetchActiveScheduled, fetchActiveRooms]);

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

  const handleDelete = async () => {
    if (!id || !group) return;
    if (deleteConfirmText.trim() !== group.name.trim()) {
      setDeleteError(t('groups.deleteConfirmMismatch'));
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/groups/${id}`);
      navigate('/groups', { replace: true });
    } catch (err: any) {
      setDeleteError(err.response?.data?.message ?? t('groups.connectionError'));
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setShowEditModal(false);
    setDeleteConfirmText('');
    setDeleteError(null);
    setShowDeleteModal(true);
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
        <div className="w-10 h-10 border-[3px] border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !group) {
    // Status-aware copy: 403 = no longer a member; 404 = group gone;
    // anything else = generic load failure (network or 5xx).
    const headline = errorStatus === 403
      ? t('groups.errorNoLongerMember')
      : errorStatus === 404
        ? t('groups.errorGroupDeleted')
        : (error || t('groups.groupNotFound'));
    const showBackToGroups = errorStatus === 403 || errorStatus === 404;
    return (
      <div className="px-12 py-20">
        <div className="bg-bq-white rounded-2xl p-12 text-center border border-bq-hair shadow-bq-soft">
          <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <p className="text-error font-bold mb-6">{headline}</p>
          <div className="flex items-center justify-center gap-3">
            {showBackToGroups ? (
              <button
                onClick={() => navigate('/groups')}
                className="px-6 py-3 bg-bq-action text-bq-ink shadow-bq-action rounded-xl font-bold text-sm hover:brightness-110 transition-all"
              >
                {t('groups.backToGroups')}
              </button>
            ) : (
              <button
                onClick={fetchGroup}
                className="px-6 py-3 bg-bq-inset text-bq-ink rounded-xl font-bold text-sm hover:bg-bq-hair transition-all"
              >
                {t('common.retry')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const leader = group.members?.find(m => m.role === 'LEADER');

  // Activity-tab derived values
  const latestQuizSetsForOverview = quizSets.slice(0, 3);
  const memberTotalForOverview = group.members?.length ?? 0;

  // Identify "me" by name (matches the codebase convention; User type has no id field).
  const me = user?.name ? group.members?.find(m => m.name === user.name) : undefined;
  const joinedAtRaw = me?.joinedAt ?? (group as any).createdAt;
  const joinedAtLabel = (() => {
    if (!joinedAtRaw) return null;
    const d = new Date(joinedAtRaw);
    if (!Number.isFinite(d.getTime())) return null;
    return `${t('groups.joinedAtPrefix')} ${d.getMonth() + 1}/${d.getFullYear()}`;
  })();

  const handleShare = async () => {
    setShowHeaderMenu(false);
    const url = `${window.location.origin}/groups/join?code=${encodeURIComponent(group.code)}`;
    const shareData = { title: group.name, text: `${t('groups.shareInvite')} ${group.code}`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user cancelled */ }
    }
    handleCopyCode();
  };

  return (
    <div className="relative pb-12 max-w-5xl mx-auto px-4 lg:px-6 pt-4 sm:pt-6" data-testid="group-detail-page">
      <PlaceBackdrop place="chapel" veil="strong" />

      {/* ── App bar: back + 3-dot menu (mockup 2026-05-20) ── */}
      <div className="flex items-center justify-between mb-3" data-testid="group-detail-appbar">
        <button
          type="button"
          onClick={() => navigate('/groups')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-bq-ink2 hover:text-bq-ink hover:bg-bq-inset transition-colors text-[13px]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('groups.backToList')}
        </button>
        <div ref={headerMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowHeaderMenu(v => !v)}
            aria-label={t('groups.moreActions')}
            aria-haspopup="menu"
            aria-expanded={showHeaderMenu}
            data-testid="group-header-menu-btn"
            className={`w-9 h-9 rounded-full inline-flex items-center justify-center text-bq-ink2 hover:text-bq-ink transition-colors ${
              showHeaderMenu ? 'bg-bq-inset' : 'hover:bg-bq-inset'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">more_horiz</span>
          </button>
          {showHeaderMenu && (
            <div
              role="menu"
              data-testid="group-header-menu"
              className="absolute right-0 top-11 z-30 min-w-[200px] rounded-xl border border-bq-hair shadow-bq-soft p-1"
              style={{ background: '#FFFFFF' }}
            >
              {isLeader ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowHeaderMenu(false); openEditModal(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-bq-ink hover:bg-bq-inset transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[17px]">settings</span>
                  {t('groups.settings')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="group-leave-btn"
                    onClick={() => { setShowHeaderMenu(false); handleLeave(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-bq-ink hover:bg-bq-inset transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[17px]">logout</span>
                    {t('groups.leaveGroup')}
                  </button>
                  {/* SPEC v1.1 §2.2 — members + mods can report */}
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="group-report-btn"
                    onClick={() => { setShowHeaderMenu(false); setShowReportModal(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-bq-ruby hover:bg-bq-ruby/10 transition-colors text-left"
                    title={t('groups.reportTooltip')}
                  >
                    <span className="material-symbols-outlined text-[17px]">flag</span>
                    {t('groups.reportCta')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Compact Header (redesign 2026-05-20: avatar + inline title + subtitle + invite code) ── */}
      <header
        className={`rounded-[14px] p-3 sm:p-4 mb-3 shadow-bq-soft ${
          isLeader
            ? 'bg-gradient-to-br from-bq-amber/10 to-bq-white border-[0.5px] border-bq-amber/35'
            : 'bg-bq-white border-[0.5px] border-bq-hair'
        }`}
      >
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div
            className={`w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-[12px] bg-bq-amber/15 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5 ${
              isLeader ? 'border-[1.5px] border-bq-amberd' : 'border-[1.5px] border-bq-amber/40'
            }`}
          >
            {group.avatarUrl ? (
              <img alt={group.name} src={group.avatarUrl} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[22px] sm:text-[26px]">⛪</span>
            )}
          </div>

          <div className="flex-1 min-w-0" data-testid="group-detail-name">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 data-testid="group-name-heading" className="font-display text-bq-ink text-[17px] sm:text-[20px] font-bold m-0 truncate">
                {group.name?.trim() || t('groups.untitledGroup')}
              </h2>
              {isLeader ? (
                <span
                  data-testid="role-badge-leader"
                  className="bg-bq-amberd text-white px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-bq-amber/70 whitespace-nowrap shadow-bq-amb inline-flex items-center gap-1"
                >
                  <span>👑</span>
                  <span>{t('groups.leaderBadge')}</span>
                </span>
              ) : myRole === 'MOD' ? (
                <span
                  data-testid="role-badge-mod"
                  className="bg-bq-sapphire/15 text-bq-sapphire px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-bq-sapphire/40 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[11px]">shield</span>
                  Mod
                </span>
              ) : (
                <span
                  data-testid="role-badge-member"
                  className="bg-bq-inset text-bq-ink2 px-2 py-0.5 rounded-full text-[10px] font-bold border border-bq-hair inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[11px]">person</span>
                  Thành viên
                </span>
              )}
            </div>
            {/* Subtitle line: members count · 👑 Leader name */}
            <div className="text-bq-ink2 text-[12px] mt-1 flex items-center gap-2 flex-wrap">
              <span data-testid="group-member-count" className="whitespace-nowrap">👥 {group.members?.length || 0} {t('groups.members')}</span>
              {leader && (
                <>
                  <span className="text-bq-ink3">·</span>
                  <span className="truncate flex items-center gap-1">
                    <span>👑</span>
                    <span className="text-bq-ink2">{t('groups.leaderRole', { defaultValue: 'Trưởng nhóm' })}:</span>
                    <span className="font-semibold text-bq-amberd truncate">{leader.name}</span>
                  </span>
                </>
              )}
            </div>
            {joinedAtLabel && (
              <div className="text-bq-ink3 text-[11px] mt-0.5">
                {joinedAtLabel}
              </div>
            )}
          </div>
        </div>

        {/* Invite code row — full-width on mobile, embedded in header card */}
        <div
          data-testid="group-code-pill"
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bq-cream border-2 border-bq-ink w-full sm:w-auto"
        >
          <span className="text-[13px] text-bq-ink2 font-bold whitespace-nowrap">
            {t('groups.groupCodeLabel')}
          </span>
          <button
            data-testid="group-join-code"
            onClick={handleCopyCode}
            title={t('groups.copyCodeTooltip', { defaultValue: 'Click to copy invite code' })}
            className="font-display font-extrabold tracking-[0.12em] text-bq-ink text-[17px] flex-1 sm:flex-none text-left hover:opacity-80 transition-opacity"
          >
            {copied ? t('groups.copied') : group.code}
          </button>
          <button
            type="button"
            onClick={handleCopyCode}
            title={t('groups.copyCodeTooltip', { defaultValue: 'Click to copy invite code' })}
            aria-label={t('groups.copyCodeTooltip', { defaultValue: 'Copy invite code' })}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-bq-ink2 hover:text-bq-ink hover:bg-bq-hair transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">{copied ? 'check' : 'content_copy'}</span>
          </button>
          <button
            type="button"
            data-testid="group-show-qr"
            onClick={() => setShowQrModal(true)}
            title={t('groups.qrModal.openTooltip')}
            aria-label={t('groups.qrModal.openTooltip')}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-bq-ink2 hover:text-bq-amberd hover:bg-bq-hair transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
          </button>
          <button
            type="button"
            data-testid="group-share-invite"
            onClick={handleShare}
            title={t('groups.shareInvite')}
            aria-label={t('groups.shareInvite')}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-bq-ink2 hover:text-bq-amberd hover:bg-bq-hair transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
          </button>
        </div>
      </header>

      {/* ── Tab Navigation (compact, GD-6 count badges, GD-9 analytics leader-only) ── */}
      {(() => {
        const membersCount = memberTotal || group.members?.length || 0;
        const announcementsCount = announcements.length;
        const quizSetsCount = quizSets.length;
        const TABS: { key: TabKey; label: string; count?: number; hasNotification?: boolean; leaderOnly?: boolean }[] = [
          { key: 'activity', label: t('groups.tabs.activity') },
          { key: 'members', label: t('groups.membersTab'), count: membersCount },
          { key: 'announcements', label: t('groups.announcementsTab'), count: announcementsCount, hasNotification: true },
          // Leader/Mod only: members no longer get solo practice access, so the
          // Câu hỏi tab is leader-tooling territory only (publish + co-play orchestration).
          ...(isLeaderOrMod ? [{ key: 'quizsets' as TabKey, label: t('groups.quizSetsTab'), count: quizSetsCount, leaderOnly: true }] : []),
        ];
        return (
          <nav className="flex flex-nowrap items-center gap-1.5 sm:gap-2 mb-4 whitespace-nowrap overflow-x-auto p-1.5 bg-bq-white/90 border-[3px] border-bq-ink rounded-full w-fit max-w-full">
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  data-testid={`group-tab-${tab.key}`}
                  aria-pressed={active}
                  className={`px-3 sm:px-4 py-1.5 rounded-full border-2 text-[13px] sm:text-[14px] font-extrabold transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-bq-amber border-bq-ink text-bq-ink'
                      : 'border-transparent text-bq-ink2 hover:bg-bq-cream'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      data-testid={`group-tab-${tab.key}-count`}
                      className={`text-[11.5px] px-1.5 py-0.5 rounded-full leading-none border ${
                        active
                          ? 'bg-bq-white border-bq-ink text-bq-ink'
                          : 'bg-bq-paper border-bq-ink/25 text-bq-ink2'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.leaderOnly && (
                    <span
                      title={t('groups.leaderOnly')}
                      className="text-[9px] text-bq-amberd bg-bq-amber/15 px-1.5 py-0.5 rounded font-bold leading-none"
                    >
                      👑
                    </span>
                  )}
                  {tab.hasNotification && announcements.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  )}
                </button>
              );
            })}
          </nav>
        );
      })()}

      {/* ── Tab Content ── */}

      {/* ===== ACTIVITY TAB (GD-1: replaces former Leaderboard tab) ===== */}
      {activeTab === 'activity' && (
        <GroupActivityTab
          groupId={id!}
          groupCreatedAt={(group as any).createdAt}
          isLeader={isLeader}
          isLeaderOrMod={isLeaderOrMod}
          memberCount={memberTotalForOverview}
          announcementsCount={announcements.length}
          members={(group.members ?? []).map((m) => ({
            userId: m.userId,
            name: m.name,
            avatarUrl: m.avatarUrl,
            role: m.role,
            lastActiveAt: m.lastActiveAt ?? null,
          }))}
          quizSets={latestQuizSetsForOverview.map((qs) => ({
            id: qs.id,
            name: qs.name,
            questionCount: qs.questionCount,
            createdAt: qs.createdAt,
            coverImageUrl: qs.coverImageUrl ?? null,
            playCount: qs.playCount ?? 0,
            averageRating: qs.averageRating ?? null,
          }))}
          hasActiveScheduledQuiz={activeScheduled.length > 0}
          scheduledCount={activeScheduled.length}
          firstScheduledQuizId={activeScheduled[0]?.id ?? null}
          playingSetId={playingSetId}
          onCreateQuizSet={openCreateModal}
          onPostAnnouncement={() => handleTabChange('announcements')}
          onInvite={handleCopyCode}
          onSwitchToTab={(key) => handleTabChange(key)}
          onPlayQuizSet={handlePlayQuizSet}
        />
      )}

      {/* ===== MEMBERS TAB (mockup: groups_member_list_expanded.html) ===== */}
      {activeTab === 'members' && (
        <section className="px-6 lg:px-12 mt-8" data-testid="group-detail-members">
          {/* Header + search + sort */}
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div>
              <div className="text-bq-ink text-[18px] font-medium">
                {t('groups.membersHeader', { count: memberTotal || group.members?.length || 0 })}
              </div>
              <div className="text-bq-ink2 text-[11px] mt-0.5">
                {t('groups.membersHeaderSubtitle', {
                  active: memberItems.filter((m) => !isInactive(m)).length,
                  inactive: memberItems.filter((m) => isInactive(m)).length,
                })}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="bg-bq-white border-[0.5px] border-bq-hair rounded-lg px-2.5 sm:px-3 py-2 flex items-center gap-2 sm:min-w-[220px]">
                <span className="text-[12px] text-bq-ink3">🔍</span>
                <input
                  className="bg-transparent border-0 outline-none text-bq-ink text-[11px] sm:text-[12px] flex-1 placeholder:text-bq-ink3"
                  placeholder={t('groups.memberSearchPlaceholder')}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-bq-ink2 text-[10px] sm:hidden">{t('groups.sortByScore').split(' ')[0]}:</span>
                <div className="inline-flex bg-bq-inset rounded-md p-0.5">
                  {(['score', 'tier', 'activity'] as MemberSort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMemberSort(s)}
                      className={`border-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-medium cursor-pointer transition-all ${
                        memberSort === s ? 'bg-bq-amberd text-white' : 'bg-transparent text-bq-ink2'
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
                        ? 'bg-bq-ember/15 text-bq-ember border-bq-ember/40'
                        : 'bg-bq-amber/15 text-bq-amberd border-bq-amber/40'
                      : isInactiveChip
                      ? 'bg-bq-ember/[0.08] text-bq-ember border-bq-ember/30'
                      : 'bg-bq-inset text-bq-ink2 border-bq-hair'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {memberLoading && memberItems.length === 0 ? (
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl py-10 text-center">
              <div className="w-8 h-8 border-2 border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin mx-auto" />
            </div>
          ) : memberItems.length === 0 ? (
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl py-10 text-center text-bq-ink2 text-[12px]">
              {t('groups.noMembersFound')}
            </div>
          ) : (
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl overflow-hidden">
              {/* Header row — desktop grid only; mobile rows use flex layout below */}
              <div className="hidden sm:grid grid-cols-[40px_1fr_100px_100px_100px_60px] gap-3 px-4 py-2.5 bg-bq-inset border-b-[0.5px] border-bq-hair items-center">
                <div className="text-bq-ink3 text-[9px] font-medium tracking-wider">#</div>
                <div className="text-bq-ink3 text-[9px] font-medium tracking-wider">{t('groups.colMember')}</div>
                <div className="text-bq-ink3 text-[9px] font-medium tracking-wider text-right">{t('groups.colWeekScore')}</div>
                <div className="text-bq-ink3 text-[9px] font-medium tracking-wider text-right">{t('groups.colStreak')}</div>
                <div className="text-bq-ink3 text-[9px] font-medium tracking-wider text-right">{t('groups.colLastActive')}</div>
                <div></div>
              </div>

              {/* Rows */}
              {memberItems.map((m, idx) => {
                const isMe = m.name === user?.name;
                const isMemberLeader = m.role === 'LEADER';
                const isMemberMod = m.role === 'MOD' || m.role === 'MODERATOR';
                const inactive = isInactive(m);
                const tierColor = isMemberLeader ? '#D97F06' : isMemberMod ? '#2F6FB0' : '#4D3A1F';

                return (
                  <div
                    key={m.userId}
                    className={`flex sm:grid sm:grid-cols-[40px_1fr_100px_100px_100px_60px] gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 items-center border-b-[0.5px] border-bq-hair ${
                      isMe ? 'bg-bq-amber/[0.08] border-l-2 border-l-bq-amberd' : isMemberLeader ? 'bg-bq-amber/[0.05]' : ''
                    } ${inactive ? 'opacity-60' : ''}`}
                  >
                    <div className={`text-[12px] sm:text-[13px] font-medium text-center w-[16px] sm:w-auto flex-shrink-0 ${isMe || isMemberLeader ? 'text-bq-amberd' : 'text-bq-ink2'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0 ${
                          isMemberLeader
                            ? 'bg-bq-amber/30 border-[1.5px] border-bq-amberd text-bq-amberd'
                            : isMemberMod
                            ? 'bg-bq-sapphire/20 text-bq-sapphire'
                            : inactive
                            ? 'bg-bq-ember/20 text-bq-ember'
                            : 'bg-bq-inset text-bq-ink2'
                        }`}
                      >
                        {(() => {
                          const r = resolveAvatar(m.avatarUrl, m.name);
                          if (r.kind === 'img')    return <img alt={m.name} src={r.src} className="w-full h-full rounded-full object-cover" />;
                          if (r.kind === 'preset') return <span className="w-full h-full rounded-full flex items-center justify-center text-base" style={{ background: r.preset.bg }} aria-hidden>{r.preset.emoji}</span>;
                          return r.initial;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-bq-ink text-[11px] sm:text-[12px] font-medium flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          {m.name}
                          {isMemberLeader && (
                            <span className="bg-bq-amber/20 text-bq-amberd px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              👑 {t('groups.filterLeader')}
                            </span>
                          )}
                          {isMemberMod && (
                            <span className="bg-bq-sapphire/15 text-bq-sapphire px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              🛡️ {t('groups.filterMod')}
                            </span>
                          )}
                          {isMe && (
                            <span className="bg-bq-amber/20 text-bq-amberd px-1.5 py-px rounded-full text-[8px] sm:text-[9px] flex-shrink-0">
                              {t('groups.youBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] sm:text-[10px]" style={{ color: inactive ? '#FF6F3D' : tierColor }}>
                          {inactive ? t('groups.inactiveBadge') : t('groups.memberRole')}
                        </div>
                      </div>
                    </div>
                    {/* Mobile: score + time stacked right */}
                    <div className="flex flex-col items-end flex-shrink-0 sm:hidden">
                      <div className={`text-[12px] font-medium ${isMe || isMemberLeader ? 'text-bq-amberd' : 'text-bq-ink'}`}>
                        {(m.score ?? 0).toLocaleString()}
                      </div>
                      <div className={`text-[9px] ${inactive ? 'text-bq-ember' : 'text-bq-ink3'}`}>
                        {formatRelativeTime(m.lastActiveAt ?? m.joinedAt)}
                      </div>
                    </div>
                    {/* Desktop: separate grid columns */}
                    <div className={`hidden sm:block text-[13px] font-medium text-right ${isMe || isMemberLeader ? 'text-bq-amberd' : 'text-bq-ink'}`}>
                      {(m.score ?? 0).toLocaleString()}
                    </div>
                    <div className="hidden sm:block text-bq-ink3 text-[12px] text-right">— 0</div>
                    <div className={`hidden sm:block text-[11px] text-right ${inactive ? 'text-bq-ember' : 'text-bq-ink2'}`}>
                      {formatRelativeTime(m.lastActiveAt ?? m.joinedAt)}
                    </div>
                    <div className="hidden sm:flex text-right justify-end gap-1">
                      {inactive && isLeaderOrMod && (
                        <button
                          onClick={() => alert(t('groups.remindCta'))}
                          className="bg-bq-ember/15 text-bq-ember border-[0.5px] border-bq-ember/40 rounded-[4px] px-2 py-0.5 text-[10px] cursor-pointer hover:brightness-105"
                        >
                          {t('groups.remindCta')}
                        </button>
                      )}
                      {isLeader && !isMemberLeader && !isMe && (
                        <details className="relative inline-block">
                          <summary className="list-none cursor-pointer text-bq-ink3 text-[14px] hover:text-bq-ink2">⋯</summary>
                          <div className="absolute right-0 top-full mt-1 z-10 bg-bq-white border-[0.5px] border-bq-hair rounded-lg shadow-bq-soft py-1 min-w-[160px]">
                            {!isMemberMod ? (
                              <button
                                onClick={() => handleChangeRole(m.userId, 'MOD')}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-bq-ink hover:bg-bq-inset"
                              >
                                {t('groups.promoteToMod')}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeRole(m.userId, 'MEMBER')}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-bq-ink hover:bg-bq-inset"
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
                <div className="px-4 py-3 text-center bg-bq-inset">
                  <button
                    onClick={() => fetchMembers(memberCursor, true)}
                    disabled={memberLoading}
                    className="bg-bq-white text-bq-ink2 border-[0.5px] border-bq-hair rounded-md px-5 py-2 text-[11px] cursor-pointer hover:bg-bq-inset disabled:opacity-50"
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
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-bq-inset border-[0.5px] border-bq-hair rounded-lg px-3 py-2 text-bq-ink text-[12px] outline-none focus:border-bq-amberd/40 placeholder:text-bq-ink3"
                  value={newAnnouncement}
                  onChange={e => setNewAnnouncement(e.target.value)}
                  placeholder={t('groups.writeAnnouncement')}
                  onKeyDown={e => e.key === 'Enter' && handlePostAnnouncement()}
                  maxLength={500}
                />
                <button
                  onClick={handlePostAnnouncement}
                  disabled={postingAnnouncement || !newAnnouncement.trim()}
                  className="bg-bq-action text-bq-ink shadow-bq-action rounded-lg px-4 py-2 text-[11px] font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  📨 {postingAnnouncement ? '...' : t('groups.send')}
                </button>
              </div>
            </div>
          )}

          {/* Announcements list */}
          <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-4">
            <div className="text-bq-ink text-[13px] font-medium mb-3">📢 {t('groups.announcements')}</div>

            {announcementsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-2 border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <div
                data-testid="announcements-empty"
                className="flex flex-col items-center text-center py-10 px-4"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  <span className="material-symbols-outlined text-[28px] text-bq-amberd">campaign</span>
                </div>
                <div className="text-bq-ink text-[16px] font-bold mb-2">{t('groups.noAnnouncements')}</div>
                <p className="text-bq-ink2 text-[12px] leading-relaxed max-w-[320px] mb-5">
                  {t('groups.noAnnouncementsDesc')}
                </p>
                <div className="w-full max-w-[280px] border-t border-dashed border-bq-hair pt-4 text-bq-ink3 text-[11px] inline-flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">notifications</span>
                  <span>{t('groups.noAnnouncementsFooter')}</span>
                </div>
              </div>
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
                          ? 'bg-bq-amber/[0.05] border-l-2 border-bq-amberd'
                          : 'bg-bq-inset border-[0.5px] border-bq-hair'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className={`text-[10px] font-medium ${isLeaderAuthor ? 'text-bq-amberd' : 'text-bq-ink2'}`}>
                          {isLeaderAuthor ? '👑' : '🛡️'} {a.author}
                        </div>
                        <div className="text-bq-ink3 text-[9px]">
                          {formatRelativeTime(a.createdAt)}
                        </div>
                      </div>
                      <div className="text-bq-ink text-[11px] leading-relaxed">{a.body}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== QUIZ SETS TAB (redesign: docs/group-page/group_detail_redesign_mockup.html) ===== */}
      {activeTab === 'quizsets' && (
        <>
          {/* ── Member view: Live call banner — prominent single banner per member mockup ── */}
          {!isLeaderOrMod && activeRooms.length > 0 && (
            <div className="mb-5">
              {activeRooms.slice(0, 1).map(rm => {
                const isInProgress = rm.status === 'IN_PROGRESS';
                const ms = Date.now() - new Date(rm.createdAt).getTime();
                const mins = Math.max(0, Math.floor(ms / 60000));
                const opened = mins < 1 ? 'vừa xong' : mins < 60 ? `${mins} phút trước` : `${Math.floor(mins / 60)} giờ trước`;
                return (
                  <button
                    key={rm.id}
                    onClick={async () => {
                      try {
                        const res = await api.post('/api/rooms/join', { roomCode: rm.roomCode });
                        const joined = res.data.room;
                        navigate(`/room/${joined.id}/lobby`, { state: { room: joined, viewerUserId: res.data.viewerUserId, fromGroupId: id } });
                      } catch {
                        navigate(`/room/${rm.id}/lobby`, { state: { fromGroupId: id } });
                      }
                    }}
                    className="live-call-banner relative w-full overflow-hidden rounded-2xl p-4 sm:p-5 text-left cursor-pointer transition-all hover:brightness-105 grid items-center gap-3 sm:gap-4 grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(47,111,176,0.10) 0%, #FFFFFF 60%)',
                      border: '1px solid rgba(47,111,176,0.35)',
                      boxShadow: '0 18px 40px -24px rgba(20,20,30,.28)',
                    }}
                  >
                    <div className="absolute top-[-30px] right-[-30px] w-[100px] h-[100px] pointer-events-none"
                      style={{ background: 'radial-gradient(circle, rgba(47,111,176,0.12) 0%, transparent 70%)' }} />
                    <div className="w-12 h-12 rounded-[13px] grid place-items-center text-[24px] flex-shrink-0 relative z-[1]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(47,111,176,0.18) 0%, rgba(47,111,176,0.10) 100%)',
                        border: '1px solid rgba(47,111,176,0.35)',
                        color: '#2F6FB0',
                      }}>
                      <span className="material-symbols-outlined text-[24px]">groups</span>
                    </div>
                    <div className="min-w-0 relative z-[1]">
                      <div className="flex items-center gap-1.5 text-[12px] font-extrabold sm:tracking-wider mb-1"
                        style={{ color: '#2F6FB0' }}>
                        <span className="w-[7px] h-[7px] rounded-full inline-block flex-shrink-0 animate-pulse"
                          style={{ background: '#2F6FB0', boxShadow: '0 0 0 0 rgba(47,111,176,0.5)' }} />
                        <span className="truncate">
                          {isInProgress ? `Đang chơi · ${rm.currentPlayers} người` : `Trưởng nhóm vừa mở phòng · ${opened}`}
                        </span>
                      </div>
                      <div className="text-bq-ink text-[15px] sm:text-[17px] font-extrabold mb-1 truncate">
                        "{rm.quizSetName || rm.roomName}" — đang chờ bạn
                      </div>
                      <div className="text-[12px] text-bq-ink2 truncate">
                        {rm.currentPlayers}/{rm.maxPlayers} người · Mã phòng {rm.roomCode}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex-shrink-0 relative z-[1] py-3 sm:py-3.5 px-4 sm:px-6 rounded-[11px] flex sm:inline-flex items-center justify-center gap-2 text-[14px] font-extrabold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #2F6FB0 0%, #1E2E86 100%)',
                        boxShadow: '0 26px 46px -28px rgba(47,111,176,.5)',
                      }}>
                      <span className="material-symbols-outlined text-[18px]">login</span>
                      Tham gia phòng
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Section: Đang diễn ra (compact 2-col grid for leader, or extra rooms/scheduled for member) ── */}
          {((isLeaderOrMod && (activeRooms.length > 0 || activeScheduled.length > 0)) ||
            (!isLeaderOrMod && (activeRooms.length > 1 || activeScheduled.length > 0))) && (
            <>
              <div className="flex items-center gap-2 mb-3.5 mx-1">
                <span className="material-symbols-outlined text-[20px] text-bq-amberd">play_circle</span>
                <div className="text-bq-ink text-[16px] font-bold">Đang diễn ra</div>
                <span className="text-bq-amberd text-[12px] font-bold rounded-lg px-2 py-0.5"
                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                  {(isLeaderOrMod ? activeRooms.length : Math.max(0, activeRooms.length - 1)) + activeScheduled.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
                {/* Live rooms (purple) — render trước. Member đã thấy room đầu tiên ở banner trên → skip */}
                {(isLeaderOrMod ? activeRooms : activeRooms.slice(1)).map(rm => {
                  const isInProgress = rm.status === 'IN_PROGRESS';
                  return (
                    <button
                      key={rm.id}
                      onClick={async () => {
                        try {
                          const res = await api.post('/api/rooms/join', { roomCode: rm.roomCode });
                          const joined = res.data.room;
                          navigate(`/room/${joined.id}/lobby`, { state: { room: joined, viewerUserId: res.data.viewerUserId, fromGroupId: id } });
                        } catch (e: any) {
                          // Nếu user đã ở trong phòng rồi → vào thẳng lobby
                          navigate(`/room/${rm.id}/lobby`, { state: { fromGroupId: id } });
                        }
                      }}
                      className="rounded-2xl p-4 text-left cursor-pointer transition-all hover:brightness-105"
                      style={{
                        background: 'linear-gradient(135deg, rgba(47,111,176,0.06) 0%, #FFFFFF 60%)',
                        border: '1px solid rgba(47,111,176,0.25)',
                        boxShadow: '0 18px 40px -24px rgba(20,20,30,.28)',
                      }}
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-[9px] grid place-items-center flex-shrink-0"
                          style={{ background: 'rgba(47,111,176,0.12)', border: '1px solid rgba(47,111,176,0.3)', color: '#2F6FB0' }}>
                          <span className="material-symbols-outlined text-[18px]">groups</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[12px] font-bold mb-0.5"
                            style={{ color: '#2F6FB0' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                              style={{ background: '#2F6FB0' }} />
                            {isInProgress ? `Đang chơi · ${rm.currentPlayers} người` : `Phòng Live · ${rm.currentPlayers}/${rm.maxPlayers} người`}
                          </div>
                          <div className="text-bq-ink text-[14px] font-bold truncate">
                            {rm.quizSetName || rm.roomName}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-bq-ink2 mb-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">tag</span>
                          {rm.roomCode}
                        </span>
                        {!isInProgress && (
                          <>
                            <span>·</span>
                            <span>Đang chờ thành viên</span>
                          </>
                        )}
                      </div>
                      <div className="w-full py-2.5 rounded-[9px] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(47,111,176,0.12)', color: '#2F6FB0', border: '1px solid rgba(47,111,176,0.3)' }}>
                        <span className="material-symbols-outlined text-[14px]">login</span>
                        Tham gia phòng
                      </div>
                    </button>
                  );
                })}
                {/* Scheduled quizzes (blue) */}
                {activeScheduled.map(sq => {
                  const ms = new Date(sq.deadline).getTime() - Date.now();
                  const totalHours = Math.max(0, Math.floor(ms / 3600000));
                  const days = Math.floor(totalHours / 24);
                  const countdown = days >= 1 ? `Còn ${days} ngày ${totalHours % 24}h` : `Còn ${totalHours} giờ`;
                  return (
                    <button
                      key={sq.id}
                      onClick={() => navigate(`/groups/${id}/scheduled-quizzes/${sq.id}`)}
                      className="rounded-2xl p-4 text-left cursor-pointer transition-all hover:brightness-105"
                      style={{
                        background: 'linear-gradient(135deg, rgba(46,125,79,0.06) 0%, #FFFFFF 60%)',
                        border: '1px solid rgba(46,125,79,0.25)',
                        boxShadow: '0 18px 40px -24px rgba(20,20,30,.28)',
                      }}
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-[9px] grid place-items-center text-[18px] flex-shrink-0"
                          style={{ background: 'rgba(46,125,79,0.12)', border: '1px solid rgba(46,125,79,0.3)', color: '#2E7D4F' }}>
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[12px] font-bold mb-0.5"
                            style={{ color: '#2E7D4F' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                              style={{ background: '#2E7D4F' }} />
                            Quiz đã đặt lịch
                          </div>
                          <div className="text-bq-ink text-[14px] font-bold truncate">{sq.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-bq-ink2 mb-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">timer</span>
                          {countdown}
                        </span>
                        <span>·</span>
                        <span>{sq.questionCount} câu</span>
                      </div>
                      <div className="w-full py-2.5 rounded-[9px] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(46,125,79,0.12)', color: '#2E7D4F', border: '1px solid rgba(46,125,79,0.3)' }}>
                        <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                        Tham gia ngay
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Member: educational empty info khi không có activity nhưng có quiz sets ── */}
          {!isLeaderOrMod && activeRooms.length === 0 && activeScheduled.length === 0 && quizSets.length > 0 && (
            <div className="text-center py-9 px-6 mb-4 rounded-2xl"
              style={{
                background: '#EFE3C3',
                border: '1px dashed #C9B58C',
              }}>
              <div className="w-15 h-15 mx-auto mb-3.5 rounded-full grid place-items-center"
                style={{ width: 60, height: 60, background: '#FFFFFF' }}>
                <span className="material-symbols-outlined text-bq-ink2" style={{ fontSize: 28 }}>notifications_off</span>
              </div>
              <div className="text-bq-ink text-[16px] font-bold mb-1.5">Hiện chưa có quiz nhóm nào</div>
              <p className="text-bq-ink2 text-[12px] leading-relaxed max-w-sm mx-auto">
                Khi <strong className="text-bq-ink">trưởng nhóm</strong> mở phòng "Chơi cùng nhau" hoặc đặt lịch Quiz tuần,
                bạn sẽ thấy thông báo ở đây. Trong lúc chờ, bạn có thể tự ôn các bộ câu hỏi của nhóm.
              </p>
            </div>
          )}

          {/* ── Section: Bộ câu hỏi ── */}
          <div className="flex items-center justify-between mb-3.5 mx-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-bq-amberd">collections_bookmark</span>
              <div className="text-bq-ink text-[16px] font-bold">{t('groups.quizSetsSection')}</div>
              {quizSets.length > 0 && (
                <span className="text-bq-amberd text-[12px] font-bold rounded-lg px-2 py-0.5"
                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                  {quizSets.length}
                </span>
              )}
            </div>
            {!isLeaderOrMod && quizSets.length > 0 && (
              <span className="text-bq-ink3 text-[11px] italic">Trưởng nhóm tạo bộ câu hỏi</span>
            )}
            {isLeaderOrMod && quizSets.length > 0 && (
              <button
                onClick={() => navigate(`/groups/${id}/quiz-sets/new`)}
                className="inline-flex items-center gap-1 text-bq-amberd text-[12px] font-bold rounded-lg px-3 py-1.5 transition-all"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                {t('groups.createQuizSetCta')}
              </button>
            )}
          </div>

          {quizSetsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin" />
            </div>
          ) : quizSets.length === 0 ? (
            <div className="text-center py-12 px-8 rounded-2xl"
              style={{
                background: '#EFE3C3',
                border: '1px dashed rgba(245,158,11,0.25)',
              }}>
              <div className="w-[72px] h-[72px] mx-auto mb-4 rounded-full grid place-items-center"
                style={{ background: 'rgba(245,158,11,0.1)' }}>
                <span className="material-symbols-outlined text-bq-amberd" style={{ fontSize: 42 }}>collections_bookmark</span>
              </div>
              <div className="text-bq-ink text-[18px] font-bold mb-2">{t('groups.emptyQuizSetsTitle')}</div>
              <div className="text-bq-ink2 text-[13px] leading-relaxed mb-6 max-w-md mx-auto">
                {isLeaderOrMod ? t('groups.emptyQuizSetsDescLeader') : t('groups.emptyQuizSetsDescMember')}
              </div>
              {isLeaderOrMod && (
                <button onClick={() => navigate(`/groups/${id}/quiz-sets/new`)}
                  className="rounded-[10px] px-6 py-3 text-[14px] font-bold inline-flex items-center gap-2 transition hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #FF9D2E 0%, #FF5A45 55%, #B3452F 100%)', color: '#FFFFFF', boxShadow: '0 16px 34px -12px rgba(179,69,47,.6), 0 4px 16px -6px rgba(245,158,11,.55)' }}>
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t('groups.emptyQuizSetsCta')}
                </button>
              )}
            </div>
          ) : (
            // Grid of redesigned cards per MOCKUP_QUIZSET_CARDS.html — 3-section
            // glass card (header strip / body / actions footer), state-aware
            // CTA row, solo replay live + co-play wired (P1.3/P2.4).
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizSets.map((qs) => {
                const liveRoom = activeRooms.find(r => r.quizSetId === qs.id);
                const liveSchedule = activeScheduled.find(s => s.quizSetId === qs.id);
                return (
                  <QuizSetListCard
                    key={qs.id}
                    groupId={id!}
                    qs={{
                      id: qs.id,
                      groupId: id!,
                      name: qs.name,
                      questionIds: qs.questionIds ?? [],
                      totalQuestions: qs.questionCount,
                      createdBy: '',
                      createdAt: qs.createdAt,
                      language: 'vi',
                      coverImageUrl: qs.coverImageUrl ?? null,
                      coverScripture: qs.coverScripture ?? null,
                      difficulty: (qs.difficulty as QuizSetDifficulty | null) ?? null,
                      estimatedDurationMin: qs.estimatedDurationMin ?? null,
                      suggestedMode: (qs.suggestedMode as ApiQuizSet['suggestedMode']) ?? null,
                      playCount: qs.playCount ?? 0,
                      averageRating: qs.averageRating ?? null,
                      totalRatings: qs.totalRatings ?? 0,
                      publishStatus: (qs.publishStatus as PublishStatus) ?? 'PUBLISHED',
                    }}
                    myRole={(myRole as 'LEADER' | 'MOD' | 'MEMBER' | undefined) ?? null}
                    isMember={!!myRole}
                    activeCoPlayRoom={liveRoom ? {
                      id: liveRoom.id,
                      roomCode: liveRoom.roomCode,
                      currentPlayers: liveRoom.currentPlayers,
                      maxPlayers: liveRoom.maxPlayers,
                    } : null}
                    activeSchedule={liveSchedule ? { id: liveSchedule.id, deadline: liveSchedule.deadline } : null}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Report Group Modal (SPEC v1.1 §12.4) ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !reportSubmitting && setShowReportModal(false)} />
          <div className="relative bg-bq-white rounded-2xl p-6 sm:p-8 w-full max-w-md mx-4 border border-bq-hair shadow-bq-soft">
            <button
              onClick={() => setShowReportModal(false)}
              disabled={reportSubmitting}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-bq-inset text-bq-ink2 hover:text-bq-ink transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-error text-[22px]">flag</span>
              <h3 className="text-lg font-extrabold tracking-tight text-bq-ink">{t('groups.reportTitle')}</h3>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center space-y-2">
                <span className="material-symbols-outlined text-bq-emerald text-4xl">check_circle</span>
                <p className="text-bq-ink text-sm font-medium">{t('groups.reportSuccess')}</p>
              </div>
            ) : (
              <>
                <p className="text-bq-ink2 text-[12px] mb-4 leading-relaxed">
                  {t('groups.reportDescription')}
                </p>

                <div className="space-y-2 mb-4">
                  <label className="block text-[12.5px] font-bold text-bq-ink2 mb-2">
                    {t('groups.reportReasonLabel')}
                  </label>
                  {(['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'OTHER'] as ReportReason[]).map(r => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        reportReason === r
                          ? 'bg-error/10 border-error/40'
                          : 'bg-bq-inset border-bq-hair hover:bg-bq-hair'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r}
                        checked={reportReason === r}
                        onChange={() => setReportReason(r)}
                        className="accent-error"
                      />
                      <span className="text-[13px] text-bq-ink">{t(`groups.reportReason${r}`)}</span>
                    </label>
                  ))}
                </div>

                <div className="mb-5">
                  <label className="block text-[12.5px] font-bold text-bq-ink2 mb-2">
                    {t('groups.reportNoteLabel')} <span className="text-bq-ink3 font-normal normal-case">({t('common.optional')})</span>
                  </label>
                  <textarea
                    value={reportNote}
                    onChange={e => setReportNote(e.target.value.slice(0, 1000))}
                    rows={3}
                    placeholder={t('groups.reportNotePlaceholder')}
                    className="w-full bg-bq-inset border border-bq-hair rounded-lg px-3 py-2 text-[13px] text-bq-ink placeholder:text-bq-ink3 focus:outline-none focus:border-error/50"
                  />
                  <div className="text-right text-[10px] text-bq-ink3 mt-1">{reportNote.length}/1000</div>
                </div>

                {reportError && (
                  <div className="bg-error/10 border border-error/30 rounded-lg px-3 py-2 mb-4">
                    <p className="text-error text-[12px]">{reportError}</p>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowReportModal(false)}
                    disabled={reportSubmitting}
                    className="bg-bq-inset text-bq-ink2 border border-bq-hair rounded-lg px-4 py-2 text-[12px] font-medium hover:bg-bq-hair transition-all disabled:opacity-40"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportSubmitting}
                    className="bg-error text-on-error rounded-lg px-4 py-2 text-[12px] font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {reportSubmitting && (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {t('groups.reportSubmit')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-bq-white rounded-[2rem] p-10 w-full max-w-md mx-4 border border-bq-hair shadow-bq-soft">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-bq-inset text-bq-ink2 hover:text-bq-ink transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-bq-amberd text-2xl">settings</span>
              <h3 className="text-xl font-black tracking-tight text-bq-ink">{t('groups.settingsModal')}</h3>
            </div>

            <form onSubmit={handleEdit} className="space-y-5">
              <div>
                <label className="block text-[12px] font-black text-bq-ink2 mb-2">{t('groups.groupNameLabel')}</label>
                <input
                  className="w-full px-5 py-3.5 bg-bq-inset rounded-xl border border-bq-hair text-bq-ink font-medium text-sm outline-none focus:border-bq-amberd/30 transition-all"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[12px] font-black text-bq-ink2 mb-2">{t('groups.descriptionLabel')}</label>
                <textarea
                  className="w-full px-5 py-3.5 bg-bq-inset rounded-xl border border-bq-hair text-bq-ink font-medium text-sm outline-none focus:border-bq-amberd/30 transition-all resize-vertical min-h-[80px]"
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
                  className="accent-bq-amberd w-4 h-4"
                />
                <label htmlFor="editPublic" className="text-sm text-bq-ink2 font-bold">{t('groups.publicGroup')}</label>
              </div>
              <div>
                <label className="block text-[12px] font-black text-bq-ink2 mb-2">{t('groups.maxMembers')}</label>
                <input
                  className="w-full px-5 py-3.5 bg-bq-inset rounded-xl border border-bq-hair text-bq-ink font-medium text-sm outline-none focus:border-bq-amberd/30 transition-all"
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
                className="w-full py-4 bg-bq-action text-bq-ink shadow-bq-action rounded-xl font-black text-[12.5px] hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editLoading ? t('groups.saving') : t('groups.saveChanges')}
              </button>
            </form>

            {/* ── Danger Zone (LEADER only) ── */}
            {isLeader && (
              <div className="mt-8 pt-6 border-t border-error/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                  <h4 className="text-error font-bold text-sm uppercase tracking-wider">{t('groups.dangerZone')}</h4>
                </div>
                <p className="text-bq-ink2 text-[12px] mb-3 leading-relaxed">
                  {t('groups.dangerZoneDesc')}
                </p>
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="w-full py-3 rounded-xl border border-error/40 bg-error/10 text-error text-[13px] font-bold hover:bg-error/20 transition flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  {t('groups.deleteGroup')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal (typed-confirm) ── */}
      {showDeleteModal && group && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="relative bg-bq-white rounded-2xl p-6 sm:p-8 w-full max-w-md border border-error/30 shadow-bq-soft">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
              <h3 className="text-lg font-extrabold text-error">{t('groups.deleteGroupTitle')}</h3>
            </div>
            <p className="text-bq-ink text-[13px] leading-relaxed mb-2">
              {t('groups.deleteGroupWarning')}
            </p>
            <ul className="text-bq-ink2 text-[12px] list-disc list-inside space-y-1 mb-4">
              <li>{t('groups.deleteWarnMembers')}</li>
              <li>{t('groups.deleteWarnQuizSets')}</li>
              <li>{t('groups.deleteWarnAnnouncements')}</li>
              <li>{t('groups.deleteWarnIrreversible')}</li>
            </ul>
            <label className="block text-[12px] font-bold mb-1.5 text-bq-ink">
              {t('groups.deleteConfirmPrompt', { name: group.name })}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError(null); }}
              placeholder={group.name}
              className="w-full px-3.5 py-2.5 bg-bq-inset border border-bq-hair rounded-lg text-sm text-bq-ink placeholder:text-bq-ink3 focus:border-error outline-none mb-2"
              autoFocus
            />
            {deleteError && <div className="text-error text-[12px] mb-2">{deleteError}</div>}
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: '#EFE3C3', color: '#1D2B22', border: '1px solid #C9B58C' }}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim() !== group.name.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed bg-error text-on-error hover:brightness-110 transition"
              >
                {deleting ? '...' : t('groups.deleteConfirmCta')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* GD-11: Group code QR modal */}
      <GroupCodeModal
        groupName={group.name?.trim() || t('groups.untitledGroup')}
        groupCode={group.code}
        open={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </div>
  );
};

export default GroupDetail;
