/**
 * Roles are now dynamic per-organization records (see types/role.ts), not a fixed enum — an
 * organization can rename/create/delete roles beyond the seeded Admin/Manager/Staff. These names
 * are display-only conveniences for the three seeded system roles and the platform-level role.
 */
export const SystemRoleName = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  PLATFORM_OWNER: 'Platform Owner',
} as const

/** Permission strings granted by the backend (role/application/RolePermissionService). */
export const Permission = {
  PRODUCT_READ: 'product.read',
  PRODUCT_WRITE: 'product.write',
  WAREHOUSE_READ: 'warehouse.read',
  WAREHOUSE_WRITE: 'warehouse.write',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_UPDATE: 'inventory.update',
  ORDER_READ: 'order.read',
  ORDER_CREATE: 'order.create',
  ORDER_CANCEL: 'order.cancel',
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_WRITE: 'customer.write',
  USER_READ: 'user.read',
  USER_MANAGE: 'user.manage',
  AUDIT_READ: 'audit.read',
  ROLE_READ: 'role.read',
  ROLE_MANAGE: 'role.manage',
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_MANAGE: 'organization.manage',
} as const
export type Permission = (typeof Permission)[keyof typeof Permission]

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  userId: string
  email: string
  name: string
  roleId: string
  /** Free-form display name — e.g. "Admin" or a custom role an org created. */
  roleName: string
  isPlatformOwner: boolean
  /** Null only for the platform-owner role, which isn't scoped to one organization. */
  organizationId: string | null
  /**
   * Snapshot taken at login/refresh time, for menu/UI gating only. The backend re-resolves
   * permissions from the database on every request, so a role edit takes effect for API calls
   * immediately — this snapshot just won't reflect that in the UI until the next login/refresh.
   */
  permissions: string[]
  accessToken: string
  refreshToken: string
}

/** Persisted user profile — deliberately excludes tokens. */
export type AuthUser = Omit<LoginResponse, 'accessToken' | 'refreshToken'>

export interface RefreshTokenRequest {
  refreshToken: string
}
