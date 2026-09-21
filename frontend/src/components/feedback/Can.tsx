import type { ReactNode } from 'react'
import { useAuth } from '@/store/AuthContext'
import type { Permission } from '@/types/auth'

interface CanProps {
  permission: Permission | Permission[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Centralised UI permission gate. Hides actions the current role cannot perform.
 * This is a UX affordance only — every endpoint is also protected by @PreAuthorize on the backend.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasAnyPermission } = useAuth()
  const required = Array.isArray(permission) ? permission : [permission]
  return <>{hasAnyPermission(required) ? children : fallback}</>
}
