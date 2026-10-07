import { describe, it, expect } from 'vitest'
import { JOURNEY_REGIONS, regionOfOrder } from '../journeyRegions'

describe('journeyRegions', () => {
  it('covers all 66 books exactly once, in order', () => {
    const covered: number[] = []
    for (const r of JOURNEY_REGIONS) {
      for (let o = r.from; o <= r.to; o++) covered.push(o)
    }
    expect(covered).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
  })

  it('splits 39 Old Testament books and 27 New Testament books', () => {
    const count = (t: 'OLD' | 'NEW') =>
      JOURNEY_REGIONS.filter(r => r.testament === t).reduce((n, r) => n + r.to - r.from + 1, 0)
    expect(count('OLD')).toBe(39)
    expect(count('NEW')).toBe(27)
  })

  it('maps landmark books to their lands', () => {
    expect(regionOfOrder(1)?.id).toBe('pentateuch')   // Genesis
    expect(regionOfOrder(19)?.id).toBe('poetry')      // Psalms
    expect(regionOfOrder(23)?.id).toBe('prophets')    // Isaiah
    expect(regionOfOrder(43)?.id).toBe('gospels')     // John
    expect(regionOfOrder(44)?.id).toBe('acts')        // Acts
    expect(regionOfOrder(45)?.id).toBe('epistles')    // Romans
    expect(regionOfOrder(66)?.id).toBe('revelation')  // Revelation
    expect(regionOfOrder(0)).toBeUndefined()
    expect(regionOfOrder(67)).toBeUndefined()
  })

  it('keeps every sign on the map', () => {
    for (const r of JOURNEY_REGIONS) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x).toBeLessThanOrEqual(100)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeLessThanOrEqual(100)
    }
  })
})
