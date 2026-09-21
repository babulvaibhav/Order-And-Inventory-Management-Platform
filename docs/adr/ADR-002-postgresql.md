# ADR-002: PostgreSQL, shared schema, tenant column

## Decision

One PostgreSQL database, one schema, and an `organization_id` column on every tenant-owned table, enforced at both the query level (every lookup takes the organization ID as an explicit parameter) and, for the things that most need it, at the constraint level (unique indexes and foreign keys scoped by organization).

PostgreSQL specifically, over something like MySQL, mainly for `JSONB` (used for audit log before/after snapshots and notification metadata) and native support for partial and composite indexes, both of which get used directly in this schema — the customer email uniqueness constraint, for instance, is a partial unique index specifically because customers aren't required to have an email at all.

## Consequences

Cross-tenant queries — which only the platform owner ever legitimately needs — are trivial, since there's no schema or database boundary to cross. Migrations run once and apply to every tenant at once, no per-tenant migration runner needed. Backups and operational tooling stay simple because there's exactly one database to manage.

The trade-off is that tenant isolation is entirely an application-level discipline rather than something the database enforces structurally — a missing `WHERE organization_id = ?` clause in a new query is a real, possible bug in a way it couldn't be with separate-database-per-tenant. That risk gets managed by making the correct pattern (`findByIdAndOrganizationId` rather than `findById`) the default and the easy path, not by hoping every future change remembers to add the filter by hand. It's also the reason the platform owner's cross-tenant endpoints are called out explicitly as the deliberate exception rather than being easy to mistake for a bug.
