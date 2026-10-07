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
  /** QM-4: when true, mobile (<md) uses compact size (44px min-h, smaller
   *  padding/letter/text) — used when the question is very long so answers
   *  don't push content off-screen. Desktop layout is unchanged either way. */
  compact?: boolean
  /** Multiplayer reveal context (mockup state ②/④). When true on a
   *  `correct` state, renders the "✓ ĐÚNG · BẠN CHỌN" badge instead of
   *  the bare "✓ ĐÁP ÁN" badge. Defaults to true so single-player flows
   *  (where the user is always the picker) keep their existing label. */
  pickedByUser?: boolean
}

// Per-position color classes. Tailwind JIT needs literal class strings, so we
// cannot template `bg-answer-${color}` — every variant must appear here as a
// real string. Storybook (LK) (LKD-12): each answer is a solid C5-coloured signboard
// with an ink outline; colours stay exactly as locked by C5.
const COLORS = [
  { btn: 'bg-answer-a', faded: 'bg-answer-a/40' }, // 0 = A → Coral
  { btn: 'bg-answer-b', faded: 'bg-answer-b/40' }, // 1 = B → Sky
  { btn: 'bg-answer-c', faded: 'bg-answer-c/40' }, // 2 = C → Gold
  { btn: 'bg-answer-d', faded: 'bg-answer-d/40' }, // 3 = D → Sage
] as const

/** Soft halos drawn around the hard ink shadow on reveal. */
const HALO_CORRECT = '0 5px 0 #1D2B22, 0 0 0 6px rgba(255,243,176,1), 0 0 26px 10px rgba(255,226,120,0.85)'
const HALO_WRONG = '0 5px 0 #1D2B22, 0 0 0 6px rgba(255,179,160,1)'

export const AnswerButton: React.FC<AnswerButtonProps> = ({
  index,
  letter,
  text,
  state,
  onClick,
  testId,
  compact = false,
  pickedByUser = true,
}) => {
  const color = COLORS[index]
  const isInteractive = state === 'default' || state === 'selected'

  let btnClasses: string
  let letterClasses = 'bg-bq-white text-bq-ink'
  let letterContent: React.ReactNode = letter
  let textClasses = 'text-bq-ink'
  let trailingIcon: React.ReactNode = null
  let inlineStyle: React.CSSProperties | undefined

  switch (state) {
    case 'default':
      btnClasses = clsx(color.btn, 'hover:brightness-105')
      break
    case 'selected':
      // Awaiting reveal: the board stays pressed down with an ink ring.
      btnClasses = clsx(color.btn, 'translate-y-1 ring-2 ring-bq-ink ring-offset-2 ring-offset-bq-paper gold-glow')
      break
    case 'correct':
      // Reveal: gold halo + green tick chip + text badge (never colour alone).
      btnClasses = clsx('answer-correct-anim', color.btn)
      letterClasses = 'bg-bq-white text-bq-emerald font-black'
      letterContent = '✓'
      inlineStyle = { boxShadow: HALO_CORRECT }
      trailingIcon = (
        <span className="text-[11px] font-extrabold whitespace-nowrap px-2 py-0.5 rounded-full bg-bq-white border-2 border-bq-ink text-bq-emerald">
          ✓ {pickedByUser ? 'ĐÚNG · BẠN CHỌN' : 'ĐÁP ÁN'}
        </span>
      )
      break
    case 'wrong':
      btnClasses = clsx('answer-wrong-anim', color.btn)
      letterClasses = 'bg-bq-white text-bq-ruby font-black'
      letterContent = '✗'
      inlineStyle = { boxShadow: HALO_WRONG }
      trailingIcon = (
        <span className="text-[11px] font-extrabold whitespace-nowrap px-2 py-0.5 rounded-full bg-bq-white border-2 border-bq-ink text-bq-ruby">
          ✗ BẠN CHỌN
        </span>
      )
      break
    case 'eliminated':
      btnClasses = clsx(color.faded, 'opacity-40 pointer-events-none shadow-none')
      letterClasses = 'bg-bq-white text-bq-ink line-through opacity-60'
      textClasses = 'text-bq-ink2 line-through'
      trailingIcon = (
        <span
          className="material-symbols-outlined text-bq-ink2 text-2xl opacity-60"
          aria-hidden="true"
        >
          close
        </span>
      )
      break
    case 'disabled':
    default:
      // Non-picked options after reveal: same board, dimmed + desaturated so
      // the text stays readable on the painted background.
      btnClasses = clsx(color.btn, 'opacity-50 saturate-[.65]')
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
      data-compact={compact || undefined}
      className={clsx(
        'group relative flex items-center rounded-[18px] md:rounded-[20px] border-[3px] border-bq-ink shadow-bq-btn',
        'transition-all duration-150 text-left active:translate-y-1 active:shadow-bq-btn-down',
        compact
          ? 'gap-2.5 md:gap-4 p-2.5 md:p-4 min-h-[44px] md:min-h-[64px]'
          : 'gap-3 md:gap-4 px-3.5 py-2 md:px-5 md:py-4 min-h-[56px] md:min-h-[82px]',
        btnClasses,
      )}
      style={inlineStyle}
    >
      <div
        className={clsx(
          'flex items-center justify-center rounded-full border-[3px] border-bq-ink',
          'font-extrabold flex-shrink-0',
          compact ? 'w-8 h-8 md:w-10 md:h-10 text-sm md:text-lg' : 'w-9 h-9 md:w-[46px] md:h-[46px] text-lg md:text-[22px]',
          letterClasses,
        )}
      >
        {letterContent}
      </div>
      <span className={clsx(
        'flex-1 font-bold leading-snug',
        compact ? 'text-[16px] md:text-[20px]' : 'text-[20px] md:text-[24px]',
        textClasses,
      )}>
        {text}
      </span>
      {trailingIcon && (
        <div className="flex-shrink-0">{trailingIcon}</div>
      )}
    </button>
  )
}

export default AnswerButton
