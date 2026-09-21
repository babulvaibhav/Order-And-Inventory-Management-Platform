import type { OrderStatus } from './order'

export interface RecentOrder {
  id: string
  customerName: string | null
  totalAmount: number
  status: OrderStatus
}

export interface DashboardSummary {
  totalProducts: number
  totalWarehouses: number
  totalAvailableInventory: number
  pendingOrders: number
  completedOrders: number
  /** Number of inventory rows with available quantity below the low-stock threshold. */
  lowStockProducts: number
  recentOrders: RecentOrder[]
}
