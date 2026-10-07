import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'

interface TabConfig {
  path: string
  labelKey: string
  icon: string
  /** `true` = tab dẫn tới trang RequireAuth → ẩn với guest. */
  auth?: boolean
}

/**
 * Stacked icon + always-visible label layout (2026-05-19): every tab
 * renders icon on top + label below; active tab uses the gold accent
 * color and a short underline indicator. Replaces the previous
 * active-only pill which hid 3 of 4 labels and made the bar feel
 * empty on mobile.
 *
 * Tab order mirrors AppLayout {@code navItems} (Home · Leaderboard · Groups ·
 * Multiplayer · Profile). The "Phòng Chơi" (Multiplayer) tab brings the bottom
 * nav toward the SPEC_USER 5-tab set; it reuses the desktop {@code gameModes.rooms}
 * label so both navs stay in sync.
 */
const TABS: TabConfig[] = [
  { path: '/', labelKey: 'nav.home', icon: 'home' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', icon: 'groups', auth: true },
  { path: '/multiplayer', labelKey: 'gameModes.rooms', icon: 'sports_esports', auth: true },
  { path: '/profile', labelKey: 'nav.profile', icon: 'person', auth: true },
]

/**
 * Treat a tab as active when the current pathname matches the tab
 * path exactly OR sits beneath it (for sub-routes like
 * {@code /profile/settings} or {@code /groups/123}). Home (`/`) only
 * matches exactly so it doesn't swallow every other tab.
 */
function isActivePath(pathname: string, tabPath: string): boolean {
  if (tabPath === '/') return pathname === '/'
  return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
}

export default function MobileBottomTabs() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()

  // Guest (route public) chỉ thấy tab không cần auth (Home + Xếp hạng).
  const visibleTabs = TABS.filter(tab => isAuthenticated || !tab.auth)

  return (
    <nav
      data-testid="mobile-bottom-tabs"
      className="md:hidden fixed bottom-0 left-0 w-full z-40 flex items-stretch justify-between gap-1 px-1.5 pt-1.5 bg-bq-white border-t-[3px] border-bq-ink"
      style={{ paddingBottom: 'max(8px, min(env(safe-area-inset-bottom, 0px), 12px))' }}
    >
      {visibleTabs.map(tab => {
        const active = isActivePath(location.pathname, tab.path)
        return (
          <Link
            key={tab.path}
            to={tab.path}
            data-testid={`mobile-tab-${tab.path === '/' ? 'home' : tab.path.slice(1)}`}
            data-active={active ? 'true' : 'false'}
            aria-label={t(tab.labelKey) as string}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-1 rounded-xl border-2 transition-colors duration-200 ease-out ${
              active
                ? 'bg-bq-amber border-bq-ink text-bq-ink'
                : 'border-transparent text-bq-ink2 hover:text-bq-ink'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              aria-hidden="true"
            >
              {tab.icon}
            </span>
            <span
              className={`text-[12px] leading-tight whitespace-nowrap ${
                active ? 'font-extrabold' : 'font-semibold'
              }`}
            >
              {t(tab.labelKey)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
