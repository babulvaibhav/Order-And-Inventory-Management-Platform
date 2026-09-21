export interface AuditLogResponse {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  /** JSON serialized as a string by the backend. */
  oldValue: string | null
  newValue: string | null
  timestamp: string
  createdAt: string
}

export interface AuditLogQuery {
  entity?: string
  action?: string
  startDate?: string
  endDate?: string
}
