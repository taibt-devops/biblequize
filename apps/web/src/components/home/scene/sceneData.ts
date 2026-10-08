/**
 * Home scene data (LKF-3, Lu Khach "living signboards" mockup v4). Pure values and helpers so the
 * scene components stay declarative and testable. Positions are % of the 3:2 painting
 * (/images/lk/bq-home-bare*.webp); the three paintings share one composition.
 */
export type TimeOfDay = 'day' | 'sunset' | 'night'

/** Day 5h-17h, sunset 17h-19h, night 19h-5h (local time). */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'sunset'
  return 'night'
}

export const SCENE_IMAGE: Record<TimeOfDay, string> = {
  day: '/images/lk/bq-home-bare.webp',
  sunset: '/images/lk/bq-home-bare-sunset.webp',
  night: '/images/lk/bq-home-bare-night.webp',
}

/** The same paintings extended left and right (3:1 panorama, the 3:2 core in the middle) so wide
 *  screens are filled with countryside instead of margins. Desktop only. */
export const SCENE_WIDE: Record<TimeOfDay, string> = {
  day: '/images/lk/bq-home-wide.webp',
  sunset: '/images/lk/bq-home-wide-sunset.webp',
  night: '/images/lk/bq-home-wide-night.webp',
}

export type SignMode = 'study' | 'ranked' | 'rooms' | 'journey'

export interface SignBoard {
  mode: SignMode
  to: string
  /** Which way the arrow points. */
  side: 'left' | 'right'
  labelKey: string
  /** What the traveller says while the board is hovered / focused. */
  goKey: string
  emblem: string
  /** Centre of the board (% of the painting), width (% of the painting width), tilt (deg). */
  x: number
  y: number
  w: number
  tilt: number
}

// The painted post spans x 79.1-83.1 %. Nails sit ~10 % in from a board's flat end, so a
// left-pointing board centred at 81.1 - 0.4w (right-pointing: 81.1 + 0.4w) hangs on the post.
export const SIGN_BOARDS: SignBoard[] = [
  { mode: 'study', to: '/practice', side: 'left', labelKey: 'gameModes.practice', goKey: 'home.lk.goStudy',
    emblem: '/images/lk/scroll.webp', x: 74.3, y: 24.6, w: 17, tilt: -4 },
  { mode: 'ranked', to: '/ranked', side: 'right', labelKey: 'gameModes.ranked', goKey: 'home.lk.goRanked',
    emblem: '/images/lk/sword.webp', x: 88.0, y: 34.4, w: 17.4, tilt: -5 },
  { mode: 'rooms', to: '/multiplayer', side: 'left', labelKey: 'gameModes.rooms', goKey: 'home.lk.goRooms',
    emblem: '/images/lk/heart.webp', x: 74.7, y: 44.4, w: 16, tilt: -3 },
  { mode: 'journey', to: '/journey', side: 'right', labelKey: 'home.signpost.journey', goKey: 'home.lk.goJourney',
    emblem: '/images/lk/icon-map.webp', x: 87.5, y: 54.2, w: 16, tilt: 4 },
]

export const BOARD_IMAGE = { left: '/images/lk/sign-board-b.webp', right: '/images/lk/sign-board-a.webp' }

/** Glowing footprints from the traveller's feet to the foot of the post (% of the painting). */
export const FOOTPRINTS = {
  desktop: [[53.6, 93.0], [57.6, 90.1], [61.6, 90.4], [65.6, 87.4], [69.6, 87.7], [73.6, 84.8]],
  phone: [[59.6, 93.0], [62.6, 90.1], [65.6, 90.4], [68.6, 87.4], [71.6, 87.7], [74.6, 84.8]],
}

/** Whole days left until an ISO date (yyyy-mm-dd), or null when unknown / already over. */
export function daysLeft(endDate: string | undefined | null, now: Date = new Date()): number | null {
  if (!endDate) return null
  const end = new Date(`${endDate.slice(0, 10)}T23:59:59`)
  if (Number.isNaN(end.getTime())) return null
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
  return days > 0 ? days : null
}

export type LanternState = 'lit' | 'burning' | 'dark'

/** A quest's lantern: lit when done, burning while in progress, dark before it starts. */
export function lanternState(progress: number, target: number, completed?: boolean): LanternState {
  if (completed || (target > 0 && progress >= target)) return 'lit'
  return progress > 0 ? 'burning' : 'dark'
}
