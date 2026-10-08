import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../store/authStore'
import { getTierByPoints, getNextTier } from '../data/tiers'
import { PlaceBackdrop, Plaque, lkClass } from '../components/lk/Place'
import { TierRibbon } from '../components/lk/PlayerCrest'
import { achievementIcon } from '../utils/achievementIcon'

// --- Types ---

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  points: number
  unlockedAt?: string
  isNotified?: boolean
}

// --- Category Helpers ---

const CATEGORIES = [
  { key: 'all', labelKey: 'achievements.catAll', icon: 'emoji_events' },
  { key: 'learning', labelKey: 'achievements.catLearning', icon: 'auto_stories' },
  { key: 'streak', labelKey: 'achievements.catStreak', icon: 'local_fire_department' },
  { key: 'social', labelKey: 'achievements.catSocial', icon: 'groups' },
  { key: 'competition', labelKey: 'achievements.catCompetition', icon: 'military_tech' },
  // Legacy categories mapped
  { key: 'quiz', labelKey: 'achievements.catQuiz', icon: 'quiz' },
  { key: 'points', labelKey: 'achievements.catPoints', icon: 'toll' },
  { key: 'books', labelKey: 'achievements.catBooks', icon: 'menu_book' },
  { key: 'accuracy', labelKey: 'achievements.catAccuracy', icon: 'target' },
]

function getCategoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) || { key, labelKey: key, icon: 'emoji_events' }
}

const FILL_STYLE = { fontVariationSettings: "'FILL' 1" }

// --- Component ---

interface AchievementStats {
  totalPoints?: number
  accuracy?: number
  longestStreak?: number
}

const Achievements: React.FC = () => {
  const { t } = useTranslation()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState<AchievementStats>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('all')
  const { user } = useAuth()

  useEffect(() => {
    const loadAchievements = async () => {
      if (!user) return

      setLoading(true)
      try {
        const [achievementsRes, statsRes] = await Promise.all([
          api.get('/api/achievements/my-achievements'),
          api.get('/api/achievements/stats')
        ])

        setAchievements(achievementsRes.data || [])
        setStats(statsRes.data || {})
      } catch (error) {
        console.error('Failed to load achievements:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAchievements()
  }, [user])

  const earnedCount = achievements.filter(a => a.unlockedAt).length
  const totalPoints = achievements
    .filter(a => a.unlockedAt)
    .reduce((sum, a) => sum + (a.points || 0), 0)

  const xp = stats.totalPoints || totalPoints
  const tier = getTierByPoints(xp)
  const nextTier = getNextTier(xp)
  const tierPct = nextTier ? Math.min(100, ((xp - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100) : 100

  // Deduce visible category keys from actual data
  const visibleCategoryKeys = new Set(achievements.map(a => a.category))
  const visibleCategories = CATEGORIES.filter(
    c => c.key === 'all' || visibleCategoryKeys.has(c.key)
  )

  const filteredAchievements = activeTab === 'all'
    ? achievements
    : achievements.filter(a => a.category === activeTab)

  // Recently unlocked achievements (up to 3, sorted by date desc)
  const recentUnlocked = achievements
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 3)

  const overallProgress = achievements.length > 0
    ? Math.round((earnedCount / achievements.length) * 100)
    : 0

  // --- Not Logged In ---

  if (!user) {
    return (
      <div className="relative flex items-center justify-center py-20 px-4">
        <PlaceBackdrop place="camp" veil="strong" />
        <div className="max-w-sm w-full p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-28 mb-2" />
          <h2 className="m-0 mb-2 font-display text-[22px] font-extrabold text-bq-ink">{t('achievements.loginRequired')}</h2>
          <p className="m-0 mb-5 font-read text-[15px] text-bq-ink2">{t('achievements.loginDescription')}</p>
          <Link to="/login" className="lk-btn text-bq-ink text-[16px] no-underline">{t('auth.login')}</Link>
        </div>
      </div>
    )
  }

  // --- Loading ---

  if (loading) {
    return (
      <div className="relative flex flex-col items-center justify-center py-24 gap-4">
        <PlaceBackdrop place="camp" veil="strong" />
        <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className={`h-16 ${lkClass.bob}`} />
        <p className="m-0 font-bold text-bq-ink2">{t('achievements.loading')}</p>
      </div>
    )
  }

  return (
    <div className="relative max-w-6xl mx-auto">
      <PlaceBackdrop place="camp" veil="strong" />
      {/* title + overall progress */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="space-y-3">
          <Plaque className="text-[30px] md:text-[38px]">
            <img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-[1em]" />
            {t('achievements.title')}
          </Plaque>
          <p className="m-0 w-fit px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[15px] font-extrabold">
            ★ {earnedCount}/{achievements.length} {t('achievements.unlocked')}
          </p>
        </div>
        <div className="w-full md:w-80 px-4 py-3 bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-[0_4px_0_#1D2B22]">
          <div className="flex justify-between text-[14px] font-extrabold mb-2">
            <span>{t('achievements.overallProgress')}</span>
            <span className="tabular-nums">{overallProgress}%</span>
          </div>
          <div className="h-4 w-full bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
            <div className="h-full bg-bq-amber transition-all duration-700" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-7">
        <div className="md:col-span-8 lg:col-span-9 space-y-6">
          {/* category filter */}
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((cat) => {
              const isActive = activeTab === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTab(cat.key)}
                  aria-pressed={isActive}
                  className={`px-4 py-1.5 rounded-full border-2 text-[14px] font-extrabold whitespace-nowrap transition-colors ${
                    isActive ? 'bg-bq-amber border-bq-ink text-bq-ink' : 'bg-bq-white/90 border-bq-ink/25 text-bq-ink2 hover:border-bq-ink'
                  }`}
                >
                  {t(cat.labelKey)}
                </button>
              )
            })}
          </div>

          {filteredAchievements.length === 0 ? (
            <div className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-10 text-center">
              <img src="/images/lk/hero.webp" alt="" aria-hidden className="mx-auto h-28 mb-3" />
              <h3 className="m-0 mb-1 font-display text-[22px] font-extrabold text-bq-ink">{t('achievements.noAchievements')}</h3>
              <p className="m-0 font-read text-[15px] text-bq-ink2">{t('achievements.playToUnlock')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAchievements.map((achievement) => {
                const isUnlocked = !!achievement.unlockedAt
                const icon = achievementIcon(achievement.icon, getCategoryMeta(achievement.category).icon)
                return (
                  <div
                    key={achievement.id}
                    className={`relative p-5 rounded-2xl border-[3px] ${
                      isUnlocked ? 'bg-bq-cream border-bq-ink shadow-[0_5px_0_#1D2B22]' : 'bg-bq-paper/95 border-dashed border-bq-ink/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className={isUnlocked ? lkClass.medal : 'grid place-items-center rounded-full border-[3px] border-bq-ink/25 bg-bq-inset'}
                        style={{ width: 58, height: 58 }}
                      >
                        <span className={`material-symbols-outlined text-[30px] ${isUnlocked ? 'text-bq-amberd' : 'text-bq-ink3'}`} style={isUnlocked ? FILL_STYLE : undefined}>
                          {icon}
                        </span>
                      </span>
                      {isUnlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[12px] font-extrabold">✓ {t('achievements.unlocked')}</span>
                      ) : (
                        <span className="w-7 h-7 grid place-items-center rounded-full bg-bq-white border-2 border-bq-ink/30">
                          <span className="material-symbols-outlined text-[15px] text-bq-ink3">lock</span>
                        </span>
                      )}
                    </div>
                    <h3 className={`m-0 mb-1 font-display text-[18px] font-extrabold ${isUnlocked ? 'text-bq-ink' : 'text-bq-ink2'}`}>{achievement.name}</h3>
                    <p className={`m-0 font-read text-[14px] leading-relaxed ${isUnlocked ? 'text-bq-ink2' : 'text-bq-ink3'}`}>{achievement.description}</p>
                    <div className="mt-3 pt-3 border-t-2 border-dashed border-bq-hair text-[12.5px] font-bold text-bq-ink2">
                      {isUnlocked
                        ? t('achievements.earnedOn', { date: new Date(achievement.unlockedAt!).toLocaleDateString('vi-VN') })
                        : t('achievements.locked')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <aside className="md:col-span-4 lg:col-span-3 space-y-5">
          {/* recently earned */}
          <section className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card p-5 rounded-2xl">
            <h2 className="m-0 mb-4 font-display text-[19px] font-extrabold text-bq-ink">{t('achievements.recentlyEarned')}</h2>
            <div className="space-y-4">
              {recentUnlocked.length === 0 ? (
                <p className="m-0 font-read text-[14px] text-bq-ink2">{t('achievements.noAchievements')}</p>
              ) : (
                recentUnlocked.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className={lkClass.medal} style={{ width: 44, height: 44 }}>
                      <span className="material-symbols-outlined text-[22px] text-bq-amberd" style={FILL_STYLE}>
                        {achievementIcon(a.icon, getCategoryMeta(a.category).icon)}
                      </span>
                    </span>
                    <div className="min-w-0 pl-1">
                      <p className="m-0 text-[14px] font-extrabold text-bq-ink">{a.name}</p>
                      <p className="m-0 text-[12px] font-bold text-bq-ink2 truncate">{a.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* season numbers */}
          <section className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card p-5 rounded-2xl">
            <h3 className="m-0 mb-3 font-display text-[19px] font-extrabold text-bq-ink">{t('achievements.seasonStats')}</h3>
            <div className="divide-y-2 divide-dashed divide-bq-hair">
              {[
                [t('achievements.currentRank'), <TierRibbon key="r" tierId={tier.id} />],
                [t('achievements.experiencePoints'), `${xp.toLocaleString()} XP`],
                [t('achievements.accuracy'), `${stats.accuracy || 0}%`],
                [t('achievements.longestStreak'), `${stats.longestStreak || 0} ${t('common.days')}`],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between items-center gap-2 py-2">
                  <span className="text-[13.5px] font-bold text-bq-ink2">{label}</span>
                  <span className="text-[14px] font-extrabold text-bq-ink">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* tier road */}
          <section className="bg-bq-cream border-[3px] border-bq-ink shadow-bq-card p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <img src={`/images/lk/tier-${tier.id}.webp`} alt="" aria-hidden className="w-14 shrink-0" />
              <div>
                <p className="m-0 font-display text-[18px] font-extrabold text-bq-ink">{t(tier.nameKey)}</p>
                {nextTier && (
                  <p className="m-0 text-[12.5px] font-bold text-bq-ink2">{t('achievements.nextTier')}: {t(nextTier.nameKey)}</p>
                )}
              </div>
            </div>
            {nextTier ? (
              <>
                <div className="h-3.5 w-full bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-bq-amber transition-all duration-700 ease-out" style={{ width: `${tierPct}%` }} />
                </div>
                <p className="m-0 text-[12.5px] font-bold text-bq-ink2 tabular-nums">
                  {xp.toLocaleString()} / {nextTier.minPoints.toLocaleString()} {t('achievements.pointsUnit')}
                </p>
              </>
            ) : (
              <p className="m-0 text-[13px] font-bold text-bq-ink2">{t('achievements.maxTier')}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default Achievements
