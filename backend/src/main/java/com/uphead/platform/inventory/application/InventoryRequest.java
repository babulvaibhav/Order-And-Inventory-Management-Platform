package com.uphead.platform.inventory.application;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record InventoryRequest(
    @NotNull(message = "Warehouse ID is required")
    UUID warehouseId,
    
    @NotNull(message = "Product ID is required")
    UUID productId,
    
    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    Integer quantity
) {
}
