import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/store/AuthContext'
import { NotificationProvider } from '@/store/NotificationContext'
import { ThemeProvider, useTheme } from '@/store/ThemeContext'
import { isForbidden, normalizeApiError } from '@/lib/errors'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't hammer the API on authorization / validation failures; retry transient errors once.
      retry: (failureCount, error) => {
        if (isForbidden(error)) return false
        const status = normalizeApiError(error).status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
    },
    mutations: { retry: false },
  },
})

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} richColors closeButton position="top-center" />
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
              <ThemedToaster />
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
