import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

/**
 * Admin dashboard for the Early Ranked Unlock feature — adoption +
 * quality metrics, rendered as 4 KPI cards + a 30-day timeline chart.
 *
 * <p>Source of truth: {@code GET /api/admin/metrics/early-unlock}
 * (backed by {@code users.early_ranked_unlocked_at} and practice
 * counters). The timeline is zero-filled server-side so the chart
 * renders without gap logic.
 */

interface TimelinePoint {
  date: string   // ISO yyyy-mm-dd
  count: number
}

interface Metrics {
  totalUnlockers: number
  unlocksLast7Days: number
  unlocksLast30Days: number
  avgAccuracyPctAtUnlock: number | null
  timeline: TimelinePoint[]
}

function KpiCard({
  testId,
  label,
  value,
  hint,
  accent,
}: {
  testId: string
  label: string
  value: string | number
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      data-testid={testId}
      className={`bg-[#FFF8E7] rounded-lg h-[110px] flex flex-col justify-center px-6 border-l-2 shadow-sm ${
        accent ? 'border-[#8A5A12]' : 'border-[#1D2B22]/20'
      }`}
    >
      <span className="text-[11px] uppercase tracking-[0.2em] text-[#4D3A1F]/60 font-semibold">
        {label}
      </span>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-2xl font-bold text-[#1D2B22] font-mono leading-tight">{value}</span>
        {hint && <span className="text-[10px] text-[#4D3A1F]/50">{hint}</span>}
      </div>
    </div>
  )
}

function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const maxCount = useMemo(
    () => Math.max(1, ...points.map(p => p.count)),
    [points],
  )
  const barWidthPct = 100 / Math.max(1, points.length)

  return (
    <div data-testid="timeline-chart" className="flex items-end h-[160px] gap-[2px]">
      {points.map((p, i) => {
        const h = Math.round((p.count / maxCount) * 100)
        const isLast = i === points.length - 1
        return (
          <div
            key={p.date}
            data-testid={`timeline-bar-${i}`}
            title={`${p.date}: ${p.count}`}
            className="flex-1 min-w-0 relative flex flex-col justify-end"
            style={{ width: `${barWidthPct}%` }}
          >
            <div
              className={`w-full rounded-t ${
                p.count === 0 ? 'bg-[#1D2B22]/20' : isLast ? 'bg-[#FFC93C]' : 'bg-[#FFC93C]/60'
              }`}
              style={{ height: `${h}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function EarlyUnlockMetrics() {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery<Metrics>({
    queryKey: ['admin-early-unlock-metrics'],
    queryFn: () => api.get('/api/admin/metrics/early-unlock').then(r => r.data),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div data-testid="early-unlock-metrics-loading" className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[110px] bg-[#FFF8E7] rounded-lg" />
          ))}
        </div>
        <div className="h-[200px] bg-[#FFF8E7] rounded-lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div data-testid="early-unlock-metrics-error" className="bg-[#FFF8E7] rounded-lg p-6 text-[#4D3A1F]/60">
        {t('admin.earlyUnlock.loading')}
      </div>
    )
  }

  const isEmpty = data.totalUnlockers === 0
  const accuracyDisplay =
    data.avgAccuracyPctAtUnlock == null
      ? t('admin.earlyUnlock.noAccuracy')
      : `${data.avgAccuracyPctAtUnlock}%`

  return (
    <div data-testid="early-unlock-metrics-page" className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-[#1D2B22] tracking-tight">
          {t('admin.earlyUnlock.pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-[#4D3A1F]/60 max-w-2xl">
          {t('admin.earlyUnlock.subtitle')}
        </p>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          testId="kpi-total-unlockers"
          label={t('admin.earlyUnlock.kpiTotal')}
          value={data.totalUnlockers.toLocaleString()}
          hint={t('admin.earlyUnlock.kpiTotalHint')}
          accent
        />
        <KpiCard
          testId="kpi-unlocks-7d"
          label={t('admin.earlyUnlock.kpiLast7Days')}
          value={data.unlocksLast7Days.toLocaleString()}
        />
        <KpiCard
          testId="kpi-unlocks-30d"
          label={t('admin.earlyUnlock.kpiLast30Days')}
          value={data.unlocksLast30Days.toLocaleString()}
        />
        <KpiCard
          testId="kpi-avg-accuracy"
          label={t('admin.earlyUnlock.kpiAvgAccuracy')}
          value={accuracyDisplay}
          hint={t('admin.earlyUnlock.kpiAvgAccuracyHint')}
        />
      </section>

      {/* Timeline */}
      <section className="bg-[#FFF8E7] rounded-lg p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4D3A1F]/60 mb-4">
          {t('admin.earlyUnlock.timelineTitle')}
        </h2>
        {isEmpty ? (
          <p data-testid="early-unlock-empty" className="text-sm text-[#4D3A1F]/50 py-8 text-center">
            {t('admin.earlyUnlock.emptyState')}
          </p>
        ) : (
          <TimelineChart points={data.timeline} />
        )}
      </section>
    </div>
  )
}
