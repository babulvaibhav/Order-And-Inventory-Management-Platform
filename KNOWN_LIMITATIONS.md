# Known Limitations

This file is organized by what's still true today: **Fixed in this pass** (the Critical/High bugs
from the previous audit, now corrected and live-verified), **Deferred / assumptions** (gaps left
alone on purpose, with the reasoning, so a reader — or whoever writes the full doc suite later —
knows exactly what's being assumed and why), then the smaller remaining items grouped by area.
File:line references point at `backend/src/main/java/com/uphead/platform/` or `frontend/src/`
unless a full path is given.

## Fixed in this pass (2026-09-21, third pass)

The previous audit found several Critical/High severity bugs and documented them without fixing
them (an explicit decision at the time). This pass fixes the ones judged "absolutely necessary" —
data-integrity and security-boundary bugs — plus the GitHub Actions CI pipeline. Every item below
was verified against a locally-running instance (curl), not just read: multi-item order reservation
against two products/warehouses, an order cancelled and its stock confirmed restored, an order
walked PENDING→CONFIRMED→PROCESSING→COMPLETED with reservedQuantity confirmed consumed, 10
concurrent cancel requests against the same order (exactly 1 succeeded, exactly one release
happened), a role reassignment taking effect on an already-issued token with no re-login, the
permission catalog no longer offering platform-only codes to a tenant role, and the negative-quantity/
self-deactivation/duplicate-email/page-size guards all returning the expected 4xx.

- **Privilege escalation via the role permission editor (Critical).** `PermissionCodes.PLATFORM_ONLY`
  now excludes `organization.read`/`organization.manage` from `RoleService.listPermissionCatalog()`
  and `RoleService.updatePermissions()` rejects them outright if requested directly. An org Admin
  can no longer grant itself platform-owner powers.
- **Multi-item orders reserving stock against the wrong row (Critical).** `OrderService.createOrder`
  now sorts `(inventory, request)` pairs together instead of sorting one list and re-indexing into
  a separately-ordered one. Verified: an order for product A (qty 1) + product B (qty 5), where B's
  inventory UUID sorts before A's, correctly reserved 1 unit against A and 5 against B.
- **Cancelling an order destroying stock instead of returning it (Critical).**
  `InventoryRepository.releaseInventory` now does `available_quantity = available_quantity +
  :quantity, reserved_quantity = reserved_quantity - :quantity` (it previously only did the second
  half). Verified: cancelling a 2-item order correctly restored both lines' available quantity.
- **Stale reads after an atomic inventory update (Critical).** All four `@Modifying` queries in
  `InventoryRepository` now use `clearAutomatically = true`.
- **`COMPLETED` never consumed the reservation (High).** New
  `InventoryRepository.consumeReservedInventory` / `InventoryService.consumeReservedInventory`,
  called from `OrderService.updateOrderStatus` when the target status is `COMPLETED`: decrements
  `reservedQuantity` without touching `availableQuantity` (the stock has shipped). Verified: walking
  an order to COMPLETED left `availableQuantity` unchanged and dropped `reservedQuantity`.
- **`/inventory/reserve` and `/release` accepted negative quantities; no DB-level floor (High).**
  Both `@RequestParam` quantities are now `@Positive` (with `@Validated` on the controller class),
  and `V4__constraints_and_indexes.sql` adds `CHECK (available_quantity >= 0)` /
  `CHECK (reserved_quantity >= 0)` on `inventory` as a backstop.
- **No optimistic/atomic guard on order status transitions — a double-cancel race (High).**
  `OrderRepository.updateStatusIfCurrent` is a compare-and-swap `UPDATE ... WHERE status =
  :expected`; `OrderService.updateOrderStatus` only runs the inventory side effect if the swap
  actually applied. Verified: 10 concurrent `CANCELLED` requests against the same order — 1
  succeeded, 9 got `INVALID_STATUS_TRANSITION`, and the inventory row shows exactly one release.
- **Permissions resolved from the JWT's `roleId`, not the user's current role (High).**
  `JwtAuthenticationFilter` now uses `user.getRoleId()` (the user row is loaded anyway) instead of
  the token claim. Verified: reassigning a signed-in Staff user to Manager immediately let their
  *existing, unrefreshed* access token create a product — previously this required the token to
  expire and be reissued (up to 24h).
- **No composite tenant FK validation on inventory's warehouse/product (High).**
  `InventoryService.createInventory` and `.transferInventory` now confirm both the warehouse(s) and
  product belong to the caller's organization before touching any row (defense in depth — not
  live-tested against actual cross-tenant data, since that needs a second seeded organization, but
  the added checks are the same `findByIdAndOrganizationId` pattern used everywhere else).
- **Inventory transfer had no lock ordering between source and destination (High).**
  `transferInventory` now debits/credits in a deterministic order (lower inventory UUID first) when
  both rows already exist, to avoid a DB-level deadlock between two opposite-direction transfers.
  Not stress-tested under real concurrent opposite transfers (would need a dedicated concurrency
  test similar to the mandatory one) — implemented per the same pattern AGENTS.md §14 asks for, but
  flagged here as unverified under load.
- **No `{success,data,meta}` envelope** — **not fixed, see Deferred below.**
- **No 401 entry point.** New `ApiAuthenticationEntryPoint` returns 401 + `AUTH_TOKEN_EXPIRED`
  instead of a bare 403. Verified: an unauthenticated `GET /v1/products` now returns 401 with a
  JSON body.
- **Swagger UI couldn't load its own spec.** `SecurityConfig`'s permit list now matches
  `springdoc.api-docs.path` (`/api-docs`, not the default `/v3/api-docs`). Verified: `GET
  /api/api-docs` returns 200 unauthenticated.
- **CORS allowed `*`.** Now configurable (`CORS_ALLOWED_ORIGINS`, comma-separated), defaulting to
  the frontend's dev and Docker origins instead of a wildcard. Set this explicitly for a real
  deployment's actual frontend origin.
- **Default secrets and debug-level logging.** `org.springframework.security` and
  `org.hibernate.type.descriptor.sql.BasicBinder` are no longer TRACE (they logged bcrypt hashes
  and raw refresh-token strings); `show-sql`/`SPRING_JPA_SHOW_SQL` default to `false`. The actual
  *secret values* (DB/RabbitMQ credentials, JWT passphrase) are unchanged — see Deferred below.
- **No `backend/.env.example` existed at all**, despite AGENTS.md §27 explicitly requiring one.
  Added, covering every environment variable `application.yml` reads (DB, Redis, RabbitMQ, JWT,
  the new `CORS_ALLOWED_ORIGINS`, server port); `.env` itself is now gitignored.
- **The JWT signing key wasn't persisted or gitignored.** `backend/.gitignore` now excludes
  `keys/`/`*.pem` (there was a real, currently-uncommitted private key sitting in `backend/keys/`
  when this was found). `docker-compose.yml` adds a `jwt_keys` volume at `/app/keys` so recreating
  the backend container no longer invalidates every access token.
- **Dashboard cache: wrong key format, no eviction, duplicated threshold, pre-commit eviction race.**
  Key is now the documented `dashboard:{organizationId}:summary`. New `DashboardCacheEvictor`
  (backed by `CacheManager`, not a declarative `@CacheEvict`) is called from every
  product/warehouse/inventory/order mutation, and — like `RolePermissionService.evict` — defers the
  actual evict to *after* the caller's transaction commits (`common/util/TransactionUtils`), closing
  the window where a concurrent read could repopulate the cache with the stale value.
  `DashboardService` now references `InventoryService.LOW_STOCK_THRESHOLD` instead of a second
  hardcoded `10`. Verified: the dashboard summary reflected a just-created/cancelled/completed order
  immediately, not after up to 60s.
- **Audit coverage was narrower than documented.** `AuthService` now audits `USER_LOGIN`/
  `USER_LOGOUT` (skipped for the platform-owner user, which has no organization to attribute the
  row to — `audit_logs.organization_id` is `NOT NULL`); `ProductService`, `WarehouseService`, and
  `CustomerService` now audit create/update/disable. This closes every item AGENTS.md §18 asks for.
  Verified: `GET /audit-logs` shows a `USER_LOGIN` row after logging in.
- **No guard against self-deactivation.** `UserService.deleteUser` now rejects deactivating your own
  account. Verified: 403 `ACCESS_DENIED` with the specific message "You cannot deactivate your own
  account" (also fixed: `GlobalExceptionHandler.handleAccessDenied` now surfaces a
  `AccessDeniedBusinessException`'s own message instead of always returning the generic one).
- **Editing a user always required a new password.** `UserRequest.password` is no longer
  `@NotBlank`; create explicitly requires one (`UserService.createUser`), update leaves the
  password hash untouched when omitted (this branch already existed but was unreachable).
- **Customer email uniqueness was global, not per-organization.** `CustomerRepository` now has
  `findByEmailAndOrganizationId`; `V4` adds a partial unique index
  `(organization_id, email) WHERE email IS NOT NULL`.
- **Missing composite indexes** `(organization_id, warehouse_id)` / `(organization_id, product_id)`
  on `inventory` — added in `V4__constraints_and_indexes.sql`.
- **No page-size cap; `password` was a sortable field on `GET /users`.**
  `spring.data.web.pageable.max-page-size: 100` is now set; `UserController.getUsers` rejects a
  `sort=password` request with `VALIDATION_ERROR`. (This is a targeted fix for the one endpoint
  where it mattered, not a framework-wide sort-field allow-list — see Deferred.)
- **Dockerfile ran as root, no dependency-cache layer.** Multi-stage build now runs
  `dependency:go-offline` before copying source (so `docker build` reuses the dependency cache
  layer when only source changes), and the runtime stage creates and switches to a non-root `app`
  user. *Not verified with an actual `docker build`* — Docker wasn't available in this environment,
  same as the previous pass; verify before submission (see Deferred).
- **Notifications had no read/unread API.** New `PATCH /v1/notifications/{id}/read`
  (tenant-scoped), wired from the frontend's "mark all read" so read state now persists server-side
  instead of living only in the current tab's memory. Notifications are still organization-wide,
  not per-user (see Deferred) — this only fixes the *persistence*, not the *targeting*, of "read".
- **`InventoryServiceTest` ran against the dev database and wiped it.** Converted to the same
  Testcontainers pattern as `ConcurrentInventoryReservationTest` (ephemeral Postgres container, no
  more unscoped `deleteAll()` against real data). The dead, never-activated
  `application-test.properties` (its `jdbc:tc:postgresql:` URL scheme needs a dependency —
  `org.testcontainers:jdbc` — that isn't on the classpath, so it could never have worked) was
  removed rather than left as a misleading artifact.
- **No GitHub Actions CI pipeline.** `.github/workflows/ci.yml` added: backend build + test job
  (Redis/RabbitMQ as service containers, since both test classes are `@SpringBootTest` and boot the
  full context — Postgres itself comes from Testcontainers), frontend lint + build job, and a
  Docker image build job for both Dockerfiles. *Not run yet* — this repository hasn't been pushed
  to a GitHub remote in this environment, so the workflow is unverified beyond "the same commands
  it runs were run manually and passed" (`mvn test`, `npm run lint`, `npm run build` all pass
  locally; the two `docker build` steps are unverified — no Docker in this environment, see
  Deferred).
- **Frontend: STAFF still couldn't advance orders in the UI.** `useOrderStatus.ts` now exposes
  `canTransitionTo(status)` (cancel needs `order.cancel`, everything else needs `order.create`,
  mirroring the backend) instead of one blanket permission; `OrderDetailPage.tsx` and
  `OrderListPage.tsx` both updated.
- **Frontend: the removed `unitPrice` field was still sent by the order form.** Dropped from
  `OrderItemRequest` and `CreateOrderDialog.tsx`'s submit payload.
- **Frontend + backend: the role picker could come up empty with no explanation.**
  `useRoleLookup` now enables on `role.read` OR `user.manage`; `RoleController.getRoles()` was
  relaxed to match (`hasAuthority('role.read') or hasAuthority('user.manage')`), since the frontend
  gate alone would just have moved the failure to a 403 from the API.
- **Frontend: the Users-page warning text was stale** (claimed `user.read` "isn't currently granted
  to any role", which stopped being true once Admin got it by default). Wording corrected.
- **Frontend: an organization suspension logged the user out with no explanation.**
  `apiClient.ts`'s failed-refresh path now inspects the refresh error for `ORG_SUSPENDED` and passes
  a reason through `tokenStorage.setLogoutReason`/`consumeLogoutReason` (sessionStorage, read once);
  `LoginPage.tsx` shows it.
- **Frontend: "mark all read" was in-memory only.** Now also calls the new backend endpoint
  (best-effort, only for items with a real backend UUID — the synthetic fallback id built for
  events with no id has nothing to PATCH).
- **`docker-compose.yml`'s frontend had no health-gated `depends_on`.** Changed to `condition:
  service_healthy` against the backend.

## Deferred / assumptions (documented, not fixed — read before relying on this past a demo)

Judged too large, too low-priority for this pass, or genuinely out of scope for a demo/assignment
submission. Each one is something a reader (or a future pass writing the full `ARCHITECTURE.md` /
`SECURITY.md` / etc.) should know is being assumed.

- **No `{success, data, meta}` response envelope.** Every controller still returns a raw DTO or a
  raw Spring `Page` on success; only the error path uses the assignment's `{success:false,
  error:{...}}` shape. **Why deferred:** this touches every controller and the frontend's response
  handling in every service file — a full-surface API contract change, not a bug fix. **Assumption:**
  the frontend was built against the current (unwrapped) success shape throughout, so this is a
  coherent, working contract as-is, just not the literally-specified one.
- **No full per-entity domain error code catalog** (`PRODUCT_NOT_FOUND`, `WAREHOUSE_NOT_FOUND`,
  `INVALID_INVENTORY_ADJUSTMENT`, `ORDER_ALREADY_CANCELLED`, `AUTH_TOKEN_EXPIRED` is now used but
  only for the 401 entry point, not other paths). Not-found errors still come back as the generic
  `RESOURCE_NOT_FOUND`. **Why deferred:** would mean adding a distinct exception (or an entity-type
  parameter) at every `orElseThrow` call site across ~10 services — mechanical but large. **Assumption:**
  the generic code plus a human-readable message is enough for this submission's purposes; the
  frontend never branches on the specific not-found code today.
- **Filters that should combine don't** (search + status, warehouse + product, date range + entity +
  action are still mutually-exclusive if/else chains in `OrderController`/`InventoryController`/
  `AuditController`). **Why deferred:** reworking three controllers' query methods to compose
  arbitrary filter combinations (ideally via a Specification-style approach — see
  `docs/DESIGN_PATTERNS.md`'s "where the next pattern would pay off") is a feature-sized change, not
  a bug fix. **Assumption:** a caller sending both filters gets one silently ignored rather than an
  error; the frontend's own filter UI already only lets you pick one at a time, so this isn't hit in
  practice today.
- **Default secrets and passphrases are still hardcoded**: DB `postgres/postgres`, RabbitMQ
  `guest/guest`, JWT key passphrase `changeit`, seeded demo passwords in `DataSeeder.java`. **Why
  deferred:** wiring real secret management (Vault, cloud secret managers, or even just enforcing
  non-default values via startup validation) is infrastructure work with no payoff in a
  local/demo/CI environment. **Assumption:** this is a development-only setup — see `.env.example`
  and the README's demo-credentials table — and every one of these must be rotated before any real
  deployment.
- **No rate limiting.** Documented as a strategy (README/`.env.example` mention it) but not
  implemented. **Why deferred:** explicitly listed as a bonus item in AGENTS.md §7, and a proper
  implementation needs a decision about per-IP vs. per-user vs. per-org limits that's out of scope
  here.
- **No Idempotency-Key support on order creation, no refresh-token rotation.** Both explicitly
  called out as bonus/future items in AGENTS.md §17 and §7 respectively; neither implemented.
- **Notifications remain organization-wide, not per-user**, and the SSE emitter registry is still
  in-memory/per-instance (a second backend replica's clients won't see events that only reached the
  first replica's RabbitMQ consumer). **Why deferred:** per-user targeting needs a notification
  recipient model change (who should see what), and multi-instance SSE fan-out needs a pub/sub
  layer (Redis pub/sub or similar) behind the `NotificationPushPort` — both are real architecture
  work, not bug fixes, and are exactly the "next adapter" scaling story already written up in
  `docs/DESIGN_PATTERNS.md`.
- **SSE reconnect after a token refresh has no backoff.** Self-limiting in practice (a successful
  refresh usually changes `canStream` and ends the effect) — see the original finding for detail.
  Left as-is; low risk, low priority.
- **No inventory history ledger** (the audit log is the closest substitute) and **timestamps remain
  zone-less `LocalDateTime`** (shown as browser-local time by the frontend). Both explicitly listed
  as acceptable simplifications in the original scope.
- **No RBAC / tenant-isolation / order / controller-level (MockMvc) test suites.** Only
  `InventoryServiceTest` (now Testcontainers-based, no longer unsafe to run) and
  `ConcurrentInventoryReservationTest` exist. **Why deferred:** writing a meaningful RBAC +
  tenant-isolation + full order-flow test suite is itself a multi-day effort matching AGENTS.md
  §30's full ask, not something to bolt on alongside a bug-fix pass — this pass instead
  live-verified every fixed bug manually against a running instance (see "Fixed in this pass"
  above) as a substitute for automated coverage of *these specific* changes.
- **No frontend automated tests** (Vitest/React Testing Library) — unchanged from the previous
  pass, explicitly out of scope here too.
- **The full documentation suite is still missing**: `ARCHITECTURE.md`, `API.md`, `DATABASE.md`,
  `SECURITY.md`, `SETUP.md`, `SCALABILITY.md`, and the ADRs under `docs/adr/`. **Explicitly deferred
  per instruction for this pass** — the intent is to fix what's necessary in code first and keep
  `README.md`/`PROGRESS.md`/this file current as the running record, so writing the fuller doc set
  later has an accurate, single source of truth to draw from rather than needing its own separate
  audit.
- **`docker compose up --build` has not been run** in this environment — Docker isn't available
  here (checked: `docker version` fails, no daemon). This is a real gap given this pass touched
  both Dockerfiles and `docker-compose.yml` (JWT key volume, health-gated frontend `depends_on`,
  backend non-root user + `curl` for its own healthcheck, dependency-cache layer). Every backend
  code change was instead verified by building the jar (`mvn clean package`) and running it
  directly against natively-running Postgres/Redis/RabbitMQ, then exercising the API with curl (see
  "Fixed in this pass"). **A full `docker compose up --build` from a clean clone is the single most
  important verification step left before considering this submission final** — the Dockerfile/
  compose changes in this pass are the least-tested part of it.
- **The CI workflow (`.github/workflows/ci.yml`) has not actually run on GitHub** for the same
  reason — no remote/Actions access from this environment. Its individual commands were run
  manually and passed (see above), but the workflow YAML itself (service container wiring, job
  dependencies) is unverified.

## Tests

- `ConcurrentInventoryReservationTest` exercises `InventoryService.reserveInventory` directly, not
  the full `POST /orders` path.
- No automated coverage of the specific bugs fixed in this pass beyond the manual curl verification
  described above — the multi-item wrong-row fix, the double-cancel race guard, the immediate
  role-reassignment fix, and the tenant FK validation would all benefit from dedicated tests in a
  future pass (see "No RBAC / tenant-isolation / order / controller-level test suites" above).

## Documentation / process

- `README.md`, `backend/README.md`, `frontend/README.md`, `PROGRESS.md`, and this file are being
  kept current as the authoritative record while the fuller documentation suite (ARCHITECTURE.md
  etc.) remains deferred (see above). `docs/DESIGN_PATTERNS.md` covers the architecture/scaling
  angle in the meantime.
- Not tenant-isolation bugs, just stricter-than-necessary constraints noted previously and still
  true: `dashboard/application/DashboardService.java` and
  `user/application/UserService.getCurrentUser`/`getUsers` make unscoped `findById` calls that are
  currently safe (the IDs involved are already tenant-scoped upstream) but are N+1 and inconsistent
  with the "always scope by organization" rule stated elsewhere.
