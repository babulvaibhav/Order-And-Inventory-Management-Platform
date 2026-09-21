# Security

## Passwords

BCrypt, via Spring Security's `BCryptPasswordEncoder`. Nothing exotic — it's the standard choice, it's slow by design (which is the point), and there's no reason to reach for Argon2 here instead. Passwords are never logged; the one place this needed active fixing was the Hibernate SQL bind-parameter logger, which at `TRACE` level would happily print every bound value including a password hash going into an `INSERT`. That's now at `WARN`.

## Tokens

Access tokens are JWTs signed with RS256 — an RSA keypair, not a shared secret, generated on first boot and stored under `backend/keys/`. They carry the user's ID, organization ID, and role ID, expire after 24 hours by default, and are stateless: the backend doesn't check them against anything in the database, it just verifies the signature and reads the claims.

Refresh tokens are the opposite of that on purpose. They're opaque, stored in Postgres, and checked against the database on every use — which means revoking one (logout, or an admin suspending the organization) takes effect immediately rather than waiting for a cryptographic expiry.

Permissions specifically are *not* baked into the access token. Every request looks them up fresh from the database (cached briefly in Redis, keyed by role) rather than trusting whatever was true at login time.

## Tenant isolation

Every tenant-owned row has an `organization_id`, every lookup filters on it, and the organization ID being filtered on always comes from the authenticated token, never from anything the client sent. `findByIdAndOrganizationId(id, organizationId)`. A request-scoped `TenantContextHolder` makes the current organization ID (and permission set) available throughout the request without threading it through every method signature by hand.

The platform owner is the one deliberate exception: it has no organization of its own, and its endpoints (creating/suspending organizations, and now managing a specific organization's users) are gated purely on `organization.read`/`organization.manage` rather than tenant scoping, because by design they need to reach across every tenant.

## Authorization

Roles and permissions are database rows, not a hardcoded enum — see `ARCHITECTURE.md` for the reasoning. Every protected endpoint carries a `@PreAuthorize("hasAuthority('...')")` check backed by that resolved permission set; there's no endpoint that relies on the frontend to hide a button as its only protection. The frontend does hide buttons and menu items a user can't use, but that's purely so the UI doesn't dangle actions in front of someone that would just come back as a 403 — the backend check is what actually matters, and it's what gets tested.

## Input validation

Every request DTO uses Bean Validation annotations (`@NotBlank`, `@Email`, `@Positive`, `@Size`, and so on), checked before any business logic runs. A validation failure comes back as `400 VALIDATION_ERROR` with the specific field messages joined together, not a stack trace. 
Entities are never returned directly from a controller — every response goes through a dedicated response DTO, so adding a field to an entity for internal reasons doesn't silently expose it over the API.

## SQL injection

Every query goes through JPA/Hibernate — either derived query methods or parameterized JPQL/native queries with named parameters. 
There's no string concatenation building SQL anywhere in this codebase, which is really the whole story on this one; it's a non-issue by construction rather than something actively guarded against.

## XSS

The frontend is React, which escapes everything it renders by default, and nothing in the codebase reaches for `dangerouslySetInnerHTML`. The production nginx config also ships a Content-Security-Policy that only allows scripts and connections from the app's own origin, so even if something did get injected, it wouldn't have anywhere to phone home to.

## CORS

Configurable via `CORS_ALLOWED_ORIGINS` (comma-separated), defaulting to the frontend's local dev and Docker origins rather than `*`.

## Secrets

Nothing is hardcoded that shouldn't be — the default database password, RabbitMQ credentials, JWT key passphrase, and demo user passwords are exactly that: defaults, meant for local development, documented in `.env.example` with placeholder values, and expected to be replaced before this runs anywhere that matters. The JWT signing key itself is generated locally rather than committed, and `backend/keys/` plus any `.pem`/`.env` file are gitignored.

## Headers

Spring Security's defaults apply on the API side. The frontend's nginx config adds the harder-to-get-wrong ones for the app itself: CSP, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, and a `Referrer-Policy`.

