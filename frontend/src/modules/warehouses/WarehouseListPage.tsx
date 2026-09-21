import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Boxes, MapPin, Pencil, Plus, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useAuth } from '@/store/AuthContext'
import { warehouseService } from '@/services/warehouseService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { Permission } from '@/types/auth'
import { WarehouseStatus, type WarehouseResponse } from '@/types/warehouse'
import { WarehouseFormSheet } from './WarehouseFormSheet'

const DEFAULT_SORT: SortState = { field: 'name', direction: 'asc' }
const FILTER_KEYS = ['status'] as const
const ALL = 'ALL'

export default function WarehouseListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(Permission.WAREHOUSE_WRITE)
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<WarehouseResponse | null>(null)
  const [disabling, setDisabling] = useState<WarehouseResponse | null>(null)

  const params = { ...list.pageable, status: (list.filters.status as WarehouseStatus) || undefined }
  const query = useQuery({
    queryKey: queryKeys.warehouses.list(params),
    queryFn: () => warehouseService.list(params),
    placeholderData: keepPreviousData,
  })

  const disableMutation = useMutation({
    mutationFn: (warehouse: WarehouseResponse) => warehouseService.disable(warehouse.id),
    onSuccess: (_, warehouse) => {
      toast.success('Warehouse disabled', { description: warehouse.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.warehouses })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      setDisabling(null)
    },
    onError: (error) => toast.error('Could not disable warehouse', { description: errorMessage(error) }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const columns: Column<WarehouseResponse>[] = [
    {
      id: 'name',
      header: 'Warehouse',
      sortField: 'name',
      cell: (warehouse) => (
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Warehouse className="size-4" />
          </div>
          <span className="font-medium">{warehouse.name}</span>
        </div>
      ),
    },
    {
      id: 'address',
      header: 'Address',
      hideBelow: 'md',
      cell: (warehouse) =>
        warehouse.address ? (
          <span className="text-muted-foreground inline-flex max-w-[360px] items-center gap-1.5 truncate">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{warehouse.address}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: 'status', header: 'Status', sortField: 'status', cell: (warehouse) => <StatusBadge status={warehouse.status} /> },
    {
      id: 'createdAt',
      header: 'Created',
      sortField: 'createdAt',
      hideBelow: 'sm',
      cell: (warehouse) => <span className="text-muted-foreground">{formatDate(warehouse.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (warehouse) => (
        <RowActions
          actions={[
            { label: 'View stock', icon: <Boxes />, onSelect: () => navigate(`/inventory?warehouseId=${warehouse.id}`) },
            {
              label: 'Edit',
              icon: <Pencil />,
              hidden: !canWrite,
              onSelect: () => {
                setEditing(warehouse)
                setFormOpen(true)
              },
            },
            {
              label: 'Disable',
              icon: <Ban />,
              destructive: true,
              hidden: !canWrite || warehouse.status === WarehouseStatus.DISABLED,
              onSelect: () => setDisabling(warehouse),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Stocking locations for your organization. Inventory is tracked per warehouse and product."
        actions={
          <Can permission={Permission.WAREHOUSE_WRITE}>
            <Button onClick={openCreate}>
              <Plus /> New warehouse
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={list.filters.status || ALL} onValueChange={(status) => list.setFilters({ status: status === ALL ? '' : status })}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value={WarehouseStatus.ACTIVE}>Active</SelectItem>
            <SelectItem value={WarehouseStatus.DISABLED}>Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(warehouse) => warehouse.id}
        onRowClick={(warehouse) => navigate(`/inventory?warehouseId=${warehouse.id}`)}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={
          list.filters.status
            ? { title: 'No warehouses with this status' }
            : {
                icon: <Warehouse />,
                title: 'No warehouses yet',
                description: 'Add a warehouse before recording stock.',
                action: canWrite ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus /> New warehouse
                  </Button>
                ) : undefined,
              }
        }
      />

      <WarehouseFormSheet open={formOpen} onOpenChange={setFormOpen} warehouse={editing} />
      <ConfirmDialog
        open={!!disabling}
        onOpenChange={(open) => !open && setDisabling(null)}
        title="Disable warehouse?"
        description={
          <>
            <span className="text-foreground font-medium">{disabling?.name}</span> will be marked as disabled. Its stock
            records are kept.
          </>
        }
        confirmLabel="Disable warehouse"
        destructive
        pending={disableMutation.isPending}
        onConfirm={() => disabling && disableMutation.mutate(disabling)}
      />
    </div>
  )
}
