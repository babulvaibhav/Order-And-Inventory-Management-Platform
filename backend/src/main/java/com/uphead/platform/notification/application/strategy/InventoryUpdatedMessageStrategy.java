package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;
import org.springframework.stereotype.Component;

@Component
public class InventoryUpdatedMessageStrategy implements NotificationMessageStrategy {

    @Override
    public String eventType() {
        return "INVENTORY_UPDATED";
    }

    @Override
    public String buildMessage(Event event) {
        String available = EventPayload.field(event, "availableQuantity");
        return "Inventory updated: " + available + " now available";
    }
}
