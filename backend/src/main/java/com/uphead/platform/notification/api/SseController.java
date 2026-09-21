package com.uphead.platform.notification.api;

import com.uphead.platform.common.tenant.TenantContextHolder;
import com.uphead.platform.notification.application.NotificationService;
import com.uphead.platform.notification.infrastructure.sse.SseEmitterRegistry;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/v1/notifications")
public class SseController {

    private final NotificationService notificationService;
    private final SseEmitterRegistry emitterRegistry;

    public SseController(NotificationService notificationService, SseEmitterRegistry emitterRegistry) {
        this.notificationService = notificationService;
        this.emitterRegistry = emitterRegistry;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAuthority('inventory.read')")
    public SseEmitter streamNotifications() {
        UUID organizationId = TenantContextHolder.getOrganizationId();
        UUID userId = TenantContextHolder.getUserId();

        // register() sends an immediate "connected" comment so the response commits right away,
        // regardless of whether there is anything queued below — this is the actual SSE fix:
        // previously nothing was written at all when there were no unread notifications, so the
        // client saw zero bytes until the 5-minute emitter timeout.
        SseEmitter emitter = emitterRegistry.register(organizationId, userId);

        notificationService.getUnreadNotifications(organizationId, userId)
            .forEach(notification -> {
                try {
                    emitter.send(SseEmitter.event().data(notification));
                } catch (IOException e) {
                    emitter.completeWithError(e);
                }
            });

        return emitter;
    }

    /**
     * Previously non-existent — NotificationService.markAsRead existed but nothing called it, so
     * "mark as read" only happened client-side in memory. See KNOWN_LIMITATIONS.md "Addressed in
     * this pass" (backend and frontend sections).
     */
    @PatchMapping("/{id}/read")
    @PreAuthorize("hasAuthority('inventory.read')")
    public ResponseEntity<Void> markAsRead(@PathVariable UUID id) {
        notificationService.markAsRead(id, TenantContextHolder.getOrganizationId());
        return ResponseEntity.ok().build();
    }
}
