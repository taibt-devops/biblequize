import { Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'

/**
 * Top of the desktop sidebar — gold "Bible Quiz" wordmark on the left,
 * NotificationBell on the right. Replaces the previous fixed top bar's
 * logo + bell pair after the AppLayout Hướng B refactor (top bar
 * hidden on desktop). Hidden on mobile by the parent: AppLayout only
 * renders the sidebar at md+ breakpoints.
 */
export default function SidebarHeader() {
  return (
    <div
      data-testid="sidebar-header"
      className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10"
    >
      <Link
        to="/"
        className="text-lg font-black text-secondary tracking-tighter hover:opacity-80 transition-opacity"
      >
        Bible Quiz
      </Link>
      <NotificationBell />
    </div>
  )
}
