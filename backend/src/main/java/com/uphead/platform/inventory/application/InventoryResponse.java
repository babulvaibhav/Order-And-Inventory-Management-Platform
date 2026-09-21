package com.uphead.platform.inventory.application;

import com.uphead.platform.inventory.domain.Inventory;

import java.time.LocalDateTime;
import java.util.UUID;

public record InventoryResponse(
    UUID id,
    UUID warehouseId,
    UUID productId,
    Integer availableQuantity,
    Integer reservedQuantity,
    Integer totalQuantity,
    Integer version,
    LocalDateTime updatedAt
) {
    public static InventoryResponse from(Inventory inventory) {
        return new InventoryResponse(
            inventory.getId(),
            inventory.getWarehouseId(),
            inventory.getProductId(),
            inventory.getAvailableQuantity(),
            inventory.getReservedQuantity(),
            inventory.getTotalQuantity(),
            inventory.getVersion(),
            inventory.getUpdatedAt()
        );
    }
}
