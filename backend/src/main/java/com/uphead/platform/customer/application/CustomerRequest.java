package com.uphead.platform.customer.application;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record CustomerRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must not exceed 200 characters")
    String name,

    @Email(message = "Email must be valid")
    String email,

    @Size(max = 20, message = "Phone must not exceed 20 characters")
    String phone,

    @Size(max = 500, message = "Address must not exceed 500 characters")
    String address
) {
}
