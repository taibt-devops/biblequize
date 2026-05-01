import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import FeaturedCard from './FeaturedCard'

/**
 * Mirrors {@code BasicQuizStatusResponse} on the BE. Reused by
 * BasicQuizCard (the standalone banner) and this component — both
 * subscribe to the same TanStack Query key so a successful catechism
 * submit invalidating ['basic-quiz-status'] flips this card from State
 * B → State A in real time, no refetch from the consumer needed.
 */
interface BasicQuizStatus {
  passed: boolean
  cooldownRemainingSeconds: number
  attemptCount: number
  totalQuestions: number
  threshold: number
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds | 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Ranked card in the Home featured grid. Three states:
 *   A — passed:           unlock badge + CTA → /ranked
 *   B — not passed, idle: "needs catechism" hint + CTA → /basic-quiz
 *   C — cooldown active:  countdown panel + CTA disabled
 *
 * Loading: render the State A shell with a muted CTA so the layout
 * doesn't shift when /status resolves — the BasicQuizCard banner above
 * already handled the same flicker problem this way.
 */
interface RankedFeaturedCardProps {
  isRecommended?: boolean
  recommendReason?: string
}

export default function RankedFeaturedCard({ isRecommended, recommendReason }: RankedFeaturedCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [localCooldown, setLocalCooldown] = useState(0)

  const { data, isLoading, refetch } = useQuery<BasicQuizStatus>({
    queryKey: ['basic-quiz-status'],
    queryFn: () => api.get('/api/basic-quiz/status').then(r => r.data),
    staleTime: 30_000,
  })

  // Sync local ticker on fresh server data.
  useEffect(() => {
    if (data) setLocalCooldown(data.cooldownRemainingSeconds)
  }, [data])

  // Tick down each second; refetch on hit-zero so we don't trust the
  // local clock for the "may submit?" decision.
  useEffect(() => {
    if (localCooldown <= 0) return
    const id = window.setInterval(() => {
      setLocalCooldown(prev => {
        const next = prev - 1
        if (next <= 0) {
          refetch()
          return 0
        }
        return next
      })
    }, 1_000)
    return () => window.clearInterval(id)
  }, [localCooldown, refetch])

  const passed = !!data?.passed
  const inCooldown = !passed && localCooldown > 0
  const totalQuestions = data?.totalQuestions ?? 10

  const title = t('rankedFeatured.title')
  const description = t('rankedFeatured.description')

  // Loading skeleton — keep the same shape as State A so layout is stable.
  if (isLoading || !data) {
    return (
      <FeaturedCard
        id="ranked"
        theme="gold"
        icon="emoji_events"
        iconFill
        title={title}
        description={description}
        cta={{
          label: t('rankedFeatured.unlocked.cta'),
          onClick: () => {},
          disabled: true,
          iconLeft: 'play_arrow',
        }}
      />
    )
  }

  // ── State A: passed ──
  if (passed) {
    return (
      <FeaturedCard
        id="ranked"
        theme="gold"
        icon="emoji_events"
        iconFill
        title={title}
        description={description}
        isRecommended={isRecommended}
        recommendReason={recommendReason}
        badge={
          <span
            data-testid="ranked-featured-status"
            data-state="passed"
            className="text-secondary font-medium"
          >
            {t('rankedFeatured.unlocked.badge')}
          </span>
        }
        cta={{
          label: t('rankedFeatured.unlocked.cta'),
          onClick: () => navigate('/ranked'),
          iconLeft: 'play_arrow',
        }}
      />
    )
  }

  // ── State C: cooldown ──
  if (inCooldown) {
    return (
      <FeaturedCard
        id="ranked"
        theme="gold"
        icon="emoji_events"
        iconFill
        title={title}
        description={description}
        badge={
          <span
            data-testid="ranked-featured-status"
            data-state="cooldown"
            className="text-on-surface-variant"
          >
            <span data-testid="ranked-featured-cooldown" className="text-secondary font-medium">
              {t('rankedFeatured.cooldown.countdown', { time: formatMmSs(localCooldown) })}
            </span>
          </span>
        }
        cta={{
          label: t('rankedFeatured.cooldown.ctaDisabled', { time: formatMmSs(localCooldown) }),
          onClick: () => {},
          disabled: true,
          iconLeft: 'hourglass_empty',
        }}
      />
    )
  }

  // ── State B: not passed, ready to attempt ──
  return (
    <FeaturedCard
      id="ranked"
      theme="gold"
      icon="bolt"
      iconFill
      title={title}
      description={description}
      badge={
        <span
          data-testid="ranked-featured-status"
          data-state="needs-quiz"
          className="text-secondary font-medium whitespace-nowrap"
        >
          {t('rankedFeatured.needBasicQuiz.label', { count: totalQuestions })}
        </span>
      }
      cta={{
        label: t('rankedFeatured.needBasicQuiz.cta'),
        onClick: () => navigate('/basic-quiz'),
        iconLeft: 'play_arrow',
      }}
    />
  )
}
