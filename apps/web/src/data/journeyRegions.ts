/**
 * Bible Journey regions (LKD-17, SPEC_USER §6.3): the 66 books grouped into 8
 * lands along the road of the painted map (/images/lk/bq-journey.webp).
 * `from`/`to` are inclusive book `order` values (Protestant canon, 1–66).
 * `x`/`y` are the sign positions on the map in % of its width/height — traced
 * over the painting, so they only hold for the uncropped 3:2 picture.
 */
export type JourneyRegionId =
  | 'pentateuch' | 'history' | 'poetry' | 'prophets'
  | 'gospels' | 'acts' | 'epistles' | 'revelation'

export interface JourneyRegion {
  id: JourneyRegionId
  no: number
  from: number
  to: number
  testament: 'OLD' | 'NEW'
  x: number
  y: number
}

export const JOURNEY_REGIONS: JourneyRegion[] = [
  { id: 'pentateuch', no: 1, from: 1, to: 5, testament: 'OLD', x: 15, y: 66 },
  { id: 'history', no: 2, from: 6, to: 17, testament: 'OLD', x: 33, y: 35 },
  { id: 'poetry', no: 3, from: 18, to: 22, testament: 'OLD', x: 75, y: 61 },
  { id: 'prophets', no: 4, from: 23, to: 39, testament: 'OLD', x: 44, y: 13 },
  { id: 'gospels', no: 5, from: 40, to: 43, testament: 'NEW', x: 62, y: 42 },
  { id: 'acts', no: 6, from: 44, to: 44, testament: 'NEW', x: 86, y: 31 },
  { id: 'epistles', no: 7, from: 45, to: 65, testament: 'NEW', x: 66, y: 9 },
  { id: 'revelation', no: 8, from: 66, to: 66, testament: 'NEW', x: 88, y: 18 },
]

/** Region a book belongs to, by its canonical order (1–66); undefined if out of range. */
export function regionOfOrder(order: number): JourneyRegion | undefined {
  return JOURNEY_REGIONS.find(r => order >= r.from && order <= r.to)
}
