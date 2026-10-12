import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LiveNowBanner from '../LiveNowBanner'

const mockGet = vi.fn()
vi.mock('../../../api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: vi.fn() },
}))

const room = (mode: string) => ({
  id: 'r1', roomCode: 'AAA111', roomName: 'Phòng nhóm', mode, status: 'LOBBY',
  currentPlayers: 3, maxPlayers: 8, createdAt: new Date().toISOString(), hostName: 'An',
})

describe('LiveNowBanner — PCV-9 tên mode thống nhất', () => {
  beforeEach(() => mockGet.mockReset())

  it('Đấu vương hiện ⚔️ + tên tiếng Việt, không còn "Battle Royale"/"👑"', async () => {
    mockGet.mockResolvedValue({ data: { success: true, rooms: [room('SUDDEN_DEATH')] } })
    render(<MemoryRouter><LiveNowBanner groupId="g1" /></MemoryRouter>)
    const banner = await screen.findByTestId('group-live-now-banner')
    expect(banner.textContent).toContain('⚔️ Đấu vương')
  })

  it('mã cũ SEQUENTIAL hiện là Chơi cùng nhau', async () => {
    mockGet.mockResolvedValue({ data: { success: true, rooms: [room('SEQUENTIAL')] } })
    render(<MemoryRouter><LiveNowBanner groupId="g1" /></MemoryRouter>)
    const banner = await screen.findByTestId('group-live-now-banner')
    expect(banner.textContent).toContain('📚 Chơi cùng nhau')
    expect(banner.textContent).not.toContain('Sequential')
  })
})
