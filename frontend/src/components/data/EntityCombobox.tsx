import { useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown, LoaderCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboOption {
  value: string
  label: string
  description?: ReactNode
  disabled?: boolean
  /** Extra text matched by the search box (e.g. SKU, email). */
  keywords?: string[]
}

interface EntityComboboxProps {
  value: string | undefined
  onChange: (value: string) => void
  options: ComboOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  disabled?: boolean
  clearable?: boolean
  className?: string
  id?: string
  'aria-invalid'?: boolean
}

/** Searchable picker used instead of raw UUID inputs for products, warehouses and customers. */
export function EntityCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  loading,
  disabled,
  clearable,
  className,
  id,
  ...rest
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={rest['aria-invalid']}
          disabled={disabled}
          className={cn('w-full justify-between px-3 font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <span className="flex items-center gap-1">
            {loading && <LoaderCircle className="size-3.5 animate-spin opacity-60" />}
            {clearable && selected && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="hover:bg-muted rounded p-0.5"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange('')
                }}
              >
                <X className="size-3.5 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{option.label}</div>
                    {option.description && <div className="text-muted-foreground truncate text-xs">{option.description}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
