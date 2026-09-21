import type { ChangeEvent } from 'react'

/**
 * Adapts a react-hook-form field for <input type="number"> so the form value is a number
 * (or undefined when empty) instead of a string.
 */
export function numberInputProps(field: {
  value: unknown
  onChange: (value: number | undefined) => void
  onBlur: () => void
  name: string
  ref: (instance: HTMLInputElement | null) => void
}) {
  const value = typeof field.value === 'number' && Number.isFinite(field.value) ? field.value : ''
  return {
    name: field.name,
    ref: field.ref,
    onBlur: field.onBlur,
    value,
    inputMode: 'decimal' as const,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value
      field.onChange(raw === '' ? undefined : event.target.valueAsNumber)
    },
  }
}

/** Converts empty strings to null so optional backend fields are cleared rather than set to "". */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const requiredNumber = (label: string) => ({
  error: (issue: { input: unknown }) => (issue.input === undefined ? `${label} is required` : `Enter a valid ${label.toLowerCase()}`),
})
