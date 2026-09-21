import { useEffect, useMemo, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, LoaderCircle, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { EntityCombobox } from '@/components/data/EntityCombobox'
import { inventoryService } from '@/services/inventoryService'
import { useProductLookup, useWarehouseLookup } from '@/hooks/useLookups'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage, normalizeApiError } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { numberInputProps, requiredNumber } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { ProductStatus } from '@/types/product'
import { WarehouseStatus } from '@/types/warehouse'
import type { InventoryResponse } from '@/types/inventory'

function useInvalidateInventory() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }
}

function useProductOptions() {
  const products = useProductLookup()
  const options = useMemo(
    () =>
      products.items.map((product) => ({
        value: product.id,
        label: product.name,
        description: product.sku,
        keywords: [product.sku],
        disabled: product.status === ProductStatus.DISABLED,
      })),
    [products.items],
  )
  return { options, loading: products.isLoading }
}

function useWarehouseOptions() {
  const warehouses = useWarehouseLookup()
  const options = useMemo(
    () =>
      warehouses.items.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
        description: warehouse.status === WarehouseStatus.DISABLED ? 'Disabled' : warehouse.address ?? undefined,
        disabled: warehouse.status === WarehouseStatus.DISABLED,
      })),
    [warehouses.items],
  )
  return { options, loading: warehouses.isLoading }
}

/** Maps a failed mutation to a user-facing message, with a specific message for INSUFFICIENT_INVENTORY. */
function insufficientAware(error: unknown, insufficientMessage: string): string | null {
  if (!error) return null
  const normalized = normalizeApiError(error)
  return normalized.code === 'INSUFFICIENT_INVENTORY' ? insufficientMessage : normalized.message
}

function ServerError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2.5 text-sm">
      {message}
    </div>
  )
}

function DialogActions({ pending, submitLabel, onCancel }: { pending: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <DialogFooter className="pt-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {submitLabel}
      </Button>
    </DialogFooter>
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* -------------------------------------------------------------------------- */
/*  Add stock record                                                          */
/* -------------------------------------------------------------------------- */

const addStockSchema = z.object({
  warehouseId: z.string().min(1, 'Select a warehouse'),
  productId: z.string().min(1, 'Select a product'),
  quantity: z.number(requiredNumber('Quantity')).int('Use whole units').positive('Quantity must be at least 1'),
})
type AddStockValues = z.infer<typeof addStockSchema>

export function AddStockDialog({ open, onOpenChange, defaults }: DialogProps & { defaults?: Partial<AddStockValues> }) {
  const invalidate = useInvalidateInventory()
  const products = useProductOptions()
  const warehouses = useWarehouseOptions()
  const form = useForm<AddStockValues>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { warehouseId: '', productId: '', quantity: undefined },
  })

  const mutation = useMutation({
    mutationFn: inventoryService.create,
    onSuccess: () => {
      toast.success('Stock record created')
      invalidate()
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  // A duplicate (warehouse, product) pair currently surfaces as a 5xx from the backend.
  const serverError = mutation.error
    ? (normalizeApiError(mutation.error).status ?? 0) >= 500
      ? 'This product may already have a stock record in the selected warehouse. Use "Adjust" on that row instead.'
      : errorMessage(mutation.error)
    : null

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset({ warehouseId: defaults?.warehouseId ?? '', productId: defaults?.productId ?? '', quantity: undefined })
  }, [open, defaults?.warehouseId, defaults?.productId, form, resetMutation])

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add stock record</DialogTitle>
          <DialogDescription>Start tracking a product in a warehouse with an opening quantity.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            <ServerError message={serverError} />
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Warehouse</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      value={field.value}
                      onChange={field.onChange}
                      options={warehouses.options}
                      loading={warehouses.loading}
                      placeholder="Select warehouse"
                      searchPlaceholder="Search warehouses…"
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="productId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      value={field.value}
                      onChange={field.onChange}
                      options={products.options}
                      loading={products.loading}
                      placeholder="Select product"
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
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step={1} placeholder="0" {...numberInputProps(field)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogActions pending={mutation.isPending} submitLabel="Add stock" onCancel={() => onOpenChange(false)} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Adjust stock                                                              */
/* -------------------------------------------------------------------------- */

const adjustSchema = z.object({
  direction: z.enum(['add', 'remove']),
  quantity: z
    .number(requiredNumber('Quantity'))
    .int('Use whole units')
    .positive('Quantity must be at least 1')
    .max(10_000, 'A single adjustment is limited to 10,000 units'),
  reason: z.string().max(500, 'Reason must be at most 500 characters').optional(),
})
type AdjustValues = z.infer<typeof adjustSchema>

interface AdjustDialogProps extends DialogProps {
  inventory: InventoryResponse | null
  productName?: string
  warehouseName?: string
}

export function AdjustStockDialog({ open, onOpenChange, inventory, productName, warehouseName }: AdjustDialogProps) {
  const invalidate = useInvalidateInventory()
  const available = inventory?.availableQuantity ?? 0

  const schema = useMemo(
    () =>
      adjustSchema.refine((values) => values.direction === 'add' || values.quantity <= available, {
        path: ['quantity'],
        message: `Only ${formatNumber(available)} units are available to remove`,
      }),
    [available],
  )
  const form = useForm<AdjustValues>({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'add', quantity: undefined, reason: '' },
  })

  const [direction, quantity] = useWatch({ control: form.control, name: ['direction', 'quantity'] })
  const delta = (direction === 'remove' ? -1 : 1) * (Number.isFinite(quantity) ? (quantity ?? 0) : 0)
  const projected = available + delta

  const mutation = useMutation({
    mutationFn: (values: AdjustValues) =>
      inventoryService.adjust({
        inventoryId: inventory!.id,
        quantity: values.direction === 'remove' ? -values.quantity : values.quantity,
        reason: values.reason?.trim() || undefined,
      }),
    onSuccess: (updated) => {
      toast.success('Stock adjusted', {
        description: `${productName ?? 'Product'} now has ${formatNumber(updated.availableQuantity)} available`,
      })
      invalidate()
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = insufficientAware(
    mutation.error,
    'Stock changed since this screen loaded and there is no longer enough available. Refresh and try again.',
  )

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset({ direction: 'add', quantity: undefined, reason: '' })
  }, [open, form, resetMutation])

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {productName ?? 'Product'} · {warehouseName ?? 'Warehouse'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            <ServerError message={serverError} />
            <FormField
              control={form.control}
              name="direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adjustment</FormLabel>
                  <Tabs value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="add">
                        <Plus /> Add units
                      </TabsTrigger>
                      <TabsTrigger value="remove">
                        <Minus /> Remove units
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step={1} placeholder="0" autoFocus {...numberInputProps(field)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="bg-muted/60 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border px-4 py-3 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Available now</p>
                <p className="tabular text-lg font-semibold">{formatNumber(available)}</p>
              </div>
              <ArrowRight className="text-muted-foreground size-4" />
              <div>
                <p className="text-muted-foreground text-xs">After adjustment</p>
                <p className={cn('tabular text-lg font-semibold', projected < 0 && 'text-destructive')}>{formatNumber(projected)}</p>
              </div>
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Reason <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="e.g. Cycle count correction, damaged goods" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogActions pending={mutation.isPending} submitLabel="Apply adjustment" onCancel={() => onOpenChange(false)} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Transfer stock                                                            */
/* -------------------------------------------------------------------------- */

const transferSchema = z
  .object({
    productId: z.string().min(1, 'Select a product'),
    sourceWarehouseId: z.string().min(1, 'Select the source warehouse'),
    destinationWarehouseId: z.string().min(1, 'Select the destination warehouse'),
    quantity: z.number(requiredNumber('Quantity')).int('Use whole units').positive('Quantity must be at least 1'),
  })
  .refine((values) => values.sourceWarehouseId !== values.destinationWarehouseId, {
    path: ['destinationWarehouseId'],
    message: 'Destination must differ from source',
  })
type TransferValues = z.infer<typeof transferSchema>

function Availability({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>
}

export function TransferStockDialog({ open, onOpenChange, defaults }: DialogProps & { defaults?: Partial<TransferValues> }) {
  const invalidate = useInvalidateInventory()
  const products = useProductOptions()
  const warehouses = useWarehouseOptions()

  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { productId: '', sourceWarehouseId: '', destinationWarehouseId: '', quantity: undefined },
  })

  const [productId, sourceWarehouseId, destinationWarehouseId] = useWatch({
    control: form.control,
    name: ['productId', 'sourceWarehouseId', 'destinationWarehouseId'],
  })

  // Live stock of the selected product in every warehouse, to guide the user before submitting.
  const stockParams = { productId, size: 200 }
  const stock = useQuery({
    queryKey: queryKeys.inventory.list(stockParams),
    queryFn: () => inventoryService.list(stockParams),
    enabled: open && !!productId,
  })
  const stockByWarehouse = useMemo(
    () => new Map((stock.data?.content ?? []).map((row) => [row.warehouseId, row])),
    [stock.data],
  )
  const sourceAvailable = sourceWarehouseId ? (stockByWarehouse.get(sourceWarehouseId)?.availableQuantity ?? 0) : undefined
  const destinationAvailable = destinationWarehouseId
    ? (stockByWarehouse.get(destinationWarehouseId)?.availableQuantity ?? 0)
    : undefined

  const mutation = useMutation({
    mutationFn: (values: TransferValues) => {
      if (sourceAvailable !== undefined && values.quantity > sourceAvailable) {
        return Promise.reject(new Error(`Only ${formatNumber(sourceAvailable)} units are available at the source`))
      }
      return inventoryService.transfer(values)
    },
    onSuccess: () => {
      toast.success('Transfer completed')
      invalidate()
      onOpenChange(false)
    },
  })
  const { reset: resetMutation } = mutation
  const serverError = insufficientAware(mutation.error, 'Not enough available stock at the source warehouse for this transfer.')

  useEffect(() => {
    if (!open) return
    resetMutation()
    form.reset({
      productId: defaults?.productId ?? '',
      sourceWarehouseId: defaults?.sourceWarehouseId ?? '',
      destinationWarehouseId: '',
      quantity: undefined,
    })
  }, [open, defaults?.productId, defaults?.sourceWarehouseId, form, resetMutation])

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Transfer stock</DialogTitle>
          <DialogDescription>Move available units of a product between two warehouses in one transaction.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            <ServerError message={serverError} />
            <FormField
              control={form.control}
              name="productId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      value={field.value}
                      onChange={field.onChange}
                      options={products.options}
                      loading={products.loading}
                      placeholder="Select product"
                      searchPlaceholder="Search name or SKU…"
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sourceWarehouseId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <EntityCombobox
                        value={field.value}
                        onChange={field.onChange}
                        options={warehouses.options}
                        loading={warehouses.loading}
                        placeholder="Source warehouse"
                        aria-invalid={!!fieldState.error}
                      />
                    </FormControl>
                    {productId && sourceAvailable !== undefined && (
                      <Availability>
                        {stock.isFetching ? 'Checking stock…' : `${formatNumber(sourceAvailable)} available`}
                      </Availability>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destinationWarehouseId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <EntityCombobox
                        value={field.value}
                        onChange={field.onChange}
                        options={warehouses.options}
                        loading={warehouses.loading}
                        placeholder="Destination warehouse"
                        aria-invalid={!!fieldState.error}
                      />
                    </FormControl>
                    {productId && destinationAvailable !== undefined && (
                      <Availability>
                        {stock.isFetching ? 'Checking stock…' : `${formatNumber(destinationAvailable)} currently available`}
                      </Availability>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step={1} max={sourceAvailable} placeholder="0" {...numberInputProps(field)} />
                  </FormControl>
                  <FormDescription>Only available (unreserved) units can be transferred.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogActions pending={mutation.isPending} submitLabel="Transfer" onCancel={() => onOpenChange(false)} />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
