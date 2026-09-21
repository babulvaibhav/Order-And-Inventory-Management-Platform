import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Contact, Mail, Pencil, Phone, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/feedback/PageHeader'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useAuth } from '@/store/AuthContext'
import { customerService } from '@/services/customerService'
import { queryKeys } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'
import { initials } from '@/lib/utils'
import { Permission } from '@/types/auth'
import type { CustomerResponse } from '@/types/customer'
import { CustomerFormSheet } from './CustomerFormSheet'

const DEFAULT_SORT: SortState = { field: 'name', direction: 'asc' }
const FILTER_KEYS = ['search'] as const

export default function CustomerListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(Permission.CUSTOMER_WRITE)
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerResponse | null>(null)

  const params = { ...list.pageable, search: list.filters.search || undefined }
  const query = useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => customerService.list(params),
    placeholderData: keepPreviousData,
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (customer: CustomerResponse) => {
    setEditing(customer)
    setFormOpen(true)
  }

  const columns: Column<CustomerResponse>[] = [
    {
      id: 'name',
      header: 'Customer',
      sortField: 'name',
      cell: (customer) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials(customer.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{customer.name}</span>
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      sortField: 'email',
      cell: (customer) =>
        customer.email ? (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="text-muted-foreground size-3.5" />
            {customer.email}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      cell: (customer) =>
        customer.phone ? (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="text-muted-foreground size-3.5" />
            {customer.phone}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'createdAt',
      header: 'Added',
      sortField: 'createdAt',
      hideBelow: 'lg',
      cell: (customer) => <span className="text-muted-foreground">{formatDate(customer.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (customer) => (
        <RowActions
          actions={[
            {
              label: 'View orders',
              icon: <ShoppingCart />,
              hidden: !hasPermission(Permission.ORDER_READ),
              onSelect: () => navigate(`/orders?search=${encodeURIComponent(customer.email || customer.name)}`),
            },
            { label: 'Edit', icon: <Pencil />, hidden: !canWrite, onSelect: () => openEdit(customer) },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Buyers your organization takes orders for."
        actions={
          <Can permission={Permission.CUSTOMER_WRITE}>
            <Button onClick={openCreate}>
              <Plus /> New customer
            </Button>
          </Can>
        }
      />

      <SearchInput
        value={list.filters.search}
        onChange={(search) => list.setFilters({ search })}
        placeholder="Search name or email…"
      />

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(customer) => customer.id}
        onRowClick={canWrite ? openEdit : undefined}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={
          list.filters.search
            ? { title: 'No matching customers', description: 'Try a different name or email.' }
            : {
                icon: <Contact />,
                title: 'No customers yet',
                description: 'Add a customer to start creating orders.',
                action: canWrite ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus /> New customer
                  </Button>
                ) : undefined,
              }
        }
      />

      <CustomerFormSheet open={formOpen} onOpenChange={setFormOpen} customer={editing} />
    </div>
  )
}
