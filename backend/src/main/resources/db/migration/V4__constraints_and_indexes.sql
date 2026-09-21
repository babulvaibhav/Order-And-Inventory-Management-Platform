-- Follow-up hardening migration from a documented-then-fixed audit pass (see KNOWN_LIMITATIONS.md
-- "Addressed in this pass"). Adds DB-level guarantees behind guards that, until now, only existed
-- in application code — so a bug in a future code change can't silently violate them.

-- =====================================================================================
-- Inventory must never go negative at the database level, not just via the application's atomic
-- conditional UPDATEs (AGENTS.md §13/§14). Belt-and-suspenders: the application-level guards stay,
-- this is the backstop if they're ever bypassed (a manual SQL fix, a future bulk-update bug, etc).
-- =====================================================================================
ALTER TABLE inventory
    ADD CONSTRAINT chk_inventory_available_non_negative CHECK (available_quantity >= 0),
    ADD CONSTRAINT chk_inventory_reserved_non_negative CHECK (reserved_quantity >= 0);

-- Composite indexes AGENTS.md §10 asks for explicitly, beyond the single-column ones already in
-- V1 (idx_inventory_warehouse_id, idx_inventory_product_id) — these serve the
-- "inventory by warehouse" / "inventory by product" listing queries scoped by organization.
CREATE INDEX idx_inventory_org_warehouse ON inventory(organization_id, warehouse_id);
CREATE INDEX idx_inventory_org_product ON inventory(organization_id, product_id);

-- =====================================================================================
-- Customer email uniqueness was global instead of per-organization (CustomerRepository.findByEmail
-- had no org scope) — two different tenants could never use the same customer email. Partial index
-- (not a plain UNIQUE constraint) so multiple customers with no email (NULL) are still allowed,
-- matching "only name is mandatory" from AGENTS.md §11/README "Users vs Customers".
-- =====================================================================================
CREATE UNIQUE INDEX uk_customers_org_email ON customers(organization_id, email) WHERE email IS NOT NULL;
