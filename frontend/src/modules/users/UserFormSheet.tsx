import { useEffect, useState, type ComponentProps } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { userService } from '@/services/userService'
import { useRoleLookup } from '@/hooks/useLookups'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import type { UserResponse } from '@/types/user'

// Mirrors backend UserRequest constraints (password is required on update as well).
const userSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  email: z.email('Enter a valid email address'),
  roleId: z.string().min(1, 'Select a role'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type UserFormValues = z.infer<typeof userSchema>

const EMPTY: UserFormValues = { name: '', email: '', roleId: '', password: '' }

/** Password input with a visibility toggle; state resets whenever the sheet content unmounts. */
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

interface UserFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserResponse | null
  onSaved?: (user: UserResponse) => void
}

export function UserFormSheet({ open, onOpenChange, user, onSaved }: UserFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!user
  const roles = useRoleLookup()

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: EMPTY,
  })

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => (isEdit ? userService.update(user!.id, values) : userService.create(values)),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'User updated' : 'User created', { description: `${saved.name} · ${saved.roleName}` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      onSaved?.(saved)
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(user ? { name: user.name, email: user.email, roleId: user.roleId, password: '' } : EMPTY)
  }, [open, user, form, resetMutation])

  const roleId = useWatch({ control: form.control, name: 'roleId' })
  const selectedRole = roles.byId.get(roleId)

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit user' : 'Invite user'}
      description={isEdit ? 'Update the account. A password must be set when saving.' : 'Create a sign-in for a team member in your organization.'}
      submitLabel={isEdit ? 'Save changes' : 'Create user'}
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
                <Input placeholder="Jane Doe" {...field} />
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
                  {roles.items.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {selectedRole
                  ? `${selectedRole.permissions.length} permission${selectedRole.permissions.length === 1 ? '' : 's'} — manage what this role grants from Administration → Roles.`
                  : 'Roles and their permissions are managed under Administration → Roles.'}
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
              <FormLabel>{isEdit ? 'New password' : 'Temporary password'}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormDescription>Stored as a salted hash; share it with the user through a secure channel.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
