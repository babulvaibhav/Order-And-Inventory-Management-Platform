import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/productService'
import { warehouseService } from '@/services/warehouseService'
import { customerService } from '@/services/customerService'
import { roleService } from '@/services/roleService'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/store/AuthContext'
import { Permission } from '@/types/auth'
import type { ProductResponse } from '@/types/product'
import type { WarehouseResponse } from '@/types/warehouse'
import type { CustomerResponse } from '@/types/customer'
import type { RoleResponse } from '@/types/role'

/**
 * Backend responses reference related records by id only (inventory, orders).
 * These reference lists are fetched once, cached for a few minutes and used to render names
 * and to populate pickers. A single large page is adequate at this assignment's data scale.
 */
const LOOKUP_SIZE = 1000
const LOOKUP_STALE_MS = 5 * 60_000

function toMap<T extends { id: string }>(items: T[] | undefined): Map<string, T> {
  return new Map((items ?? []).map((item) => [item.id, item]))
}

export function useProductLookup() {
  const { hasPermission } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.lookups.products,
    queryFn: () => productService.list({ size: LOOKUP_SIZE, sort: 'name,asc' }),
    staleTime: LOOKUP_STALE_MS,
    enabled: hasPermission(Permission.PRODUCT_READ),
  })
  const items: ProductResponse[] = useMemo(() => query.data?.content ?? [], [query.data])
  const byId = useMemo(() => toMap(items), [items])
  return { ...query, items, byId }
}

export function useWarehouseLookup() {
  const { hasPermission } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.lookups.warehouses,
    queryFn: () => warehouseService.list({ size: LOOKUP_SIZE, sort: 'name,asc' }),
    staleTime: LOOKUP_STALE_MS,
    enabled: hasPermission(Permission.WAREHOUSE_READ),
  })
  const items: WarehouseResponse[] = useMemo(() => query.data?.content ?? [], [query.data])
  const byId = useMemo(() => toMap(items), [items])
  return { ...query, items, byId }
}

export function useCustomerLookup() {
  const { hasPermission } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.lookups.customers,
    queryFn: () => customerService.list({ size: LOOKUP_SIZE, sort: 'name,asc' }),
    staleTime: LOOKUP_STALE_MS,
    enabled: hasPermission(Permission.CUSTOMER_READ),
  })
  const items: CustomerResponse[] = useMemo(() => query.data?.content ?? [], [query.data])
  const byId = useMemo(() => toMap(items), [items])
  return { ...query, items, byId }
}

/**
 * The organization's roles — used to populate the user form's role picker and to resolve role
 * names. Gated on role.read OR user.manage: the Users page itself only requires user.manage, so a
 * custom role with user.manage but not role.read previously saw an enabled, empty role picker on
 * the user form with no explanation. The built-in Admin role has both by default, so this only
 * matters for a custom role missing role.read. See KNOWN_LIMITATIONS.md "Addressed in this pass".
 */
export function useRoleLookup() {
  const { hasPermission } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.lookups.roles,
    queryFn: () => roleService.list(),
    staleTime: LOOKUP_STALE_MS,
    enabled: hasPermission(Permission.ROLE_READ) || hasPermission(Permission.USER_MANAGE),
  })
  const items: RoleResponse[] = useMemo(() => query.data ?? [], [query.data])
  const byId = useMemo(() => toMap(items), [items])
  return { ...query, items, byId }
}
