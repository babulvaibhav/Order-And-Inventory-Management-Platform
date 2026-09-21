import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source'
import { API_CONFIG } from './api/apiConfig'
import { refreshAccessToken } from './api/apiClient'
import { tokenStorage } from '@/lib/tokenStorage'
import type { AppNotification, StreamStatus } from '@/types/notification'

/** Stop for good (e.g. session expired, permission denied). */
class FatalError extends Error {}
/** Reconnect immediately (e.g. token was just refreshed). */
class ReconnectNowError extends Error {}

export interface StreamHandlers {
  onNotification: (notification: AppNotification) => void
  onStatus: (status: StreamStatus) => void
}

const MAX_BACKOFF_MS = 30_000

/**
 * Opens the authenticated SSE stream. Native EventSource cannot send an Authorization header,
 * which the backend requires, so a fetch-based client is used.
 *
 * Reconnection is driven here rather than by the library so every attempt reads the *current*
 * access token (the library captures headers once per invocation):
 * - server closes the emitter (5 min timeout) or the network drops -> reconnect with exponential backoff
 * - stream rejected as unauthenticated -> refresh the token once, then reconnect immediately
 *
 * Returns a disposer that aborts the connection and cancels pending reconnects.
 */
export function openNotificationStream({ onNotification, onStatus }: StreamHandlers): () => void {
  const url = API_CONFIG.BASE_URL.replace(/\/$/, '') + API_CONFIG.ENDPOINTS.NOTIFICATIONS.STREAM
  let disposed = false
  let attempt = 0
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (delay: number) => {
    if (disposed) return
    onStatus('reconnecting')
    timer = setTimeout(connect, delay)
  }

  function connect() {
    if (disposed) return
    controller = new AbortController()
    let refreshed = false
    onStatus(attempt === 0 ? 'connecting' : 'reconnecting')

    fetchEventSource(url, {
      signal: controller.signal,
      // Release the connection while the tab is hidden (browsers allow only ~6 HTTP/1.1 connections per host,
      // so idle background tabs holding streams would starve foreground requests). Reopens on visibility.
      openWhenHidden: false,
      headers: {
        Accept: EventStreamContentType,
        Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ''}`,
      },
      async onopen(response) {
        const contentType = response.headers.get('content-type') ?? ''
        if (response.ok && contentType.includes(EventStreamContentType)) {
          attempt = 0
          onStatus('open')
          return
        }
        if ((response.status === 401 || response.status === 403) && !refreshed) {
          refreshed = true
          try {
            await refreshAccessToken()
          } catch {
            throw new FatalError('Session expired')
          }
          throw new ReconnectNowError()
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new FatalError(`Stream rejected (${response.status})`)
        }
        throw new Error(`Stream unavailable (${response.status})`)
      },
      onmessage(event) {
        if (!event.data) return
        try {
          const parsed = JSON.parse(event.data) as AppNotification
          if (parsed?.type) onNotification(parsed)
        } catch {
          // Ignore keep-alive / non-JSON frames.
        }
      },
      onclose() {
        throw new Error('Stream closed by server')
      },
      onerror(error) {
        // Always rethrow: reconnection is handled by the outer loop below.
        throw error
      },
    }).then(
      () => undefined,
      (error: unknown) => {
        if (disposed) return
        if (error instanceof FatalError) {
          onStatus('closed')
          return
        }
        if (error instanceof ReconnectNowError) {
          connect()
          return
        }
        attempt += 1
        schedule(Math.min(1000 * 2 ** Math.min(attempt, 5), MAX_BACKOFF_MS))
      },
    )
  }

  // Close the stream when the page is unloaded or enters the back/forward cache so the socket is freed immediately.
  const onPageHide = () => controller?.abort()
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !disposed) connect()
  }
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)

  connect()

  return () => {
    disposed = true
    clearTimeout(timer)
    controller?.abort()
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
    onStatus('idle')
  }
}
