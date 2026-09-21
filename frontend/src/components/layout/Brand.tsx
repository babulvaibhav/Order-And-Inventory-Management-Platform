import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-brand text-brand-foreground flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold',
        className,
      )}
      aria-hidden
    >
      U
    </div>
  )
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sidebar-accent-foreground text-sm font-semibold tracking-tight">Uphead</div>
          <div className="text-sidebar-foreground/60 text-[11px] tracking-wider uppercase">Operations</div>
        </div>
      )}
    </div>
  )
}
