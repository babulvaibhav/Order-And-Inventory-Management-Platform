import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { orderService } from '@/services/orderService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { humanize } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { Permission } from '@/types/auth'
import { ORDER_TRANSITIONS, type OrderResponse, type OrderStatus } from '@/types/order'

export const TRANSITION_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirm order',
  PROCESSING: 'Start processing',
  COMPLETED: 'Mark completed',
  CANCELLED: 'Cancel order',
}

/**
 * Order status transitions. Only transitions allowed by the backend state machine are offered.
 * Cancelling requires `order.cancel`; every other forward transition only needs `order.create`
 * (mirrors OrderService.updateOrderStatus on the backend) — STAFF holds `order.create` but not
 * `order.cancel` by default, so gating every action on `order.cancel` alone previously left STAFF
 * unable to advance an order's status here even though the API allowed it. See
 * KNOWN_LIMITATIONS.md "Addressed in this pass".
 */
export function useOrderStatus() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canTransitionTo = (status: OrderStatus) =>
    hasPermission(status === 'CANCELLED' ? Permission.ORDER_CANCEL : Permission.ORDER_CREATE)
  // Kept for call sites that only need "can this order be touched at all" (e.g. showing the
  // status-change control), not a specific target status.
  const canTransition = hasPermission(Permission.ORDER_CREATE) || hasPermission(Permission.ORDER_CANCEL)

  const mutation = useMutation({
    mutationFn: ({ order, status }: { order: OrderResponse; status: OrderStatus }) => orderService.updateStatus(order.id, status),
    onSuccess: (updated, { status }) => {
      queryClient.setQueryData(queryKeys.orders.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      if (status === 'CANCELLED') void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      toast.success(`Order ${humanize(status).toLowerCase()}`, {
        description: status === 'CANCELLED' ? 'Reserved stock has been released.' : undefined,
      })
    },
    onError: (error) => toast.error('Status change failed', { description: errorMessage(error) }),
  })

  const nextStatuses = (order: OrderResponse): OrderStatus[] => ORDER_TRANSITIONS[order.status] ?? []

  return { canTransition, canTransitionTo, nextStatuses, mutation }
}
