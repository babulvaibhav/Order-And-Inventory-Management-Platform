# Setup

Two ways to run this: Docker Compose (least effort, closest to how it'd actually be deployed) or running the backend and frontend natively (better if you want breakpoints or fast reload while poking at the code). Both are documented below.

## Prerequisites

- Docker + Docker Compose, if you're going that route
- Java 21 and Maven 3.9+, if you're running the backend natively
- Node.js 20+ and npm, if you're running the frontend natively
- A PostgreSQL 16 instance, Redis, and RabbitMQ if you're not using Compose for those either

## Option 1: Docker Compose

From the repository root:

```bash
docker compose up --build
```

This brings up five containers: `postgres`, `redis`, `rabbitmq`, `backend`, and `frontend`. The backend waits on the other three being healthy before it starts, and the frontend waits on the backend. First boot takes a minute or so while Postgres initializes and the backend runs its Flyway migrations.

Once it's up:

| What | Where |
|---|---|
| App | http://localhost:3000 |
| Backend API | http://localhost:8080/api |
| Swagger UI | http://localhost:8080/api/swagger-ui.html |
| RabbitMQ management console | http://localhost:15672 (guest/guest) |

Log in with the seeded admin (`admin@uphead.com` — see the root README for the password) or the platform owner account if you want to create a fresh organization from scratch.

To stop everything: `docker compose down`. Add `-v` if you also want to drop the Postgres volume and start clean next time.

A note on the current state of this: the Docker setup hasn't been run end-to-end in the environment this was built in (no Docker daemon available there), so while the compose file and both Dockerfiles have been reviewed carefully and the backend/frontend were verified running natively against the same Postgres/Redis/RabbitMQ, treat a first `docker compose up --build` as the thing to sanity-check before relying on this for anything real. See `KNOWN_LIMITATIONS.md`.

## Option 2: Running natively

### Infrastructure

You need Postgres, Redis, and RabbitMQ reachable somewhere. Easiest way if you don't want to install them locally is to just run those three services from the compose file without the app containers:

```bash
docker compose up postgres redis rabbitmq
```

This exposes Postgres on `5433` (not `5432` — see the note in `.env.example`), Redis on `6379`, and RabbitMQ on `5672`/`15672`.

### Backend

```bash
cd backend
cp .env.example .env   # adjust if your ports/credentials differ
mvn spring-boot:run
```

The backend reads its config from environment variables with sensible local defaults baked in (check `application.yml`), so you often don't need a `.env` file at all if you're using the compose-provided infrastructure on its default ports. It starts on port 8080 with the context path `/api`.

On first boot it generates an RSA keypair for signing JWTs and drops it in `backend/keys/` (gitignored — don't commit it), runs the Flyway migrations, and seeds a demo organization, its admin user, and a platform owner account. Watch the startup logs for a line like `Default admin user already exists` on the second and later boots — that's the seeder confirming it isn't duplicating data.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on http://localhost:5173. The Vite dev server proxies anything under `/api` to `http://localhost:8080`, so the frontend never needs to know a real backend URL during development — see `vite.config.ts` if you need to point it somewhere else.

## Running the tests

```bash
cd backend
mvn test
```

Both test classes spin up their own disposable Postgres container via Testcontainers, so this doesn't touch whatever database you've configured `application.yml` to point at. The one that matters most is the concurrency test:

```bash
mvn test -Dtest=ConcurrentInventoryReservationTest
```

It fires 100 concurrent reservation requests at ten units of stock and checks that at most ten succeed and the inventory row never goes negative. This is the test that actually proves the oversell-prevention logic works, rather than just asserting it exists.

There's no automated frontend test suite yet (see `KNOWN_LIMITATIONS.md`); `npm run build` at least runs the TypeScript compiler over everything as a sanity check, and `npm run lint` runs oxlint.

## If something doesn't come up

- **Backend can't reach Postgres**: check the port. The compose file maps Postgres to `5433` on the host to avoid clashing with a local Postgres install, but inside the Docker network it's still `5432`. If you're running the backend natively against the compose Postgres, use `5433`.
- **JWT errors after restarting the backend container**: if you're not using the `jwt_keys` volume (or you deleted it), a fresh container generates a new signing key and every previously-issued access token stops validating. Refresh tokens still work since those are checked against the database, not the key.
- **RabbitMQ consumer not picking anything up**: give it a few seconds — events go through a transactional outbox and get relayed on a one-second poll, not published instantly, so there's a small window between an order being created and its notification landing.
- **Swagger UI shows nothing / can't load spec**: it lives at `/api/swagger-ui.html`, not `/swagger-ui.html` — the whole API sits behind the `/api` context path.
