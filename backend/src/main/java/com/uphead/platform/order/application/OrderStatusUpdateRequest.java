package com.uphead.platform.order.application;

import jakarta.validation.constraints.NotNull;
import com.uphead.platform.order.domain.Order;

public record OrderStatusUpdateRequest(
    @NotNull(message = "Status is required")
    Order.Status status
) {
}
