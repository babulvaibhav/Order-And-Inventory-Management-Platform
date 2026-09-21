import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/feedback/PageHeader'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Can } from '@/components/feedback/Can'
import { DataTable, type Column } from '@/components/data/DataTable'
import { RowActions } from '@/components/data/RowActions'
import { useAuth } from '@/store/AuthContext'
import { roleService } from '@/services/roleService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { Permission } from '@/types/auth'
import type { Page } from '@/types/common'
import type { RoleResponse } from '@/types/role'
import { RoleFormSheet } from './RoleFormSheet'
import { RolePermissionsSheet } from './RolePermissionsSheet'

export default function RoleListPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission(Permission.ROLE_MANAGE)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RoleResponse | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<RoleResponse | null>(null)
  const [deleting, setDeleting] = useState<RoleResponse | null>(null)

  const query = useQuery({ queryKey: queryKeys.roles.all, queryFn: () => roleService.list() })

  const deleteMutation = useMutation({
    mutationFn: (role: RoleResponse) => roleService.remove(role.id),
    onSuccess: (_, role) => {
      toast.success('Role deleted', { description: role.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.roles })
      setDeleting(null)
    },
    onError: (error) => toast.error('Could not delete role', { description: errorMessage(error) }),
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const columns: Column<RoleResponse>[] = [
    {
      id: 'name',
      header: 'Role',
      cell: (role) => (
        <div className="flex items-center gap-2 font-medium">
          {role.name}
          {role.isSystem && <Badge variant="outline">Default</Badge>}
        </div>
      ),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: (role) =>
        role.permissions.length === 0 ? (
          <span className="text-muted-foreground">No permissions granted</span>
        ) : (
          <div className="flex max-w-md flex-wrap gap-1">
            {role.permissions.slice(0, 4).map((permission) => (
              <Badge key={permission.id} variant="muted" className="font-mono text-[11px]">
                {permission.code}
              </Badge>
            ))}
            {role.permissions.length > 4 && <Badge variant="muted">+{role.permissions.length - 4} more</Badge>}
          </div>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (role) => (
        <RowActions
          actions={[
            {
              label: 'Edit permissions',
              icon: <SlidersHorizontal />,
              hidden: !canManage,
              onSelect: () => setEditingPermissions(role),
            },
            {
              label: 'Rename',
              icon: <Pencil />,
              hidden: !canManage || role.isSystem,
              onSelect: () => {
                setEditing(role)
                setFormOpen(true)
              },
            },
            {
              label: 'Delete',
              icon: <Trash2 />,
              destructive: true,
              hidden: !canManage || role.isSystem,
              onSelect: () => setDeleting(role),
            },
          ]}
        />
      ),
    },
  ]

  const page: Page<RoleResponse> = {
    content: query.data ?? [],
    totalElements: query.data?.length ?? 0,
    totalPages: 1,
    size: query.data?.length ?? 0,
    number: 0,
    first: true,
    last: true,
    empty: (query.data?.length ?? 0) === 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Every organization starts with Admin, Manager and Staff. Edit what each grants, or add custom roles."
        actions={
          <Can permission={Permission.ROLE_MANAGE}>
            <Button onClick={openCreate}>
              <Plus /> New role
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        page={page}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(role) => role.id}
        onRowClick={canManage ? (role) => setEditingPermissions(role) : undefined}
        hidePagination
        empty={{
          icon: <ShieldCheck />,
          title: 'No roles yet',
          action: canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus /> New role
            </Button>
          ) : undefined,
        }}
      />

      <RoleFormSheet open={formOpen} onOpenChange={setFormOpen} role={editing} />
      <RolePermissionsSheet
        open={!!editingPermissions}
        onOpenChange={(open) => !open && setEditingPermissions(null)}
        role={editingPermissions}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this role?"
        description={
          <>
            <span className="text-foreground font-medium">{deleting?.name}</span> will be removed. Reassign any users on
            this role first — deletion is blocked while it's still in use.
          </>
        }
        confirmLabel="Delete role"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  )
}
