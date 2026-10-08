/**
 * The 66 books walked as 8 lands on the painted Journey map (LKD-17, SPEC_USER §6.3).
 * x / y are the land's sign on /images/lk/bq-journey.webp (% of width / height, 3:2 picture).
 * `trail` is the path (same % space) the land's books are spread along when the land is open on
 * the map (LKF-6, Journey artboard): the road for the Pentateuch, the walled city, the pastures, ...
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
  trail: [number, number][]
}

export const JOURNEY_REGIONS: JourneyRegion[] = [
  { id: 'pentateuch', no: 1, from: 1, to: 5, testament: 'OLD', x: 15, y: 66,
    trail: [[31, 93], [30, 83], [33, 74], [37, 66], [38, 58]] },
  { id: 'history', no: 2, from: 6, to: 17, testament: 'OLD', x: 33, y: 35,
    trail: [[21, 50], [28, 56], [35, 58], [41, 55], [45, 49], [47, 42], [45, 35], [41, 29]] },
  { id: 'poetry', no: 3, from: 18, to: 22, testament: 'OLD', x: 75, y: 61,
    trail: [[62, 73], [67, 76], [73, 77], [79, 75], [85, 71]] },
  { id: 'prophets', no: 4, from: 23, to: 39, testament: 'OLD', x: 44, y: 13,
    trail: [[24, 20], [58, 20], [58, 27], [38, 27]] },
  { id: 'gospels', no: 5, from: 40, to: 43, testament: 'NEW', x: 62, y: 42,
    trail: [[53, 47], [57, 51], [63, 53], [69, 51]] },
  { id: 'acts', no: 6, from: 44, to: 44, testament: 'NEW', x: 86, y: 31,
    trail: [[91, 41]] },
  { id: 'epistles', no: 7, from: 45, to: 65, testament: 'NEW', x: 66, y: 9,
    trail: [[53, 15], [78, 15], [78, 21], [53, 21], [53, 27], [76, 27]] },
  { id: 'revelation', no: 8, from: 66, to: 66, testament: 'NEW', x: 88, y: 18,
    trail: [[84, 7]] },
]

export function regionOfOrder(order: number): JourneyRegion | undefined {
  return JOURNEY_REGIONS.find(r => order >= r.from && order <= r.to)
}

/**
 * `n` points spread evenly along a region's trail (the map is 3:2, so a step in x counts 1.5x
 * a step in y). One point sits at the trail's start.
 */
export function trailPoints(region: JourneyRegion, n: number): [number, number][] {
  const pts = region.trail
  if (n <= 0) return []
  if (n === 1 || pts.length === 1) return Array.from({ length: n }, () => pts[0])
  const seg = pts.slice(1).map((p, i) => Math.hypot((p[0] - pts[i][0]) * 1.5, p[1] - pts[i][1]))
  const total = seg.reduce((a, b) => a + b, 0)
  const out: [number, number][] = []
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1)
    let i = 0
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++ }
    const f = seg[i] ? Math.min(1, d / seg[i]) : 0
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    out.push([Math.round((x0 + (x1 - x0) * f) * 10) / 10, Math.round((y0 + (y1 - y0) * f) * 10) / 10])
  }
  return out
}

/** Journey milestone badges (SPEC_USER §6.5). */
export type MilestoneId = 'start' | 'pentateuch' | 'ten' | 'ot' | 'gospels' | 'epistles' | 'nt' | 'all'
export interface Milestone {
  id: MilestoneId
  need: number
  /** which books count: any book, one testament, or one land */
  scope: 'any' | 'OLD' | 'NEW' | JourneyRegionId
}
export const JOURNEY_MILESTONES: Milestone[] = [
  { id: 'start', need: 1, scope: 'any' },
  { id: 'pentateuch', need: 5, scope: 'pentateuch' },
  { id: 'ten', need: 10, scope: 'any' },
  { id: 'ot', need: 39, scope: 'OLD' },
  { id: 'gospels', need: 4, scope: 'gospels' },
  { id: 'epistles', need: 21, scope: 'epistles' },
  { id: 'nt', need: 27, scope: 'NEW' },
  { id: 'all', need: 66, scope: 'any' },
]

/** Completed books that count toward a milestone, given the canonical orders of completed books. */
export function milestoneCount(m: Milestone, completedOrders: number[]): number {
  if (m.scope === 'any') return completedOrders.length
  if (m.scope === 'OLD') return completedOrders.filter(o => o <= 39).length
  if (m.scope === 'NEW') return completedOrders.filter(o => o >= 40).length
  const r = JOURNEY_REGIONS.find(x => x.id === m.scope)
  return r ? completedOrders.filter(o => o >= r.from && o <= r.to).length : 0
}
