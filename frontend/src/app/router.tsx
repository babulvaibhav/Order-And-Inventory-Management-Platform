/* eslint-disable react-refresh/only-export-components -- route config module, not a component module */
import { lazy, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Permission } from '@/types/auth'
import LoginPage from '@/modules/auth/LoginPage'
import NotFoundPage from '@/modules/NotFoundPage'
import { HomeRedirect, RequireAuth, RequirePermission } from './guards'

// Route-level code splitting keeps the login bundle small.
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'))
const ProductListPage = lazy(() => import('@/modules/products/ProductListPage'))
const ProductDetailPage = lazy(() => import('@/modules/products/ProductDetailPage'))
const WarehouseListPage = lazy(() => import('@/modules/warehouses/WarehouseListPage'))
const InventoryPage = lazy(() => import('@/modules/inventory/InventoryPage'))
const OrderListPage = lazy(() => import('@/modules/orders/OrderListPage'))
const OrderDetailPage = lazy(() => import('@/modules/orders/OrderDetailPage'))
const CustomerListPage = lazy(() => import('@/modules/customers/CustomerListPage'))
const UserListPage = lazy(() => import('@/modules/users/UserListPage'))
const AuditLogPage = lazy(() => import('@/modules/audit/AuditLogPage'))
const RoleListPage = lazy(() => import('@/modules/roles/RoleListPage'))
const OrganizationListPage = lazy(() => import('@/modules/platform/OrganizationListPage'))

const guarded = (permission: Permission, element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dashboard', element: guarded(Permission.INVENTORY_READ, <DashboardPage />) },
      { path: 'products', element: guarded(Permission.PRODUCT_READ, <ProductListPage />) },
      { path: 'products/:id', element: guarded(Permission.PRODUCT_READ, <ProductDetailPage />) },
      { path: 'warehouses', element: guarded(Permission.WAREHOUSE_READ, <WarehouseListPage />) },
      { path: 'inventory', element: guarded(Permission.INVENTORY_READ, <InventoryPage />) },
      { path: 'orders', element: guarded(Permission.ORDER_READ, <OrderListPage />) },
      { path: 'orders/:id', element: guarded(Permission.ORDER_READ, <OrderDetailPage />) },
      { path: 'customers', element: guarded(Permission.CUSTOMER_READ, <CustomerListPage />) },
      { path: 'users', element: guarded(Permission.USER_MANAGE, <UserListPage />) },
      { path: 'roles', element: guarded(Permission.ROLE_READ, <RoleListPage />) },
      { path: 'audit', element: guarded(Permission.AUDIT_READ, <AuditLogPage />) },
      { path: 'platform/organizations', element: guarded(Permission.ORGANIZATION_READ, <OrganizationListPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
