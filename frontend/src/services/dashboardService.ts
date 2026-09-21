import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import type { DashboardSummary } from '@/types/dashboard'

export const dashboardService = {
  /** Cached server-side in Redis for ~60s per organization. */
  async summary(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>(API_CONFIG.ENDPOINTS.DASHBOARD.SUMMARY)
    return data
  },
}
