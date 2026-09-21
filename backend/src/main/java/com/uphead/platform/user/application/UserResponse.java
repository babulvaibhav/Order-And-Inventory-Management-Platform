package com.uphead.platform.user.application;

import com.uphead.platform.user.domain.User;
import java.time.LocalDateTime;
import java.util.UUID;

public record UserResponse(
    UUID id,
    UUID organizationId,
    String email,
    String name,
    UUID roleId,
    String roleName,
    Boolean active,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static UserResponse from(User user, String roleName) {
        return new UserResponse(
            user.getId(),
            user.getOrganizationId(),
            user.getEmail(),
            user.getName(),
            user.getRoleId(),
            roleName,
            user.getActive(),
            user.getCreatedAt(),
            user.getUpdatedAt()
        );
    }
}
