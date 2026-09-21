import type { FormEventHandler, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  submitLabel: string
  pending?: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  /** Server-side error surfaced above the form fields. */
  error?: string | null
  children: ReactNode
}

/** Side panel used for create / edit forms across modules. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  onSubmit,
  error,
  children,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <SheetContent className="gap-0 sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex h-full flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">Form</SheetDescription>}
          </SheetHeader>
          <SheetBody className="space-y-5 py-5">
            {error && (
              <div role="alert" className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2.5 text-sm">
                {error}
              </div>
            )}
            {children}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
