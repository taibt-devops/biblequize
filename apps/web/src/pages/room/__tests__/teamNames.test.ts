import { describe, it, expect } from 'vitest'
import { teamPair, TEAM_PAIRS } from '../teamNames'

describe('teamPair (PCV-14 — tên đội theo phòng)', () => {
  it('mọi máy ra cùng một cặp cho cùng một phòng', () => {
    expect(teamPair('room-abc', 'vi')).toEqual(teamPair('room-abc', 'vi'))
  })

  it('cặp tên lấy từ danh sách nhân vật Kinh Thánh', () => {
    const p = teamPair('room-abc', 'vi')!
    expect(TEAM_PAIRS.some(x => x.vi[0] === p.A && x.vi[1] === p.B)).toBe(true)
  })

  it('tiếng Anh dùng tên tiếng Anh của cùng cặp', () => {
    const vi = teamPair('room-xyz', 'vi')!
    const en = teamPair('room-xyz', 'en')!
    const pair = TEAM_PAIRS.find(x => x.vi[0] === vi.A)!
    expect(en).toEqual({ A: pair.en[0], B: pair.en[1] })
  })

  it('các phòng khác nhau dùng được nhiều cặp', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) seen.add(teamPair(`room-${i}`, 'vi')!.A)
    expect(seen.size).toBeGreaterThan(3)
  })

  it('chưa có mã phòng thì không có tên', () => {
    expect(teamPair(undefined, 'vi')).toBeNull()
  })
})
