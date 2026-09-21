package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;

/**
 * Builds the human-readable message for one event type. Adding a new event type (e.g.
 * ORDER_COMPLETED) means adding one new {@code @Component}, not touching a switch statement in
 * NotificationConsumer — the consumer just asks whichever strategy declares that eventType().
 */
public interface NotificationMessageStrategy {
    String eventType();

    String buildMessage(Event event);
}
