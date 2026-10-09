import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BOARD_IMAGE, SIGN_BOARDS, type SignMode, type TimeOfDay } from './sceneData'
import s from './HomeScene.module.css'

interface SignBoardsProps {
  tod: TimeOfDay
  /** The board under the pointer / keyboard focus (the traveller says where it leads). */
  onHover: (mode: SignMode | null) => void
  /** Guest home: boards that need an account. They keep their link (crawlers, new tab) and a
   *  small padlock, but a tap calls onLocked instead of leaving the page. */
  locked?: readonly SignMode[]
  onLocked?: (mode: SignMode) => void
}

/** Brass padlock tucked on a locked board's emblem. */
function LockBadge() {
  return (
    <svg aria-hidden data-testid="sign-lock" viewBox="0 0 20 22" className="absolute -right-[46%] -bottom-[34%] w-[88%] drop-shadow-[0_1px_0_rgba(29,43,34,.6)]">
      <path d="M5 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#2B1A08" strokeWidth="4" />
      <path d="M5 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#DDAE4E" strokeWidth="1.6" />
      <rect x="2" y="9.5" width="16" height="11.5" rx="3" fill="#F0CF7A" stroke="#2B1A08" strokeWidth="2.2" />
      <circle cx="10" cy="15" r="1.9" fill="#2B1A08" />
    </svg>
  )
}

/**
 * The four ways to play, hung on the signpost as loose wooden boards (LKF-3, mockup v4):
 * each carries its mode emblem, sways on its nail, rattles in a gust every few seconds and lifts
 * toward where it points on hover / focus, so it reads as something to press.
 */
export default function SignBoards({ tod, onHover, locked = [], onLocked }: SignBoardsProps) {
  const { t } = useTranslation()
  const tone = tod === 'night' ? s.night : tod === 'sunset' ? s.sunset : ''

  return (
    <nav
      data-testid="home-modes-grid"
      aria-labelledby="home-signs-title"
      className={`absolute inset-0 pointer-events-none ${tone}`}
    >
      <h2 id="home-signs-title" className="sr-only">{t('home.primary.title')}</h2>
      {SIGN_BOARDS.map((b, i) => {
        const right = b.side === 'right'
        const vars = {
          '--x': `${b.x}%`, '--y': `${b.y}%`, '--w': `${b.w}%`, '--r': `${b.tilt}deg`,
          '--ox': right ? '8%' : '92%', '--push': right ? '.9cqw' : '-.9cqw',
          '--lift': right ? '-3deg' : '3deg', '--bz': right ? '1.4deg' : '-1.4deg',
          '--d': `${i * 0.7}s`, '--gd': `${i * 0.18}s`,
        } as CSSProperties
        const isLocked = locked.includes(b.mode)
        return (
          <Link
            key={b.mode}
            to={b.to}
            data-testid={`home-mode-${b.mode}`}
            data-locked={isLocked || undefined}
            aria-label={isLocked ? t('guest.lockedAria', { mode: t(b.labelKey) }) : t(b.labelKey)}
            onClick={isLocked ? e => { e.preventDefault(); onLocked?.(b.mode) } : undefined}
            onMouseEnter={() => onHover(b.mode)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(b.mode)}
            onBlur={() => onHover(null)}
            className={`${s.board} ${right ? s.right : s.left} pointer-events-auto`}
            style={vars}
          >
            <span className={s.sway}>
              <span className={s.wig}>
                <img className={s.plank} src={right ? BOARD_IMAGE.right : BOARD_IMAGE.left} alt="" draggable={false} />
                <span className={s.emblem}><img src={b.emblem} alt="" />{isLocked && <LockBadge />}</span>
                <span className={s.label}>{t(b.labelKey)}</span>
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
