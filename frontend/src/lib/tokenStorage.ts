import type { AuthUser } from '@/types/auth'

/**
 * Single place that touches persisted auth state.
 * The backend returns tokens in the response body only (no httpOnly cookie, CORS without credentials),
 * so localStorage is the available option; see frontend/README.md "Known limitations".
 */
const KEYS = {
  access: 'uphead.accessToken',
  refresh: 'uphead.refreshToken',
  user: 'uphead.user',
} as const

export const AUTH_LOGOUT_EVENT = 'uphead:auth-logout'
export const AUTH_TOKENS_EVENT = 'uphead:auth-tokens'

/**
 * sessionStorage (not the KEYS above, which are localStorage): only needs to survive the redirect
 * to /login within this tab, and should never leak across tabs/devices the way a shared session
 * reason would. Previously there was no mechanism at all for a forced logout (e.g. the
 * organization being suspended mid-session) to explain itself — the user just landed back on
 * /login with no indication why. See KNOWN_LIMITATIONS.md "Addressed in this pass".
 */
const LOGOUT_REASON_KEY = 'uphead.logoutReason'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const tokenStorage = {
  getAccessToken: () => read(KEYS.access),
  getRefreshToken: () => read(KEYS.refresh),
  getUser(): AuthUser | null {
    const raw = read(KEYS.user)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },
  setSession(accessToken: string, refreshToken: string, user?: AuthUser) {
    localStorage.setItem(KEYS.access, accessToken)
    localStorage.setItem(KEYS.refresh, refreshToken)
    if (user) localStorage.setItem(KEYS.user, JSON.stringify(user))
    window.dispatchEvent(new Event(AUTH_TOKENS_EVENT))
  },
  clear() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key))
  },
  setLogoutReason(reason: string) {
    try {
      sessionStorage.setItem(LOGOUT_REASON_KEY, reason)
    } catch {
      // sessionStorage unavailable (private mode, etc.) — the login page just won't show a reason.
    }
  },
  /** Reads and clears in one step, so the message is shown exactly once. */
  consumeLogoutReason(): string | null {
    try {
      const reason = sessionStorage.getItem(LOGOUT_REASON_KEY)
      sessionStorage.removeItem(LOGOUT_REASON_KEY)
      return reason
    } catch {
      return null
    }
  },
}

/** Returns the JWT `exp` (ms since epoch) without verifying the signature — used only to decide when to refresh. */
export function tokenExpiry(token: string | null): number | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function isTokenExpired(token: string | null, skewMs = 30_000): boolean {
  const exp = tokenExpiry(token)
  return exp === null ? false : Date.now() + skewMs >= exp
}
