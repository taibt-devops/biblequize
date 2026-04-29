import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { getTimeOfDayGreeting } from '../utils/greeting'
import { getHeroTierAvatar } from '../utils/tierAvatar'

/**
 * Mirror of {@code TierProgressData} used by TierProgressBar — we
 * subscribe to the same /api/me/tier-progress endpoint here so the
 * sub-tier star row stays in sync with that component when both are
 * mounted in different surfaces.
 */
interface TierProgressData {
  tierLevel: number
  starIndex: number
  starProgressPercent: number
}

/**
 * V3 Home hero — RPG-style stat sheet.
 *
 * Layout: avatar (80px, gold ring, tier emoji) on the left; on the
 * right, greeting + uppercase tier label + a 3-column stats grid
 * (streak / points / tier-id) divided by 1px gold dividers, then the
 * gold progress bar with a star row + remaining-points caption.
 *
 * Tier 6 collapses the progress section into a single max-tier line
 * since there's nothing left to grind toward.
 */
export default function HeroStatSheet() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Authoritative star row — falls back gracefully when the endpoint
  // hasn't responded yet so the layout doesn't shift.
  const { data: tierProgressData } = useQuery<TierProgressData>({
    queryKey: ['tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data),
    staleTime: 30_000,
  })

  const totalPoints = meData?.totalPoints ?? 0
  const currentStreak = meData?.currentStreak ?? 0
  const tier = getTierInfo(totalPoints)
  const greeting = getTimeOfDayGreeting(t)
  const userName = user?.name || t('home.defaultName')
  const avatar = getHeroTierAvatar(tier.current.id)
  const tierName = t(tier.current.nameKey)
  const isMaxTier = tier.current.id >= 6
  const starIndex = tierProgressData?.starIndex ?? 0

  return (
    <section data-testid="home-hero" className="hero-v3">
      <div data-testid="home-hero-avatar" className="hero-v3-avatar" aria-hidden="true">
        {avatar}
      </div>

      <div className="hero-v3-content">
        <h1 data-testid="home-greeting" className="hero-v3-greeting">
          {greeting}, <span data-testid="home-user-name">{userName}</span>!
        </h1>
        <div className="hero-v3-tier-label">
          <span data-testid="home-tier-name">{tierName}</span> • {t('home.tierLabel', { defaultValue: 'Tier' })} {tier.current.id}
        </div>

        <div className="hero-v3-divider-line" />

        <div className="hero-v3-stats-grid">
          <StatCell
            label={t('home.statStreak', { defaultValue: 'Streak' })}
            value={t('home.statStreakValue', {
              count: currentStreak,
              defaultValue: `${currentStreak} ngày`,
            })}
            fire={currentStreak > 0}
            testId="home-stat-streak"
          />
          <StatCell
            label={t('home.statPoints', { defaultValue: 'Điểm' })}
            value={totalPoints.toLocaleString('vi-VN')}
            testId="home-total-points"
          />
          <StatCell
            label={t('home.statTier', { defaultValue: 'Tier' })}
            value={String(tier.current.id)}
            testId="home-stat-tier"
          />
        </div>

        {isMaxTier ? (
          <p data-testid="home-max-tier-msg" className="hero-v3-max-tier">
            👑 {t('home.maxTierReached')}
          </p>
        ) : (
          <>
            <div className="hero-v3-progress-bar">
              <div
                className="hero-v3-progress-fill gold-gradient"
                style={{ width: `${tier.progressPct}%` }}
              />
            </div>
            <p className="hero-v3-progress-label">
              <span data-testid="home-hero-stars" className="hero-v3-stars">
                {renderStars(starIndex)}
              </span>
              {'  '}
              {t('home.pointsToNext', {
                points: tier.pointsToNext.toLocaleString('vi-VN'),
                tier: tier.next ? t(tier.next.nameKey) : '',
              })}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

interface StatCellProps {
  label: string
  value: string
  fire?: boolean
  testId?: string
}

function StatCell({ label, value, fire, testId }: StatCellProps) {
  return (
    <div className="hero-v3-stat-cell">
      <div className="hero-v3-stat-label">{label}</div>
      <div data-testid={testId} className={`hero-v3-stat-value ${fire ? 'fire' : ''}`}>
        {value}
      </div>
    </div>
  )
}

/** Five-star sub-tier indicator. {@code filled} is 0..5. */
function renderStars(filled: number): string {
  const safe = Math.max(0, Math.min(5, filled | 0))
  return '★'.repeat(safe) + '☆'.repeat(5 - safe)
}
