import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ErrorState } from '@/components/feedback/States'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'
import { productService } from '@/services/productService'
import { inventoryService } from '@/services/inventoryService'
import { useWarehouseLookup } from '@/hooks/useLookups'
import { useAuth } from '@/store/AuthContext'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format'
import { Permission } from '@/types/auth'
import { LOW_STOCK_THRESHOLD, type InventoryResponse } from '@/types/inventory'
import { ProductFormSheet } from './ProductFormSheet'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id = '' } = useParams()
  const { hasPermission } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const warehouses = useWarehouseLookup()

  const productQuery = useQuery({ queryKey: queryKeys.products.detail(id), queryFn: () => productService.get(id) })
  const stockParams = { productId: id, size: 100 }
  const stockQuery = useQuery({
    queryKey: queryKeys.inventory.list(stockParams),
    queryFn: () => inventoryService.list(stockParams),
    enabled: hasPermission(Permission.INVENTORY_READ),
  })

  if (productQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (productQuery.error || !productQuery.data) {
    return (
      <div className="bg-card rounded-xl border">
        <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} />
      </div>
    )
  }

  const product = productQuery.data
  const rows = stockQuery.data?.content ?? []
  const totals = rows.reduce(
    (acc, row) => ({ available: acc.available + row.availableQuantity, reserved: acc.reserved + row.reservedQuantity }),
    { available: 0, reserved: 0 },
  )

  const columns: Column<InventoryResponse>[] = [
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (row) => <span className="font-medium">{warehouses.byId.get(row.warehouseId)?.name ?? 'Unknown warehouse'}</span>,
    },
    {
      id: 'available',
      header: 'Available',
      align: 'right',
      cell: (row) => (
        <span className="tabular inline-flex items-center gap-2">
          {row.availableQuantity < LOW_STOCK_THRESHOLD && <Badge variant="warning">Low</Badge>}
          {formatNumber(row.availableQuantity)}
        </span>
      ),
    },
    { id: 'reserved', header: 'Reserved', align: 'right', cell: (row) => <span className="tabular">{formatNumber(row.reservedQuantity)}</span> },
    {
      id: 'updated',
      header: 'Updated',
      hideBelow: 'sm',
      cell: (row) => <span className="text-muted-foreground">{formatDateTime(row.updatedAt)}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/products">
          <ArrowLeft /> All products
        </Link>
      </Button>

      <PageHeader
        eyebrow={<span className="font-mono">{product.sku}</span>}
        title={product.name}
        description={product.description || undefined}
        actions={
          <Can permission={Permission.PRODUCT_WRITE}>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          </Can>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardDescription>Unit price</CardDescription>
            <CardTitle className="tabular text-2xl">{formatCurrency(product.price)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardDescription>Available across warehouses</CardDescription>
            <CardTitle className="tabular text-2xl">{stockQuery.isLoading ? '—' : formatNumber(totals.available)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardDescription>Reserved by open orders</CardDescription>
            <CardTitle className="tabular text-2xl">{stockQuery.isLoading ? '—' : formatNumber(totals.reserved)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5">
              <Detail label="Status">
                <StatusBadge status={product.status} />
              </Detail>
              <Detail label="SKU">
                <span className="font-mono">{product.sku}</span>
              </Detail>
              <Detail label="Created">{formatDateTime(product.createdAt)}</Detail>
              <Detail label="Last updated">{formatDateTime(product.updatedAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Stock by warehouse</h2>
            <Button variant="link" size="sm" asChild>
              <Link to={`/inventory?productId=${product.id}`}>Manage inventory</Link>
            </Button>
          </div>
          <DataTable
            columns={columns}
            page={stockQuery.data}
            isLoading={stockQuery.isLoading}
            isFetching={stockQuery.isFetching}
            error={stockQuery.error}
            onRetry={() => void stockQuery.refetch()}
            rowKey={(row) => row.id}
            hidePagination
            empty={{ title: 'Not stocked yet', description: 'This product has no inventory records in any warehouse.' }}
          />
        </div>
      </div>

      <ProductFormSheet open={editOpen} onOpenChange={setEditOpen} product={product} />
    </div>
  )
}
