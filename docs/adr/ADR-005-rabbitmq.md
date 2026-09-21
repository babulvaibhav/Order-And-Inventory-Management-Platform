# ADR-005: RabbitMQ behind a transactional outbox

## Status

Accepted

## Context

The assignment requires at least one genuinely asynchronous workflow, with RabbitMQ named as the expected broker, feeding a real-time notification pipeline over SSE. The part that needed real thought wasn't which broker to use — RabbitMQ is a fine, simple choice for one exchange and one consumer — it was how to get an event from "something happened in a database transaction" to "a message sat in a queue" without either publishing something that turns out to have been rolled back, or silently losing an event because the broker happened to be unreachable at that exact moment.

Publishing directly to RabbitMQ from inside the same transaction that made the business change has both failure modes at once: if the transaction later rolls back, a notification has already gone out for something that never actually happened; if the broker is down, either the whole business transaction fails along with it (coupling business logic to broker availability, which the assignment brief explicitly says shouldn't happen — business consistency has to outrank notification delivery) or the event is just dropped.

## Decision

Use a transactional outbox. Instead of calling RabbitMQ directly, a business transaction writes its event as a row in an `outbox_events` table, in the exact same transaction as the business change itself — so that write either commits or rolls back together with everything else, with no window where they could disagree. A separate scheduled job polls for pending rows once a second and actually publishes them, using `SELECT ... FOR UPDATE SKIP LOCKED` so that running more than one backend instance later wouldn't cause the same event to be published twice. If publishing fails, the row stays pending and gets retried on the next tick rather than being lost.

The messaging code sits behind small interfaces — an outbound `EventPublisher` port that the outbox implements, and a `MessageBrokerPort` that the actual RabbitMQ adapter implements — rather than services calling RabbitMQ's client library directly.

## Consequences

An order can be created, or fail and roll back, with complete confidence that a notification will exist if and only if the order actually exists — there's no longer a race between "the transaction commits" and "the event gets published" for anything to slip through. If RabbitMQ is unreachable, orders still get created normally; the outbox just accumulates pending rows and catches up once the broker comes back, which is exactly the "business consistency over notification availability" priority the brief calls for.

The cost is a small amount of latency (up to the one-second poll interval) between something happening and its notification actually reaching a client, plus one more table and one more scheduled job to reason about compared to publishing directly. Given that the alternative is either losing events or letting broker downtime take down order creation with it, that trade is an easy one to make. The port/adapter split adds a small amount of indirection today for a payoff that isn't fully realized yet — it's there because it makes swapping RabbitMQ for something else, or SSE for a different push mechanism, a new adapter rather than a rewrite, which matters more as this system's real-time requirements grow than it does right now.
