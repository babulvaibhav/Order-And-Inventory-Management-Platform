-- Transactional outbox: OutboxEventPublisher writes a row here in the same transaction as the
-- business change it accompanies, so an event is durably recorded if and only if that change
-- committed. A separate scheduled relay (OutboxRelay) reads PENDING rows and publishes them to
-- RabbitMQ, decoupling "the order was created" from "RabbitMQ was reachable at that instant".
CREATE TABLE outbox_events (
    id              UUID          PRIMARY KEY,
    routing_key     VARCHAR(100)  NOT NULL,
    event_type      VARCHAR(50)   NOT NULL,
    organization_id UUID,
    user_id         UUID,
    payload         JSONB         NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER       NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMP     NOT NULL,
    published_at    TIMESTAMP
);

-- The relay's "give me the next unpublished batch" query filters and orders on exactly these columns.
CREATE INDEX idx_outbox_events_status_created_at ON outbox_events(status, created_at);
