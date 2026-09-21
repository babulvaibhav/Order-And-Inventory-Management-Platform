import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { PAGE_SIZE_OPTIONS, type SortState } from '@/hooks/useListParams'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Page } from '@/types/common'

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Backend (entity) field name; when present the column header toggles server-side sorting. */
  sortField?: string
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Hide on small screens to keep tables readable on mobile. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  page: Page<T> | undefined
  isLoading: boolean
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  sort?: SortState
  onSortChange?: (sort: SortState | undefined) => void
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
  empty?: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }
  /** Hide pagination footer (e.g. small embedded tables). */
  hidePagination?: boolean
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const

export function DataTable<T>({
  columns,
  page,
  isLoading,
  isFetching,
  error,
  onRetry,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  onPageChange,
  onSizeChange,
  empty,
  hidePagination,
}: DataTableProps<T>) {
  const rows = page?.content ?? []

  const toggleSort = (field: string) => {
    if (!onSortChange) return
    if (sort?.field !== field) onSortChange({ field, direction: 'asc' })
    else if (sort.direction === 'asc') onSortChange({ field, direction: 'desc' })
    else onSortChange(undefined)
  }

  const renderBody = () => {
    if (isLoading) {
      return Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
          {columns.map((column) => (
            <TableCell key={column.id} className={cn(column.hideBelow && hideClass[column.hideBelow])}>
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </TableCell>
          ))}
        </TableRow>
      ))
    }
    if (error) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns.length} className="whitespace-normal">
            <ErrorState error={error} onRetry={onRetry} />
          </TableCell>
        </TableRow>
      )
    }
    if (rows.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns.length} className="whitespace-normal">
            <EmptyState
              title={empty?.title ?? 'No results'}
              description={empty?.description}
              action={empty?.action}
              icon={empty?.icon}
            />
          </TableCell>
        </TableRow>
      )
    }
    return rows.map((row) => (
      <TableRow
        key={rowKey(row)}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        className={cn(onRowClick && 'cursor-pointer')}
      >
        {columns.map((column) => (
          <TableCell
            key={column.id}
            className={cn(alignClass[column.align ?? 'left'], column.hideBelow && hideClass[column.hideBelow], column.className)}
          >
            {column.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    ))
  }

  return (
    <div className="bg-card relative overflow-hidden rounded-xl border shadow-xs">
      {isFetching && !isLoading && (
        <div className="bg-brand/70 absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse" aria-hidden />
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const active = column.sortField && sort?.field === column.sortField
              const SortIcon = !active ? ArrowUpDown : sort?.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <TableHead
                  key={column.id}
                  className={cn(alignClass[column.align ?? 'left'], column.hideBelow && hideClass[column.hideBelow])}
                  aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortField && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.sortField!)}
                      className={cn(
                        'hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase transition-colors',
                        active && 'text-foreground',
                      )}
                    >
                      {column.header}
                      <SortIcon className={cn('size-3.5', !active && 'opacity-40')} />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>{renderBody()}</TableBody>
      </Table>
      {!hidePagination && page && !error && page.totalElements > 0 && (
        <Pagination page={page} onPageChange={onPageChange} onSizeChange={onSizeChange} />
      )}
    </div>
  )
}

function Pagination<T>({
  page,
  onPageChange,
  onSizeChange,
}: {
  page: Page<T>
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
}) {
  const from = page.number * page.size + 1
  const to = page.number * page.size + page.content.length
  const lastPage = Math.max(0, page.totalPages - 1)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground tabular">
        Showing <span className="text-foreground font-medium">{formatNumber(from)}</span>–
        <span className="text-foreground font-medium">{formatNumber(to)}</span> of{' '}
        <span className="text-foreground font-medium">{formatNumber(page.totalElements)}</span>
      </p>
      <div className="flex items-center gap-4">
        {onSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden sm:inline">Rows</span>
            <Select value={String(page.size)} onValueChange={(value) => onSizeChange(Number(value))}>
              <SelectTrigger size="sm" className="w-[70px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {onPageChange && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-2 tabular">
              Page {page.number + 1} of {Math.max(1, page.totalPages)}
            </span>
            <Button variant="outline" size="icon-sm" disabled={page.first} onClick={() => onPageChange(0)} aria-label="First page">
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page.first}
              onClick={() => onPageChange(page.number - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page.last}
              onClick={() => onPageChange(page.number + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page.last} onClick={() => onPageChange(lastPage)} aria-label="Last page">
              <ChevronsRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
