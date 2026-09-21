import { Suspense, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, Menu, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { useAuth } from '@/store/AuthContext'
import { cn, shortId } from '@/lib/utils'
import { Brand } from './Brand'
import { SidebarNav } from './SidebarNav'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { ALL_NAV_ITEMS } from './navigation'

const COLLAPSE_KEY = 'uphead.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const [, section, id] = pathname.split('/')
  const item = ALL_NAV_ITEMS.find((nav) => nav.path === `/${section}`)
  if (!item) return null
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {id ? (
        <>
          <Link to={item.path} className="text-muted-foreground hover:text-foreground truncate transition-colors">
            {item.label}
          </Link>
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-mono text-xs font-medium">{shortId(id)}</span>
        </>
      ) : (
        <span className="truncate font-medium">{item.label}</span>
      )}
    </nav>
  )
}

function PageFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </div>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const { user } = useAuth()

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // non-essential preference
      }
      return next
    })
  }

  return (
    <div className="bg-background flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center px-0')}>
          <Brand collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav collapsed={collapsed} />
        </div>
        {!collapsed && user && (
          <div className="border-sidebar-border text-sidebar-foreground/60 border-t px-4 py-3 text-[11px]">
            <div className="tracking-wider uppercase">Organization</div>
            <div className="text-sidebar-foreground font-mono">{shortId(user.organizationId)}</div>
          </div>
        )}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-sidebar border-sidebar-border w-64 gap-0 p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main application navigation</SheetDescription>
          <div className="flex h-14 items-center px-4">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft />
          </Button>
          <div className="bg-border mx-1 hidden h-5 w-px lg:block" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
