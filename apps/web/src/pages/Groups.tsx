import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';

/* ─── Types ─── */

interface GroupInfo {
  id: string;
  name: string;
  code?: string;
  description?: string;
  memberCount?: number;
  totalPoints?: number;
  location?: string;
  bannerUrl?: string;
  logoUrl?: string;
}

interface LeaderboardMember {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  points: number;
}

interface Announcement {
  id: string;
  author: string;
  title: string;
  body: string;
  createdAt: string;
  isNew?: boolean;
}

/* ─── Helper: SavedGroup localStorage ─── */

interface SavedGroup {
  id: string;
  name: string;
  code?: string;
}

const STORAGE_KEY = 'biblequiz_my_groups';

function getSavedGroups(): SavedGroup[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveGroup(group: SavedGroup) {
  const groups = getSavedGroups().filter((g) => g.id !== group.id);
  groups.unshift(group);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function formatPoints(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString('vi-VN');
  return String(n);
}

/* ─── Skeleton ─── */

function GroupSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-pulse" data-testid="groups-skeleton">
      <div className="rounded-[2.5rem] bg-surface-container h-72" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-surface-container rounded-[2.5rem] h-96" />
          <div className="bg-surface-container rounded-[2.5rem] h-72" />
        </div>
        <div className="space-y-10">
          <div className="bg-surface-container rounded-[2.5rem] h-48" />
          <div className="bg-surface-container rounded-[2.5rem] h-64" />
        </div>
      </div>
    </div>
  );
}

/* ─── No Group View ─── */

function NoGroupView({
  onCreateClick,
  onJoinClick,
}: {
  onCreateClick: () => void;
  onJoinClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="max-w-lg mx-auto text-center py-16" data-testid="no-group">
      <span
        className="material-symbols-outlined text-6xl text-on-surface-variant mb-6 block"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        groups
      </span>
      <h2 className="text-2xl font-black tracking-tight text-on-surface mb-3">
        {t('groups.noGroupTitle')}
      </h2>
      <p className="text-on-surface-variant mb-10 leading-relaxed">
        {t('groups.noGroupDesc')}
      </p>
      <div className="flex justify-center gap-4">
        <button
          onClick={onCreateClick}
          data-testid="groups-create-btn"
          className="px-8 py-4 gold-gradient text-on-secondary rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_30px_rgba(232,168,50,0.4)] transition-all active:scale-95 shadow-lg"
        >
          {t('groups.createGroup')}
        </button>
        <button
          onClick={onJoinClick}
          data-testid="groups-join-btn"
          className="px-8 py-4 bg-surface-container-highest/80 backdrop-blur text-on-surface rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-surface-bright transition-all active:scale-95 border border-white/5"
        >
          {t('groups.findGroup')}
        </button>
      </div>
    </div>
  );
}

/* ─── Group Overview ─── */

function GroupOverview({ groupId }: { groupId: string }) {
  const { t } = useTranslation();

  const {
    data: group,
    isLoading: groupLoading,
    isError: groupError,
  } = useQuery<GroupInfo>({
    queryKey: ['group', groupId],
    queryFn: () => api.get(`/api/groups/${groupId}`).then((r) => r.data),
  });

  // BE wraps responses: GET /leaderboard → {success, leaderboard: [...]};
  // GET /announcements → {success, data: {items: [...], total, hasMore}}.
  // Unwrap to array so .map / .slice work without defensive checks downstream.
  const { data: leaderboard } = useQuery<LeaderboardMember[]>({
    queryKey: ['group-leaderboard', groupId],
    queryFn: () =>
      api.get(`/api/groups/${groupId}/leaderboard?period=weekly`).then((r) => r.data?.leaderboard ?? []),
    enabled: !!group,
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['group-announcements', groupId],
    queryFn: () => api.get(`/api/groups/${groupId}/announcements`).then((r) => r.data?.data?.items ?? []),
    enabled: !!group,
  });

  if (groupLoading) return <GroupSkeleton />;

  if (groupError || !group) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center" data-testid="group-error">
        <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
        <p className="text-on-surface font-bold text-lg mb-2">{t('groups.errorLoadGroup')}</p>
        <p className="text-on-surface-variant text-sm">{t('groups.errorLoadGroupDesc')}</p>
      </div>
    );
  }

  const top3 = (leaderboard || []).slice(0, 3);
  const rest = (leaderboard || []).slice(3);

  return (
    <div className="max-w-6xl mx-auto space-y-12" data-testid="group-overview">
      {/* ── Group Hero Header ── */}
      <header className="relative rounded-[2.5rem] overflow-hidden bg-surface-container-lowest h-72 flex flex-col justify-end p-10 group shadow-2xl">
        <div className="absolute inset-0 z-0">
          {group.bannerUrl && (
            <img
              alt="Group Banner"
              className="w-full h-full object-cover opacity-30 transition-transform duration-1000 group-hover:scale-110"
              src={group.bannerUrl}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] gold-gradient p-1 shadow-2xl">
              <div className="w-full h-full rounded-[1.75rem] bg-surface-container flex items-center justify-center overflow-hidden">
                {group.logoUrl ? (
                  <img alt="Group Logo" className="w-full h-full object-cover" src={group.logoUrl} />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-secondary">church</span>
                )}
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-on-surface mb-3">
                {group.name}
              </h1>
              <div className="flex flex-wrap gap-5 text-xs font-black tracking-widest uppercase text-secondary">
                <span className="flex items-center gap-2 bg-surface-container/50 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-[16px]">groups</span>{' '}
                  {group.memberCount ?? 0} {t('groups.members')}
                </span>
                {group.totalPoints != null && (
                  <span className="flex items-center gap-2 bg-surface-container/50 px-3 py-1 rounded-full">
                    <span className="material-symbols-outlined text-[16px]">workspace_premium</span>{' '}
                    {formatPoints(group.totalPoints)} {t('groups.points')}
                  </span>
                )}
                {group.location && (
                  <span className="flex items-center gap-2 bg-surface-container/50 px-3 py-1 rounded-full text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>{' '}
                    {group.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Bento Grid Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Leaderboard */}
        <section className="lg:col-span-2 space-y-10">
          <div className="bg-surface-container rounded-[2.5rem] p-10 shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-3xl">leaderboard</span>
                {t('groups.leaderboard')}
              </h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-full">
                {t('groups.thisWeek')}
              </span>
            </div>

            {(!leaderboard || leaderboard.length === 0) && (
              <p className="text-center text-on-surface-variant py-8">{t('groups.noLeaderboardData')}</p>
            )}

            {top3.length > 0 && (
              <div className="space-y-6">
                {/* Top 3 Featured */}
                <div className="grid grid-cols-3 gap-6 mb-12 items-end">
                  {/* Rank 2 (left) */}
                  {top3.length > 1 && (
                    <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col items-center text-center border-b-4 border-secondary/10 transition-transform hover:translate-y-[-4px]">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full border-2 border-secondary overflow-hidden shadow-lg bg-surface-container-highest">
                          {top3[1].avatarUrl ? (
                            <img alt="Rank 2" src={top3[1].avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-2xl text-on-surface-variant flex items-center justify-center w-full h-full">person</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-[10px] font-black text-on-secondary shadow-md">
                          2
                        </div>
                      </div>
                      <p className="text-sm font-black truncate w-full mb-1">{top3[1].name}</p>
                      <p className="text-xs text-secondary font-black">{formatPoints(top3[1].points)}</p>
                    </div>
                  )}

                  {/* Rank 1 (center, elevated) */}
                  <div className="bg-surface-container-high rounded-[2rem] p-8 flex flex-col items-center text-center border-b-8 border-secondary shadow-2xl relative z-10 scale-110 transition-transform hover:scale-[1.12]">
                    <div className="relative mb-5">
                      <div className="w-20 h-20 rounded-full border-4 border-secondary overflow-hidden shadow-xl bg-surface-container-highest">
                        {top3[0].avatarUrl ? (
                          <img alt="Rank 1" src={top3[0].avatarUrl} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-3xl text-on-surface-variant flex items-center justify-center w-full h-full">person</span>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm font-black text-on-secondary shadow-lg ring-4 ring-surface-container-high">
                        1
                      </div>
                    </div>
                    <p className="text-base font-black truncate w-full mb-1">{top3[0].name}</p>
                    <p className="text-xs text-secondary font-black uppercase tracking-widest">
                      {formatPoints(top3[0].points)}
                    </p>
                  </div>

                  {/* Rank 3 (right) */}
                  {top3.length > 2 && (
                    <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col items-center text-center border-b-4 border-secondary/10 transition-transform hover:translate-y-[-4px]">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full border-2 border-tertiary overflow-hidden shadow-lg bg-surface-container-highest">
                          {top3[2].avatarUrl ? (
                            <img alt="Rank 3" src={top3[2].avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-2xl text-on-surface-variant flex items-center justify-center w-full h-full">person</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-tertiary rounded-full flex items-center justify-center text-[10px] font-black text-on-tertiary shadow-md">
                          3
                        </div>
                      </div>
                      <p className="text-sm font-black truncate w-full mb-1">{top3[2].name}</p>
                      <p className="text-xs text-tertiary font-black">{formatPoints(top3[2].points)}</p>
                    </div>
                  )}
                </div>

                {/* List items (rank 4+) */}
                {rest.length > 0 && (
                  <div className="space-y-4">
                    {rest.map((member) => (
                      <div
                        key={member.userId}
                        data-testid="group-leaderboard-row"
                        className="flex items-center justify-between p-6 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-all border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-6">
                          <span className="text-xs font-black text-on-surface-variant w-4">
                            {member.rank}
                          </span>
                          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-inner bg-surface-container-highest">
                            {member.avatarUrl ? (
                              <img alt={member.name} src={member.avatarUrl} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-xl text-on-surface-variant flex items-center justify-center w-full h-full">person</span>
                            )}
                          </div>
                          <span className="font-bold text-base">{member.name}</span>
                        </div>
                        <span className="text-base font-black text-secondary">{formatPoints(member.points)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Announcements */}
        <aside className="space-y-10">
          <section className="bg-surface-container rounded-[2.5rem] p-10 overflow-hidden shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black tracking-tight">{t('groups.announcements')}</h2>
            </div>
            <div className="space-y-10">
              {/* Scripture Quote Block */}
              <div className="relative bg-surface-container-low p-6 rounded-3xl border border-white/5">
                <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-secondary rounded-full shadow-[0_0_10px_rgba(232,168,50,0.5)]" />
                <p className="text-sm font-medium italic text-on-surface/90 leading-relaxed mb-4">
                  {t('groups.scriptureQuote')}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                  {t('groups.scriptureRef')}
                </p>
              </div>

              {(!announcements || announcements.length === 0) && (
                <p className="text-center text-on-surface-variant py-4 text-sm">
                  {t('groups.noAnnouncements')}
                </p>
              )}

              {announcements &&
                announcements.map((item) => (
                  <article key={item.id} className="space-y-3 group cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.isNew ? 'bg-secondary animate-pulse' : 'bg-on-surface-variant/30'
                        }`}
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        {item.author} &bull; {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-black text-base group-hover:text-secondary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{item.body}</p>
                  </article>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

const Groups: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Create form
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Check if user has a saved group
  const savedGroups = getSavedGroups();
  const myGroupId = savedGroups.length > 0 ? savedGroups[0].id : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await api.post('/api/groups', {
        name: createName.trim(),
        description: createDesc.trim(),
      });
      if (res.data.success) {
        const group = res.data.group;
        saveGroup({ id: group.id, name: group.name, code: group.code });
        setShowCreateModal(false);
        setCreateName('');
        setCreateDesc('');
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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    setJoinError('');
    try {
      const res = await api.post('/api/groups/join', {
        code: joinCode.trim().toUpperCase(),
      });
      if (res.data.success) {
        const group = res.data.group;
        saveGroup({ id: group.id, name: group.name, code: group.code });
        setShowJoinModal(false);
        setJoinCode('');
        navigate(`/groups/${group.id}`);
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

  return (
    <div data-testid="groups-page">
      {myGroupId ? (
        <GroupOverview groupId={myGroupId} />
      ) : (
        <NoGroupView
          onCreateClick={() => setShowCreateModal(true)}
          onJoinClick={() => setShowJoinModal(true)}
        />
      )}

      {/* ── Create Group Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-surface-container rounded-[2rem] p-10 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
            <button
              className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={() => setShowCreateModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">add_circle</span>
              {t('groups.createGroupModal')}
            </h3>
            <form onSubmit={handleCreate} className="space-y-5" data-testid="groups-create-form">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">
                  {t('groups.groupName')} *
                </label>
                <input
                  data-testid="groups-create-name-input"
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50 transition-colors"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('groups.groupNamePlaceholder')}
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">
                  {t('groups.description')}
                </label>
                <textarea
                  data-testid="group-description-input"
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50 transition-colors resize-none h-24"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder={t('groups.descriptionPlaceholder')}
                  maxLength={500}
                />
              </div>
              {createError && <p className="text-sm text-error font-bold">{createError}</p>}
              <button
                type="submit"
                data-testid="groups-create-submit-btn"
                className="w-full py-4 gold-gradient text-on-secondary rounded-xl font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-[0_4px_25px_rgba(232,168,50,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={createLoading || !createName.trim()}
              >
                {createLoading ? t('groups.creating') : t('groups.createGroupBtn')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Join Group Modal ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowJoinModal(false)}
          />
          <div className="relative bg-surface-container rounded-[2rem] p-10 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
            <button
              className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={() => setShowJoinModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary">search</span>
              {t('groups.joinGroupModal')}
            </h3>
            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">
                  {t('groups.inviteCode')}
                </label>
                <input
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50 transition-colors text-center text-lg tracking-[0.1em]"
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
                className="w-full py-4 gold-gradient text-on-secondary rounded-xl font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-[0_4px_25px_rgba(232,168,50,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
