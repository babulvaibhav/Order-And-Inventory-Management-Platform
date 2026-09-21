package com.uphead.platform.order.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record OrderRequest(
    @NotNull(message = "Customer ID is required")
    UUID customerId,
    
    @NotEmpty(message = "Order items are required")
    @Valid
    List<OrderItemRequest> items,
    
    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    String notes
) {
}
