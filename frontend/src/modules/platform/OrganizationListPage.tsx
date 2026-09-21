import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Landmark, Pencil, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/feedback/PageHeader'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { StatusBadge } from '@/components/data/StatusBadge'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useAuth } from '@/store/AuthContext'
import { organizationService } from '@/services/organizationService'
import { queryKeys } from '@/lib/queryKeys'
import { formatDate } from '@/lib/format'
import { Permission } from '@/types/auth'
import type { OrganizationResponse } from '@/types/organization'
import { CreateOrganizationSheet } from './CreateOrganizationSheet'
import { EditOrganizationSheet } from './EditOrganizationSheet'
import { OrganizationUsersSheet } from './OrganizationUsersSheet'

const DEFAULT_SORT: SortState = { field: 'createdAt', direction: 'desc' }
const FILTER_KEYS = ['search'] as const

export default function OrganizationListPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(Permission.ORGANIZATION_MANAGE)
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<OrganizationResponse | null>(null)
  const [managingUsers, setManagingUsers] = useState<OrganizationResponse | null>(null)

  const params = { ...list.pageable, search: list.filters.search || undefined }
  const query = useQuery({
    queryKey: queryKeys.organizations.list(params),
    queryFn: () => organizationService.list(params),
    placeholderData: keepPreviousData,
  })

  const columns: Column<OrganizationResponse>[] = [
    {
      id: 'name',
      header: 'Organization',
      sortField: 'name',
      cell: (org) => (
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Landmark className="size-4" />
          </div>
          <span className="font-medium">{org.name}</span>
        </div>
      ),
    },
    { id: 'status', header: 'Status', sortField: 'status', cell: (org) => <StatusBadge status={org.status} /> },
    {
      id: 'createdAt',
      header: 'Created',
      sortField: 'createdAt',
      hideBelow: 'sm',
      cell: (org) => <span className="text-muted-foreground">{formatDate(org.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (org) => (
        <RowActions
          actions={[
            { label: 'Users', icon: <Users />, onSelect: () => setManagingUsers(org) },
            { label: 'Edit', icon: <Pencil />, hidden: !canManage, onSelect: () => setEditing(org) },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Every tenant on the platform. Create a new organization with its first admin, or suspend one to block sign-in immediately."
        actions={
          <Can permission={Permission.ORGANIZATION_MANAGE}>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New organization
            </Button>
          </Can>
        }
      />

      <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} placeholder="Search organizations…" />

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(org) => org.id}
        onRowClick={canManage ? setEditing : undefined}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={{
          icon: <Landmark />,
          title: list.filters.search ? 'No matching organizations' : 'No organizations yet',
          action:
            canManage && !list.filters.search ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus /> New organization
              </Button>
            ) : undefined,
        }}
      />

      <CreateOrganizationSheet open={createOpen} onOpenChange={setCreateOpen} />
      <EditOrganizationSheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} organization={editing} />
      <OrganizationUsersSheet
        open={!!managingUsers}
        onOpenChange={(open) => !open && setManagingUsers(null)}
        organization={managingUsers}
      />
    </div>
  )
}
