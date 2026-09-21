export const NotificationType = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  INVENTORY_LOW: 'INVENTORY_LOW',
  INVENTORY_UPDATED: 'INVENTORY_UPDATED',
  INVENTORY_TRANSFER_COMPLETED: 'INVENTORY_TRANSFER_COMPLETED',
} as const
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

/** Payload of each SSE `data:` frame (serialized backend Notification entity). */
export interface AppNotification {
  id: string
  organizationId?: string
  userId?: string | null
  type: string
  message: string
  /** JSON string with event-specific fields (productId, warehouseId, remainingQuantity, ...). */
  metadata?: string | null
  read?: boolean
  timestamp?: string
  createdAt?: string
}

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'
