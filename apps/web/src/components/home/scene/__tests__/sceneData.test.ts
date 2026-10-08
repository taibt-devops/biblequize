import { describe, it, expect } from 'vitest'
import { SIGN_BOARDS, daysLeft, lanternState, timeOfDay } from '../sceneData'

describe('timeOfDay', () => {
  it('is day 5h-17h, sunset 17h-19h, night otherwise', () => {
    expect(timeOfDay(4)).toBe('night')
    expect(timeOfDay(5)).toBe('day')
    expect(timeOfDay(16)).toBe('day')
    expect(timeOfDay(17)).toBe('sunset')
    expect(timeOfDay(18)).toBe('sunset')
    expect(timeOfDay(19)).toBe('night')
    expect(timeOfDay(0)).toBe('night')
  })
})

describe('daysLeft', () => {
  const now = new Date(2026, 9, 8, 10, 0, 0)
  it('counts whole days until the end date (inclusive)', () => {
    expect(daysLeft('2026-10-20', now)).toBe(13)
    expect(daysLeft('2026-10-08T00:00:00', now)).toBe(1)
  })
  it('is null when unknown or over', () => {
    expect(daysLeft(undefined, now)).toBeNull()
    expect(daysLeft('2026-10-01', now)).toBeNull()
    expect(daysLeft('not a date', now)).toBeNull()
  })
})

describe('lanternState', () => {
  it('lit when done, burning while in progress, dark before', () => {
    expect(lanternState(1, 1)).toBe('lit')
    expect(lanternState(0, 5, true)).toBe('lit')
    expect(lanternState(1, 5)).toBe('burning')
    expect(lanternState(0, 1)).toBe('dark')
  })
})

describe('SIGN_BOARDS', () => {
  it('has the four ways to play with their routes', () => {
    expect(SIGN_BOARDS.map(b => [b.mode, b.to])).toEqual([
      ['study', '/practice'], ['ranked', '/ranked'], ['rooms', '/multiplayer'], ['journey', '/journey'],
    ])
  })

  it('hangs every board on the painted post by its nails and keeps it inside the picture', () => {
    for (const b of SIGN_BOARDS) {
      const flatEnd = b.side === 'left' ? b.x + b.w / 2 : b.x - b.w / 2
      const nails = b.side === 'left' ? flatEnd - 0.1 * b.w : flatEnd + 0.1 * b.w
      expect(nails).toBeGreaterThanOrEqual(79.1)
      expect(nails).toBeLessThanOrEqual(83.1)
      expect(b.x - b.w / 2).toBeGreaterThan(0)
      expect(b.x + b.w / 2).toBeLessThan(100)
    }
  })
})
