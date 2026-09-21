import { useEffect, useState, type ComponentProps } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { organizationService } from '@/services/organizationService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import type { UserResponse } from '@/types/user'

// Mirrors backend UserRequest: password is required on create, optional on update (blank/omitted
// leaves the existing password hash untouched — see UserService.updateUserInOrganization). The
// inferred TS type keeps `password: string` either way (never optional) so react-hook-form's
// generic stays the same regardless of which validator is active; only the zod validation differs.
const userSchema = (isEdit: boolean) =>
  z.object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
    email: z.email('Enter a valid email address'),
    roleId: z.string().min(1, 'Select a role'),
    password: isEdit
      ? z.string().refine((value) => value === '' || value.length >= 8, 'Password must be at least 8 characters')
      : z.string().min(8, 'Password must be at least 8 characters'),
  })
type UserFormValues = z.infer<ReturnType<typeof userSchema>>

const EMPTY: UserFormValues = { name: '', email: '', roleId: '', password: '' }

/** Password input with a visibility toggle. */
function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

interface OrganizationUserFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
  /** null (or omitted) = create a new user; otherwise editing this one. */
  user?: UserResponse | null
}

/**
 * The Platform Owner's way to add (or fix access for) a user in an organization it doesn't
 * itself belong to. An organization only gets its first Admin at creation time
 * (CreateOrganizationSheet) — before this existed, there was no way to add a second user, and no
 * recovery path at all if that first admin's credentials were lost before ever signing in.
 */
export function OrganizationUserFormSheet({ open, onOpenChange, organizationId, organizationName, user }: OrganizationUserFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!user

  const roles = useQuery({
    queryKey: queryKeys.organizations.roles(organizationId),
    queryFn: () => organizationService.listRoles(organizationId),
    enabled: open,
    staleTime: 60_000,
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema(isEdit)),
    defaultValues: EMPTY,
  })

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      isEdit
        ? organizationService.updateUser(organizationId, user!.id, values)
        : organizationService.createUser(organizationId, values),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'User updated' : 'User added', { description: `${saved.name} · ${saved.roleName}` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.users(organizationId) })
      onOpenChange(false)
    },
    onError: (error) => toast.error(isEdit ? 'Could not update user' : 'Could not add user', { description: errorMessage(error) }),
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(user ? { name: user.name, email: user.email, roleId: user.roleId, password: '' } : EMPTY)
  }, [open, user, form, resetMutation])

  const roleId = useWatch({ control: form.control, name: 'roleId' })
  const selectedRole = roles.data?.find((role) => role.id === roleId)

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit user — ${organizationName}` : `Add user — ${organizationName}`}
      description={
        isEdit
          ? 'Update this account, or reset its password. Leave the password blank to keep the current one.'
          : "Create a sign-in for this organization directly — they don't need to have used the first admin account yet."
      }
      submitLabel={isEdit ? 'Save changes' : 'Add user'}
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
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="off" placeholder="jane@company.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="roleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={roles.isLoading}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={roles.isLoading ? 'Loading roles…' : 'Select a role'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(roles.data ?? []).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {selectedRole
                  ? `${selectedRole.permissions.length} permission${selectedRole.permissions.length === 1 ? '' : 's'} on this role.`
                  : `${organizationName}'s roles — Admin, Manager, Staff, or a custom role it created.`}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isEdit ? 'New password (optional)' : 'Temporary password'}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormDescription>
                {isEdit
                  ? 'Leave blank to keep the current password.'
                  : 'Stored as a salted hash; share it with the organization through a secure channel.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
