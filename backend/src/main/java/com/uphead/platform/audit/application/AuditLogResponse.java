package com.uphead.platform.audit.application;

import com.uphead.platform.audit.domain.AuditLog;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID userId,
    String action,
    String entity,
    UUID entityId,
    String oldValue,
    String newValue,
    LocalDateTime timestamp,
    LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog auditLog) {
        return new AuditLogResponse(
            auditLog.getId(),
            auditLog.getUserId(),
            auditLog.getAction(),
            auditLog.getEntity(),
            auditLog.getEntityId(),
            auditLog.getOldValue() != null ? auditLog.getOldValue().toString() : null,
            auditLog.getNewValue() != null ? auditLog.getNewValue().toString() : null,
            auditLog.getTimestamp(),
            auditLog.getCreatedAt()
        );
    }
}
