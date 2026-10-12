import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSuddenDeath } from '../useSuddenDeath'

const matchStart = (matchNo: number, championId = 'king', challengerId = 'chall') => ({
  type: 'MATCH_START',
  data: { championId, championName: 'Vua', championStreak: 1, challengerId, challengerName: 'Thách', queueRemaining: 2, matchNo },
}) as never

describe('useSuddenDeath — khán giả đoán (PCV-16)', () => {
  it('khán giả: mở cửa sổ đoán khi trận bắt đầu, đóng khi câu đầu tiên tới', () => {
    const { result } = renderHook(() => useSuddenDeath('fan'))
    act(() => result.current.handleEvent(matchStart(3)))
    expect(result.current.state.sdMatchNo).toBe(3)
    expect(result.current.state.predictionOpen).toBe(true)

    act(() => result.current.choosePrediction('chall'))
    expect(result.current.state.myPick).toBe('chall')

    act(() => result.current.handleEvent({ type: 'QUESTION_START', data: { questionIndex: 4 } } as never))
    expect(result.current.state.predictionOpen).toBe(false)
    expect(result.current.state.myPick).toBe('chall')
  })

  it('người đang đấu không có cửa sổ đoán', () => {
    const { result } = renderHook(() => useSuddenDeath('king'))
    act(() => result.current.handleEvent(matchStart(1)))
    expect(result.current.state.predictionOpen).toBe(false)
  })

  it('kết quả đoán: đúng thì cộng điểm đoán của mình', () => {
    const { result } = renderHook(() => useSuddenDeath('fan'))
    act(() => result.current.handleEvent(matchStart(2)))
    act(() => result.current.choosePrediction('king'))
    act(() => result.current.handleEvent({ type: 'PREDICTION_RESULT', data: { matchNo: 2, winnerId: 'king', correctUserIds: ['fan'] } } as never))
    expect(result.current.state.lastPredictionCorrect).toBe(true)
    expect(result.current.state.myPredictionPoints).toBe(1)

    act(() => result.current.handleEvent(matchStart(3)))
    expect(result.current.state.myPick).toBeNull()
    expect(result.current.state.lastPredictionCorrect).toBeNull()
  })
})
