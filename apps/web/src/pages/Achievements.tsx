import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../store/authStore'

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

// --- Tier System ---

interface TierInfo {
  name: string
  icon: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  minPoints: number
}

const TIERS: TierInfo[] = [
  { name: 'newBeliever', icon: 'person', color: '#A8A69C', bgColor: 'bg-bq-inset', textColor: 'text-bq-ink3', borderColor: 'border-bq-hair', minPoints: 0 },
  { name: 'seeker', icon: 'search', color: '#0E8A6B', bgColor: 'bg-bq-emerald/10', textColor: 'text-bq-emerald', borderColor: 'border-bq-emerald/30', minPoints: 500 },
  { name: 'disciple', icon: 'school', color: '#2D46C8', bgColor: 'bg-bq-sapphire/10', textColor: 'text-bq-sapphire', borderColor: 'border-bq-sapphire/30', minPoints: 1500 },
  { name: 'sage', icon: 'psychology', color: '#2D46C8', bgColor: 'bg-bq-sapphire/10', textColor: 'text-bq-sapphire', borderColor: 'border-bq-sapphire/30', minPoints: 4000 },
  { name: 'prophet', icon: 'auto_awesome', color: '#F59E0B', bgColor: 'bg-bq-amber/10', textColor: 'text-bq-amberd', borderColor: 'border-bq-amber/30', minPoints: 8000 },
  { name: 'apostle', icon: 'local_fire_department', color: '#E0354B', bgColor: 'bg-bq-ruby/10', textColor: 'text-bq-ruby', borderColor: 'border-bq-ruby/30', minPoints: 15000 },
]

function getCurrentTier(points: number): { current: TierInfo; next: TierInfo | null; progress: number } {
  let currentIdx = 0
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) {
      currentIdx = i
      break
    }
  }
  const current = TIERS[currentIdx]
  const next = currentIdx < TIERS.length - 1 ? TIERS[currentIdx + 1] : null
  const progress = next
    ? ((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100
    : 100
  return { current, next, progress: Math.min(progress, 100) }
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

  const tierData = getCurrentTier(stats.totalPoints || totalPoints)

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
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-bq-ink2 mb-4 block" style={FILL_STYLE}>
            lock
          </span>
          <h2 className="text-2xl font-bold mb-4 text-bq-ink">
            {t('achievements.loginRequired')}
          </h2>
          <p className="text-bq-ink2 mb-8">
            {t('achievements.loginDescription')}
          </p>
          <Link
            to="/login"
            className="px-6 py-3 rounded-xl font-bold bg-bq-action text-bq-ink shadow-bq-action inline-block"
          >
            {t('auth.login')}
          </Link>
        </div>
      </div>
    )
  }

  // --- Loading ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-bq-hair border-t-bq-amberd rounded-full animate-spin" />
        <p className="text-bq-ink2 font-medium">{t('achievements.loading')}</p>
      </div>
    )
  }

  return (
    <>
      {/* -- Header -------------------------------------------------- */}
      <header className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-bq-ink mb-2">
              {t('achievements.title')}
            </h1>
            <p className="text-bq-ink2 flex items-center gap-2">
              <span
                className="material-symbols-outlined text-bq-amberd text-sm"
                style={FILL_STYLE}
              >
                stars
              </span>
              {earnedCount}/{achievements.length} {t('achievements.unlocked')}
            </p>
          </div>
          <div className="w-full md:w-72">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-bq-ink2">
              <span>{t('achievements.overallProgress')}</span>
              <span className="text-bq-amberd">{overallProgress}%</span>
            </div>
            <div className="h-3 w-full bg-bq-inset rounded-full overflow-hidden">
              <div
                className="h-full bg-bq-action rounded-full transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* -- Main Grid Layout ---------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Content */}
        <div className="md:col-span-8 lg:col-span-9 space-y-10">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-bq-hair">
            {visibleCategories.map((cat) => {
              const isActive = activeTab === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTab(cat.key)}
                  className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'font-bold bg-bq-amber text-bq-ink'
                      : 'font-medium text-bq-ink2 hover:bg-bq-inset'
                  }`}
                >
                  {t(cat.labelKey)}
                </button>
              )
            })}
          </div>

          {/* Achievement Cards Grid */}
          {filteredAchievements.length === 0 ? (
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-3xl p-16 text-center">
              <span className="material-symbols-outlined text-6xl text-bq-ink3 mb-4 block">
                emoji_events
              </span>
              <h3 className="text-xl font-bold text-bq-ink mb-2">{t('achievements.noAchievements')}</h3>
              <p className="text-bq-ink2">
                {t('achievements.playToUnlock')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAchievements.map((achievement) => {
                const isUnlocked = !!achievement.unlockedAt
                const catMeta = getCategoryMeta(achievement.category)

                if (isUnlocked) {
                  return (
                    <div
                      key={achievement.id}
                      className="bg-bq-white p-6 rounded-xl border border-bq-amber/30 shadow-bq-amb relative overflow-hidden group"
                    >
                      {/* Glow orb */}
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-bq-amber/10 rounded-full blur-2xl group-hover:bg-bq-amber/20 transition-colors" />

                      {/* Top row: icon + status */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-full bg-bq-action flex items-center justify-center shadow-bq-action">
                          <span
                            className="material-symbols-outlined text-white text-3xl"
                            style={FILL_STYLE}
                          >
                            {achievement.icon || catMeta.icon}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-bq-amberd bg-bq-amber/10 px-2 py-1 rounded">
                          {t('achievements.unlocked')}
                        </span>
                      </div>

                      {/* Name & description */}
                      <h3 className="text-lg font-bold text-bq-ink mb-1">
                        {achievement.name}
                      </h3>
                      <p className="text-sm text-bq-ink2 leading-relaxed mb-4">
                        {achievement.description}
                      </p>

                      {/* Footer: date */}
                      <div className="pt-4 border-t border-bq-hair flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs text-bq-ink2">
                          calendar_today
                        </span>
                        <span className="text-[11px] text-bq-ink2 font-medium">
                          {t('achievements.earnedOn', { date: new Date(achievement.unlockedAt!).toLocaleDateString('vi-VN') })}
                        </span>
                      </div>
                    </div>
                  )
                }

                // Locked card
                return (
                  <div
                    key={achievement.id}
                    className="bg-bq-inset p-6 rounded-xl border border-bq-hair opacity-80 grayscale relative overflow-hidden"
                  >
                    {/* Top row: icon + lock */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-full bg-bq-white border border-bq-hair flex items-center justify-center">
                        <span className="material-symbols-outlined text-bq-ink3 text-3xl">
                          {achievement.icon || catMeta.icon}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-bq-ink3 text-sm">
                        lock
                      </span>
                    </div>

                    {/* Name & description */}
                    <h3 className="text-lg font-bold text-bq-ink2 mb-1">
                      {achievement.name}
                    </h3>
                    <p className="text-sm text-bq-ink3 leading-relaxed mb-4">
                      {achievement.description}
                    </p>

                    {/* Footer: progress bar */}
                    <div className="pt-4 border-t border-bq-hair">
                      <div className="h-1.5 w-full bg-bq-white rounded-full overflow-hidden">
                        <div className="h-full bg-bq-ink3 rounded-full" style={{ width: '0%' }} />
                      </div>
                      <p className="text-[10px] text-bq-ink3 font-medium mt-2">
                        {t('achievements.locked')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Stats */}
        <aside className="md:col-span-4 lg:col-span-3 space-y-8">
          {/* Recently Unlocked */}
          <section className="bg-bq-white border border-bq-hair shadow-bq-soft p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-bq-ink mb-6 flex items-center gap-2">
              {t('achievements.recentlyEarned')}
            </h2>
            <div className="space-y-6">
              {recentUnlocked.length === 0 ? (
                <p className="text-sm text-bq-ink2">{t('achievements.noAchievements')}</p>
              ) : (
                recentUnlocked.map((a) => {
                  const catMeta = getCategoryMeta(a.category)
                  return (
                    <div key={a.id} className="flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-xl bg-bq-action flex-shrink-0 flex items-center justify-center shadow-bq-action">
                        <span
                          className="material-symbols-outlined text-white text-2xl"
                          style={FILL_STYLE}
                        >
                          {a.icon || catMeta.icon}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-bq-ink group-hover:text-bq-amberd transition-colors">
                          {a.name}
                        </p>
                        <p className="text-[11px] text-bq-ink2">
                          {a.description}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <button className="w-full mt-8 py-3 rounded-xl border border-bq-hair text-xs font-bold text-bq-ink2 hover:bg-bq-inset hover:text-bq-ink transition-all">
              {t('achievements.viewAllHistory')}
            </button>
          </section>

          {/* Gamification Summary / Season Stats */}
          <section className="bg-bq-white border border-bq-hair shadow-bq-soft p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <span className="material-symbols-outlined text-8xl">trophy</span>
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-bq-amberd mb-4">
              {t('achievements.seasonStats')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-bq-ink2">{t('achievements.currentRank')}</span>
                <span className="text-sm font-bold text-bq-ink">
                  {t(`tiers.${tierData.current.name}`)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-bq-ink2">{t('achievements.experiencePoints')}</span>
                <span className="text-sm font-bold text-bq-ink">
                  {((stats.totalPoints ?? totalPoints) ?? 0).toLocaleString()} XP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-bq-ink2">{t('achievements.accuracy')}</span>
                <span className="text-sm font-bold text-bq-ink">
                  {stats.accuracy || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-bq-ink2">{t('achievements.longestStreak')}</span>
                <span className="text-sm font-bold text-bq-ink">
                  {stats.longestStreak || 0} {t('common.days')}
                </span>
              </div>
            </div>
          </section>

          {/* Tier Progress (compact sidebar version) */}
          <section className={`bg-bq-white shadow-bq-soft p-6 rounded-2xl border ${tierData.current.borderColor}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-xl ${tierData.current.bgColor} flex items-center justify-center`}>
                <span
                  className={`material-symbols-outlined text-3xl ${tierData.current.textColor}`}
                  style={FILL_STYLE}
                >
                  {tierData.current.icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-black text-bq-ink">{t(`tiers.${tierData.current.name}`)}</p>
                {tierData.next && (
                  <p className="text-[11px] text-bq-ink2">
                    {t('achievements.nextTier')}: {t(`tiers.${tierData.next.name}`)}
                  </p>
                )}
              </div>
            </div>
            {tierData.next ? (
              <>
                <div className="h-2 w-full bg-bq-inset rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${tierData.progress}%`,
                      background: `linear-gradient(135deg, ${tierData.current.color} 0%, ${tierData.next.color} 100%)`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-bq-ink2 font-medium">
                  {stats.totalPoints || totalPoints} / {tierData.next.minPoints} {t('achievements.pointsUnit')}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-bq-ink2 italic">
                {t('achievements.maxTier')}
              </p>
            )}
          </section>

          {/* Promotional Event Banner */}
          <div className="rounded-2xl overflow-hidden h-48 relative group cursor-pointer shadow-bq-soft">
            <div className="w-full h-full bg-bq-flame" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-bq-amber mb-1">
                {t('achievements.specialEvent')}
              </p>
              <h4 className="text-sm font-bold text-white leading-tight">
                {t('achievements.unlockLimitedBadge')}
              </h4>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

export default Achievements
