import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type {
  InventoryAdjustRequest,
  InventoryRequest,
  InventoryResponse,
  InventoryTransferRequest,
} from '@/types/inventory'

/** Backend applies only one filter: warehouseId takes precedence over productId. */
export interface InventoryListParams extends PageParams {
  warehouseId?: string
  productId?: string
}

const { INVENTORY } = API_CONFIG.ENDPOINTS

export const inventoryService = {
  async list(params: InventoryListParams = {}): Promise<Page<InventoryResponse>> {
    const { data } = await apiClient.get<Page<InventoryResponse>>(INVENTORY.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<InventoryResponse> {
    const { data } = await apiClient.get<InventoryResponse>(INVENTORY.DETAIL(id))
    return data
  },

  async create(request: InventoryRequest): Promise<InventoryResponse> {
    const { data } = await apiClient.post<InventoryResponse>(INVENTORY.LIST, request)
    return data
  },

  async adjust(request: InventoryAdjustRequest): Promise<InventoryResponse> {
    const { data } = await apiClient.post<InventoryResponse>(INVENTORY.ADJUST, request)
    return data
  },

  async transfer(request: InventoryTransferRequest): Promise<void> {
    await apiClient.post(INVENTORY.TRANSFER, request)
  },

  async reserve(inventoryId: string, quantity: number): Promise<void> {
    await apiClient.post(INVENTORY.RESERVE, null, { params: { inventoryId, quantity } })
  },

  async release(inventoryId: string, quantity: number): Promise<void> {
    await apiClient.post(INVENTORY.RELEASE, null, { params: { inventoryId, quantity } })
  },
}
