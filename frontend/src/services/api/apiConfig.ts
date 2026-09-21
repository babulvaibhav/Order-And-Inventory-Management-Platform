export const API_CONFIG = {
  /** Relative `/api` works behind the Vite dev proxy and the nginx proxy in Docker. */
  BASE_URL: (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api',
  TIMEOUT: 30000,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/v1/auth/login',
      REFRESH: '/v1/auth/refresh',
      LOGOUT: '/v1/auth/logout',
    },
    DASHBOARD: {
      SUMMARY: '/v1/dashboard/summary',
    },
    PRODUCTS: {
      LIST: '/v1/products',
      DETAIL: (id: string) => `/v1/products/${id}`,
      DISABLE: (id: string) => `/v1/products/${id}/disable`,
    },
    WAREHOUSES: {
      LIST: '/v1/warehouses',
      DETAIL: (id: string) => `/v1/warehouses/${id}`,
      DISABLE: (id: string) => `/v1/warehouses/${id}/disable`,
    },
    INVENTORY: {
      LIST: '/v1/inventory',
      DETAIL: (id: string) => `/v1/inventory/${id}`,
      ADJUST: '/v1/inventory/adjust',
      TRANSFER: '/v1/inventory/transfer',
      RESERVE: '/v1/inventory/reserve',
      RELEASE: '/v1/inventory/release',
    },
    ORDERS: {
      LIST: '/v1/orders',
      DETAIL: (id: string) => `/v1/orders/${id}`,
      UPDATE_STATUS: (id: string) => `/v1/orders/${id}/status`,
    },
    USERS: {
      LIST: '/v1/users',
      DETAIL: (id: string) => `/v1/users/${id}`,
    },
    CUSTOMERS: {
      LIST: '/v1/customers',
      DETAIL: (id: string) => `/v1/customers/${id}`,
    },
    AUDIT_LOGS: {
      LIST: '/v1/audit-logs',
    },
    NOTIFICATIONS: {
      STREAM: '/v1/notifications/stream',
      MARK_READ: (id: string) => `/v1/notifications/${id}/read`,
    },
    ROLES: {
      LIST: '/v1/roles',
      DETAIL: (id: string) => `/v1/roles/${id}`,
      PERMISSIONS: (id: string) => `/v1/roles/${id}/permissions`,
    },
    PERMISSIONS: {
      LIST: '/v1/permissions',
    },
    ORGANIZATIONS: {
      LIST: '/v1/organizations',
      DETAIL: (id: string) => `/v1/organizations/${id}`,
      USERS: (id: string) => `/v1/organizations/${id}/users`,
      USER_DETAIL: (id: string, userId: string) => `/v1/organizations/${id}/users/${userId}`,
      ROLES: (id: string) => `/v1/organizations/${id}/roles`,
    },
  },
} as const
