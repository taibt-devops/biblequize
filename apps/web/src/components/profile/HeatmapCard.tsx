import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { HeatmapLevel, SessionHistory } from './types'

const WEEKS = 53
const HEATMAP_DAYS = WEEKS * 7

const HEATMAP_BG: Record<HeatmapLevel, string> = {
  0: 'bg-bq-inset',
  1: 'bg-bq-amber/25',
  2: 'bg-bq-amber/50',
  3: 'bg-bq-amber/75',
  4: 'bg-bq-amber',
}

export function buildHeatmapLevels(history: SessionHistory[]): HeatmapLevel[] {
  const dateCounts = new Map<string, number>()
  for (const session of history) {
    const date = session.completedAt?.slice(0, 10)
    if (date) dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1)
  }
  const cells: HeatmapLevel[] = []
  const today = new Date()
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const count = dateCounts.get(key) ?? 0
    if (count === 0) cells.push(0)
    else if (count <= 2) cells.push(1)
    else if (count <= 5) cells.push(2)
    else if (count <= 8) cells.push(3)
    else cells.push(4)
  }
  return cells
}

export function HeatmapCard({ cells, activeDays }: { cells: HeatmapLevel[]; activeDays: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const hasData = activeDays > 0

  return (
    <section data-testid="profile-heatmap" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-bq-ink inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-bq-amberd">grid_view</span>
            {t('profile.learningLog')}
          </h2>
          <p className="text-xs text-bq-ink2 mt-0.5">{t('profile.heatmapYearLabel')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-bq-ink2">
          <span><span className="text-bq-ink font-bold">{activeDays}</span> {t('profile.heatmapTotalLabel')}</span>
        </div>
      </div>

      {hasData ? (
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-[3px] min-w-max"
            style={{
              gridTemplateRows: 'repeat(7, 12px)',
              gridAutoFlow: 'column',
              gridAutoColumns: '12px',
            }}
          >
            {cells.map((level, i) => (
              <div key={i} className={`rounded-[2px] ${HEATMAP_BG[level]}`} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-bq-ink2">
            <span>{t('profile.heatmapLow')}</span>
            {[0, 1, 2, 3, 4].map(l => (
              <div key={l} className={`w-2.5 h-2.5 rounded-[2px] ${HEATMAP_BG[l as HeatmapLevel]}`} />
            ))}
            <span>{t('profile.heatmapHigh')}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-bq-amber/[0.06] border border-dashed border-bq-amber/20">
          <div className="text-xs text-bq-ink2">
            🌱 <strong className="text-bq-ink font-semibold">{t('profile.heatmapEmptyTitle')}</strong>{' '}
            {t('profile.heatmapEmptyDesc')}
          </div>
          <button
            onClick={() => navigate('/daily')}
            className="h-9 px-3 rounded-lg bg-bq-action text-bq-ink shadow-bq-action text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {t('profile.heatmapPlayCta')}
          </button>
        </div>
      )}
    </section>
  )
}
