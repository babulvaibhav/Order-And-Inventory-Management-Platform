/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { openNotificationStream } from '@/services/notificationStream'
import { notificationService } from '@/services/notificationService'
import { useAuth } from '@/store/AuthContext'
import { queryKeys } from '@/lib/queryKeys'
import { humanize } from '@/lib/format'
import { Permission } from '@/types/auth'
import type { AppNotification, StreamStatus } from '@/types/notification'

const MAX_ITEMS = 50
/** Events received this soon after the stream opens are treated as replayed backlog (no toast). */
const BACKLOG_WINDOW_MS = 1000
/** Only a real backend id (a UUID) can be marked read server-side; the synthetic fallback id
 * built for events with no id (`${type}-${timestamp}`) has nothing to PATCH. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  status: StreamStatus
  markAllRead: () => void
  clear: () => void
}

/** In-memory feed, owned by one signed-in user so a different session never sees it. */
interface Feed {
  owner: string | null
  items: AppNotification[]
  readIds: ReadonlySet<string>
}

const emptyFeed = (owner: string | null): Feed => ({ owner, items: [], readIds: new Set() })

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

/** Invalidate cached server state affected by an event so open screens refresh themselves. */
function invalidationTargets(type: string): ReadonlyArray<readonly string[]> {
  if (type.startsWith('ORDER_')) return [queryKeys.orders.all, queryKeys.inventory.all, queryKeys.dashboard]
  if (type.startsWith('INVENTORY_')) return [queryKeys.inventory.all, queryKeys.dashboard]
  return [queryKeys.dashboard]
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const owner = isAuthenticated ? (user?.userId ?? null) : null
  const [feedState, setFeed] = useState<Feed>(() => emptyFeed(owner))
  const [status, setStatus] = useState<StreamStatus>('idle')
  const seen = useRef<{ owner: string | null; ids: Set<string> }>({ owner, ids: new Set() })
  const openedAt = useRef<number | null>(null)

  // A feed that belongs to another (or no) user is treated as empty.
  const feed = feedState.owner === owner ? feedState : emptyFeed(owner)

  // The stream endpoint requires inventory.read (all built-in roles have it).
  const canStream = !!owner && hasPermission(Permission.INVENTORY_READ)

  const handleNotification = useCallback(
    (notification: AppNotification) => {
      const id = notification.id ?? `${notification.type}-${notification.timestamp}`
      // The stream replays unread notifications on every reconnect; show each one once per session.
      if (seen.current.owner !== owner) seen.current = { owner, ids: new Set() }
      if (seen.current.ids.has(id)) return
      seen.current.ids.add(id)

      setFeed((previous) => {
        const base = previous.owner === owner ? previous : emptyFeed(owner)
        const readIds = notification.read ? new Set(base.readIds).add(id) : base.readIds
        return { owner, items: [{ ...notification, id }, ...base.items].slice(0, MAX_ITEMS), readIds }
      })

      invalidationTargets(notification.type).forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey })
      })
      // The server replays unread notifications right after (re)connecting; list those in the bell silently
      // and only toast events that arrive live.
      if (openedAt.current === null || Date.now() - openedAt.current < BACKLOG_WINDOW_MS) return
      const isWarning = notification.type === 'INVENTORY_LOW' || notification.type === 'ORDER_CANCELLED'
      ;(isWarning ? toast.warning : toast.info)(humanize(notification.type), { description: notification.message })
    },
    [owner, queryClient],
  )

  useEffect(() => {
    if (!canStream) return
    return openNotificationStream({
      onNotification: handleNotification,
      onStatus: (next) => {
        openedAt.current = next === 'open' ? Date.now() : null
        setStatus(next)
      },
    })
  }, [canStream, handleNotification])

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: feed.items.map((item) => ({ ...item, read: feed.readIds.has(item.id) })),
      unreadCount: feed.items.filter((item) => !feed.readIds.has(item.id)).length,
      status: canStream ? status : 'idle',
      markAllRead: () => {
        setFeed((previous) => {
          if (previous.owner !== owner) return previous
          // Best-effort, fire-and-forget: persists read state server-side (previously this only
          // ever updated local component state — see KNOWN_LIMITATIONS.md "Addressed in this
          // pass"). A failure here shouldn't block the UI from reflecting "read" locally.
          previous.items
            .filter((item) => !previous.readIds.has(item.id) && UUID_RE.test(item.id))
            .forEach((item) => {
              notificationService.markRead(item.id).catch(() => {
                // Notifications are org-wide, not per-user, so a stale "unread" badge for someone
                // else in the org isn't a correctness issue worth surfacing an error for here.
              })
            })
          return { ...previous, readIds: new Set(previous.items.map((item) => item.id)) }
        })
      },
      clear: () => setFeed(emptyFeed(owner)),
    }),
    [feed, status, canStream, owner],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider')
  return context
}
