import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { getTierByPoints } from '../../data/tiers'
import UserDropdown from './UserDropdown'

/**
 * Identity card just under the SidebarHeader. Thin wrapper around
 * {@link UserDropdown} with {@code trigger="card"} — same dropdown
 * panel as the mobile top bar's compact variant. The card variant
 * receives the user's tier color so the avatar + tier subtitle
 * visually signal where the user stands without an extra component
 * tree.
 *
 * Reuses the {@code ['me']} TanStack query key so the totalPoints
 * read here is the same in-flight request HeroStatSheet already
 * triggers on Home — no extra HTTP round-trip.
 */
export default function SidebarUserCard() {
  const { t } = useTranslation()

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/me').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const totalPoints = meData?.totalPoints ?? 0
  const tier = getTierByPoints(totalPoints)
  const tierName = t(tier.nameKey)

  return (
    <div data-testid="sidebar-user-card" className="px-3 py-3 border-b border-outline-variant/10">
      <UserDropdown
        align="left"
        trigger="card"
        tierColorHex={tier.colorHex}
        tierName={tierName}
      />
    </div>
  )
}
