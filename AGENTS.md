# AGENTS.md

## Purpose

This file is the implementation guide for any LLM, coding agent, or developer working on the **Multi-Tenant Real-Time Order & Inventory Management Platform** assignment.

The assignment should be treated as a **production-oriented engineering exercise**, not a CRUD demo. The implementation must prioritize:

1. Architecture and system design
2. Backend correctness
3. Concurrency and data integrity
4. Tenant isolation
5. Security
6. Event-driven and real-time behavior
7. Testing
8. Documentation

Do not over-engineer the solution. A **modular monolith** is the preferred architecture for this submission unless a requirement clearly justifies otherwise.

---

# 1. Chosen Technology Stack

## Backend

- Java 21
- Spring Boot 3.x
- Spring Web
- Spring Security
- Spring Data JPA / Hibernate
- PostgreSQL
- Redis
- RabbitMQ
- Server-Sent Events (SSE)
- Flyway
- Bean Validation
- Springdoc OpenAPI / Swagger
- Maven

## Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Axios
- Material UI or Ant Design

## Testing

- JUnit 5
- Mockito
- Spring Boot Test
- Testcontainers
- PostgreSQL Testcontainer
- Optional frontend tests with Vitest / React Testing Library

## Infrastructure

- Docker
- Docker Compose
- GitHub Actions

---

# 2. Architectural Direction

Use a **modular monolith**.

Do not create microservices solely to demonstrate distributed architecture.

The application should be a single deployable Spring Boot service with clear internal module boundaries.

Recommended high-level structure:

```text
React Frontend
      |
      | HTTPS / REST
      v
Spring Boot Modular Monolith
      |
      +-- Authentication
      +-- Organizations
      +-- Users / RBAC
      +-- Products
      +-- Warehouses
      +-- Customers
      +-- Inventory
      +-- Orders
      +-- Audit
      +-- Notifications
      |
      +------ PostgreSQL
      |
      +------ Redis
      |
      +------ RabbitMQ
                 |
                 +-- Notification Consumer
                         |
                         +-- SSE
                               |
                               v
                            Browser
```

Internally, modules should follow approximately:

```text
Controller
   |
   v
Application / Service Layer
   |
   v
Domain
   |
   v
Repository
   |
   v
Database
```

Keep domain/module boundaries explicit.

---

# 3. Backend Package Structure

Recommended backend structure:

```text
backend/
└── src/main/java/com/uphead/platform/
    ├── auth/
    │   ├── api/
    │   ├── application/
    │   ├── domain/
    │   └── infrastructure/
    │
    ├── organization/
    ├── user/
    ├── product/
    ├── warehouse/
    ├── customer/
    ├── inventory/
    ├── order/
    ├── notification/
    ├── audit/
    │
    └── common/
        ├── config/
        ├── exception/
        ├── security/
        ├── tenant/
        ├── logging/
        ├── validation/
        └── util/
```

Agents may simplify internal package depth when necessary, but module boundaries must remain obvious.

Avoid one global package containing all controllers, all services, and all repositories.

---

# 4. Frontend Structure

Recommended structure:

```text
frontend/src/
├── app/
├── components/
├── features/
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── warehouses/
│   ├── inventory/
│   ├── orders/
│   └── audit/
├── hooks/
├── services/
├── store/
├── types/
└── utils/
```

Frontend responsibilities:

- Authentication state
- Authorization-aware UI
- API communication
- Loading state
- Error state
- Empty state
- Search
- Filtering
- Sorting
- Pagination
- Responsive layout

Backend authorization is authoritative. Frontend authorization only improves UX.

---

# 5. Core Functional Scope

The system must support multiple organizations.

Each organization independently manages:

- Users
- Roles / permissions
- Products
- Warehouses
- Customers
- Inventory
- Orders
- Notifications
- Audit history

Every tenant-owned record must be associated with an organization.

---

# 6. Multi-Tenancy

## Mandatory Requirement

A user from Organization A must never be able to access Organization B's:

- users
- products
- warehouses
- customers
- inventory
- orders
- reports
- audit data

## Strategy

Use a shared database and shared schema with an `organization_id` column on every tenant-owned table.

Examples:

```text
products.organization_id
warehouses.organization_id
customers.organization_id
inventory.organization_id
orders.organization_id
users.organization_id
audit_logs.organization_id
```

The current organization must come from the authenticated principal/token, not from a client-controlled request body.

Example JWT claims:

```json
{
  "sub": "USER-123",
  "organizationId": "ORG-001",
  "role": "MANAGER"
}
```

Create a request-level tenant context:

```java
public record TenantContext(
    UUID userId,
    UUID organizationId,
    Set<String> permissions
) {}
```

Queries must always include tenant scope.

Preferred:

```java
findByIdAndOrganizationId(id, organizationId)
```

Avoid:

```java
findById(id)
```

unless the service performs an explicit organization validation immediately afterward.

Never trust a tenant ID sent by the frontend for authorization.

---

# 7. Authentication

Implement:

- Login
- Logout
- Access token
- Refresh token
- Token expiration
- Password hashing
- Revoked/invalid token handling

Recommended:

- BCrypt or Argon2 for passwords
- Short-lived JWT access tokens
- Refresh tokens stored securely in Redis or PostgreSQL
- Logout invalidates the refresh token

Possible future/bonus functionality:

- Refresh token rotation
- Multiple active sessions
- Device/session management

These are secondary to core requirements.

---

# 8. Authorization

Required roles:

```text
ADMIN
MANAGER
STAFF
```

Expected capabilities:

```text
ADMIN
- full organization access

MANAGER
- manage products
- manage inventory
- manage orders

STAFF
- read inventory
- process orders
```

Prefer internally mapping roles to permissions.

Example permissions:

```text
product.read
product.write
warehouse.read
warehouse.write
inventory.read
inventory.update
order.read
order.create
order.cancel
user.manage
audit.read
```

Enforce permissions in the backend with Spring Security.

Examples:

```java
@PreAuthorize("hasAuthority('inventory.update')")
```

or equivalent authorization logic.

Do not rely on frontend-only role checks.

---

# 9. Database Model

Minimum recommended entities:

```text
Organization
User
Product
Warehouse
Customer
Inventory
Order
OrderItem
AuditLog
Notification
RefreshToken
```

Key relationships:

```text
Organization 1 ---- N Users
Organization 1 ---- N Products
Organization 1 ---- N Warehouses
Organization 1 ---- N Customers
Organization 1 ---- N Orders

Warehouse 1 ---- N Inventory
Product   1 ---- N Inventory

Order   1 ---- N OrderItems
Product 1 ---- N OrderItems
```

---

# 10. Important Database Constraints

SKU must be unique inside one organization:

```sql
UNIQUE (organization_id, sku)
```

Inventory must be unique per organization + warehouse + product:

```sql
UNIQUE (
    organization_id,
    warehouse_id,
    product_id
)
```

Recommended indexes:

```sql
INDEX (organization_id)

INDEX (organization_id, status)

INDEX (organization_id, created_at)

INDEX (organization_id, warehouse_id)

INDEX (organization_id, product_id)

INDEX (organization_id, warehouse_id, product_id)
```

Use Flyway migrations.

Do not depend on Hibernate `ddl-auto=update` for the final solution.

Recommended:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

---

# 11. Product Management

Product fields:

```text
id
organizationId
sku
name
description
price
status
createdAt
updatedAt
```

Implement:

- Create
- Update
- Disable
- Details
- Paginated listing
- Search
- Filtering
- Sorting

SKU uniqueness is scoped to organization.

---

# 12. Warehouse Management

Warehouse fields:

```text
id
organizationId
name
address
status
createdAt
updatedAt
```

Implement:

- Create
- Update
- List
- Details
- Disable if appropriate

---

# 13. Inventory Management

Recommended inventory model:

```text
id
organizationId
warehouseId
productId
availableQuantity
reservedQuantity
version
updatedAt
```

Operations:

- Add inventory
- Remove inventory
- Transfer inventory
- Reserve inventory
- Release inventory
- Inventory history

Inventory must never become negative.

All inventory operations must be transactionally safe.

---

# 14. Mandatory Concurrency Strategy

Concurrency handling is a core evaluation area.

The system must prevent overselling.

Example scenario:

```text
available stock = 1

request A wants 1
request B wants 1

both arrive concurrently

ONLY ONE request may succeed
```

## Preferred implementation

Use an atomic conditional SQL update.

Example:

```sql
UPDATE inventory
SET available_quantity = available_quantity - :quantity,
    reserved_quantity = reserved_quantity + :quantity,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :inventoryId
  AND organization_id = :organizationId
  AND available_quantity >= :quantity;
```

Interpret result:

```text
updated row count = 1 -> reservation succeeded
updated row count = 0 -> insufficient stock or invalid tenant
```

Throw:

```text
INSUFFICIENT_INVENTORY
```

when the reservation does not succeed.

Do not use a read-then-update flow such as:

```text
SELECT quantity
if quantity sufficient:
    UPDATE quantity
```

without locking/atomic protection.

That approach is vulnerable to race conditions.

---

# 15. Multi-Item Order Transaction

When an order contains several products:

```text
BEGIN

reserve inventory item A
reserve inventory item B
reserve inventory item C

create order
create order items
create audit records

COMMIT
```

If any reservation fails:

```text
ROLLBACK
```

Sort inventory rows by a deterministic key before reservation where practical to reduce deadlock risk.

---

# 16. Order Management

Order statuses:

```text
PENDING
CONFIRMED
PROCESSING
COMPLETED
CANCELLED
```

Order creation flow:

```text
Request
   |
   v
Authenticate
   |
   v
Resolve Tenant
   |
   v
Validate Customer
   |
   v
Validate Products
   |
   v
Reserve Inventory
   |
   v
Create Order
   |
   v
Create Order Items
   |
   v
Create Audit Event
   |
   v
Commit Transaction
   |
   v
Publish Notification Event
```

Important:

Business transaction integrity takes priority over event publication.

---

# 17. Idempotency

Bonus but desirable if time permits.

Support:

```http
Idempotency-Key: <UUID>
```

for order creation.

Store the key with tenant scope.

Example uniqueness:

```text
organization_id + idempotency_key
```

Repeated requests with the same key should not create duplicate orders.

If implementation time is limited, document this as a future enhancement.

---

# 18. Audit Logging

Audit important operations:

- Login
- User creation
- Product creation/update/disable
- Inventory adjustment
- Inventory transfer
- Order creation
- Order status changes
- Permission changes

Recommended audit record:

```json
{
  "userId": "USER123",
  "organizationId": "ORG001",
  "action": "INVENTORY_UPDATED",
  "entity": "Inventory",
  "entityId": "INV001",
  "oldValue": {},
  "newValue": {},
  "timestamp": "..."
}
```

Audit records should be immutable.

Do not expose update/delete operations for audit records.

Prefer writing audit events in the same database transaction as the associated business change for this assignment.

Document a transactional outbox pattern as a future production enhancement if useful.

---

# 19. Event-Driven Processing

At least one asynchronous workflow must be implemented.

Use RabbitMQ.

Recommended flow:

```text
Order Service
     |
     v
RabbitMQ
     |
     +-- Notification Consumer
             |
             v
            SSE
             |
             v
         React Client
```

Recommended event types:

```text
ORDER_CREATED
ORDER_CANCELLED
INVENTORY_LOW
INVENTORY_UPDATED
INVENTORY_TRANSFER_COMPLETED
```

Keep RabbitMQ infrastructure simple.

Do not split the application into separate deployable microservices merely because a broker is used.

---

# 20. Real-Time Notifications

Use Server-Sent Events.

Suggested endpoint:

```http
GET /api/v1/notifications/stream
```

The connection must be authenticated.

Tenant isolation must also apply to notifications.

A user may receive events only for their organization.

Examples:

```json
{
  "type": "INVENTORY_LOW",
  "productId": "P001",
  "warehouseId": "WH001",
  "remainingQuantity": 3
}
```

---

# 21. Dashboard

Required widgets:

- Total Products
- Total Warehouses
- Available Inventory
- Pending Orders
- Completed Orders
- Low Stock Products
- Recent Orders

Provide a backend endpoint such as:

```http
GET /api/v1/dashboard/summary
```

Cache dashboard metrics in Redis if practical.

---

# 22. Redis Strategy

Redis should be used for at least one meaningful purpose.

Preferred use cases:

1. Refresh token/session storage
2. Dashboard metric cache

Example cache key:

```text
dashboard:{organizationId}:summary
```

Example TTL:

```text
60 seconds
```

Document:

- key format
- TTL
- invalidation policy
- stale-data risk

Possible invalidation:

```text
product change
inventory change
order change
warehouse change
    -> evict dashboard cache
```

---

# 23. REST API

Use versioned REST APIs.

Prefix:

```text
/api/v1
```

Recommended endpoints:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/{id}
PATCH  /api/v1/products/{id}

GET    /api/v1/warehouses
POST   /api/v1/warehouses
GET    /api/v1/warehouses/{id}

GET    /api/v1/inventory
POST   /api/v1/inventory/adjust
POST   /api/v1/inventory/transfer

GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/{id}
PATCH  /api/v1/orders/{id}/status

GET    /api/v1/audit-logs

GET    /api/v1/dashboard/summary

GET    /api/v1/notifications/stream
```

---

# 24. API Response Contract

Use a consistent API response structure.

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Requested quantity is unavailable"
  }
}
```

Provide a global exception handler.

Use proper HTTP status codes.

---

# 25. Pagination

Support:

```http
GET /api/v1/products?page=0&size=20&search=laptop&sort=createdAt,desc
```

Internally use Spring `Pageable`.

Responses should include useful metadata:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 125,
    "totalPages": 7
  }
}
```

---

# 26. Validation

Use Bean Validation.

Examples:

```java
@NotBlank
@Size
@Positive
@Email
@NotNull
```

Reject malformed or invalid requests before business logic execution.

Never expose entity objects directly as API contracts.

Use request/response DTOs.

---

# 27. Security Requirements

The implementation should explicitly address:

- Password hashing
- JWT signature validation
- JWT expiration
- Refresh token security
- Logout/revocation
- RBAC
- Tenant isolation
- Request validation
- SQL injection
- XSS
- CORS
- Rate limiting strategy
- Secure environment variables
- Secret management
- Secure HTTP headers

Do not commit secrets.

Create:

```text
.env.example
```

with placeholder values only.

---

# 28. Logging

Use structured logging.

Important fields:

```text
timestamp
level
requestId
organizationId
userId
method
path
duration
```

Example:

```json
{
  "timestamp": "2026-09-18T10:30:00Z",
  "level": "INFO",
  "requestId": "REQ-123",
  "organizationId": "ORG-1",
  "userId": "USER-1",
  "method": "POST",
  "path": "/api/v1/orders",
  "duration": 143
}
```

Add a request correlation ID filter.

Use MDC if appropriate.

---

# 29. Health Endpoints

Expose:

```text
/actuator/health
```

If practical, document readiness and liveness semantics.

Optional:

```text
/health
/ready
```

Do not spend excessive time implementing observability infrastructure.

Prometheus, Grafana, and OpenTelemetry are bonus-level additions for this submission.

---

# 30. Testing Requirements

Testing is mandatory.

## Unit tests

Prioritize:

- Inventory reservation
- Inventory release
- Inventory adjustment
- Inventory transfer
- Order totals
- Authorization
- Tenant isolation

## Integration tests

Use Testcontainers.

Use real PostgreSQL behavior.

Do not rely solely on H2 for concurrency tests.

## Mandatory concurrency test

Create an integration test where:

```text
initial inventory = 10

100 concurrent requests attempt to buy/reserve 1 each

expected:
successful requests <= 10

final available quantity = 0

reserved/sold quantity = 10
```

The test must demonstrate that overselling cannot occur.

This is one of the highest-priority tests in the repository.

---

# 31. Docker Compose

The entire platform should run with:

```bash
docker compose up --build
```

Recommended services:

```text
frontend
backend
postgres
redis
rabbitmq
```

Optional:

```text
rabbitmq-management
```

Use health checks where useful.

Backend should wait/retry gracefully until infrastructure becomes available.

---

# 32. CI Pipeline

Create:

```text
.github/workflows/ci.yml
```

Recommended stages:

```text
checkout
    |
    v
backend dependency/build
    |
    v
backend unit tests
    |
    v
backend integration tests
    |
    v
frontend install
    |
    v
frontend lint/test
    |
    v
frontend build
    |
    v
docker build
```

Keep the pipeline reliable rather than overly elaborate.

---

# 33. Required Documentation

Repository must contain:

```text
README.md
ARCHITECTURE.md
API.md
DATABASE.md
SECURITY.md
SETUP.md
```

Also create:

```text
SCALABILITY.md
KNOWN_LIMITATIONS.md
```

Recommended ADRs:

```text
docs/adr/
├── ADR-001-modular-monolith.md
├── ADR-002-postgresql.md
├── ADR-003-concurrency-strategy.md
├── ADR-004-jwt-authentication.md
└── ADR-005-rabbitmq.md
```

At least three ADRs should be included.

---

# 34. README Requirements

README should include:

- Project overview
- Feature summary
- Technology stack
- Architecture summary
- Local setup
- Environment variables
- Docker startup
- How to run tests
- API documentation
- Swagger URL
- Default/demo credentials if provided
- Known limitations
- Future improvements
- Architectural assumptions

Clearly state any requirement interpretation or assumption.

---

# 35. Architecture Documentation

`ARCHITECTURE.md` should explain:

- Why modular monolith was selected
- Major domain modules
- Request flow
- Tenant isolation
- Authentication flow
- Authorization
- Inventory consistency
- Order transaction boundary
- RabbitMQ event flow
- SSE notification flow
- Redis usage
- Failure behavior
- Scaling path

Include Mermaid diagrams where useful.

---

# 36. Database Documentation

`DATABASE.md` should contain:

- ER diagram
- Tables
- PKs
- FKs
- unique constraints
- indexes
- composite indexes
- tenant isolation strategy
- concurrency-related design
- important transactional boundaries

Use Mermaid ER diagrams if possible.

---

# 37. Security Documentation

`SECURITY.md` should describe:

- Password hashing
- JWT handling
- Refresh token handling
- Tenant isolation
- RBAC
- Request validation
- CORS
- SQL injection protections
- XSS considerations
- Secret management
- Rate limiting strategy
- Secure headers

---

# 38. Failure Scenarios

Document application behavior when:

- PostgreSQL is unavailable
- Redis is unavailable
- RabbitMQ is unavailable
- SSE connection is lost
- Duplicate order request occurs
- Inventory changes during checkout
- Two inventory updates happen simultaneously

Expected philosophy:

```text
Primary business consistency > notification availability
```

For example:

If RabbitMQ is unavailable, order creation should not silently corrupt state.

Clearly document the chosen failure behavior.

---

# 39. Scalability Documentation

Do not implement all scale mechanisms.

Explain how the system would evolve from roughly:

```text
1,000 users
```

to:

```text
1,000,000 users
```

Cover:

- Stateless backend instances
- Horizontal scaling
- Load balancer
- Redis clustering
- Database connection pooling
- Read replicas
- Partitioning/sharding
- Caching
- CDN
- Message queue scaling
- Async processing
- WebSocket/SSE scaling
- Observability
- Rate limiting

Do not prematurely implement these mechanisms.

---

# 40. Implementation Priority

Agents should work in this order unless blocked.

## Phase 1 — Foundation

```text
[x] Repository structure
[x] Spring Boot project
[x] React project
[x] Docker Compose
[x] PostgreSQL
[x] Redis
[x] RabbitMQ
[x] Flyway
```

## Phase 2 — Database + Domain

```text
[x] Organizations
[x] Users
[x] Products
[x] Warehouses
[x] Customers
[x] Inventory
[x] Orders
[x] OrderItems
[x] AuditLog
```

## Phase 3 — Security

```text
[x] Login
[x] JWT
[x] Refresh token
[x] TenantContext
[x] RBAC
[x] Global authorization rules
```

## Phase 4 — Core Business Features

```text
[x] Product CRUD
[x] Warehouse CRUD
[x] Customer CRUD/basic support
[x] Inventory listing
[x] Inventory adjustment
[x] Inventory transfer
[x] Inventory reservation/release
```

## Phase 5 — Orders

```text
[x] Create order
[x] Atomic inventory reservation
[x] Order listing
[x] Order details
[x] Status transition
[x] Cancellation / release inventory
```

## Phase 6 — Data Integrity

```text
[x] Atomic reservation query
[x] Transaction boundaries
[x] Deadlock-conscious ordering (multi-item reservation and inventory-transfer lock ordering both fixed 2026-09-21 — see KNOWN_LIMITATIONS.md "Fixed in this pass")
[x] Mandatory concurrency integration test
```

## Phase 7 — Audit + Events

```text
[x] Audit logging (login/logout and product/warehouse/customer changes now audited too, 2026-09-21 — every AGENTS.md §18 item is covered)
[x] RabbitMQ publisher (behind a Transactional Outbox — see docs/DESIGN_PATTERNS.md)
[x] Notification consumer
[x] SSE
```

## Phase 8 — Frontend

```text
[x] Login
[x] Dashboard
[x] Products
[x] Warehouses
[x] Inventory
[x] Orders
[x] Order details
[x] Audit logs
[x] Notifications
```

## Phase 9 — Tests

```text
[ ] Unit tests (only inventory-level; see KNOWN_LIMITATIONS.md)
[ ] Tenant isolation tests
[ ] Authorization tests
[ ] Integration tests (only inventory-level)
[x] Concurrency test
```

## Phase 10 — Submission

```text
[x] Swagger/OpenAPI (the /api-docs permit-list bug is fixed — see KNOWN_LIMITATIONS.md)
[x] README
[ ] ARCHITECTURE (deferred — see KNOWN_LIMITATIONS.md "Deferred / assumptions")
[ ] DATABASE (deferred)
[ ] API (deferred)
[ ] SECURITY (deferred)
[ ] SETUP (deferred; covered informally by the root and per-app README files)
[ ] ADRs (deferred)
[ ] SCALABILITY (deferred)
[x] GitHub Actions (.github/workflows/ci.yml added 2026-09-21 — not yet run on an actual GitHub remote from this environment)
[ ] docker compose up verification (Docker unavailable in this environment; verified natively instead — see KNOWN_LIMITATIONS.md)
[ ] final clean clone test (blocked on the same Docker-unavailability constraint)
```

---

# 41. Time-Constrained Scope

If time is limited, prioritize in this exact order:

```text
1. Tenant isolation
2. Inventory data integrity
3. Order creation
4. Mandatory concurrency test
5. Authentication
6. RBAC
7. Core CRUD
8. Docker Compose
9. Documentation
10. Basic frontend
11. RabbitMQ + SSE
12. Redis cache
13. Bonus features
```

Do not sacrifice correctness for UI polish.

---

# 42. Features to Avoid Until Core Requirements Are Complete

Do not initially implement:

- Kubernetes
- Microservices
- Service mesh
- Distributed tracing stack
- Kafka cluster
- Elasticsearch
- Complex CQRS
- Event sourcing
- Multiple database schemas per tenant
- Database sharding
- Multi-region deployment
- Complex device/session management
- Advanced reporting
- Elaborate animation/design system

These may be documented as future improvements.

---

# 43. Code Quality Rules

Agents should follow these rules.

## Backend

- Prefer constructor injection
- Avoid field injection
- Use DTOs
- Keep controllers thin
- Put business rules in services/domain
- Avoid exposing JPA entities directly
- Use transactions deliberately
- Keep tenant checks explicit
- Use centralized exception handling
- Avoid generic `RuntimeException`
- Use meaningful domain error codes
- Avoid N+1 query problems
- Use pagination for collections
- Prefer immutable request/value objects where practical

## Frontend

- Use reusable components
- Avoid duplicated API logic
- Separate API/server state from local UI state
- Handle loading/error/empty states
- Avoid storing access tokens insecurely when a safer mechanism is available
- Keep authorization checks centralized
- Validate forms

---

# 44. Error Codes

Recommended domain error codes:

```text
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_REFRESH_TOKEN_INVALID
ACCESS_DENIED
TENANT_ACCESS_DENIED

PRODUCT_NOT_FOUND
WAREHOUSE_NOT_FOUND
CUSTOMER_NOT_FOUND

INVENTORY_NOT_FOUND
INSUFFICIENT_INVENTORY
INVALID_INVENTORY_ADJUSTMENT

ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
INVALID_ORDER_STATUS_TRANSITION

VALIDATION_ERROR
RESOURCE_CONFLICT
INTERNAL_ERROR
```

---

# 45. Order Status Rules

Define explicit status transitions.

Recommended:

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED

CONFIRMED -> PROCESSING
CONFIRMED -> CANCELLED

PROCESSING -> COMPLETED

COMPLETED -> terminal
CANCELLED -> terminal
```

Document any different assumption.

Do not permit arbitrary status changes.

---

# 46. Inventory Semantics

Use clear definitions:

```text
availableQuantity
```

means stock currently available for new reservation.

```text
reservedQuantity
```

means stock reserved by active orders but not yet finalized/released.

Document how quantities change on:

```text
order created
order confirmed
order completed
order cancelled
inventory transfer
manual adjustment
```

Keep the semantics consistent across code and documentation.

---

# 47. Suggested Inventory Transfer Transaction

Transfer:

```text
BEGIN

validate source + destination belong to same tenant

decrement source inventory atomically

increment destination inventory

write inventory history

write audit event

COMMIT
```

Rollback the entire transfer if any step fails.

---

# 48. OpenAPI

Expose Swagger/OpenAPI.

Document:

- Authentication
- Pagination
- Error responses
- Important request schemas
- `Idempotency-Key` if implemented

Suggested local URL:

```text
http://localhost:8080/swagger-ui.html
```

or the configured Springdoc URL.

---

# 49. Seed Data

Provide minimal seed/demo data.

Example:

```text
Organization: Demo Retail

Admin:
admin@example.com

Manager:
manager@example.com

Staff:
staff@example.com
```

Do not commit real passwords.

Use clearly documented development/demo credentials only.

---

# 50. Definition of Done

The submission is considered ready when all items below are true:

```text
[ ] docker compose up --build starts the full application

[x] frontend can log in

[x] users only see their own tenant data

[x] roles are enforced by backend

[x] products work

[x] warehouses work

[x] inventory works

[x] inventory cannot become negative (app-level atomic updates, plus DB CHECK constraints added 2026-09-21 — see KNOWN_LIMITATIONS.md)

[x] orders can be created

[x] concurrent requests cannot oversell inventory

[x] audit records are generated (every AGENTS.md §18 item now covered, 2026-09-21 — see KNOWN_LIMITATIONS.md)

[x] at least one async RabbitMQ workflow works

[x] real-time notification flow works or is clearly demonstrated

[x] pagination/search/filtering work

[x] Swagger works (the /api-docs permit-list bug is fixed and curl-verified, 2026-09-21)

[ ] unit tests pass (only inventory-level coverage exists; that test is now Testcontainers-based and no longer wipes the dev DB — see KNOWN_LIMITATIONS.md)

[ ] integration tests pass (only inventory-level coverage; no RBAC/tenant/order/controller suites — see KNOWN_LIMITATIONS.md)

[x] concurrency test passes

[ ] README is complete

[ ] architecture docs exist

[ ] ER diagram exists

[ ] ADRs exist

[ ] Docker Compose works from a clean clone

[x] GitHub Actions pipeline exists (.github/workflows/ci.yml, 2026-09-21 — commands verified locally, workflow itself not yet run on GitHub)
```

---

# 51. Agent Operating Instructions

Any coding agent working on this repository should:

1. Read this file before changing code.
2. Inspect the existing project before creating new abstractions.
3. Preserve the modular monolith architecture.
4. Do not introduce new infrastructure unless required.
5. Keep all tenant-owned operations tenant-scoped.
6. Never bypass authorization for convenience.
7. Treat concurrency/data integrity as a first-class requirement.
8. Add or update tests with every important business rule.
9. Use Flyway for schema changes.
10. Keep documentation synchronized with implementation.
11. Run relevant tests before claiming a task is complete.
12. Prefer small, coherent commits/changes.
13. Do not remove working functionality to simplify another feature.
14. Document assumptions instead of silently inventing requirements.
15. Prioritize assignment evaluation criteria over optional polish.

---

# 52. Agent Progress Tracking

When an agent completes meaningful work, update a separate file:

```text
PROGRESS.md
```

Recommended format:

```markdown
# Progress

## Completed

- [x] Spring Boot project initialized
- [x] PostgreSQL Docker container configured
- [x] Organization entity and migration created

## In Progress

- [ ] JWT authentication

## Next

- [ ] TenantContext
- [ ] RBAC
- [ ] Product module

## Known Issues

- None

## Architectural Decisions

- Modular monolith selected
- PostgreSQL selected
- Shared-schema multi-tenancy selected
```

Do not rewrite completed architecture decisions without a clear reason.

---

# 53. Final Engineering Principle

When there is a choice between:

```text
more features
```

and:

```text
correct multi-tenancy + correct transactions + correct concurrency
```

choose correctness.

The strongest version of this assignment is not the one with the most technologies.

It is the one where:

```text
tenant boundaries cannot be crossed,
inventory cannot be oversold,
transactions are coherent,
authorization is enforced,
the system is testable,
and architectural decisions are clearly justified.
```
