package com.uphead.platform.auth.application;

import java.util.Set;
import java.util.UUID;

public record LoginResponse(
    UUID userId,
    String email,
    String name,
    UUID roleId,
    /** Free-form display name — roles are dynamic per organization, no longer a fixed enum. */
    String roleName,
    boolean isPlatformOwner,
    /** Null for the platform-owner role. */
    UUID organizationId,
    /**
     * Snapshot of the role's permissions at login/refresh time, for the frontend's UX-gating only.
     * The backend re-resolves permissions from the database on every request regardless of this value.
     */
    Set<String> permissions,
    String accessToken,
    String refreshToken
) {
}
