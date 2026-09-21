package com.uphead.platform.order.application;

import jakarta.validation.constraints.*;
import java.util.UUID;

/**
 * unitPrice is deliberately not part of the request: trusting a client-supplied price let a
 * caller set an arbitrary order total. The price is looked up server-side from Product.price.
 */
public record OrderItemRequest(
    @NotNull(message = "Product ID is required")
    UUID productId,

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    Integer quantity,

    @NotNull(message = "Warehouse ID is required")
    UUID warehouseId
) {
}
