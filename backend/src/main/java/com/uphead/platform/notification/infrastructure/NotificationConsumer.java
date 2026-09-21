package com.uphead.platform.notification.infrastructure;

import com.uphead.platform.common.config.RabbitMQConfig;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.NotificationPushPort;
import com.uphead.platform.notification.application.strategy.NotificationMessageStrategy;
import com.uphead.platform.notification.domain.Notification;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class NotificationConsumer {

    private static final Logger logger = LoggerFactory.getLogger(NotificationConsumer.class);

    private final NotificationRepository notificationRepository;
    private final NotificationPushPort notificationPushPort;
    private final ObjectMapper objectMapper;
    private final Map<String, NotificationMessageStrategy> strategiesByEventType;

    public NotificationConsumer(NotificationRepository notificationRepository, NotificationPushPort notificationPushPort,
                                 ObjectMapper objectMapper, List<NotificationMessageStrategy> strategies) {
        this.notificationRepository = notificationRepository;
        this.notificationPushPort = notificationPushPort;
        this.objectMapper = objectMapper;
        // Adding a new event type only means adding a new NotificationMessageStrategy @Component —
        // nothing here needs to change.
        this.strategiesByEventType = strategies.stream()
            .collect(Collectors.toMap(NotificationMessageStrategy::eventType, Function.identity()));
    }

    @RabbitListener(queues = RabbitMQConfig.NOTIFICATION_QUEUE)
    public void handleEvent(Event event) {
        try {
            Notification notification = new Notification(
                event.organizationId(),
                event.userId(),
                event.type(),
                buildMessage(event),
                objectMapper.writeValueAsString(event.data())
            );

            Notification saved = notificationRepository.save(notification);
            notificationPushPort.push(saved);
        } catch (Exception e) {
            logger.error("Failed to process event {}: {}", event.type(), e.getMessage(), e);
        }
    }

    private String buildMessage(Event event) {
        NotificationMessageStrategy strategy = strategiesByEventType.get(event.type());
        return strategy != null ? strategy.buildMessage(event) : "System event: " + event.type();
    }
}
