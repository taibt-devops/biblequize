import { useTranslation } from 'react-i18next'

export interface HeatmapDay {
  date: string
  completed: boolean
  correctCount: number
  totalQuestions: number
}

interface HeatmapCardProps {
  days: HeatmapDay[]
}

function levelClass(d: HeatmapDay): string {
  if (!d.completed) return 'bg-bq-paper border-bq-ink/20'
  const ratio = d.totalQuestions > 0 ? d.correctCount / d.totalQuestions : 0
  if (ratio >= 1.0) return 'bg-bq-amber border-bq-ink'
  if (ratio >= 0.8) return 'bg-bq-amber/70 border-bq-ink'
  if (ratio >= 0.6) return 'bg-bq-amber/45 border-bq-ink/70'
  return 'bg-bq-amber/25 border-bq-ink/50'
}

/** 30 days of letters (LKF-10): one stamp per day, gold by how many were right. */
export function HeatmapCard({ days }: HeatmapCardProps) {
  const { t } = useTranslation()
  const completedCount = days.filter((d) => d.completed).length
  const total = days.length
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const todayIso = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="font-display text-[19px] font-extrabold text-bq-ink">
          {t('daily.heatmapTitle', { days: total })}
        </div>
        <span className="px-2.5 py-0.5 bg-bq-cream border-2 border-bq-ink rounded-full text-[12.5px] font-extrabold">
          {t('daily.heatmapStats', { completed: completedCount, total, percent })}
        </span>
      </div>

      <div className="grid gap-1.5 mb-3.5 max-w-[620px]" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
        {days.map((d) => {
          const isToday = d.date === todayIso
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.completed ? `${d.correctCount}/${d.totalQuestions}` : t('daily.heatmapMissed')}`}
              className={`aspect-square rounded-md border-2 ${levelClass(d)} ${
                isToday ? 'ring-2 ring-bq-ink ring-offset-2 ring-offset-bq-white' : ''
              }`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-bold text-bq-ink2">
        <span>{t('daily.heatmapLegendRange', { days: total })}</span>
        <div className="flex items-center gap-1">
          <span>{t('daily.heatmapLegendLow')}</span>
          <div className="w-3.5 h-3.5 rounded border-2 bg-bq-paper border-bq-ink/20" />
          <div className="w-3.5 h-3.5 rounded border-2 bg-bq-amber/25 border-bq-ink/50" />
          <div className="w-3.5 h-3.5 rounded border-2 bg-bq-amber/45 border-bq-ink/70" />
          <div className="w-3.5 h-3.5 rounded border-2 bg-bq-amber/70 border-bq-ink" />
          <div className="w-3.5 h-3.5 rounded border-2 bg-bq-amber border-bq-ink" />
          <span>{t('daily.heatmapLegendHigh')}</span>
        </div>
      </div>
    </div>
  )
}
