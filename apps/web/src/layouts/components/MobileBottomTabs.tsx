import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface TabConfig {
  path: string
  labelKey: string
  icon: string
}

/**
 * Tabs match the existing AppLayout {@code navItems} list one-to-one
 * so the bottom-nav refactor is a pure extract — no item drift, no
 * route changes. Mobile-only (md:hidden), pinned to viewport bottom,
 * 4 equal columns.
 *
 * HM-MB-2 (320px label-wrap test) lives downstream — labels are
 * single words ({@code Trang chủ}, {@code Xếp hạng}, ...) so they
 * already fit in ~64px-per-tab even at iPhone SE width.
 */
const TABS: TabConfig[] = [
  { path: '/', labelKey: 'nav.home', icon: 'home' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', icon: 'groups' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'person' },
]

export default function MobileBottomTabs() {
  const { t } = useTranslation()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <nav
      data-testid="mobile-bottom-tabs"
      className="md:hidden fixed bottom-0 left-0 w-full z-40 grid grid-cols-4 items-center px-2 pb-6 pt-2 bg-[#11131e]/90 backdrop-blur-xl border-t border-surface-container-highest/20 rounded-t-[1.5rem] shadow-2xl"
    >
      {TABS.map(tab => {
        const active = isActive(tab.path)
        return (
          <Link
            key={tab.path}
            to={tab.path}
            data-testid={`mobile-tab-${tab.path === '/' ? 'home' : tab.path.slice(1)}`}
            data-active={active ? 'true' : 'false'}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 transition-colors ${
              active ? 'text-secondary' : 'text-on-surface-variant/45 hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {tab.icon}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
              {t(tab.labelKey)}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
