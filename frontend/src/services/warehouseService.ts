import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { WarehouseRequest, WarehouseResponse, WarehouseStatus } from '@/types/warehouse'

export interface WarehouseListParams extends PageParams {
  status?: WarehouseStatus
}

const { WAREHOUSES } = API_CONFIG.ENDPOINTS

export const warehouseService = {
  async list(params: WarehouseListParams = {}): Promise<Page<WarehouseResponse>> {
    const { data } = await apiClient.get<Page<WarehouseResponse>>(WAREHOUSES.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<WarehouseResponse> {
    const { data } = await apiClient.get<WarehouseResponse>(WAREHOUSES.DETAIL(id))
    return data
  },

  async create(request: WarehouseRequest): Promise<WarehouseResponse> {
    const { data } = await apiClient.post<WarehouseResponse>(WAREHOUSES.LIST, request)
    return data
  },

  /** Backend PATCH expects the full request body. */
  async update(id: string, request: WarehouseRequest): Promise<WarehouseResponse> {
    const { data } = await apiClient.patch<WarehouseResponse>(WAREHOUSES.DETAIL(id), request)
    return data
  },

  async disable(id: string): Promise<void> {
    await apiClient.patch(WAREHOUSES.DISABLE(id))
  },
}
