# Backend

Spring Boot 3.2, Java 21. This is the part of the system that actually enforces tenant isolation, prevents overselling, and resolves permissions — everything the frontend does is really just a client of what's documented here and in the root-level docs.

For the full picture, the root of the repo has dedicated docs rather than everything crammed into this file: `../ARCHITECTURE.md` for how it's put together and why, `../API.md` for the endpoints, `../DATABASE.md` for the schema, `../SECURITY.md` for auth and authorization. This README is just the backend-specific practical stuff.

## Stack

Spring Web, Spring Security, Spring Data JPA, PostgreSQL, Redis, RabbitMQ, Flyway for migrations, JWT signed with RS256 (via `jjwt` + BouncyCastle for the RSA keypair), SpringDoc for the OpenAPI/Swagger docs, Testcontainers for the integration tests.

## Package layout

```
com.uphead.platform
├── auth/           login, refresh, logout
├── organization/   platform-owner-only tenant management
├── role/           dynamic roles & permissions
├── user/           user accounts
├── product/        product catalog
├── warehouse/
├── customer/
├── inventory/      the concurrency-sensitive core
├── order/
├── notification/   SSE push + the ports (EventPublisher, MessageBrokerPort, NotificationPushPort)
├── outbox/         transactional outbox — see docs/DESIGN_PATTERNS.md
├── audit/
├── dashboard/
└── common/         config, exceptions, security, tenant context, shared utilities
```

Each domain package follows the same internal shape — `api` for controllers, `application` for services and DTOs, `domain` for entities, `infrastructure` for repositories. A module calls another module's service when it needs something from it; it never reaches into another module's repository or entity directly. That's the boundary `ARCHITECTURE.md` talks about as the seam that would become a network call if this ever needed to split into separate services.

## Running it

```bash
mvn spring-boot:run
```

Needs Postgres, Redis, and RabbitMQ reachable — the easiest way to get those without installing anything is `docker compose up postgres redis rabbitmq` from the repo root. Full instructions, including the Docker-only path, are in `../SETUP.md`.

On first boot it generates an RSA keypair into `keys/` (gitignored), runs the Flyway migrations, and seeds a demo organization with an admin user plus a platform-owner account.

## Tests

```bash
mvn test
```

or just the concurrency test on its own:

```bash
mvn test -Dtest=ConcurrentInventoryReservationTest
```

That one's the important one — it hammers ten units of stock with a hundred concurrent reservation requests and checks that no more than ten succeed. Both test classes spin up their own Testcontainers Postgres instance, so neither one touches whatever database your `application.yml` happens to be pointed at.

## API docs

Swagger UI: `http://localhost:8080/api/swagger-ui.html`. Raw OpenAPI JSON: `http://localhost:8080/api/api-docs`. A written-out tour of the endpoints, with the reasoning behind the trickier ones, is in `../API.md`.

## Environment variables

Everything has a sane local default, so you usually don't need to set any of these unless you're pointing at infrastructure that isn't on its default port. See `.env.example` for the full list with placeholder values — the short version:

| Variable | What it's for |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Postgres connection |
| `REDIS_HOST`, `REDIS_PORT` | Redis, used for the permission and dashboard caches |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` | the event broker |
| `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | token lifetimes, in milliseconds |
| `JWT_KEYSTORE_PATH`, `JWT_KEY_PASSPHRASE` | where the RSA signing key lives and how it's encrypted at rest |
| `CORS_ALLOWED_ORIGINS` | comma-separated allowed frontend origins |

One thing worth flagging honestly: the defaults for all of these (including the JWT passphrase) are placeholder values meant for local development, not something to run with unchanged anywhere that matters. `../KNOWN_LIMITATIONS.md` says more about this.

## A couple of things worth knowing about the domain model

**Users aren't customers.** A user is someone who logs in and does work — an admin, a manager, warehouse staff, the platform owner. A customer is who an order gets placed for, and doesn't log in at all; only their name is required, since this is modeled closer to a supermarket checkout than a full customer account system. They're deliberately kept as separate concepts throughout the codebase rather than two flavors of the same table.

**Roles are database rows, not an enum.** Every organization starts with Admin, Manager, and Staff — matching what the assignment describes for each — but every permission on every one of them is editable, and an organization can create as many custom roles as it wants beyond those three. `../SECURITY.md` and `../ARCHITECTURE.md` both go into why this ended up mattering more than it might first look like it should (short version: it's what makes a permission change or a role reassignment take effect immediately instead of waiting for the next login).

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin, seeded "Uphead Consulting Firm" organization | `admin@uphead.com` | `adminPassword` |
| Platform owner | `owner@uphead.com` | `ownerPassword` |
