package com.uphead.platform.outbox.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uphead.platform.notification.application.Event;
import com.uphead.platform.notification.application.port.EventPublisher;
import com.uphead.platform.outbox.domain.OutboxEvent;
import com.uphead.platform.outbox.infrastructure.OutboxEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@link EventPublisher} adapter every business service actually calls. Instead of talking to
 * RabbitMQ directly, it writes a row to {@code outbox_events} in the caller's own transaction —
 * the event is durably recorded if and only if the business change it describes commits.
 * {@link com.uphead.platform.outbox.application.OutboxRelay} publishes the row to the broker
 * afterward, on its own schedule, with retries. This is what fixes two real bugs the previous
 * direct-publish design had: a rollback could still leave a "phantom" event queued (there was
 * none here to roll back), and a broker outage no longer means the event is silently lost.
 */
@Service
public class OutboxEventPublisher implements EventPublisher {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OutboxEventPublisher(OutboxEventRepository outboxEventRepository, ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    // MANDATORY, not the default REQUIRED: this only does its job — the row rolling back with the
    // business change — if it's always called from inside an existing @Transactional method. If a
    // future call site forgets @Transactional, this fails loudly instead of silently reintroducing
    // the phantom-event bug.
    @Transactional(propagation = Propagation.MANDATORY)
    public void publishEvent(String routingKey, Event event) {
        JsonNode payload = objectMapper.valueToTree(event);
        outboxEventRepository.save(new OutboxEvent(routingKey, event.type(), event.organizationId(), event.userId(), payload));
    }
}
