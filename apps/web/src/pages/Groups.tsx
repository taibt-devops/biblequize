import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';

/* ─── Types ─── */

interface MyGroupSummary {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  code?: string;
  isPublic?: boolean;
  role: 'LEADER' | 'MOD' | 'MEMBER';
  memberCount: number;
  avgScore: number;
  accuracy: number;
  activeWeek: number;
  lastActivityAt?: string | null;
  myWeekPoints: number;
  myRank: number;
}

interface MyGroupsResponse {
  success: boolean;
  groups: MyGroupSummary[];
}

interface PublicGroupListItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  maxMembers?: number;
  location?: string;
  avatarHue?: 'gold' | 'blue' | 'purple' | 'green';
}

interface PublicGroupsResponse {
  success: boolean;
  groups: PublicGroupListItem[];
}

/* ─── localStorage cache (one-name hint for Home mode-card) ─── */

interface SavedGroup { id: string; name: string }
const STORAGE_KEY = 'biblequiz_my_groups';

function saveGroupCache(groups: SavedGroup[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(groups)); } catch { /* ignore */ }
}

function clearGroupCache() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/* ─── Helpers ─── */

function getInitial(name?: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

function formatRelativeTime(t: string | null | undefined, t_: ReturnType<typeof useTranslation>['t']): string {
  if (!t) return t_('groups.activityNever');
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t_('groups.activityNever');
  const diff = Date.now() - ms;
  const minute = 60 * 1000, hour = 60 * minute, day = 24 * hour;
  if (diff < hour) return t_('groups.activityToday');
  if (diff < day) return t_('groups.activityHoursAgo', { count: Math.max(1, Math.floor(diff / hour)) });
  if (diff < 7 * day) return t_('groups.activityDaysAgo', { count: Math.floor(diff / day) });
  return t_('groups.activityInactive');
}

function isActiveToday(t: string | null | undefined): boolean {
  if (!t) return false;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < 24 * 60 * 60 * 1000;
}

const HUE_KEYS: Array<NonNullable<PublicGroupListItem['avatarHue']>> = ['gold', 'blue', 'purple', 'green'];
function pickHue(id: string): NonNullable<PublicGroupListItem['avatarHue']> {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return HUE_KEYS[hash % HUE_KEYS.length];
}
const HUE_BG: Record<NonNullable<PublicGroupListItem['avatarHue']>, string> = {
  gold: 'bg-bq-amber/15',
  blue: 'bg-bq-sapphire/15',
  purple: 'bg-bq-sapphire/15',
  green: 'bg-bq-emerald/15',
};
const HUE_ICON: Record<NonNullable<PublicGroupListItem['avatarHue']>, string> = {
  gold: '⛪', blue: '📖', purple: '✝️', green: '🕊️',
};

/* ─── Skeleton ─── */

function GroupsPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-pulse" data-testid="groups-skeleton">
      <div className="h-12 bg-bq-inset rounded-xl" />
      <div className="h-20 bg-bq-inset rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 bg-bq-inset rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ─── Group Card (current user's group) ─── */

function GroupCard({ group, onOpen }: { group: MyGroupSummary; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const isLeader = group.role === 'LEADER';
  const isMod = group.role === 'MOD';
  const activeNow = isActiveToday(group.lastActivityAt);

  return (
    <button
      data-testid="group-card"
      onClick={() => onOpen(group.id)}
      className={`relative text-left bg-bq-white shadow-bq-soft border rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 hover:-translate-y-0.5 transition-all overflow-hidden ${
        isLeader
          ? 'border-bq-amber/35 hover:border-bq-amber/55'
          : 'border-bq-hair hover:border-bq-amber/40'
      }`}
    >
      {/* Leader gradient overlay */}
      {isLeader && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-bq-amber/[0.06] to-transparent" />
      )}

      {/* Top: avatar + name + role badge */}
      <div className="flex gap-3 sm:gap-3.5 items-start relative">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-bq-amber/20 to-bq-amberd/10 border border-bq-amber/25 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {group.avatarUrl ? (
            <img alt={group.name} src={group.avatarUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[22px] sm:text-[28px]">⛪</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-bq-ink text-[14px] sm:text-[16px] font-semibold truncate flex-1 min-w-0">
              {group.name}
            </div>
            {isLeader ? (
              <span className="bg-bq-amberd text-white text-[11.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
                <span className="material-symbols-outlined text-[11px]">workspace_premium</span>
                {t('groups.roleLeaderShort')}
              </span>
            ) : isMod ? (
              <span className="bg-bq-sapphire/15 text-bq-sapphire border border-bq-sapphire/30 text-[11.5px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
                {t('groups.roleModShort')}
              </span>
            ) : (
              <span className="bg-bq-inset text-bq-ink2 border border-bq-hair text-[11.5px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
                {t('groups.roleMemberShort')}
              </span>
            )}
          </div>
          {group.description && (
            <div className="text-bq-ink2 text-[11px] sm:text-[12px] leading-snug line-clamp-2">
              {group.description}
            </div>
          )}
        </div>
      </div>

      {/* Stats: 3 cells */}
      <div className="grid grid-cols-3 bg-bq-inset rounded-lg p-2.5 sm:p-3 relative">
        <div className="text-center px-1 border-r border-bq-hair">
          <div className="text-bq-amberd text-[15px] sm:text-[17px] font-bold leading-tight">
            {group.memberCount}
          </div>
          <div className="text-bq-ink2 text-[11.5px] sm:text-[10px] mt-0.5">
            {t('groups.statMembersShort')}
          </div>
        </div>
        <div className="text-center px-1 border-r border-bq-hair">
          <div className="text-bq-amberd text-[15px] sm:text-[17px] font-bold leading-tight">
            {group.avgScore}
          </div>
          <div className="text-bq-ink2 text-[11.5px] sm:text-[10px] mt-0.5">
            {t('groups.statAvgScore')}
          </div>
        </div>
        <div className="text-center px-1">
          <div className="text-bq-amberd text-[15px] sm:text-[17px] font-bold leading-tight">
            {group.accuracy}%
          </div>
          <div className="text-bq-ink2 text-[11.5px] sm:text-[10px] mt-0.5">
            {t('groups.statAccuracy')}
          </div>
        </div>
      </div>

      {/* Footer: activity dot + (code if leader/mod, rank if member) */}
      <div className="flex items-center justify-between text-[11px] sm:text-[12px] relative">
        <span className="inline-flex items-center gap-1.5 text-bq-ink2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${activeNow ? 'bg-bq-emerald' : 'bg-bq-ink3'}`}
          />
          {activeNow ? t('groups.activityToday') : formatRelativeTime(group.lastActivityAt, t)}
        </span>
        {(isLeader || isMod) && group.code ? (
          <span className="inline-flex items-center gap-1 text-bq-ink2 font-mono">
            <span className="material-symbols-outlined text-[13px]">key</span>
            {group.code}
          </span>
        ) : group.role === 'MEMBER' && group.myRank > 0 ? (
          <span className="text-bq-amberd font-semibold">
            {t('groups.myRankInGroup', { rank: group.myRank, total: group.memberCount })}
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* ─── Public Card ─── */

function PublicCard({
  group,
  onJoin,
  joining,
}: {
  group: PublicGroupListItem;
  onJoin: (code: string | undefined) => void;
  joining: boolean;
}) {
  const { t } = useTranslation();
  const hue = group.avatarHue ?? pickHue(group.id);
  return (
    <div className="w-full h-full bg-bq-white shadow-bq-soft border border-bq-hair hover:border-bq-amber/30 rounded-2xl p-3.5 sm:p-4.5 transition-all flex flex-col">
      <div className="flex gap-2.5 items-center mb-3">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-[18px] sm:text-[22px] flex-shrink-0 overflow-hidden ${HUE_BG[hue]}`}>
          {group.avatarUrl ? (
            <img alt={group.name} src={group.avatarUrl} className="w-full h-full object-cover" />
          ) : (
            HUE_ICON[hue]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-bq-ink text-[13px] sm:text-[14px] font-semibold truncate">
            {group.name}
          </div>
          <div className="text-bq-ink2 text-[10px] sm:text-[11px] inline-flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[12px]">group</span>
            {group.memberCount} {t('groups.members')}
          </div>
        </div>
      </div>
      <div
        className="text-bq-ink2 text-[11px] sm:text-[12px] leading-relaxed line-clamp-2 mb-3 flex-1 min-h-[2.5em]"
        title={group.description ?? ''}
      >
        {group.description ?? ''}
      </div>
      <button
        onClick={() => onJoin(group.code)}
        disabled={joining}
        className="w-full bg-bq-amber/10 text-bq-amberd border border-bq-amber/30 hover:bg-bq-amber/20 rounded-lg px-3 py-2 text-[11px] sm:text-[12px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
      >
        + {t('groups.joinBtn')}
      </button>
    </div>
  );
}

/* ─── Main Component ─── */

const Groups: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Quick-join bar code input (separate from modal join code)
  const [quickCode, setQuickCode] = useState('');
  const [quickJoining, setQuickJoining] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Create form
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createIsPublic, setCreateIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal join form
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // My groups (multi)
  const {
    data: myGroupsRes,
    isLoading: myGroupsLoading,
    refetch: refetchMyGroups,
  } = useQuery<MyGroupsResponse>({
    queryKey: ['my-groups'],
    queryFn: () =>
      api
        .get('/api/groups/mine')
        .then((r) => r.data as MyGroupsResponse)
        .catch(() => ({ success: false, groups: [] })),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const myGroups = myGroupsRes?.groups ?? [];

  // Public groups discovery
  const { data: publicRes, isLoading: publicLoading } = useQuery<PublicGroupsResponse>({
    queryKey: ['public-groups', 'featured'],
    queryFn: () =>
      api
        .get('/api/groups/public?featured=true&limit=8')
        .then((r) => r.data as PublicGroupsResponse)
        .catch(() => ({ success: false, groups: [] })),
    staleTime: 5 * 60 * 1000,
  });
  const publicGroups = publicRes?.groups ?? [];

  // Reconcile localStorage cache (used by Home GameModeGrid live hint)
  useEffect(() => {
    if (!myGroupsRes) return;
    if (myGroups.length > 0) {
      // Persist {id, name} only — never join codes (sensitive on shared devices).
      saveGroupCache(myGroups.map((g) => ({ id: g.id, name: g.name })));
    } else {
      clearGroupCache();
    }
  }, [myGroupsRes, myGroups]);

  const handleOpenGroup = (id: string) => navigate(`/groups/${id}`);

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;
    setQuickJoining(true);
    setQuickError('');
    try {
      const res = await api.post('/api/groups/join', { code: quickCode.trim().toUpperCase() });
      if (res.data.success) {
        setQuickCode('');
        await refetchMyGroups();
        const groupId = res.data.data?.groupId ?? res.data.group?.id;
        if (groupId) navigate(`/groups/${groupId}`);
      } else {
        setQuickError(res.data.message || t('groups.joinFailed'));
      }
    } catch (err: any) {
      setQuickError(err.response?.data?.message || t('groups.invalidCode'));
    } finally {
      setQuickJoining(false);
    }
  };

  const handleJoinPublicGroup = async (code: string | undefined) => {
    if (!code) return;
    setQuickJoining(true);
    try {
      const res = await api.post('/api/groups/join', { code });
      if (res.data.success) {
        await refetchMyGroups();
        const groupId = res.data.data?.groupId ?? res.data.group?.id;
        if (groupId) navigate(`/groups/${groupId}`);
      }
    } catch { /* swallow — quickError stays empty for public buttons */ }
    finally { setQuickJoining(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await api.post('/api/groups', {
        name: createName.trim(),
        description: createDesc.trim(),
        isPublic: createIsPublic,
      });
      if (res.data.success) {
        const group = res.data.group;
        await refetchMyGroups();
        setShowCreateModal(false);
        setCreateName('');
        setCreateDesc('');
        setCreateIsPublic(true);
        navigate(`/groups/${group.id}`);
      } else {
        setCreateError(res.data.message || t('groups.createFailed'));
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.message || t('groups.connectionError'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleModalJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setJoinError('');
    try {
      const res = await api.post('/api/groups/join', { code: joinCode.trim().toUpperCase() });
      if (res.data.success) {
        await refetchMyGroups();
        setShowJoinModal(false);
        setJoinCode('');
        const groupId = res.data.data?.groupId ?? res.data.group?.id;
        if (groupId) navigate(`/groups/${groupId}`);
      } else {
        setJoinError(res.data.message || t('groups.joinFailed'));
      }
    } catch (err: any) {
      setJoinError(err.response?.data?.message || t('groups.invalidCode'));
    } finally {
      setJoinLoading(false);
    }
  };

  if (!isAuthenticated) return null;
  if (myGroupsLoading) return <GroupsPageSkeleton />;

  const hasGroups = myGroups.length > 0;

  return (
    <div className="bg-bq-paper max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-24 lg:pb-12 space-y-6 sm:space-y-7" data-testid="groups-page">
      {/* ── Page Header ── */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-bq-ink text-[22px] sm:text-[28px] lg:text-[32px] font-extrabold tracking-tight leading-tight">
            {t('groups.pageTitle')}
          </h2>
          <p className="text-bq-ink2 text-[12px] sm:text-[14px] mt-1">
            {t('groups.pageSubtitle')}
          </p>
        </div>
        {/* Desktop create button (mobile uses FAB) */}
        <button
          onClick={() => setShowCreateModal(true)}
          data-testid="groups-create-btn"
          className="hidden lg:inline-flex items-center gap-2 bg-bq-action text-bq-ink shadow-bq-action font-bold text-[14px] px-5 py-3 rounded-xl hover:-translate-y-0.5 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          {t('groups.createGroupCta')}
        </button>
      </header>

      {/* ── Quick Join Bar (always visible) ── */}
      <form
        onSubmit={handleQuickJoin}
        data-testid="groups-quick-join"
        className="bg-bq-white shadow-bq-soft border border-bq-hair rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-5 flex-wrap"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-bq-amber/20 to-bq-amberd/10 border border-bq-amber/30 flex items-center justify-center text-bq-amberd text-[20px] flex-shrink-0">
          <span className="material-symbols-outlined">key</span>
        </div>
        <div className="flex-shrink-0">
          <div className="text-bq-ink text-[13px] font-bold">{t('groups.joinByCodeCta')}</div>
          <div className="text-bq-ink2 text-[11px] mt-0.5">{t('groups.joinByCodeHint')}</div>
        </div>
        <div className="flex-1 min-w-[220px] flex gap-2">
          <input
            type="text"
            value={quickCode}
            onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
            data-testid="groups-quick-join-input"
            placeholder={t('groups.inviteCodePlaceholder')}
            maxLength={20}
            className="flex-1 bg-bq-inset border border-bq-hair focus:border-bq-amberd focus:outline-none rounded-lg px-3 py-2.5 text-bq-ink text-[13px] tracking-[2px] uppercase placeholder:tracking-normal placeholder:text-bq-ink3 placeholder:normal-case"
          />
          <button
            type="submit"
            disabled={!quickCode.trim() || quickJoining}
            data-testid="groups-quick-join-submit"
            className="bg-bq-amber/12 text-bq-amberd border border-bq-amber/30 hover:bg-bq-amber/20 hover:border-bq-amberd rounded-lg px-4 sm:px-5 py-2.5 text-[12px] sm:text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {quickJoining ? '…' : t('groups.joinBtn')}
          </button>
        </div>
        {quickError && (
          <div className="w-full text-error text-[11px] mt-1">{quickError}</div>
        )}
      </form>

      {/* ── Has groups: My Groups grid ── */}
      {hasGroups && (
        <section className="space-y-3" data-testid="my-groups-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-bq-ink text-[15px] sm:text-[17px] font-bold">
              <span className="material-symbols-outlined text-bq-amberd">church</span>
              {t('groups.myGroupsSection')}
              <span className="bg-bq-amber/12 text-bq-amberd text-[12px] font-bold px-2.5 py-0.5 rounded-lg">
                {myGroups.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {myGroups.map((g) => (
              <GroupCard key={g.id} group={g} onOpen={handleOpenGroup} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty hero ── */}
      {!hasGroups && (
        <section data-testid="no-group">
          <div className="bg-bq-white shadow-bq-soft border border-dashed border-bq-amber/35 rounded-2xl px-6 py-9 sm:py-12 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-bq-amber/10 flex items-center justify-center mx-auto mb-5 text-bq-amberd">
              <span className="material-symbols-outlined text-[36px] sm:text-[48px]">church</span>
            </div>
            <h3 className="text-bq-ink text-[18px] sm:text-[22px] font-bold mb-2.5">
              {t('groups.noGroupTitle')}
            </h3>
            <p className="text-bq-ink2 text-[13px] sm:text-[14px] leading-relaxed max-w-md mx-auto mb-6">
              {t('groups.noGroupDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center max-w-sm sm:max-w-none mx-auto">
              <button
                onClick={() => setShowCreateModal(true)}
                data-testid="groups-empty-create-btn"
                className="inline-flex items-center justify-center gap-2 bg-bq-action text-bq-ink shadow-bq-action font-bold text-[14px] px-6 py-3 rounded-xl"
              >
                <span className="material-symbols-outlined">add</span>
                {t('groups.createGroupCta')}
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                data-testid="groups-empty-join-btn"
                className="inline-flex items-center justify-center gap-2 bg-bq-amber/10 text-bq-amberd border border-bq-amber/30 font-bold text-[13px] px-6 py-3 rounded-xl"
              >
                <span className="material-symbols-outlined">key</span>
                {t('groups.joinByCodeCta')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Public discovery (always shown if there are public groups) ── */}
      {(publicLoading || publicGroups.length > 0) && (
        <section className="space-y-3" data-testid="public-groups-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-bq-ink text-[15px] sm:text-[17px] font-bold">
              <span className="material-symbols-outlined text-bq-sapphire">explore</span>
              {hasGroups ? t('groups.discoverPublic') : t('groups.discoverPublicAlt')}
            </div>
            <button className="text-bq-ink2 text-[12px] sm:text-[13px] font-semibold hover:text-bq-amberd inline-flex items-center gap-1 transition-colors">
              {t('groups.viewAll')}
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          {/* Mobile: horizontal scroll-snap; desktop: grid */}
          <div className="grid grid-flow-col sm:grid-flow-row auto-cols-[240px] sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            {publicLoading
              ? [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="snap-start sm:snap-align-none h-36 bg-bq-inset rounded-2xl animate-pulse"
                  />
                ))
              : publicGroups.map((g) => (
                  <div key={g.id} className="snap-start sm:snap-align-none flex">
                    <PublicCard group={g} onJoin={handleJoinPublicGroup} joining={quickJoining} />
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* ── FAB: mobile create button ── */}
      <button
        onClick={() => setShowCreateModal(true)}
        aria-label={t('groups.createGroupCta')}
        data-testid="groups-fab-create"
        className="lg:hidden fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-bq-action text-bq-ink flex items-center justify-center shadow-bq-action active:scale-95 transition-transform z-30"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* ── Create Group Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-bq-white rounded-2xl p-7 sm:p-8 w-full max-w-md mx-4 border border-bq-hair shadow-bq-soft">
            <button
              className="absolute top-5 right-5 text-bq-ink2 hover:text-bq-ink"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-lg font-medium mb-5 flex items-center gap-2 text-bq-ink">
              <span className="material-symbols-outlined text-bq-amberd">add_circle</span>
              {t('groups.createGroupModal')}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4" data-testid="groups-create-form">
              <div>
                <label className="block text-[12.5px] font-medium text-bq-ink2 mb-1.5">
                  {t('groups.groupName')} *
                </label>
                <input
                  data-testid="groups-create-name-input"
                  className="w-full bg-bq-inset border border-bq-hair rounded-lg px-4 py-3 text-bq-ink placeholder:text-bq-ink3 focus:outline-none focus:border-bq-amberd/50"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('groups.groupNamePlaceholder')}
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-bq-ink2 mb-1.5">
                  {t('groups.description')}
                </label>
                <textarea
                  data-testid="group-description-input"
                  className="w-full bg-bq-inset border border-bq-hair rounded-lg px-4 py-3 text-bq-ink placeholder:text-bq-ink3 focus:outline-none focus:border-bq-amberd/50 resize-none h-20"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder={t('groups.descriptionPlaceholder')}
                  maxLength={500}
                />
              </div>

              {/* Privacy toggle */}
              <div>
                <label className="block text-[12.5px] font-medium text-bq-ink2 mb-1.5">
                  {t('groups.privacyLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={createIsPublic}
                    data-testid="groups-create-public-btn"
                    onClick={() => setCreateIsPublic(true)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      createIsPublic
                        ? 'bg-bq-amber/10 border-bq-amberd text-bq-ink'
                        : 'bg-bq-inset border-bq-hair text-bq-ink2 hover:border-bq-ink3/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                      <span className="material-symbols-outlined text-[15px]">public</span>
                      {t('groups.privacyPublic')}
                    </div>
                    <div className="text-[10px] text-bq-ink3 mt-0.5 leading-snug">
                      {t('groups.privacyPublicHint')}
                    </div>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!createIsPublic}
                    data-testid="groups-create-private-btn"
                    onClick={() => setCreateIsPublic(false)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      !createIsPublic
                        ? 'bg-bq-amber/10 border-bq-amberd text-bq-ink'
                        : 'bg-bq-inset border-bq-hair text-bq-ink2 hover:border-bq-ink3/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                      <span className="material-symbols-outlined text-[15px]">lock</span>
                      {t('groups.privacyPrivate')}
                    </div>
                    <div className="text-[10px] text-bq-ink3 mt-0.5 leading-snug">
                      {t('groups.privacyPrivateHint')}
                    </div>
                  </button>
                </div>
              </div>

              {createError && <p className="text-sm text-error font-bold">{createError}</p>}
              <button
                type="submit"
                data-testid="groups-create-submit-btn"
                className="w-full py-3 bg-bq-action text-bq-ink shadow-bq-action rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={createLoading || !createName.trim()}
              >
                {createLoading ? t('groups.creating') : t('groups.createGroupBtn')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Join Group Modal (used by empty-state CTA only) ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowJoinModal(false)}
          />
          <div className="relative bg-bq-white rounded-2xl p-7 sm:p-8 w-full max-w-md mx-4 border border-bq-hair shadow-bq-soft">
            <button
              className="absolute top-5 right-5 text-bq-ink2 hover:text-bq-ink"
              onClick={() => setShowJoinModal(false)}
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-lg font-medium mb-5 flex items-center gap-2 text-bq-ink">
              <span className="material-symbols-outlined text-bq-sapphire">search</span>
              {t('groups.joinGroupModal')}
            </h3>
            <form onSubmit={handleModalJoin} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-bq-ink2 mb-1.5">
                  {t('groups.inviteCode')}
                </label>
                <input
                  className="w-full bg-bq-inset border border-bq-hair rounded-lg px-4 py-3 text-bq-ink placeholder:text-bq-ink3 focus:outline-none focus:border-bq-amberd/50 text-center text-base tracking-widest"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('groups.inviteCodePlaceholder')}
                  maxLength={20}
                  autoFocus
                />
              </div>
              {joinError && <p className="text-sm text-error font-bold">{joinError}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-bq-action text-bq-ink shadow-bq-action rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={joinLoading || !joinCode.trim()}
              >
                {joinLoading ? t('groups.joining') : t('groups.joinBtn')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
