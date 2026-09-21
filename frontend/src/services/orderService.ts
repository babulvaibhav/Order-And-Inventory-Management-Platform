import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { OrderRequest, OrderResponse, OrderStatus } from '@/types/order'

/** Backend applies only one filter: search (customer name/email) takes precedence over status. */
export interface OrderListParams extends PageParams {
  search?: string
  status?: OrderStatus
}

const { ORDERS } = API_CONFIG.ENDPOINTS

export const orderService = {
  async list(params: OrderListParams = {}): Promise<Page<OrderResponse>> {
    const { data } = await apiClient.get<Page<OrderResponse>>(ORDERS.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<OrderResponse> {
    const { data } = await apiClient.get<OrderResponse>(ORDERS.DETAIL(id))
    return data
  },

  async create(request: OrderRequest): Promise<OrderResponse> {
    const { data } = await apiClient.post<OrderResponse>(ORDERS.LIST, request)
    return data
  },

  async updateStatus(id: string, status: OrderStatus): Promise<OrderResponse> {
    const { data } = await apiClient.patch<OrderResponse>(ORDERS.UPDATE_STATUS(id), { status })
    return data
  },
}
