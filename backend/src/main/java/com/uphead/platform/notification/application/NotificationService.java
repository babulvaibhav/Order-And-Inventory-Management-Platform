package com.uphead.platform.notification.application;

import com.uphead.platform.common.exception.ResourceNotFoundException;
import com.uphead.platform.notification.domain.Notification;
import com.uphead.platform.notification.infrastructure.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public List<Notification> getUnreadNotifications(UUID organizationId, UUID userId) {
        return notificationRepository.findUnreadForRecipient(organizationId, userId);
    }

    /**
     * Tenant-scoped: previously this existed but nothing called it (no controller endpoint), so
     * "mark as read" only ever happened client-side, in memory, per browser tab — see
     * KNOWN_LIMITATIONS.md "Addressed in this pass" and the frontend section there. Notifications
     * are still org-wide rather than per-user (userId is null for every event type this codebase
     * publishes today), so "read" remains shared across everyone in the organization, not
     * per-viewer — that part is unchanged and still documented as a limitation.
     */
    @Transactional
    public void markAsRead(UUID notificationId, UUID organizationId) {
        Notification notification = notificationRepository.findByIdAndOrganizationId(notificationId, organizationId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        notification.setRead(true);
        notificationRepository.save(notification);
    }
}
