import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BOARD_IMAGE, SIGN_BOARDS, type SignMode, type TimeOfDay } from './sceneData'
import s from './HomeScene.module.css'

interface SignBoardsProps {
  tod: TimeOfDay
  /** The board under the pointer / keyboard focus (the traveller says where it leads). */
  onHover: (mode: SignMode | null) => void
}

/**
 * The four ways to play, hung on the signpost as loose wooden boards (LKF-3, mockup v4):
 * each carries its mode emblem, sways on its nail, rattles in a gust every few seconds and lifts
 * toward where it points on hover / focus, so it reads as something to press.
 */
export default function SignBoards({ tod, onHover }: SignBoardsProps) {
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
        return (
          <Link
            key={b.mode}
            to={b.to}
            data-testid={`home-mode-${b.mode}`}
            aria-label={t(b.labelKey)}
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
                <span className={s.emblem}><img src={b.emblem} alt="" /></span>
                <span className={s.label}>{t(b.labelKey)}</span>
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
