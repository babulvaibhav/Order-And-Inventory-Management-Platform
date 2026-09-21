import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { customerService } from '@/services/customerService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { emptyToNull } from '@/lib/forms'
import type { CustomerResponse } from '@/types/customer'

// Mirrors backend CustomerRequest constraints.
const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]).optional(),
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  address: z.string().max(500, 'Address must be at most 500 characters').optional(),
})
type CustomerFormValues = z.infer<typeof customerSchema>

const EMPTY: CustomerFormValues = { name: '', email: '', phone: '', address: '' }

interface CustomerFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: CustomerResponse | null
}

export function CustomerFormSheet({ open, onOpenChange, customer }: CustomerFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!customer
  const form = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema), defaultValues: EMPTY })

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      const request = {
        name: values.name.trim(),
        email: emptyToNull(values.email),
        phone: emptyToNull(values.phone),
        address: emptyToNull(values.address),
      }
      return isEdit ? customerService.update(customer!.id, request) : customerService.create(request)
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Customer updated' : 'Customer created', { description: saved.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.customers })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error
    ? /email/i.test(errorMessage(mutation.error))
      ? 'A customer with this email already exists.'
      : errorMessage(mutation.error)
    : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(
      customer
        ? { name: customer.name, email: customer.email ?? '', phone: customer.phone ?? '', address: customer.address ?? '' }
        : EMPTY,
    )
  }, [open, customer, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit customer' : 'New customer'}
      description="Customers are the buyers orders are placed for. They do not sign in."
      submitLabel={isEdit ? 'Save changes' : 'Create customer'}
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
                <Input placeholder="Customer or company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="buyer@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1 555 0100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Address <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Billing / shipping address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
