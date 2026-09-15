import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhraseOrderExercise from '../PhraseOrderExercise'

// Synthetic text — not scripture.
const TEXT = 'w1 w2 w3 w4 w5 w6 w7'

const chunkButton = (label: string) =>
  screen.getAllByTestId('memorize-order-chunk').find(b => b.textContent === label)!

describe('PhraseOrderExercise', () => {
  it('shows every phrase in the bank, shuffled', () => {
    render(<PhraseOrderExercise text={TEXT} chunkSize={3} seed={1} onComplete={vi.fn()} />)
    const labels = screen.getAllByTestId('memorize-order-chunk').map(b => b.textContent)
    expect([...labels].sort()).toEqual(['w1 w2 w3', 'w4 w5 w6', 'w7'])
    expect(labels).not.toEqual(['w1 w2 w3', 'w4 w5 w6', 'w7'])
  })

  it('passes when phrases are tapped in order without mistakes', () => {
    const onComplete = vi.fn()
    render(<PhraseOrderExercise text={TEXT} chunkSize={3} seed={1} onComplete={onComplete} />)
    fireEvent.click(chunkButton('w1 w2 w3'))
    fireEvent.click(chunkButton('w4 w5 w6'))
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(chunkButton('w7'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ passed: true, mistakes: 0 })
    expect(screen.queryAllByTestId('memorize-order-chunk')).toHaveLength(0)
    expect(screen.getByText('w1 w2 w3 w4 w5 w6 w7')).toBeInTheDocument()
  })

  it('rejects a wrong phrase, counts the mistake and keeps it in the bank', () => {
    render(<PhraseOrderExercise text={TEXT} chunkSize={3} seed={1} onComplete={vi.fn()} />)
    fireEvent.click(chunkButton('w7'))
    expect(screen.getAllByTestId('memorize-order-chunk')).toHaveLength(3)
    expect(screen.getByText(/Số lần chọn sai: 1/)).toBeInTheDocument()
  })

  it('still passes with exactly one mistake, fails with two', () => {
    const once = vi.fn()
    const { unmount } = render(<PhraseOrderExercise text={TEXT} chunkSize={3} seed={1} onComplete={once} />)
    fireEvent.click(chunkButton('w7'))
    ;['w1 w2 w3', 'w4 w5 w6', 'w7'].forEach(l => fireEvent.click(chunkButton(l)))
    expect(once).toHaveBeenCalledWith({ passed: true, mistakes: 1 })
    unmount()

    const twice = vi.fn()
    render(<PhraseOrderExercise text={TEXT} chunkSize={3} seed={1} onComplete={twice} />)
    fireEvent.click(chunkButton('w7'))
    fireEvent.click(chunkButton('w4 w5 w6'))
    ;['w1 w2 w3', 'w4 w5 w6', 'w7'].forEach(l => fireEvent.click(chunkButton(l)))
    expect(twice).toHaveBeenCalledWith({ passed: false, mistakes: 2 })
  })

  it('treats identical phrase text as interchangeable', () => {
    const onComplete = vi.fn()
    render(<PhraseOrderExercise text="a b a b" chunkSize={2} seed={3} onComplete={onComplete} />)
    fireEvent.click(screen.getAllByTestId('memorize-order-chunk')[1])
    fireEvent.click(screen.getAllByTestId('memorize-order-chunk')[0])
    expect(onComplete).toHaveBeenCalledWith({ passed: true, mistakes: 0 })
  })
})
