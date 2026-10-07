import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { TIERS } from '../../data/tiers'
import type { CosmeticResponse, UserProfile } from './types'
import { EditProfileModal } from './EditProfileModal'
import { resolveAvatar } from '../../utils/avatar'

// Map active cosmetic frame ID ("frame_tier3") to a hex color from the
// canonical tier palette. Returns null when the user has no frame set
// or the ID is unrecognised — caller falls back to the default
// secondary-tone border.
function activeFrameColor(activeFrame: string | null | undefined): string | null {
  if (!activeFrame) return null
  const match = activeFrame.match(/^frame_tier(\d)$/)
  if (!match) return null
  const tierId = Number(match[1])
  const tier = TIERS.find(t => t.id === tierId)
  return tier?.colorHex ?? null
}

export function HeroCompact({ profile, tierEmoji, tierName, tierLevel }: {
  profile: UserProfile
  tierEmoji: string
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
  const frameColor = activeFrameColor(cosmetics?.activeFrame)
  const resolved = resolveAvatar(profile.avatarUrl, profile.name)
  const baseAvatarStyle: React.CSSProperties = frameColor
    ? { borderColor: frameColor, boxShadow: `0 0 18px ${frameColor}55, 0 10px 25px rgba(0,0,0,0.4)` }
    : {}
  const presetBg = resolved.kind === 'preset' ? { background: resolved.preset.bg } : {}
  return (
    <section className="relative overflow-hidden rounded-3xl border border-bq-hair bg-bq-white shadow-bq-soft p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center gap-5">
      <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-gradient-radial from-bq-amber/10 to-transparent pointer-events-none" />

      <div className="relative shrink-0">
        <div
          data-testid="profile-avatar"
          data-cosmetic-frame={cosmetics?.activeFrame ?? undefined}
          className={`w-[88px] h-[88px] rounded-full overflow-hidden flex items-center justify-center border-[3px] shadow-bq-soft ${frameColor ? '' : 'border-bq-amber/40'} ${resolved.kind === 'preset' ? '' : 'bg-bq-inset'}`}
          style={{ ...baseAvatarStyle, ...presetBg }}
        >
          {resolved.kind === 'img' && (
            <img alt="User avatar" className="w-full h-full object-cover" src={resolved.src} />
          )}
          {resolved.kind === 'preset' && (
            <span className="text-[70px] leading-none" aria-hidden>{resolved.preset.emoji}</span>
          )}
          {resolved.kind === 'initial' && (
            <span
              className="font-literata italic font-bold leading-none text-bq-amberd"
              style={{ fontSize: '44px' }}
              aria-hidden
            >
              {resolved.initial}
            </span>
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-bq-action text-bq-ink shadow-bq-action flex items-center justify-center text-base border-[3px] border-bq-white">
          {tierEmoji}
        </div>
      </div>

      <div className="flex-1 min-w-0 relative">
        <h2 data-testid="profile-name" className="font-display text-2xl md:text-[26px] font-extrabold text-bq-ink tracking-tight truncate">
          {profile.name}
        </h2>
        <span data-testid="profile-tier-badge" className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-bq-amber/10 border border-bq-amber/30 text-xs font-semibold text-bq-amberd">
          <span>{tierEmoji}</span> {tierName} · {t('profile.tierLevelLabel', { n: tierLevel })}
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-bq-ink2">
          <span data-testid="profile-email" className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-bq-ink3">mail</span>
            {profile.email}
          </span>
          {profile.createdAt && (
            <span data-testid="profile-join-date" className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-bq-ink3">calendar_today</span>
              {t('profile.joinedOn')} {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 relative shrink-0">
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
          className="w-10 h-10 rounded-xl bg-bq-inset border border-bq-hair text-bq-ink hover:bg-bq-hair transition-colors flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[18px]">share</span>
        </button>
        <button
          data-testid="profile-edit-btn"
          onClick={() => setEditing(true)}
          className="h-10 px-4 rounded-xl bg-bq-action text-bq-ink shadow-bq-action text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          {t('profile.editProfile')}
        </button>
      </div>
      <EditProfileModal open={editing} onClose={() => setEditing(false)} profile={profile} />
    </section>
  )
}
