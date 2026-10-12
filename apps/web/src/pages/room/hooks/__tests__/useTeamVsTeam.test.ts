import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTeamVsTeam } from '../useTeamVsTeam'

describe('useTeamVsTeam — Hội ý (PCV-22)', () => {
  it('phiếu đồng đội gom theo câu, sang câu mới thì xoá', () => {
    const { result } = renderHook(() => useTeamVsTeam('me', 'A'))
    act(() => result.current.handleEvent({ type: 'TEAM_VOTE', data: { playerId: 'an', username: 'An', answerIndex: 2 } } as never))
    act(() => result.current.handleEvent({ type: 'TEAM_VOTE', data: { playerId: 'binh', username: 'Bình', answerIndex: 0 } } as never))
    expect(result.current.state.teamVotes).toEqual({ an: { username: 'An', answerIndex: 2 }, binh: { username: 'Bình', answerIndex: 0 } })

    act(() => result.current.handleEvent({ type: 'QUESTION_START', data: { questionIndex: 1 } } as never))
    expect(result.current.state.teamVotes).toEqual({})
  })

  it('chat đội nối tiếp, đáp án hai đội lấy từ ROUND_END', () => {
    const { result } = renderHook(() => useTeamVsTeam('me', 'A'))
    act(() => result.current.handleEvent({ type: 'TEAM_CHAT', data: { senderId: 'an', sender: 'An', text: 'chọn C' } } as never))
    expect(result.current.state.teamChat).toEqual([{ senderId: 'an', sender: 'An', text: 'chọn C' }])

    act(() => result.current.handleEvent({ type: 'ROUND_END', data: { correctIndex: 2, leaderboard: [], teamAnswers: { A: 2, B: null } } } as never))
    expect(result.current.state.teamAnswers).toEqual({ A: 2, B: null })
  })
})
