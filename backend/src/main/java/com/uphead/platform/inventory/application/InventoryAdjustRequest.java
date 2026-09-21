package com.uphead.platform.inventory.application;

import jakarta.validation.constraints.*;

import java.util.UUID;

public record InventoryAdjustRequest(
    @NotNull(message = "Inventory ID is required")
    UUID inventoryId,
    
    @NotNull(message = "Quantity is required")
    @Min(value = -10000, message = "Quantity adjustment must be between -10000 and 10000")
    @Max(value = 10000, message = "Quantity adjustment must be between -10000 and 10000")
    Integer quantity,
    
    @Size(max = 500, message = "Reason must not exceed 500 characters")
    String reason
) {
}
