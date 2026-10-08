import { describe, it, expect } from 'vitest'
import { achievementIcon } from '../achievementIcon'

describe('achievementIcon', () => {
  it('maps legacy upper-case names to Material Symbols ligatures', () => {
    expect(achievementIcon('FLAME')).toBe('local_fire_department')
    expect(achievementIcon('ZAP')).toBe('bolt')
  })

  it('lower-cases real ligature names and keeps them', () => {
    expect(achievementIcon('Military_Tech')).toBe('military_tech')
  })

  it('falls back when the icon is missing', () => {
    expect(achievementIcon('')).toBe('emoji_events')
    expect(achievementIcon(null, 'quiz')).toBe('quiz')
  })
})
