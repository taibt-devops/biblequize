export const colors = {
  // Background
  bgPrimary: '#11131e',
  bgSecondary: '#1a1d2e',
  bgCard: 'rgba(255,255,255,0.05)',

  // Surface (Material tiers)
  surface: '#11131e',
  surfaceContainer: '#1d1f2a',
  surfaceContainerLow: '#191b26',
  surfaceContainerHigh: '#272935',
  surfaceContainerHighest: '#323440',
  surfaceVariant: '#323440',

  // Accent (Sacred Modernist gold)
  gold: '#e8a832',
  goldLight: '#f0bc56',
  goldDark: '#c08818',
  secondary: '#f8bd45',
  tertiary: '#e7c268',

  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Text
  textPrimary: '#e1e1f1',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.4)',
  textDisabled: 'rgba(255,255,255,0.2)',
  onSecondary: '#412d00',

  // Border
  borderDefault: 'rgba(255,255,255,0.1)',
  borderActive: '#e8a832',
  outlineVariant: '#46464d',

  // Tier colors
  tierSpark: '#9ca3af',
  tierDawn: '#60a5fa',
  tierLamp: '#3b82f6',
  tierFlame: '#a855f7',
  tierStar: '#eab308',
  tierGlory: '#ef4444',

  // Answer Color Mapping (Quiz screen) — DESIGN_TOKENS.md "Game Mode Accent"
  // Vị trí cố định: A=top-left, B=top-right, C=bottom-left, D=bottom-right.
  answerA: '#E8826A', // Coral
  answerB: '#6AB8E8', // Sky
  answerC: '#E8C76A', // Gold
  answerD: '#7AB87A', // Sage
} as const
