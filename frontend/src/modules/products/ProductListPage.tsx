import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, Package, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { StatusBadge } from '@/components/data/StatusBadge'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useAuth } from '@/store/AuthContext'
import { productService } from '@/services/productService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { formatCurrency, formatDate } from '@/lib/format'
import { Permission } from '@/types/auth'
import { ProductStatus, type ProductResponse } from '@/types/product'
import { ProductFormSheet } from './ProductFormSheet'

const DEFAULT_SORT: SortState = { field: 'createdAt', direction: 'desc' }
const FILTER_KEYS = ['search', 'status'] as const
const ALL = 'ALL'

export default function ProductListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(Permission.PRODUCT_WRITE)
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductResponse | null>(null)
  const [disabling, setDisabling] = useState<ProductResponse | null>(null)

  const params = {
    ...list.pageable,
    search: list.filters.search || undefined,
    status: (list.filters.status as ProductStatus) || undefined,
  }
  const query = useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productService.list(params),
    placeholderData: keepPreviousData,
  })

  const disableMutation = useMutation({
    mutationFn: (product: ProductResponse) => productService.disable(product.id),
    onSuccess: (_, product) => {
      toast.success('Product disabled', { description: product.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.products })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      setDisabling(null)
    },
    onError: (error) => toast.error('Could not disable product', { description: errorMessage(error) }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const columns: Column<ProductResponse>[] = [
    {
      id: 'name',
      header: 'Product',
      sortField: 'name',
      cell: (product) => (
        <div className="min-w-0">
          <div className="max-w-[280px] truncate font-medium">{product.name}</div>
          {product.description && (
            <div className="text-muted-foreground max-w-[280px] truncate text-xs">{product.description}</div>
          )}
        </div>
      ),
    },
    {
      id: 'sku',
      header: 'SKU',
      sortField: 'sku',
      cell: (product) => <span className="font-mono text-xs">{product.sku}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      sortField: 'price',
      align: 'right',
      cell: (product) => <span className="tabular font-medium">{formatCurrency(product.price)}</span>,
    },
    { id: 'status', header: 'Status', sortField: 'status', cell: (product) => <StatusBadge status={product.status} /> },
    {
      id: 'createdAt',
      header: 'Created',
      sortField: 'createdAt',
      hideBelow: 'md',
      cell: (product) => <span className="text-muted-foreground">{formatDate(product.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (product) => (
        <RowActions
          actions={[
            { label: 'View details', icon: <Eye />, onSelect: () => navigate(`/products/${product.id}`) },
            {
              label: 'Edit',
              icon: <Pencil />,
              hidden: !canWrite,
              onSelect: () => {
                setEditing(product)
                setFormOpen(true)
              },
            },
            {
              label: 'Disable',
              icon: <Ban />,
              destructive: true,
              hidden: !canWrite || product.status === ProductStatus.DISABLED,
              onSelect: () => setDisabling(product),
            },
          ]}
        />
      ),
    },
  ]

  const hasFilters = !!(list.filters.search || list.filters.status)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Your organization's catalogue. SKUs are unique within the organization."
        actions={
          <Can permission={Permission.PRODUCT_WRITE}>
            <Button onClick={openCreate}>
              <Plus /> New product
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={list.filters.search}
          onChange={(search) => list.setFilters({ search, status: '' })}
          placeholder="Search name or SKU…"
        />
        <Select
          value={list.filters.status || ALL}
          onValueChange={(status) => list.setFilters({ status: status === ALL ? '' : status, search: '' })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value={ProductStatus.ACTIVE}>Active</SelectItem>
            <SelectItem value={ProductStatus.DISABLED}>Disabled</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={list.resetFilters}>
            Clear filters
          </Button>
        )}
        <p className="text-muted-foreground text-xs sm:ml-auto">Search and status filters apply one at a time.</p>
      </div>

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(product) => product.id}
        onRowClick={(product) => navigate(`/products/${product.id}`)}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={
          hasFilters
            ? { title: 'No matching products', description: 'Try a different search term or clear the filters.' }
            : {
                icon: <Package />,
                title: 'No products yet',
                description: 'Create your first product to start tracking inventory and taking orders.',
                action: canWrite ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus /> New product
                  </Button>
                ) : undefined,
              }
        }
      />

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <ConfirmDialog
        open={!!disabling}
        onOpenChange={(open) => !open && setDisabling(null)}
        title="Disable product?"
        description={
          <>
            <span className="text-foreground font-medium">{disabling?.name}</span> will be marked as disabled. Existing
            orders and stock records are kept.
          </>
        }
        confirmLabel="Disable product"
        destructive
        pending={disableMutation.isPending}
        onConfirm={() => disabling && disableMutation.mutate(disabling)}
      />
    </div>
  )
}
