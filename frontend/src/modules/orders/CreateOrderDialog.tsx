import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { EntityCombobox } from '@/components/data/EntityCombobox'
import { orderService } from '@/services/orderService'
import { inventoryService } from '@/services/inventoryService'
import { useCustomerLookup, useProductLookup, useWarehouseLookup } from '@/hooks/useLookups'
import { queryKeys } from '@/lib/queryKeys'
import { normalizeApiError } from '@/lib/errors'
import { formatCurrency, formatNumber } from '@/lib/format'
import { numberInputProps, requiredNumber } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { ProductStatus } from '@/types/product'
import { WarehouseStatus } from '@/types/warehouse'

const lineSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  warehouseId: z.string().min(1, 'Select a warehouse'),
  quantity: z.number(requiredNumber('Quantity')).int('Use whole units').positive('At least 1'),
})

const orderSchema = z
  .object({
    customerId: z.string().min(1, 'Select a customer'),
    items: z.array(lineSchema).min(1, 'Add at least one line item'),
    notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
  })
  .superRefine((values, ctx) => {
    const seen = new Map<string, number>()
    values.items.forEach((item, index) => {
      if (!item.productId || !item.warehouseId) return
      const key = `${item.productId}:${item.warehouseId}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'productId'],
          message: 'Duplicate line — combine quantities into one line',
        })
      }
      seen.set(key, index)
    })
  })
type OrderFormValues = z.infer<typeof orderSchema>

const EMPTY_LINE = { productId: '', warehouseId: '', quantity: 1 }

interface CreateOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const customers = useCustomerLookup()
  const products = useProductLookup()
  const warehouses = useWarehouseLookup()
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { customerId: '', items: [EMPTY_LINE], notes: '' },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  const watchedItems = useWatch({ control: form.control, name: 'items' })
  const items = useMemo(() => watchedItems ?? [], [watchedItems])

  // Live availability for every product on the order (one request per distinct product).
  const productKey = Array.from(new Set(items.map((item) => item?.productId).filter(Boolean))).sort().join(',')
  const productIds = useMemo(() => (productKey ? productKey.split(',') : []), [productKey])
  const stockQueries = useQueries({
    queries: productIds.map((productId) => {
      const params = { productId, size: 200 }
      return {
        queryKey: queryKeys.inventory.list(params),
        queryFn: () => inventoryService.list(params),
        enabled: open,
        staleTime: 5_000,
      }
    }),
  })
  const availability = useMemo(() => {
    const map = new Map<string, number>()
    stockQueries.forEach((query) =>
      query.data?.content.forEach((row) => map.set(`${row.productId}:${row.warehouseId}`, row.availableQuantity)),
    )
    return map
  }, [stockQueries])
  const stockLoading = stockQueries.some((query) => query.isFetching)

  const customerOptions = useMemo(
    () => customers.items.map((c) => ({ value: c.id, label: c.name, description: c.email ?? undefined, keywords: [c.email ?? ''] })),
    [customers.items],
  )
  const productOptions = useMemo(
    () =>
      products.items
        .filter((p) => p.status === ProductStatus.ACTIVE)
        .map((p) => ({ value: p.id, label: p.name, description: `${p.sku} · ${formatCurrency(p.price)}`, keywords: [p.sku] })),
    [products.items],
  )

  const warehouseOptionsFor = (productId: string) =>
    warehouses.items
      .filter((w) => w.status === WarehouseStatus.ACTIVE)
      .map((w) => {
        const available = productId ? availability.get(`${productId}:${w.id}`) : undefined
        return {
          value: w.id,
          label: w.name,
          description: productId ? (available === undefined ? 'Not stocked' : `${formatNumber(available)} available`) : undefined,
          disabled: !!productId && !available,
        }
      })

  const lineInfo = items.map((item) => {
    const product = item?.productId ? products.byId.get(item.productId) : undefined
    const unitPrice = product ? Number(product.price) : 0
    const quantity = Number.isFinite(item?.quantity) ? (item?.quantity ?? 0) : 0
    const available =
      item?.productId && item?.warehouseId ? availability.get(`${item.productId}:${item.warehouseId}`) : undefined
    return {
      unitPrice,
      lineTotal: unitPrice * quantity,
      available,
      short: available !== undefined && quantity > available,
    }
  })
  const orderTotal = lineInfo.reduce((sum, line) => sum + line.lineTotal, 0)
  const hasShortage = lineInfo.some((line) => line.short)

  const mutation = useMutation({
    mutationFn: (values: OrderFormValues) =>
      orderService.create({
        customerId: values.customerId,
        notes: values.notes?.trim() || undefined,
        items: values.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          // No unitPrice sent — the backend always derives it server-side from Product.price and
          // has no field for the client to supply one. The catalogue price shown in this dialog
          // (lineInfo below) is for display/estimate only.
        })),
      }),
    onSuccess: (order) => {
      toast.success('Order created', { description: `${formatCurrency(order.totalAmount)} · stock reserved` })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      onOpenChange(false)
      navigate(`/orders/${order.id}`)
    },
    onError: (error, values) => {
      const normalized = normalizeApiError(error)
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      if (normalized.code === 'INSUFFICIENT_INVENTORY') {
        const productId = normalized.message.match(/[0-9a-f-]{36}/i)?.[0]
        const index = values.items.findIndex((item) => item.productId === productId)
        if (index >= 0) {
          form.setError(`items.${index}.quantity`, { message: 'Not enough stock — availability changed. Reduce the quantity.' })
        }
      }
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = mutation.error
    ? normalizeApiError(mutation.error).code === 'INSUFFICIENT_INVENTORY'
      ? 'Some items no longer have enough stock. Nothing was reserved; adjust the highlighted lines and retry.'
      : normalizeApiError(mutation.error).message
    : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset({ customerId: '', items: [EMPTY_LINE], notes: '' })
  }, [open, form, resetMutation])

  const pending = mutation.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>
            Stock for every line is reserved atomically when the order is placed — if any line can't be fulfilled, nothing is
            reserved.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            {serverError && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {serverError}
              </div>
            )}

            <FormField
              control={form.control}
              name="customerId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      value={field.value}
                      onChange={field.onChange}
                      options={customerOptions}
                      loading={customers.isLoading}
                      placeholder="Select customer"
                      searchPlaceholder="Search name or email…"
                      emptyText="No customers found. Create one on the Customers page."
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Line items</p>
                {stockLoading && (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <LoaderCircle className="size-3 animate-spin" /> Checking stock
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const line = lineInfo[index]
                  const productId = items[index]?.productId ?? ''
                  return (
                    <div key={field.id} className={cn('rounded-lg border p-3', line?.short && 'border-warning/60 bg-warning/5')}>
                      <div className="grid gap-3 md:grid-cols-[1.4fr_1.2fr_90px_auto] md:items-start">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field: itemField, fieldState }) => (
                            <FormItem>
                              <FormLabel className="text-xs md:sr-only">Product</FormLabel>
                              <FormControl>
                                <EntityCombobox
                                  value={itemField.value}
                                  onChange={(value) => {
                                    itemField.onChange(value)
                                    form.setValue(`items.${index}.warehouseId`, '')
                                  }}
                                  options={productOptions}
                                  loading={products.isLoading}
                                  placeholder="Product"
                                  searchPlaceholder="Search name or SKU…"
                                  aria-invalid={!!fieldState.error}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.warehouseId`}
                          render={({ field: itemField, fieldState }) => (
                            <FormItem>
                              <FormLabel className="text-xs md:sr-only">Ship from</FormLabel>
                              <FormControl>
                                <EntityCombobox
                                  value={itemField.value}
                                  onChange={itemField.onChange}
                                  options={warehouseOptionsFor(productId)}
                                  loading={warehouses.isLoading}
                                  disabled={!productId}
                                  placeholder={productId ? 'Ship from warehouse' : 'Pick a product first'}
                                  emptyText="No warehouses"
                                  aria-invalid={!!fieldState.error}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs md:sr-only">Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} step={1} aria-label="Quantity" {...numberInputProps(itemField)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="justify-self-end"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          aria-label="Remove line"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>
                          {line?.available !== undefined && (
                            <span className={cn(line.short && 'text-warning font-medium')}>
                              {line.short
                                ? `Only ${formatNumber(line.available)} available in this warehouse`
                                : `${formatNumber(line.available)} available`}
                            </span>
                          )}
                        </span>
                        <span className="tabular">
                          {line?.unitPrice ? `${formatCurrency(line.unitPrice)} × ${items[index]?.quantity || 0} = ` : ''}
                          <span className="text-foreground font-medium">{formatCurrency(line?.lineTotal ?? 0)}</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {form.formState.errors.items?.root?.message && (
                <p className="text-destructive text-xs">{form.formState.errors.items.root.message}</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_LINE)}>
                <Plus /> Add line
              </Button>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Delivery instructions, PO number…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Order total</p>
                <p className="tabular text-2xl font-semibold">{formatCurrency(orderTotal)}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || hasShortage}>
                  {pending && <LoaderCircle className="animate-spin" />}
                  Place order
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
