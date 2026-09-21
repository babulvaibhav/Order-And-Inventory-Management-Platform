/** Centralised TanStack Query keys so invalidation stays consistent across modules. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  products: {
    all: ['products'] as const,
    list: (params: object) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  warehouses: {
    all: ['warehouses'] as const,
    list: (params: object) => ['warehouses', 'list', params] as const,
    detail: (id: string) => ['warehouses', 'detail', id] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (params: object) => ['customers', 'list', params] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    list: (params: object) => ['inventory', 'list', params] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params: object) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: object) => ['users', 'list', params] as const,
  },
  audit: {
    list: (params: object) => ['audit', 'list', params] as const,
  },
  roles: {
    all: ['roles'] as const,
  },
  permissions: {
    all: ['permissions'] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    list: (params: object) => ['organizations', 'list', params] as const,
    users: (id: string) => ['organizations', id, 'users'] as const,
    usersList: (id: string, params: object) => ['organizations', id, 'users', params] as const,
    roles: (id: string) => ['organizations', id, 'roles'] as const,
  },
  lookups: {
    products: ['lookups', 'products'] as const,
    warehouses: ['lookups', 'warehouses'] as const,
    customers: ['lookups', 'customers'] as const,
    roles: ['lookups', 'roles'] as const,
  },
}
