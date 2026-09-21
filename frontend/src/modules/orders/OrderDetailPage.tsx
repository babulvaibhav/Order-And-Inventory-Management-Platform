import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, CircleX, LoaderCircle, Lock, Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ErrorState } from '@/components/feedback/States'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { StatusBadge } from '@/components/data/StatusBadge'
import { orderService } from '@/services/orderService'
import { useCustomerLookup, useProductLookup, useWarehouseLookup } from '@/hooks/useLookups'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format'
import { cn, shortId } from '@/lib/utils'
import type { OrderResponse, OrderStatus } from '@/types/order'
import { TRANSITION_LABELS, useOrderStatus } from './useOrderStatus'

const FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED']

function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="border-destructive/30 bg-destructive/8 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
        <CircleX className="size-4" />
        This order was cancelled. Its reserved stock was released back to inventory.
      </div>
    )
  }
  const current = FLOW.indexOf(status)
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {FLOW.map((step, index) => {
        const done = index < current || status === 'COMPLETED'
        const active = index === current && status !== 'COMPLETED'
        return (
          <li key={step} className="flex flex-col gap-2">
            <div className={cn('h-1.5 rounded-full', done ? 'bg-success' : active ? 'bg-brand' : 'bg-muted')} />
            <div className="flex items-center gap-1.5 text-xs">
              {done ? (
                <Check className="text-success size-3.5" />
              ) : (
                <span className={cn('size-2 rounded-full', active ? 'bg-brand' : 'bg-muted-foreground/30')} />
              )}
              <span className={cn(active || done ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function OrderActions({ order }: { order: OrderResponse }) {
  const { canTransitionTo, nextStatuses, mutation } = useOrderStatus()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const next = nextStatuses(order)
  // Per-target-status, not a single blanket permission: cancelling needs order.cancel, every
  // other transition only needs order.create — mirrors OrderService.updateOrderStatus. Without
  // this, a STAFF user (order.create but not order.cancel) saw no actions at all even for
  // transitions the backend would happily accept from them.
  const allowedNext = next.filter((status) => canTransitionTo(status))

  if (next.length === 0) return null
  if (allowedNext.length === 0) {
    return (
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Lock className="size-3.5" /> Your role can view this order but not change its status.
      </p>
    )
  }

  const pendingStatus = mutation.isPending ? mutation.variables?.status : undefined
  return (
    <>
      {allowedNext.includes('CANCELLED') && (
        <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={mutation.isPending}>
          <CircleX /> Cancel order
        </Button>
      )}
      {allowedNext
        .filter((status) => status !== 'CANCELLED')
        .map((status) => (
          <Button key={status} onClick={() => mutation.mutate({ order, status })} disabled={mutation.isPending}>
            {pendingStatus === status ? <LoaderCircle className="animate-spin" /> : <Check />}
            {TRANSITION_LABELS[status]}
          </Button>
        ))}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this order?"
        description="All reserved stock will be released back to available inventory. This cannot be undone."
        confirmLabel="Cancel order"
        destructive
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate({ order, status: 'CANCELLED' }, { onSettled: () => setConfirmCancel(false) })}
      />
    </>
  )
}

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  const customers = useCustomerLookup()
  const products = useProductLookup()
  const warehouses = useWarehouseLookup()

  const query = useQuery({ queryKey: queryKeys.orders.detail(id), queryFn: () => orderService.get(id) })

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }
  if (query.error || !query.data) {
    return (
      <div className="bg-card rounded-xl border">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const order = query.data
  const customer = customers.byId.get(order.customerId)
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/orders">
          <ArrowLeft /> All orders
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Placed ${formatDateTime(order.createdAt)}`}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">#{shortId(order.id)}</span>
            <StatusBadge status={order.status} className="text-sm" />
          </span>
        }
        actions={<OrderActions order={order} />}
      />

      <StatusStepper status={order.status} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Warehouse</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const product = products.byId.get(item.productId)
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {product ? (
                        <Link to={`/products/${product.id}`} className="hover:underline">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-muted-foreground font-mono text-xs">{product.sku}</div>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">{shortId(item.productId)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {(item.warehouseId && warehouses.byId.get(item.warehouseId)?.name) ?? '—'}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatNumber(item.quantity)}</TableCell>
                    <TableCell className="tabular hidden text-right sm:table-cell">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatCurrency(item.totalPrice ?? item.unitPrice * item.quantity)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="bg-muted/40 flex items-center justify-between border-t px-6 py-4">
            <span className="text-muted-foreground text-sm">
              {order.items.length} {order.items.length === 1 ? 'line' : 'lines'} · {formatNumber(units)} units
            </span>
            <div className="text-right">
              <div className="text-muted-foreground text-xs tracking-wide uppercase">Total</div>
              <div className="tabular text-xl font-semibold">{formatCurrency(order.totalAmount)}</div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {customer ? (
                <>
                  <p className="font-medium">{customer.name}</p>
                  {customer.email && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Mail className="size-3.5" /> {customer.email}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Phone className="size-3.5" /> {customer.phone}
                    </p>
                  )}
                  {customer.address && (
                    <p className="text-muted-foreground flex items-start gap-2">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" /> {customer.address}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground font-mono text-xs">{order.customerId}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placed</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last updated</span>
                <span>{formatDateTime(order.updatedAt)}</span>
              </div>
              {order.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">Notes</p>
                    <p className="whitespace-pre-wrap">{order.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
