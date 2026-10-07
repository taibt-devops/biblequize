// "Khung Sáng" (light) tokens. Literal hex required — NEVER use `var(--bq-*)`
// here: known production bug where CSS vars render white on input/textarea
// elements. Values mirror the resolved bq palette in src/styles/tokens.css.
import type React from 'react'

export const COLOR = {
  bgDeep: '#FBFAF5',        // bq-paper (page)
  bgPanel: '#FFFFFF',       // bq-white (cards / panels / top bar)
  bgSection: '#FBFAF5',     // bq-paper (editor pane)
  inputBg: '#FFFFFF',       // bq-white (inputs)
  borderSubtle: '#C9B58C',  // bq-hairline
  borderXSubtle: '#C9B58C', // bq-hairline
  gold: '#D97F06',          // bq-amber-deep (contrast-safe accent on light)
  goldBg: 'rgba(245,158,11,0.10)',
  goldBgStrong: 'rgba(245,158,11,0.15)',
  goldBorder: 'rgba(245,158,11,0.30)',
  goldFocus: 'rgba(245,158,11,0.25)',
  success: '#2E7D4F',       // bq-emerald
  warning: '#F59E0B',       // bq-amber
  danger: '#B3452F',        // bq-ruby (error)
  textPrimary: '#1D2B22',   // bq-ink
  textSecondary: '#4D3A1F', // bq-ink-soft
  textMuted: '#4D3A1F',     // bq-ink-soft
  textDisabled: '#6B5530',  // bq-ink-faint
} as const

// Khung Sáng CTA — warm action gradient (mirrors --bq-action) + white text.
// Used for the primary "publish / save / generate / add" buttons that were
// solid gold on the dark theme.
export const ACTION_BG = 'linear-gradient(135deg, #FF9D2E 0%, #FF5A45 55%, #B3452F 100%)'
export const ACTION_BG_DISABLED = 'rgba(179,69,47,0.30)'
export const ACTION_FG = '#FFFFFF'
export const ACTION_SHADOW = '0 16px 34px -12px rgba(179,69,47,0.6), 0 4px 16px -6px rgba(245,158,11,0.55)'
// Neutral sunken fill (replaces translucent-white fills that vanish on paper).
export const INSET_BG = '#EFE3C3' // bq-paper-sunk

export const DARK_INPUT_STYLE: React.CSSProperties = {
  background: COLOR.inputBg,
  border: `1px solid ${COLOR.borderSubtle}`,
  color: COLOR.textPrimary,
  padding: '9px 12px',
  borderRadius: 7,
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

export const DARK_INPUT_FOCUS_STYLE: React.CSSProperties = {
  ...DARK_INPUT_STYLE,
  borderColor: COLOR.goldFocus,
}

export const DARK_TEXTAREA_STYLE: React.CSSProperties = {
  ...DARK_INPUT_STYLE,
  resize: 'none',
  lineHeight: 1.5,
}

export const DIFFICULTY_COLORS = {
  easy:   { bg: 'rgba(46,125,79,0.08)',  border: 'rgba(46,125,79,0.30)',  accent: '#2E7D4F', chip: 'rgba(46,125,79,0.12)' },
  medium: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.30)',  accent: '#D97F06', chip: 'rgba(245,158,11,0.14)' },
  hard:   { bg: 'rgba(179,69,47,0.08)',   border: 'rgba(179,69,47,0.30)',   accent: '#B3452F', chip: 'rgba(179,69,47,0.12)' },
} as const

// Canonical answer color mapping A/B/C/D per C2 (Coral / Sky / Gold / Sage),
// retuned for contrast on the light "Khung Sáng" surface.
export const ANSWER_OPTION_COLORS = [
  { letter: 'A', bg: 'rgba(179,69,47,0.12)',  text: '#B3452F', border: 'rgba(179,69,47,0.30)' },
  { letter: 'B', bg: 'rgba(47,111,176,0.12)',  text: '#2F6FB0', border: 'rgba(47,111,176,0.30)' },
  { letter: 'C', bg: 'rgba(245,158,11,0.14)', text: '#D97F06', border: 'rgba(245,158,11,0.30)' },
  { letter: 'D', bg: 'rgba(46,125,79,0.12)', text: '#2E7D4F', border: 'rgba(46,125,79,0.30)' },
] as const

export type DifficultyKey = keyof typeof DIFFICULTY_COLORS
