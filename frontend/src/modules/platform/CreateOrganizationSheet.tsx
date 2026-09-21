import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { organizationService } from '@/services/organizationService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'

// Mirrors backend CreateOrganizationRequest constraints.
const createOrgSchema = z.object({
  organizationName: z.string().trim().min(1, 'Organization name is required').max(255, 'Name must be at most 255 characters'),
  adminName: z.string().trim().min(1, 'Admin name is required').max(200, 'Name must be at most 200 characters'),
  adminEmail: z.email('Enter a valid email address'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
})
type CreateOrgValues = z.infer<typeof createOrgSchema>
const EMPTY: CreateOrgValues = { organizationName: '', adminName: '', adminEmail: '', adminPassword: '' }

interface CreateOrganizationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrganizationSheet({ open, onOpenChange }: CreateOrganizationSheetProps) {
  const queryClient = useQueryClient()
  const form = useForm<CreateOrgValues>({ resolver: zodResolver(createOrgSchema), defaultValues: EMPTY })

  const mutation = useMutation({
    mutationFn: organizationService.create,
    onSuccess: (saved) => {
      toast.success('Organization created', { description: `${saved.name} is ready to sign in.` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(EMPTY)
  }, [open, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New organization"
      description="Creates the organization with its default Admin/Manager/Staff roles, plus its first Admin user."
      submitLabel="Create organization"
      pending={mutation.isPending}
      error={serverError}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="organizationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <p className="text-muted-foreground -mb-1 text-xs font-medium tracking-wide uppercase">First admin account</p>
        <FormField
          control={form.control}
          name="adminName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adminEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Admin email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="jane@acme.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adminPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temporary password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
