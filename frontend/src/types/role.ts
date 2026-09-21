export interface PermissionDef {
  id: string
  code: string
  description: string
  category: string
}

export interface RoleResponse {
  id: string
  name: string
  /** The seeded Admin/Manager/Staff roles — can't be renamed or deleted, but their permissions can be edited. */
  isSystem: boolean
  permissions: PermissionDef[]
}

export interface RoleRequest {
  name: string
}

export interface RolePermissionsRequest {
  permissionIds: string[]
}
