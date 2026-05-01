import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../components/OfflineBanner'
import StreakWidget from '../components/StreakWidget'
import DailyMissionWidget from '../components/DailyMissionWidget'
import SidebarHeader from './components/SidebarHeader'
import SidebarUserCard from './components/SidebarUserCard'
import MobileTopBar from './components/MobileTopBar'
import MobileBottomTabs from './components/MobileBottomTabs'

const navItems = [
  { path: '/', labelKey: 'nav.home', icon: 'home' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', icon: 'groups' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'person' },
]

/**
 * Top-level layout — Hướng B (HM-P0-1):
 *   - Desktop (≥ md): sticky sidebar carries identity (logo + bell +
 *     user card + nav + Streak/Mission footer widgets). NO top bar.
 *   - Mobile (< md): sidebar hidden, MobileTopBar + MobileBottomTabs
 *     handle identity + navigation respectively.
 *
 * Both viewports surface the same NotificationBell + UserDropdown
 * components — identical UX with zero menu drift.
 */
export default function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuthStore()
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-[#11131e] text-[#e1e1f1]">
      <OfflineBanner />

      {/* Mobile-only top bar (logo + bell + avatar dropdown). */}
      <MobileTopBar />

      <div className="flex min-h-screen">
        {/* Desktop sidebar — hidden on mobile. */}
        <aside
          data-testid="app-sidebar"
          className="hidden md:flex flex-col h-screen sticky top-0 bg-[#11131e] w-72 border-r border-surface-container-high/50"
        >
          <SidebarHeader />
          <SidebarUserCard />

          <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-3 flex items-center gap-3 font-bold text-xs uppercase tracking-widest rounded-lg transition-all ${
                  isActive(item.path)
                    ? 'gold-gradient text-[#412d00] shadow-lg shadow-secondary/10'
                    : 'text-[#e1e1f1]/60 hover:text-[#e1e1f1] hover:bg-surface-container'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {t(item.labelKey)}
              </Link>
            ))}

            {/* Sidebar engagement widgets (Streak + Daily Mission).
                Authenticated only — guests have neither. */}
            {user && (
              <div
                data-testid="sidebar-widgets"
                className="pt-5 mt-3 border-t border-white/5 space-y-2.5"
              >
                <StreakWidget />
                <DailyMissionWidget />
              </div>
            )}
          </nav>

          {/* Admin panel link — admin / content_mod only. */}
          {(user?.role === 'ADMIN' ||
            user?.role === 'admin' ||
            user?.role === 'CONTENT_MOD' ||
            user?.role === 'content_mod') && (
            <div className="px-3 pb-4">
              <div className="border-t border-white/5 mb-3" />
              <Link
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#e8a832]/10 to-[#e7c268]/10 border border-[#e8a832]/20 text-[#e8a832] hover:bg-[#e8a832]/20 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                <span>{t('nav.adminPanel')}</span>
                <span className="material-symbols-outlined text-xs ml-auto">open_in_new</span>
              </Link>
            </div>
          )}
        </aside>

        <main className="flex-1 p-4 md:p-10 lg:p-14 overflow-y-auto bg-[#11131e]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
          {/* Bottom-tabs clearance on mobile so the last row isn't
              hidden behind the sticky nav. */}
          <div className="h-20 md:hidden" />
        </main>
      </div>

      {/* Mobile-only bottom tabs (4 items). */}
      <MobileBottomTabs />
    </div>
  )
}
