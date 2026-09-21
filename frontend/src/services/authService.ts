import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import type { LoginRequest, LoginResponse } from '@/types/auth'

export const authService = {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, request)
    return data
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, { refreshToken })
  },
}
