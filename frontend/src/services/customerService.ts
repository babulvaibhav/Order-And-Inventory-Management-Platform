import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { CustomerRequest, CustomerResponse } from '@/types/customer'

export interface CustomerListParams extends PageParams {
  search?: string
}

const { CUSTOMERS } = API_CONFIG.ENDPOINTS

export const customerService = {
  async list(params: CustomerListParams = {}): Promise<Page<CustomerResponse>> {
    const { data } = await apiClient.get<Page<CustomerResponse>>(CUSTOMERS.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<CustomerResponse> {
    const { data } = await apiClient.get<CustomerResponse>(CUSTOMERS.DETAIL(id))
    return data
  },

  async create(request: CustomerRequest): Promise<CustomerResponse> {
    const { data } = await apiClient.post<CustomerResponse>(CUSTOMERS.LIST, request)
    return data
  },

  /** Backend PATCH expects the full request body. */
  async update(id: string, request: CustomerRequest): Promise<CustomerResponse> {
    const { data } = await apiClient.patch<CustomerResponse>(CUSTOMERS.DETAIL(id), request)
    return data
  },
}
