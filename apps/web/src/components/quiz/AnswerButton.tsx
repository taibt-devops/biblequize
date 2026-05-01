import React from 'react'
import { clsx } from 'clsx'

export type AnswerState =
  | 'default'      // not picked, before reveal
  | 'selected'     // user picked, awaiting reveal
  | 'correct'      // showResult: this option is the correct answer
  | 'wrong'        // showResult: user picked this and it was wrong
  | 'eliminated'   // hint lifeline removed this option
  | 'disabled'     // showResult: not the correct answer, not user's wrong pick

interface AnswerButtonProps {
  index: 0 | 1 | 2 | 3
  letter: 'A' | 'B' | 'C' | 'D'
  text: string
  state: AnswerState
  onClick?: () => void
  testId?: string
}

// Per-position color classes. Tailwind JIT needs literal class strings, so we
// cannot template `bg-answer-${color}` — every variant must appear here as a
// real string.
const COLORS = [
  // 0 = A → Coral
  {
    btnDefault: 'border-answer-a/30 bg-answer-a/10 hover:bg-answer-a/20',
    btnSelected: 'border-answer-a bg-answer-a/20 ring-2 ring-answer-a/40',
    btnFaded: 'border-answer-a/15 bg-answer-a/5',
    letterDefault: 'bg-answer-a/20 text-answer-a',
    letterSelected: 'bg-answer-a/30 text-answer-a',
  },
  // 1 = B → Sky
  {
    btnDefault: 'border-answer-b/30 bg-answer-b/10 hover:bg-answer-b/20',
    btnSelected: 'border-answer-b bg-answer-b/20 ring-2 ring-answer-b/40',
    btnFaded: 'border-answer-b/15 bg-answer-b/5',
    letterDefault: 'bg-answer-b/20 text-answer-b',
    letterSelected: 'bg-answer-b/30 text-answer-b',
  },
  // 2 = C → Gold (warmer than primary gold)
  {
    btnDefault: 'border-answer-c/30 bg-answer-c/10 hover:bg-answer-c/20',
    btnSelected: 'border-answer-c bg-answer-c/20 ring-2 ring-answer-c/40',
    btnFaded: 'border-answer-c/15 bg-answer-c/5',
    letterDefault: 'bg-answer-c/20 text-answer-c',
    letterSelected: 'bg-answer-c/30 text-answer-c',
  },
  // 3 = D → Sage
  {
    btnDefault: 'border-answer-d/30 bg-answer-d/10 hover:bg-answer-d/20',
    btnSelected: 'border-answer-d bg-answer-d/20 ring-2 ring-answer-d/40',
    btnFaded: 'border-answer-d/15 bg-answer-d/5',
    letterDefault: 'bg-answer-d/20 text-answer-d',
    letterSelected: 'bg-answer-d/30 text-answer-d',
  },
] as const

const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const

export const AnswerButton: React.FC<AnswerButtonProps> = ({
  index,
  letter,
  text,
  state,
  onClick,
  testId,
}) => {
  const color = COLORS[index]
  const isInteractive = state === 'default' || state === 'selected'

  let btnClasses: string
  let letterClasses: string
  let textClasses: string
  let trailingIcon: React.ReactNode = null

  switch (state) {
    case 'default':
      btnClasses = color.btnDefault
      letterClasses = color.letterDefault
      textClasses = 'text-on-surface'
      break
    case 'selected':
      btnClasses = clsx(color.btnSelected, 'gold-glow')
      letterClasses = color.letterSelected
      textClasses = 'text-on-surface'
      break
    case 'correct':
      btnClasses = 'border-green-500 bg-green-500/15 ring-2 ring-green-500/40 answer-correct-anim'
      letterClasses = 'bg-green-500 text-on-secondary shadow-lg'
      textClasses = 'text-green-400'
      trailingIcon = (
        <span
          className="material-symbols-outlined text-green-400 text-2xl"
          style={FILL_STYLE}
          aria-hidden="true"
        >
          check_circle
        </span>
      )
      break
    case 'wrong':
      btnClasses = 'border-error bg-error/15 answer-wrong-anim'
      letterClasses = 'bg-error text-on-secondary shadow-lg'
      textClasses = 'text-error'
      trailingIcon = (
        <span
          className="material-symbols-outlined text-error text-2xl"
          style={FILL_STYLE}
          aria-hidden="true"
        >
          cancel
        </span>
      )
      break
    case 'eliminated':
      btnClasses = clsx(color.btnFaded, 'opacity-40 pointer-events-none')
      letterClasses = clsx(color.letterDefault, 'line-through opacity-60')
      textClasses = 'text-on-surface-variant line-through'
      trailingIcon = (
        <span
          className="material-symbols-outlined text-on-surface-variant text-2xl opacity-60"
          aria-hidden="true"
        >
          close
        </span>
      )
      break
    case 'disabled':
    default:
      btnClasses = clsx(color.btnFaded, 'opacity-60')
      letterClasses = clsx(color.letterDefault, 'opacity-70')
      textClasses = 'text-on-surface-variant'
      break
  }

  return (
    <button
      type="button"
      data-testid={testId}
      data-answer-index={index}
      data-answer-state={state}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      aria-disabled={!isInteractive}
      className={clsx(
        'group relative flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2',
        'transition-all duration-200 text-left active:scale-[0.98]',
        'min-h-[64px]',
        btnClasses,
      )}
    >
      <div
        className={clsx(
          'w-9 h-9 flex items-center justify-center rounded-lg',
          'font-medium text-base flex-shrink-0',
          letterClasses,
        )}
      >
        {letter}
      </div>
      <span className={clsx('flex-1 font-medium text-sm md:text-base leading-snug', textClasses)}>
        {text}
      </span>
      {trailingIcon && (
        <div className="flex-shrink-0">{trailingIcon}</div>
      )}
    </button>
  )
}

export default AnswerButton
