package com.uphead.platform.notification.application.port;

import com.uphead.platform.notification.application.Event;

public interface EventPublisher {
    void publishEvent(String routingKey, Event event);
}
