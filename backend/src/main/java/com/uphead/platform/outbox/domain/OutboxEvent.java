package com.uphead.platform.outbox.domain;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A domain event durably recorded in the same transaction as the business change it describes.
 * See {@code com.uphead.platform.outbox.application.OutboxEventPublisher} for how rows are
 * created, and {@code OutboxRelay} for how they're published to the message broker afterward.
 */
@Entity
@Table(name = "outbox_events")
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "routing_key", nullable = false)
    private String routingKey;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "user_id")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(nullable = false)
    private Integer attempts = 0;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    public enum Status {
        PENDING,
        PUBLISHED,
        FAILED
    }

    public OutboxEvent() {
        this.createdAt = LocalDateTime.now();
    }

    public OutboxEvent(String routingKey, String eventType, UUID organizationId, UUID userId, JsonNode payload) {
        this.routingKey = routingKey;
        this.eventType = eventType;
        this.organizationId = organizationId;
        this.userId = userId;
        this.payload = payload;
        this.createdAt = LocalDateTime.now();
    }

    public void markPublished() {
        this.status = Status.PUBLISHED;
        this.publishedAt = LocalDateTime.now();
    }

    /** After this many failed attempts the relay gives up and marks the row FAILED for manual triage. */
    public static final int MAX_ATTEMPTS = 10;

    public void recordFailure(String error) {
        this.attempts = this.attempts + 1;
        this.lastError = error;
        if (this.attempts >= MAX_ATTEMPTS) {
            this.status = Status.FAILED;
        }
    }

    public UUID getId() {
        return id;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public String getEventType() {
        return eventType;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public Status getStatus() {
        return status;
    }

    public Integer getAttempts() {
        return attempts;
    }

    public String getLastError() {
        return lastError;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }
}
