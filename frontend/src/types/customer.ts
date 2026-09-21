export interface CustomerRequest {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export interface CustomerResponse {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  createdAt: string
  updatedAt: string
}
