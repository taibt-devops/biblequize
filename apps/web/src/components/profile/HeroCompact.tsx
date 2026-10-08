import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { CosmeticResponse, UserProfile } from './types'
import { EditProfileModal } from './EditProfileModal'
import { PlayerCrest, TierRibbon } from '../lk/PlayerCrest'

// The active cosmetic frame ("frame_tier3") colours the crest rim; without one the rim is the
// player's tier material.
function activeFrameTier(activeFrame: string | null | undefined): number | null {
  const match = activeFrame?.match(/^frame_tier(\d)$/)
  return match ? Number(match[1]) : null
}

/**
 * Profile hero (LKF-12): the traveller's crest at the camp — big crest (rim = equipped frame or
 * tier), name, tier ribbon, email and join date tags, share and edit.
 */
export function HeroCompact({ profile, tierName, tierLevel }: {
  profile: UserProfile
  tierEmoji?: string
  tierName: string
  tierLevel: number
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const { data: cosmetics } = useQuery<CosmeticResponse>({
    queryKey: ['profile-cosmetics'],
    queryFn: () => api.get('/api/me/cosmetics').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const frame = activeFrameTier(cosmetics?.activeFrame)

  return (
    <section className="relative rounded-bq border-[3px] border-bq-ink bg-bq-white shadow-bq-card p-5 md:p-7 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-7">
      <span
        data-testid="profile-avatar"
        data-cosmetic-frame={cosmetics?.activeFrame ?? undefined}
        className="relative inline-block"
      >
        <PlayerCrest name={profile.name} avatarUrl={profile.avatarUrl} tierId={tierLevel} frame={frame} size={116} />
      </span>

      <div className="flex-1 min-w-0">
        <h2 data-testid="profile-name" className="m-0 font-display text-[28px] md:text-[34px] font-extrabold text-bq-ink leading-tight truncate">
          {profile.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span data-testid="profile-tier-badge" className="inline-flex items-center gap-1.5">
            <TierRibbon tierId={tierLevel} className="!text-[13px] !py-0.5" />
            <span className="text-[13px] font-bold text-bq-ink2">{t('profile.tierLevelLabel', { n: tierLevel })}</span>
            <span className="sr-only">{tierName}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-[13px] font-bold text-bq-ink2">
          <span data-testid="profile-email" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bq-paper border-2 border-bq-ink/25">
            <span className="material-symbols-outlined text-[15px]">mail</span>
            {profile.email}
          </span>
          {profile.createdAt && (
            <span data-testid="profile-join-date" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bq-paper border-2 border-bq-ink/25">
              <span className="material-symbols-outlined text-[15px]">calendar_today</span>
              {t('profile.joinedOn')} {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          aria-label={t('profile.share')}
          onClick={async () => {
            const url = window.location.href
            const text = t('profile.shareText', { name: profile.name, tier: tierName })
            if (typeof navigator !== 'undefined' && navigator.share) {
              try { await navigator.share({ title: t('profile.shareTitle'), text, url }); return } catch { /* user cancelled */ }
            }
            try { await navigator.clipboard.writeText(url) } catch { /* no-op */ }
          }}
          className="lk-btn !px-3 !bg-bq-white text-bq-ink"
        >
          <span className="material-symbols-outlined text-[20px]">share</span>
        </button>
        <button
          data-testid="profile-edit-btn"
          onClick={() => setEditing(true)}
          className="lk-btn text-bq-ink text-[15px]"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          {t('profile.editProfile')}
        </button>
      </div>
      <EditProfileModal open={editing} onClose={() => setEditing(false)} profile={profile} />
    </section>
  )
}
