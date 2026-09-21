export const OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const
export type OrganizationStatus = (typeof OrganizationStatus)[keyof typeof OrganizationStatus]

export interface OrganizationResponse {
  id: string
  name: string
  status: OrganizationStatus
  createdAt: string
  updatedAt: string
}

/** Platform-owner only: creates the organization and its first Admin user in one step. */
export interface CreateOrganizationRequest {
  organizationName: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

export interface UpdateOrganizationRequest {
  name: string
  status: OrganizationStatus
}
