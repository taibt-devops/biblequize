import { Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLoader from '../components/PageLoader'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../components/OfflineBanner'
import NotificationBell from './components/NotificationBell'
import UserDropdown from './components/UserDropdown'
import MobileBottomTabs from './components/MobileBottomTabs'
import HeaderStats from './components/HeaderStats'

// Lu Khach mockup (LKF-1): Home, Journey, Leaderboard, Groups, Profile.
// Multiplayer rooms are entered from the Home signpost.
const navItems = [
  { path: '/', labelKey: 'nav.home' },
  // `auth: true` = chỉ hiện khi đã đăng nhập. Guest vào route public
  // (vd /leaderboard) không thấy link dẫn tới trang RequireAuth.
  { path: '/journey', labelKey: 'nav.journey', auth: true },
  { path: '/leaderboard', labelKey: 'nav.leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', auth: true },
  { path: '/profile', labelKey: 'nav.profile', auth: true },
]

/**
 * Top-level layout — storybook TopNav (LKD-10; was KS W0-2):
 *   - Sticky cream bar with an ink rule: lantern logo + nav links (active = gold
 *     pill with ink outline)
 *     + 3 stats (streak / năng lượng / điểm mùa) + bell + avatar dropdown.
 *   - Single centered content column below (no sidebar).
 *   - Mobile (< md): nav links + stats collapse; MobileBottomTabs handles
 *     navigation; the bar keeps logo + bell + avatar.
 */
export default function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()

  // Guest (route public như /leaderboard) chỉ thấy link không cần auth.
  const visibleNavItems = navItems.filter(item => isAuthenticated || !item.auth)

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`)

  const isAdmin =
    user?.role === 'ADMIN' || user?.role === 'admin' ||
    user?.role === 'CONTENT_MOD' || user?.role === 'content_mod'

  return (
    <div className="min-h-screen bg-bq-paper text-bq-ink bq-lightwell">
      <OfflineBanner />

      <header
        data-testid="app-topnav"
        className="sticky top-0 z-30 bg-bq-white border-b-[3px] border-bq-ink"
      >
        <div className="max-w-[1280px] mx-auto px-3.5 md:px-6 min-h-[58px] md:min-h-[66px] py-2 flex items-center gap-2 md:gap-[22px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="BibleQuiz home">
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-[30px] md:h-9 w-auto" />
            <span className="font-display text-[22px] md:text-[27px] font-extrabold tracking-[-0.02em] text-bq-ink leading-none">
              BibleQuiz
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex flex-wrap items-center gap-1">
            {visibleNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={`text-[18px] font-bold px-4 py-1 rounded-full border-[3px] text-bq-ink transition-colors ${
                  isActive(item.path) ? 'bg-bq-amber border-bq-ink' : 'border-transparent hover:bg-bq-cream'
                }`}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          {/* Right: stat chips + admin + bell + avatar (mockup). Guest (route public)
              thấy nút Đăng nhập thay vì bell + avatar giả. */}
          <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
            {isAuthenticated ? (
              <>
                <div className="hidden lg:block"><HeaderStats /></div>
                <div className="lg:hidden"><HeaderStats compact /></div>
                {isAdmin && (
                  <Link
                    to="/admin"
                    data-testid="topnav-admin-link"
                    className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-bq-amberd bg-bq-amber/10 border border-bq-amber/30 px-3 py-1.5 rounded-full hover:bg-bq-amber/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                    <span className="hidden lg:inline">{t('nav.adminPanel', { defaultValue: 'Quản trị' })}</span>
                  </Link>
                )}
                <NotificationBell />
                <UserDropdown align="right" trigger="compact" />
              </>
            ) : (
              <Link
                to="/login"
                data-testid="topnav-login-link"
                className="inline-flex items-center text-[16px] font-bold px-5 py-1.5 rounded-bq-btn bg-bq-action shadow-bq-action text-bq-ink"
              >
                {t('auth.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
        <div className="h-[var(--mobile-nav-h)] md:hidden" />
      </main>

      <MobileBottomTabs />
    </div>
  )
}
