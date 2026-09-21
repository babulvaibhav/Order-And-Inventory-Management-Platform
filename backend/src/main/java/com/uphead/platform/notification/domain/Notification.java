package com.uphead.platform.notification.domain;

import jakarta.persistence.*;
import com.uphead.platform.common.util.Auditable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notifications_organization_id", columnList = "organization_id"),
    @Index(name = "idx_notifications_user_id", columnList = "organization_id, user_id"),
    @Index(name = "idx_notifications_read", columnList = "organization_id, read")
})
public class Notification extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID organizationId;

    /** Null means an organization-wide notification, not addressed to one specific user. */
    @Column
    private UUID userId;

    @Column(nullable = false)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String message;

    // @JdbcTypeCode(JSON) is required for Postgres to accept a plain String parameter into a
    // jsonb column (without it: "column is of type jsonb but expression is of type character
    // varying") — same pattern AuditLog already uses for its JsonNode columns.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;

    @Column(nullable = false)
    private Boolean read = false;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public Notification() {
        this.timestamp = LocalDateTime.now();
    }

    public Notification(UUID organizationId, UUID userId, String type, String message, String metadata) {
        this.organizationId = organizationId;
        this.userId = userId;
        this.type = type;
        this.message = message;
        this.metadata = metadata;
        this.timestamp = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Boolean getRead() {
        return read;
    }

    public void setRead(Boolean read) {
        this.read = read;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
