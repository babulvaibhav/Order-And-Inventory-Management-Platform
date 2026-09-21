package com.uphead.platform.notification.infrastructure;

import com.uphead.platform.common.config.RabbitMQConfig;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.MessageBrokerPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ adapter for {@link MessageBrokerPort}. The only caller is {@code OutboxRelay}, which
 * relies on {@link #send} throwing on failure so a row is retried instead of silently lost.
 * Swapping the broker (Kafka, SQS, ...) at scale means writing a new adapter here.
 */
@Component
public class RabbitMqBrokerAdapter implements MessageBrokerPort {

    private static final Logger logger = LoggerFactory.getLogger(RabbitMqBrokerAdapter.class);

    private final RabbitTemplate rabbitTemplate;

    public RabbitMqBrokerAdapter(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @Override
    public void send(String routingKey, Event event) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, routingKey, event);
        } catch (Exception e) {
            logger.error("Failed to publish event {} (routingKey={}): {}", event.type(), routingKey, e.getMessage(), e);
            // Rethrow: the caller (OutboxRelay) needs this to fail so the outbox row stays PENDING
            // and gets retried, instead of the event being silently lost.
            throw e;
        }
    }
}
