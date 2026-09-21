# Known Limitations

Everything below is a real, current gap — not a rounded-off "nothing's perfect" disclaimer. Where something was deliberately left out rather than missed, the reasoning is included so it reads as a decision rather than an oversight.

## API

- Success responses return the resource directly (a DTO, or a Spring `Page`); only the error path uses the `{success, data, meta}` / `{success: false, error: {...}}` envelope the spec describes. The frontend was built consistently against this shape throughout, so it's a coherent contract, just not the literally-specified one.
- Not-found errors come back as a generic `RESOURCE_NOT_FOUND` with a readable message rather than a per-entity code like `PRODUCT_NOT_FOUND` or `WAREHOUSE_NOT_FOUND`.
- List filters don't combine — for example, products can be filtered by search *or* status, not both at once, and the audit log by one of entity/action/date-range at a time. The frontend's own filter UI matches this (one filter control active at a time), so nothing gets silently dropped in practice, but it's a real constraint on the API itself.
- No `Idempotency-Key` support on order creation.

## Security

- Default credentials ship as-is: the database, RabbitMQ, and the JWT signing key's passphrase all use placeholder values (see `.env.example` and the README's demo-credentials table). These are meant for local development and need to be rotated before this runs anywhere real.
- No rate limiting is implemented.
- Refresh tokens aren't rotated on use.

## Real-time notifications

- Notifications are organization-wide rather than addressed to a specific user — everyone in an organization sees the same feed.
- The SSE connection registry lives in memory on a single backend instance. Running more than one instance would mean a client connected to instance B wouldn't see an event that only reached instance A's RabbitMQ consumer.
- After a token refresh, the SSE client reconnects without a backoff delay. Low risk in practice, since a refresh that changes permissions typically also ends the stream, but worth knowing.

## Data model

- `Inventory` has a `version` column meant for optimistic locking, but the atomic conditional-update queries that actually change stock levels never increment it, so it isn't doing real work today. Not a correctness problem — the conditional updates already prevent lost updates on their own — just an unused column.
- There's no dedicated inventory history or ledger — the audit log is the closest thing to one, and it wasn't built for that purpose.
- Timestamps are stored and returned without a timezone and shown as the browser's local time. Correct when the backend and its users share a timezone, off by that offset otherwise.
- A couple of read paths (`DashboardService`, `UserService.getCurrentUser`/`getUsers`) use an unscoped lookup by ID rather than the organization-scoped pattern used everywhere else. Currently safe, since the IDs involved are already tenant-scoped upstream by the time they reach that lookup, but inconsistent with the rule applied elsewhere and worth tightening.

## Observability

- No structured logging or request correlation IDs — just application logs and Actuator's health endpoint. Fine at this scale; would need addressing before running more than one backend instance, since tracing one request across several instances without a shared ID is genuinely hard.

## Testing

- Automated backend tests cover inventory operations (reserve/release/adjust/transfer) and the mandatory concurrency test. There's no automated coverage yet for RBAC, tenant isolation, or the full order-creation-to-completion flow.
- No automated frontend test suite (Vitest / React Testing Library).

## Verification

- `docker compose up --build` has not been run end-to-end in the environment this was built in (no Docker daemon available there). The backend and frontend were instead verified running natively against local Postgres, Redis, and RabbitMQ, and the CI workflow's individual commands (`mvn test`, `npm run lint`, `npm run build`) were run manually and passed — but the compose file itself, and the CI workflow's YAML, haven't been exercised as written. Worth a clean-clone check before treating this as final.
