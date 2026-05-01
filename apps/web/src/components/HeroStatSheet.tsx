import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { getTimeOfDayGreeting } from '../utils/greeting'

/**
 * Mirror of {@code TierProgressData} on the BE — same query key as
 * TierProgressBar so the two components share a single fetch.
 */
interface TierProgressData {
  tierLevel: number
  starIndex: number
  starProgressPercent: number
  starXp: number
  nextStarXp: number
}

/** Subset of /api/me/ranked-status used by the hero footer. */
interface RankedStatusData {
  currentBook?: string | null
  questionsCounted?: number
}

/**
 * V4 Home hero — Sacred Modernist v2 (mockup:
 * docs/designs/biblequiz_home_redesign_proposal.html).
 *
 * Top row: greeting label + user name on the left, tier-color pill on
 * the right. Below: 5-star sub-tier indicator with an
 * "X / Y XP to next star" caption (denominator varies per tier; pulled
 * from /tier-progress.starXp/.nextStarXp). Then a 6px gold progress
 * bar, and a footer that adapts to viewport:
 *   - desktop: "current book" + "questions today" inline divider
 *   - mobile (< md): two stat boxes (streak + today) since the
 *     AppLayout sidebar — which normally surfaces streak — is hidden
 *     on small screens.
 *
 * Tier pill background uses {@code tier.colorHex} from the canonical
 * tiers table; mockup labels are intentionally ignored when they
 * disagree (see PROMPT_HOME_REDESIGN.md pre-flight notes).
 */
export default function HeroStatSheet() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: tierProgressData } = useQuery<TierProgressData>({
    queryKey: ['tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: rankedStatus } = useQuery<RankedStatusData>({
    queryKey: ['ranked-status'],
    queryFn: () => api.get('/api/me/ranked-status').then(r => r.data),
    staleTime: 60_000,
  })

  const totalPoints = meData?.totalPoints ?? 0
  const currentStreak = meData?.currentStreak ?? 0
  const tier = getTierInfo(totalPoints)
  const greeting = getTimeOfDayGreeting(t)
  const userName = user?.name || t('home.defaultName')
  const tierName = t(tier.current.nameKey)
  const isMaxTier = tier.current.id >= 6
  const starIndex = tierProgressData?.starIndex ?? 0

  // Star-window math — derived from tier-progress so the denominator
  // matches what the backend used to compute starProgressPercent
  // (varies per tier: 200 / 800 / 2000 / 5000 / 12000).
  const starXp = tierProgressData?.starXp ?? 0
  const nextStarXp = tierProgressData?.nextStarXp ?? starXp
  const starWindow = Math.max(1, nextStarXp - starXp)
  const pointsInCurrentStar = Math.max(0, totalPoints - starXp)

  const currentBook = rankedStatus?.currentBook || null
  const questionsToday = rankedStatus?.questionsCounted ?? 0

  return (
    <section
      data-testid="home-hero"
      className="rounded-2xl border border-secondary/25 bg-gradient-to-b from-[rgba(50,52,64,0.7)] to-[rgba(30,32,44,0.7)] p-4 md:p-5"
    >
      {/* Top row: greeting + name (left) | tier pill (right) */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div
            data-testid="home-greeting"
            className="text-[10px] md:text-[11px] uppercase tracking-[0.5px] md:tracking-[0.8px] text-on-surface-variant/80 mb-0.5"
          >
            {greeting}
          </div>
          <div
            data-testid="home-user-name"
            className="text-base md:text-lg font-medium text-on-surface truncate"
          >
            {userName}
          </div>
        </div>
        <span
          data-testid="home-tier-pill"
          className="shrink-0 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-medium"
          style={{ background: tier.current.colorHex, color: '#11131e' }}
        >
          <span data-testid="home-tier-name">{tierName}</span>
        </span>
      </div>

      {isMaxTier ? (
        <p
          data-testid="home-max-tier-msg"
          className="text-sm font-semibold text-secondary mt-1"
        >
          👑 {t('home.maxTierReached')}
        </p>
      ) : (
        <>
          {/* Stars row + caption */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              data-testid="home-hero-stars"
              className="text-secondary text-sm tracking-[2px]"
            >
              {renderStars(starIndex)}
            </span>
            <span
              data-testid="home-hero-stars-caption"
              className="ml-auto text-[11px] text-on-surface-variant/70 hidden md:inline"
            >
              {t('home.hero.starsToNext', { points: pointsInCurrentStar, total: starWindow })}
            </span>
            <span
              data-testid="home-hero-stars-caption-mobile"
              className="ml-auto text-[11px] text-on-surface-variant/70 md:hidden"
            >
              {t('home.hero.starsToNextMobile', { points: pointsInCurrentStar, total: starWindow })}
            </span>
          </div>

          {/* Progress bar — 6px gold fill */}
          <div className="bg-white/[0.06] rounded-[3px] h-[6px] overflow-hidden mb-3">
            <div
              data-testid="home-hero-progress-fill"
              className="gold-gradient h-full rounded-[3px] transition-[width] duration-500"
              style={{ width: `${tier.progressPct}%` }}
            />
          </div>

          {/* Desktop footer: 📖 currentBook · 🎯 questionsToday */}
          <div
            data-testid="home-hero-footer"
            className="hidden md:flex items-center gap-2 pt-1 border-t border-white/[0.06] text-[11px] text-on-surface-variant/55"
          >
            {currentBook && (
              <>
                <span data-testid="home-hero-current-book">
                  {t('home.hero.currentBook', { book: currentBook })}
                </span>
                <span className="text-white/30">·</span>
              </>
            )}
            <span data-testid="home-hero-questions-today">
              {t('home.hero.questionsToday', { count: questionsToday })}
            </span>
          </div>

          {/* Mobile-only stat boxes — sidebar widgets aren't visible on
              mobile, so surface streak + today's questions inline. */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            <div className="rounded-md px-2 py-1.5 bg-[rgba(255,140,66,0.08)]">
              <div className="text-[9px] tracking-[0.4px] text-[rgba(255,140,66,0.7)]">
                {t('home.hero.mobileStreakLabel')}
              </div>
              <div
                data-testid="home-mobile-streak"
                className="text-sm font-medium text-[#ff8c42]"
              >
                {currentStreak}{' '}
                <span className="text-[10px] text-on-surface-variant/50 font-normal">
                  {t('home.hero.streakUnit')}
                </span>
              </div>
            </div>
            <div className="rounded-md px-2 py-1.5 bg-[rgba(74,158,255,0.08)]">
              <div className="text-[9px] tracking-[0.4px] text-[rgba(74,158,255,0.7)]">
                {t('home.hero.mobileTodayLabel')}
              </div>
              <div
                data-testid="home-mobile-today"
                className="text-sm font-medium text-[#4a9eff]"
              >
                {questionsToday}{' '}
                <span className="text-[10px] text-on-surface-variant/50 font-normal">
                  {t('home.hero.todayUnit')}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/** Five-star sub-tier indicator. {@code filled} is 0..5. */
function renderStars(filled: number): string {
  const safe = Math.max(0, Math.min(5, filled | 0))
  return '★'.repeat(safe) + '☆'.repeat(5 - safe)
}
