import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface TabConfig {
  path: string
  labelKey: string
  icon: string
}

/**
 * Direction-3 active-only-label layout (HM-MB-2 fix): inactive tabs
 * render the icon only, the active tab renders an icon + label pill.
 * Solves the 320px wrap risk that 4 always-visible 2-word labels
 * created on iPhone SE — only one label is on screen at a time, and
 * the pill flexes to its content width.
 *
 * Tabs match the existing AppLayout {@code navItems} list one-to-one
 * so the bottom-nav refactor is a pure style change — no item drift,
 * no route changes.
 */
const TABS: TabConfig[] = [
  { path: '/', labelKey: 'nav.home', icon: 'home' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', icon: 'groups' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'person' },
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

  return (
    <nav
      data-testid="mobile-bottom-tabs"
      className="md:hidden fixed bottom-0 left-0 w-full z-40 flex items-center justify-between gap-2 px-3 pt-2 bg-[#11131e]/90 backdrop-blur-xl border-t border-[rgba(232,168,50,0.15)]"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {TABS.map(tab => {
        const active = isActivePath(location.pathname, tab.path)
        return (
          <Link
            key={tab.path}
            to={tab.path}
            data-testid={`mobile-tab-${tab.path === '/' ? 'home' : tab.path.slice(1)}`}
            data-active={active ? 'true' : 'false'}
            aria-label={t(tab.labelKey) as string}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center gap-2 min-h-[44px] transition-all duration-200 ease-out ${
              active
                ? 'bg-secondary/10 text-secondary px-4 rounded-full font-medium'
                : 'text-on-surface/40 hover:text-on-surface/70 px-3'
            }`}
          >
            <span
              className={`material-symbols-outlined ${active ? 'text-[18px]' : 'text-[22px]'}`}
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              aria-hidden="true"
            >
              {tab.icon}
            </span>
            {active && (
              <span className="text-[12px] whitespace-nowrap">{t(tab.labelKey)}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
