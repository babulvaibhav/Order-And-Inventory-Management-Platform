package com.uphead.platform.notification.application.port;

import com.uphead.platform.notification.domain.Notification;

/**
 * Outbound port for pushing a persisted notification to whatever live clients are connected.
 * Today's only adapter is SSE (infrastructure/sse/SseEmitterRegistry); swapping in WebSocket or a
 * Redis pub/sub fan-out for multi-instance deployments means writing a new adapter here — no
 * change to NotificationConsumer, which only depends on this port.
 */
public interface NotificationPushPort {
    void push(Notification notification);
}
