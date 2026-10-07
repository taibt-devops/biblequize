import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import CellGroupPulseCard from './CellGroupPulseCard';

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
  weeklyActivity?: WeeklyActivityPoint[];
}

interface Props {
  groupId: string;
  groupCreatedAt?: string;
  groupMemberCount?: number;
}

function getGroupAge(createdAt?: string) {
  if (!createdAt) return { days: 0, isNew: true };
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  return { days, isNew: days < 7 };
}

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
      <div className={`text-[9px] ${isToday ? 'text-bq-amberd font-medium' : 'text-bq-ink3'}`}>
        {label}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  borderColor,
  textColor,
  tooltip,
  testId,
}: {
  label: string;
  value: string | number;
  unit?: string;
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
        <div className="text-[9px] tracking-wider" style={{ color: borderColor }}>{label}</div>
        {tooltip && (
          <span title={tooltip} aria-label={tooltip} className="text-bq-ink3 hover:text-bq-ink2 cursor-help text-[10px] leading-none mt-0.5">ⓘ</span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-medium" style={{ color: textColor }}>{value}</span>
        {unit && <span className="text-bq-ink3 text-[11px]">{unit}</span>}
      </div>
    </div>
  );
}

export default function GroupAnalyticsTab({ groupId, groupCreatedAt, groupMemberCount }: Props) {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/api/groups/${groupId}/analytics`)
      .then((res) => {
        if (cancelled) return;
        if (res.data.success) setAnalytics(res.data.analytics ?? res.data);
        else setError(res.data.message || t('groupAnalytics.errorLoadData'));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 403) setError(t('groupAnalytics.noPermission'));
        else setError(err.response?.data?.message || t('groupAnalytics.connectionError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [groupId, t]);

  const totalMembers = analytics?.totalMembers ?? groupMemberCount ?? 0;
  const activeWeek = analytics?.activeWeek ?? analytics?.activeToday ?? 0;
  const avgScore = analytics?.avgScore ?? 0;
  const accuracy = analytics?.accuracy ?? 0;
  const inactiveCount = analytics?.inactiveCount ?? Math.max(0, totalMembers - activeWeek);

  const weeklyData = analytics?.weeklyActivity ?? [];
  const maxDayCount = weeklyData.reduce((m, d) => Math.max(m, d.activeCount), 0);
  const weeklyBars = weeklyData.map((d) => ({
    date: d.date,
    height: maxDayCount === 0 ? 4 : Math.max(4, (d.activeCount / maxDayCount) * 100),
  }));
  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', t('groups.today')];

  const groupAge = getGroupAge(groupCreatedAt);
  const memberCountSafe = groupMemberCount ?? totalMembers;
  const chartHidden = groupAge.isNew || memberCountSafe < 3;
  const inactiveAlertHidden =
    groupAge.isNew ||
    memberCountSafe < 5 ||
    inactiveCount === 0 ||
    inactiveCount / Math.max(1, memberCountSafe) < 0.3;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-8 h-8 border-2 border-bq-amber/20 border-t-bq-amberd rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-bq-white rounded-2xl p-6 text-center border-[0.5px] border-error/30">
        <span className="material-symbols-outlined text-3xl text-error mb-2 block">error</span>
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="group-analytics-tab">
      <CellGroupPulseCard />

      <section className="bg-bq-sapphire/[0.05] border-[0.5px] border-bq-sapphire/25 rounded-xl p-3.5 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-bq-ink text-[14px] font-medium">📊 {t('groups.analyticsTitle')}</div>
          <Link
            to={`/groups/${groupId}/analytics`}
            className="text-bq-ink2 text-[10px] hover:text-bq-amberd transition-colors"
          >
            {t('groups.viewFullPage')} →
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          <KpiCard
            testId="kpi-tab-active"
            label={t('groups.kpiActiveWeek')}
            value={activeWeek}
            unit={`/ ${totalMembers}`}
            borderColor="rgba(46,125,79,0.3)"
            textColor="#2E7D4F"
            tooltip={t('groups.kpiTooltip.activeWeek', { active: activeWeek, total: totalMembers })}
          />
          <KpiCard
            testId="kpi-tab-avg"
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
            testId="kpi-tab-accuracy"
            label={t('groups.kpiAccuracy')}
            value={`${accuracy}%`}
            borderColor="rgba(47,111,176,0.3)"
            textColor="#2F6FB0"
            tooltip={t('groups.kpiTooltip.accuracy', { sample: activeWeek })}
          />
          <KpiCard
            testId="kpi-tab-inactive"
            label={t('groups.kpiInactive')}
            value={inactiveCount}
            unit={t('groups.kpiPeople')}
            borderColor="rgba(255,111,61,0.3)"
            textColor="#FF6F3D"
            tooltip={t('groups.kpiTooltip.inactive', { count: inactiveCount, total: totalMembers, days: 7 })}
          />
        </div>

        {chartHidden ? (
          <div data-testid="analytics-tab-chart-empty" className="bg-bq-inset border-[0.5px] border-bq-hair rounded-lg p-6 mb-3 text-center">
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
              {weeklyBars.length === 7
                ? weeklyBars.map((bar, idx) => (
                    <ChartBar key={bar.date} height={bar.height} label={dayLabels[idx]} isToday={idx === 6} />
                  ))
                : dayLabels.map((label, idx) => (
                    <ChartBar key={label} height={4} label={label} isToday={idx === 6} />
                  ))}
            </div>
          </div>
        )}

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
              to={`/groups/${groupId}?tab=members&filter=inactive`}
              className="bg-bq-ember/15 text-bq-ember border-[0.5px] border-bq-ember/40 rounded-md px-3 py-1.5 text-[11px] font-medium flex-shrink-0 hover:brightness-110 transition-all"
            >
              {t('groups.viewInactiveList')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
