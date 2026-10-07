import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { getTimeOfDayGreeting } from '../utils/greeting'
import { localizeSeasonName } from '../utils/seasonName'

interface TierProgressData {
  tierLevel: number
  starIndex: number
  starProgressPercent: number
  starXp: number
  nextStarXp: number
  /** Running total preferred over /api/me.totalPoints (which can lag a few
   *  seconds after a session is credited). */
  totalPoints?: number
}

interface RankedStatusData {
  /** BE field is `livesRemaining` — keep `energy` as legacy alias for any
   *  consumer that still reads it. Bug-fix 2026-05-14: HomeBanner had been
   *  reading `energy` exclusively, which never exists in the actual
   *  response, so the stat pill always rendered the 100 fallback instead
   *  of real lives. */
  livesRemaining?: number
  energy?: number
  seasonPoints?: number
  currentBook?: string | null
}

interface ActiveSeasonData {
  active: boolean
  id?: string
  name?: string
}

type StatIcon = 'flame' | 'bolt' | 'trophy'

/**
 * Home banner — sport-app typography per home_modern.html `.banner`
 * (HR-2 redesign, replaces GreetingCard). Keeps the home-greeting-*
 * testids so existing Home.test.tsx specs pass without churn.
 *
 * Visual contract:
 * - Avatar 72px gold gradient + inset highlight + dashed gold ring
 * - Name sans 800 30px ivory, tight tracking
 * - Tier row: current (gold) → next (ivory-dim) + 5px progress with
 *   terminal dot + tabular-nums XP/next
 * - 3 stats with line SVG icons, sans 800 22px tabular-nums numbers,
 *   uppercase tracked labels. Streak flame breathes via animate-breathe.
 */
export default function HomeBanner() {
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

  // Active season name drives the trophy stat label (e.g. "Mùa Ngũ Tuần")
  // so users understand the number is season-scoped, not all-time. Falls
  // back to the static "Đấu Hạng" i18n value when no season is active
  // (off-season window). Long TTL — season names don't change mid-day.
  const { data: activeSeason } = useQuery<ActiveSeasonData>({
    queryKey: ['active-season'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 30 * 60_000,
  })

  const totalPoints = tierProgress?.totalPoints ?? meData?.totalPoints ?? 0
  const currentStreak = meData?.currentStreak ?? 0
  const energy = rankedStatus?.livesRemaining ?? rankedStatus?.energy ?? 100
  const seasonPoints = rankedStatus?.seasonPoints ?? 0
  const seasonLabel = activeSeason?.active && activeSeason.name
    ? (localizeSeasonName(activeSeason.name, t) ?? activeSeason.name)
    : t('home.greeting.seasonPoints')
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
      className="relative overflow-hidden rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-soft p-4 md:p-7 mb-5"
    >
      {/* Spectrum signature strip along the top edge */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[4px] bg-bq-spectrum pointer-events-none"
      />
      {/* Warm radial glow top-left */}
      <div
        aria-hidden
        className="absolute -top-[40%] -left-[10%] w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.12), transparent 65%)' }}
      />

      <div className="relative z-10 grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-x-4 md:gap-x-7 gap-y-3 md:gap-y-0 items-center">
        {/* Avatar */}
        <div
          data-testid="home-greeting-avatar"
          className="relative w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-full grid place-items-center text-[22px] md:text-[28px] font-extrabold text-[#1a1208] shrink-0"
          style={{
            background: 'linear-gradient(135deg, #e8a832 0%, #c98a1c 70%, #7a5818 100%)',
            boxShadow:
              '0 0 30px rgba(232,168,50,0.30), inset 0 -8px 16px rgba(122,88,24,0.4), inset 0 4px 8px rgba(255,220,140,0.5)',
          }}
        >
          {initial}
          <span
            aria-hidden
            className="absolute -inset-[3px] rounded-full border border-[rgba(232,168,50,0.25)] pointer-events-none"
          />
        </div>

        {/* Info: greet + name + tier row + inline progress (desktop) */}
        <div className="min-w-0">
          <div
            data-testid="home-greeting-meta"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bq-amberd mb-1 md:mb-1.5"
          >
            {greeting}
          </div>
          {/* HO-2: de-emphasized username (smaller + lighter weight, single
              truncated line) so the tier + XP progress below become the
              banner's visual focus. */}
          <div
            data-testid="home-greeting-name"
            className="font-display text-[18px] md:text-[24px] font-extrabold leading-[1.15] text-bq-ink tracking-[-0.02em] mb-1.5 md:mb-3 truncate"
          >
            {userName}
          </div>

          {isMaxTier ? (
            <div
              data-testid="home-greeting-max-tier"
              className="text-sm font-semibold text-bq-amberd"
            >
              👑 {t('home.maxTierReached')}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3.5 text-[13px]">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span
                  data-testid="home-greeting-tier-label"
                  className="font-display text-bq-amberd font-extrabold tracking-[0.01em] text-[17px] md:text-[20px]"
                >
                  {t(tier.current.nameKey)}
                </span>
                <span className="text-bq-ink3">→</span>
                <span className="text-bq-ink2 font-medium">
                  {tier.next && t(tier.next.nameKey)}
                </span>
              </div>

              {/* Desktop-only inline progress (carries the testIDs).
                  `display:contents` lets the bar + XP flow as direct flex
                  children of the tier row on md+, matching the original
                  Modern Spiritual inline layout. */}
              <div className="hidden md:contents">
                <div
                  data-testid="home-greeting-progress-bar"
                  className="relative flex-1 md:max-w-[240px] h-[5px] bg-bq-inset border border-bq-hair rounded-full overflow-visible"
                >
                  <div
                    data-testid="home-greeting-progress-fill"
                    className="h-full rounded-full relative transition-[width] duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: 'linear-gradient(90deg,#2F6FB0,#2E7D4F 34%,#F59E0B 64%,#B3452F)',
                      boxShadow: '0 2px 10px -2px rgba(47,111,176,0.4)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute right-0 -top-[3px] w-[11px] h-[11px] rounded-full"
                      style={{ background: '#F59E0B', boxShadow: '0 0 12px rgba(245,158,11,0.7)' }}
                    />
                  </div>
                  <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span
                        key={i}
                        data-testid={`home-greeting-milestone-${i}`}
                        className={`w-1 h-1 rounded-full ${
                          i < starIndex
                            ? 'bg-bq-amber shadow-[0_0_4px_rgba(245,158,11,0.6)]'
                            : 'bg-bq-hair'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <span
                  data-testid="home-greeting-progress-pct"
                  className="whitespace-nowrap tabular-nums font-bold text-[14px] text-right"
                >
                  <span className="text-secondary">{totalPoints.toLocaleString()}</span>
                  <span className="text-ivory-faint text-[12px] font-medium">
                    {' '}
                    / {tier.next?.minPoints.toLocaleString()} XP
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile-only progress row (col-span-2, full card width, no testIDs to avoid duplicate match) */}
        {!isMaxTier && (
          <div className="col-span-2 md:hidden flex items-center gap-3">
            <div
              aria-label="XP progress"
              className="relative flex-1 h-[5px] bg-bq-inset border border-bq-hair rounded-full overflow-visible"
            >
              <div
                className="h-full rounded-full relative transition-[width] duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #c98a1c, #e8a832 50%, #e7c268)',
                  boxShadow: '0 0 12px rgba(232,168,50,0.5)',
                }}
              >
                <span
                  aria-hidden
                  className="absolute right-0 -top-[3px] w-[11px] h-[11px] rounded-full"
                  style={{ background: '#F59E0B', boxShadow: '0 0 12px rgba(245,158,11,0.7)' }}
                />
              </div>
              <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
                {[0, 1, 2, 3, 4].map(i => (
                  <span
                    key={i}
                    aria-hidden
                    className={`w-1 h-1 rounded-full ${
                      i < starIndex
                        ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]'
                        : 'bg-white/25'
                    }`}
                  />
                ))}
              </div>
            </div>

            <span className="whitespace-nowrap tabular-nums font-bold text-[14px] text-right">
              <span className="text-bq-amberd">{totalPoints.toLocaleString()}</span>
              <span className="text-bq-ink3 text-[12px] font-medium">
                {' '}
                / {tier.next?.minPoints.toLocaleString()} XP
              </span>
            </span>
          </div>
        )}

        {/* Stats — HO-2/HO-5: more breathing room on mobile (gap + padding)
            so the three chips aren't cramped and the season label has room. */}
        <div
          data-testid="home-greeting-stats"
          className="col-span-2 md:col-span-1 flex justify-between gap-2 md:justify-start md:gap-1 pt-3 mt-1 md:mt-0 md:pt-0 border-t md:border-t-0 border-bq-hair"
        >
          <Stat
            icon="flame"
            testId="home-greeting-stat-streak"
            value={currentStreak}
            label={t('home.greeting.streak')}
          />
          <Stat
            icon="bolt"
            testId="home-greeting-stat-energy"
            value={energy}
            label={t('home.greeting.energy')}
          />
          <Stat
            icon="trophy"
            testId="home-greeting-stat-season"
            value={seasonPoints}
            label={seasonLabel}
          />
        </div>
      </div>
    </section>
  )
}

interface StatProps {
  icon: StatIcon
  testId: string
  value: number
  label: string
}

function Stat({ icon, testId, value, label }: StatProps) {
  // HR-13b (2026-05-14): revert SVG icons → emoji per Bui — native
  // OS color rendering gives the same vivid look the old GreetingCard
  // had (🔥 ember-orange, ⚡ saturated gold, 🏆 trophy gold) without
  // per-icon SVG art. animate-breathe still pulses the flame.
  const glyph = icon === 'flame' ? '🔥' : icon === 'bolt' ? '⚡' : '🏆'
  return (
    <div
      data-testid={testId}
      className="flex-1 md:flex-none text-center px-1.5 md:px-3.5 py-1 md:py-2 md:min-w-[70px] border-r last:border-r-0 border-bq-hair"
    >
      <div
        className={`text-[20px] md:text-[22px] leading-none mb-1 select-none ${
          icon === 'flame' ? 'animate-breathe' : ''
        }`}
        aria-hidden
      >
        {glyph}
      </div>
      <div className="font-display text-[22px] md:text-[24px] font-extrabold text-bq-ink tabular-nums leading-none tracking-[-0.02em]">
        {value.toLocaleString()}
      </div>
      {/* HO-2: relaxed tracking + normal leading + wrap so a long season
          label ("Mùa ... 2026") no longer clips. */}
      <div className="text-[9px] font-semibold uppercase tracking-[0.06em] leading-[1.2] text-bq-ink3 mt-1 break-words">
        {label}
      </div>
    </div>
  )
}
