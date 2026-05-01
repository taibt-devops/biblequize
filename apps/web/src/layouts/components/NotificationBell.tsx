import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/client'

/**
 * Format an ISO timestamp into a human-readable "X minutes/hours/days
 * ago" using the existing {@code header.time.*} i18n keys. Extracted
 * from the orphan {@code components/Header.tsx} so both the sidebar
 * and the mobile top bar render the same labels.
 */
function timeAgo(dateStr: string, t: TFunction): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('header.time.justNow')
  if (diffMin < 60) return t('header.time.minutesAgo', { count: diffMin })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return t('header.time.hoursAgo', { count: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('header.time.daysAgo', { count: diffDays })
}

interface Notification {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
}

const NOTIFICATION_ROUTES: Record<string, string> = {
  tier_up: '/ranked',
  streak_warning: '/daily',
  daily_reminder: '/daily',
  friend_overtake: '/leaderboard',
  group_invite: '/groups',
  tournament_start: '/multiplayer',
}

interface NotificationBellProps {
  /** Optional class to layout the wrapper inside the host (sidebar /
   *  mobile top bar). Defaults to a small inline-block. */
  wrapperClassName?: string
}

/**
 * Bell icon + unread badge + click-to-open panel listing the 10 most
 * recent unread notifications. Polls every 30s while the user is
 * authenticated. Click an item → mark-read + navigate to the route
 * mapped from {@code n.type}; click "Đọc tất cả" → mark-all-read.
 *
 * Logic ported verbatim from the orphan {@code components/Header.tsx}
 * (line 30-92) so the polished panel UX (timeAgo, mark-read, type
 * routing) survives the AppLayout refactor.
 */
export default function NotificationBell({ wrapperClassName = '' }: NotificationBellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Click-outside closes the panel.
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

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

  const handleItemClick = async (n: Notification) => {
    try {
      await api.patch(`/api/notifications/${n.id}/read`)
      fetchNotifications()
    } catch {
      // ignore
    }
    setOpen(false)
    const target = NOTIFICATION_ROUTES[n.type]
    if (target) navigate(target)
  }

  if (!isAuthenticated) return null

  return (
    <div ref={wrapRef} className={`relative ${wrapperClassName}`} data-testid="notification-bell">
      <button
        data-testid="notification-bell-btn"
        aria-label={t('header.notifications.title') as string}
        onClick={() => setOpen(p => !p)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span
            data-testid="notification-bell-badge"
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[9px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-bell-panel"
          className="absolute right-0 top-full mt-2 w-72 max-h-[420px] overflow-y-auto rounded-xl bg-surface-container-high border border-outline-variant/20 shadow-2xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
            <span className="text-sm font-bold text-on-surface">
              {t('header.notifications.title')}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-medium text-secondary hover:underline"
              >
                {t('header.notifications.readAll')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-on-surface-variant/55">
              {t('header.notifications.empty')}
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container transition-colors ${
                  !n.isRead ? 'bg-secondary/5' : ''
                }`}
              >
                <div className="text-xs font-bold text-on-surface mb-0.5 truncate">{n.title}</div>
                <div className="text-[11px] text-on-surface-variant/70 leading-snug line-clamp-2">{n.body}</div>
                <div className="text-[10px] text-on-surface-variant/40 mt-1">
                  {timeAgo(n.createdAt, t)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
