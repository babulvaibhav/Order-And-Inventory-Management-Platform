export interface UserRequest {
  email: string
  password: string
  name: string
  roleId: string
}

export interface UserResponse {
  id: string
  /** Null only for a platform-owner user. */
  organizationId: string | null
  email: string
  name: string
  roleId: string
  roleName: string
  active: boolean
  createdAt: string
  updatedAt: string
}
