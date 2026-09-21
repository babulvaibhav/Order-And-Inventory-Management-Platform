import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { roleService } from '@/services/roleService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import type { RoleResponse } from '@/types/role'

// Mirrors backend RoleRequest constraints.
const roleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
})
type RoleFormValues = z.infer<typeof roleSchema>

interface RoleFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when renaming an existing custom role; absent when creating a new one. */
  role?: RoleResponse | null
}

export function RoleFormSheet({ open, onOpenChange, role }: RoleFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!role

  const form = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema), defaultValues: { name: '' } })

  const mutation = useMutation({
    mutationFn: (values: RoleFormValues) => (isEdit ? roleService.rename(role!.id, values) : roleService.create(values)),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Role renamed' : 'Role created', { description: saved.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.roles })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset({ name: role?.name ?? '' })
  }, [open, role, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Rename role' : 'New role'}
      description={
        isEdit
          ? 'Custom role name shown throughout the app.'
          : 'A new role starts with no permissions — grant it access from the role list after creating it.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      pending={mutation.isPending}
      error={serverError}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Auditor" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
