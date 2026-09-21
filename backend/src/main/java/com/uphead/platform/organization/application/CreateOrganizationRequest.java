package com.uphead.platform.organization.application;

import jakarta.validation.constraints.*;

public record CreateOrganizationRequest(
    @NotBlank(message = "Organization name is required")
    @Size(max = 255, message = "Organization name must not exceed 255 characters")
    String organizationName,

    @NotBlank(message = "Admin name is required")
    @Size(max = 200, message = "Admin name must not exceed 200 characters")
    String adminName,

    @NotBlank(message = "Admin email is required")
    @Email(message = "Admin email must be valid")
    String adminEmail,

    @NotBlank(message = "Admin password is required")
    @Size(min = 8, message = "Admin password must be at least 8 characters")
    String adminPassword
) {
}
