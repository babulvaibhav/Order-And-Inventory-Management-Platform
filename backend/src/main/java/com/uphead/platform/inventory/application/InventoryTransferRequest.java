package com.uphead.platform.inventory.application;

import jakarta.validation.constraints.*;

import java.util.UUID;

public record InventoryTransferRequest(
    @NotNull(message = "Product ID is required")
    UUID productId,
    
    @NotNull(message = "Source Warehouse ID is required")
    UUID sourceWarehouseId,
    
    @NotNull(message = "Destination Warehouse ID is required")
    UUID destinationWarehouseId,
    
    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    Integer quantity
) {
}
