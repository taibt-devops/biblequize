import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { setQuizLanguage, type QuizLanguage } from '../utils/quizLanguage'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../components/OfflineBanner'

const navItems = [
  { path: '/', labelKey: 'nav.home', icon: 'home' },
  { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
  { path: '/groups', labelKey: 'nav.groups', icon: 'groups' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'person' },
]

function QuizLanguageToggle() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'vi') as QuizLanguage
  const toggle = (l: QuizLanguage) => { setQuizLanguage(l); i18n.changeLanguage(l) }
  return (
    <div data-testid="lang-toggle" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm">
      <span className="material-symbols-outlined text-on-surface-variant text-xl">translate</span>
      <span className="flex-1 text-on-surface-variant">{t('profile.quizLang')}</span>
      <div className="flex gap-0.5 bg-surface-container rounded-lg p-0.5">
        <button
          data-testid="lang-toggle-vi"
          data-active={lang === 'vi' ? 'true' : 'false'}
          onClick={() => toggle('vi')}
          className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${lang === 'vi' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
        >VI</button>
        <button
          data-testid="lang-toggle-en"
          data-active={lang === 'en' ? 'true' : 'false'}
          onClick={() => toggle('en')}
          className={`px-2 py-1 rounded-md text-xs font-bold transition-colors ${lang === 'en' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
        >EN</button>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const isActive = (path: string) => location.pathname === path

  // Close user menu when clicking outside (works regardless of z-index stacking).
  // The previous overlay-based approach (z-40) was blocked by the header (z-50),
  // so clicks on header icons / nav links failed to close the menu.
  useEffect(() => {
    if (!showUserMenu) return
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (target && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showUserMenu])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/landing')
    } catch {
      // logout already clears state
    } finally {
      setLoggingOut(false)
      setShowUserMenu(false)
    }
  }

  const displayName = user?.name || t('home.defaultName')

  return (
    <div className="min-h-screen bg-[#11131e] text-[#e1e1f1]">
      <OfflineBanner />
      {/*
        Top Navigation Bar — brand + user state only.
        Page navigation lives in the sidebar (<aside> below) on desktop
        and the bottom nav on mobile. Previously had duplicate nav items
        here AND in sidebar → redundant UX, removed 2026-04-19.
      */}
      <header data-testid="app-header" className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-[#11131e]/90 backdrop-blur-md">
        <Link to="/" className="text-2xl font-black text-[#e8a832] tracking-tighter">
          Bible Quiz
        </Link>
        <div data-testid="header-notification-area" className="flex items-center gap-6">
          {/* User avatar + dropdown */}
          <div className="relative" ref={userMenuRef} data-testid="user-menu-container">
            <button
              data-testid="user-menu-toggle"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e8a832]/30 p-0.5 hover:border-[#e8a832] transition-colors"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="rounded-full w-full h-full object-cover" />
              ) : (
                <div className="rounded-full w-full h-full bg-surface-container-highest flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#e8a832]">person</span>
                </div>
              )}
            </button>
            {showUserMenu && (
              <div data-testid="user-menu-dropdown" role="menu" className="absolute right-0 top-14 z-50 w-56 bg-surface-container-high rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-outline-variant/10">
                    <p className="font-bold text-sm text-on-surface truncate">{displayName}</p>
                    <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container transition-colors text-sm"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">person</span>
                      {t('profile.title')}
                    </Link>
                    <Link
                      to="/achievements"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container transition-colors text-sm"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">emoji_events</span>
                      {t('profile.achievements')}
                    </Link>
                    <Link
                      data-testid="user-menu-help-link"
                      to="/help"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container transition-colors text-sm"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">help</span>
                      {t('nav.help', { defaultValue: 'Trợ giúp' })}
                    </Link>
                    <QuizLanguageToggle />
                    <div className="mx-2 my-1 border-t border-outline-variant/10" />
                    <button
                      data-testid="logout-btn"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-error/10 transition-colors text-sm w-full text-left text-error disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">logout</span>
                      {loggingOut ? t('auth.loggingOut') : t('auth.logout')}
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex pt-20 min-h-screen">
        {/* Side Navigation Bar (Desktop) */}
        <aside className="hidden md:flex flex-col h-screen sticky top-20 py-10 bg-[#11131e] w-72 border-r border-surface-container-high/50">
          <div className="px-8 mb-10">
            <Link to="/profile" className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-surface-container-highest/20">
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center border border-secondary/20 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[#e8a832]">person</span>
                )}
              </div>
              <div>
                <p className="font-black text-[#e8a832] text-sm uppercase tracking-widest truncate max-w-[120px]">{displayName}</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 space-y-2 px-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-6 py-4 flex items-center gap-4 font-bold text-sm uppercase tracking-widest rounded-xl transition-all ${
                  isActive(item.path)
                    ? 'gold-gradient text-[#412d00] shadow-lg shadow-secondary/10'
                    : 'text-[#e1e1f1]/60 hover:text-[#e1e1f1] hover:bg-surface-container'
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
          {/* Admin panel button (admin/content_mod only) */}
          {(user?.role === 'ADMIN' || user?.role === 'admin' || user?.role === 'CONTENT_MOD' || user?.role === 'content_mod') && (
            <div className="px-4 mb-4">
              <div className="border-t border-white/5 mb-4" />
              <Link
                to="/admin"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#e8a832]/10 to-[#e7c268]/10 border border-[#e8a832]/20 text-[#e8a832] hover:bg-[#e8a832]/20 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                <span>{t('nav.adminPanel')}</span>
                <span className="material-symbols-outlined text-xs ml-auto">open_in_new</span>
              </Link>
            </div>
          )}
          {/*
            Removed sidebar "Bắt Đầu" CTA (2026-04-19): it linked to /quiz
            without a session, and duplicated the Practice card's CTA on
            the home page. Recommendation highlight on Home now directs
            the user to the right mode contextually.
          */}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 md:p-14 overflow-y-auto bg-[#11131e]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
          <div className="h-24 md:hidden" />
        </main>
      </div>

      {/* Bottom Navigation Bar (Mobile) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-4 md:hidden bg-[#11131e]/90 backdrop-blur-xl border-t border-surface-container-highest/20 rounded-t-[2rem] shadow-2xl">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center px-5 py-2.5 transition-all ${
              isActive(item.path)
                ? 'bg-surface-container text-[#e8a832] rounded-2xl shadow-lg shadow-secondary/10'
                : 'text-[#e1e1f1]/40 hover:text-[#e8a832]'
            }`}
          >
            <span
              className="material-symbols-outlined mb-1"
              style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
