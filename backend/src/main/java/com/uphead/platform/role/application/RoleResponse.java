package com.uphead.platform.role.application;

import com.uphead.platform.role.domain.Role;
import java.util.List;
import java.util.UUID;

public record RoleResponse(
    UUID id,
    String name,
    boolean isSystem,
    List<PermissionResponse> permissions
) {
    public static RoleResponse from(Role role) {
        List<PermissionResponse> permissions = role.getPermissions().stream()
            .map(PermissionResponse::from)
            .sorted((a, b) -> a.code().compareTo(b.code()))
            .toList();
        return new RoleResponse(role.getId(), role.getName(), role.isSystem(), permissions);
    }
}
