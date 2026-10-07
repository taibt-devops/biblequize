import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/client'
import NotificationPanel, {
  type PanelNotification,
} from '../../components/NotificationPanel'

const NOTIFICATION_ROUTES: Record<string, string> = {
  tier_up: '/ranked',
  streak_warning: '/daily',
  daily_reminder: '/daily',
  friend_overtake: '/leaderboard',
  group_invite: '/groups',
  group_announcement: '/groups',
  tournament_start: '/multiplayer',
}

/**
 * Resolve where a notification click should navigate. Metadata-aware types
 * (e.g. group_announcement → the specific group's Announcements tab via
 * metadata.groupId) deep-link to the exact content; everything else falls
 * back to the static per-type route. Returns null when no route applies.
 */
export function resolveNotificationTarget(n: { type: string; metadata?: string }): string | null {
  if (n.type === 'group_announcement' && n.metadata) {
    try {
      const meta = JSON.parse(n.metadata) as { groupId?: string }
      if (meta.groupId) return `/groups/${meta.groupId}?tab=announcements`
    } catch {
      // malformed metadata — fall through to the static route
    }
  }
  return NOTIFICATION_ROUTES[n.type] ?? null
}

interface NotificationBellProps {
  /** Optional class to layout the wrapper inside the host (sidebar /
   *  mobile top bar). Defaults to a small inline-block. */
  wrapperClassName?: string
}

/**
 * Bell button + unread badge. Owns the data-fetching loop (poll
 * every 30s while authenticated) and delegates render of the
 * dropdown to {@link NotificationPanel}, which handles the
 * redesigned three-state UI (empty / all-read / mixed).
 */
export default function NotificationBell({ wrapperClassName = '' }: NotificationBellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [notifications, setNotifications] = useState<PanelNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications?unread=true&limit=10')
      setNotifications(res.data?.notifications || [])
      setUnreadCount(res.data?.unreadCount || 0)
    } catch {
      // silently ignore; bell still renders, just without count.
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchNotifications])

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notifications/read-all')
      fetchNotifications()
    } catch {
      // ignore
    }
  }

  const handleItemClick = async (n: PanelNotification) => {
    try {
      await api.patch(`/api/notifications/${n.id}/read`)
      fetchNotifications()
    } catch {
      // ignore
    }
    setOpen(false)
    const target = resolveNotificationTarget(n)
    if (target) navigate(target)
  }

  if (!isAuthenticated) return null

  return (
    <div className={`relative ${wrapperClassName}`} data-testid="notification-bell">
      <button
        ref={buttonRef}
        data-testid="notification-bell-btn"
        aria-label={t('header.notifications.title') as string}
        onClick={() => setOpen(p => !p)}
        className="relative w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-bq-cream border-2 md:border-[3px] border-bq-ink text-bq-ink hover:bg-bq-amber transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span
            data-testid="notification-bell-badge"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-[9px] bg-bq-ruby text-white text-[10px] font-bold flex items-center justify-center border-2 border-bq-white leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel
        isOpen={open}
        notifications={notifications}
        unreadCount={unreadCount}
        onClose={() => setOpen(false)}
        onItemClick={handleItemClick}
        onMarkAllRead={markAllAsRead}
        anchorRef={buttonRef}
      />
    </div>
  )
}
