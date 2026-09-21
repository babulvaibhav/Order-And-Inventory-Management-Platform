import axios from 'axios'

export interface NormalizedError {
  code: string
  message: string
  status?: number
}

interface BackendErrorBody {
  success?: false
  error?: { code?: string; message?: string }
}

/**
 * Some backend failures surface as 500 INTERNAL_ERROR with the domain code embedded
 * in the message (e.g. "INSUFFICIENT_INVENTORY for product: ..."). Recover the code so the UI can react to it.
 */
const EMBEDDED_CODES = ['INSUFFICIENT_INVENTORY', 'INVALID_STATUS_TRANSITION'] as const

const FRIENDLY_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCESS_DENIED: 'You do not have permission to perform this action.',
  TENANT_ACCESS_DENIED: 'This resource belongs to another organization.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  ORG_SUSPENDED: 'Your organization has been suspended. Contact your administrator.',
}

export function normalizeApiError(error: unknown): NormalizedError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (!error.response) {
      return { code: 'NETWORK_ERROR', message: FRIENDLY_MESSAGES.NETWORK_ERROR }
    }
    const body = error.response.data as BackendErrorBody | undefined
    const rawCode = body?.error?.code
    const rawMessage = body?.error?.message

    if (rawCode) {
      let code = rawCode
      if (code === 'INTERNAL_ERROR' && rawMessage) {
        code = EMBEDDED_CODES.find((candidate) => rawMessage.includes(candidate)) ?? code
      }
      if (/Invalid status transition/i.test(rawMessage ?? '')) code = 'INVALID_STATUS_TRANSITION'
      return { code, status, message: FRIENDLY_MESSAGES[code] ?? rawMessage ?? 'Request failed.' }
    }

    if (status === 401) return { code: 'SESSION_EXPIRED', status, message: FRIENDLY_MESSAGES.SESSION_EXPIRED }
    if (status === 403) return { code: 'ACCESS_DENIED', status, message: FRIENDLY_MESSAGES.ACCESS_DENIED }
    if (status === 404) return { code: 'NOT_FOUND', status, message: 'The requested resource was not found.' }
    return { code: 'HTTP_' + status, status, message: `Request failed (${status}).` }
  }
  if (error instanceof Error) return { code: 'CLIENT_ERROR', message: error.message }
  return { code: 'UNKNOWN', message: 'Something went wrong.' }
}

export function errorMessage(error: unknown): string {
  return normalizeApiError(error).message
}

export function isForbidden(error: unknown): boolean {
  const normalized = normalizeApiError(error)
  return normalized.status === 403 || normalized.code === 'ACCESS_DENIED'
}
