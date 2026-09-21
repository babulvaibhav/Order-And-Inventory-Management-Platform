# ADR-001: Modular monolith, not microservices

## Decision

Building one deployable Spring Boot application, organized into modules by domain (`product`, `order`, `inventory`, `user`, `role`, `organization`, `audit`, `notification`, `outbox`) with a consistent internal layering (`api` / `application` / `domain` / `infrastructure`) inside each. Modules call each other's service layer, never each other's repositories or entities directly.

## Consequences

Deployment is one artifact, one process, one database connection pool to reason about — genuinely simpler to run, test, and debug than a distributed equivalent would be at this scale. Transactions that span what would be several services in a microservices split (reserve inventory, create an order, write an audit entry) are just a normal database transaction here, with no need for sagas or distributed transaction coordination.

The trade-off is: if this system needed to scale one module independently of the others, or needed different teams to deploy without touching each other's code, the modular boundaries would need to become network/event boundaries, and that's genuine work — not free, but also not starting from nothing, since the service-layer discipline already in place is exactly what would need to exist on either side of that split anyway.
