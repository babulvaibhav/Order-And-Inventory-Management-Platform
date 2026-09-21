import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { ForbiddenState } from '@/components/feedback/States'
import { useAuth } from '@/store/AuthContext'
import type { Permission } from '@/types/auth'
import { ALL_NAV_ITEMS } from '@/components/layout/navigation'

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2 text-sm">
      <LoaderCircle className="size-4 animate-spin" /> {label}
    </div>
  )
}

/** Requires an authenticated session; otherwise redirects to /login remembering the target page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, isAuthenticated } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenLoader label="Restoring your session…" />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

/** Route-level permission gate. The backend enforces the same rules on every endpoint. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) {
    return (
      <div className="bg-card rounded-xl border">
        <ForbiddenState description="Your role does not include access to this area. Ask an organization administrator if you need it." />
      </div>
    )
  }
  return <>{children}</>
}

/** Sends the user to the first screen their role can open (dashboard for built-in roles). */
export function HomeRedirect() {
  const { hasPermission } = useAuth()
  const first = ALL_NAV_ITEMS.find((item) => hasPermission(item.permission))
  return <Navigate to={first?.path ?? '/dashboard'} replace />
}
