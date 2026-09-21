export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

/** Allowed transitions — must match the backend state machine (OrderService). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

// No unitPrice here (there used to be one): the backend's OrderItemRequest record doesn't accept
// it — the authoritative unit price is always looked up server-side from Product.price, so the
// client's price never matters for what actually gets charged. See KNOWN_LIMITATIONS.md
// "Addressed in this pass".
export interface OrderItemRequest {
  productId: string
  warehouseId: string
  quantity: number
}

export interface OrderRequest {
  customerId: string
  items: OrderItemRequest[]
  notes?: string
}

export interface OrderItemResponse {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  warehouseId: string | null
}

export interface OrderResponse {
  id: string
  customerId: string
  status: OrderStatus
  totalAmount: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  items: OrderItemResponse[]
}

export interface OrderStatusUpdateRequest {
  status: OrderStatus
}
