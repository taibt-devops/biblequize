import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TimeOfDay } from './sceneData'
import s from './HomeScene.module.css'

/** The dove takes the light of the hour, like the traveller. */
const TINT: Record<TimeOfDay, string> = { day: '', sunset: 'sepia-[.18] saturate-[1.12] brightness-[.98]', night: 'brightness-[.8] saturate-[.82] hue-rotate-[-6deg]' }

/** hh:mm:ss until the next UTC midnight (when the daily challenge resets), ticking each second. */
function useUtcCountdown(): string {
  const calc = () => {
    const now = new Date()
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    const ms = Math.max(0, next - now.getTime())
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}`
  }
  const [value, setValue] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setValue(calc()), 1000)
    return () => clearInterval(id)
  }, [])
  return value
}

const tipCls = 'hidden md:block pointer-events-none absolute z-20 px-3 py-1.5 bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-[0_5px_0_#1D2B22] text-[15px] font-bold text-bq-ink whitespace-nowrap opacity-0 translate-y-1.5 transition group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0'

interface FlyingDoveProps {
  questionCount: number
  xp: number
  tod: TimeOfDay
}

/**
 * Today's challenge, not done yet (LKF-3): a dove glides down toward the traveller with a sealed
 * letter; a dotted flight line on desktop. The traveller's bubble carries the "open" button.
 */
export function FlyingDove({ questionCount, xp, tod }: FlyingDoveProps) {
  const { t } = useTranslation()
  const countdown = useUtcCountdown()
  return (
    <>
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="hidden md:block absolute left-[60%] top-[5%] w-[6%] h-[25%] overflow-visible pointer-events-none">
        <path d="M75 0 C 95 30, 80 70, 58 98" fill="none" stroke="#FFF8E7" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3, opacity: 0.85 }} />
      </svg>
      <Link
        to="/daily"
        data-testid="home-daily"
        aria-label={t('home.lk.doveAria', { count: questionCount, xp })}
        className={`group absolute z-[5] left-[55%] top-[26%] w-[10.5cqw] md:w-[9.5cqw] ${s.dove}`}
      >
        <img src="/images/lk/dove-letter.webp" alt="" className={`block w-full -scale-x-100 ${TINT[tod]}`} />
        <span aria-hidden className={s.spark} style={{ left: '-4%', top: '28%' }} />
        <span aria-hidden className={s.spark} style={{ left: '12%', top: '4%', animationDelay: '.5s' }} />
        <span aria-hidden className={s.spark} style={{ left: '-10%', top: '58%', animationDelay: '1s' }} />
        <span className={`${tipCls} right-full top-0`}>{t('home.lk.doveTip', { count: questionCount, time: countdown })}</span>
      </Link>
    </>
  )
}

interface PerchedDoveProps {
  correct: number
  total: number
  tod: TimeOfDay
}

/** Today's challenge done: the dove rests on top of the signpost with the opened letter. */
export function PerchedDove({ correct, total, tod }: PerchedDoveProps) {
  const { t } = useTranslation()
  const countdown = useUtcCountdown()
  return (
    <span data-testid="home-daily" className="absolute z-[4] left-[81.3%] bottom-[83.2%] w-[5.2%] -translate-x-1/2">
      <Link
        to="/daily"
        data-testid="featured-daily-cta"
        aria-label={t('home.lk.doveDone', { correct, total })}
        className="group block transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none"
      >
        <img src="/images/lk/dove-perched.webp" alt="" className={`block w-full ${TINT[tod]}`} />
        <span className={`${tipCls} right-full top-0`}>
          {t('home.lk.doveDone', { correct, total })} · {t('home.lk.doveDoneNext', { time: countdown })}
        </span>
      </Link>
    </span>
  )
}
