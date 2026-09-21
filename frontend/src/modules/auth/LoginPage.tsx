import { useState } from 'react'
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, Eye, EyeOff, LoaderCircle, ShieldCheck, TriangleAlert, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { BrandMark } from '@/components/layout/Brand'
import { useAuth } from '@/store/AuthContext'
import { errorMessage } from '@/lib/errors'
import { tokenStorage } from '@/lib/tokenStorage'

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginValues = z.infer<typeof loginSchema>

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Tenant-isolated', text: 'Every record is scoped to your organization.' },
  { icon: Boxes, title: 'Oversell-proof inventory', text: 'Atomic reservations across warehouses.' },
  { icon: Zap, title: 'Real-time', text: 'Order and stock events streamed live.' },
]

export default function LoginPage() {
  const { login, isAuthenticated, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Read once and cleared immediately (consumeLogoutReason) so it's shown exactly once, even
  // across a refresh of this same page. Previously a forced logout (e.g. the organization being
  // suspended mid-session) landed here with zero explanation. See KNOWN_LIMITATIONS.md "Addressed
  // in this pass".
  const [logoutReason] = useState(() => tokenStorage.consumeLogoutReason())

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: Location } | null)?.from
  const redirectTo = from && from.pathname !== '/login' ? `${from.pathname}${from.search}` : '/'

  if (status !== 'loading' && isAuthenticated) return <Navigate to={redirectTo} replace />

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    try {
      await login(values)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="bg-sidebar text-sidebar-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div className="bg-sidebar-primary/20 pointer-events-none absolute -top-40 -right-32 size-[420px] rounded-full blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-9" />
          <div className="leading-tight">
            <div className="text-sidebar-accent-foreground font-semibold">Uphead</div>
            <div className="text-sidebar-foreground/60 text-xs tracking-wider uppercase">Operations Platform</div>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <p className="text-sidebar-primary font-mono text-xs tracking-widest uppercase">Order &amp; inventory control</p>
            <h1 className="text-sidebar-accent-foreground text-4xl leading-tight font-semibold tracking-tight">
              Every unit accounted for, across every warehouse.
            </h1>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <div className="bg-sidebar-accent text-sidebar-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <item.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sidebar-accent-foreground text-sm font-medium">{item.title}</p>
                  <p className="text-sidebar-foreground/70 text-sm">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sidebar-foreground/50 relative text-xs">© {new Date().getFullYear()} Uphead Consulting</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-semibold">Uphead Operations</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-muted-foreground text-sm">Use your organization account to continue.</p>
          </div>

          {logoutReason && !formError && (
            <div role="status" className="border-warning/40 bg-warning/8 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
              <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
              <span>{logoutReason}</span>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="username" placeholder="you@company.com" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="pr-10"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting && <LoaderCircle className="animate-spin" />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>

          <div className="bg-muted/60 rounded-lg border border-dashed px-4 py-3 text-xs">
            <p className="text-foreground mb-1 font-medium">Demo environment</p>
            <p className="text-muted-foreground">
              Seeded admin: <span className="text-foreground font-mono">admin@uphead.com</span> — see README for the
              development password.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
