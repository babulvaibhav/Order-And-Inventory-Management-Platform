import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { organizationService } from '@/services/organizationService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { OrganizationStatus, type OrganizationResponse } from '@/types/organization'

const editOrgSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(255, 'Name must be at most 255 characters'),
  status: z.enum([OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED]),
})
type EditOrgValues = z.infer<typeof editOrgSchema>

interface EditOrganizationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: OrganizationResponse | null
}

export function EditOrganizationSheet({ open, onOpenChange, organization }: EditOrganizationSheetProps) {
  const queryClient = useQueryClient()
  const form = useForm<EditOrgValues>({
    resolver: zodResolver(editOrgSchema),
    defaultValues: { name: '', status: OrganizationStatus.ACTIVE },
  })

  const mutation = useMutation({
    mutationFn: (values: EditOrgValues) => organizationService.update(organization!.id, values),
    onSuccess: (saved) => {
      toast.success('Organization updated', { description: saved.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open || !organization) return
    resetMutation()
    form.reset({ name: organization.name, status: organization.status })
  }, [open, organization, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit organization"
      description="Suspending an organization blocks sign-in for every one of its users immediately — no restart needed."
      submitLabel="Save changes"
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={OrganizationStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={OrganizationStatus.SUSPENDED}>Suspended</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>A suspended organization's users can't sign in, and existing sessions are rejected on their next request.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
