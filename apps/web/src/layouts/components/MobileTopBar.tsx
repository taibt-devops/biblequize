import { Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import UserDropdown from './UserDropdown'

/**
 * Sticky top bar visible only on mobile (md:hidden enforced by the
 * parent AppLayout). Layout: gold "Bible Quiz" wordmark on the left,
 * NotificationBell + UserDropdown (compact) on the right. Both
 * trailing components reuse the same logic the desktop sidebar uses
 * — same 5-item user menu, same 10-item notification panel — so the
 * UX is consistent regardless of viewport.
 *
 * Height is ~44px (matches iOS HIG touch target). Backdrop blur lets
 * the page background bleed through when the user scrolls.
 */
export default function MobileTopBar() {
  return (
    <header
      data-testid="mobile-top-bar"
      className="md:hidden sticky top-0 z-40 flex items-center justify-between px-3 h-12 bg-[#11131e]/90 backdrop-blur-md border-b border-outline-variant/10"
    >
      <Link
        to="/"
        className="text-base font-black text-secondary tracking-tighter hover:opacity-80 transition-opacity"
      >
        Bible Quiz
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserDropdown align="right" trigger="compact" />
      </div>
    </header>
  )
}
