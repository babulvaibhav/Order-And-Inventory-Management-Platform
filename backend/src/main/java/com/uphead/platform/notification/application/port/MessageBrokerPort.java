package com.uphead.platform.notification.application.port;

import com.uphead.platform.notification.application.Event;

/**
 * Outbound port to the message broker. The only adapter today is RabbitMqBrokerAdapter
 * (infrastructure/RabbitMqBrokerAdapter); swapping RabbitMQ for Kafka/SQS at scale means writing a
 * new adapter here — no change to OutboxRelay, the only caller.
 */
public interface MessageBrokerPort {
    void send(String routingKey, Event event);
}
