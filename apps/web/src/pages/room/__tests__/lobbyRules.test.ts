import { describe, it, expect } from 'vitest'
import { lobbyStartCheck } from '../lobbyRules'

type P = { userId: string; isReady: boolean; team?: string }
const players = (n: number, ready = true, startAt = 0): P[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${i + startAt}`, isReady: ready }))
const team = (a: number, b: number): P[] => [
  ...Array.from({ length: a }, (_, i) => ({ userId: `a${i}`, isReady: true, team: 'A' })),
  ...Array.from({ length: b }, (_, i) => ({ userId: `b${i}`, isReady: true, team: 'B' })),
]

describe('lobbyStartCheck (PCV-5 — giống RoomModeRules phía máy chủ)', () => {
  it('Đua tốc độ: 2 người là đủ (chủ phòng chơi cùng)', () => {
    const r = lobbyStartCheck({ mode: 'SPEED_RACE', players: players(2), hostId: 'u0', hostPlaysGame: true, quickMatch: false })
    expect(r.canStart).toBe(true)
  })

  it('Sinh tồn: 2 người chưa đủ, báo cần thêm 1', () => {
    const r = lobbyStartCheck({ mode: 'BATTLE_ROYALE', players: players(2), hostId: 'u0', hostPlaysGame: true, quickMatch: false })
    expect(r.canStart).toBe(false)
    expect(r.reason).toBe('room.lobbyRules.needPlayers')
    expect(r.params).toMatchObject({ need: 1, min: 3 })
  })

  it('Quản trò không tính vào số người chơi', () => {
    const r = lobbyStartCheck({ mode: 'SUDDEN_DEATH', players: players(2, true, 1), hostId: 'host', hostPlaysGame: false, quickMatch: false })
    expect(r.canStart).toBe(false)
    expect(r.params).toMatchObject({ need: 1 })
  })

  it('Đội đấu đội: đội lệch 2 người thì không bắt đầu được', () => {
    const r = lobbyStartCheck({ mode: 'TEAM_VS_TEAM', players: team(4, 2), hostId: 'a0', hostPlaysGame: true, quickMatch: false })
    expect(r.canStart).toBe(false)
    expect(r.reason).toBe('room.lobbyRules.teamsUnbalanced')
    expect(r.params).toMatchObject({ diff: 2 })
  })

  it('Đội đấu đội: một đội dưới 2 người', () => {
    const r = lobbyStartCheck({ mode: 'TEAM_VS_TEAM', players: team(3, 1), hostId: 'a0', hostPlaysGame: true, quickMatch: false })
    expect(r.reason).toBe('room.lobbyRules.teamTooSmall')
  })

  it('đủ người nhưng còn người chưa sẵn sàng (không tính chủ phòng)', () => {
    const ps = players(3)
    ps[0].isReady = false // chủ phòng — được coi là sẵn sàng
    ps[2].isReady = false
    const r = lobbyStartCheck({ mode: 'SPEED_RACE', players: ps, hostId: 'u0', hostPlaysGame: true, quickMatch: false })
    expect(r.canStart).toBe(false)
    expect(r.reason).toBe('room.lobbyRules.waitingReady')
    expect(r.params).toMatchObject({ ready: 1, total: 2 })
  })

  it('Chơi cùng nhau không cần sẵn sàng', () => {
    const r = lobbyStartCheck({ mode: 'GROUP_LIVE_SEQUENTIAL', players: players(2, false), hostId: 'h', hostPlaysGame: false, quickMatch: false })
    expect(r.canStart).toBe(true)
  })

  it('Đấu nhanh: người bấm được coi là sẵn sàng, những người khác phải sẵn sàng', () => {
    const ps = players(3, true)
    ps[1].isReady = false
    const r = lobbyStartCheck({ mode: 'SPEED_RACE', players: ps, hostId: 'u0', hostPlaysGame: true, quickMatch: true, viewerUserId: 'u1' })
    expect(r.canStart).toBe(true)
    const r2 = lobbyStartCheck({ mode: 'SPEED_RACE', players: ps, hostId: 'u0', hostPlaysGame: true, quickMatch: true, viewerUserId: 'u2' })
    expect(r2.canStart).toBe(false)
  })
})
