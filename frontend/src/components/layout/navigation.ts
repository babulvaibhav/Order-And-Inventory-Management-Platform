import {
  Boxes,
  Contact,
  Landmark,
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Permission } from '@/types/auth'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Required permission (any-of). Drives both menu visibility and route guarding. */
  permission: Permission
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: Permission.INVENTORY_READ }],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Orders', path: '/orders', icon: ShoppingCart, permission: Permission.ORDER_READ },
      { label: 'Inventory', path: '/inventory', icon: Boxes, permission: Permission.INVENTORY_READ },
      { label: 'Products', path: '/products', icon: Package, permission: Permission.PRODUCT_READ },
      { label: 'Warehouses', path: '/warehouses', icon: Warehouse, permission: Permission.WAREHOUSE_READ },
      { label: 'Customers', path: '/customers', icon: Contact, permission: Permission.CUSTOMER_READ },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', path: '/users', icon: Users, permission: Permission.USER_MANAGE },
      { label: 'Roles', path: '/roles', icon: ShieldCheck, permission: Permission.ROLE_READ },
      { label: 'Audit log', path: '/audit', icon: ScrollText, permission: Permission.AUDIT_READ },
    ],
  },
  {
    // Only a platform-owner user holds organization.read/manage, so this section — and every
    // other section above — self-hides per-role via the existing hasPermission(...) filtering in
    // SidebarNav; no separate shell or role branching is needed to keep the two experiences apart.
    title: 'Platform',
    items: [{ label: 'Organizations', path: '/platform/organizations', icon: Landmark, permission: Permission.ORGANIZATION_READ }],
  },
]

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)
