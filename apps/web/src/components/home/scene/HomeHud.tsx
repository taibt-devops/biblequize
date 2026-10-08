import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import s from './HomeScene.module.css'

interface HomeHudProps {
  journey: { book: string; pct: number } | null
  /** null = hidden (fewer than 10 weekly players, LBF-11) */
  rank: { rank: number; points: number } | null
  verseDue: number
  verseRef: string
  season: { name: string; daysLeft: number } | null
  quests: { done: number; total: number }
  onOpenVerse: () => void
  onOpenQuests: () => void
}

interface MedalProps {
  icon: string
  label: string
  badge?: ReactNode
  tip: string
  testId?: string
  phoneOnly?: boolean
  to?: string
  onClick?: () => void
}

function Medal({ icon, label, badge, tip, testId, phoneOnly, to, onClick }: MedalProps) {
  const body = (
    <>
      <span className={`${s.medal} w-[50px] h-[50px] md:w-[max(46px,8.1cqh)] md:h-[max(46px,8.1cqh)]`}>
        <img src={icon} alt="" className="w-[74%] h-[74%] object-contain" />
      </span>
      <span className={`text-[12.5px] md:[font-size:max(13px,1.65cqh)] font-extrabold leading-none whitespace-nowrap text-bq-ink md:text-bq-white ${s.outlinedMd}`}>{label}</span>
      {badge}
      <span className="hidden md:block pointer-events-none absolute -left-[.9cqh] bottom-[128%] z-20 px-3 py-1.5 bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-[0_5px_0_#1D2B22] text-[15px] font-bold text-bq-ink whitespace-nowrap opacity-0 translate-y-1.5 transition group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
        {tip}
      </span>
    </>
  )
  const cls = `group relative flex flex-col items-center gap-[9px] md:gap-[1.7cqh] transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none active:translate-y-0.5 ${phoneOnly ? 'md:hidden' : ''}`
  return to
    ? <Link to={to} data-testid={testId} aria-label={`${label}: ${tip}`} className={cls}>{body}</Link>
    : <button type="button" onClick={onClick} data-testid={testId} aria-label={`${label}: ${tip}`} className={cls}>{body}</button>
}

const badgeCls = 'absolute -right-[9px] -top-[9px] md:-right-[1.8cqh] md:-top-[1.65cqh] px-1.5 md:px-[.8cqh] border-2 border-bq-ink rounded-full text-[11px] md:[font-size:max(11px,1.4cqh)] font-extrabold leading-[1.45] whitespace-nowrap'

/**
 * Game HUD (LKF-3): round medals in a wooden bezel. Desktop: bottom-left corner of the picture.
 * Phone: a row under the picture, with a Quests medal first (desktop has the lanterns for that).
 */
export default function HomeHud(p: HomeHudProps) {
  const { t } = useTranslation()
  const lit = `${p.quests.done}/${p.quests.total}`
  return (
    <nav
      aria-label={t('home.lk.hudNav')}
      className="relative z-[6] mx-3.5 mt-[22px] mb-2 flex justify-between items-start md:absolute md:m-0 md:left-[2.4%] md:bottom-[4.5%] md:gap-[3.9cqh] md:justify-start"
    >
      <Medal phoneOnly icon="/images/lk/lantern-on.webp" label={t('home.lk.hudQuests')} tip={t('home.lk.questsLit', { done: p.quests.done, total: p.quests.total })}
        badge={<span className={`${badgeCls} bg-bq-amber text-bq-ink`}>{lit}</span>} onClick={p.onOpenQuests} />
      <Medal to="/journey" icon="/images/lk/icon-map.webp" label={t('home.lk.hudJourney')}
        tip={p.journey ? t('home.lk.journeyTip', { book: p.journey.book, pct: p.journey.pct }) : t('home.lk.journeyTipStart')}
        badge={p.journey ? <span className={`${badgeCls} bg-bq-amber text-bq-ink`}>{p.journey.pct}%</span> : undefined} />
      <Medal to="/leaderboard" testId="home-weekly-leaderboard" icon="/images/lk/icon-trophy.webp" label={t('home.lk.hudRanking')}
        tip={p.rank ? t('home.lk.rankTip', { rank: p.rank.rank, points: p.rank.points.toLocaleString('vi-VN') }) : t('home.lk.rankTipLow')}
        badge={p.rank ? <span className={`${badgeCls} bg-bq-amber text-bq-ink`}>#{p.rank.rank}</span> : undefined} />
      <Medal testId="home-verse" icon="/images/lk/scroll.webp" label={t('home.lk.hudVerse')} tip={p.verseRef} onClick={p.onOpenVerse}
        badge={p.verseDue > 0
          ? <span data-testid="home-memory-due-card" className={`${badgeCls} bg-bq-ruby text-bq-white`}>{t('home.lk.verseDue', { count: p.verseDue })}</span>
          : <span className={`${badgeCls} bg-bq-ruby text-bq-white`}>{t('home.lk.hudNew')}</span>} />
      <Medal to="/ranked" icon="/images/lk/pennant.webp" label={t('home.lk.hudSeason')}
        tip={p.season ? t('home.lk.seasonTip', { name: p.season.name, count: p.season.daysLeft }) : t('home.lk.seasonNone')}
        badge={p.season ? <span className={`${badgeCls} bg-bq-amber text-bq-ink`}>{t('home.lk.seasonBadge', { count: p.season.daysLeft })}</span> : undefined} />
    </nav>
  )
}
