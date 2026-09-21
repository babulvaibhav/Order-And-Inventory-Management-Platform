package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;
import org.springframework.stereotype.Component;

@Component
public class OrderCancelledMessageStrategy implements NotificationMessageStrategy {

    @Override
    public String eventType() {
        return "ORDER_CANCELLED";
    }

    @Override
    public String buildMessage(Event event) {
        return "Order " + EventPayload.field(event, "id") + " was cancelled";
    }
}
