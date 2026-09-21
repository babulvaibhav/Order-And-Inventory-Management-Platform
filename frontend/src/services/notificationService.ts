import { apiClient } from './api/apiClient'
import { API_CONFIG } from './api/apiConfig'

const { NOTIFICATIONS } = API_CONFIG.ENDPOINTS

export const notificationService = {
  /**
   * Persists read state server-side. Previously there was no endpoint at all —
   * NotificationService.markAsRead existed on the backend but nothing called it, so "mark as
   * read" only ever lived in this tab's memory (NotificationContext.tsx) and reset on reload or
   * in a new tab. See KNOWN_LIMITATIONS.md "Addressed in this pass". Notifications remain
   * organization-wide rather than per-user, so this marks it read for the whole organization, not
   * just this viewer — that part is unchanged and still a known limitation.
   */
  async markRead(id: string): Promise<void> {
    await apiClient.patch(NOTIFICATIONS.MARK_READ(id))
  },
}
