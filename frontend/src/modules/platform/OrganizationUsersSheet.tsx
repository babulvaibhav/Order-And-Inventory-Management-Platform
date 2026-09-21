import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Pencil, ShieldAlert, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { organizationService } from '@/services/organizationService'
import { queryKeys } from '@/lib/queryKeys'
import { errorMessage } from '@/lib/errors'
import { initials } from '@/lib/utils'
import type { OrganizationResponse } from '@/types/organization'
import type { UserResponse } from '@/types/user'
import { OrganizationUserFormSheet } from './OrganizationUserFormSheet'

const LIST_PARAMS = { size: 100, sort: 'name,asc' }

interface OrganizationUsersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: OrganizationResponse | null
}

/**
 * The whole point of creating an organization is for someone in it to be able to log in — but
 * until this existed, `CreateOrganizationSheet`'s first-admin step was the *only* way that could
 * ever happen. If that admin's credentials were lost, mistyped, or never used, the organization
 * was permanently stuck with zero usable accounts and no recovery path. This lets the Platform
 * Owner see who already exists in an organization and add (or fix) an account directly.
 */
export function OrganizationUsersSheet({ open, onOpenChange, organization }: OrganizationUsersSheetProps) {
  const [formUser, setFormUser] = useState<UserResponse | null | 'new'>(null)

  const query = useQuery({
    queryKey: queryKeys.organizations.usersList(organization?.id ?? '', LIST_PARAMS),
    queryFn: () => organizationService.listUsers(organization!.id, LIST_PARAMS),
    enabled: open && !!organization,
  })

  const users = query.data?.content ?? []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Users — {organization?.name}</SheetTitle>
            <SheetDescription>
              An organization can only be signed into once it has at least one user. Add one directly here if the first
              admin's credentials were never set up or were lost.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4 py-5">
            <Button onClick={() => setFormUser('new')} className="w-full">
              <UserPlus /> Add user
            </Button>

            {query.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : query.error ? (
              <div className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{errorMessage(query.error)}</span>
              </div>
            ) : users.length === 0 ? (
              <div className="border-warning/40 bg-warning/8 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
                <ShieldAlert className="text-warning mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">No one can sign in to this organization yet</p>
                  <p className="text-muted-foreground">Add its first user above.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {users.map((user) => (
                  <li key={user.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{user.name}</div>
                      <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {user.roleName}
                    </Badge>
                    {!user.active && (
                      <Badge variant="muted" className="shrink-0">
                        Deactivated
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`Edit ${user.name}`}
                      onClick={() => setFormUser(user)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {users.length > 0 && (
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <KeyRound className="mt-0.5 size-3.5 shrink-0" />
                Edit a user to reset their password if they've lost access.
              </p>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {organization && (
        <OrganizationUserFormSheet
          open={!!formUser}
          onOpenChange={(next) => !next && setFormUser(null)}
          organizationId={organization.id}
          organizationName={organization.name}
          user={formUser === 'new' ? null : formUser}
        />
      )}
    </>
  )
}
