import type { ReactNode } from 'react'
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { errorMessage, isForbidden } from '@/lib/errors'

interface StateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

function StateLayout({ icon, title, description, action, className }: StateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icon && (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function EmptyState({ icon = <Inbox />, ...props }: StateProps) {
  return <StateLayout icon={icon} {...props} />
}

export function ForbiddenState({
  title = 'Access restricted',
  description = 'Your role does not grant access to this data. Contact an administrator if you need it.',
  ...props
}: Partial<StateProps>) {
  return <StateLayout icon={<ShieldAlert />} title={title} description={description} {...props} />
}

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** Renders the right state for a failed query: forbidden vs. generic error with retry. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  if (isForbidden(error)) return <ForbiddenState className={className} />
  return (
    <StateLayout
      className={className}
      icon={<TriangleAlert className="text-destructive" />}
      title="Couldn't load data"
      description={errorMessage(error)}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )
      }
    />
  )
}
