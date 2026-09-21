package com.uphead.platform.common.security;

import java.util.List;
import java.util.Set;

/**
 * Single source of truth for every permission code in the system.
 * Referenced by {@code @PreAuthorize} annotations, the permission catalog seed
 * (V2__seed_permissions.sql) and the default role seeding (DataSeeder / OrganizationService).
 */
public final class PermissionCodes {

    private PermissionCodes() {
    }

    public static final String PRODUCT_READ = "product.read";
    public static final String PRODUCT_WRITE = "product.write";
    public static final String WAREHOUSE_READ = "warehouse.read";
    public static final String WAREHOUSE_WRITE = "warehouse.write";
    public static final String INVENTORY_READ = "inventory.read";
    public static final String INVENTORY_UPDATE = "inventory.update";
    public static final String ORDER_READ = "order.read";
    public static final String ORDER_CREATE = "order.create";
    public static final String ORDER_CANCEL = "order.cancel";
    public static final String CUSTOMER_READ = "customer.read";
    public static final String CUSTOMER_WRITE = "customer.write";
    public static final String USER_READ = "user.read";
    public static final String USER_MANAGE = "user.manage";
    public static final String AUDIT_READ = "audit.read";
    public static final String ROLE_READ = "role.read";
    public static final String ROLE_MANAGE = "role.manage";
    public static final String ORGANIZATION_READ = "organization.read";
    public static final String ORGANIZATION_MANAGE = "organization.manage";

    /** Every permission code that exists in the system — must match V2__seed_permissions.sql. */
    public static final List<String> ALL = List.of(
        PRODUCT_READ, PRODUCT_WRITE,
        WAREHOUSE_READ, WAREHOUSE_WRITE,
        INVENTORY_READ, INVENTORY_UPDATE,
        ORDER_READ, ORDER_CREATE, ORDER_CANCEL,
        CUSTOMER_READ, CUSTOMER_WRITE,
        USER_READ, USER_MANAGE,
        AUDIT_READ,
        ROLE_READ, ROLE_MANAGE,
        ORGANIZATION_READ, ORGANIZATION_MANAGE
    );

    /** Default permission set for a newly-created organization's Admin role. */
    public static final List<String> DEFAULT_ADMIN = List.of(
        PRODUCT_READ, PRODUCT_WRITE,
        WAREHOUSE_READ, WAREHOUSE_WRITE,
        INVENTORY_READ, INVENTORY_UPDATE,
        ORDER_READ, ORDER_CREATE, ORDER_CANCEL,
        CUSTOMER_READ, CUSTOMER_WRITE,
        USER_READ, USER_MANAGE,
        AUDIT_READ,
        ROLE_READ, ROLE_MANAGE
    );

    /** Default permission set for a newly-created organization's Manager role. */
    public static final List<String> DEFAULT_MANAGER = List.of(
        PRODUCT_READ, PRODUCT_WRITE,
        WAREHOUSE_READ, WAREHOUSE_WRITE,
        INVENTORY_READ, INVENTORY_UPDATE,
        ORDER_READ, ORDER_CREATE, ORDER_CANCEL,
        CUSTOMER_READ, CUSTOMER_WRITE,
        AUDIT_READ
    );

    /** Default permission set for a newly-created organization's Staff role. */
    public static final List<String> DEFAULT_STAFF = List.of(
        PRODUCT_READ,
        WAREHOUSE_READ,
        INVENTORY_READ,
        ORDER_READ, ORDER_CREATE,
        CUSTOMER_READ
    );

    /** The platform-level role (organization_id = NULL) that can create/edit organizations. */
    public static final List<String> PLATFORM_OWNER = List.of(
        ORGANIZATION_READ, ORGANIZATION_MANAGE
    );

    /**
     * Codes that must never be grantable to a tenant (organization-scoped) role. Without this
     * check, an org Admin holding {@code role.manage} could add these to their own role and reach
     * {@code OrganizationController} (which is gated on these two codes alone and, by design,
     * queries across every organization) — a cross-tenant privilege escalation. Enforced in
     * {@code RoleService.updatePermissions} and filtered out of the catalog returned to tenant
     * callers by {@code RoleService.listPermissionCatalog}.
     */
    public static final Set<String> PLATFORM_ONLY = Set.of(ORGANIZATION_READ, ORGANIZATION_MANAGE);

    public static final String ROLE_NAME_ADMIN = "Admin";
    public static final String ROLE_NAME_MANAGER = "Manager";
    public static final String ROLE_NAME_STAFF = "Staff";
    public static final String ROLE_NAME_PLATFORM_OWNER = "Platform Owner";
}
