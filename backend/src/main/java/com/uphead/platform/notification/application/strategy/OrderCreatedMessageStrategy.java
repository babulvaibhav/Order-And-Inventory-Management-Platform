package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;
import org.springframework.stereotype.Component;

@Component
public class OrderCreatedMessageStrategy implements NotificationMessageStrategy {

    @Override
    public String eventType() {
        return "ORDER_CREATED";
    }

    @Override
    public String buildMessage(Event event) {
        String total = EventPayload.field(event, "totalAmount");
        return "New order created (total: " + total + ")";
    }
}
