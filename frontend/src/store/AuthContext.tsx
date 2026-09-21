/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/authService'
import { refreshAccessToken } from '@/services/api/apiClient'
import {
  AUTH_LOGOUT_EVENT,
  AUTH_TOKENS_EVENT,
  isTokenExpired,
  tokenStorage,
} from '@/lib/tokenStorage'
import type { AuthUser, LoginRequest, Permission } from '@/types/auth'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  isAuthenticated: boolean
  login: (request: LoginRequest) => Promise<AuthUser>
  logout: () => Promise<void>
  /** UX-only permission check; the backend remains authoritative. */
  hasPermission: (permission: Permission | string) => boolean
  hasAnyPermission: (permissions: Array<Permission | string>) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(() => tokenStorage.getUser())
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!tokenStorage.getUser() || !tokenStorage.getRefreshToken()) return 'anonymous'
    return isTokenExpired(tokenStorage.getAccessToken()) ? 'loading' : 'authenticated'
  })

  // Boot: silently refresh an expired access token before rendering protected pages.
  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    refreshAccessToken()
      .then(() => {
        if (cancelled) return
        setUser(tokenStorage.getUser())
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        tokenStorage.clear()
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [status])

  // React to session changes triggered outside React (interceptor refresh / forced logout / other tabs).
  useEffect(() => {
    const onLogout = () => {
      setUser(null)
      setStatus('anonymous')
      queryClient.clear()
    }
    const onTokens = () => setUser(tokenStorage.getUser())
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('uphead.')) {
        const stored = tokenStorage.getUser()
        if (!stored || !tokenStorage.getRefreshToken()) onLogout()
        else setUser(stored)
      }
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout)
    window.addEventListener(AUTH_TOKENS_EVENT, onTokens)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout)
      window.removeEventListener(AUTH_TOKENS_EVENT, onTokens)
      window.removeEventListener('storage', onStorage)
    }
  }, [queryClient])

  const login = useCallback(
    async (request: LoginRequest) => {
      const { accessToken, refreshToken, ...profile } = await authService.login(request)
      queryClient.clear()
      tokenStorage.setSession(accessToken, refreshToken, profile)
      setUser(profile)
      setStatus('authenticated')
      return profile
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    try {
      if (refreshToken) await authService.logout(refreshToken)
    } catch {
      // Revocation is best-effort; local session is cleared regardless.
    } finally {
      tokenStorage.clear()
      queryClient.clear()
      setUser(null)
      setStatus('anonymous')
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(user?.permissions ?? [])
    return {
      user,
      status,
      isAuthenticated: status === 'authenticated' && !!user,
      login,
      logout,
      hasPermission: (permission) => permissions.has(permission),
      hasAnyPermission: (list) => list.some((permission) => permissions.has(permission)),
    }
  }, [user, status, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
