import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Home hero — storybook crossroads (LKD-15).
 *
 * A painted village crossroads whose signpost arrows ARE the mode entrances
 * (desktop), with the greeting card pinned on the sky. On phones the card
 * flows under the picture and the arrows become a 2×2 grid of wooden boards.
 * Sign positions are traced over /images/lk/bq-home.webp (3:2, uncropped), so
 * the picture must keep aspect-[3/2] + object-cover for the labels to line up.
 */
interface HomeHeroSceneProps {
  greeting: string
  userName: string
  level: number
  tierId: number
  tierLabel: string
  nextTierLabel: string | null // null = max tier reached
  progressPct: number
  totalPoints: number
  nextMinPoints?: number
  pointsToNext: number
  streak: number
  energy: number
  seasonPoints: number
  seasonLabel: string
  weeklyRank: number | null // null = hidden (low data)
}

// Literal class strings so Tailwind JIT keeps them (arrow centres on the painting).
const SIGNS = [
  { to: '/practice', labelKey: 'gameModes.practice', pos: 'left-[77.6%] top-[26.6%]', arrow: 'right' },
  { to: '/ranked', labelKey: 'gameModes.ranked', pos: 'left-[84.2%] top-[33.1%]', arrow: 'right' },
  { to: '/multiplayer', labelKey: 'gameModes.rooms', pos: 'left-[78.6%] top-[43.3%]', arrow: 'left' },
  { to: '/journey', labelKey: 'home.signpost.journey', pos: 'left-[83.6%] top-[52.6%]', arrow: 'left' },
] as const

const ARROW_CLIP = {
  right: '[clip-path:polygon(0_0,86%_0,100%_50%,86%_100%,0_100%)]',
  left: '[clip-path:polygon(14%_0,100%_0,100%_100%,14%_100%,0_50%)]',
} as const

export default function HomeHeroScene(p: HomeHeroSceneProps) {
  const { t } = useTranslation()
  const isMax = p.nextTierLabel === null
  const tierImg = `/images/lk/tier-${Math.min(6, Math.max(1, p.tierId))}.webp`

  return (
    <section aria-label={t('home.signpost.nav')} className="relative [container-type:inline-size]">
      <div className="relative w-full aspect-[3/2] overflow-hidden rounded-bq border-[3px] border-bq-ink shadow-bq-card">
        <img src="/images/lk/bq-home.webp" alt={t('home.signpost.sceneAlt')} className="absolute inset-0 w-full h-full object-cover" />
        {SIGNS.map(s => (
          <Link
            key={s.to}
            to={s.to}
            className={`hidden md:block absolute ${s.pos} -translate-x-1/2 -translate-y-1/2 px-[1cqw] py-[.6cqw] [font-size:1.85cqw] font-extrabold leading-none text-bq-woodink whitespace-nowrap transition-transform hover:scale-110`}
          >
            {t(s.labelKey)}
          </Link>
        ))}
        <img src="/images/lk/hero.webp" alt="" aria-hidden className="absolute left-[47%] bottom-[5%] h-[34%] motion-safe:animate-bob" />
        <div className="hidden md:block absolute left-[51.5%] top-[49%] px-[1.4cqw] py-[.8cqw] bg-bq-white border-[3px] border-bq-ink rounded-2xl [font-size:1.6cqw] font-bold whitespace-nowrap">
          {t('home.signpost.ask')}
        </div>
      </div>

      <div
        data-testid="home-greeting-card"
        className="relative z-10 -mt-12 mx-3 md:mx-0 md:mt-0 md:absolute md:left-[3%] md:top-[5%] md:w-[40%] bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card px-5 py-4 md:px-[2.4cqw] md:py-[2cqw]"
      >
        <p className="text-[15px] md:[font-size:max(15px,1.5cqw)] font-semibold text-bq-ink3">{p.greeting},</p>
        <h1 data-testid="home-greeting-name" className="font-display font-extrabold leading-none tracking-[-0.02em] text-[30px] md:[font-size:max(30px,4.2cqw)] text-bq-ink break-words">
          {p.userName}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <img src={tierImg} alt={p.tierLabel} className="w-14 md:w-[5.6cqw] md:min-w-[52px] shrink-0" />
          <div className="flex-1 min-w-0">
            {isMax ? (
              <div data-testid="home-greeting-max-tier" className="font-extrabold text-[18px] text-bq-amberd">{t('home.maxTierReached')}</div>
            ) : (
              <div className="font-extrabold text-[18px] leading-tight">
                <span data-testid="home-greeting-tier-label">{p.tierLabel}</span>
                <span className="text-bq-ink3 font-bold"> → {p.nextTierLabel}</span>
              </div>
            )}
            <div className="text-[13px] font-semibold text-bq-ink2">
              LV. {p.level}
              {p.weeklyRank != null && <> · {t('home.hero.weeklyRank', 'Hạng tuần')} #{p.weeklyRank}</>}
            </div>
            {!isMax && (
              <>
                <div className="mt-1.5 h-3.5 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
                  <div className="h-full bg-bq-amber" style={{ width: `${p.progressPct}%` }} />
                </div>
                <div className="mt-1 text-[12px] font-bold text-bq-ink2">
                  {p.totalPoints.toLocaleString()} / {p.nextMinPoints?.toLocaleString()} XP · {t('home.hero.toNext', 'còn')} {p.pointsToNext.toLocaleString()}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[15px] font-bold">
          <span className="inline-flex items-center gap-1.5 pl-1 pr-3 py-0.5 bg-bq-paper border-2 border-bq-ink rounded-full">
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-6" />{p.streak} <span className="text-bq-ink3 text-[12px]">{t('home.greeting.streak')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-0.5 bg-bq-paper border-2 border-bq-ink rounded-full">
            <img src="/images/lk/heart.webp" alt="" aria-hidden className="h-5" />{p.energy} <span className="text-bq-ink3 text-[12px]">{t('home.greeting.energy')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-0.5 bg-bq-paper border-2 border-bq-ink rounded-full">
            <span aria-hidden className="text-bq-amber [-webkit-text-stroke:1.5px_#1D2B22] text-[18px] leading-none">★</span>{p.seasonPoints.toLocaleString()} <span className="text-bq-ink3 text-[12px]">{p.seasonLabel}</span>
          </span>
        </div>
      </div>

      <nav aria-label={t('home.signpost.nav')} className="md:hidden grid grid-cols-2 gap-3 mt-4 mx-3">
        {SIGNS.map(s => (
          <Link key={s.to} to={s.to} className="block h-14 active:translate-y-0.5 transition-transform">
            <span className={`block h-full p-[3px] pb-[7px] bg-bq-ink ${ARROW_CLIP[s.arrow]}`}>
              <span className={`flex h-full items-center justify-center bg-bq-woodlt text-bq-woodink font-extrabold text-[18px] ${s.arrow === 'right' ? 'pr-[12%]' : 'pl-[12%]'} ${ARROW_CLIP[s.arrow]}`}>
                {t(s.labelKey)}
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </section>
  )
}
