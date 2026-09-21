import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { UserRequest, UserResponse } from '@/types/user'

const { USERS } = API_CONFIG.ENDPOINTS

export const userService = {
  async list(params: PageParams = {}): Promise<Page<UserResponse>> {
    const { data } = await apiClient.get<Page<UserResponse>>(USERS.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async create(request: UserRequest): Promise<UserResponse> {
    const { data } = await apiClient.post<UserResponse>(USERS.LIST, request)
    return data
  },

  /** Backend PATCH expects the full request body, including a password. */
  async update(id: string, request: UserRequest): Promise<UserResponse> {
    const { data } = await apiClient.patch<UserResponse>(USERS.DETAIL(id), request)
    return data
  },

  /** Soft delete (sets active=false). */
  async deactivate(id: string): Promise<void> {
    await apiClient.delete(USERS.DETAIL(id))
  },
}
