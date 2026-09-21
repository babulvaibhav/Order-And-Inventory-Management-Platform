import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FormSheet } from '@/components/data/FormSheet'
import { productService } from '@/services/productService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { emptyToNull, numberInputProps, requiredNumber } from '@/lib/forms'
import { ProductStatus, type ProductResponse } from '@/types/product'

// Mirrors backend ProductRequest bean-validation constraints.
const productSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(50, 'SKU must be at most 50 characters'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  price: z
    .number(requiredNumber('Price'))
    .min(0.01, 'Price must be at least 0.01')
    .max(99_999_999.99, 'Price is too large')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: 'Use at most 2 decimal places',
    }),
  status: z.enum([ProductStatus.ACTIVE, ProductStatus.DISABLED]),
})
type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductResponse | null
}

export function ProductFormSheet({ open, onOpenChange, product }: ProductFormSheetProps) {
  const queryClient = useQueryClient()
  const isEdit = !!product
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { sku: '', name: '', description: '', price: undefined, status: ProductStatus.ACTIVE },
  })

  const mutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const request = { ...values, description: emptyToNull(values.description) }
      return isEdit ? productService.update(product!.id, request) : productService.create(request)
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Product updated' : 'Product created', { description: `${saved.name} · ${saved.sku}` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.lookups.products })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation

  // Backend currently reports duplicate SKUs as a generic error; make the likely cause explicit.
  const serverError = mutation.error
    ? /sku/i.test(errorMessage(mutation.error))
      ? `SKU "${mutation.variables?.sku}" is already used in your organization.`
      : errorMessage(mutation.error)
    : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description ?? '',
            price: Number(product.price),
            status: product.status,
          }
        : { sku: '', name: '', description: '', price: undefined, status: ProductStatus.ACTIVE },
    )
  }, [open, product, form, resetMutation])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit product' : 'New product'}
      description={isEdit ? 'Update catalogue details. SKU must stay unique in your organization.' : 'Add a product to your catalogue.'}
      submitLabel={isEdit ? 'Save changes' : 'Create product'}
      pending={mutation.isPending}
      error={serverError}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <Form {...form}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. LAP-15-PRO" className="font-mono"{...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit price (USD)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...numberInputProps(field)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Product name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Short description shown to your team" {...field} />
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
                  <SelectItem value={ProductStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={ProductStatus.DISABLED}>Disabled</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Disabled products stay in history but can't be ordered.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </FormSheet>
  )
}
