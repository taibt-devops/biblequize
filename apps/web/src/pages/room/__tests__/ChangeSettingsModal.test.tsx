import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ChangeSettingsModal from '../ChangeSettingsModal'

const current = { mode: 'SPEED_RACE', questionCount: 10, timePerQuestion: 30, difficulty: 'MIXED' }

describe('ChangeSettingsModal (PCV-18 — đổi cách chơi trong sảnh)', () => {
  it('chọn mode, số câu, thời gian rồi lưu', () => {
    const onSave = vi.fn()
    render(<ChangeSettingsModal current={current} playerCount={4} onClose={vi.fn()} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('settings-mode-BATTLE_ROYALE'))
    fireEvent.change(screen.getByTestId('settings-question-count'), { target: { value: '15' } })
    fireEvent.change(screen.getByTestId('settings-time'), { target: { value: '20' } })
    fireEvent.change(screen.getByTestId('settings-difficulty'), { target: { value: 'HARD' } })
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith({ mode: 'BATTLE_ROYALE', questionCount: 15, timePerQuestion: 20, difficulty: 'HARD' })
  })

  it('mặc định là cài đặt hiện tại của phòng', () => {
    render(<ChangeSettingsModal current={{ ...current, questionCount: 20 }} playerCount={4} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByTestId('settings-mode-SPEED_RACE').getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByTestId('settings-question-count') as HTMLSelectElement).value).toBe('20')
  })

  it('Đấu vương bị khóa khi phòng quá 12 người', () => {
    render(<ChangeSettingsModal current={current} playerCount={13} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByTestId('settings-mode-SUDDEN_DEATH')).toBeDisabled()
  })
})
