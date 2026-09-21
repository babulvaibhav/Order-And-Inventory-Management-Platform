import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(num) ? currencyFormatter.format(num) : '—'
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return numberFormatter.format(value)
}

/** Backend sends zone-less LocalDateTime strings (e.g. 2026-09-21T10:15:30.123); treat them as local time. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy · HH:mm') : '—'
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy') : '—'
}

export function formatRelative(value: string | null | undefined): string {
  const date = toDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '—'
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
