package com.uphead.platform.organization.application;

import com.uphead.platform.organization.domain.Organization;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateOrganizationRequest(
    @NotBlank(message = "Organization name is required")
    @Size(max = 255, message = "Organization name must not exceed 255 characters")
    String name,

    @NotNull(message = "Status is required")
    Organization.Status status
) {
}
