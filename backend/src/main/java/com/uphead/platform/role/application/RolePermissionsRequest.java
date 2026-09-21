package com.uphead.platform.role.application;

import jakarta.validation.constraints.NotNull;
import java.util.Set;
import java.util.UUID;

public record RolePermissionsRequest(
    @NotNull(message = "Permission IDs are required")
    Set<UUID> permissionIds
) {
}
