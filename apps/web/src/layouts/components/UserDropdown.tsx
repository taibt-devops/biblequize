import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { setQuizLanguage, type QuizLanguage } from '../../utils/quizLanguage'
import { resolveAvatar } from '../../utils/avatar'

interface UserDropdownProps {
  /** Position of the dropdown panel relative to the trigger.
   *  - "right" (default): top-right anchored, suitable for a top bar.
   *  - "left":  top-left anchored, suitable for a sidebar where the
   *    avatar sits on the left edge. */
  align?: 'left' | 'right'
  /** Layout variant of the trigger button.
   *  - "compact" (default): just the avatar circle — used by mobile
   *    top bar AND the sidebar foot (Modern Spiritual minimal sidebar).
   *  - "card": avatar + name + tier + chevron — legacy wide variant. */
  trigger?: 'compact' | 'card'
  /** When trigger="card", paint the avatar background with this hex
   *  (the user's tier color) and render {@link tierName} as a subtitle
   *  below the displayName. Both ignored for trigger="compact". */
  tierColorHex?: string
  tierName?: string
  /** Where the dropdown panel opens relative to the trigger.
   *  - "bottom" (default): panel under the trigger — top bar.
   *  - "top":             panel above the trigger — sidebar foot
   *                       where opening downward would clip. */
  dropPosition?: 'top' | 'bottom'
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
  dropPosition = 'bottom',
}: UserDropdownProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  // Track avatar img load failure (Google OAuth URLs hay bị 429/403 trên
  // mobile). Khi hỏng, fallback về initial circle thay vì để browser
  // render alt text — alt text không tôn trọng w-10 h-10 và tràn ra
  // ngoài viền nút trên MobileTopBar.
  const [avatarBroken, setAvatarBroken] = useState(false)
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
  // Resolve the avatar through the shared union so presets (`preset:<id>`)
  // render as emoji — not as a broken <img> that falls back to the initial.
  const resolved = resolveAvatar(user?.avatar, displayName)
  const showAvatarImg = resolved.kind === 'img' && !avatarBroken
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
  const panelVertical =
    dropPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'

  return (
    <div ref={wrapRef} className="relative" data-testid="user-dropdown">
      <button
        data-testid="user-dropdown-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger === 'card' ? undefined : t('nav.userMenu')}
        onClick={() => setOpen(p => !p)}
        className={
          trigger === 'card'
            ? 'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg bg-bq-white border border-bq-hair hover:bg-bq-inset transition-colors text-left'
            : 'w-10 h-10 rounded-full grid place-items-center transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60'
        }
      >
        {trigger === 'card' ? (
          <>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={
                tierColorHex
                  ? { background: tierColorHex, color: '#FFF8E7' }
                  : undefined
              }
            >
              {showAvatarImg ? (
                <img
                  src={resolved.kind === 'img' ? resolved.src : undefined}
                  alt={displayName}
                  onError={() => setAvatarBroken(true)}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : resolved.kind === 'preset' ? (
                <span
                  className="w-full h-full rounded-full flex items-center justify-center text-[26px] leading-none"
                  style={{ background: resolved.preset.bg }}
                  aria-hidden
                >
                  {resolved.preset.emoji}
                </span>
              ) : (
                <span className={!tierColorHex ? 'text-bq-ink' : undefined}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-bq-ink truncate">{displayName}</div>
              {tierName ? (
                <div
                  className="text-[10px] truncate"
                  style={{ color: tierColorHex }}
                >
                  {tierName}
                </div>
              ) : (
                <div className="text-[10px] text-bq-ink3 truncate">{user?.email}</div>
              )}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-bq-ink2 shrink-0">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : showAvatarImg ? (
          <img
            src={resolved.kind === 'img' ? resolved.src : undefined}
            alt={displayName}
            onError={() => setAvatarBroken(true)}
            className="w-full h-full rounded-full object-cover border border-[rgba(232,168,50,0.35)]"
          />
        ) : resolved.kind === 'preset' ? (
          <span
            data-testid="user-dropdown-avatar-preset"
            className="w-full h-full rounded-full flex items-center justify-center text-[30px] leading-none border border-[rgba(232,168,50,0.35)]"
            style={{ background: resolved.preset.bg }}
            aria-hidden
          >
            {resolved.preset.emoji}
          </span>
        ) : (
          <span
            data-testid="user-dropdown-avatar-initial"
            className="w-full h-full rounded-full grid place-items-center text-[15px] font-extrabold text-bq-ink"
            style={{
              background: '#FFC93C',
              border: '3px solid #1D2B22',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="user-dropdown-panel"
          role="menu"
          className={`absolute ${panelAlign} ${panelVertical} z-50 w-56 bg-bq-white rounded-xl border border-bq-hair shadow-bq-soft overflow-hidden`}
        >
          <div className="p-3 border-b border-bq-hair">
            <p className="font-bold text-sm text-bq-ink truncate">{displayName}</p>
            <p className="text-xs text-bq-ink2 truncate">{user?.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-bq-ink hover:bg-bq-inset transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-bq-ink2 text-lg">person</span>
              {t('profile.title')}
            </Link>
            <Link
              to="/achievements"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-bq-ink hover:bg-bq-inset transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-bq-ink2 text-lg">emoji_events</span>
              {t('profile.achievements')}
            </Link>
            <Link
              data-testid="user-dropdown-help-link"
              to="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-bq-ink hover:bg-bq-inset transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-bq-ink2 text-lg">help</span>
              {t('nav.help', { defaultValue: 'Trợ giúp' })}
            </Link>

            {/* Quiz-language toggle (inline, doesn't navigate) */}
            <div data-testid="lang-toggle" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm">
              <span className="material-symbols-outlined text-bq-ink2 text-lg">translate</span>
              <span className="flex-1 text-bq-ink2 text-xs">{t('profile.quizLang')}</span>
              <div className="flex gap-0.5 bg-bq-inset rounded-md p-0.5">
                <button
                  data-testid="lang-toggle-vi"
                  data-active={lang === 'vi' ? 'true' : 'false'}
                  onClick={() => toggleLang('vi')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    lang === 'vi' ? 'bg-bq-amber text-bq-ink border-2 border-bq-ink' : 'text-bq-ink2 hover:text-bq-ink'
                  }`}
                >
                  VI
                </button>
                <button
                  data-testid="lang-toggle-en"
                  data-active={lang === 'en' ? 'true' : 'false'}
                  onClick={() => toggleLang('en')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    lang === 'en' ? 'bg-bq-amber text-bq-ink border-2 border-bq-ink' : 'text-bq-ink2 hover:text-bq-ink'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="mx-1 my-1 border-t border-bq-hair" />
            <button
              data-testid="user-dropdown-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bq-ruby/10 transition-colors text-sm w-full text-left text-bq-ruby disabled:opacity-50"
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
