import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { AuditLogQuery, AuditLogResponse } from '@/types/audit'
import type { Page, PageParams } from '@/types/common'

/** Backend applies one filter: date range (both bounds) > entity > action. */
export type AuditListParams = PageParams & AuditLogQuery

export const auditService = {
  async list(params: AuditListParams = {}): Promise<Page<AuditLogResponse>> {
    const { data } = await apiClient.get<Page<AuditLogResponse>>(API_CONFIG.ENDPOINTS.AUDIT_LOGS.LIST, {
      params: compactParams({ ...params }),
    })
    return data
  },
}
