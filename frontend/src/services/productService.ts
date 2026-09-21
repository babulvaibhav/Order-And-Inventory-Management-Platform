import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { ProductRequest, ProductResponse, ProductStatus } from '@/types/product'

export interface ProductListParams extends PageParams {
  search?: string
  status?: ProductStatus
}

const { PRODUCTS } = API_CONFIG.ENDPOINTS

export const productService = {
  async list(params: ProductListParams = {}): Promise<Page<ProductResponse>> {
    const { data } = await apiClient.get<Page<ProductResponse>>(PRODUCTS.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<ProductResponse> {
    const { data } = await apiClient.get<ProductResponse>(PRODUCTS.DETAIL(id))
    return data
  },

  async create(request: ProductRequest): Promise<ProductResponse> {
    const { data } = await apiClient.post<ProductResponse>(PRODUCTS.LIST, request)
    return data
  },

  /** Backend PATCH expects the full request body. */
  async update(id: string, request: ProductRequest): Promise<ProductResponse> {
    const { data } = await apiClient.patch<ProductResponse>(PRODUCTS.DETAIL(id), request)
    return data
  },

  async disable(id: string): Promise<void> {
    await apiClient.patch(PRODUCTS.DISABLE(id))
  },
}
