import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBattleRoyale } from '../useBattleRoyale'

describe('useBattleRoyale — bóng + hồi sinh (PCV-13)', () => {
  it('bị loại → màn bị loại; bấm tiếp → làm bóng; hồi sinh → chơi lại như thường', () => {
    const { result } = renderHook(() => useBattleRoyale('me'))
    act(() => result.current.handleEvent({ type: 'PLAYER_ELIMINATED', data: { userId: 'me', username: 'Tôi', rank: 4, activeRemaining: 3 } } as never))
    expect(result.current.state.isEliminated).toBe(true)
    expect(result.current.state.showEliminationScreen).toBe(true)

    act(() => result.current.spectate())
    expect(result.current.state.isSpectator).toBe(true)

    act(() => result.current.handleEvent({ type: 'PLAYER_REVIVED', data: { userId: 'me', username: 'Tôi', activeRemaining: 4 } } as never))
    expect(result.current.state.isEliminated).toBe(false)
    expect(result.current.state.isSpectator).toBe(false)
    expect(result.current.state.myRank).toBeNull()
    expect(result.current.state.activeCount).toBe(4)
    expect(result.current.state.toasts.some(t => t.kind === 'revived')).toBe(true)
  })

  it('người khác hồi sinh: chỉ hiện thông báo', () => {
    const { result } = renderHook(() => useBattleRoyale('me'))
    act(() => result.current.handleEvent({ type: 'PLAYER_REVIVED', data: { userId: 'an', username: 'An', activeRemaining: 5 } } as never))
    expect(result.current.state.isEliminated).toBe(false)
    const toast = result.current.state.toasts.find(t => t.kind === 'revived')
    expect(toast?.username).toBe('An')
  })
})
