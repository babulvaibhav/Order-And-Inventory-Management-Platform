package com.uphead.platform.order.application;

import com.uphead.platform.order.domain.Order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
    UUID id,
    UUID customerId,
    Order.Status status,
    BigDecimal totalAmount,
    String notes,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<OrderItemResponse> items
) {
    public static OrderResponse from(Order order) {
        List<OrderItemResponse> itemResponses = order.getItems().stream()
            .map(OrderItemResponse::from)
            .toList();
        
        return new OrderResponse(
            order.getId(),
            order.getCustomerId(),
            order.getStatus(),
            order.getTotalAmount(),
            order.getNotes(),
            order.getCreatedAt(),
            order.getUpdatedAt(),
            itemResponses
        );
    }
}
