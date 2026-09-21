package com.uphead.platform.outbox.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.MessageBrokerPort;
import com.uphead.platform.outbox.domain.OutboxEvent;
import com.uphead.platform.outbox.infrastructure.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Publishes outbox rows to the message broker on a fixed schedule, independent of the request
 * that created them. {@link OutboxEventRepository#lockNextBatch} uses
 * {@code SELECT ... FOR UPDATE SKIP LOCKED}, so running this relay on more than one backend
 * instance (the normal scale-out story) never double-publishes or blocks one instance on another's
 * in-flight batch — each just takes whatever isn't already locked.
 */
@Component
public class OutboxRelay {

    private static final Logger logger = LoggerFactory.getLogger(OutboxRelay.class);
    private static final int BATCH_SIZE = 50;

    private final OutboxEventRepository outboxEventRepository;
    private final MessageBrokerPort messageBrokerPort;
    private final ObjectMapper objectMapper;

    public OutboxRelay(OutboxEventRepository outboxEventRepository, MessageBrokerPort messageBrokerPort,
                        ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.messageBrokerPort = messageBrokerPort;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelay = 10000)
    @Transactional
    public void relay() {
        // Rows returned by this native query are managed JPA entities within this transaction, so
        // markPublished()/recordFailure() below are picked up by dirty checking at commit — no
        // explicit save() needed.
        List<OutboxEvent> batch = outboxEventRepository.lockNextBatch(BATCH_SIZE);

        for (OutboxEvent outboxEvent : batch) {
            try {
                Event event = objectMapper.treeToValue(outboxEvent.getPayload(), Event.class);
                messageBrokerPort.send(outboxEvent.getRoutingKey(), event);
                outboxEvent.markPublished();
            } catch (Exception e) {
                outboxEvent.recordFailure(e.getMessage());
                logger.warn("Outbox event {} failed (attempt {}/{}): {}",
                    outboxEvent.getId(), outboxEvent.getAttempts(), OutboxEvent.MAX_ATTEMPTS, e.getMessage());
            }
        }
    }
}
