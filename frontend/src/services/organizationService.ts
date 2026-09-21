import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'
import { compactParams } from '@/lib/utils'
import type { Page, PageParams } from '@/types/common'
import type { CreateOrganizationRequest, OrganizationResponse, UpdateOrganizationRequest } from '@/types/organization'
import type { RoleResponse } from '@/types/role'
import type { UserRequest, UserResponse } from '@/types/user'

export interface OrganizationListParams extends PageParams {
  search?: string
}

const { ORGANIZATIONS } = API_CONFIG.ENDPOINTS

/** Platform-owner only — reachable exclusively by the organization.read / organization.manage permissions. */
export const organizationService = {
  async list(params: OrganizationListParams = {}): Promise<Page<OrganizationResponse>> {
    const { data } = await apiClient.get<Page<OrganizationResponse>>(ORGANIZATIONS.LIST, { params: compactParams({ ...params }) })
    return data
  },

  async get(id: string): Promise<OrganizationResponse> {
    const { data } = await apiClient.get<OrganizationResponse>(ORGANIZATIONS.DETAIL(id))
    return data
  },

  async create(request: CreateOrganizationRequest): Promise<OrganizationResponse> {
    const { data } = await apiClient.post<OrganizationResponse>(ORGANIZATIONS.LIST, request)
    return data
  },

  async update(id: string, request: UpdateOrganizationRequest): Promise<OrganizationResponse> {
    const { data } = await apiClient.patch<OrganizationResponse>(ORGANIZATIONS.DETAIL(id), request)
    return data
  },

  /**
   * An organization only gets its first Admin at creation time (`create` above) — until this,
   * there was no way to add another user, or recover, if that admin's credentials were lost
   * before ever signing in once.
   */
  async listUsers(id: string, params: PageParams = {}): Promise<Page<UserResponse>> {
    const { data } = await apiClient.get<Page<UserResponse>>(ORGANIZATIONS.USERS(id), { params: compactParams({ ...params }) })
    return data
  },

  async createUser(id: string, request: UserRequest): Promise<UserResponse> {
    const { data } = await apiClient.post<UserResponse>(ORGANIZATIONS.USERS(id), request)
    return data
  },

  /** Backend PATCH expects the full request body; an empty password leaves the existing one unchanged. */
  async updateUser(id: string, userId: string, request: UserRequest): Promise<UserResponse> {
    const { data } = await apiClient.patch<UserResponse>(ORGANIZATIONS.USER_DETAIL(id, userId), request)
    return data
  },

  /** The organization's own roles — for the add/edit-user form's role picker. */
  async listRoles(id: string): Promise<RoleResponse[]> {
    const { data } = await apiClient.get<RoleResponse[]>(ORGANIZATIONS.ROLES(id))
    return data
  },
}
