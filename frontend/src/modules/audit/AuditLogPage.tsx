import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileJson, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { useListParams, type SortState } from '@/hooks/useListParams'
import { auditService } from '@/services/auditService'
import { queryKeys } from '@/lib/queryKeys'
import { formatDateTime, humanize } from '@/lib/format'
import { shortId } from '@/lib/utils'
import type { AuditLogResponse } from '@/types/audit'

const DEFAULT_SORT: SortState = { field: 'timestamp', direction: 'desc' }
const FILTER_KEYS = ['mode', 'entity', 'action', 'startDate', 'endDate'] as const
const ENTITIES = ['Product', 'Warehouse', 'Inventory', 'Order', 'Customer', 'User'] as const

type FilterMode = 'all' | 'entity' | 'action' | 'date'

/** datetime-local gives "YYYY-MM-DDTHH:mm"; the backend expects ISO LocalDateTime with seconds. */
const toBackendDateTime = (value: string) => (value && value.length === 16 ? `${value}:00` : value)

function prettyJson(value: string | null): string {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function actionVariant(action: string) {
  if (/CREAT|LOGIN/i.test(action)) return 'success' as const
  if (/DELETE|DISABLE|CANCEL/i.test(action)) return 'destructive' as const
  if (/UPDATE|ADJUST|TRANSFER|STATUS/i.test(action)) return 'info' as const
  return 'secondary' as const
}

export default function AuditLogPage() {
  const list = useListParams({ defaultSort: DEFAULT_SORT, filterKeys: FILTER_KEYS })
  const mode = (list.filters.mode || 'all') as FilterMode
  const [viewing, setViewing] = useState<AuditLogResponse | null>(null)

  // Backend applies exactly one filter (date range > entity > action), so the UI exposes one mode at a time.
  const params = {
    ...list.pageable,
    entity: mode === 'entity' ? list.filters.entity || undefined : undefined,
    action: mode === 'action' ? list.filters.action || undefined : undefined,
    startDate: mode === 'date' && list.filters.startDate && list.filters.endDate ? toBackendDateTime(list.filters.startDate) : undefined,
    endDate: mode === 'date' && list.filters.startDate && list.filters.endDate ? toBackendDateTime(list.filters.endDate) : undefined,
  }
  const query = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditService.list(params),
    placeholderData: keepPreviousData,
  })

  const columns: Column<AuditLogResponse>[] = [
    {
      id: 'timestamp',
      header: 'When',
      sortField: 'timestamp',
      cell: (log) => <span className="text-muted-foreground tabular">{formatDateTime(log.timestamp ?? log.createdAt)}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      sortField: 'action',
      cell: (log) => <Badge variant={actionVariant(log.action)}>{humanize(log.action)}</Badge>,
    },
    {
      id: 'entity',
      header: 'Entity',
      sortField: 'entity',
      cell: (log) => (
        <span>
          {log.entity}
          {log.entityId && <span className="text-muted-foreground ml-2 font-mono text-xs">#{shortId(log.entityId)}</span>}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'Actor',
      hideBelow: 'md',
      cell: (log) => <span className="text-muted-foreground font-mono text-xs">{log.userId ? shortId(log.userId) : 'system'}</span>,
    },
    {
      id: 'changes',
      header: <span className="sr-only">Changes</span>,
      align: 'right',
      cell: (log) =>
        log.oldValue || log.newValue ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setViewing(log)
            }}
          >
            <FileJson /> Changes
          </Button>
        ) : null,
    },
  ]

  const setMode = (next: string) => list.setFilters({ mode: next === 'all' ? '' : next, entity: '', action: '', startDate: '', endDate: '' })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Immutable record of security-relevant and business changes in your organization. Entries cannot be edited or deleted."
      />

      <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="all">All events</TabsTrigger>
            <TabsTrigger value="entity">By entity</TabsTrigger>
            <TabsTrigger value="action">By action</TabsTrigger>
            <TabsTrigger value="date">Date range</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'entity' && (
          <Select value={list.filters.entity || undefined} onValueChange={(entity) => list.setFilters({ entity })}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Entity">
              <SelectValue placeholder="Choose an entity" />
            </SelectTrigger>
            <SelectContent>
              {ENTITIES.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {mode === 'action' && (
          <SearchInput
            value={list.filters.action}
            onChange={(action) => list.setFilters({ action: action.toUpperCase() })}
            placeholder="Exact action, e.g. PRODUCT_CREATED"
            className="sm:w-80"
          />
        )}
        {mode === 'date' && (
          <div className="grid gap-3 sm:grid-cols-[220px_220px_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="audit-start">From</Label>
              <Input
                id="audit-start"
                type="datetime-local"
                value={list.filters.startDate}
                onChange={(event) => list.setFilters({ startDate: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="audit-end">To</Label>
              <Input
                id="audit-end"
                type="datetime-local"
                value={list.filters.endDate}
                min={list.filters.startDate || undefined}
                onChange={(event) => list.setFilters({ endDate: event.target.value })}
              />
            </div>
            {!(list.filters.startDate && list.filters.endDate) && (
              <p className="text-muted-foreground text-xs sm:pb-2.5">Set both bounds to apply the range.</p>
            )}
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(log) => log.id}
        onRowClick={(log) => (log.oldValue || log.newValue ? setViewing(log) : undefined)}
        sort={list.sort}
        onSortChange={list.setSort}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        empty={{
          icon: <ScrollText />,
          title: mode === 'all' ? 'No audit events recorded yet' : 'No events match this filter',
          description:
            mode === 'all' ? 'Changes to products, inventory, orders and users will be listed here as they happen.' : undefined,
        }}
      />

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing && humanize(viewing.action)}</DialogTitle>
            <DialogDescription>
              {viewing?.entity} {viewing?.entityId && <span className="font-mono">#{shortId(viewing.entityId)}</span>} ·{' '}
              {formatDateTime(viewing?.timestamp)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {(['oldValue', 'newValue'] as const).map((key) => (
              <div key={key} className="min-w-0 space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {key === 'oldValue' ? 'Before' : 'After'}
                </p>
                <pre className="bg-muted max-h-[50vh] overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                  {prettyJson(viewing?.[key] ?? null)}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
