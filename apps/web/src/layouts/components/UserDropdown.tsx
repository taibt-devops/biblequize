import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { setQuizLanguage, type QuizLanguage } from '../../utils/quizLanguage'

interface UserDropdownProps {
  /** Position of the dropdown panel relative to the trigger.
   *  - "right" (default): top-right anchored, suitable for a top bar.
   *  - "left":  top-left anchored, suitable for a sidebar where the
   *    avatar sits on the left edge. */
  align?: 'left' | 'right'
  /** Layout variant of the trigger button.
   *  - "compact" (default): just the avatar circle — used by mobile
   *    top bar where horizontal space is tight.
   *  - "card": avatar + name + tier + chevron — used by sidebar. */
  trigger?: 'compact' | 'card'
  /** When trigger="card", paint the avatar background with this hex
   *  (the user's tier color) and render {@link tierName} as a subtitle
   *  below the displayName. Both ignored for trigger="compact". */
  tierColorHex?: string
  tierName?: string
}

/**
 * Avatar trigger + click-to-open menu shared by SidebarUserCard
 * (desktop, trigger="card") and MobileTopBar (mobile, trigger="compact").
 *
 * Items match the previous fixed top bar dropdown in AppLayout
 * (Profile / Achievements / Help / Quiz language toggle / Logout) so
 * the refactor doesn't drop any user-facing surface — see HM-P0-1
 * audit (BUG_REPORT_HOME_POST_IMPL.md).
 */
export default function UserDropdown({
  align = 'right',
  trigger = 'compact',
  tierColorHex,
  tierName,
}: UserDropdownProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (target && wrapRef.current && !wrapRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const displayName = user?.name || t('home.defaultName')
  const lang = (i18n.language === 'en' ? 'en' : 'vi') as QuizLanguage

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/landing')
    } catch {
      // logout already clears state
    } finally {
      setLoggingOut(false)
      setOpen(false)
    }
  }

  const toggleLang = (l: QuizLanguage) => {
    setQuizLanguage(l)
    i18n.changeLanguage(l)
  }

  const panelAlign = align === 'left' ? 'left-0' : 'right-0'

  return (
    <div ref={wrapRef} className="relative" data-testid="user-dropdown">
      <button
        data-testid="user-dropdown-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(p => !p)}
        className={
          trigger === 'card'
            ? 'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors text-left'
            : 'w-9 h-9 rounded-full overflow-hidden border-2 border-secondary/30 p-0.5 hover:border-secondary transition-colors'
        }
      >
        {trigger === 'card' ? (
          <>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={
                tierColorHex
                  ? { background: tierColorHex, color: '#11131e' }
                  : undefined
              }
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className={!tierColorHex ? 'text-secondary' : undefined}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-on-surface truncate">{displayName}</div>
              {tierName ? (
                <div
                  className="text-[10px] truncate"
                  style={{ color: tierColorHex }}
                >
                  {tierName}
                </div>
              ) : (
                <div className="text-[10px] text-on-surface-variant/60 truncate">{user?.email}</div>
              )}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-on-surface-variant shrink-0">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : user?.avatar ? (
          <img src={user.avatar} alt={displayName} className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="rounded-full w-full h-full bg-surface-container-highest flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary">person</span>
          </div>
        )}
      </button>

      {open && (
        <div
          data-testid="user-dropdown-panel"
          role="menu"
          className={`absolute ${panelAlign} top-full mt-2 z-50 w-56 bg-surface-container-high rounded-xl border border-outline-variant/20 shadow-2xl overflow-hidden`}
        >
          <div className="p-3 border-b border-outline-variant/10">
            <p className="font-bold text-sm text-on-surface truncate">{displayName}</p>
            <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">person</span>
              {t('profile.title')}
            </Link>
            <Link
              to="/achievements"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">emoji_events</span>
              {t('profile.achievements')}
            </Link>
            <Link
              data-testid="user-dropdown-help-link"
              to="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">help</span>
              {t('nav.help', { defaultValue: 'Trợ giúp' })}
            </Link>

            {/* Quiz-language toggle (inline, doesn't navigate) */}
            <div data-testid="lang-toggle" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">translate</span>
              <span className="flex-1 text-on-surface-variant text-xs">{t('profile.quizLang')}</span>
              <div className="flex gap-0.5 bg-surface-container rounded-md p-0.5">
                <button
                  data-testid="lang-toggle-vi"
                  data-active={lang === 'vi' ? 'true' : 'false'}
                  onClick={() => toggleLang('vi')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    lang === 'vi' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  VI
                </button>
                <button
                  data-testid="lang-toggle-en"
                  data-active={lang === 'en' ? 'true' : 'false'}
                  onClick={() => toggleLang('en')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    lang === 'en' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="mx-1 my-1 border-t border-outline-variant/10" />
            <button
              data-testid="user-dropdown-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-error/10 transition-colors text-sm w-full text-left text-error disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              {loggingOut ? t('auth.loggingOut') : t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
