import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import s from './HomeScene.module.css'

interface PlayerPlateProps {
  greeting: string
  userName: string
  tierId: number
  tierLabel: string
  /** null = max tier reached */
  nextTierLabel: string | null
  progressPct: number
  points: number
  nextMinPoints?: number
  pointsToNext: number
}

/**
 * Player plate in the top-left of the scene (LKF-3): tier medal in a wooden bezel, greeting, name,
 * tier and a thin XP bar. Hover / focus tells how far the next tier is. Opens the profile.
 */
export default function PlayerPlate(p: PlayerPlateProps) {
  const { t } = useTranslation()
  const isMax = p.nextTierLabel === null
  const tierImg = `/images/lk/tier-${Math.min(6, Math.max(1, p.tierId))}.webp`
  const fmt = (n: number) => n.toLocaleString('vi-VN')

  return (
    <Link
      to="/profile"
      data-testid="home-greeting-card"
      aria-label={t('home.lk.plateAria', { name: p.userName, tier: p.tierLabel, points: fmt(p.points), max: fmt(p.nextMinPoints ?? p.points) })}
      className="group absolute z-10 left-3 top-3 md:left-[2.4%] md:top-[4%] flex items-center text-bq-ink"
    >
      <span className={`${s.medal} relative z-[2] shrink-0 w-14 h-14 md:w-[11.1cqh] md:h-[11.1cqh]`}>
        <img src={tierImg} alt="" className="w-[82%]" />
      </span>
      <span className="-ml-[18px] md:-ml-[3.6cqh] pl-[26px] md:pl-[4.8cqh] pr-3.5 md:pr-[2.7cqh] py-1.5 md:py-[1.2cqh] bg-bq-white border-[3px] border-bq-ink rounded-r-2xl md:rounded-r-[20px] shadow-[0_4px_0_rgba(29,43,34,.4)]">
        <span className="block text-[12px] md:[font-size:max(12px,1.6cqh)] font-semibold text-bq-ink3 leading-tight">{p.greeting},</span>
        <span data-testid="home-greeting-name" className="block max-w-[44vw] md:max-w-[39cqh] truncate text-[20px] md:[font-size:max(20px,3.5cqh)] font-extrabold leading-[1.05] tracking-[-0.01em]">
          {p.userName}
        </span>
        {isMax ? (
          <span data-testid="home-greeting-max-tier" className="block text-[12px] md:[font-size:max(12px,1.65cqh)] font-extrabold text-bq-amberd">
            {t('home.maxTierReached')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 md:gap-[1cqh] mt-0.5">
            <span data-testid="home-greeting-tier-label" className="text-[12px] md:[font-size:max(12px,1.65cqh)] font-extrabold whitespace-nowrap">{p.tierLabel}</span>
            <span className="w-[70px] md:w-[16.5cqh] h-[9px] md:h-[max(10px,1.5cqh)] bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
              <span className="block h-full bg-bq-amber" style={{ width: `${p.progressPct}%` }} />
            </span>
            <span className="hidden md:inline [font-size:max(11px,1.4cqh)] font-bold text-bq-ink2 whitespace-nowrap tabular-nums">
              {fmt(p.points)}/{fmt(p.nextMinPoints ?? p.points)}
            </span>
          </span>
        )}
      </span>
      {!isMax && (
        <span className="pointer-events-none absolute left-[60px] md:left-[12cqh] top-[104%] z-20 px-3 py-1.5 bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-[0_5px_0_#1D2B22] text-[14px] font-bold whitespace-nowrap opacity-0 translate-y-1.5 transition group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
          {t('home.lk.toNext', { points: fmt(p.pointsToNext), tier: p.nextTierLabel })}
        </span>
      )}
    </Link>
  )
}
