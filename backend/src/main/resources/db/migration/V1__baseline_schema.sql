-- Baseline schema for the Order & Inventory Management Platform.
-- Written fresh (not replayed from history) since the project previously relied on
-- Hibernate ddl-auto=update with no prior migrations and no production data to preserve.
-- Column types/constraints mirror the JPA entities exactly, plus the new RBAC/organization tables.

-- =====================================================================================
-- Organizations
-- =====================================================================================
CREATE TABLE organizations (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP
);

-- =====================================================================================
-- Permissions (global reference data) and dynamic Roles
-- =====================================================================================
CREATE TABLE permissions (
    id          UUID PRIMARY KEY,
    code        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    category    VARCHAR(50)  NOT NULL
);

-- organization_id NULL marks the single global platform-level role (Platform Owner).
CREATE TABLE roles (
    id              UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name            VARCHAR(100) NOT NULL,
    is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_roles_organization_id ON roles(organization_id);
-- Postgres treats NULLs as distinct in a plain UNIQUE index, which is fine here: only one
-- organization_id=NULL row is ever created (Platform Owner), enforced by application logic
-- (no API path can create another org-less role).
CREATE UNIQUE INDEX uk_roles_org_name ON roles(organization_id, name);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- =====================================================================================
-- Users
-- =====================================================================================
-- organization_id NULL only for the platform-owner user(s).
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role_id         UUID         NOT NULL REFERENCES roles(id),
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_role_id ON users(role_id);

-- =====================================================================================
-- Products
-- =====================================================================================
CREATE TABLE products (
    id              UUID           PRIMARY KEY,
    organization_id UUID           NOT NULL REFERENCES organizations(id),
    sku             VARCHAR(50)    NOT NULL,
    name            VARCHAR(200)   NOT NULL,
    description     TEXT,
    price           NUMERIC(10,2)  NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP      NOT NULL,
    updated_at      TIMESTAMP,
    CONSTRAINT uk_products_org_sku UNIQUE (organization_id, sku)
);
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_status ON products(organization_id, status);
CREATE INDEX idx_products_created_at ON products(organization_id, created_at);

-- =====================================================================================
-- Warehouses
-- =====================================================================================
CREATE TABLE warehouses (
    id              UUID         PRIMARY KEY,
    organization_id UUID         NOT NULL REFERENCES organizations(id),
    name            VARCHAR(200) NOT NULL,
    address         TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_warehouses_organization_id ON warehouses(organization_id);

-- =====================================================================================
-- Customers
-- =====================================================================================
CREATE TABLE customers (
    id              UUID         PRIMARY KEY,
    organization_id UUID         NOT NULL REFERENCES organizations(id),
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(20),
    address         TEXT,
    created_at      TIMESTAMP    NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_customers_organization_id ON customers(organization_id);

-- =====================================================================================
-- Inventory
-- =====================================================================================
CREATE TABLE inventory (
    id                  UUID    PRIMARY KEY,
    organization_id     UUID    NOT NULL REFERENCES organizations(id),
    warehouse_id        UUID    NOT NULL REFERENCES warehouses(id),
    product_id          UUID    NOT NULL REFERENCES products(id),
    available_quantity  INTEGER NOT NULL DEFAULT 0,
    reserved_quantity   INTEGER NOT NULL DEFAULT 0,
    version             INTEGER,
    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP,
    CONSTRAINT uk_inventory_org_wh_product UNIQUE (organization_id, warehouse_id, product_id)
);
CREATE INDEX idx_inventory_organization_id ON inventory(organization_id);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);

-- =====================================================================================
-- Orders / Order items
-- =====================================================================================
CREATE TABLE orders (
    id              UUID          PRIMARY KEY,
    organization_id UUID          NOT NULL REFERENCES organizations(id),
    customer_id     UUID          NOT NULL REFERENCES customers(id),
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    total_amount    NUMERIC(10,2) NOT NULL,
    notes           VARCHAR(1000),
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_orders_organization_id ON orders(organization_id);
CREATE INDEX idx_orders_status ON orders(organization_id, status);
CREATE INDEX idx_orders_customer_id ON orders(organization_id, customer_id);
CREATE INDEX idx_orders_created_at ON orders(organization_id, created_at);

CREATE TABLE order_items (
    id           UUID          PRIMARY KEY,
    order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   UUID          NOT NULL REFERENCES products(id),
    quantity     INTEGER       NOT NULL,
    unit_price   NUMERIC(10,2) NOT NULL,
    total_price  NUMERIC(10,2) NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id)
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- =====================================================================================
-- Audit logs (immutable)
-- =====================================================================================
CREATE TABLE audit_logs (
    id              UUID      PRIMARY KEY,
    organization_id UUID      NOT NULL REFERENCES organizations(id),
    user_id         UUID,
    action          VARCHAR(100) NOT NULL,
    entity          VARCHAR(100) NOT NULL,
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    timestamp       TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(organization_id, entity);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(organization_id, created_at);

-- =====================================================================================
-- Notifications
-- =====================================================================================
-- user_id NULL means an organization-wide notification (e.g. INVENTORY_LOW, ORDER_CREATED),
-- rather than one addressed to a specific user.
CREATE TABLE notifications (
    id              UUID      PRIMARY KEY,
    organization_id UUID      NOT NULL REFERENCES organizations(id),
    user_id         UUID,
    type            VARCHAR(50) NOT NULL,
    message         TEXT,
    metadata        JSONB,
    read            BOOLEAN   NOT NULL DEFAULT FALSE,
    timestamp       TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP
);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_user_id ON notifications(organization_id, user_id);
CREATE INDEX idx_notifications_read ON notifications(organization_id, read);

-- =====================================================================================
-- Refresh tokens
-- =====================================================================================
CREATE TABLE refresh_tokens (
    id          UUID      PRIMARY KEY,
    user_id     UUID      NOT NULL,
    token       TEXT      NOT NULL UNIQUE,
    expiry_date TIMESTAMP NOT NULL,
    created_at  TIMESTAMP NOT NULL,
    revoked_at  TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens(expiry_date);
