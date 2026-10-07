import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/authStore';
import { api } from '../api/client';

interface TopContributor {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
  questionsAnswered: number;
}

interface WeeklyActivityPoint {
  date: string;
  activeCount: number;
}

interface Analytics {
  totalMembers: number;
  activeToday: number;
  activeWeek?: number;
  avgScore?: number;
  accuracy?: number;
  inactiveCount?: number;
  totalQuizzes?: number;
  totalPointsWeek?: number;
  totalQuestionsWeek?: number;
  weeklyActivity?: WeeklyActivityPoint[];
  topContributors?: TopContributor[];
}

type Period = '7d' | '30d' | '90d';

interface GroupMeta {
  createdAt?: string;
  memberCount?: number;
}

function getInitial(name?: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

// GD-2 — group < 7 days old hides charts to avoid misleading thin data.
function getGroupAge(createdAt?: string): { days: number; isNew: boolean } {
  if (!createdAt) return { days: 0, isNew: true };
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  return { days, isNew: days < 7 };
}

/* ─── Single bar in the activity chart ─── */
function ChartBar({ height, label, isToday }: { height: number; label: string; isToday?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-full rounded-t-[4px] ${
          isToday
            ? 'bg-gradient-to-b from-bq-amber/70 to-bq-amberd shadow-bq-amb'
            : 'bg-gradient-to-b from-bq-amber/50 to-bq-amberd'
        }`}
        style={{ height: `${height}%` }}
      />
      <div
        className={`text-[9px] ${
          isToday ? 'text-bq-amberd font-medium' : 'text-bq-ink3'
        }`}
      >
        {label}
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  label,
  value,
  unit,
  delta,
  borderColor,
  textColor,
  tooltip,
  testId,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { sign: '▲' | '▼' | '—'; text: string };
  borderColor: string;
  textColor: string;
  tooltip?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="bg-bq-white border-[0.5px] rounded-lg p-2.5 relative"
      style={{ borderColor }}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <div className="text-[9px] tracking-wider" style={{ color: borderColor }}>
          {label}
        </div>
        {tooltip && (
          <span
            title={tooltip}
            aria-label={tooltip}
            className="text-bq-ink3 hover:text-bq-ink2 cursor-help text-[10px] leading-none mt-0.5"
          >
            ⓘ
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-medium" style={{ color: textColor }}>{value}</span>
        {unit && <span className="text-bq-ink3 text-[11px]">{unit}</span>}
      </div>
      {delta && (
        <div className="text-[10px] mt-0.5" style={{ color: textColor }}>
          {delta.sign} {delta.text}
        </div>
      )}
    </div>
  );
}

const GroupAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [groupMeta, setGroupMeta] = useState<GroupMeta>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('7d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Parallel: analytics (gated leader-only) + group meta (createdAt/memberCount for empty-state gating GD-2).
      const [aRes, gRes] = await Promise.all([
        api.get(`/api/groups/${id}/analytics`),
        api.get(`/api/groups/${id}`).catch(() => null),
      ]);
      if (aRes.data.success) {
        setAnalytics(aRes.data.analytics ?? aRes.data);
      } else {
        setError(aRes.data.message || t('groupAnalytics.errorLoadData'));
      }
      if (gRes && gRes.data.success && gRes.data.group) {
        setGroupMeta({
          createdAt: gRes.data.group.createdAt,
          memberCount: gRes.data.group.memberCount ?? gRes.data.group.members?.length,
        });
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(t('groupAnalytics.noPermission'));
      } else {
        setError(err.response?.data?.message || t('groupAnalytics.connectionError'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchAnalytics();
  }, [isAuthenticated, navigate, fetchAnalytics]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-bq-white rounded-2xl p-10 text-center border border-bq-hair shadow-bq-soft">
          <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <p className="text-error font-medium mb-5 text-[14px]">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={fetchAnalytics}
              className="px-5 py-2.5 bg-bq-inset text-bq-ink rounded-lg font-medium text-[12px] hover:bg-bq-hair transition-all"
            >
              {t('common.retry')}
            </button>
            <button
              onClick={() => navigate(`/groups/${id}`)}
              className="px-5 py-2.5 bg-bq-amber/10 text-bq-amberd rounded-lg font-medium text-[12px] hover:bg-bq-amber/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              {t('groupAnalytics.backToGroup')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalMembers = analytics?.totalMembers ?? 0;
  const activeWeek = analytics?.activeWeek ?? analytics?.activeToday ?? 0;
  const avgScore = analytics?.avgScore ?? 0;
  const accuracy = analytics?.accuracy ?? 0;
  const inactiveCount = analytics?.inactiveCount ?? Math.max(0, totalMembers - activeWeek);
  const topContributors = analytics?.topContributors ?? [];

  // Weekly activity: scale daily activeCount to a 0-100 height percentage
  // based on the busiest day in the window. When the entire group is silent
  // for 7 days the bars all render at a 4% floor so the chart is visible.
  const weeklyData = analytics?.weeklyActivity ?? [];
  const maxDayCount = weeklyData.reduce((max, d) => Math.max(max, d.activeCount), 0);
  const weeklyBars = weeklyData.map((d) => ({
    date: d.date,
    count: d.activeCount,
    height: maxDayCount === 0 ? 4 : Math.max(4, (d.activeCount / maxDayCount) * 100),
  }));

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', t('groups.today')];

  // GD-2 empty-state gates.
  const groupAge = getGroupAge(groupMeta.createdAt);
  const memberCountSafe = groupMeta.memberCount ?? totalMembers;
  const chartHidden = groupAge.isNew || memberCountSafe < 3;
  const inactiveAlertHidden =
    groupAge.isNew ||
    memberCountSafe < 5 ||
    inactiveCount === 0 ||
    inactiveCount / Math.max(1, memberCountSafe) < 0.3;

  return (
    <div className="bg-bq-paper max-w-5xl mx-auto px-4 py-6 space-y-3">
      {/* ── Back link ── */}
      <button
        onClick={() => navigate(`/groups/${id}`)}
        className="flex items-center gap-1 text-bq-ink2 text-[11px] font-medium tracking-wider uppercase hover:text-bq-amberd transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {t('groupAnalytics.backToGroup')}
      </button>

      {/* ── Analytics card (mockup: groups_leader_dashboard.html, sapphire-tinted leader-only block) ── */}
      <section className="bg-bq-sapphire/[0.05] border-[0.5px] border-bq-sapphire/25 rounded-xl p-3.5 sm:p-5">
        <div className="flex flex-wrap gap-2 justify-between items-center mb-3 sm:mb-4">
          <div>
            <div className="text-bq-sapphire/70 text-[10px] tracking-wider mb-1">
              {t('groups.leaderOnly')}
            </div>
            <div className="text-bq-ink text-[14px] font-medium">📊 {t('groups.analyticsTitle')}</div>
          </div>
          <div className="inline-flex bg-bq-inset rounded-md p-0.5">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`border-0 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all ${
                  period === p ? 'bg-bq-sapphire text-white' : 'bg-transparent text-bq-ink2'
                }`}
              >
                {p === '7d' ? t('groups.period7d') : p === '30d' ? t('groups.period30d') : t('groups.period90d')}
              </button>
            ))}
          </div>
        </div>

        {/* KPI grid (4 cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          <KpiCard
            testId="kpi-active-week"
            label={t('groups.kpiActiveWeek')}
            value={activeWeek}
            unit={`/ ${totalMembers}`}
            delta={{ sign: '▲', text: t('groups.kpiVsLastWeek') }}
            borderColor="rgba(46,125,79,0.3)"
            textColor="#2E7D4F"
            tooltip={t('groups.kpiTooltip.activeWeek', { active: activeWeek, total: totalMembers })}
          />
          <KpiCard
            testId="kpi-avg-score"
            label={t('groups.kpiAvgScore')}
            value={avgScore || '—'}
            unit={t('groups.kpiPerPerson')}
            borderColor="rgba(245,158,11,0.3)"
            textColor="#D97F06"
            tooltip={t('groups.kpiTooltip.avgScore', {
              sample: activeWeek,
              note: activeWeek > 0 && activeWeek < 3 ? ' ' + t('groups.kpiTooltip.smallSampleWarn') : '',
            })}
          />
          <KpiCard
            testId="kpi-accuracy"
            label={t('groups.kpiAccuracy')}
            value={`${accuracy}%`}
            delta={{ sign: '—', text: t('groups.kpiStable') }}
            borderColor="rgba(47,111,176,0.3)"
            textColor="#2F6FB0"
            tooltip={t('groups.kpiTooltip.accuracy', { sample: activeWeek })}
          />
          <KpiCard
            testId="kpi-inactive"
            label={t('groups.kpiInactive')}
            value={inactiveCount}
            unit={t('groups.kpiPeople')}
            delta={{ sign: '▼', text: t('groups.kpiNeedAttention') }}
            borderColor="rgba(255,111,61,0.3)"
            textColor="#FF6F3D"
            tooltip={t('groups.kpiTooltip.inactive', { count: inactiveCount, total: totalMembers, days: 7 })}
          />
        </div>

        {/* Weekly activity chart — hidden for new/small groups (GD-2) */}
        {chartHidden ? (
          <div
            data-testid="analytics-chart-empty"
            className="bg-bq-inset border-[0.5px] border-bq-hair rounded-lg p-6 mb-3 text-center"
          >
            <div className="text-3xl mb-2 opacity-50">📊</div>
            <div className="text-bq-ink text-[12px] font-medium mb-1">
              {t('groups.analyticsEmpty.chartTitle')}
            </div>
            <div className="text-bq-ink2 text-[11px]">
              {groupAge.isNew
                ? t('groups.analyticsEmpty.tooNew', { days: Math.max(0, 7 - groupAge.days) })
                : t('groups.analyticsEmpty.tooSmall', { min: 3 })}
            </div>
          </div>
        ) : (
          <div className="bg-bq-inset border-[0.5px] border-bq-hair rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-2.5">
              <div className="text-bq-ink text-[11px] font-medium">📈 {t('groups.weeklyActivity')}</div>
              <div className="text-bq-ink3 text-[10px]">{t('groups.weeklyActivitySubtitle')}</div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 items-end h-20">
              {weeklyBars.length === 7 ? (
                weeklyBars.map((bar, idx) => (
                  <ChartBar
                    key={bar.date}
                    height={bar.height}
                    label={idx === 6 ? dayLabels[6] : dayLabels[idx]}
                    isToday={idx === 6}
                  />
                ))
              ) : (
                dayLabels.map((label, idx) => (
                  <ChartBar key={label} height={4} label={label} isToday={idx === 6} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Inactive members alert — hidden for new groups, small samples, or low ratio (GD-2) */}
        {!inactiveAlertHidden && (
          <div className="bg-bq-ember/[0.06] border-[0.5px] border-bq-ember/30 rounded-lg px-3 py-2.5 flex justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px]">⚠️</span>
                <span className="text-bq-ember text-[11px] font-medium">
                  {t('groups.inactiveAlert', { count: inactiveCount })}
                </span>
              </div>
              <div className="text-bq-ink2 text-[11px] leading-snug">
                {t('groups.inactiveAlertDesc')}
              </div>
            </div>
            <Link
              to={`/groups/${id}?tab=members&filter=inactive`}
              className="bg-bq-ember/15 text-bq-ember border-[0.5px] border-bq-ember/40 rounded-md px-3 py-1.5 text-[11px] font-medium flex-shrink-0 hover:brightness-110 transition-all"
            >
              {t('groups.viewInactiveList')}
            </Link>
          </div>
        )}
      </section>

      {/* ── Top contributors (real data from analytics.topContributors) ── */}
      {topContributors.length > 0 && (
        <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-3.5 sm:p-5">
          <div className="text-bq-ink text-[13px] font-medium mb-3 flex items-center gap-2">
            🏆 {t('groupAnalytics.topContributors')}
          </div>
          <div className="flex flex-col gap-2">
            {topContributors.map((c, idx) => (
              <div
                key={c.userId}
                className={`rounded-lg px-3 py-2.5 flex items-center gap-3 border-[0.5px] ${
                  idx === 0
                    ? 'bg-bq-amber/[0.06] border-bq-amber/25'
                    : 'bg-bq-inset border-bq-hair'
                }`}
              >
                <div
                  className={`text-[13px] font-medium w-5 text-center ${
                    idx < 3 ? 'text-bq-amberd' : 'text-bq-ink2'
                  }`}
                >
                  {idx + 1}
                </div>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-medium ${
                    idx === 0 ? 'bg-bq-amber/15 text-bq-amberd ring-2 ring-bq-amberd' : 'bg-bq-inset text-bq-ink'
                  }`}
                >
                  {c.avatarUrl ? (
                    <img alt={c.name} src={c.avatarUrl} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    getInitial(c.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-bq-ink text-[12px] font-medium truncate">{c.name}</div>
                  <div className="text-bq-ink3 text-[10px]">
                    {c.questionsAnswered} {t('groupAnalytics.questionsLabel')}
                  </div>
                </div>
                <div className="text-bq-amberd text-[12px] font-medium">{(c.score ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Actions panel ── */}
      <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-3.5 sm:p-5">
        <div className="text-bq-ink text-[13px] font-medium mb-3">⚡ {t('groups.quickActions')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link
            to={`/groups/${id}?tab=quizsets`}
            className="bg-bq-amber/[0.08] border-[0.5px] border-bq-amber/25 rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-105 transition-all"
          >
            <span className="text-[18px]">📚</span>
            <span className="text-bq-ink text-[11px]">{t('groups.quickActionCreateQuiz')}</span>
            <span className="text-bq-ink3 text-[9px]">{t('groups.quickActionUsedCount', { used: 0, max: 20 })}</span>
          </Link>
          <Link
            to={`/groups/${id}?tab=announcements`}
            className="bg-bq-sapphire/[0.08] border-[0.5px] border-bq-sapphire/25 rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-105 transition-all"
          >
            <span className="text-[18px]">📢</span>
            <span className="text-bq-ink text-[11px]">{t('groups.quickActionPostAnnouncement')}</span>
            <span className="text-bq-ink3 text-[9px]">
              {t('groups.quickActionSendTo', { count: totalMembers })}
            </span>
          </Link>
          {memberCountSafe < 4 ? (
            <button
              type="button"
              disabled
              data-testid="qa-tournament-disabled"
              title={t('groups.action.tournament.needMembers', { current: memberCountSafe, min: 4 })}
              aria-disabled="true"
              className="bg-bq-inset border-[0.5px] border-bq-hair rounded-lg px-2 py-3 cursor-not-allowed opacity-50 flex flex-col items-center gap-1"
            >
              <span className="text-[18px]">🏆</span>
              <span className="text-bq-ink text-[11px]">{t('groups.quickActionTournament')}</span>
              <span className="text-bq-ink3 text-[9px]">
                {t('groups.action.tournament.needMembers', { current: memberCountSafe, min: 4 })}
              </span>
            </button>
          ) : (
            <Link
              to="/tournaments"
              className="bg-bq-sapphire/[0.08] border-[0.5px] border-bq-sapphire/25 rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-105 transition-all"
            >
              <span className="text-[18px]">🏆</span>
              <span className="text-bq-ink text-[11px]">{t('groups.quickActionTournament')}</span>
              <span className="text-bq-ink3 text-[9px]">{t('groups.quickActionBracket')}</span>
            </Link>
          )}
          <Link
            to={`/groups/${id}?tab=members`}
            className="bg-bq-emerald/[0.08] border-[0.5px] border-bq-emerald/25 rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-105 transition-all"
          >
            <span className="text-[18px]">👥</span>
            <span className="text-bq-ink text-[11px]">{t('groups.quickActionMembers')}</span>
            <span className="text-bq-ink3 text-[9px]">
              {t('groups.quickActionPendingRequests', { count: 0 })}
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default GroupAnalytics;
