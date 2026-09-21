import { Bell, CheckCheck, PackageX, ShoppingCart, ArrowLeftRight, Boxes, Info, CircleX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNotifications } from '@/store/NotificationContext'
import { formatRelative, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StreamStatus } from '@/types/notification'

const TYPE_ICON: Record<string, typeof Bell> = {
  ORDER_CREATED: ShoppingCart,
  ORDER_CANCELLED: CircleX,
  INVENTORY_LOW: PackageX,
  INVENTORY_UPDATED: Boxes,
  INVENTORY_TRANSFER_COMPLETED: ArrowLeftRight,
}

const TYPE_TONE: Record<string, string> = {
  ORDER_CREATED: 'bg-info/12 text-info',
  ORDER_CANCELLED: 'bg-destructive/12 text-destructive',
  INVENTORY_LOW: 'bg-warning/15 text-warning',
  INVENTORY_UPDATED: 'bg-success/12 text-success',
  INVENTORY_TRANSFER_COMPLETED: 'bg-success/12 text-success',
}

const STATUS_META: Record<StreamStatus, { label: string; dot: string }> = {
  open: { label: 'Live — receiving real-time updates', dot: 'bg-success' },
  connecting: { label: 'Connecting to live updates…', dot: 'bg-warning animate-pulse' },
  reconnecting: { label: 'Connection lost — reconnecting…', dot: 'bg-warning animate-pulse' },
  closed: { label: 'Live updates unavailable', dot: 'bg-destructive' },
  idle: { label: 'Live updates off', dot: 'bg-muted-foreground' },
}

export function NotificationBell() {
  const { notifications, unreadCount, status, markAllRead } = useNotifications()
  const meta = STATUS_META[status]

  return (
    <Popover onOpenChange={(open) => !open && unreadCount > 0 && markAllRead()}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
              <Bell />
              {unreadCount > 0 && (
                <span className="bg-brand text-brand-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className={cn('ring-background absolute right-1.5 bottom-1.5 size-2 rounded-full ring-2', meta.dot)} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{meta.label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck /> Mark read
          </Button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-10 text-center text-sm">
              <Bell className="size-5 opacity-60" />
              You're all caught up. Order and inventory events for your organization will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((item) => {
                const Icon = TYPE_ICON[item.type] ?? Info
                return (
                  <li key={item.id} className={cn('flex gap-3 px-4 py-3', !item.read && 'bg-brand/5')}>
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        TYPE_TONE[item.type] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{humanize(item.type)}</p>
                        {!item.read && <span className="bg-brand size-1.5 shrink-0 rounded-full" />}
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{item.message}</p>
                      <p className="text-muted-foreground/80 mt-1 text-[11px]">
                        {formatRelative(item.timestamp ?? item.createdAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
