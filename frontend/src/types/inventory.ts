/** Mirrors the backend dashboard threshold (available < 10 counts as low stock). */
export const LOW_STOCK_THRESHOLD = 10

export interface InventoryRequest {
  warehouseId: string
  productId: string
  quantity: number
}

export interface InventoryResponse {
  id: string
  warehouseId: string
  productId: string
  availableQuantity: number
  reservedQuantity: number
  totalQuantity: number
  version: number
  updatedAt: string
}

export interface InventoryAdjustRequest {
  inventoryId: string
  /** Signed delta applied to available stock (-10000..10000). */
  quantity: number
  reason?: string
}

export interface InventoryTransferRequest {
  productId: string
  sourceWarehouseId: string
  destinationWarehouseId: string
  quantity: number
}
