# Known Limitations

Everything below is a real, current gap which was deliberately left out rather than missed, the reasoning is included so it reads as a decision rather than an oversight.

## Security

- Default credentials ship as-is: the database, RabbitMQ, and the JWT signing key's passphrase all use placeholder values (see `.env.example` and the README's demo-credentials table). These are meant for local development and need to be rotated before this runs anywhere real.
- No rate limiting is implemented, due to time constraints but it can be achieved.

## Real-time notifications

- Notifications are organization-wide rather than addressed to a specific user — everyone in an organization sees the same feed.
- The SSE connection registry lives in memory on a single backend instance. Running more than one instance would mean a client connected to instance B wouldn't see an event that only reached instance A's RabbitMQ consumer. THis can be mitigated and is required at scale using instanceId--User cache .

## Testing

- Automated backend tests cover inventory operations (reserve/release/adjust/transfer) and the mandatory concurrency test. There's no automated coverage yet for RBAC, tenant isolation, or the full order-creation-to-completion flow.
- No automated frontend test suite (Vitest / React Testing Library).

