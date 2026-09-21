# ADR-004: JWT for identity, database lookup for permissions

## Status

Accepted

## Context

Stateless JWT authentication is the conventional choice for a REST API like this one, and the assignment brief asks for it directly — access and refresh tokens, expiration, password hashing. The part that needed an actual decision, rather than just following convention, was what goes *inside* the access token. The usual pattern bakes a user's roles or permissions directly into the JWT's claims, so a single signature check tells you everything you need to authorize a request without touching the database again.

That pattern has a real cost here specifically, because this system has dynamic, editable permissions: roles aren't a fixed enum, their permission sets can be changed at any time by an admin, users can be reassigned to a different role, and an organization can be suspended mid-session. If permissions live inside the token, every one of those changes is invisible to anyone already holding a token until it expires — which, at a typical access-token lifetime, could mean up to a day of a revoked permission still working, or a suspended organization's users still getting in.

## Decision

Keep the JWT itself sparse: user ID, organization ID, and role ID, signed with RS256. Every request resolves that role ID's actual permission set from the database, via a lookup cached briefly per role in Redis to keep it fast. Refresh tokens are opaque strings checked against a database table, not JWTs themselves, specifically so revoking one (logout, or an organization being suspended) is an immediate database write rather than something that has to wait out a token's own expiry.

## Consequences

A role's permissions being edited, a user being moved to a different role, or an organization being suspended all take effect for that identity's very next request — not their next login. This was verified directly: reassigning a signed-in user to a different role and immediately retrying a request with their *original, unrefreshed* token showed the new role's permissions applying right away.

The cost is an extra lookup on every authenticated request instead of a self-contained signature check. In practice this is cheap — a cached Redis read, not a database round trip on the common path — but it's a real trade against pure JWT statelessness, and it's a deliberate one: the alternative would mean either accepting that permission changes lag by up to a token's lifetime, or building a separate revocation/blacklist mechanism to fake the same immediacy, which ends up being more moving parts than just looking the permission set up fresh.
