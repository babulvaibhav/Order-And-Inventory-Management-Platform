import { NavLink } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/store/AuthContext'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS } from './navigation'

interface SidebarNavProps {
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { hasPermission } = useAuth()

  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) => hasPermission(item.permission))
        if (items.length === 0) return null
        return (
          <div key={section.title} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="text-sidebar-foreground/50 px-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                {section.title}
              </div>
            )}
            {items.map((item) => {
              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                      'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="bg-sidebar-primary absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r" aria-hidden />
                      )}
                      <item.icon className={cn('size-4 shrink-0', isActive && 'text-sidebar-primary')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              )
              if (!collapsed) return link
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
