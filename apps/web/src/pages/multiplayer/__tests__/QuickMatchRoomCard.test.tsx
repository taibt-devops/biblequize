import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import QuickMatchRoomCard from '../QuickMatchRoomCard'
import type { PublicRoom } from '../types'

const room = {
  id: 'r1', roomCode: 'ABC123', roomName: 'Phòng Đấu Nhanh', mode: 'SPEED_RACE', status: 'LOBBY', isPublic: true,
  currentPlayers: 2, maxPlayers: 10, questionCount: 10, timePerQuestion: 20, difficulty: 'MIXED', bookScope: 'ALL',
  hostName: 'Minh', createdAt: '2026-10-13T00:00:00', playerInitials: ['M', 'L'], quickMatch: true,
  questionSource: 'AI_GENERATED',
} as unknown as PublicRoom

/** AIR-1 (13/10/2026): không còn câu do AI sinh — thẻ phòng không còn nhãn AI, kể cả phòng cũ. */
describe('QuickMatchRoomCard', () => {
  it('không còn nhãn "AI gen câu hỏi"', () => {
    render(<MemoryRouter><QuickMatchRoomCard room={room} /></MemoryRouter>)
    expect(screen.queryByText('AI gen câu hỏi')).toBeNull()
    expect(screen.getByText('Server điều phối')).toBeInTheDocument()
  })
})
