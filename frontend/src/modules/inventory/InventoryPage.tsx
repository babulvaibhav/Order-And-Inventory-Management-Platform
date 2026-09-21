import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Boxes, PackagePlus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/feedback/PageHeader'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { EntityCombobox } from '@/components/data/EntityCombobox'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useProductLookup, useWarehouseLookup } from '@/hooks/useLookups'
import { useAuth } from '@/store/AuthContext'
import { inventoryService } from '@/services/inventoryService'
import { queryKeys } from '@/lib/queryKeys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { Permission } from '@/types/auth'
import { LOW_STOCK_THRESHOLD, type InventoryResponse } from '@/types/inventory'
import { AddStockDialog, AdjustStockDialog, TransferStockDialog } from './InventoryDialogs'

const DEFAULT_SORT: SortState = { field: 'updatedAt', direction: 'desc' }
const FILTER_KEYS = ['warehouseId', 'productId'] as const

function StockLevel({ row }: { row: InventoryResponse }) {
  const total = Math.max(1, row.availableQuantity + row.reservedQuantity)
  const availablePct = (row.availableQuantity / total) * 100
  const low = row.availableQuantity < LOW_STOCK_THRESHOLD
  return (
    <div className="flex min-w-[140px] items-center justify-end gap-3">
      {row.availableQuantity === 0 ? (
        <Badge variant="destructive">Out of stock</Badge>
      ) : (
        low && <Badge variant="warning">Low</Badge>
      )}
      <div className="w-16">
        <div className="tabular text-right font-semibold">{formatNumber(row.availableQuantity)}</div>
        <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className={low ? 'bg-warning h-full' : 'bg-success h-full'}
            style={{ width: `${Math.min(100, Math.max(availablePct, row.availableQuantity > 0 ? 6 : 0))}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission(Permission.INVENTORY_UPDATE)
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })
  const products = useProductLookup()
  const warehouses = useWarehouseLookup()

  const [addOpen, setAddOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferDefaults, setTransferDefaults] = useState<{ productId?: string; sourceWarehouseId?: string }>()
  const [adjusting, setAdjusting] = useState<InventoryResponse | null>(null)

  // Backend applies one filter at a time (warehouse takes precedence); the UI keeps them exclusive.
  const params = {
    ...list.pageable,
    warehouseId: list.filters.warehouseId || undefined,
    productId: list.filters.warehouseId ? undefined : list.filters.productId || undefined,
  }
  const query = useQuery({
    queryKey: queryKeys.inventory.list(params),
    queryFn: () => inventoryService.list(params),
    placeholderData: keepPreviousData,
  })

  const productOptions = useMemo(
    () => products.items.map((p) => ({ value: p.id, label: p.name, description: p.sku, keywords: [p.sku] })),
    [products.items],
  )
  const warehouseOptions = useMemo(
    () => warehouses.items.map((w) => ({ value: w.id, label: w.name, description: w.address ?? undefined })),
    [warehouses.items],
  )

  const pageRows = query.data?.content ?? []
  const lowOnPage = pageRows.filter((row) => row.availableQuantity < LOW_STOCK_THRESHOLD).length

  const openTransfer = (defaults?: { productId?: string; sourceWarehouseId?: string }) => {
    setTransferDefaults(defaults)
    setTransferOpen(true)
  }

  const columns: Column<InventoryResponse>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (row) => {
        const product = products.byId.get(row.productId)
        return product ? (
          <Link to={`/products/${product.id}`} className="group block min-w-0" onClick={(event) => event.stopPropagation()}>
            <div className="max-w-[240px] truncate font-medium group-hover:underline">{product.name}</div>
            <div className="text-muted-foreground font-mono text-xs">{product.sku}</div>
          </Link>
        ) : (
          <span className="text-muted-foreground">{products.isLoading ? 'Loading…' : 'Unknown product'}</span>
        )
      },
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (row) => warehouses.byId.get(row.warehouseId)?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'available',
      header: 'Available',
      sortField: 'availableQuantity',
      align: 'right',
      cell: (row) => <StockLevel row={row} />,
    },
    {
      id: 'reserved',
      header: (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help underline decoration-dotted underline-offset-4">Reserved</span>
          </TooltipTrigger>
          <TooltipContent>Held by open orders; released on cancellation.</TooltipContent>
        </Tooltip>
      ),
      sortField: 'reservedQuantity',
      align: 'right',
      cell: (row) => <span className="tabular text-muted-foreground">{formatNumber(row.reservedQuantity)}</span>,
    },
    {
      id: 'total',
      header: 'On hand',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => <span className="tabular">{formatNumber(row.totalQuantity ?? row.availableQuantity + row.reservedQuantity)}</span>,
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      sortField: 'updatedAt',
      hideBelow: 'lg',
      cell: (row) => <span className="text-muted-foreground">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (row) => (
        <RowActions
          actions={[
            { label: 'Adjust stock', icon: <SlidersHorizontal />, hidden: !canUpdate, onSelect: () => setAdjusting(row) },
            {
              label: 'Transfer from here',
              icon: <ArrowLeftRight />,
              hidden: !canUpdate,
              disabled: row.availableQuantity === 0,
              onSelect: () => openTransfer({ productId: row.productId, sourceWarehouseId: row.warehouseId }),
            },
          ]}
        />
      ),
    },
  ]

  const hasFilters = !!(list.filters.warehouseId || list.filters.productId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels per warehouse. Available units can be reserved by new orders; reserved units are held by open orders."
        actions={
          <Can permission={Permission.INVENTORY_UPDATE}>
            <Button variant="outline" onClick={() => openTransfer()}>
              <ArrowLeftRight /> Transfer
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <PackagePlus /> Add stock
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[560px]">
          <EntityCombobox
            value={list.filters.warehouseId}
            onChange={(warehouseId) => list.setFilters({ warehouseId, productId: '' })}
            options={warehouseOptions}
            loading={warehouses.isLoading}
            placeholder="All warehouses"
            searchPlaceholder="Search warehouses…"
            clearable
          />
          <EntityCombobox
            value={list.filters.productId}
            onChange={(productId) => list.setFilters({ productId, warehouseId: '' })}
            options={productOptions}
            loading={products.isLoading}
            placeholder="All products"
            searchPlaceholder="Search name or SKU…"
            clearable
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.resetFilters}>
            Clear filters
          </Button>
        )}
        {lowOnPage > 0 && (
          <Badge variant="warning" className="lg:ml-auto">
            {lowOnPage} low-stock {lowOnPage === 1 ? 'row' : 'rows'} on this page (below {LOW_STOCK_THRESHOLD})
          </Badge>
        )}
      </div>

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(row) => row.id}
        onRowClick={canUpdate ? setAdjusting : undefined}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={
          hasFilters
            ? { title: 'No stock records match', description: 'This product or warehouse has no inventory records yet.' }
            : {
                icon: <Boxes />,
                title: 'No inventory yet',
                description: 'Add stock for a product in a warehouse to start taking orders.',
                action: canUpdate ? (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <PackagePlus /> Add stock
                  </Button>
                ) : undefined,
              }
        }
      />

      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaults={{ warehouseId: list.filters.warehouseId, productId: list.filters.productId }}
      />
      <TransferStockDialog open={transferOpen} onOpenChange={setTransferOpen} defaults={transferDefaults} />
      <AdjustStockDialog
        open={!!adjusting}
        onOpenChange={(open) => !open && setAdjusting(null)}
        inventory={adjusting}
        productName={adjusting ? products.byId.get(adjusting.productId)?.name : undefined}
        warehouseName={adjusting ? warehouses.byId.get(adjusting.warehouseId)?.name : undefined}
      />
    </div>
  )
}
