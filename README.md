# Order and Inventory Management Platform

A multi-tenant order and inventory system — Spring Boot on the backend, React on the frontend. Multiple organizations share one deployment, each one's data kept strictly separate from the others, with inventory that can't be oversold even when a hundred requests hit the same product at once.

Built against a fairly detailed assignment brief (see `AGENTS.md`) that treats this as a production-style engineering exercise rather than a CRUD demo — tenant isolation, concurrency correctness, and real authorization were graded criteria, not nice-to-haves, and that's reflected in where the effort actually went.

## What's here

- **Multi-tenancy** — every organization's products, warehouses, orders, and users are isolated from every other organization's, enforced query-by-query rather than assumed.
- **Dynamic roles** — Admin, Manager, and Staff are seeded for every organization, but none of them are hardcoded: permissions on any role are editable, and organizations can create their own custom roles too.
- **A platform-owner layer above all of that** — a role with no organization of its own, which creates and suspends tenant organizations and can add or fix a user in any of them.
- **Inventory that can't be oversold** — reservations, releases, and adjustments all go through atomic conditional database updates rather than a read-then-write, which is what actually stops two concurrent requests from both grabbing the same last unit of stock.
- **Orders that reserve stock, and can be cancelled or completed** — with the reservation correctly returned to available stock on cancellation, and correctly consumed for good on completion.
- **Events and live notifications** — order and inventory changes go through RabbitMQ behind a transactional outbox, out to the browser over Server-Sent Events.

## Layout

```
Order And Inventory Management Platform/
├── backend/              Spring Boot app — see backend/README.md
├── frontend/             React admin console — see frontend/README.md
├── docs/
│   ├── DESIGN_PATTERNS.md
│   └── adr/              Architecture decision records
├── archive/              Old planning docs, kept locally, not part of the repo (see .gitignore)
├── docker-compose.yml
└── AGENTS.md             The assignment brief this was built against
```

## Getting it running

```bash
docker compose up --build
```

Frontend at http://localhost:3000, backend at http://localhost:8080/api, Swagger at http://localhost:8080/api/swagger-ui.html. First boot takes a little while — Postgres has to initialize and the backend runs its migrations before anything's ready.

Full setup instructions, including running the backend and frontend natively instead of through Docker, are in `SETUP.md`.

## Logging in

Two accounts get seeded on first boot:

| Role | Email | Password |
|---|---|---|
| Admin of the demo organization | `admin@uphead.com` | `adminPassword` |
| Platform owner (creates/manages organizations) | `owner@uphead.com` | `ownerPassword` |

Change or remove both before this runs anywhere that isn't a local demo.

## Documentation

The docs are split by what question they answer, rather than crammed into one file:

- `ARCHITECTURE.md` — why it's built the way it is, and how a request actually flows through it
- `DATABASE.md` — the schema, the ER diagram, and what the constraints are actually protecting against
- `API.md` — the REST endpoints, grouped by resource, with the conventions that apply across all of them
- `SECURITY.md` — auth, authorization, tenant isolation, and what's deliberately not done yet
- `SETUP.md` — running this locally, with Docker or without
- `SCALABILITY.md` — how this would grow past its current scale, and what would need to change first
- `KNOWN_LIMITATIONS.md` — a genuinely honest list of what's rough, missing, or deferred, and why
- `docs/adr/` — the handful of decisions worth writing down the reasoning for
- `docs/DESIGN_PATTERNS.md` — a few design patterns worth knowing about if this needs to grow

Read `KNOWN_LIMITATIONS.md` before assuming anything here is production-ready. Most of it is solid; a few things are explicitly not, and it says exactly which.

## Tech stack

Java 21, Spring Boot 3.2, PostgreSQL, Redis, RabbitMQ, Flyway for migrations, JWT (RS256) for auth — backend side. React 19, TypeScript, Vite, Tailwind v4 with shadcn/ui, TanStack Query for server state — frontend side.

## Tests

```bash
cd backend
mvn test
```

The one that matters most is `ConcurrentInventoryReservationTest` — 100 concurrent requests against 10 units of stock, checking that no more than 10 succeed and the inventory row never goes negative. Both test classes run against a disposable Testcontainers Postgres instance, so this is safe to run without worrying about touching real data.

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the same build/test/lint steps on every push — see `KNOWN_LIMITATIONS.md` for its current status.

## License

Apache 2.0
