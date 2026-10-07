import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'

interface ComebackStatus {
  daysSinceLastPlay: number
  rewardTier: string
  claimed: boolean
  reward: {
    description?: string
    xpBonus?: number
    xpMultiplier?: number
    duration?: string
    freezeToken?: number
    energy?: number
  } | null
}

export default function ComebackModal() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery<ComebackStatus>({
    queryKey: ['comeback-status'],
    queryFn: () => api.get('/api/me/comeback-status').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: !!user,
  })

  const claimMutation = useMutation({
    mutationFn: () => api.post('/api/me/comeback-claim').then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comeback-status'] })
    },
  })

  if (!data || data.rewardTier === 'NONE' || data.claimed || dismissed) {
    return null
  }

  const { rewardTier, daysSinceLastPlay, reward } = data

  return (
    <div data-testid="comeback-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,21,27,0.45)] backdrop-blur-sm">
      <div className="bg-bq-white rounded-2xl p-8 max-w-md w-full mx-4 border border-bq-hair shadow-bq-soft text-center space-y-6">
        {/* Celebration */}
        <div className="text-5xl mb-2">🎉</div>

        <div>
          <h2 className="font-display text-2xl font-black text-bq-ink mb-2">
            {user?.name
              ? t('modals.comeback.welcomeBackNamed', { name: user.name })
              : t('modals.comeback.welcomeBackAnon')}
          </h2>
          <p className="text-sm text-bq-ink2">
            {t('modals.comeback.awayDays', { count: daysSinceLastPlay })}
          </p>
        </div>

        {/* Reward details */}
        {reward && (
          <div className="bg-bq-amber/10 border border-bq-amber/30 rounded-xl p-4 space-y-2">
            <p className="text-sm font-bold text-bq-amberd">{reward.description}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {reward.xpBonus && (
                <span className="text-xs bg-bq-emerald/15 text-bq-emerald px-2 py-1 rounded-full font-bold">
                  {t('modals.comeback.xpBonus', { count: reward.xpBonus })}
                </span>
              )}
              {reward.xpMultiplier && (
                <span className="text-xs bg-bq-sapphire/15 text-bq-sapphire px-2 py-1 rounded-full font-bold">
                  {t('modals.comeback.xpMultiplier', { count: reward.xpMultiplier })}
                </span>
              )}
              {reward.freezeToken && (
                <span className="text-xs bg-bq-sapphire/15 text-bq-sapphire px-2 py-1 rounded-full font-bold">
                  {t('modals.comeback.freezeToken', { count: reward.freezeToken })}
                </span>
              )}
              {reward.energy && (
                <span className="text-xs bg-bq-amber/15 text-bq-amberd px-2 py-1 rounded-full font-bold">
                  {t('modals.comeback.energy', { count: reward.energy })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Positive streak message */}
        <p className="text-xs text-bq-ink3">
          {t('modals.comeback.streakHint')}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-bq-ink2 bg-bq-inset rounded-xl hover:bg-bq-hair transition-colors"
          >
            {t('modals.comeback.laterButton')}
          </button>
          <button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-black text-bq-ink bg-bq-action shadow-bq-action rounded-xl hover:brightness-105 transition disabled:opacity-50"
          >
            {claimMutation.isPending ? t('modals.comeback.claiming') : t('modals.comeback.claimButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
