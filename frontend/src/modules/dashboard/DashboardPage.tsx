import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Boxes,
  CircleCheck,
  Clock,
  Package,
  PackageX,
  Plus,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Can } from '@/components/feedback/Can'
import { StatusBadge } from '@/components/data/StatusBadge'
import { dashboardService } from '@/services/dashboardService'
import { useAuth } from '@/store/AuthContext'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatNumber } from '@/lib/format'
import { cn, shortId } from '@/lib/utils'
import { Permission } from '@/types/auth'
import { LOW_STOCK_THRESHOLD } from '@/types/inventory'
import type { DashboardSummary } from '@/types/dashboard'

interface KpiProps {
  label: string
  value: number | undefined
  icon: ReactNode
  hint?: ReactNode
  href?: string
  tone?: 'default' | 'warning'
  loading: boolean
}

function Kpi({ label, value, icon, hint, href, tone = 'default', loading }: KpiProps) {
  const body = (
    <Card
      className={cn(
        'h-full gap-3 py-5 transition-colors',
        href && 'hover:border-foreground/20',
        tone === 'warning' && value ? 'border-warning/50 bg-warning/5' : '',
      )}
    >
      <CardHeader className="px-5">
        <CardDescription className="flex items-center gap-2 font-medium">
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-md [&_svg]:size-4',
              tone === 'warning' && value ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
            )}
          >
            {icon}
          </span>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="tabular text-3xl font-semibold tracking-tight">{formatNumber(value ?? 0)}</p>
        )}
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link to={href} className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-[3px]">
      {body}
    </Link>
  ) : (
    body
  )
}

/** Share of open vs. completed orders as a single labelled meter (two values don't warrant a chart). */
function OrderPipeline({ summary }: { summary: DashboardSummary }) {
  const pending = summary.pendingOrders ?? 0
  const completed = summary.completedOrders ?? 0
  const total = pending + completed
  const pendingPct = total ? (pending / total) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order pipeline</CardTitle>
        <CardDescription>Pending orders awaiting confirmation vs. completed orders</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No pending or completed orders yet.</p>
        ) : (
          <>
            <div
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`${pending} pending and ${completed} completed orders`}
            >
              {pending > 0 && <div className="bg-warning h-full rounded-l-full" style={{ width: `${pendingPct}%` }} />}
              {completed > 0 && <div className="bg-success h-full flex-1 rounded-r-full" />}
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Clock className="text-warning mt-0.5 size-4" />
                <div>
                  <dt className="text-muted-foreground text-xs">Pending</dt>
                  <dd className="tabular text-lg font-semibold">
                    {formatNumber(pending)}{' '}
                    <span className="text-muted-foreground text-xs font-normal">({Math.round(pendingPct)}%)</span>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CircleCheck className="text-success mt-0.5 size-4" />
                <div>
                  <dt className="text-muted-foreground text-xs">Completed</dt>
                  <dd className="tabular text-lg font-semibold">
                    {formatNumber(completed)}{' '}
                    <span className="text-muted-foreground text-xs font-normal">({Math.round(100 - pendingPct)}%)</span>
                  </dd>
                </div>
              </div>
            </dl>
          </>
        )}
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link to="/orders?status=PENDING">
            Review pending orders <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentOrders({ summary }: { summary: DashboardSummary }) {
  const navigate = useNavigate()
  const orders = summary.recentOrders ?? []
  return (
    <Card className="gap-0 overflow-hidden pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Recent orders</CardTitle>
        <CardDescription>Latest orders across your organization</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/orders">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      {orders.length === 0 ? (
        <div className="border-t">
          <EmptyState
            icon={<ShoppingCart />}
            title="No orders yet"
            description="New orders will show up here as soon as they're placed."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                <TableCell className="font-mono text-xs font-medium">#{shortId(order.id)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{order.customerName ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="tabular text-right font-medium">{formatCurrency(order.totalAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardService.summary,
    refetchInterval: 60_000,
  })
  const summary = query.data
  const loading = query.isLoading

  const greeting = (() => {
    const hour = new Date().getHours()
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  })()

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description="Live snapshot of catalogue, stock and order flow. Figures are cached for up to 60 seconds and refresh automatically when events arrive."
        actions={
          <>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={cn(query.isFetching && 'animate-spin')} /> Refresh
            </Button>
            <Can permission={Permission.ORDER_CREATE}>
              <Button asChild>
                <Link to="/orders?new=1">
                  <Plus /> New order
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      {query.error ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <>
          {!!summary?.lowStockProducts && (
            <div className="border-warning/50 bg-warning/8 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm">
                <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-medium">{formatNumber(summary.lowStockProducts)} stock records</span> are below the
                  low-stock threshold of {LOW_STOCK_THRESHOLD} available units.
                </p>
              </div>
              {hasPermission(Permission.INVENTORY_READ) && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/inventory?sort=availableQuantity,asc">
                    Review stock <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          )}

          <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Products" value={summary?.totalProducts} icon={<Package />} href="/products" loading={loading} />
            <Kpi label="Warehouses" value={summary?.totalWarehouses} icon={<Warehouse />} href="/warehouses" loading={loading} />
            <Kpi
              label="Available units"
              value={summary?.totalAvailableInventory}
              icon={<Boxes />}
              hint="Unreserved stock"
              href="/inventory"
              loading={loading}
            />
            <Kpi
              label="Pending orders"
              value={summary?.pendingOrders}
              icon={<Clock />}
              href="/orders?status=PENDING"
              loading={loading}
            />
            <Kpi
              label="Completed orders"
              value={summary?.completedOrders}
              icon={<CircleCheck />}
              href="/orders?status=COMPLETED"
              loading={loading}
            />
            <Kpi
              label="Low stock"
              value={summary?.lowStockProducts}
              icon={<PackageX />}
              hint={`Records under ${LOW_STOCK_THRESHOLD} units`}
              href="/inventory?sort=availableQuantity,asc"
              tone="warning"
              loading={loading}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            {loading || !summary ? (
              <>
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
              </>
            ) : (
              <>
                <RecentOrders summary={summary} />
                <OrderPipeline summary={summary} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
