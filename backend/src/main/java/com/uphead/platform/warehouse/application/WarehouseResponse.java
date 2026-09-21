package com.uphead.platform.warehouse.application;

import com.uphead.platform.warehouse.domain.Warehouse;

import java.time.LocalDateTime;
import java.util.UUID;

public record WarehouseResponse(
    UUID id,
    String name,
    String address,
    Warehouse.Status status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static WarehouseResponse from(Warehouse warehouse) {
        return new WarehouseResponse(
            warehouse.getId(),
            warehouse.getName(),
            warehouse.getAddress(),
            warehouse.getStatus(),
            warehouse.getCreatedAt(),
            warehouse.getUpdatedAt()
        );
    }
}
