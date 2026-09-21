package com.uphead.platform.notification.application.strategy;

import com.uphead.platform.notification.application.Event;
import org.springframework.stereotype.Component;

@Component
public class InventoryTransferCompletedMessageStrategy implements NotificationMessageStrategy {

    @Override
    public String eventType() {
        return "INVENTORY_TRANSFER_COMPLETED";
    }

    @Override
    public String buildMessage(Event event) {
        String quantity = EventPayload.field(event, "quantity");
        return "Transferred " + quantity + " unit(s) between warehouses";
    }
}
