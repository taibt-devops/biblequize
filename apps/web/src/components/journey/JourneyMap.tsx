import { useTranslation } from 'react-i18next'
import { JOURNEY_REGIONS, type JourneyRegionId } from '../../data/journeyRegions'

/**
 * Painted Bible Journey map (LKD-17): one wooden sign per land with the number
 * of books conquered there; the current land is gold and the traveller stands
 * under it. Clicking a sign hands the land to the page (scrolls to its books).
 * Positions come from JOURNEY_REGIONS and only line up with the uncropped 3:2
 * picture, hence aspect-[3/2] + object-cover.
 */
export interface RegionProgress {
  done: number
  total: number
}

interface JourneyMapProps {
  progress: Record<JourneyRegionId, RegionProgress>
  currentRegion: JourneyRegionId | null
  onSelectRegion: (id: JourneyRegionId) => void
}

export default function JourneyMap({ progress, currentRegion, onSelectRegion }: JourneyMapProps) {
  const { t } = useTranslation()
  const here = JOURNEY_REGIONS.find(r => r.id === currentRegion)

  return (
    <section
      data-testid="journey-map"
      aria-label={t('journey.mapLabel')}
      className="relative w-full aspect-[3/2] [container-type:inline-size] overflow-hidden rounded-bq border-[3px] border-bq-ink shadow-bq-card bg-bq-track"
    >
      <img src="/images/lk/bq-journey.webp" alt={t('journey.mapAlt')} className="absolute inset-0 w-full h-full object-cover" />

      {/* The traveller stands under the current sign, behind the signs so names stay readable */}
      {here && (
        <img
          src="/images/lk/hero.webp"
          alt=""
          aria-hidden
          className="absolute h-[13%] -translate-x-1/2 pointer-events-none motion-safe:animate-bob"
          style={{ left: `${here.x}%`, top: `${here.y + 3}%` }}
        />
      )}

      {JOURNEY_REGIONS.map(r => {
        const p = progress[r.id] ?? { done: 0, total: r.to - r.from + 1 }
        const isHere = r.id === currentRegion
        const name = t(`journey.regions.${r.id}.name`)
        return (
          <button
            key={r.id}
            type="button"
            data-testid={`journey-region-${r.id}`}
            data-current={isHere || undefined}
            onClick={() => onSelectRegion(r.id)}
            aria-label={t('journey.regionSign', { name, done: p.done, total: p.total })}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-[.6cqw] p-[3px] sm:pl-[.4cqw] sm:pr-[1.1cqw] py-[.35cqw] border-[3px] border-bq-ink rounded-full shadow-bq-btn whitespace-nowrap transition-transform hover:scale-105 active:translate-y-[calc(-50%+3px)] ${isHere ? 'bg-bq-amber' : 'bg-bq-white'}`}
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            <span className={`grid place-items-center w-[max(26px,2.4cqw)] h-[max(26px,2.4cqw)] ${isHere ? 'bg-bq-amber' : 'bg-bq-white'} border-2 border-bq-ink rounded-full font-extrabold [font-size:max(13px,1.35cqw)]`}>
              {r.no}
            </span>
            <span className="hidden sm:inline font-extrabold leading-none [font-size:max(12px,1.6cqw)] text-bq-ink">{name}</span>
            <span className="hidden sm:inline font-bold leading-none [font-size:max(11px,1.3cqw)] text-bq-ink2">{p.done}/{p.total}</span>
          </button>
        )
      })}
    </section>
  )
}
