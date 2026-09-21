package com.uphead.platform.warehouse.application;

import com.uphead.platform.warehouse.domain.Warehouse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WarehouseRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must not exceed 200 characters")
    String name,
    
    @Size(max = 500, message = "Address must not exceed 500 characters")
    String address,
    
    Warehouse.Status status
) {
}
