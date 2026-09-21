package com.uphead.platform.organization.application;

import com.uphead.platform.organization.domain.Organization;
import java.time.LocalDateTime;
import java.util.UUID;

public record OrganizationResponse(
    UUID id,
    String name,
    Organization.Status status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static OrganizationResponse from(Organization organization) {
        return new OrganizationResponse(
            organization.getId(),
            organization.getName(),
            organization.getStatus(),
            organization.getCreatedAt(),
            organization.getUpdatedAt()
        );
    }
}
