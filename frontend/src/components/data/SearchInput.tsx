import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/** Debounced search box: local state for typing, commits upstream after 300ms of inactivity. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className, disabled }: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const debounced = useDebounce(draft, 300)

  // Sync when the upstream value changes externally (e.g. "clear filters").
  useEffect(() => setDraft(value), [value])

  useEffect(() => {
    if (debounced !== value) onChange(debounced.trim())
    // Only react to debounced input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="pr-8 pl-9"
        disabled={disabled}
        aria-label={placeholder}
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft('')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
