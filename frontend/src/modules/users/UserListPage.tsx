import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, ShieldAlert, UserPlus, UserRound, Users, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'
import { RowActions } from '@/components/data/RowActions'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { useAuth } from '@/store/AuthContext'
import { userService } from '@/services/userService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage, isForbidden } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { initials } from '@/lib/utils'
import type { Page } from '@/types/common'
import type { UserResponse } from '@/types/user'
import { UserFormSheet } from './UserFormSheet'

const DEFAULT_SORT: SortState = { field: 'name', direction: 'asc' }

export default function UserListPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const list = useListParams({ defaultSort: DEFAULT_SORT })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserResponse | null>(null)
  const [deactivating, setDeactivating] = useState<UserResponse | null>(null)
  /** Users created/edited this session — shown when the backend doesn't permit listing. */
  const [sessionUsers, setSessionUsers] = useState<UserResponse[]>([])

  const query = useQuery({
    queryKey: queryKeys.users.list(list.pageable),
    queryFn: () => userService.list(list.pageable),
    placeholderData: keepPreviousData,
  })
  const listForbidden = !!query.error && isForbidden(query.error)

  const rememberUser = (saved: UserResponse) =>
    setSessionUsers((previous) => [saved, ...previous.filter((u) => u.id !== saved.id)])

  const deactivateMutation = useMutation({
    mutationFn: (target: UserResponse) => userService.deactivate(target.id),
    onSuccess: (_, target) => {
      toast.success('User deactivated', { description: `${target.name} can no longer sign in.` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      rememberUser({ ...target, active: false })
      setDeactivating(null)
    },
    onError: (error) => toast.error('Could not deactivate user', { description: errorMessage(error) }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const columns: Column<UserResponse>[] = [
    {
      id: 'name',
      header: 'User',
      sortField: 'name',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              {user.name}
              {user.id === currentUser?.userId && <Badge variant="outline">You</Badge>}
            </div>
            <div className="text-muted-foreground text-xs">{user.email}</div>
          </div>
        </div>
      ),
    },
    { id: 'role', header: 'Role', cell: (user) => <StatusBadge status={user.roleName} /> },
    {
      id: 'active',
      header: 'Status',
      cell: (user) => (user.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Deactivated</Badge>),
    },
    {
      id: 'createdAt',
      header: 'Created',
      sortField: 'createdAt',
      hideBelow: 'md',
      cell: (user) => <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (user) => (
        <RowActions
          actions={[
            {
              label: 'Edit',
              icon: <Pencil />,
              onSelect: () => {
                setEditing(user)
                setFormOpen(true)
              },
            },
            {
              label: 'Deactivate',
              icon: <UserX />,
              destructive: true,
              hidden: !user.active || user.id === currentUser?.userId,
              onSelect: () => setDeactivating(user),
            },
          ]}
        />
      ),
    },
  ]

  const sessionPage: Page<UserResponse> = {
    content: sessionUsers,
    totalElements: sessionUsers.length,
    totalPages: 1,
    size: sessionUsers.length,
    number: 0,
    first: true,
    last: true,
    empty: sessionUsers.length === 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Team members who can sign in to your organization, and what their role allows."
        actions={
          <Button onClick={openCreate}>
            <UserPlus /> Invite user
          </Button>
        }
      />

      {listForbidden ? (
        <div className="space-y-4">
          <div className="border-warning/40 bg-warning/8 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
            <ShieldAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">The user directory isn't available for your role</p>
              <p className="text-muted-foreground">
                The API requires the <code className="font-mono text-xs">user.read</code> permission to list users. The
                built-in Admin role has it by default — if you're seeing this, your current role doesn't. You can still
                create and manage users — accounts you work with in this session are shown below.
              </p>
            </div>
          </div>
          <DataTable
            columns={columns}
            page={sessionPage}
            isLoading={false}
            rowKey={(user) => user.id}
            hidePagination
            empty={{
              icon: <UserRound />,
              title: 'No users created this session',
              action: (
                <Button size="sm" onClick={openCreate}>
                  <UserPlus /> Invite user
                </Button>
              ),
            }}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          page={query.data}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          rowKey={(user) => user.id}
          sort={list.sort}
          onSortChange={list.setSort}
          onPageChange={list.setPage}
          onSizeChange={list.setSize}
          empty={{ icon: <Users />, title: 'No users yet' }}
        />
      )}

      <UserFormSheet open={formOpen} onOpenChange={setFormOpen} user={editing} onSaved={rememberUser} />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate user?"
        description={
          <>
            <span className="text-foreground font-medium">{deactivating?.name}</span> will no longer be able to sign in.
            Their history is preserved.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        pending={deactivateMutation.isPending}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating)}
      />
    </div>
  )
}
