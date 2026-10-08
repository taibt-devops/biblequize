import { useTranslation } from 'react-i18next'
import { JOURNEY_MILESTONES, JOURNEY_REGIONS, milestoneCount, type JourneyRegionId } from '../../data/journeyRegions'
import type { RegionProgress } from './JourneyMap'
import { TrackBar } from '../lk/Place'

export interface SelectedBook {
  key: string
  name: string
  order: number
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'
  pct: number
  mastered: number
  total: number
  regionId: JourneyRegionId
}

const card = 'bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card'

/** The open book (Journey artboard): place among the 66, knowledge vs the 80 % mark, next step. */
export function BookDetailCard({ book, onPractice }: { book: SelectedBook; onPractice: () => void }) {
  const { t } = useTranslation()
  const done = book.status === 'COMPLETED'
  const empty = book.total === 0
  const note = empty ? t('journey.lk.noteEmpty')
    : done ? t('journey.lk.noteDone')
    : book.pct > 0 ? t('journey.lk.noteProgress', { pct: Math.max(0, 80 - book.pct) })
    : t('journey.lk.noteNew')
  return (
    <section data-testid="journey-book-detail" aria-labelledby="journey-book-title" className={`${card} px-5 py-5`}>
      <p className="m-0 text-[15px] font-bold text-bq-amberd">
        {t('journey.lk.bookOf', { order: book.order, region: t(`journey.regions.${book.regionId}.name`) })}
      </p>
      <h2 id="journey-book-title" className="m-0 mb-2.5 font-display text-[28px] leading-tight font-extrabold">{book.name}</h2>
      <div className="relative">
        <TrackBar pct={book.pct} className="h-5 border-[3px]" label={t('journey.lk.known', { pct: book.pct })} />
        <span aria-hidden className="absolute top-0 bottom-0 left-[80%] w-[3px] bg-bq-ink" />
      </div>
      <div className="flex justify-between mt-1 text-[14px] font-bold text-bq-ink2">
        <span>{book.pct > 0 || done ? t('journey.lk.known', { pct: book.pct }) : t('journey.lk.notStarted')}</span>
        <span>{t('journey.lk.milestone')}</span>
      </div>
      <p className="mt-2.5 mb-1 font-read text-[14px] leading-relaxed text-bq-ink2">{note}</p>
      {!empty && (
        <p className="m-0 mb-3.5 text-[13px] font-bold text-bq-ink3">{t('journey.lk.questionsKnown', { mastered: book.mastered, total: book.total })}</p>
      )}
      <button
        type="button"
        data-testid="journey-book-detail-cta"
        disabled={empty}
        onClick={onPractice}
        className={`lk-btn w-full text-bq-ink text-[19px] ${done ? 'lk-btn-2' : ''}`}
      >
        {empty ? t('journey.noQuestions') : done ? t('journey.lk.ctaReview') : t('journey.lk.ctaPractice')}
      </button>
    </section>
  )
}

/** The eight lands: open one on the map. */
export function RegionList({ progress, currentRegion, openRegion, onOpen }: {
  progress: Record<JourneyRegionId, RegionProgress>
  currentRegion: JourneyRegionId | null
  openRegion: JourneyRegionId | null
  onOpen: (id: JourneyRegionId) => void
}) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="journey-regions-title" className={`${card} px-4 py-4`}>
      <h2 id="journey-regions-title" className="m-0 mb-1.5 px-1 font-display text-[22px] font-extrabold">{t('journey.lk.regionsTitle')}</h2>
      <ol className="list-none m-0 p-0">
        {JOURNEY_REGIONS.map(r => {
          const p = progress[r.id] ?? { done: 0, total: r.to - r.from + 1 }
          const open = r.id === openRegion
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                aria-pressed={open}
                className={`w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl text-left border-b-2 border-dashed border-bq-hair ${open ? 'bg-bq-cream' : 'hover:bg-bq-cream/60'}`}
              >
                <span className={`shrink-0 w-7 h-7 grid place-items-center rounded-full border-2 border-bq-ink font-extrabold text-[14px] ${r.id === currentRegion ? 'bg-bq-amber' : 'bg-bq-white'}`}>{r.no}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold text-[16px] leading-tight">{t(`journey.regions.${r.id}.name`)}</span>
                  <span className="block font-read text-[12.5px] text-bq-ink3 truncate">{t(`journey.regions.${r.id}.place`)}</span>
                </span>
                <span className="font-extrabold text-[15px] tabular-nums">{p.done}/{p.total}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Journey milestone badges (SPEC_USER §6.5): gold when earned, dashed with the target otherwise. */
export function JourneyBadges({ completedOrders }: { completedOrders: number[] }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="journey-badges-title" className="bg-bq-cream border-[3px] border-bq-ink rounded-bq px-4 py-4">
      <h2 id="journey-badges-title" className="m-0 mb-2 font-display text-[20px] font-extrabold">{t('journey.lk.badgesTitle')}</h2>
      <div className="flex flex-wrap gap-2">
        {JOURNEY_MILESTONES.map(m => {
          const earned = milestoneCount(m, completedOrders) >= m.need
          const name = t(`journey.lk.badges.${m.id}`)
          return earned ? (
            <span key={m.id} data-testid={`journey-badge-${m.id}`} data-earned="true" className="px-3 bg-bq-amber border-2 border-bq-ink rounded-full font-extrabold text-[14px]">
              {name} ✓
            </span>
          ) : (
            <span key={m.id} data-testid={`journey-badge-${m.id}`} className="px-3 bg-bq-white border-2 border-dashed border-bq-ink3 rounded-full font-bold text-[14px] text-bq-ink3">
              {name} · {m.need}
            </span>
          )
        })}
      </div>
    </section>
  )
}
