import React from 'react'
import { clsx } from 'clsx'

interface CircularTimerProps {
  /** Seconds remaining on the current question. */
  secondsLeft: number
  /** Total seconds for the question (used to compute the arc fill). */
  totalSeconds: number
  /** Outer size in px (square). Defaults to 80 to match the mockup. */
  size?: number
  /** Optional testId — applied to the visible number span (matches the
   *  existing `quiz-timer` E2E selector). */
  testId?: string
}

const STROKE_WIDTH = 5

/**
 * Map seconds-left to one of four urgency colours per BUG_REPORT_QUIZ.md
 * QZ-P0-3:
 *   - > 10s    → gold   (#e8a832) — calm
 *   - 6 to 10s → yellow (#eab308) — heads-up
 *   - 4 to 5s  → orange (#ff8c42) — warning
 *   - ≤ 3s     → red    (#ef4444) — critical (paired with pulse anim)
 */
export function colorForSeconds(seconds: number): string {
  if (seconds > 10) return '#e8a832'
  if (seconds > 5) return '#eab308'
  if (seconds > 3) return '#ff8c42'
  return '#ef4444'
}

/** Map seconds-left to one of two pulse-animation classes from
 *  global.css, or empty string when no animation should play. */
export function urgencyAnimClass(seconds: number): string {
  if (seconds <= 3) return 'timer-critical-anim'
  if (seconds <= 5) return 'timer-warning-anim'
  return ''
}

/**
 * Circular countdown ring with 4 colour bands + pulse animations.
 * Used in Quiz.tsx (single-player); a future RoomQuiz refactor can
 * adopt the same component for multiplayer parity.
 *
 * The track + progress circles share `r = size/2 - strokeWidth - 1`,
 * and the progress arc length is driven by `strokeDasharray` (full
 * circumference) + `strokeDashoffset` (proportional to time left).
 * Animations come from global.css (.timer-arc transition, .timer-svg
 * rotate, .timer-warning-anim / .timer-critical-anim pulses).
 */
export const CircularTimer: React.FC<CircularTimerProps> = ({
  secondsLeft,
  totalSeconds,
  size = 80,
  testId,
}) => {
  const radius = size / 2 - STROKE_WIDTH - 1
  const circumference = 2 * Math.PI * radius

  // Defensive: clamp ratio to [0, 1]. totalSeconds <= 0 → treat ring
  // as full (avoid divide-by-zero NaN producing strokeDashoffset=NaN).
  const ratio =
    totalSeconds > 0
      ? Math.max(0, Math.min(1, secondsLeft / totalSeconds))
      : 1
  const offset = circumference * (1 - ratio)

  const color = colorForSeconds(secondsLeft)
  const animClass = urgencyAnimClass(secondsLeft)

  return (
    <div
      className={clsx('relative flex items-center justify-center', animClass)}
      style={{ width: size, height: size }}
    >
      <svg
        className="timer-svg w-full h-full"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress arc */}
        <circle
          className="timer-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        data-testid={testId}
        className="absolute font-medium leading-none"
        style={{ color, fontSize: size * 0.3 }}
      >
        {secondsLeft}
      </span>
    </div>
  )
}

export default CircularTimer
