package com.uphead.platform.notification.infrastructure.sse;

import com.uphead.platform.notification.application.port.NotificationPushPort;
import com.uphead.platform.notification.domain.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE adapter for {@link NotificationPushPort}. Live connections are keyed by organization so a
 * push only reaches that organization's own connected clients (the previous single global list
 * had no tenant isolation). Swapping this for WebSocket or a Redis pub/sub fan-out (needed once
 * there's more than one backend instance — see KNOWN_LIMITATIONS.md) means writing a new
 * NotificationPushPort adapter; NotificationConsumer never needs to change.
 */
@Component
public class SseEmitterRegistry implements NotificationPushPort {

    private static final Logger logger = LoggerFactory.getLogger(SseEmitterRegistry.class);

    private final Map<UUID, List<SseEmitter>> emittersByOrganization = new ConcurrentHashMap<>();

    public SseEmitter register(UUID organizationId, UUID userId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minutes
        List<SseEmitter> emitters = emittersByOrganization.computeIfAbsent(organizationId, id -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);

        Runnable cleanup = () -> emitters.remove(emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(() -> {
            cleanup.run();
            emitter.complete();
        });
        emitter.onError(e -> cleanup.run());

        // Commit the response immediately: without this, an SseEmitter with nothing queued never
        // flushes any bytes, so the client's connection appears to hang until the 5-minute timeout.
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            cleanup.run();
            emitter.completeWithError(e);
        }

        return emitter;
    }

    @Override
    public void push(Notification notification) {
        List<SseEmitter> emitters = emittersByOrganization.get(notification.getOrganizationId());
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().data(notification));
            } catch (IOException e) {
                emitters.remove(emitter);
                emitter.completeWithError(e);
            }
        }
    }

    /** Keeps long-idle connections alive through intermediate proxies within the 5-minute timeout. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        emittersByOrganization.forEach((organizationId, emitters) -> {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (IOException e) {
                    emitters.remove(emitter);
                    emitter.complete();
                } catch (Exception e) {
                    logger.warn("Failed to send SSE heartbeat", e);
                }
            }
        });
    }
}
