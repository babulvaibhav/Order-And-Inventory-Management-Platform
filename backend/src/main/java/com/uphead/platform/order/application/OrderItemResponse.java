package com.uphead.platform.order.application;

import com.uphead.platform.order.domain.OrderItem;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(
    UUID id,
    UUID productId,
    Integer quantity,
    BigDecimal unitPrice,
    BigDecimal totalPrice,
    UUID warehouseId
) {
    public static OrderItemResponse from(OrderItem orderItem) {
        return new OrderItemResponse(
            orderItem.getId(),
            orderItem.getProductId(),
            orderItem.getQuantity(),
            orderItem.getUnitPrice(),
            orderItem.getTotalPrice(),
            orderItem.getWarehouseId()
        );
    }
}
