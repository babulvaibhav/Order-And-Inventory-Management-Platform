# Design Patterns

### 1. Hexagonal architecture (Ports & Adapters) for messaging and real-time push

**Where it lives.**
- `notification/application/port/EventPublisher.java` — outbound port for "a domain event
  happened." Implemented by `outbox/application/OutboxEventPublisher` (see below).
- `notification/application/port/MessageBrokerPort.java` — outbound port to the actual broker.
  Implemented by `notification/infrastructure/RabbitMqBrokerAdapter`. The only caller is
  `OutboxRelay`.
- `notification/application/port/NotificationPushPort.java` — outbound port to "push this
  persisted notification to whoever's listening." Implemented by
  `notification/infrastructure/sse/SseEmitterRegistry`. The only caller is `NotificationConsumer`.

**What it buys at scale.** `OrderService`/`InventoryService` depend only on `EventPublisher`; they
never import RabbitMQ or SSE types. Moving from RabbitMQ to Kafka or SQS, or from SSE to WebSocket
or a Redis pub/sub fan-out (needed once there's more than one backend instance — see
`KNOWN_LIMITATIONS.md`, "SSE registry is in-memory"), means writing one new adapter class and
wiring it in Spring config. No business service changes, and no test double changes beyond mocking
the port interface instead of a concrete class.

### 2. Transactional Outbox

**Problem.** Every publish call (`eventPublisher.publishEvent(...)`) ran inside the same
`@Transactional` business method, calling RabbitMQ directly. Two real bugs followed: an event could
be sent for a change that then rolled back (no compensating action existed), and if RabbitMQ was
unreachable the event was silently dropped (`System.err.println`, no retry).

**Where it lives.**
- `db/migration/V3__outbox_events.sql` — the `outbox_events` table (`routing_key`, `event_type`,
  `payload` JSONB, `status`, `attempts`, `last_error`).
- `outbox/domain/OutboxEvent.java` — the row, with `markPublished()`/`recordFailure()` behavior.
- `outbox/application/OutboxEventPublisher.java` — the `EventPublisher` adapter every service
  actually calls. It writes a row and returns; nothing about it can throw for a "broker down"
  reason, because it never talks to the broker. It's `@Transactional(propagation = MANDATORY)`
  specifically so a future call site that forgets `@Transactional` fails loudly instead of quietly
  reintroducing the phantom-event bug.
- `outbox/application/OutboxRelay.java` — a `@Scheduled(fixedDelay = 1000)` job that reads a batch
  of `PENDING` rows with `SELECT ... FOR UPDATE SKIP LOCKED`, sends each through
  `MessageBrokerPort`, and marks it published or bumps its attempt count. After
  `OutboxEvent.MAX_ATTEMPTS` (10) failed attempts a row is marked `FAILED` for manual triage instead
  of retrying forever.

**What it buys at scale.**
- **Correctness under rollback:** an event is durably recorded if and only if the business
  transaction that produced it committed — the outbox row is written in the same transaction.
- **Correctness under broker outages:** if RabbitMQ is down, orders/inventory changes still
  succeed; the outbox row just stays `PENDING` and the relay catches up once the broker returns.
  This is a direct instance of the assignment's own stated priority: business consistency over
  notification availability.
- **Horizontal scale for the relay itself:** `FOR UPDATE SKIP LOCKED` means running this relay on
  multiple backend replicas is safe out of the box — each instance grabs whatever isn't already
  locked by another instance's in-flight batch, with no coordinator needed.
- **A visible retry/backpressure story:** `attempts`/`last_error`/`FAILED` give an operator
  something to query and alert on, instead of a log line that scrolls away.

### 3. Strategy for notification messages

**Where it lives.**
- `notification/application/strategy/NotificationMessageStrategy.java` — `eventType()` +
  `buildMessage(Event)`.
- One `@Component` per event type: `OrderCreatedMessageStrategy`,
  `OrderCancelledMessageStrategy`, `InventoryLowMessageStrategy`, `InventoryUpdatedMessageStrategy`,
  `InventoryTransferCompletedMessageStrategy`.
- `NotificationConsumer` collects the injected `List<NotificationMessageStrategy>` into a
  `Map<eventType, strategy>` at construction time and looks up the right one per event, falling
  back to a generic message for anything unregistered.

**What it buys at scale.** Adding `ORDER_COMPLETED` or any future event type is a new file, not an
edit to existing, already-tested code — the Open/Closed principle applied to the one place in the
codebase that was guaranteed to grow. It's also the lowest-risk of the three changes here: it's a
pure refactor of message-building with no schema, transaction, or transport changes.

