# API

Base path: `http://localhost:8080/api/v1` (the `/api` part is the server's context path, `/v1` is the actual API version prefix — don't drop either).

Full interactive docs with every request/response schema are on Swagger UI at `/api/swagger-ui.html` once the backend is running. This document is the human-readable tour: how auth works, what the conventions are, and a rundown of each resource. It's not a field-by-field reference — that's what Swagger is for.

## Authentication

```
POST /v1/auth/login
{ "email": "admin@uphead.com", "password": "..." }
```

Returns an access token, a refresh token, and the signed-in user's profile including their resolved `permissions` array. The access token is a short-lived RS256 JWT — send it as `Authorization: Bearer <token>` on everything else. It carries the user's ID, organization ID, and role ID, but deliberately *not* their permissions — those get looked up from the database on every request instead, which is what lets a permission change take effect instantly instead of waiting for the token to expire. More on why in `ARCHITECTURE.md`.

```
POST /v1/auth/refresh
{ "refreshToken": "..." }
```

Exchanges a still-valid refresh token for a new access token. Refresh tokens are checked against the database (not just verified cryptographically), so revoking one — via logout, or because an admin suspended the organization — actually stops it working immediately rather than waiting for it to expire naturally.

```
POST /v1/auth/logout
{ "refreshToken": "..." }
```

Revokes that refresh token. The access token that was issued alongside it keeps working until it expires on its own — logout doesn't reach back and invalidate access tokens already handed out, only the ability to mint new ones.

An unauthenticated or expired-token request to anything else gets a `401` with `AUTH_TOKEN_EXPIRED`.

## Response shape

Successful responses return the resource directly — a product, a page of orders, whatever the endpoint promises — without an extra wrapper. Errors are consistent everywhere:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Requested quantity is unavailable",
    "timestamp": "2026-09-21T21:05:43.21",
    "requestId": null
  }
}
```

`requestId` is populated when the caller sends an `X-Request-ID` header — it isn't generated server-side today, so if you don't send one it comes back null.

Codes you'll actually run into: `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `VALIDATION_ERROR`, `INSUFFICIENT_INVENTORY`, `INVALID_STATUS_TRANSITION`, `ACCESS_DENIED`, `TENANT_ACCESS_DENIED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN_INVALID`, `ORG_SUSPENDED`. A handful of not-yet-split-out cases (any generic entity-not-found, for instance) still fall under the broader `RESOURCE_NOT_FOUND`/`INTERNAL_ERROR` codes rather than something more specific like `PRODUCT_NOT_FOUND` — see `KNOWN_LIMITATIONS.md`.

## Pagination, search, sorting

Anything that returns a list takes Spring's standard `page`, `size`, and `sort` query params:

```
GET /v1/products?page=0&size=20&sort=createdAt,desc&search=widget
```

The response wraps the list in a Spring `Page` — `content`, `totalElements`, `totalPages`, `number`, and so on — rather than a custom envelope. `size` is capped at 100 server-side so nobody can ask for the whole table in one request.

## Products

| | |
|---|---|
| `GET /v1/products` | paginated, `search` and `status` filters, requires `product.read` |
| `POST /v1/products` | requires `product.write` |
| `GET /v1/products/{id}` | requires `product.read` |
| `PATCH /v1/products/{id}` | full update, requires `product.write` |
| `PATCH /v1/products/{id}/disable` | soft-disable — a disabled product can't be added to a new order | requires `product.write` |

SKU is required and unique within the organization; two tenants can reuse the same SKU without conflict.

## Warehouses

Same shape as products: `GET /v1/warehouses` (list, `warehouse.read`), `POST` and `PATCH /{id}` (`warehouse.write`), `PATCH /{id}/disable`.

## Customers

`GET`/`POST /v1/customers` (`customer.read` / `customer.write`), `GET`/`PATCH /v1/customers/{id}`. Only `name` is required — customers don't log in, so there's no reason to force an email or phone number on them. Email, when given, is unique per organization.

## Inventory

```
GET  /v1/inventory                  (?warehouseId= or ?productId=, requires inventory.read)
GET  /v1/inventory/{id}
POST /v1/inventory                  (create a row for a warehouse/product pair, inventory.update)
POST /v1/inventory/adjust           (signed delta: positive adds stock, negative removes it)
POST /v1/inventory/transfer         (move stock between two warehouses in one call)
POST /v1/inventory/reserve          (?inventoryId=&quantity=)
POST /v1/inventory/release          (?inventoryId=&quantity=)
```

`reserve` and `release` are the low-level primitives that order creation and cancellation call internally; they're also exposed directly for anything that needs to hold stock outside the normal order flow. Both quantities must be positive.

Every one of these is backed by an atomic conditional `UPDATE` at the database level, not a read-then-write. If a reservation can't be satisfied you get a `409 INSUFFICIENT_INVENTORY`, not a silently-wrong result.

## Orders

```
POST   /v1/orders                    (order.create)
GET    /v1/orders                    (?status=, order.read)
GET    /v1/orders/{id}
PATCH  /v1/orders/{id}/status        { "status": "CONFIRMED" }
```

Creating an order takes a customer ID and a list of line items (product, warehouse, quantity). The unit price is never taken from the request — it's always looked up server-side from the product's current price, so there's no way for a client to submit a fake price. If any line item can't be reserved, the whole order fails and nothing is created; there's no partial order.

Status moves through `PENDING → CONFIRMED → PROCESSING → COMPLETED`, with `CANCELLED` reachable from `PENDING` or `CONFIRMED`. Cancelling requires `order.cancel`; every other transition only needs `order.create`, which is deliberate — it's what lets a Staff user (who has `order.create` but not `order.cancel` by default) actually process an order through to completion without needing cancellation rights. Completing an order finalizes its reserved stock; cancelling one returns the reservation to available stock.

## Users, Roles, Permissions

```
GET/POST /v1/users            (user.read / user.manage)
GET/PATCH/DELETE /v1/users/{id}
```

`DELETE` is a soft delete — it deactivates the account rather than removing the row, and a user can't deactivate themselves. Password is required when creating a user and optional when editing one; leaving it blank on an edit keeps the existing password.

```
GET/POST /v1/roles            (role.read / role.manage)
PATCH /v1/roles/{id}
PATCH /v1/roles/{id}/permissions
DELETE /v1/roles/{id}
GET /v1/permissions            (the full catalog, for building a permission picker)
```

Every organization starts with Admin, Manager, and Staff — these can't be renamed or deleted, but every permission on them is editable, and organizations can create as many additional custom roles as they want. A role-permission change takes effect for everyone holding that role on their very next request; nobody needs to log out and back in.

## Organizations (Platform Owner only)

```
POST   /v1/organizations
GET    /v1/organizations               (?search=)
GET    /v1/organizations/{id}
PATCH  /v1/organizations/{id}          (rename, or suspend/reactivate)
GET    /v1/organizations/{id}/roles
GET    /v1/organizations/{id}/users
POST   /v1/organizations/{id}/users
PATCH  /v1/organizations/{id}/users/{userId}
```

Creating an organization seeds its Admin/Manager/Staff roles and its first Admin user in one transaction. The last five routes exist because that first-admin step used to be the *only* way any user could ever get into an organization — the platform owner can now add or fix a user in any organization directly, which matters if that first admin's credentials get lost before they've ever signed in.

Suspending an organization blocks new logins and rejects that organization's already-issued tokens on their very next request — it doesn't wait for anything to expire.

## Audit log

```
GET /v1/audit-logs           (audit.read; filterable by ?entity= or ?action= or a date range)
```

Read-only — there's no update or delete endpoint, on purpose. Every entry records who did what to which entity, with a before/after snapshot where that's meaningful (a role's permission set, an inventory adjustment, and so on).

## Dashboard

```
GET /v1/dashboard/summary
```

Total products, total warehouses, available inventory, pending/completed order counts, low-stock product count, and the five most recent orders — everything the dashboard screen needs in one call. Cached in Redis for 60 seconds per organization, and evicted immediately whenever something that would change the numbers happens (a new order, a stock adjustment, and so on), so the cache is there for the read-heavy case rather than to paper over slow queries.

## Real-time notifications

```
GET /v1/notifications/stream          (Server-Sent Events, inventory.read)
PATCH /v1/notifications/{id}/read
```

Opening the stream connection replays whatever's currently unread for that organization, then keeps the connection open and pushes new events as they happen — order created, order cancelled, inventory running low, inventory adjusted, a transfer completing. A heartbeat comment goes out every 25 seconds to keep the connection alive through proxies that time out idle sockets. Notifications are organization-wide rather than addressed to a specific person today, which the frontend's "mark all read" accounts for by calling the read endpoint for each one rather than assuming a single shared unread count.

## Health

```
GET /api/actuator/health
```

Standard Spring Boot Actuator health endpoint, unauthenticated. Used by the Docker healthchecks to decide when the backend is actually ready rather than just "the process started."
