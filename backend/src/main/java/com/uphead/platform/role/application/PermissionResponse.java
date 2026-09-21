package com.uphead.platform.role.application;

import com.uphead.platform.role.domain.Permission;
import java.util.UUID;

public record PermissionResponse(
    UUID id,
    String code,
    String description,
    String category
) {
    public static PermissionResponse from(Permission permission) {
        return new PermissionResponse(permission.getId(), permission.getCode(), permission.getDescription(), permission.getCategory());
    }
}
