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

function getInitial(name?: string): string {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

/* ─── Single bar in the activity chart ─── */
function ChartBar({ height, label, isToday }: { height: number; label: string; isToday?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-full rounded-t-[4px] ${
          isToday
            ? 'bg-gradient-to-b from-[rgba(232,168,50,0.7)] to-secondary shadow-[0_0_8px_rgba(232,168,50,0.4)]'
            : 'bg-gradient-to-b from-[rgba(232,168,50,0.5)] to-secondary'
        }`}
        style={{ height: `${height}%` }}
      />
      <div
        className={`text-[9px] ${
          isToday ? 'text-secondary font-medium' : 'text-on-surface-variant/40'
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
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { sign: '▲' | '▼' | '—'; text: string };
  borderColor: string;
  textColor: string;
}) {
  return (
    <div
      className="bg-[rgba(50,52,64,0.5)] border-[0.5px] rounded-lg p-2.5"
      style={{ borderColor }}
    >
      <div className="text-[9px] tracking-wider mb-1" style={{ color: borderColor }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-medium" style={{ color: textColor }}>{value}</span>
        {unit && <span className="text-on-surface/40 text-[11px]">{unit}</span>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('7d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/groups/${id}/analytics`);
      if (res.data.success) {
        setAnalytics(res.data.analytics ?? res.data);
      } else {
        setError(res.data.message || t('groupAnalytics.errorLoadData'));
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
        <div className="w-10 h-10 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-[rgba(50,52,64,0.4)] rounded-2xl p-10 text-center border-[0.5px] border-white/[0.06]">
          <span className="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <p className="text-error font-medium mb-5 text-[14px]">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={fetchAnalytics}
              className="px-5 py-2.5 bg-white/5 text-on-surface rounded-lg font-medium text-[12px] hover:bg-white/10 transition-all"
            >
              {t('common.retry')}
            </button>
            <button
              onClick={() => navigate(`/groups/${id}`)}
              className="px-5 py-2.5 bg-secondary/10 text-secondary rounded-lg font-medium text-[12px] hover:bg-secondary/20 transition-all flex items-center gap-2"
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">
      {/* ── Back link ── */}
      <button
        onClick={() => navigate(`/groups/${id}`)}
        className="flex items-center gap-1 text-on-surface-variant text-[11px] font-medium tracking-wider uppercase hover:text-secondary transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {t('groupAnalytics.backToGroup')}
      </button>

      {/* ── Analytics card (mockup: groups_leader_dashboard.html, blue-tinted leader-only block) ── */}
      <section className="bg-[rgba(74,158,255,0.05)] border-[0.5px] border-[rgba(74,158,255,0.25)] rounded-xl p-3.5 sm:p-5">
        <div className="flex flex-wrap gap-2 justify-between items-center mb-3 sm:mb-4">
          <div>
            <div className="text-[rgba(106,184,232,0.7)] text-[10px] tracking-wider mb-1">
              {t('groups.leaderOnly')}
            </div>
            <div className="text-on-surface text-[14px] font-medium">📊 {t('groups.analyticsTitle')}</div>
          </div>
          <div className="inline-flex bg-black/30 rounded-md p-0.5">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`border-0 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all ${
                  period === p ? 'bg-[#6AB8E8] text-background' : 'bg-transparent text-on-surface/55'
                }`}
              >
                {p === '7d' ? t('groups.period7d') : p === '30d' ? t('groups.period30d') : t('groups.period90d')}
              </button>
            ))}
          </div>
        </div>

        {/* KPI grid (4 cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          <KpiCard
            label={t('groups.kpiActiveWeek')}
            value={activeWeek}
            unit={`/ ${totalMembers}`}
            delta={{ sign: '▲', text: t('groups.kpiVsLastWeek') }}
            borderColor="rgba(99,153,34,0.3)"
            textColor="#97C459"
          />
          <KpiCard
            label={t('groups.kpiAvgScore')}
            value={avgScore || '—'}
            unit={t('groups.kpiPerPerson')}
            borderColor="rgba(232,168,50,0.3)"
            textColor="#e8a832"
          />
          <KpiCard
            label={t('groups.kpiAccuracy')}
            value={`${accuracy}%`}
            delta={{ sign: '—', text: t('groups.kpiStable') }}
            borderColor="rgba(106,184,232,0.3)"
            textColor="#6AB8E8"
          />
          <KpiCard
            label={t('groups.kpiInactive')}
            value={inactiveCount}
            unit={t('groups.kpiPeople')}
            delta={{ sign: '▼', text: t('groups.kpiNeedAttention') }}
            borderColor="rgba(255,140,66,0.3)"
            textColor="#ff8c42"
          />
        </div>

        {/* Weekly activity chart */}
        <div className="bg-[rgba(50,52,64,0.5)] border-[0.5px] border-white/[0.06] rounded-lg p-3 mb-3">
          <div className="flex justify-between items-center mb-2.5">
            <div className="text-on-surface/85 text-[11px] font-medium">📈 {t('groups.weeklyActivity')}</div>
            <div className="text-on-surface/40 text-[10px]">{t('groups.weeklyActivitySubtitle')}</div>
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

        {/* Inactive members alert */}
        {inactiveCount > 0 && (
          <div className="bg-[rgba(255,140,66,0.06)] border-[0.5px] border-[rgba(255,140,66,0.3)] rounded-lg px-3 py-2.5 flex justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px]">⚠️</span>
                <span className="text-[#ff8c42] text-[11px] font-medium">
                  {t('groups.inactiveAlert', { count: inactiveCount })}
                </span>
              </div>
              <div className="text-on-surface/60 text-[11px] leading-snug">
                {t('groups.inactiveAlertDesc')}
              </div>
            </div>
            <Link
              to={`/groups/${id}?tab=members&filter=inactive`}
              className="bg-[rgba(255,140,66,0.15)] text-[#ff8c42] border-[0.5px] border-[rgba(255,140,66,0.4)] rounded-md px-3 py-1.5 text-[11px] font-medium flex-shrink-0 hover:brightness-110 transition-all"
            >
              {t('groups.viewInactiveList')}
            </Link>
          </div>
        )}
      </section>

      {/* ── Top contributors (real data from analytics.topContributors) ── */}
      {topContributors.length > 0 && (
        <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-white/[0.06] rounded-xl p-3.5 sm:p-5">
          <div className="text-on-surface text-[13px] font-medium mb-3 flex items-center gap-2">
            🏆 {t('groupAnalytics.topContributors')}
          </div>
          <div className="flex flex-col gap-2">
            {topContributors.map((c, idx) => (
              <div
                key={c.userId}
                className={`rounded-lg px-3 py-2.5 flex items-center gap-3 border-[0.5px] ${
                  idx === 0
                    ? 'bg-[rgba(232,168,50,0.05)] border-[rgba(232,168,50,0.25)]'
                    : 'bg-white/[0.03] border-white/[0.04]'
                }`}
              >
                <div
                  className={`text-[13px] font-medium w-5 text-center ${
                    idx < 3 ? 'text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  {idx + 1}
                </div>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-medium ${
                    idx === 0 ? 'bg-[rgba(232,168,50,0.15)] text-secondary ring-2 ring-secondary' : 'bg-white/10 text-on-surface'
                  }`}
                >
                  {c.avatarUrl ? (
                    <img alt={c.name} src={c.avatarUrl} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    getInitial(c.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-on-surface text-[12px] font-medium truncate">{c.name}</div>
                  <div className="text-on-surface/45 text-[10px]">
                    {c.questionsAnswered} {t('groupAnalytics.questionsLabel')}
                  </div>
                </div>
                <div className="text-secondary text-[12px] font-medium">{(c.score ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Actions panel ── */}
      <section className="bg-[rgba(50,52,64,0.4)] border-[0.5px] border-[rgba(232,168,50,0.15)] rounded-xl p-3.5 sm:p-5">
        <div className="text-on-surface text-[13px] font-medium mb-3">⚡ {t('groups.quickActions')}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Link
            to={`/groups/${id}?tab=quizsets`}
            className="bg-[rgba(232,168,50,0.08)] border-[0.5px] border-[rgba(232,168,50,0.25)] rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-125 transition-all"
          >
            <span className="text-[18px]">📚</span>
            <span className="text-on-surface text-[11px]">{t('groups.quickActionCreateQuiz')}</span>
            <span className="text-on-surface/40 text-[9px]">{t('groups.quickActionUsedCount', { used: 0, max: 20 })}</span>
          </Link>
          <Link
            to={`/groups/${id}?tab=announcements`}
            className="bg-[rgba(74,158,255,0.08)] border-[0.5px] border-[rgba(74,158,255,0.25)] rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-125 transition-all"
          >
            <span className="text-[18px]">📢</span>
            <span className="text-on-surface text-[11px]">{t('groups.quickActionPostAnnouncement')}</span>
            <span className="text-on-surface/40 text-[9px]">
              {t('groups.quickActionSendTo', { count: totalMembers })}
            </span>
          </Link>
          <Link
            to="/tournaments"
            className="bg-[rgba(168,85,247,0.08)] border-[0.5px] border-[rgba(168,85,247,0.25)] rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-125 transition-all"
          >
            <span className="text-[18px]">🏆</span>
            <span className="text-on-surface text-[11px]">{t('groups.quickActionTournament')}</span>
            <span className="text-on-surface/40 text-[9px]">{t('groups.quickActionBracket')}</span>
          </Link>
          <Link
            to={`/groups/${id}?tab=members`}
            className="bg-[rgba(99,153,34,0.08)] border-[0.5px] border-[rgba(99,153,34,0.25)] rounded-lg px-2 py-3 cursor-pointer flex flex-col items-center gap-1 hover:brightness-125 transition-all"
          >
            <span className="text-[18px]">👥</span>
            <span className="text-on-surface text-[11px]">{t('groups.quickActionMembers')}</span>
            <span className="text-on-surface/40 text-[9px]">
              {t('groups.quickActionPendingRequests', { count: 0 })}
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default GroupAnalytics;
