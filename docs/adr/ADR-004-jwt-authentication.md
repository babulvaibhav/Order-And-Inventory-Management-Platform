# ADR-004: JWT for identity, database lookup for permissions

## Decision

Keep the JWT itself sparse: user ID, organization ID, and role ID, signed with RS256. Every request resolves that role ID's actual permission set from the database, via a lookup cached briefly per role in Redis to keep it fast. Refresh tokens are opaque strings checked against a database table, not JWTs themselves, specifically so revoking one (logout, or an organization being suspended) is an immediate database write rather than something that has to wait out a token's own expiry.

## Consequences

A role's permissions being edited, a user being moved to a different role, or an organization being suspended all take effect for that identity's very next request — not their next login. This was verified directly: reassigning a signed-in user to a different role and immediately retrying a request with their *original, unrefreshed* token showed the new role's permissions applying right away.

The cost is an extra lookup on every authenticated request instead of a self-contained signature check. In practice this is cheap — a cached Redis read, not a database round trip on the common path — but it's a real trade against pure JWT statelessness, and it's a deliberate one: the alternative would mean either accepting that permission changes lag by up to a token's lifetime, or building a separate revocation/blacklist mechanism to fake the same immediacy, which ends up being more moving parts than just looking the permission set up fresh.
