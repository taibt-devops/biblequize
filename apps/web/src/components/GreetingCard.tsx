import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { getTimeOfDayGreeting } from '../utils/greeting'

interface TierProgressData {
  tierLevel: number
  starIndex: number
  starProgressPercent: number
  starXp: number
  nextStarXp: number
  /** Authoritative running total — preferred over /api/me.totalPoints
   *  which can lag for a few seconds after a session is credited. */
  totalPoints?: number
}

interface RankedStatusData {
  energy?: number
  seasonPoints?: number
  currentBook?: string | null
}

/**
 * Home greeting hero (mockup: docs/designs/home_redesign_mockup.html `.greeting-card`).
 *
 * Layout: avatar + tier badge | greeting/name/tier-progress | 3 inline stats.
 * Tier progress is a SEGMENTED bar with 5 milestone dots (sub-stars from
 * /api/me/tier-progress.starIndex), NOT a 5-star rating UI. Replaced the
 * older HeroStatSheet — kept identical query keys so the cache is shared.
 */
export default function GreetingCard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: tierProgress } = useQuery<TierProgressData>({
    queryKey: ['tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: rankedStatus } = useQuery<RankedStatusData>({
    queryKey: ['ranked-status'],
    queryFn: () => api.get('/api/me/ranked-status').then(r => r.data),
    staleTime: 60_000,
  })

  // Match Home.tsx: tier-progress is the source of truth, /api/me is fallback.
  const totalPoints = tierProgress?.totalPoints ?? meData?.totalPoints ?? 0
  const currentStreak = meData?.currentStreak ?? 0
  const energy = rankedStatus?.energy ?? 100
  const seasonPoints = rankedStatus?.seasonPoints ?? 0
  const tier = getTierInfo(totalPoints)
  const greeting = getTimeOfDayGreeting(t)
  const userName = user?.name || t('home.defaultName')
  const initial = (userName || '?').charAt(0).toUpperCase()
  const isMaxTier = tier.next === null

  const starIndex = Math.max(0, Math.min(5, tierProgress?.starIndex ?? 0))
  const progressPct = tier.progressPct

  return (
    <section
      data-testid="home-greeting-card"
      className="rounded-2xl border border-secondary/15 bg-[rgba(50,52,64,0.4)] backdrop-blur-md p-4 md:p-6"
    >
      <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-3.5 md:gap-6 items-center">
        {/* Avatar + tier badge — 52px mobile, 72px desktop per mockup */}
        <div className="relative w-fit">
          <div
            data-testid="home-greeting-avatar"
            className="w-[52px] h-[52px] md:w-[72px] md:h-[72px] rounded-full grid place-items-center text-[20px] md:text-[28px] font-bold gold-gradient text-[#11131e] shadow-[0_4px_16px_rgba(232,168,50,0.25)] md:shadow-[0_6px_20px_rgba(232,168,50,0.3)]"
          >
            {initial}
          </div>
          <div
            data-testid="home-greeting-tier-badge"
            className="absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-[22px] h-[22px] md:w-7 md:h-7 rounded-full grid place-items-center text-[11px] md:text-sm bg-gradient-to-br from-[#11131e] to-[#1a1d2e] border-2 border-secondary"
            title={t(tier.current.nameKey)}
          >
            {tier.current.iconEmoji}
          </div>
        </div>

        {/* Greeting + name + tier progress */}
        <div className="min-w-0">
          <div
            data-testid="home-greeting-meta"
            className="text-[11px] font-semibold uppercase tracking-[0.8px] text-on-surface-variant mb-1"
          >
            {greeting}
          </div>
          <div
            data-testid="home-greeting-name"
            className="text-[20px] md:text-[22px] font-extrabold leading-tight mb-2 truncate"
          >
            {userName}
          </div>

          {isMaxTier ? (
            <div
              data-testid="home-greeting-max-tier"
              className="text-sm font-semibold text-secondary"
            >
              👑 {t('home.maxTierReached')}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div
                data-testid="home-greeting-tier-label"
                className="text-[13px] text-on-surface-variant flex items-center gap-1.5 whitespace-nowrap"
              >
                <strong className="text-secondary font-bold">{t(tier.current.nameKey)}</strong>
                <span className="material-symbols-outlined text-[14px] text-outline">
                  arrow_forward
                </span>
                {tier.next && t(tier.next.nameKey)}
              </div>

              {/* Segmented progress bar with 5 milestone dots */}
              <div
                data-testid="home-greeting-progress-bar"
                className="relative flex-1 h-2 bg-white/[0.06] rounded-[4px] overflow-hidden max-w-[280px]"
              >
                <div
                  data-testid="home-greeting-progress-fill"
                  className="h-full bg-[linear-gradient(90deg,#d97706_0%,#e8a832_50%,#fbbf24_100%)] rounded-[4px] transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
                <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
                  {[0, 1, 2, 3, 4].map(i => (
                    <span
                      key={i}
                      data-testid={`home-greeting-milestone-${i}`}
                      className={`w-1 h-1 rounded-full ${
                        i < starIndex
                          ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]'
                          : 'bg-white/25'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div
                data-testid="home-greeting-progress-pct"
                className="text-xs font-bold text-secondary tabular-nums whitespace-nowrap"
              >
                {totalPoints.toLocaleString()} / {tier.next?.minPoints.toLocaleString()} XP
              </div>
            </div>
          )}
        </div>

        {/* Stats — desktop: third grid col with left border separator;
            mobile: full-width inner panel below the avatar/info row. */}
        <div
          data-testid="home-greeting-stats"
          className="col-span-2 md:col-span-1 md:pl-6 md:border-l md:border-white/[0.06] grid grid-cols-3 md:flex md:gap-5 bg-[rgba(17,19,30,0.4)] md:bg-transparent rounded-xl md:rounded-none px-2 py-2.5 md:p-0 mt-1 md:mt-0"
        >
          <Stat
            testId="home-greeting-stat-streak"
            icon="🔥"
            value={currentStreak}
            label={t('home.greeting.streak')}
          />
          <Stat
            testId="home-greeting-stat-energy"
            icon="⚡"
            value={energy}
            label={t('home.greeting.energy')}
            withDivider
          />
          <Stat
            testId="home-greeting-stat-season"
            icon="📊"
            value={seasonPoints}
            label={t('home.greeting.seasonPoints')}
            withDivider
          />
        </div>
      </div>
    </section>
  )
}

function Stat({
  testId,
  icon,
  value,
  label,
  withDivider,
}: {
  testId: string
  icon: string
  value: number
  label: string
  /** Mobile-only left border separator between cells (mockup `.gs-cell + .gs-cell`). */
  withDivider?: boolean
}) {
  return (
    <div
      data-testid={testId}
      className={`text-center ${withDivider ? 'border-l border-secondary/[0.06] md:border-0' : ''}`}
    >
      <div className="text-[16px] md:text-[22px] leading-none">{icon}</div>
      <div className="text-[15px] md:text-[18px] font-extrabold leading-none mt-1">
        {value.toLocaleString()}
      </div>
      <div className="text-[9px] md:text-[10px] uppercase tracking-[0.4px] md:tracking-[0.5px] text-on-surface-variant mt-1">
        {label}
      </div>
    </div>
  )
}
