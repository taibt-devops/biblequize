import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';
import { getTierByPoints } from '../data/tiers';

/* ─── Types ─── */

interface MyGroupResponse {
  hasGroup: boolean;
  groupId?: string;
  groupName?: string;
  memberCount?: number;
  role?: string;
}

interface GroupMemberLite {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  joinedAt?: string;
}

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
  avatarUrl?: string;
  isPublic?: boolean;
  leaderId?: string;
  members?: GroupMemberLite[];
}

interface LeaderboardMember {
  rank?: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  score: number;
  role?: string;
  questionsAnswered?: number;
}

interface Announcement {
  id: string;
  body: string;
  author: string;
  authorRole?: string;
  createdAt: string;
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
  weeklyStreak?: number;
  avatarHue?: 'gold' | 'blue' | 'purple' | 'green';
}

interface PublicGroupsResponse {
  success: boolean;
  groups: PublicGroupListItem[];
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

type AnalyticsPeriod = '7d' | '30d' | '90d';

/* ─── localStorage cache (NOT source of truth — see useMyGroup hook) ─── */

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

function clearSavedGroups() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatPoints(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString('vi-VN');
  return String(n);
}

function getInitial(name?: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

/* ─── Featured public groups: deterministic hue per group id so the same
   group always gets the same visual tint without backend coordination.
   Pure UI presentation — backend only supplies the data. ─── */
const HUE_KEYS: Array<NonNullable<PublicGroupListItem['avatarHue']>> = ['gold', 'blue', 'purple', 'green'];

function pickHue(id: string): NonNullable<PublicGroupListItem['avatarHue']> {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return HUE_KEYS[hash % HUE_KEYS.length];
}

const HUE_BG: Record<NonNullable<PublicGroupListItem['avatarHue']>, string> = {
  gold: 'bg-[rgba(232,168,50,0.15)]',
  blue: 'bg-[rgba(74,158,255,0.15)]',
  purple: 'bg-[rgba(168,85,247,0.15)]',
  green: 'bg-[rgba(99,153,34,0.15)]',
};

const HUE_ICON: Record<NonNullable<PublicGroupListItem['avatarHue']>, string> = {
  gold: '⛪',
  blue: '📖',
  purple: '✝️',
  green: '🕊️',
};

/* ─── Skeleton (compact, matches mockup shape) ─── */

function GroupSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-pulse" data-testid="groups-skeleton">
      <div className="rounded-2xl bg-[rgba(50,52,64,0.4)] h-24" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          <div className="bg-[rgba(50,52,64,0.4)] rounded-2xl h-80" />
          <div className="bg-[rgba(50,52,64,0.4)] rounded-2xl h-40" />
        </div>
        <div className="space-y-3">
          <div className="bg-[rgba(50,52,64,0.4)] rounded-2xl h-44" />
          <div className="bg-[rgba(99,153,34,0.06)] rounded-2xl h-32" />
        </div>
      </div>
    </div>
  );
}

/* ─── No Group View (mockup: groups_empty_state.html) ─── */

function NoGroupView({
  onCreateClick,
  onJoinClick,
}: {
  onCreateClick: () => void;
  onJoinClick: (prefill?: string) => void;
}) {
  const { t } = useTranslation();

  const { data: publicRes, isLoading: publicLoading } = useQuery<PublicGroupsResponse>({
    queryKey: ['public-groups', 'featured'],
    queryFn: () =>
      api
        .get('/api/groups/public?featured=true&limit=3')
        .then((r) => r.data as PublicGroupsResponse)
        .catch(() => ({ success: false, groups: [] })),
    staleTime: 5 * 60 * 1000,
  });
  const publicGroups = publicRes?.groups ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="no-group">
      {/* Hero card */}
      <div className="text-center px-6 py-8 bg-[rgba(50,52,64,0.3)] border-[0.5px] border-[rgba(232,168,50,0.15)] rounded-2xl">
        <div className="w-20 h-20 rounded-[20px] bg-[rgba(232,168,50,0.1)] border-2 border-[rgba(232,168,50,0.3)] flex items-center justify-center mx-auto mb-5">
          <span className="text-[36px]">⛪</span>
        </div>
        <h2 className="text-[22px] font-medium text-on-surface mb-2">
          {t('groups.noGroupTitle')}
        </h2>
        <p className="text-on-surface/55 text-[13px] max-w-md mx-auto mb-6 leading-relaxed">
          {t('groups.noGroupDesc')}
        </p>

        <div className="flex flex-wrap justify-center gap-2.5 mb-4">
          <button
            onClick={() => onJoinClick()}
            data-testid="groups-join-btn"
            className="bg-secondary text-on-secondary border-0 rounded-[10px] px-6 py-3 text-[13px] font-medium cursor-pointer shadow-[0_0_24px_rgba(232,168,50,0.2)] flex items-center gap-2 hover:brightness-110 transition-all active:scale-95"
          >
            <span>🔑</span> {t('groups.joinByCodeCta')}
          </button>
          <button
            onClick={onCreateClick}
            data-testid="groups-create-btn"
            className="bg-white/5 text-on-surface border-[0.5px] border-white/15 rounded-[10px] px-6 py-3 text-[13px] font-medium cursor-pointer flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95"
          >
            <span>✨</span> {t('groups.createGroupCta')}
          </button>
        </div>

        <div className="text-on-surface/40 text-[11px]">{t('groups.noGroupHint')}</div>
      </div>

      {/* Benefits grid (3 cards) — always 3-col per mobile mockup */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-[rgba(74,158,255,0.06)] border-[0.5px] border-[rgba(74,158,255,0.2)] rounded-[10px] p-2.5 sm:p-3.5 text-center sm:text-left">
          <div className="text-[16px] sm:text-[18px] mb-1">🏆</div>
          <div className="text-on-surface text-[10px] sm:text-[13px] font-medium mb-0.5">{t('groups.benefit1Title')}</div>
          <div className="text-on-surface/55 text-[9px] sm:text-[11px] leading-snug hidden sm:block">{t('groups.benefit1Desc')}</div>
        </div>
        <div className="bg-[rgba(168,85,247,0.06)] border-[0.5px] border-[rgba(168,85,247,0.2)] rounded-[10px] p-2.5 sm:p-3.5 text-center sm:text-left">
          <div className="text-[16px] sm:text-[18px] mb-1">📚</div>
          <div className="text-on-surface text-[10px] sm:text-[13px] font-medium mb-0.5">{t('groups.benefit2Title')}</div>
          <div className="text-on-surface/55 text-[9px] sm:text-[11px] leading-snug hidden sm:block">{t('groups.benefit2Desc')}</div>
        </div>
        <div className="bg-[rgba(99,153,34,0.06)] border-[0.5px] border-[rgba(99,153,34,0.2)] rounded-[10px] p-2.5 sm:p-3.5 text-center sm:text-left">
          <div className="text-[16px] sm:text-[18px] mb-1">🔥</div>
          <div className="text-on-surface text-[10px] sm:text-[13px] font-medium mb-0.5">{t('groups.benefit3Title')}</div>
          <div className="text-on-surface/55 text-[9px] sm:text-[11px] leading-snug hidden sm:block">{t('groups.benefit3Desc')}</div>
        </div>
      </div>

      {/* Featured public groups (real API: GET /api/groups/public?featured=true) */}
      {(publicLoading || publicGroups.length > 0) && (
        <div className="bg-[rgba(50,52,64,0.3)] border-[0.5px] border-white/[0.06] rounded-xl px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-on-surface text-[13px] font-medium">{t('groups.discoverPublic')}</div>
              <div className="text-on-surface/45 text-[11px] mt-0.5">{t('groups.discoverPublicSubtitle')}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {publicLoading && (
              <>
                <div className="h-12 bg-[rgba(50,52,64,0.5)] rounded-lg animate-pulse" />
                <div className="h-12 bg-[rgba(50,52,64,0.5)] rounded-lg animate-pulse" />
                <div className="h-12 bg-[rgba(50,52,64,0.5)] rounded-lg animate-pulse" />
              </>
            )}
            {!publicLoading &&
              publicGroups.map((group) => {
                const hue = group.avatarHue ?? pickHue(group.id);
                return (
                  <div
                    key={group.id}
                    className="bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.04] rounded-lg px-3 py-2.5 flex items-center gap-2.5"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[16px] overflow-hidden ${HUE_BG[hue]}`}>
                      {group.avatarUrl ? (
                        <img alt={group.name} src={group.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        HUE_ICON[hue]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface text-[12px] font-medium truncate">{group.name}</div>
                      <div className="text-on-surface/50 text-[10px]">
                        {group.memberCount} {t('groups.members')}
                        {group.location ? ` · ${group.location}` : ''}
                        {group.weeklyStreak ? ` · ${t('groups.publicStreakLabel', { count: group.weeklyStreak })}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => onJoinClick(group.code)}
                      className="bg-[rgba(232,168,50,0.15)] text-secondary border-[0.5px] border-[rgba(232,168,50,0.4)] rounded-md px-3 py-1.5 text-[11px] font-medium cursor-pointer hover:brightness-110 transition-all"
                    >
                      {t('groups.joinPublicGroup')}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Podium 3-slot pattern with empty state ─── */

function PodiumSlot({
  member,
  rank,
  elevated,
  isCurrentUser,
}: {
  member: LeaderboardMember | null;
  rank: 1 | 2 | 3;
  elevated?: boolean;
  isCurrentUser?: boolean;
}) {
  const { t } = useTranslation();

  if (!member) {
    return (
      <div
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

  const tier = getTierByPoints(member.score);
  const tierName = t(tier.nameKey);
  const isLeader = member.role === 'LEADER';

  // mockup color tokens per rank
  const styles = elevated
    ? {
        wrapper: 'bg-[rgba(232,168,50,0.12)] border border-[rgba(232,168,50,0.5)] rounded-[10px] p-3.5 px-2.5 text-center',
        ring: 'shadow-[0_0_0_2px_rgba(232,168,50,0.15)]',
        avatarWrap: 'w-[50px] h-[50px] bg-[rgba(232,168,50,0.3)] border-2 border-secondary text-secondary',
        rankBadge: 'bg-secondary text-on-secondary',
        rankFontSize: '11px',
        nameSize: 'text-[12px]',
        scoreSize: 'text-[10px]',
      }
    : rank === 2
    ? {
        wrapper: 'bg-white/[0.04] border-[0.5px] border-white/10 rounded-[10px] p-2.5 text-center',
        ring: '',
        avatarWrap: 'w-10 h-10 bg-[rgba(74,158,255,0.3)] border-2 border-[rgba(74,158,255,0.6)] text-[#6AB8E8]',
        rankBadge: 'bg-white/60 text-background',
        rankFontSize: '10px',
        nameSize: 'text-[11px]',
        scoreSize: 'text-[9px]',
      }
    : {
        wrapper: 'bg-[rgba(255,140,66,0.08)] border-[0.5px] border-[rgba(255,140,66,0.3)] rounded-[10px] p-2.5 text-center',
        ring: '',
        avatarWrap: 'w-10 h-10 bg-[rgba(168,85,247,0.3)] border-2 border-[rgba(168,85,247,0.6)] text-[#c084fc]',
        rankBadge: 'bg-[rgba(255,140,66,0.8)] text-background',
        rankFontSize: '10px',
        nameSize: 'text-[11px]',
        scoreSize: 'text-[9px]',
      };

  return (
    <div className={`${styles.wrapper} ${styles.ring} ${isCurrentUser ? 'ring-1 ring-secondary' : ''}`}>
      <div className="relative inline-block mb-1.5">
        <div
          className={`rounded-full flex items-center justify-center text-[14px] font-medium ${styles.avatarWrap}`}
          style={elevated ? { fontSize: '16px' } : undefined}
        >
          {member.avatarUrl ? (
            <img alt={member.name} src={member.avatarUrl} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitial(member.name)
          )}
        </div>
        <div
          className={`absolute -bottom-0.5 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center font-semibold ${styles.rankBadge}`}
          style={elevated ? { width: 20, height: 20, fontSize: '11px' } : { fontSize: '10px' }}
        >
          {rank}
        </div>
      </div>
      <div className={`text-on-surface ${styles.nameSize} font-medium truncate`}>
        {member.name}
      </div>
      <div className="text-[9px]" style={{ color: tier.colorHex }}>
        {tierName} {isLeader && '👑'}
      </div>
      <div className={`text-on-surface/45 ${styles.scoreSize} mt-0.5`}>
        {formatPoints(member.score)} {t('groups.pointsAbbr')}
      </div>
    </div>
  );
}

/* ─── Group Overview (mockup: groups_member_dashboard.html / groups_leader_dashboard.html) ─── */

function GroupOverview({ groupId, role }: { groupId: string; role?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('7d');
  const isLeader = (role ?? '').toUpperCase() === 'LEADER';
  const isMod = (role ?? '').toUpperCase() === 'MOD';

  const {
    data: groupRes,
    isLoading: groupLoading,
    isError: groupError,
  } = useQuery<{ success: boolean; group: GroupInfo }>({
    queryKey: ['group', groupId],
    queryFn: () => api.get(`/api/groups/${groupId}`).then((r) => r.data),
  });

  const group = groupRes?.group;

  const { data: leaderboard } = useQuery<LeaderboardMember[]>({
    queryKey: ['group-leaderboard', groupId, period],
    queryFn: () =>
      api
        .get(`/api/groups/${groupId}/leaderboard?period=${period}`)
        .then((r) => (r.data?.leaderboard ?? r.data?.entries ?? []) as LeaderboardMember[]),
    enabled: !!group,
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['group-announcements', groupId],
    queryFn: () =>
      api
        .get(`/api/groups/${groupId}/announcements`)
        .then((r) => r.data?.data?.items ?? r.data?.announcements ?? []),
    enabled: !!group,
  });

  // Latest quiz set for mobile CTA card
  const { data: quizSetsRes } = useQuery<{ quizSets: Array<{ id: string; name: string; questionCount: number; createdAt: string }> }>({
    queryKey: ['group-quizsets', groupId],
    queryFn: () =>
      api
        .get(`/api/groups/${groupId}/quiz-sets`)
        .then((r) => ({ quizSets: r.data?.quizSets ?? [] }))
        .catch(() => ({ quizSets: [] })),
    enabled: !!group,
    staleTime: 5 * 60_000,
  });
  const latestQuizSet = quizSetsRes?.quizSets?.[0] ?? null;

  const { data: analyticsRes } = useQuery<{ success: boolean; analytics: AnalyticsData }>({
    queryKey: ['group-analytics', groupId],
    queryFn: () => api.get(`/api/groups/${groupId}/analytics`).then((r) => r.data),
    enabled: isLeader && !!group,
    staleTime: 2 * 60_000,
  });
  const analytics = analyticsRes?.analytics ?? null;

  if (groupLoading) return <GroupSkeleton />;

  if (groupError || !group) {
    return (
      <div className="max-w-5xl mx-auto bg-[rgba(50,52,64,0.4)] rounded-2xl p-10 text-center" data-testid="group-error">
        <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
        <p className="text-on-surface font-bold text-lg mb-2">{t('groups.errorLoadGroup')}</p>
        <p className="text-on-surface-variant text-sm">{t('groups.errorLoadGroupDesc')}</p>
      </div>
    );
  }

  // Member count: prefer fresh API field; fallback to nested members.length
  const memberCount = group.memberCount ?? group.members?.length ?? 0;
  const groupName = group.name?.trim() || t('groups.untitledGroup');
  const leader = group.members?.find((m) => m.role === 'LEADER');

  const top3: Array<LeaderboardMember | null> = [
    leaderboard?.[0] ?? null,
    leaderboard?.[1] ?? null,
    leaderboard?.[2] ?? null,
  ];
  const rest = (leaderboard ?? []).slice(3, 7);
  const currentUserId = user?.email; // placeholder — better from /me but unavailable here

  return (
    <div className="max-w-5xl mx-auto space-y-3" data-testid="group-overview">
      {/* ── Header ── */}
      <header
        className={`border-[0.5px] rounded-[14px] p-3 sm:p-4 flex items-center gap-3 sm:gap-4 ${
          isLeader
            ? 'bg-gradient-to-br from-[rgba(232,168,50,0.1)] to-[rgba(50,52,64,0.4)] border-[rgba(232,168,50,0.3)]'
            : 'bg-[rgba(50,52,64,0.4)] border-[rgba(232,168,50,0.2)]'
        }`}
      >
        <div
          className={`w-[44px] h-[44px] sm:w-[60px] sm:h-[60px] rounded-[12px] sm:rounded-[14px] flex items-center justify-center flex-shrink-0 ${
            isLeader
              ? 'bg-[rgba(232,168,50,0.2)] border-[1.5px] border-secondary'
              : 'bg-[rgba(232,168,50,0.15)] border-[1.5px] border-[rgba(232,168,50,0.4)]'
          }`}
        >
          {group.avatarUrl || group.logoUrl ? (
            <img alt={groupName} src={group.avatarUrl ?? group.logoUrl} className="w-full h-full rounded-[12px] object-cover" />
          ) : (
            <span className="text-[24px] sm:text-[28px]">⛪</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap" data-testid="group-name-heading">
            <h2 className="text-on-surface text-[15px] sm:text-[18px] font-medium m-0 truncate">{groupName}</h2>
            {isLeader ? (
              <span className="bg-[rgba(232,168,50,0.2)] text-secondary px-2 py-0.5 rounded-full text-[8px] font-medium border-[0.5px] border-[rgba(232,168,50,0.4)]">
                👑 {t('groups.leaderBadge')}
              </span>
            ) : isMod ? (
              <span className="bg-[rgba(74,158,255,0.15)] text-[#6AB8E8] px-2 py-0.5 rounded-full text-[8px] font-medium border-[0.5px] border-[rgba(74,158,255,0.3)]">
                🛡️ {t('groups.modBadge')}
              </span>
            ) : (
              group.isPublic !== false ? (
                <span className="bg-[rgba(99,153,34,0.15)] text-[#97C459] px-2 py-0.5 rounded-full text-[9px] font-medium">
                  {t('groups.publicBadge')}
                </span>
              ) : (
                <span className="bg-white/[0.06] text-on-surface-variant px-2 py-0.5 rounded-full text-[9px] font-medium">
                  {t('groups.privateBadge')}
                </span>
              )
            )}
          </div>
          <div className="text-on-surface/55 text-[11px] sm:text-[12px] mt-0.5 flex items-center gap-2 sm:gap-3 flex-wrap">
            <span>👥 {memberCount} {t('groups.members')}</span>
            {leader && !isLeader && (
              <>
                <span>·</span>
                <span>👑 {leader.name}</span>
              </>
            )}
            {group.location && (
              <>
                <span>·</span>
                <span className="hidden sm:inline">📍 {group.location}</span>
              </>
            )}
            {group.code && isLeader && (
              <>
                <span>·</span>
                <span>🔑 <code className="bg-white/[0.06] px-1 py-0.5 rounded text-secondary text-[9px] font-mono">{group.code}</code></span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
          {(isLeader || isMod) ? (
            <>
              <Link
                to={`/groups/${group.id}?tab=quizsets`}
                className="bg-[rgba(232,168,50,0.15)] text-secondary border-[0.5px] border-[rgba(232,168,50,0.4)] rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-medium hover:brightness-110 transition-all"
              >
                + {t('groups.quickActionCreateQuizShort')}
              </Link>
              <Link
                to={`/groups/${group.id}`}
                className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-medium hover:bg-white/10 transition-all"
              >
                ⚙️
              </Link>
            </>
          ) : (
            <>
              <Link
                to={`/groups/${group.id}`}
                className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-medium hover:bg-white/10 transition-all"
              >
                🔗 {t('groups.invite')}
              </Link>
              <Link
                to={`/groups/${group.id}`}
                className="bg-white/5 text-on-surface/70 border-[0.5px] border-white/10 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-medium hover:bg-white/10 transition-all"
              >
                ⋯
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Mobile stat cards (hidden on lg — shown in sidebar on desktop) ── */}
      <div className="grid grid-cols-2 gap-2.5 lg:hidden">
        <div className="bg-[rgba(99,153,34,0.06)] border-[0.5px] border-[rgba(99,153,34,0.25)] rounded-[10px] p-2.5">
          <div className="text-[rgba(151,196,89,0.7)] text-[9px] tracking-[0.4px] mb-1 uppercase">{t('groups.groupStreak')}</div>
          <div className="text-[#97C459] text-[18px] font-medium">🔥 0</div>
          <div className="text-on-surface/45 text-[9px] mt-0.5">
            {t('groups.groupStreakProgress', { active: 0, total: memberCount })}
          </div>
        </div>
        <div className="bg-[rgba(232,168,50,0.06)] border-[0.5px] border-[rgba(232,168,50,0.25)] rounded-[10px] p-2.5">
          <div className="text-[rgba(232,168,50,0.7)] text-[9px] tracking-[0.4px] mb-1 uppercase">{t('groups.groupRank')}</div>
          <div className="text-[#e8a832] text-[18px] font-medium">#— / —</div>
          <div className="text-on-surface/45 text-[9px] mt-0.5">{t('groups.groupRankSubtitle')}</div>
        </div>
      </div>

      {/* ── Analytics inline preview (leader only) ── */}
      {isLeader && (
        <section
          data-testid="analytics-inline"
          className="bg-[rgba(74,158,255,0.05)] border-[0.5px] border-[rgba(74,158,255,0.25)] rounded-xl p-4"
        >
          {/* Header */}
          <div className="text-[rgba(106,184,232,0.7)] text-[9px] uppercase tracking-[0.6px] mb-1">
            {t('groups.leaderOnly')}
          </div>
          <div className="flex justify-between items-center mb-3">
            <div className="text-on-surface text-[13px] font-medium">📊 {t('groups.analyticsTitle')}</div>
            <div className="inline-flex bg-black/30 rounded-md p-0.5">
              {(['7d', '30d', '90d'] as AnalyticsPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`border-0 px-2.5 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-all ${
                    analyticsPeriod === p
                      ? 'bg-[rgba(74,158,255,0.3)] text-[#6AB8E8]'
                      : 'bg-transparent text-on-surface/50'
                  }`}
                >
                  {p === '7d' ? '7N' : p === '30d' ? '30N' : '90N'}
                </button>
              ))}
            </div>
          </div>

          {/* KPI 2×2 → 4×1 grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div className="bg-[rgba(151,196,89,0.06)] border-[0.5px] border-[rgba(151,196,89,0.2)] rounded-[10px] p-2.5">
              <div className="text-[rgba(151,196,89,0.7)] text-[8px] uppercase tracking-[0.4px] mb-1">{t('groups.kpiActiveWeek')}</div>
              <div className="text-[#97C459] text-[17px] font-medium leading-tight">
                {analytics ? `${analytics.activeWeek}/${analytics.totalMembers}` : '—'}
              </div>
              {analytics && analytics.totalMembers > 0 && (
                <div className="text-on-surface/45 text-[9px] mt-0.5">
                  {Math.round((analytics.activeWeek / analytics.totalMembers) * 100)}%
                </div>
              )}
            </div>
            <div className="bg-[rgba(232,168,50,0.06)] border-[0.5px] border-[rgba(232,168,50,0.2)] rounded-[10px] p-2.5">
              <div className="text-[rgba(232,168,50,0.7)] text-[8px] uppercase tracking-[0.4px] mb-1">{t('groups.kpiAvgScore')}</div>
              <div className="text-[#e8a832] text-[17px] font-medium leading-tight">
                {analytics ? `${analytics.avgScore}` : '—'}
              </div>
              <div className="text-on-surface/45 text-[9px] mt-0.5">{t('groups.kpiPerPerson')}</div>
            </div>
            <div className="bg-[rgba(74,158,255,0.06)] border-[0.5px] border-[rgba(74,158,255,0.2)] rounded-[10px] p-2.5">
              <div className="text-[rgba(106,184,232,0.7)] text-[8px] uppercase tracking-[0.4px] mb-1">{t('groups.kpiAccuracy')}</div>
              <div className="text-[#6AB8E8] text-[17px] font-medium leading-tight">
                {analytics ? `${analytics.accuracy}%` : '—'}
              </div>
              <div className="text-on-surface/45 text-[9px] mt-0.5">{t('groups.kpiStable')}</div>
            </div>
            <div className="bg-[rgba(255,140,66,0.06)] border-[0.5px] border-[rgba(255,140,66,0.2)] rounded-[10px] p-2.5">
              <div className="text-[rgba(255,140,66,0.7)] text-[8px] uppercase tracking-[0.4px] mb-1">{t('groups.kpiInactive')}</div>
              <div className="text-[#ff8c42] text-[17px] font-medium leading-tight">
                {analytics ? analytics.inactiveCount : '—'}
              </div>
              <div className="text-on-surface/45 text-[9px] mt-0.5">{t('groups.kpiPeople')}</div>
            </div>
          </div>

          {/* Mini 7-bar activity chart */}
          {analytics && analytics.weeklyActivity.length > 0 && (
            <div className="mb-3">
              <div className="text-on-surface/50 text-[10px] mb-1.5">{t('groups.weeklyActivitySubtitle')}</div>
              <div className="flex items-end gap-1 h-[60px]">
                {analytics.weeklyActivity.map((day, i) => {
                  const maxCount = Math.max(...analytics.weeklyActivity.map((d) => d.activeCount), 1);
                  const heightPct = Math.max((day.activeCount / maxCount) * 100, 4);
                  const dayLabel = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][
                    new Date(day.date).getDay() === 0 ? 6 : new Date(day.date).getDay() - 1
                  ];
                  const isToday = i === analytics.weeklyActivity.length - 1;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-t-[3px] transition-all ${
                          isToday
                            ? 'bg-[#e8a832]'
                            : 'bg-[rgba(232,168,50,0.35)]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <div className="text-on-surface/35 text-[8px] leading-none">
                        {isToday ? t('groups.today') : dayLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inactive members alert */}
          {analytics && analytics.inactiveCount > 0 && (
            <div className="bg-[rgba(255,140,66,0.08)] border-[0.5px] border-[rgba(255,140,66,0.25)] rounded-lg px-3 py-2 flex items-center justify-between gap-2 mb-3">
              <div className="text-[#ff8c42] text-[11px] font-medium">
                {t('groups.inactiveAlert', { count: analytics.inactiveCount })}
              </div>
              <Link
                to={`/groups/${group.id}?tab=members&filter=inactive`}
                className="text-[#ff8c42] text-[10px] font-medium whitespace-nowrap hover:brightness-125 transition-all"
              >
                {t('groups.viewInactiveList')} →
              </Link>
            </div>
          )}

          {/* View full analytics link */}
          <div className="text-right">
            <Link
              to={`/groups/${group.id}/analytics`}
              className="text-[rgba(106,184,232,0.7)] text-[11px] hover:text-[#6AB8E8] transition-colors"
            >
              {t('groups.viewFullAnalytics')} →
            </Link>
          </div>
        </section>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Main column */}
        <div className="flex flex-col gap-3">
          {/* Leaderboard section */}
          <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-[rgba(232,168,50,0.15)] rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="text-on-surface text-[13px] font-medium">📊 {t('groups.leaderboard')}</div>
              <div className="inline-flex bg-black/30 rounded-md p-0.5">
                {(['weekly', 'monthly', 'all_time'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`border-0 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all ${
                      period === p
                        ? 'bg-secondary text-on-secondary'
                        : 'bg-transparent text-on-surface/55'
                    }`}
                  >
                    {p === 'weekly' ? t('groups.thisWeek') : p === 'monthly' ? t('groups.month') : t('groups.everytime')}
                  </button>
                ))}
              </div>
            </div>

            {/* Podium 3-slot */}
            <div className="grid grid-cols-3 gap-2 items-end mb-4">
              <PodiumSlot
                member={top3[1]}
                rank={2}
                isCurrentUser={!!top3[1] && top3[1].userId === currentUserId}
              />
              <PodiumSlot
                member={top3[0]}
                rank={1}
                elevated
                isCurrentUser={!!top3[0] && top3[0].userId === currentUserId}
              />
              <PodiumSlot
                member={top3[2]}
                rank={3}
                isCurrentUser={!!top3[2] && top3[2].userId === currentUserId}
              />
            </div>

            {/* Mini list (rank 4-7) */}
            <div className="flex flex-col gap-1">
              {rest.length === 0 && top3.every((m) => m === null) && (
                <p className="text-center text-on-surface-variant py-6 text-[12px]">
                  {t('groups.noLeaderboardData')}
                </p>
              )}
              {rest.map((member, idx) => {
                const tier = getTierByPoints(member.score);
                const tierName = t(tier.nameKey);
                const isCurrent = member.userId === currentUserId;
                const rank = member.rank ?? idx + 4;
                return (
                  <div
                    key={member.userId}
                    data-testid="group-leaderboard-row"
                    className={`rounded-md px-3 py-2 flex items-center gap-2.5 border-[0.5px] ${
                      isCurrent
                        ? 'bg-[rgba(232,168,50,0.08)] border-[rgba(232,168,50,0.4)]'
                        : 'bg-white/[0.03] border-white/[0.04]'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-medium w-[18px] text-center ${
                        isCurrent ? 'text-secondary' : 'text-on-surface/50'
                      }`}
                    >
                      {rank}
                    </div>
                    <div className="w-[26px] h-[26px] rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-on-surface">
                      {member.avatarUrl ? (
                        <img alt={member.name} src={member.avatarUrl} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitial(member.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface text-[11px] truncate">
                        {member.name}
                        {isCurrent && <span className="ml-1 font-medium">{t('groups.memberLabel')}</span>}
                      </div>
                      <div className="text-on-surface/40 text-[9px]" style={{ color: tier.colorHex }}>
                        {tierName}
                      </div>
                    </div>
                    <div className="text-secondary text-[11px] font-medium">{formatPoints(member.score)} {t('groups.pointsAbbr')}</div>
                  </div>
                );
              })}
            </div>

            {memberCount > 0 && (
              <div className="text-center mt-3">
                <Link
                  to={`/groups/${group.id}?tab=members`}
                  className="text-[rgba(232,168,50,0.7)] text-[11px] hover:text-secondary transition-colors"
                >
                  {t('groups.viewAllMembers', { count: memberCount })} →
                </Link>
              </div>
            )}
          </section>

          {/* Featured quiz set CTA (shown when there are quiz sets) */}
          {latestQuizSet ? (
            <section className="bg-[rgba(232,168,50,0.06)] border-[0.5px] border-[rgba(232,168,50,0.25)] rounded-xl p-3.5 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px]">📚</span>
                <span className="text-on-surface text-[12px] sm:text-[13px] font-medium">{t('groups.quizSetsSection')}</span>
                <span className="bg-[rgba(255,140,66,0.2)] text-[#ff8c42] px-1.5 py-0.5 rounded-full text-[9px] font-medium">
                  {t('groups.newBadge')}
                </span>
              </div>
              <div className="text-on-surface text-[12px] sm:text-[13px] mb-1">{latestQuizSet.name}</div>
              <div className="text-on-surface/55 text-[10px] sm:text-[11px] mb-3">
                {latestQuizSet.questionCount} {t('groups.questionsCount')}
              </div>
              <Link
                to={`/groups/${group.id}?tab=quizsets`}
                className="block w-full bg-secondary text-on-secondary border-0 rounded-lg py-2 text-[11px] sm:text-[12px] font-medium text-center hover:brightness-110 transition-all active:scale-95"
              >
                ▶ {t('groups.startPlaying')}
              </Link>
            </section>
          ) : isLeader ? (
            <section className="bg-[rgba(232,168,50,0.06)] border-[0.5px] border-[rgba(232,168,50,0.2)] rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px]">📚</span>
                <span className="text-on-surface text-[12px] sm:text-[13px] font-medium">{t('groups.quizSetsSection')}</span>
              </div>
              <p className="text-on-surface/55 text-[11px] mb-3">{t('groups.noQuizSets')}</p>
              <Link
                to={`/groups/${group.id}?tab=quizsets`}
                className="block w-full bg-secondary text-on-secondary border-0 rounded-lg py-2 text-[11px] sm:text-[12px] font-medium text-center hover:brightness-110 transition-all active:scale-95"
              >
                + {t('groups.quickActionCreateQuiz')}
              </Link>
            </section>
          ) : (
            <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-4 sm:p-5">
              <div className="flex justify-between items-center mb-2 sm:mb-3">
                <div className="text-on-surface text-[12px] sm:text-[13px] font-medium">📚 {t('groups.quizSetsSection')}</div>
                <Link
                  to={`/groups/${group.id}?tab=quizsets`}
                  className="text-[rgba(232,168,50,0.7)] text-[11px] hover:text-secondary"
                >
                  {t('groups.viewAll')} →
                </Link>
              </div>
              <p className="text-on-surface-variant text-[11px] py-2">
                {t('groups.noQuizSets')}
              </p>
            </section>
          )}
        </div>

        {/* Sidebar column */}
        <aside className="flex flex-col gap-3">
          {/* Announcements */}
          <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-on-surface text-[12px] font-medium">📢 {t('groups.announcements')}</div>
              <Link
                to={`/groups/${group.id}?tab=announcements`}
                className="text-[rgba(232,168,50,0.7)] text-[10px] hover:text-secondary"
              >
                {t('groups.viewAll')} →
              </Link>
            </div>
            {(!announcements || announcements.length === 0) && (
              <p className="text-center text-on-surface-variant py-3 text-[11px]">
                {t('groups.noAnnouncements')}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {(announcements ?? []).slice(0, 3).map((item) => {
                const isLeader = (item.authorRole ?? '').toUpperCase() === 'LEADER';
                return (
                  <article
                    key={item.id}
                    className={`rounded-[4px] px-3 py-2.5 ${
                      isLeader
                        ? 'bg-[rgba(232,168,50,0.05)] border-l-2 border-secondary'
                        : 'bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.04]'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className={`text-[10px] font-medium ${isLeader ? 'text-secondary' : 'text-on-surface/70'}`}>
                        {isLeader ? '👑' : '🛡️'} {item.author}
                      </div>
                      <div className="text-on-surface/40 text-[9px]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-on-surface/85 text-[11px] leading-relaxed">{item.body}</div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Group streak widget */}
          <section className="bg-[rgba(99,153,34,0.06)] border-[0.5px] border-[rgba(99,153,34,0.25)] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[14px]">🔥</span>
              <span className="text-[rgba(151,196,89,0.85)] text-[11px] font-medium tracking-wider">
                {t('groups.groupStreak')}
              </span>
            </div>
            <div className="text-[#97C459] text-[32px] font-medium leading-none">
              0<span className="text-[rgba(151,196,89,0.5)] text-[14px] ml-1">{t('groups.daysShort')}</span>
            </div>
            <div className="text-on-surface/55 text-[11px] mt-1.5 leading-snug">{t('groups.groupStreakDesc')}</div>
            <div className="mt-2.5 h-1 bg-white/[0.06] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm bg-gradient-to-r from-[#97C459] to-secondary"
                style={{ width: `0%` }}
              />
            </div>
            <div className="text-on-surface/40 text-[10px] mt-1">
              {t('groups.groupStreakProgress', { active: 0, total: memberCount })}
            </div>
          </section>

          {/* Tournament card */}
          <section className="bg-[rgba(74,158,255,0.05)] border-[0.5px] border-[rgba(74,158,255,0.2)] rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-1.5">
              <div className="text-on-surface text-[11px] font-medium">🏆 {t('groups.tournamentLabel')}</div>
            </div>
            <div className="text-on-surface/55 text-[10px] mb-3">{t('groups.noUpcomingTournament')}</div>
            <Link
              to="/tournaments"
              className="block w-full bg-[rgba(74,158,255,0.15)] text-[#6AB8E8] border-[0.5px] border-[rgba(74,158,255,0.4)] rounded-lg py-1.5 text-[10px] font-medium text-center hover:brightness-110 transition-all"
            >
              {t('groups.browseTournaments')}
            </Link>
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

  // Source of truth: backend /api/groups/me. localStorage = cache only.
  const {
    data: myGroupRes,
    isLoading: myGroupLoading,
    refetch: refetchMyGroup,
  } = useQuery<MyGroupResponse>({
    queryKey: ['my-group'],
    queryFn: () =>
      api
        .get('/api/groups/me')
        .then((r) => r.data as MyGroupResponse)
        .catch(() => ({ hasGroup: false })),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Reconcile localStorage cache with backend truth
  useEffect(() => {
    if (!myGroupRes) return;
    if (myGroupRes.hasGroup && myGroupRes.groupId && myGroupRes.groupName) {
      saveGroup({ id: myGroupRes.groupId, name: myGroupRes.groupName });
    } else if (myGroupRes.hasGroup === false) {
      // Backend says no group → clear stale localStorage
      const saved = getSavedGroups();
      if (saved.length > 0) clearSavedGroups();
    }
  }, [myGroupRes]);

  const myGroupId = myGroupRes?.hasGroup ? myGroupRes.groupId ?? null : null;

  const openJoinModal = (prefill?: string) => {
    if (prefill) setJoinCode(prefill);
    setShowJoinModal(true);
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
      });
      if (res.data.success) {
        const group = res.data.group;
        saveGroup({ id: group.id, name: group.name, code: group.code });
        await refetchMyGroup();
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
        await refetchMyGroup();
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
  if (myGroupLoading) return <div className="px-6 py-8"><GroupSkeleton /></div>;

  return (
    <div className="px-4 py-6" data-testid="groups-page">
      {myGroupId ? (
        <GroupOverview groupId={myGroupId} role={myGroupRes?.role} />
      ) : (
        <NoGroupView
          onCreateClick={() => setShowCreateModal(true)}
          onJoinClick={openJoinModal}
        />
      )}

      {/* ── Create Group Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-surface-container rounded-2xl p-8 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
            <button
              className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={() => setShowCreateModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-lg font-medium mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">add_circle</span>
              {t('groups.createGroupModal')}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4" data-testid="groups-create-form">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('groups.groupName')} *
                </label>
                <input
                  data-testid="groups-create-name-input"
                  className="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('groups.groupNamePlaceholder')}
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('groups.description')}
                </label>
                <textarea
                  data-testid="group-description-input"
                  className="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50 resize-none h-20"
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
                className="w-full py-3 gold-gradient text-on-secondary rounded-lg font-medium text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="relative bg-surface-container rounded-2xl p-8 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
            <button
              className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface transition-colors"
              onClick={() => setShowJoinModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-lg font-medium mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">search</span>
              {t('groups.joinGroupModal')}
            </h3>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('groups.inviteCode')}
                </label>
                <input
                  className="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-secondary/50 text-center text-base tracking-widest"
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
                className="w-full py-3 gold-gradient text-on-secondary rounded-lg font-medium text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
