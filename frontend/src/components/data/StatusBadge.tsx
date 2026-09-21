import { Badge } from '@/components/ui/badge'
import { humanize } from '@/lib/format'
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const STATUS_VARIANTS: Record<string, Variant> = {
  // Products / warehouses / organizations
  ACTIVE: 'success',
  DISABLED: 'muted',
  SUSPENDED: 'destructive',
  // Orders
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  // System roles (display names — see PermissionCodes.ROLE_NAME_* on the backend).
  // Custom roles an organization creates fall through to the 'outline' default below.
  Admin: 'default',
  Manager: 'info',
  Staff: 'secondary',
  'Platform Owner': 'default',
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const variant = STATUS_VARIANTS[status] ?? 'outline'
  return (
    <Badge variant={variant} className={className}>
      {variant !== 'default' && variant !== 'outline' && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {humanize(status)}
    </Badge>
  )
}
