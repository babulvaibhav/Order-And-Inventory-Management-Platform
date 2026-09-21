export const WarehouseStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const
export type WarehouseStatus = (typeof WarehouseStatus)[keyof typeof WarehouseStatus]

export interface WarehouseRequest {
  name: string
  address?: string | null
  status?: WarehouseStatus
}

export interface WarehouseResponse {
  id: string
  name: string
  address?: string | null
  status: WarehouseStatus
  createdAt: string
  updatedAt: string
}
