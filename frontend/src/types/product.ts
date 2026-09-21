export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus]

export interface ProductRequest {
  sku: string
  name: string
  description?: string | null
  price: number
  status?: ProductStatus
}

export interface ProductResponse {
  id: string
  sku: string
  name: string
  description?: string | null
  price: number
  status: ProductStatus
  createdAt: string
  updatedAt: string
}
