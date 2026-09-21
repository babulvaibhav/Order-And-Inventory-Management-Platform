package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;
import org.springframework.stereotype.Component;

@Component
public class InventoryLowMessageStrategy implements NotificationMessageStrategy {

    @Override
    public String eventType() {
        return "INVENTORY_LOW";
    }

    @Override
    public String buildMessage(Event event) {
        String remaining = EventPayload.field(event, "remainingQuantity");
        return "Inventory running low: " + remaining + " left";
    }
}
