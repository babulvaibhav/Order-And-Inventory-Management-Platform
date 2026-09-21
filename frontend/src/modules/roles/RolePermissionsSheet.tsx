import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { roleService } from '@/services/roleService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { humanize } from '@/lib/format'
import type { PermissionDef, RoleResponse } from '@/types/role'

interface RolePermissionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: RoleResponse | null
}

export function RolePermissionsSheet({ open, onOpenChange, role }: RolePermissionsSheetProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const catalog = useQuery({
    queryKey: queryKeys.permissions.all,
    queryFn: () => roleService.listPermissionCatalog(),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDef[]>()
    for (const permission of catalog.data ?? []) {
      const bucket = map.get(permission.category) ?? []
      bucket.push(permission)
      map.set(permission.category, bucket)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalog.data])

  useEffect(() => {
    if (open && role) setSelected(new Set(role.permissions.map((permission) => permission.id)))
  }, [open, role])

  const mutation = useMutation({
    mutationFn: () => roleService.updatePermissions(role!.id, { permissionIds: [...selected] }),
    onSuccess: (saved) => {
      toast.success('Permissions updated', { description: `${saved.name} now grants ${saved.permissions.length} permission(s).` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.roles })
      onOpenChange(false)
    },
    onError: (error) => toast.error('Could not update permissions', { description: errorMessage(error) }),
  })

  const toggle = (id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleCategory = (categoryPermissions: { id: string }[], checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      categoryPermissions.forEach((permission) => (checked ? next.add(permission.id) : next.delete(permission.id)))
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <SheetContent className="gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{role?.name} permissions</SheetTitle>
          <SheetDescription>
            Choose exactly what this role can do. Changes apply immediately to everyone assigned to it — they don't need
            to sign in again.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="py-5">
          {catalog.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([category, permissions]) => {
                const allChecked = permissions.every((permission) => selected.has(permission.id))
                const someChecked = permissions.some((permission) => selected.has(permission.id))
                return (
                  <div key={category} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">{humanize(category)}</Label>
                      <label className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleCategory(permissions, checked === true)}
                        />
                        Select all
                      </label>
                    </div>
                    <div className="grid gap-2">
                      {permissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="hover:bg-muted/50 flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
                        >
                          <Checkbox
                            checked={selected.has(permission.id)}
                            onCheckedChange={(checked) => toggle(permission.id, checked === true)}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="block font-medium">{permission.code}</span>
                            <span className="text-muted-foreground block text-xs">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <Separator />
                  </div>
                )
              })}
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || catalog.isLoading}>
            {mutation.isPending && <LoaderCircle className="animate-spin" />}
            Save permissions
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
