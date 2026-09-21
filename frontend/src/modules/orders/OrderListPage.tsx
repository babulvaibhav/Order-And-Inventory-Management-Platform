import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Eye, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { StatusBadge } from '@/components/data/StatusBadge'
import { RowActions, type RowAction } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useCustomerLookup } from '@/hooks/useLookups'
import { useAuth } from '@/store/AuthContext'
import { orderService } from '@/services/orderService'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { shortId } from '@/lib/utils'
import { Permission } from '@/types/auth'
import { OrderStatus, type OrderResponse } from '@/types/order'
import { CreateOrderDialog } from './CreateOrderDialog'
import { TRANSITION_LABELS, useOrderStatus } from './useOrderStatus'

const DEFAULT_SORT: SortState = { field: 'createdAt', direction: 'desc' }
const FILTER_KEYS = ['search', 'status'] as const
const STATUS_TABS = ['ALL', ...Object.values(OrderStatus)] as const

export default function OrderListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })
  const customers = useCustomerLookup()
  const { canTransitionTo, nextStatuses, mutation } = useOrderStatus()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('new') === '1')
  const [cancelling, setCancelling] = useState<OrderResponse | null>(null)

  // Deep link (/orders?new=1) opens the create dialog once, then drops the flag from the URL.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('new')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  const params = {
    ...list.pageable,
    search: list.filters.search || undefined,
    status: (list.filters.status as OrderStatus) || undefined,
  }
  const query = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => orderService.list(params),
    placeholderData: keepPreviousData,
  })

  const rowActions = (order: OrderResponse): RowAction[] => {
    const actions: RowAction[] = [{ label: 'View details', icon: <Eye />, onSelect: () => navigate(`/orders/${order.id}`) }]
    // Per-target-status (cancel needs order.cancel, everything else needs order.create) — see
    // useOrderStatus.ts. Skips statuses this role can't apply instead of hiding every action
    // whenever order.cancel is missing.
    nextStatuses(order)
      .filter((status) => canTransitionTo(status))
      .forEach((status) => {
        if (status === 'CANCELLED') {
          actions.push({ label: 'Cancel order', icon: <CircleX />, destructive: true, onSelect: () => setCancelling(order) })
        } else {
          actions.push({
            label: TRANSITION_LABELS[status] ?? status,
            icon: <CircleCheck />,
            disabled: mutation.isPending,
            onSelect: () => mutation.mutate({ order, status }),
          })
        }
      })
    return actions
  }

  const columns: Column<OrderResponse>[] = [
    {
      id: 'id',
      header: 'Order',
      cell: (order) => <span className="font-mono text-xs font-medium">#{shortId(order.id)}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (order) => {
        const customer = customers.byId.get(order.customerId)
        return (
          <div className="min-w-0">
            <div className="max-w-[220px] truncate font-medium">{customer?.name ?? 'Unknown customer'}</div>
            {customer?.email && <div className="text-muted-foreground max-w-[220px] truncate text-xs">{customer.email}</div>}
          </div>
        )
      },
    },
    {
      id: 'items',
      header: 'Items',
      align: 'right',
      hideBelow: 'md',
      cell: (order) => (
        <span className="tabular text-muted-foreground">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
      ),
    },
    {
      id: 'total',
      header: 'Total',
      sortField: 'totalAmount',
      align: 'right',
      cell: (order) => <span className="tabular font-medium">{formatCurrency(order.totalAmount)}</span>,
    },
    { id: 'status', header: 'Status', sortField: 'status', cell: (order) => <StatusBadge status={order.status} /> },
    {
      id: 'createdAt',
      header: 'Placed',
      sortField: 'createdAt',
      hideBelow: 'sm',
      cell: (order) => <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (order) => <RowActions actions={rowActions(order)} />,
    },
  ]

  const hasFilters = !!(list.filters.search || list.filters.status)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Placing an order reserves stock immediately; cancelling releases it."
        actions={
          <Can permission={Permission.ORDER_CREATE}>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New order
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Tabs
            value={list.filters.status || 'ALL'}
            onValueChange={(status) => list.setFilters({ status: status === 'ALL' ? '' : status, search: '' })}
          >
            <TabsList>
              {STATUS_TABS.map((status) => (
                <TabsTrigger key={status} value={status} className="px-3">
                  {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <SearchInput
          value={list.filters.search}
          onChange={(search) => list.setFilters({ search, status: '' })}
          placeholder="Search customer name or email…"
        />
      </div>

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(order) => order.id}
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={
          hasFilters
            ? { title: 'No matching orders', description: 'Try another status or search term.' }
            : {
                icon: <ShoppingCart />,
                title: 'No orders yet',
                description: 'Orders you place will appear here with their fulfilment status.',
                action: hasPermission(Permission.ORDER_CREATE) ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus /> New order
                  </Button>
                ) : undefined,
              }
        }
      />

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this order?"
        description="The order will be cancelled and all of its reserved stock released back to available inventory. This cannot be undone."
        confirmLabel="Cancel order"
        destructive
        pending={mutation.isPending}
        onConfirm={() =>
          cancelling &&
          mutation.mutate({ order: cancelling, status: 'CANCELLED' }, { onSettled: () => setCancelling(null) })
        }
      />
    </div>
  )
}
