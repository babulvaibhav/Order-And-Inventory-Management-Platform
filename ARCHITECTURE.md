# Architecture

## Why a modular monolith

The brief for this project explicitly steers away from microservices unless a requirement actually forces the issue, and nothing here does. A single order-and-inventory system for a handful of tenants doesn't need independent deployability, independent scaling per module, or the operational overhead that comes with a distributed system — service discovery, network calls where a method call used to be, distributed transactions, the works. What it does need is clear boundaries between the things that change for different reasons: inventory logic shouldn't leak into the order controller, and the notification pipeline shouldn't know anything about how orders are priced.

So it's one deployable Spring Boot application, but the package structure enforces the same discipline a microservices split would: `product`, `warehouse`, `customer`, `inventory`, `order`, `user`, `role`, `organization`, `audit`, `notification`, and `outbox` are separate top-level packages, each with its own `api` (controllers), `application` (services and DTOs), `domain` (entities), and `infrastructure` (repositories) layers. A module reaches into another module's service layer when it needs to, never its repository directly — `OrderService` calls `InventoryService.reserveInventory(...)`, it doesn't run its own query against the `inventory` table. That's the boundary that would become a network call if this ever did need to split apart, and keeping it disciplined now is what would make that split tractable later instead of a rewrite.

```
React Frontend
      |
      | HTTPS / REST + SSE
      v
Spring Boot Modular Monolith
      |
      +-- auth            (login, tokens)
      +-- organization     (platform owner's tenant management)
      +-- user / role      (dynamic RBAC)
      +-- product / warehouse / customer
      +-- inventory        (the concurrency-sensitive core)
      +-- order             (ties inventory + customer + audit together)
      +-- audit
      +-- notification      (SSE push)
      +-- outbox            (reliable event publishing)
      |
      +------ PostgreSQL
      +------ Redis
      +------ RabbitMQ
                 |
                 +-- notification consumer --> SSE --> browser
```

## A request, start to finish

Take `POST /v1/orders` as the example, since it touches the most parts of the system:

1. The JWT filter reads the bearer token, validates its signature and expiry, and — this part matters — looks up the caller's *current* permissions from the database using the role ID in the token, rather than trusting a permission list baked into the token itself. It also checks the caller's organization is still active. Either check failing means the request never reaches a controller.
2. Spring Security's `@PreAuthorize("hasAuthority('order.create')")` on the controller method gates entry.
3. The service validates the customer exists (in this organization), looks up each product server-side (also in this organization — client-supplied prices are never trusted), and rejects the whole request up front if a product is disabled.
4. Inventory gets reserved for each line item, one atomic conditional `UPDATE` per row, sorted into a deterministic order first (more on why below).
5. If every reservation succeeds, the order and its line items are written, and an audit log entry is created — all in the same database transaction as the reservations, so a crash partway through leaves nothing half-committed.
6. Once that transaction commits, an `ORDER_CREATED` event is durably recorded (the outbox — see below) and a background relay picks it up and publishes it to RabbitMQ.
7. The notification consumer turns that event into a saved notification and pushes it down any open SSE connection for that organization.

If step 4 fails for any line item, the whole thing rolls back — there's no such thing as a partially-reserved order.

## Tenant isolation

Covered in more depth in `SECURITY.md`, but the short version: `organization_id` on every tenant table, every repository method that looks one of those rows up takes the organization ID as an explicit parameter, and that ID always comes from the authenticated token via `TenantContextHolder`, never from the request body. The platform owner is the one role that legitimately reaches across tenants, and its endpoints are gated on permissions instead of tenant scoping for exactly that reason.

## Authentication and authorization

Login issues a short-lived signed access token and a longer-lived opaque refresh token. The interesting decision here — and the one that shapes a lot of the rest of the backend — is that the access token carries *identity* (who you are, which organization, which role) but not *permissions*. Permissions are resolved from the database on every request instead, cached briefly per role in Redis. The direct payoff: editing a role's permission set, moving a user to a different role, or suspending an organization all take effect on that user's very next API call, not their next login. A more conventional "bake the permissions into the JWT" approach would make all three of those either impossible without forcing a re-login, or would need a token-blacklist mechanism bolted on to fake the same effect — this way the JWT itself just doesn't need to know something that goes stale.

Roles and permissions are rows in the database (`roles`, `permissions`, `role_permissions`), not a Java enum. Every organization is seeded with Admin, Manager, and Staff, matching what the spec describes for each — Admin gets full access, Manager gets products/inventory/orders, Staff gets read access plus the ability to create and progress orders. Those three can't be renamed or deleted, but every permission on them is editable, and an organization can create as many custom roles as it wants on top. This went further than the original "three fixed roles" framing because it turned out to be barely more work than hardcoding them, and it's a meaningfully more useful feature for anyone actually running this.

## Keeping inventory honest under concurrency

This is the part of the assignment that's explicitly called out as a first-class evaluation criterion, so it's worth being precise about what actually prevents overselling.

The naive approach — read the current quantity, check if it's enough, write the new quantity — has a race condition baked into it. Two requests can both read "5 available" before either one writes anything back, both decide there's enough, and both proceed, leaving inventory negative or double-booked. Adding an `if` check in application code doesn't fix this; the check and the write aren't atomic relative to each other.

What actually works is pushing the check into the same atomic operation as the write:

```sql
UPDATE inventory
SET available_quantity = available_quantity - :quantity,
    reserved_quantity = reserved_quantity + :quantity
WHERE id = :id
  AND organization_id = :organizationId
  AND available_quantity >= :quantity;
```

The database only applies this update if the row still has enough stock *at the moment the update runs*, and it does that check-and-write as a single indivisible operation under the row's lock. Two concurrent requests for the last unit of stock will both attempt this update; exactly one of them will affect a row (the one that gets there first, whichever that turns out to be), and the other will affect zero rows. The application code just checks the affected-row count — one means success, zero means `INSUFFICIENT_INVENTORY` — and never needs to think about the race directly, because the database already resolved it.

This same pattern shows up everywhere something needs to change conditionally under concurrency: releasing a reservation only succeeds if there's enough reserved stock to release, an order's status only transitions if it's still in the status the caller expected. That last one is worth a specific example, because it's a subtler version of the same problem: two requests to cancel the same order at the same time could both pass a "is this order currently cancellable?" check and both run the cancellation logic, releasing the same stock twice. The fix is identical in shape — `UPDATE orders SET status = :new WHERE id = :id AND status = :expected` — and the side effect (releasing inventory) only runs if that update actually changed a row.

When an order has multiple line items, each reservation is a separate atomic update against a separate inventory row, done one after another inside the order's transaction. Locking multiple rows in an unpredictable order is a classic way to deadlock against another transaction doing the same thing in reverse, so the rows get sorted into a consistent order (by inventory row ID) before anything is locked — every transaction that touches rows A and B locks them in the same order, so they can't deadlock against each other waiting for the other one to release. The same idea applies to transferring stock between two warehouses, which touches two rows at once.

## Orders and their transaction boundary

An order's creation — validate, reserve every line item, write the order and its items, write the audit entry — happens inside one database transaction. Business consistency comes first: if any part of this fails, none of it is kept. Publishing the resulting event to RabbitMQ deliberately happens *after* that transaction commits, not inside it, for a related but distinct reason — see the outbox section below.

## Event-driven notifications

RabbitMQ carries five event types — order created, order cancelled, inventory updated, inventory running low, and a transfer completing — from a single topic exchange to a single queue, consumed by one notification consumer. This is intentionally about as simple as an event bus gets; there was no reason to reach for multiple exchanges, dead-letter routing, or a fan-out to several queues when the whole system currently has one consumer.

The one piece of real engineering here is how events get from the business transaction to the broker without either losing them or publishing something that turns out to have been rolled back. Publishing directly inside the transaction (call RabbitMQ, then commit) has a failure mode in both directions: publish, then the transaction rolls back, and now a notification exists for something that never happened; or the transaction commits fine but the broker happens to be down at that exact moment, and the event is just gone. Neither is acceptable for something that's supposed to represent "this actually happened."

The fix is a transactional outbox: instead of calling RabbitMQ directly, the event gets written as a row in an `outbox_events` table, in the *same* transaction as the business change. That write either commits with everything else or rolls back with everything else — there's no window where they can disagree. A separate scheduled job, running every second, picks up pending rows (`SELECT ... FOR UPDATE SKIP LOCKED`, so multiple backend instances could run this same job without double-publishing) and actually sends them to RabbitMQ, retrying on failure instead of losing the event. The messaging code itself sits behind small interfaces (`EventPublisher`, `MessageBrokerPort`, `NotificationPushPort`) rather than being called directly, mostly so that swapping RabbitMQ for something else later — or fanning notifications out over WebSockets instead of SSE — is a new implementation of an existing interface, not a rewrite of the business logic that publishes events. `docs/DESIGN_PATTERNS.md` goes into this in more depth if you want the full reasoning.

## Real-time notifications over SSE

Server-Sent Events rather than WebSockets, mainly because the traffic here is one-directional — the server tells the browser things happened, the browser never needs to talk back over the same connection — and SSE is the simpler tool for that job, with automatic reconnection built into the browser's `EventSource` API. The one wrinkle: native `EventSource` can't send custom headers, and this API is bearer-token authenticated, so the frontend uses a small polyfill library that can attach the `Authorization` header to the request instead of relying on cookies.

Opening a connection replays whatever's unread for that organization, then a 25-second heartbeat keeps the connection alive through proxies that would otherwise time out an idle socket. The registry mapping organizations to open connections lives in memory on whichever backend instance holds them, which is fine for one instance and becomes a real limitation the moment there's more than one — a client connected to instance B won't see an event that only reached instance A. That's a known, documented gap rather than something silently ignored; fixing it properly means moving connection state into something shared, like Redis pub/sub, which is exactly the kind of adapter swap the port/interface split above was meant to make possible.

## Redis

Two things live in Redis, both as short-TTL caches rather than anything that needs to survive a restart: a role's resolved permission set (so the per-request permission lookup described above isn't hitting Postgres on every single call), and the dashboard summary per organization. Both are evicted explicitly the moment something changes that would make them stale — a role edit, an order being created, an inventory adjustment — rather than relying purely on the 60-second TTL to eventually catch up. The eviction itself is deliberately deferred until after the triggering transaction commits, not run in the middle of it, because evicting early leaves a window where a concurrent read could repopulate the cache with the value that's about to become wrong.

## What happens when something's down

- **Postgres unreachable**: nothing works, and it fails loudly — every request needs the database. This is the correct failure mode for a system where the database is the source of truth.
- **Redis unreachable**: permission lookups and dashboard summaries would fail along with it today, since there's no fallback path coded in for a cache miss caused by the cache being unreachable rather than just empty. This is a real gap worth being aware of rather than something already handled gracefully.
- **RabbitMQ unreachable**: business operations are unaffected — an order still gets created, inventory still gets reserved, because none of that depends on the broker being up. The outbox relay just keeps retrying until RabbitMQ comes back, at which point everything that queued up gets delivered. Notifications are allowed to be late; orders are not allowed to be wrong.
- **A user's SSE connection drops**: the browser's `EventSource` reconnects automatically, and the reconnect replays whatever's still unread, so nothing is silently missed — just possibly delayed.

The guiding principle throughout is the one stated directly in the assignment brief: business consistency outranks notification availability, every time there's a conflict between the two.

## Where this would need to change to scale

`SCALABILITY.md` covers this in full; the short version is that the backend is already stateless (all real state lives in Postgres/Redis/RabbitMQ, not in memory on the instance — with the one specific exception of the SSE connection registry called out above), so horizontal scaling behind a load balancer is mostly straightforward once that one piece is addressed.
