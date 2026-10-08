import { useTranslation } from 'react-i18next'
import { JOURNEY_REGIONS, trailPoints, type JourneyRegionId } from '../../data/journeyRegions'

/**
 * Painted Bible Journey map (LKD-17 → LKF-6, Journey artboard). One wooden sign per land with the
 * books conquered there (the land of the current book is gold); the open land's books stand as
 * stations along its trail — star = conquered, number = its place among the 66 — and the
 * traveller waits at the current book. Positions are % of the uncropped 3:2 picture.
 */
export interface RegionProgress {
  done: number
  total: number
}

export interface MapBook {
  key: string
  name: string
  order: number
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'
  pct: number
}

interface JourneyMapProps {
  progress: Record<JourneyRegionId, RegionProgress>
  currentRegion: JourneyRegionId | null
  onSelectRegion: (id: JourneyRegionId) => void
  /** The land whose stations are drawn (defaults to the current land). */
  openRegion?: JourneyRegionId | null
  books?: MapBook[]
  selectedBook?: string | null
  currentBook?: string | null
  onSelectBook?: (key: string) => void
}

export default function JourneyMap({
  progress, currentRegion, onSelectRegion, openRegion = currentRegion, books = [], selectedBook = null, currentBook = null, onSelectBook,
}: JourneyMapProps) {
  const { t } = useTranslation()
  const open = JOURNEY_REGIONS.find(r => r.id === openRegion)
  const points = open ? trailPoints(open, books.length) : []
  const many = books.length > 5
  const nodeSize = many ? 'w-[max(22px,3cqw)] h-[max(22px,3cqw)] [font-size:max(10px,1.25cqw)]' : 'w-[max(28px,3.8cqw)] h-[max(28px,3.8cqw)] [font-size:max(12px,1.6cqw)]'
  const here = books.findIndex(b => b.key === currentBook)
  const heroAt = here >= 0 ? points[here] : null
  const sign = JOURNEY_REGIONS.find(r => r.id === currentRegion)

  return (
    <section
      data-testid="journey-map"
      aria-label={t('journey.mapLabel')}
      className="relative w-full aspect-[3/2] [container-type:inline-size] overflow-hidden rounded-bq border-[3px] border-bq-ink shadow-bq-card bg-bq-track"
    >
      <img src="/images/lk/bq-journey.webp" alt={t('journey.mapAlt')} className="absolute inset-0 w-full h-full object-cover" />

      {/* stations of the open land */}
      {books.map((b, i) => {
        const [x, y] = points[i] ?? [50, 50]
        const done = b.status === 'COMPLETED'
        const started = b.status === 'IN_PROGRESS'
        const selected = b.key === selectedBook
        const showLabel = !many || selected
        const status = done ? t('journey.lk.statusDone') : started ? t('journey.lk.statusProgress', { pct: b.pct }) : t('journey.lk.statusNew')
        return (
          <span key={b.key}>
            <button
              type="button"
              data-testid={`journey-station-${b.key}`}
              aria-label={t('journey.lk.bookNode', { name: b.name, status })}
              aria-pressed={selected}
              onClick={() => onSelectBook?.(b.key)}
              className={`absolute z-[2] -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full border-[3px] border-bq-ink font-extrabold text-bq-ink transition-transform hover:scale-110 ${nodeSize} ${
                done ? 'bg-bq-amber' : started ? 'bg-bq-white' : 'bg-bq-track text-bq-ink2'
              } ${selected ? 'shadow-[0_3px_0_#1D2B22,0_0_0_4px_#FFF8E7,0_0_0_7px_#1D2B22]' : 'shadow-[0_3px_0_#1D2B22]'}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {done ? '★' : b.order}
            </button>
            {showLabel && (
              <span
                aria-hidden
                className="absolute z-[2] -translate-y-1/2 px-[.8cqw] py-[.15cqw] bg-bq-white/95 border-2 border-bq-ink rounded-[10px] font-bold [font-size:max(11px,1.35cqw)] whitespace-nowrap pointer-events-none"
                style={{ left: `calc(${x}% + ${many ? 2.2 : 2.6}cqw)`, top: `${y}%` }}
              >
                {b.name}
              </span>
            )}
          </span>
        )
      })}

      {/* land signs */}
      {JOURNEY_REGIONS.map(r => {
        const p = progress[r.id] ?? { done: 0, total: r.to - r.from + 1 }
        const isHere = r.id === currentRegion
        const isOpen = r.id === openRegion
        const name = t(`journey.regions.${r.id}.name`)
        return (
          <button
            key={r.id}
            type="button"
            data-testid={`journey-region-${r.id}`}
            data-current={isHere || undefined}
            aria-pressed={isOpen}
            onClick={() => onSelectRegion(r.id)}
            aria-label={t('journey.regionSign', { name, done: p.done, total: p.total })}
            className={`absolute z-[3] -translate-x-1/2 -translate-y-1/2 flex items-center gap-[.6cqw] p-[3px] sm:pl-[.4cqw] sm:pr-[1.1cqw] sm:py-[.35cqw] border-[3px] border-bq-ink rounded-full whitespace-nowrap transition-transform hover:scale-105 ${
              isHere ? 'bg-bq-amber' : 'bg-bq-white'
            } ${isOpen ? 'shadow-[0_4px_0_#1D2B22,0_0_0_4px_#FFC93C]' : 'shadow-bq-btn'}`}
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            <span className={`grid place-items-center w-[max(24px,2.4cqw)] h-[max(24px,2.4cqw)] ${isHere ? 'bg-bq-amber' : 'bg-bq-white'} border-2 border-bq-ink rounded-full font-extrabold [font-size:max(12px,1.35cqw)]`}>
              {r.no}
            </span>
            <span className="hidden sm:inline font-extrabold leading-none [font-size:max(12px,1.6cqw)] text-bq-ink">{name}</span>
            <span className="hidden sm:inline font-bold leading-none [font-size:max(11px,1.3cqw)] text-bq-ink2">{p.done}/{p.total}</span>
          </button>
        )
      })}

      {/* the traveller: at the current station when its land is open, else beside the current land's sign */}
      {(heroAt || sign) && (
        <img
          src="/images/lk/hero.webp"
          alt={heroAt && books[here] ? t('journey.lk.youAreHere', { book: books[here].name }) : ''}
          aria-hidden={!heroAt}
          className="absolute z-[4] h-[11%] -translate-x-1/2 -translate-y-[92%] pointer-events-none motion-safe:animate-bob"
          style={heroAt ? { left: `${heroAt[0] - 3.4}%`, top: `${heroAt[1]}%` } : { left: `${sign!.x - 4}%`, top: `${sign!.y + 4}%` }}
        />
      )}
    </section>
  )
}
