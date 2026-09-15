import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ClozeExercise from '../ClozeExercise'
import { normalizeWord, tokenize } from '../../../utils/memorize/exercises'

// Synthetic text — not scripture.
const TEXT = 'alpha, beta gamma delta; epsilon zeta.'
const TOKENS = tokenize(TEXT)

const blankIndices = () =>
  screen.queryAllByTestId('memorize-cloze-blank').map(b => Number(b.getAttribute('data-index')))
const word = (w: string) => screen.getAllByTestId('memorize-cloze-word').find(b => b.textContent === w)!
const fillAll = () => blankIndices().forEach(i => fireEvent.click(word(normalizeWord(TOKENS[i]))))

describe('ClozeExercise', () => {
  it('hides round(ratio × words) and offers answers plus two context distractors', () => {
    render(<ClozeExercise text={TEXT} ratio={0.5} seed={4} contextText="omega sigma alpha" onComplete={vi.fn()} />)
    const blanks = blankIndices()
    expect(blanks).toHaveLength(3)
    const bank = screen.getAllByTestId('memorize-cloze-word').map(b => b.textContent)
    blanks.forEach(i => expect(bank).toContain(normalizeWord(TOKENS[i])))
    expect(bank).toHaveLength(5)
    expect(bank).toEqual(expect.arrayContaining(['omega', 'sigma']))
  })

  it('passes when every blank is filled correctly, revealing the words', () => {
    const onComplete = vi.fn()
    render(<ClozeExercise text={TEXT} ratio={0.5} seed={4} onComplete={onComplete} />)
    fillAll()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ passed: true, mistakes: 0 })
    expect(screen.queryAllByTestId('memorize-cloze-blank')).toHaveLength(0)
  })

  it('counts a wrong word and keeps the blank open', () => {
    render(<ClozeExercise text={TEXT} ratio={0.5} seed={4} contextText="omega sigma" onComplete={vi.fn()} />)
    fireEvent.click(word('omega'))
    expect(blankIndices()).toHaveLength(3)
    expect(screen.getByText(/Số lần chọn sai: 1/)).toBeInTheDocument()
  })

  it('fails when mistakes exceed max(1, 10% of blanks)', () => {
    const onComplete = vi.fn()
    render(<ClozeExercise text={TEXT} ratio={1} seed={4} contextText="omega sigma" onComplete={onComplete} />)
    fireEvent.click(word('omega'))
    fireEvent.click(word('sigma'))
    fillAll()
    expect(onComplete).toHaveBeenCalledWith({ passed: false, mistakes: 2 })
  })

  it('tapping a later blank makes it the active target', () => {
    const onComplete = vi.fn()
    render(<ClozeExercise text={TEXT} ratio={1} seed={4} onComplete={onComplete} />)
    const last = screen.getAllByTestId('memorize-cloze-blank').at(-1)!
    fireEvent.click(last)
    expect(last).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(word('zeta'))
    expect(blankIndices()).not.toContain(TOKENS.length - 1)
    expect(screen.getByText('zeta.')).toBeInTheDocument()
  })
})
