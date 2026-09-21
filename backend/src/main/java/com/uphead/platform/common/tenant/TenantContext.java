package com.uphead.platform.common.tenant;

import java.util.Set;
import java.util.UUID;

public record TenantContext(
    UUID userId,
    UUID organizationId,
    Set<String> permissions
) {
    public static TenantContext of(UUID userId, UUID organizationId, Set<String> permissions) {
        return new TenantContext(userId, organizationId, permissions);
    }
}
