import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { API_CONFIG } from './apiConfig'
import { AUTH_LOGOUT_EVENT, tokenStorage } from '@/lib/tokenStorage'
import { normalizeApiError } from '@/lib/errors'
import type { LoginResponse } from '@/types/auth'

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const baseConfig = {
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
}

/** Authenticated client used by every domain service. */
export const apiClient = axios.create(baseConfig)

/** Bare client for the refresh call so it never passes through the refresh interceptor itself. */
const refreshClient = axios.create(baseConfig)

let refreshPromise: Promise<string> | null = null

/**
 * Single-flight token refresh: concurrent 401s share one refresh request.
 * Resolves with the new access token or rejects (session is then cleared).
 */
export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return Promise.reject(new Error('No refresh token'))

  refreshPromise = refreshClient
    .post<LoginResponse>(API_CONFIG.ENDPOINTS.AUTH.REFRESH, { refreshToken })
    .then(({ data }) => {
      const { accessToken, refreshToken: nextRefreshToken, ...user } = data
      tokenStorage.setSession(accessToken, nextRefreshToken ?? refreshToken, user)
      return accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

/**
 * `reason`, when given, is shown once on the login page after the redirect (see LoginPage.tsx) —
 * previously a forced logout (e.g. the organization being suspended mid-session) was completely
 * silent. See KNOWN_LIMITATIONS.md "Addressed in this pass".
 */
export function forceLogout(reason?: string) {
  if (reason) tokenStorage.setLogoutReason(reason)
  tokenStorage.clear()
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
}

/**
 * An unauthenticated request (missing/expired token) now gets a proper 401 with an
 * AUTH_TOKEN_EXPIRED body from the backend's AuthenticationEntryPoint. A real authorization
 * failure (@PreAuthorize denying an authenticated user) is a 403 with an ACCESS_DENIED body — that
 * should never trigger a refresh, since refreshing won't grant a permission the role doesn't have.
 * The 403-with-empty-body branch below is kept as a defensive fallback (e.g. something upstream of
 * Spring Security, like a proxy, rejecting the request before it reaches the entry point) rather
 * than the primary path it used to be.
 */
function isAuthFailure(error: AxiosError): boolean {
  const status = error.response?.status
  if (status === 401) return true
  if (status !== 403) return false
  const body = error.response?.data as { error?: { code?: string } } | '' | undefined
  return !body || typeof body !== 'object' || !body.error?.code
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    if (!original || original._retry || !isAuthFailure(error)) {
      return Promise.reject(error)
    }
    if (!tokenStorage.getRefreshToken()) {
      if (tokenStorage.getAccessToken()) forceLogout()
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const accessToken = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${accessToken}`
      return apiClient(original)
    } catch (refreshError) {
      // The refresh call itself carries the real reason (e.g. ORG_SUSPENDED from
      // AuthService.refreshToken) — the original request's error doesn't, since the entry point
      // that produced it has no way to know why the token stopped being valid.
      const { code, message } = normalizeApiError(refreshError)
      forceLogout(code === 'ORG_SUSPENDED' ? message : undefined)
      return Promise.reject(error)
    }
  },
)
