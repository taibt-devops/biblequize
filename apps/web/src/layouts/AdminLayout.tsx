import React, { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { setQuizLanguage } from '../utils/quizLanguage'
import PageLoader from '../components/PageLoader'

// Nav trimmed to core + Tier B (ADM-1, DECISIONS 2026-06-16). Hidden Tier C pages
// (rankings, events, notifications, config, export, question-quality, early-unlock)
// were placeholder / niche / auto-seeded. Routes still exist (no 404 on bookmark);
// they're just not surfaced in the sidebar. Un-hide once wired to real data.
const NAV_ITEMS = [
  { path: '/admin', end: true, icon: 'dashboard', labelKey: 'admin.nav.dashboard' },
  { path: '/admin/users', icon: 'group', labelKey: 'admin.nav.users' },
  { path: '/admin/questions', icon: 'quiz', labelKey: 'admin.nav.questions' },
  { path: '/admin/ai-generator', icon: 'psychology', labelKey: 'admin.nav.aiGenerator' },
  { path: '/admin/review-queue', icon: 'queue', labelKey: 'admin.nav.reviewQueue' },
  { path: '/admin/feedback', icon: 'chat_bubble', labelKey: 'admin.nav.feedback' },
  { path: '/admin/groups', icon: 'groups_2', labelKey: 'admin.nav.groups' },
]

export default function AdminLayout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuthStore()
  const lang = i18n.language === 'en' ? 'en' : 'vi'
  const switchLang = (l: 'vi' | 'en') => { setQuizLanguage(l); i18n.changeLanguage(l) }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-200 ${
      isActive
        ? 'text-[#8A5A12] font-semibold bg-[#FFF8E7] rounded-r-lg border-l-4 border-[#8A5A12]'
        : 'text-[#4D3A1F]/60 hover:text-[#8A5A12] hover:bg-[#FFF8E7]'
    }`

  return (
    <div className="flex min-h-screen font-['Be_Vietnam_Pro']">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[240px] bg-[#F9ECC8] border-r border-[#1D2B22]/15 flex flex-col py-6 gap-2 text-sm tracking-tight z-20">
        {/* Branding */}
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter text-[#8A5A12] uppercase">BIBLEQUIZ</span>
            <span className="text-[10px] uppercase tracking-widest text-[#4D3A1F]/50 font-bold">Admin Panel</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end} className={navLinkClass}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="mt-auto px-4 space-y-4 pt-4">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-[#4D3A1F]/60 hover:text-[#8A5A12] transition-colors text-sm">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            {t('admin.backToApp')}
          </Link>
          {/* UI language toggle — admin had no own switcher; mirrors the main app */}
          <div className="flex items-center gap-1 px-3" data-testid="admin-lang-toggle">
            <span className="material-symbols-outlined text-base text-[#4D3A1F]/50 mr-1">translate</span>
            {(['vi', 'en'] as const).map(l => (
              <button key={l} data-testid={`admin-lang-${l}`} onClick={() => switchLang(l)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                  lang === l ? 'bg-[#FFC93C] text-[#1D2B22]' : 'text-[#4D3A1F]/50 hover:text-[#8A5A12]'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-3 py-3 bg-[#FFF8E7] rounded-lg">
            <div className="w-9 h-9 rounded-full bg-[#FFC93C]/20 flex items-center justify-center text-[#8A5A12] text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#1D2B22] truncate">{user?.name || 'Admin'}</span>
              <span className="text-[10px] text-[#4D3A1F]/50 uppercase">{user?.role || 'ADMIN'}</span>
            </div>
            <button onClick={() => logout()} className="ml-auto text-[#4D3A1F]/60 hover:text-[#B3452F] transition-colors">
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content — top header bar removed (the sidebar already marks the
          current page; the bar otherwise held only redundant/placeholder controls). */}
      <main className="ml-[240px] flex-1 flex flex-col min-h-screen bg-[#EFE3C3]">
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
