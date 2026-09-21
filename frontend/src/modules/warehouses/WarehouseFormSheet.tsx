import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { warehouseService } from '@/services/warehouseService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { emptyToNull } from '@/lib/forms'
import { WarehouseStatus, type WarehouseResponse } from '@/types/warehouse'

// Mirrors backend WarehouseRequest constraints.
const warehouseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  address: z.string().max(500, 'Address must be at most 500 characters').optional(),
  status: z.enum([WarehouseStatus.ACTIVE, WarehouseStatus.DISABLED]),
})
type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse?: WarehouseResponse | null
}

export function WarehouseFormSheet({ open, onOpenChange, warehouse }: WarehouseFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!warehouse
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: '', address: '', status: WarehouseStatus.ACTIVE },
  })

  const mutation = useMutation({
    mutationFn: (values: WarehouseFormValues) => {
      const request = { ...values, address: emptyToNull(values.address) }
      return isEdit ? warehouseService.update(warehouse!.id, request) : warehouseService.create(request)
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Warehouse updated' : 'Warehouse created', { description: saved.name })
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.warehouses })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error ? errorMessage(mutation.error) : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(
      warehouse
        ? { name: warehouse.name, address: warehouse.address ?? '', status: warehouse.status }
        : { name: '', address: '', status: WarehouseStatus.ACTIVE },
    )
  }, [open, warehouse, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit warehouse' : 'New warehouse'}
      description={isEdit ? 'Update location details.' : 'Register a stocking location for your organization.'}
      submitLabel={isEdit ? 'Save changes' : 'Create warehouse'}
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
                <Input placeholder="e.g. Berlin Fulfilment Centre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Address <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Street, city, postcode, country" {...field} />
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
                  <SelectItem value={WarehouseStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={WarehouseStatus.DISABLED}>Disabled</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
