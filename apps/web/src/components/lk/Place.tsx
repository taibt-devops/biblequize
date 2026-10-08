import type { ReactNode } from 'react'
import k from './lk.module.css'

/**
 * Lu Khach "place" kit (LKF-7). Every screen is a place in the traveller's world: a painted
 * backdrop behind the page, titles on wooden plaques, content on parchment.
 */

export type PlaceKey =
  | 'meadow' | 'map' | 'study' | 'arena' | 'post' | 'square' | 'chapel' | 'summit' | 'camp' | 'gate'

export const PLACE_IMAGE: Record<PlaceKey, string> = {
  meadow: '/images/lk/bq-quiz.webp',
  map: '/images/lk/bq-journey.webp',
  study: '/images/lk/place-study.webp',
  arena: '/images/lk/place-arena.webp',
  post: '/images/lk/place-post.webp',
  square: '/images/lk/place-square.webp',
  chapel: '/images/lk/place-chapel.webp',
  summit: '/images/lk/place-summit.webp',
  camp: '/images/lk/place-camp.webp',
  gate: '/images/lk/place-gate.webp',
}

interface PlaceBackdropProps {
  place: PlaceKey
  /** How much cream veil over the painting: content-heavy pages want more. */
  veil?: 'soft' | 'mid' | 'strong'
  /** CSS object-position of the painting (default centre). */
  focus?: string
}

const VEIL = {
  soft: 'bg-bq-cream/20',
  mid: 'bg-[linear-gradient(180deg,rgba(255,241,201,.25)_0%,rgba(239,227,195,.55)_55%,rgba(239,227,195,.8)_100%)]',
  strong: 'bg-[linear-gradient(180deg,rgba(255,241,201,.45)_0%,rgba(239,227,195,.75)_45%,rgba(239,227,195,.9)_100%)]',
}

/** The painting of the place, fixed behind the page content. */
export function PlaceBackdrop({ place, veil = 'mid', focus = 'center' }: PlaceBackdropProps) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-bq-paper">
      <img src={PLACE_IMAGE[place]} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: focus }} />
      <div className={`absolute inset-0 ${VEIL[veil]}`} />
    </div>
  )
}

/** Page / section title on a wooden plaque. */
export function Plaque({ children, as: Tag = 'h1', className = '', id }: { children: ReactNode; as?: 'h1' | 'h2' | 'h3' | 'span'; className?: string; id?: string }) {
  return <Tag id={id} className={`${k.plaque} font-extrabold leading-none ${className}`}>{children}</Tag>
}

/** Parchment scroll between two wooden rods. */
export function ScrollPanel({ children, className = '', bodyClassName = '', testId }: { children: ReactNode; className?: string; bodyClassName?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={className}>
      <div aria-hidden className={k.rod} />
      <div className={`${k.scrollBody} ${bodyClassName}`}>{children}</div>
      <div aria-hidden className={k.rod} />
    </section>
  )
}

/** Round medal in a wooden bezel. */
export function Medal({ children, size = 64, className = '' }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <span className={`${k.medal} shrink-0 ${className}`} style={{ width: size, height: size }}>
      {children}
    </span>
  )
}

/** Wooden progress track with a gold (or given) fill. */
export function TrackBar({ pct, fill = 'bg-bq-amber', className = 'h-3.5', label }: { pct: number; fill?: string; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, pct))
  return (
    <div role={label ? 'progressbar' : undefined} aria-label={label} aria-valuenow={label ? Math.round(v) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}
      className={`bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${fill} transition-[width] duration-500`} style={{ width: `${v}%` }} />
    </div>
  )
}

export const lkClass = k
