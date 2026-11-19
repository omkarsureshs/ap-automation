import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { listNotifications, markNotificationRead, type Notification } from '@/lib/api'

const POLL_INTERVAL_MS = 30_000

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [pollFailed, setPollFailed] = useState(false)
  const hasWarnedRef = useRef(false)

  async function refresh() {
    try {
      setNotifications(await listNotifications(true))
      setPollFailed(false)
      hasWarnedRef.current = false
    } catch {
      // Surface the failure once, not on every 30s tick — repeating the
      // same warning every poll would just be noise.
      if (!hasWarnedRef.current) {
        setPollFailed(true)
        hasWarnedRef.current = true
      }
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleClick(notification: Notification) {
    try {
      await markNotificationRead(notification.id)
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    } catch {
      // Leave it in the list; the user can try again.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-exception px-1 text-[10px] text-background">
            {notifications.length}
          </span>
        )}
        {pollFailed && notifications.length === 0 && (
          <span
            aria-label="Couldn't check for new notifications"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-pending"
          />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-hairline bg-popover p-2 shadow-lg">
          {pollFailed && (
            <p className="p-2 text-xs text-exception">Couldn't check for new notifications. Will retry shortly.</p>
          )}
          {notifications.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No unread notifications.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    {n.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
