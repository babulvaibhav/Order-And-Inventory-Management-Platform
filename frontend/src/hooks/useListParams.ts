import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export type SortDirection = 'asc' | 'desc'
export interface SortState {
  field: string
  direction: SortDirection
}

interface Options<F extends string> {
  defaultSort?: SortState
  defaultSize?: number
  filterKeys?: readonly F[]
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

/**
 * Keeps list state (page, size, sort, filters) in the URL so it survives reloads and is shareable.
 * Produces Spring Pageable params: page (0-based), size, sort=field,dir.
 */
export function useListParams<F extends string = never>({
  defaultSort,
  defaultSize = 20,
  filterKeys = [],
}: Options<F> = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(0, Number(searchParams.get('page') ?? 0) || 0)
  const rawSize = Number(searchParams.get('size') ?? defaultSize)
  const size = (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawSize) ? rawSize : defaultSize

  const sortParam = searchParams.get('sort')
  const sort: SortState | undefined = useMemo(() => {
    if (sortParam) {
      const [field, direction] = sortParam.split(',')
      if (field) return { field, direction: direction === 'asc' ? 'asc' : 'desc' }
    }
    return defaultSort
  }, [sortParam, defaultSort])

  const filterSignature = filterKeys.map((key) => `${key}=${searchParams.get(key) ?? ''}`).join('&')
  const filters = useMemo(() => {
    const result = {} as Record<F, string>
    filterKeys.forEach((key) => {
      result[key] = searchParams.get(key) ?? ''
    })
    return result
    // filterSignature captures the relevant searchParams values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature])

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (nextPage: number) => update((params) => (nextPage > 0 ? params.set('page', String(nextPage)) : params.delete('page'))),
    [update],
  )

  const setSize = useCallback(
    (nextSize: number) =>
      update((params) => {
        params.set('size', String(nextSize))
        params.delete('page')
      }),
    [update],
  )

  const setSort = useCallback(
    (next: SortState | undefined) =>
      update((params) => {
        if (next) params.set('sort', `${next.field},${next.direction}`)
        else params.delete('sort')
        params.delete('page')
      }),
    [update],
  )

  /** Sets several filters at once (use '' to clear) and resets to the first page. */
  const setFilters = useCallback(
    (values: Partial<Record<F, string>>) =>
      update((params) => {
        Object.entries(values).forEach(([key, value]) => {
          if (value) params.set(key, value as string)
          else params.delete(key)
        })
        params.delete('page')
      }),
    [update],
  )

  const resetFilters = useCallback(
    () =>
      update((params) => {
        filterKeys.forEach((key) => params.delete(key))
        params.delete('page')
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update, filterSignature],
  )

  const pageable = useMemo(
    () => ({ page, size, sort: sort ? `${sort.field},${sort.direction}` : undefined }),
    [page, size, sort],
  )

  return { page, size, sort, filters, pageable, setPage, setSize, setSort, setFilters, resetFilters }
}
