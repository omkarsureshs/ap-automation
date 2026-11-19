import { useEffect, useState } from 'react'
import { listNotifications, markNotificationRead, type Notification } from '@/lib/api'

const POLL_INTERVAL_MS = 30_000

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  async function refresh() {
    try {
      setNotifications(await listNotifications(true))
    } catch {
      // Silently skip a failed poll; the next interval tick will retry.
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
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
        className="relative rounded-full p-2 text-sm hover:bg-accent/30"
      >
        🔔
        {notifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-border bg-popover p-2 shadow-md">
          {notifications.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No unread notifications.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-accent/30"
                >
                  {n.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
