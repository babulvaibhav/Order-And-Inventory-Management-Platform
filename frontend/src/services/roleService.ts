import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import type { PermissionDef, RolePermissionsRequest, RoleRequest, RoleResponse } from '@/types/role'

const { ROLES, PERMISSIONS } = API_CONFIG.ENDPOINTS

export const roleService = {
  async list(): Promise<RoleResponse[]> {
    const { data } = await apiClient.get<RoleResponse[]>(ROLES.LIST)
    return data
  },

  async create(request: RoleRequest): Promise<RoleResponse> {
    const { data } = await apiClient.post<RoleResponse>(ROLES.LIST, request)
    return data
  },

  async rename(id: string, request: RoleRequest): Promise<RoleResponse> {
    const { data } = await apiClient.patch<RoleResponse>(ROLES.DETAIL(id), request)
    return data
  },

  /** Replaces the role's full permission set. */
  async updatePermissions(id: string, request: RolePermissionsRequest): Promise<RoleResponse> {
    const { data } = await apiClient.patch<RoleResponse>(ROLES.PERMISSIONS(id), request)
    return data
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(ROLES.DETAIL(id))
  },

  /** The full permission catalog, for building a permission-matrix editor. */
  async listPermissionCatalog(): Promise<PermissionDef[]> {
    const { data } = await apiClient.get<PermissionDef[]>(PERMISSIONS.LIST)
    return data
  },
}
