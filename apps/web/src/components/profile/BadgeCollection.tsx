import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FILL_STYLE, type Achievement } from './types'
import { SkeletonBlock } from './SkeletonBlock'
import { lkClass } from '../lk/Place'
import { achievementIcon } from '../../utils/achievementIcon'

type BadgeTab = 'all' | 'unlocked' | 'locked'

export function BadgeCollection({ achievements, loading }: { achievements: Achievement[]; loading: boolean }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<BadgeTab>('all')

  const unlockedCount = achievements.filter(a => a.unlockedAt).length
  const lockedCount = achievements.length - unlockedCount

  const filtered = useMemo(() => {
    if (tab === 'unlocked') return achievements.filter(a => a.unlockedAt)
    if (tab === 'locked') return achievements.filter(a => !a.unlockedAt)
    return achievements
  }, [achievements, tab])

  return (
    <section data-testid="profile-badges-section" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-display text-[19px] font-extrabold text-bq-ink inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-bq-amberd">workspace_premium</span>
          {t('profile.badgeCollection')}
        </h2>
        <Link to="/achievements" className="px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[13px] font-extrabold text-bq-ink no-underline hover:bg-bq-cream">
          {t('profile.badgeViewAll', { n: achievements.length })}
        </Link>
      </div>

      <div className="flex gap-1.5 mb-4">
        {([
          { id: 'all' as const, label: t('profile.badgeTabAll'), count: achievements.length },
          { id: 'unlocked' as const, label: t('profile.badgeTabUnlocked'), count: unlockedCount },
          { id: 'locked' as const, label: t('profile.badgeTabLocked'), count: lockedCount },
        ]).map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={
              tab === item.id
                ? 'px-3.5 py-1 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold text-bq-ink'
                : 'px-3.5 py-1 rounded-full bg-bq-paper border-2 border-bq-ink/25 text-[13px] font-bold text-bq-ink2 hover:border-bq-ink'
            }
          >
            {item.label} <span className="opacity-70 ml-0.5">{item.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} className="h-32" />)}
        </div>
      ) : achievements.length === 0 ? (
        <p className="text-bq-ink2 text-center py-8">{t('profile.noBadges')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {filtered.map(a => <BadgeTile key={a.id} achievement={a} />)}
        </div>
      )}
    </section>
  )
}

function BadgeTile({ achievement }: { achievement: Achievement }) {
  const unlocked = !!achievement.unlockedAt
  return (
    <div
      className={
        unlocked
          ? 'relative rounded-2xl p-3 pt-4 flex flex-col items-center text-center bg-bq-cream border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22]'
          : 'relative rounded-2xl p-3 pt-4 flex flex-col items-center text-center bg-bq-paper border-[3px] border-dashed border-bq-ink/30'
      }
    >
      {!unlocked && (
        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-bq-white border-2 border-bq-ink/30 grid place-items-center">
          <span className="material-symbols-outlined text-[13px] text-bq-ink3">lock</span>
        </span>
      )}
      <span className={`${unlocked ? lkClass.medal : 'grid place-items-center rounded-full border-[3px] border-bq-ink/25 bg-bq-inset'} mb-3`} style={{ width: 52, height: 52 }}>
        <span className={`material-symbols-outlined text-[26px] ${unlocked ? 'text-bq-amberd' : 'text-bq-ink3'}`} style={unlocked ? FILL_STYLE : undefined}>
          {achievementIcon(achievement.icon)}
        </span>
      </span>
      <p className={`m-0 text-[13px] font-extrabold leading-tight ${unlocked ? 'text-bq-ink' : 'text-bq-ink3'}`}>{achievement.name}</p>
      <p className="m-0 text-[11.5px] font-bold text-bq-ink2 mt-1 leading-tight line-clamp-2">{achievement.description}</p>
    </div>
  )
}
